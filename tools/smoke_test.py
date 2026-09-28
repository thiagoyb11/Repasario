"""Prueba un flujo completo de la API local sin escribir en el historial real."""

from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import json

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app


def main():
    with TemporaryDirectory() as folder:
        app.history_dir = lambda: Path(folder)
        server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"

        def get(path):
            with urlopen(base + path) as response:
                return json.load(response)

        def post(path, payload):
            request = Request(base + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(request) as response:
                return json.load(response)

        try:
            assert get("/api/meta")["cantidad"] == 150
            assert b"Repaso" in urlopen(base + "/").read()
            try:
                post("/api/quiz", {"cantidad": 51})
                raise AssertionError("Se aceptaron 51 preguntas")
            except HTTPError as error:
                assert error.code == 400
            quiz = post("/api/quiz", {"cantidad": 2})
            assert len(quiz["preguntas"]) == 2
            assert "correctas" not in quiz["preguntas"][0]
            try:
                post("/api/submit", {"id": quiz["id"], "respuestas": {}})
                raise AssertionError("Se aceptó un cuestionario incompleto")
            except HTTPError as error:
                assert error.code == 400
            ids = [q["id"] for q in quiz["preguntas"]]
            result = post("/api/submit", {"id": quiz["id"], "respuestas": {ids[0]: [0], ids[1]: [0]}})
            assert result["total"] == 2 and len(result["preguntas"]) == 2
            assert get("/api/history")[0]["id"] == quiz["id"]
            assert get("/api/history/" + quiz["id"])["aciertos"] == result["aciertos"]
            assert (Path(folder) / (quiz["id"] + ".json")).exists()
            multi = next(q for q in app.load_bank() if len(q["correctas"]) > 1)
            assert app.public_question(multi)["correctas_count"] == len(multi["correctas"])
            assert app.score_attempt([multi], {multi["id"]: multi["correctas"]})["aciertos"] == 1
            partial = app.score_attempt([multi], {multi["id"]: [multi["correctas"][0]]})
            assert partial["aciertos"] == round(1 / len(multi["correctas"]), 2)
            wrong = next(i for i in range(len(multi["opciones"])) if i not in multi["correctas"])
            assert app.score_attempt([multi], {multi["id"]: [multi["correctas"][0], wrong]})["aciertos"] == 0
            single = next(q for q in app.load_bank() if len(q["correctas"]) == 1)
            mixed = app.score_attempt([single, multi], {single["id"]: single["correctas"], multi["id"]: multi["correctas"]})
            assert mixed["aciertos"] == mixed["total"] == 2
            corrected = next(q for q in app.load_bank() if q["id"] == "original-008")
            assert corrected["correctas"] == [0, 1]
            multi_quiz = post("/api/quiz", {"cantidad": 1})
            with app.LOCK:
                app.SESSIONS[multi_quiz["id"]] = [corrected]
            partial_result = post("/api/submit", {"id": multi_quiz["id"], "respuestas": {corrected["id"]: [0]}})
            assert partial_result["aciertos"] == 0.5
            assert partial_result["preguntas"][0]["puntaje"] == 0.5
            assert get("/api/history/" + multi_quiz["id"])["aciertos"] == 0.5
            print("API, límite, puntaje y guardado: OK")
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
