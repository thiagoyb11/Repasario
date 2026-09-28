"""Compila una distribución nativa en el sistema operativo actual."""

from pathlib import Path
import os
import platform
import shutil
import subprocess
import sys
import uuid
from zipfile import ZipFile, ZIP_DEFLATED


ROOT = Path(__file__).resolve().parents[1]
NAME = "RepasoJava"
SYSTEM = platform.system()


def main():
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        raise SystemExit("Falta PyInstaller. Instalalo con: python -m pip install pyinstaller")

    work = ROOT / ".build"
    work.mkdir(exist_ok=True)
    command = [
        sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onedir",
        "--name", NAME,
        "--add-data", f"{ROOT / 'web'}:web",
        "--add-data", f"{ROOT / 'preguntas.json'}:.",
        "--distpath", str(ROOT / "dist"),
        "--workpath", str(work),
        "--specpath", str(work),
    ]
    if SYSTEM in ("Darwin", "Windows"):
        command.append("--windowed")
    command.append(str(ROOT / "app.py"))
    environment = os.environ.copy()
    environment["PYINSTALLER_CONFIG_DIR"] = str(work / "cache")
    subprocess.run(command, cwd=ROOT, env=environment, check=True)

    architecture = platform.machine().lower()
    label = {"Darwin": "macOS", "Windows": "Windows", "Linux": "Linux"}.get(SYSTEM, SYSTEM)
    release = ROOT / "release" / f"{NAME}-{label}-{architecture}"
    staging = release.with_name(f".{release.name}-{uuid.uuid4().hex[:8]}")
    staging.mkdir(parents=True)
    if SYSTEM == "Darwin":
        app = ROOT / "dist" / f"{NAME}.app"
        shutil.copytree(app, staging / app.name, symlinks=True)
    else:
        bundle = ROOT / "dist" / NAME
        shutil.copytree(bundle, staging, symlinks=True, dirs_exist_ok=True)
    shutil.copy2(ROOT / "preguntas.json", staging / "preguntas.json")
    instructions = (
        "Repaso Java - versión compilada\n\n"
        + ("Abrí RepasoJava.app con doble clic.\n" if SYSTEM == "Darwin" else
           "Abrí RepasoJava.exe con doble clic.\n" if SYSTEM == "Windows" else
           "Ejecutá ./RepasoJava desde esta carpeta.\n")
        + "La aplicación abre el navegador local. Usá el botón Salir para cerrarla.\n"
        + "Podés editar preguntas.json, que está junto a la aplicación.\n"
    )
    (staging / "LEEME.txt").write_text(instructions, encoding="utf-8")
    if release.exists():
        release.rename(work / f"{release.name}-previous-{uuid.uuid4().hex[:8]}")
    staging.rename(release)

    archive = release.with_suffix(".zip")
    if SYSTEM == "Darwin":
        subprocess.run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", str(release), str(archive)], check=True)
    else:
        with ZipFile(archive, "w", ZIP_DEFLATED, compresslevel=9) as output:
            for file in release.rglob("*"):
                if file.is_file():
                    output.write(file, file.relative_to(release.parent))
    print(f"Distribución compilada: {archive}")


if __name__ == "__main__":
    main()
