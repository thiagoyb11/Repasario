"""Repasario: cuestionarios de cualquier materia en un servidor local sin dependencias externas."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import random
import re
import sys
import threading
import uuid
import webbrowser
from datetime import datetime
from fractions import Fraction
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


APP_NAME = "Repasario"
LEGACY_DATA_DIRS = ("CuestionariosJava",)
MAX_QUESTIONS = 50

if getattr(sys, "frozen", False):
    ROOT = Path(sys._MEIPASS)
    executable = Path(sys.executable)
    bundle = next((parent for parent in executable.parents if parent.suffix == ".app"), None)
    editable_dir = bundle.parent if bundle else executable.parent
    external_subjects = editable_dir / "materias"
    SUBJECTS = external_subjects if external_subjects.is_dir() else ROOT / "materias"
else:
    ROOT = Path(__file__).resolve().parent
    SUBJECTS = ROOT / "materias"
WEB = ROOT / "web"
SESSIONS: dict[str, dict] = {}
LOCK = threading.Lock()


def history_dir() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming")
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    folder = base / APP_NAME
    if not folder.exists():
        # Conserva el historial de versiones anteriores de la aplicación.
        for legacy in LEGACY_DATA_DIRS:
            if (base / legacy).is_dir():
                try:
                    (base / legacy).rename(folder)
                except OSError:
                    pass
                break
    return folder / "historial"


def subject_files() -> dict[str, Path]:
    if not SUBJECTS.is_dir():
        return {}
    files = (f for f in SUBJECTS.glob("*.json") if f.is_file() and not f.name.startswith("."))
    return {f.stem: f for f in sorted(files, key=lambda f: f.stem.casefold())}


def load_subject(subject_id: str) -> dict:
    """Lee y valida materias/<subject_id>.json."""
    file = subject_files().get(subject_id) if isinstance(subject_id, str) else None
    if file is None:
        raise ValueError("Materia no encontrada")
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{file.name} no es un JSON válido: {exc}") from None
    # Una lista suelta de preguntas también es válida; el nombre sale del archivo.
    if isinstance(data, list):
        data = {"preguntas": data}
    if not isinstance(data, dict):
        raise ValueError(f"{file.name} debe contener un objeto con \"nombre\" y \"preguntas\"")
    name = data.get("nombre", subject_id)
    description = data.get("descripcion", "")
    if not isinstance(name, str) or not name.strip() or not isinstance(description, str):
        raise ValueError(f"Nombre o descripción inválidos en {file.name}")
    return {"id": subject_id, "nombre": name.strip(), "descripcion": description.strip(), "preguntas": validate_questions(data.get("preguntas"), file.name)}


def list_subjects() -> list[dict]:
    """Resumen de cada materia; un archivo con errores no impide usar las demás."""
    subjects = []
    for subject_id in subject_files():
        try:
            subject = load_subject(subject_id)
            count = len(subject["preguntas"])
            subjects.append({"id": subject_id, "nombre": subject["nombre"], "descripcion": subject["descripcion"], "cantidad": count, "maximo": min(MAX_QUESTIONS, count)})
        except (ValueError, OSError) as exc:
            subjects.append({"id": subject_id, "nombre": subject_id, "error": str(exc)})
    return subjects


def validate_questions(data, origin: str) -> list[dict]:
    if not isinstance(data, list) or not data:
        raise ValueError(f"{origin} debe contener una lista no vacía de preguntas")
    seen = set()
    for n, q in enumerate(data, 1):
        if not isinstance(q, dict) or not isinstance(q.get("id"), str) or not q["id"] or q["id"] in seen:
            raise ValueError(f"ID faltante o repetido en la pregunta {n} de {origin}")
        seen.add(q["id"])
        if not isinstance(q.get("pregunta"), str) or not q["pregunta"].strip():
            raise ValueError(f"Enunciado vacío en {q['id']} ({origin})")
        options = q.get("opciones")
        correct = q.get("correctas")
        if not isinstance(options, list) or not 2 <= len(options) <= 8 or any(not isinstance(x, str) or not x.strip() for x in options):
            raise ValueError(f"Opciones inválidas en {q['id']} ({origin})")
        if not isinstance(correct, list) or not correct or len(set(correct)) != len(correct) or any(type(i) is not int or i < 0 or i >= len(options) for i in correct):
            raise ValueError(f"Respuestas correctas inválidas en {q['id']} ({origin})")
    return data


def public_question(q: dict) -> dict:
    return {**{key: q.get(key) for key in ("id", "pregunta", "opciones", "tema", "origen")}, "correctas_count": len(q["correctas"])}


def score_attempt(questions: list[dict], answers: dict) -> dict:
    if set(answers) != {q["id"] for q in questions}:
        raise ValueError("Hay preguntas sin responder o respuestas inesperadas")
    details = []
    total_points = Fraction(0)
    for q in questions:
        selected = answers[q["id"]]
        if not isinstance(selected, list) or not selected or len(set(map(str, selected))) != len(selected) or any(type(i) is not int or i < 0 or i >= len(q["opciones"]) for i in selected):
            raise ValueError(f"Respuesta inválida en {q['id']}")
        if len(q["correctas"]) == 1 and len(selected) != 1:
            raise ValueError(f"Seleccioná una sola respuesta en {q['id']}")
        correct = sorted(q["correctas"])
        hits = len(set(selected) & set(correct))
        errors = len(selected) - hits
        # Cada pregunta vale un punto; una opción incorrecta resta lo mismo que suma una correcta.
        points = Fraction(max(0, hits - errors), len(correct))
        total_points += points
        details.append({**q, "seleccionadas": sorted(selected), "acierto": sorted(selected) == correct, "puntaje": round(float(points), 2)})
    return {"aciertos": round(float(total_points), 2), "total": len(details), "porcentaje": round(float(total_points * 100 / len(details)), 1), "preguntas": details}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload, status=200):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def send_error_json(self, message, status=400):
        self.send_json({"error": message}, status)

    def read_json(self):
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            raise ValueError("Se requiere Content-Type: application/json")
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 100_000:
            raise ValueError("Tamaño de solicitud inválido")
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path == "/api/meta":
                return self.send_json({"aplicacion": APP_NAME, "materias": list_subjects(), "carpeta_materias": str(SUBJECTS), "carpeta_historial": str(history_dir()), "compilada": bool(getattr(sys, "frozen", False))})
            if path == "/api/history":
                folder = history_dir()
                records = []
                if folder.exists():
                    for file in sorted(folder.glob("*.json"), reverse=True):
                        try:
                            data = json.loads(file.read_text(encoding="utf-8"))
                            records.append({**{key: data[key] for key in ("id", "fecha", "aciertos", "total", "porcentaje")}, "materia": data.get("materia")})
                        except (OSError, ValueError, KeyError):
                            continue
                records.sort(key=lambda record: str(record["fecha"]), reverse=True)
                return self.send_json(records)
            match = re.fullmatch(r"/api/history/([0-9a-f-]{36})", path)
            if match:
                file = history_dir() / (match.group(1) + ".json")
                if not file.is_file():
                    return self.send_error_json("Intento no encontrado", 404)
                return self.send_json(json.loads(file.read_text(encoding="utf-8")))
            assets = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"), "/style.css": ("style.css", "text/css")}
            if path in assets:
                name, mime = assets[path]
                raw = (WEB / name).read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", f"{mime}; charset=utf-8")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
                return
            self.send_error_json("Ruta no encontrada", 404)
        except (ValueError, OSError, json.JSONDecodeError) as exc:
            self.send_error_json(str(exc), 500)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self.read_json()
            if not isinstance(body, dict):
                raise ValueError("La solicitud debe ser un objeto JSON")
            if path == "/api/shutdown" and getattr(sys, "frozen", False):
                self.send_json({"cerrando": True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            if path == "/api/quiz":
                count = body.get("cantidad")
                subject = load_subject(body.get("materia"))
                bank = subject["preguntas"]
                limit = min(MAX_QUESTIONS, len(bank))
                if type(count) is not int or not 1 <= count <= limit:
                    raise ValueError(f"Elegí una cantidad entre 1 y {limit}")
                questions = random.SystemRandom().sample(bank, count)
                quiz_id = str(uuid.uuid4())
                label = {"id": subject["id"], "nombre": subject["nombre"]}
                with LOCK:
                    SESSIONS[quiz_id] = {"materia": label, "preguntas": questions}
                return self.send_json({"id": quiz_id, "materia": label, "preguntas": [public_question(q) for q in questions]})
            if path == "/api/submit":
                quiz_id = body.get("id")
                if not isinstance(quiz_id, str):
                    raise ValueError("Identificador de cuestionario inválido")
                with LOCK:
                    session = SESSIONS.get(quiz_id)
                if session is None:
                    raise ValueError("El cuestionario ya fue entregado o no existe")
                answers = body.get("respuestas")
                if not isinstance(answers, dict):
                    raise ValueError("Respuestas inválidas")
                result = score_attempt(session["preguntas"], answers)
                result.update({"id": quiz_id, "materia": session["materia"], "fecha": datetime.now().astimezone().isoformat(timespec="seconds")})
                folder = history_dir()
                folder.mkdir(parents=True, exist_ok=True)
                destination = folder / (quiz_id + ".json")
                temporary = folder / (quiz_id + ".tmp")
                temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                temporary.replace(destination)
                with LOCK:
                    SESSIONS.pop(quiz_id, None)
                return self.send_json(result)
            self.send_error_json("Ruta no encontrada", 404)
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_error_json(str(exc))
        except OSError as exc:
            self.send_error_json(f"No se pudo guardar el intento: {exc}", 500)


def main():
    parser = argparse.ArgumentParser(description=f"{APP_NAME}: cuestionarios de cualquier materia en el navegador local")
    parser.add_argument("--port", type=int, default=0, help="Puerto local (0 elige uno libre)")
    parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador automáticamente")
    args = parser.parse_args()
    subjects = list_subjects()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Materias en {SUBJECTS}:")
    for subject in subjects:
        print(f"  - {subject['nombre']}: " + (f"ERROR: {subject['error']}" if "error" in subject else f"{subject['cantidad']} preguntas"))
    if not subjects:
        print("  (ninguna: agregá un archivo .json en esa carpeta)")
    print(f"Historial: {history_dir()}")
    print(f"Abrí {url} (Ctrl+C para salir)")
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAplicación cerrada")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
