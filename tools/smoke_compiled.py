"""Comprueba que la app macOS empaquetada carga sus recursos y el JSON externo."""

from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen
import json
import shutil
import socket
import subprocess
import time


ROOT = Path(__file__).resolve().parents[1]


def main():
    source = ROOT / "dist" / "RepasoJava.app"
    if not source.is_dir():
        raise SystemExit("Primero hay que compilar dist/RepasoJava.app")
    with TemporaryDirectory() as folder:
        target = Path(folder) / "RepasoJava.app"
        shutil.copytree(source, target, symlinks=True)
        bank = json.loads((ROOT / "preguntas.json").read_text(encoding="utf-8"))
        sample = [bank[0], bank[7]]
        (Path(folder) / "preguntas.json").write_text(json.dumps(sample, ensure_ascii=False), encoding="utf-8")
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        process = subprocess.Popen([str(target / "Contents" / "MacOS" / "RepasoJava"), "--no-browser", "--port", str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        base = f"http://127.0.0.1:{port}"
        try:
            deadline = time.monotonic() + 15
            while True:
                try:
                    with urlopen(base + "/api/meta", timeout=1) as response:
                        meta = json.load(response)
                    break
                except OSError:
                    if process.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError("La aplicación compilada no inició: " + process.stderr.read().decode(errors="replace"))
                    time.sleep(0.1)
            assert meta["cantidad"] == 2, meta
            assert meta["compilada"] is True
            assert b"Repaso" in urlopen(base + "/").read()
            assert b"showQuiz" in urlopen(base + "/app.js").read()
            request = Request(base + "/api/shutdown", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(request) as response:
                assert json.load(response)["cerrando"]
            assert process.wait(timeout=10) == 0
            print("App compilada, recursos, JSON externo y salida: OK")
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)


if __name__ == "__main__":
    main()
