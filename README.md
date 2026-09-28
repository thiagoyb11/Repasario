# Repaso Java

Aplicación local de cuestionarios sobre Java para Windows, macOS y Linux. Funciona en el navegador mediante un servidor local. La versión de código fuente requiere Python 3.9 o posterior; la versión compilada no requiere instalar Python.

## Versión compilada

El archivo [RepasoJava-macOS-arm64.zip](release/RepasoJava-macOS-arm64.zip) contiene una versión para equipos Mac con Apple Silicon. Para utilizarla, descomprimir el ZIP y abrir **RepasoJava.app**. El archivo `preguntas.json` debe permanecer junto a la aplicación para poder editar el banco de preguntas. La aplicación abre el navegador y se puede cerrar con el botón **Salir**.

Para obtener una versión compilada en Windows, Linux o una Mac Intel, ejecutar la compilación en un equipo con ese sistema y arquitectura. PyInstaller genera binarios para el sistema en el que se ejecuta. Desde la raíz del proyecto:

```text
python -m pip install -r requirements-build.txt
python tools/build_desktop.py
```

En Windows, `python` se puede reemplazar por `py -3`. El ZIP generado se guarda en `release/`.

## Iniciar desde el código fuente

- **Windows:** abrir `lanzar.bat` o ejecutar `py -3 app.py` en una terminal.
- **macOS:** ejecutar `sh lanzar.command` o `python3 app.py`.
- **Linux:** ejecutar `sh lanzar.sh` o `python3 app.py`.

La aplicación abre el navegador en una dirección local `http://127.0.0.1:PUERTO/`. La terminal debe permanecer abierta durante el uso. Para detener el servidor, presionar `Ctrl+C`.

Si el navegador no se abre automáticamente, utilizar la dirección que aparece en la terminal. La opción `--no-browser` evita que se abra el navegador; `--port 8765` fija el puerto.

## Preguntas y puntaje

El archivo [preguntas.json](preguntas.json) contiene **150 preguntas editables**. Cada cuestionario incluye entre 1 y 50 preguntas elegidas al azar.

Cada pregunta vale **1 punto**. Las preguntas con una sola respuesta correcta usan botones de selección; las que tienen varias usan casillas. En estas últimas, cada respuesta correcta marcada suma `1 / cantidad de respuestas correctas` y cada opción incorrecta marcada resta lo mismo, con un mínimo de **0 puntos** por pregunta. Es necesario responder todas las preguntas para finalizar. La revisión muestra las respuestas elegidas, las correctas, el puntaje de cada pregunta y una explicación.

El banco se puede modificar editando el JSON. Los cambios se aplican al crear el siguiente cuestionario. Cada entrada usa esta estructura:

```json
{
  "id": "nueva-001",
  "pregunta": "¿Cuál es el tipo primitivo lógico de Java?",
  "opciones": ["boolean", "Boolean", "bool"],
  "correctas": [0],
  "explicacion": "boolean es un tipo primitivo.",
  "tema": "Fundamentos de Java",
  "origen": "Pregunta nueva",
  "fuente": "Intro-java.pdf"
}
```

`correctas` contiene índices que comienzan en **0**. Una pregunta con varias respuestas válidas puede usar varios índices, por ejemplo `[0, 2]`. Cada `id` debe ser único. Si el JSON contiene un error, la aplicación lo indica al iniciar o crear un cuestionario.

## Historial

Al finalizar un cuestionario, se guarda un archivo JSON con la fecha, las preguntas, las respuestas, la corrección y el puntaje. La pantalla **Historial** permite consultar los intentos anteriores. La ubicación de los archivos aparece en la pantalla inicial y depende del sistema operativo:

| Sistema | Carpeta |
| --- | --- |
| Windows | `%APPDATA%\CuestionariosJava\historial` |
| macOS | `~/Library/Application Support/CuestionariosJava/historial` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/CuestionariosJava/historial` |

Los intentos finalizados permanecen disponibles después de cerrar la aplicación. Los cuestionarios en curso se mantienen en memoria y se guardan al finalizar.

## Archivos

- `app.py`: servidor local y corrección.
- `web/`: interfaz del navegador.
- `preguntas.json`: banco editable.
- `tools/`: scripts para construir el banco de preguntas y compilar la aplicación.
- `tools/build_desktop.py`: genera un paquete compilado en el sistema operativo actual.
