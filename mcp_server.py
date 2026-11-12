"""Servidor MCP de Repasario (stdio, sin dependencias externas).

Permite consultar y editar los bancos de preguntas de materias/ y abrir la aplicación.
Reutiliza la validación de app.py, así que nunca guarda un archivo que la app no pueda leer.
"""

from __future__ import annotations

import json
import re
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

import app

PROTOCOL_VERSION = "2025-06-18"
SUBJECT_ID = re.compile(r"[A-Za-z0-9_-]+")
_app_process: subprocess.Popen | None = None
_app_url: str | None = None


# ---------- Acceso a los archivos de materias ----------

def subject_path(subject_id, must_exist=True) -> Path:
    if not isinstance(subject_id, str) or not SUBJECT_ID.fullmatch(subject_id):
        raise ValueError("El identificador de materia solo admite letras, números, '-' y '_'")
    path = app.SUBJECTS / f"{subject_id}.json"
    if must_exist and not path.is_file():
        raise ValueError(f"No existe la materia '{subject_id}'. Usá listar_materias para ver las disponibles.")
    if not must_exist and path.exists():
        raise ValueError(f"Ya existe la materia '{subject_id}'")
    return path


def read_raw(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path.name} no es un JSON válido: {exc}") from None


def questions_of(raw) -> list:
    return raw if isinstance(raw, list) else raw.get("preguntas", [])


def write_raw(path: Path, raw, questions: list) -> None:
    """Valida con las reglas de la app y escribe de forma atómica, conservando el formato del archivo."""
    app.validate_questions(questions, path.name)
    if isinstance(raw, list):
        raw = questions
    else:
        raw["preguntas"] = questions
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


# ---------- Herramientas ----------

def listar_materias(_args):
    return {"carpeta": str(app.SUBJECTS), "materias": app.list_subjects()}


def ver_materia(args):
    raw = read_raw(subject_path(args.get("materia")))
    questions = questions_of(raw)
    if args.get("tema"):
        needle = args["tema"].casefold()
        questions = [q for q in questions if needle in str(q.get("tema", "")).casefold()]
    if args.get("buscar"):
        needle = args["buscar"].casefold()
        questions = [q for q in questions if needle in json.dumps(q, ensure_ascii=False).casefold()]
    meta = {} if isinstance(raw, list) else {k: raw.get(k) for k in ("nombre", "descripcion")}
    temas = sorted({str(q.get("tema")) for q in questions_of(raw) if q.get("tema")})
    return {**meta, "total_en_archivo": len(questions_of(raw)), "temas": temas, "mostradas": len(questions), "preguntas": questions}


def guardar_pregunta(args):
    path = subject_path(args.get("materia"))
    question = args.get("pregunta")
    if not isinstance(question, dict) or not isinstance(question.get("id"), str):
        raise ValueError("'pregunta' debe ser un objeto con un 'id' de texto")
    raw = read_raw(path)
    questions = list(questions_of(raw))
    index = next((i for i, q in enumerate(questions) if isinstance(q, dict) and q.get("id") == question["id"]), None)
    if index is None:
        questions.append(question)
        action = "agregada"
    else:
        questions[index] = question
        action = "reemplazada"
    write_raw(path, raw, questions)
    return {"resultado": f"Pregunta {question['id']} {action}", "total": len(questions)}


def eliminar_pregunta(args):
    path = subject_path(args.get("materia"))
    raw = read_raw(path)
    questions = questions_of(raw)
    remaining = [q for q in questions if not (isinstance(q, dict) and q.get("id") == args.get("id"))]
    if len(remaining) == len(questions):
        raise ValueError(f"No existe la pregunta '{args.get('id')}'")
    write_raw(path, raw, remaining)
    return {"resultado": f"Pregunta {args['id']} eliminada", "total": len(remaining)}


def crear_materia(args):
    path = subject_path(args.get("materia"), must_exist=False)
    name = args.get("nombre")
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Falta el nombre de la materia")
    raw = {"nombre": name.strip(), "descripcion": args.get("descripcion") or "", "preguntas": []}
    write_raw(path, raw, args.get("preguntas") or [])
    return {"resultado": f"Materia creada en {path}"}


def _port_open(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.2)
        return s.connect_ex(("127.0.0.1", port)) == 0


def abrir_app(_args):
    global _app_process, _app_url
    if _app_process is not None and _app_process.poll() is None:
        webbrowser.open(_app_url)
        return {"resultado": f"La app ya estaba abierta; se abrió {_app_url} en el navegador"}
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    _app_process = subprocess.Popen(
        [sys.executable, str(Path(app.__file__).resolve()), "--port", str(port), "--no-browser"],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True,  # sigue abierta aunque se cierre el cliente MCP
    )
    deadline = time.monotonic() + 10
    while not _port_open(port):
        if _app_process.poll() is not None:
            raise ValueError(f"La app terminó al iniciar (código {_app_process.returncode})")
        if time.monotonic() > deadline:
            raise ValueError("La app no respondió a tiempo")
        time.sleep(0.1)
    _app_url = f"http://127.0.0.1:{port}/"
    webbrowser.open(_app_url)
    return {"resultado": f"App abierta en {_app_url}", "pid": _app_process.pid}


