"""Prueba un flujo completo de la API local sin tocar las materias ni el historial reales."""

from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import json

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app


def question(n, correct=(0,)):
    return {"id": f"p{n:02d}", "pregunta": f"Pregunta {n}", "opciones": ["A", "B", "C", "D"], "correctas": list(correct), "explicacion": "Porque sí.", "tema": "Tema de prueba"}


def main():
    # Las materias incluidas en el repositorio deben ser válidas.
    real = app.list_subjects()
    assert real and not [s for s in real if "error" in s], real

    with TemporaryDirectory() as folder:
        subjects = Path(folder) / "materias"
        subjects.mkdir()
        history = Path(folder) / "historial"
        big = [question(1, (0, 1))] + [question(n) for n in range(2, 61)]
        (subjects / "historia.json").write_text(json.dumps({"nombre": "Historia Argentina", "descripcion": "Siglo XIX", "preguntas": big}, ensure_ascii=False), encoding="utf-8")
        (subjects / "Álgebra lineal.json").write_text(json.dumps([question(1), question(2)]), encoding="utf-8")
        (subjects / "rota.json").write_text("{", encoding="utf-8")
        (subjects / "repetida.json").write_text(json.dumps({"preguntas": [question(1), question(1)]}), encoding="utf-8")
        app.SUBJECTS = subjects
        app.history_dir = lambda: history
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

        def rejected(payload, path="/api/quiz"):
            try:
                post(path, payload)
            except HTTPError as error:
                return error.code == 400
            return False

        try:
            meta = get("/api/meta")
            assert meta["aplicacion"] == "Repasario"
            listed = {s["id"]: s for s in meta["materias"]}
            assert set(listed) == {"historia", "Álgebra lineal", "rota", "repetida"}
            assert listed["historia"] == {"id": "historia", "nombre": "Historia Argentina", "descripcion": "Siglo XIX", "cantidad": 60, "maximo": 50}
            assert listed["Álgebra lineal"]["nombre"] == "Álgebra lineal" and listed["Álgebra lineal"]["maximo"] == 2
            assert "error" in listed["rota"] and "error" in listed["repetida"]
            assert b"Repasario" in urlopen(base + "/").read()

            assert rejected({"materia": "historia", "cantidad": 51}), "Se aceptaron 51 preguntas"
            assert rejected({"materia": "Álgebra lineal", "cantidad": 3}), "Se pidieron más preguntas que las del banco"
            assert rejected({"materia": "inexistente", "cantidad": 1}), "Se aceptó una materia inexistente"
            assert rejected({"materia": "rota", "cantidad": 1}), "Se aceptó una materia con errores"
            assert rejected({"cantidad": 1}), "Se aceptó un cuestionario sin materia"

            quiz = post("/api/quiz", {"materia": "Álgebra lineal", "cantidad": 2})
            assert quiz["materia"] == {"id": "Álgebra lineal", "nombre": "Álgebra lineal"}
            assert len(quiz["preguntas"]) == 2
            assert "correctas" not in quiz["preguntas"][0]
            assert rejected({"id": quiz["id"], "respuestas": {}}, "/api/submit"), "Se aceptó un cuestionario incompleto"
            ids = [q["id"] for q in quiz["preguntas"]]
            result = post("/api/submit", {"id": quiz["id"], "respuestas": {ids[0]: [0], ids[1]: [1]}})
            assert result["total"] == 2 and result["aciertos"] == 1 and result["materia"]["id"] == "Álgebra lineal"
            assert rejected({"id": quiz["id"], "respuestas": {ids[0]: [0], ids[1]: [1]}}, "/api/submit"), "Se entregó dos veces"
            record = get("/api/history")[0]
            assert record["id"] == quiz["id"] and record["materia"]["nombre"] == "Álgebra lineal"
            assert get("/api/history/" + quiz["id"])["aciertos"] == result["aciertos"]
            assert (history / (quiz["id"] + ".json")).exists()

            # Un intento guardado por una versión anterior, sin materia, sigue apareciendo.
            old_id = "00000000-0000-0000-0000-000000000000"
            (history / (old_id + ".json")).write_text(json.dumps({"id": old_id, "fecha": "2020-01-01T00:00:00-03:00", "aciertos": 1, "total": 1, "porcentaje": 100.0, "preguntas": []}), encoding="utf-8")
            assert [r["id"] for r in get("/api/history")] == [quiz["id"], old_id]
            assert get("/api/history")[1]["materia"] is None

            single, multi = question(2), question(1, (0, 1))
            assert app.public_question(multi)["correctas_count"] == 2
            assert app.score_attempt([multi], {multi["id"]: [0, 1]})["aciertos"] == 1
            assert app.score_attempt([multi], {multi["id"]: [0]})["aciertos"] == 0.5
            assert app.score_attempt([multi], {multi["id"]: [0, 2]})["aciertos"] == 0
            mixed = app.score_attempt([single, multi], {single["id"]: [0], multi["id"]: [0, 1]})
            assert mixed["aciertos"] == mixed["total"] == 2

            multi_quiz = post("/api/quiz", {"materia": "historia", "cantidad": 1})
            with app.LOCK:
                app.SESSIONS[multi_quiz["id"]]["preguntas"] = [multi]
            partial_result = post("/api/submit", {"id": multi_quiz["id"], "respuestas": {multi["id"]: [0]}})
            assert partial_result["aciertos"] == 0.5
            assert partial_result["preguntas"][0]["puntaje"] == 0.5
            assert get("/api/history/" + multi_quiz["id"])["aciertos"] == 0.5

            # Una materia agregada con la aplicación abierta aparece sin reiniciar.
            (subjects / "nueva.json").write_text(json.dumps([question(1)]), encoding="utf-8")
            assert "nueva" in {s["id"] for s in get("/api/meta")["materias"]}
            print("API, materias, límite, puntaje y guardado: OK")
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