QUESTION_SCHEMA = {
    "type": "object",
    "description": "Pregunta con el formato del banco. 'correctas' es una lista de índices (desde 0) de 'opciones'; con más de un índice la pregunta es de respuesta múltiple. Con \"tipo\": \"desarrollo\" se responde con texto libre: lleva 'respuesta' (modelo) en lugar de 'opciones' y 'correctas', y no suma puntaje. Los textos pueden incluir imágenes con ![descripción](ruta), con la ruta relativa a la carpeta de materias (por ejemplo imagenes/materia/diagrama.png).",
    "properties": {
        "id": {"type": "string"},
        "tipo": {"type": "string", "enum": ["opciones", "desarrollo"], "description": "Por defecto 'opciones'"},
        "pregunta": {"type": "string"},
        "respuesta": {"type": "string", "description": "Respuesta modelo de una pregunta de desarrollo"},
        "opciones": {"type": "array", "items": {"type": "string"}, "minItems": 2},
        "correctas": {"type": "array", "items": {"type": "integer", "minimum": 0}, "minItems": 1},
        "explicacion": {"type": "string"},
        "tema": {"type": "string"},
        "origen": {"type": "string"},
        "fuente": {"type": "string"},
        "mezclar": {"type": "boolean", "description": "false deja las opciones en el orden escrito (por defecto se mezclan en cada cuestionario)"},
    },
    "required": ["id", "pregunta"],
}
MATERIA = {"type": "string", "description": "Identificador de la materia: nombre del archivo sin .json (por ejemplo 'desarrollo-software')"}

TOOLS = {
    "listar_materias": (listar_materias, "Lista las materias disponibles con su cantidad de preguntas o el error de validación.", {}, []),
    "ver_materia": (ver_materia, "Devuelve las preguntas de una materia, con filtros opcionales por tema o texto.",
                    {"materia": MATERIA, "tema": {"type": "string", "description": "Filtra por tema (coincidencia parcial)"},
                     "buscar": {"type": "string", "description": "Filtra por texto en cualquier campo"}}, ["materia"]),
    "guardar_pregunta": (guardar_pregunta, "Agrega una pregunta o reemplaza la que tenga el mismo id. Valida el banco completo antes de guardar.",
                         {"materia": MATERIA, "pregunta": QUESTION_SCHEMA}, ["materia", "pregunta"]),
    "eliminar_pregunta": (eliminar_pregunta, "Elimina una pregunta por id.", {"materia": MATERIA, "id": {"type": "string"}}, ["materia", "id"]),
    "crear_materia": (crear_materia, "Crea un archivo de materia nuevo. Necesita al menos una pregunta.",
                      {"materia": MATERIA, "nombre": {"type": "string"}, "descripcion": {"type": "string"},
                       "preguntas": {"type": "array", "items": QUESTION_SCHEMA, "minItems": 1}}, ["materia", "nombre", "preguntas"]),
    "abrir_app": (abrir_app, "Inicia Repasario en un puerto local y la abre en el navegador (o reabre la pestaña si ya está corriendo). Los cambios en las materias se ven al volver a la pantalla inicial.", {}, []),
}


# ---------- Protocolo MCP (JSON-RPC por stdio) ----------

def handle(message: dict):
    method, params = message.get("method"), message.get("params") or {}
    if method == "initialize":
        return {"protocolVersion": params.get("protocolVersion", PROTOCOL_VERSION), "capabilities": {"tools": {}},
                "serverInfo": {"name": "repasario", "version": "1.0.0"}}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": [{"name": name, "description": desc,
                           "inputSchema": {"type": "object", "properties": props, "required": required}}
                          for name, (_fn, desc, props, required) in TOOLS.items()]}
    if method == "tools/call":
        tool = TOOLS.get(params.get("name"))
        if tool is None:
            raise LookupError(f"Herramienta desconocida: {params.get('name')}")
        try:
            result = tool[0](params.get("arguments") or {})
            return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]}
        except (ValueError, OSError) as exc:
            return {"content": [{"type": "text", "text": str(exc)}], "isError": True}
    raise LookupError(f"Método no soportado: {method}")


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            reply = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "JSON inválido"}}
        else:
            if "id" not in message:  # notificación: no lleva respuesta
                continue
            try:
                reply = {"jsonrpc": "2.0", "id": message["id"], "result": handle(message)}
            except LookupError as exc:
                reply = {"jsonrpc": "2.0", "id": message["id"], "error": {"code": -32601, "message": str(exc)}}
            except Exception as exc:  # noqa: BLE001 - el servidor no debe caerse por una solicitud
                reply = {"jsonrpc": "2.0", "id": message["id"], "error": {"code": -32603, "message": str(exc)}}
        sys.stdout.write(json.dumps(reply, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
