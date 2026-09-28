# Repaso Java

Aplicación local de cuestionarios para Windows, macOS y Linux. La **versión compilada** se abre sin instalar Python. La versión de código fuente usa Python 3.9 o posterior y el navegador del equipo.

## Versión compilada: doble clic

En esta Mac se generó [RepasoJava-macOS-arm64.zip](release/RepasoJava-macOS-arm64.zip) para equipos Apple Silicon. Descomprimir el ZIP y abrir **RepasoJava.app** con doble clic. Mantener `preguntas.json` junto a la app para editar el banco. La aplicación abre el navegador y muestra el botón **Salir** para cerrarla.

Para Windows y Linux hay que compilar en una computadora con ese sistema operativo. PyInstaller genera binarios para el sistema en el que se ejecuta. Desde esta carpeta:

```text
python -m pip install -r requirements-build.txt
python tools/build_desktop.py
```

En Windows, `python` se puede reemplazar por `py -3`. El ZIP compilado aparecerá en `release/`. La compilación se hace una sola vez; quien use la versión resultante no necesita instalar Python.

La app de macOS incluida aquí es para arquitectura **arm64**. Para una Mac Intel se debe ejecutar el mismo proceso de compilación en una Mac Intel.

## Iniciar desde el código fuente

- **Windows:** hacer doble clic en `lanzar.bat`, o ejecutar `py -3 app.py` en una terminal.
- **macOS:** ejecutar `sh lanzar.command`, o `python3 app.py`. También se puede hacer doble clic en `lanzar.command` si el sistema permite abrirlo.
- **Linux:** ejecutar `sh lanzar.sh`, o `python3 app.py`.

Se abrirá el navegador en una dirección local `http://127.0.0.1:PUERTO/`. La terminal debe permanecer abierta mientras se usa la aplicación. Para cerrar, presionar `Ctrl+C`.

Si el navegador no se abre automáticamente, usar la dirección que aparece en la terminal. Para iniciarla sin abrirlo: `python3 app.py --no-browser`. Se puede fijar un puerto con `--port 8765`.

## Preguntas y puntaje

El archivo [preguntas.json](preguntas.json) contiene **150 preguntas editables**: 74 originales distintas de los HTML, 12 adaptadas de cuatro ejercicios originales de emparejamiento y 64 nuevas. Las preguntas de verdadero/falso originales aparecen como selección entre dos opciones. Cada cuestionario contiene de 1 a 50 preguntas elegidas al azar.

Cada pregunta vale **1 punto**. Las preguntas con una sola respuesta correcta usan botones de selección; las que tienen varias usan casillas. En estas últimas, cada respuesta correcta marcada suma `1 / cantidad de respuestas correctas` y cada opción incorrecta marcada resta lo mismo, con un mínimo de **0 puntos** por pregunta. Así, marcar todas las correctas suma exactamente **1 punto**. Deben responderse todas las preguntas para finalizar. La revisión muestra las respuestas elegidas, las correctas, el puntaje de cada pregunta y una explicación.

Para modificar el banco, editar el JSON con cualquier editor de texto. Los cambios se aplican al crear el próximo cuestionario. Cada entrada usa esta estructura:

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

`correctas` contiene índices empezando en **0**. Para una pregunta con más de una respuesta válida, usar varios índices, por ejemplo `[0, 2]`. Cada `id` debe ser único. Si el JSON tiene un error, la aplicación lo indicará al iniciar o crear un cuestionario.

## Historial

Al finalizar se guarda un archivo JSON por intento, con fecha, preguntas, respuestas, corrección y puntaje. La pantalla **Historial** permite abrir cualquier revisión anterior. La carpeta se indica en la pantalla inicial y sigue las convenciones del sistema:

| Sistema | Carpeta |
| --- | --- |
| Windows | `%APPDATA%\CuestionariosJava\historial` |
| macOS | `~/Library/Application Support/CuestionariosJava/historial` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/CuestionariosJava/historial` |

Los intentos terminados permanecen disponibles aunque se cierre la aplicación. Los cuestionarios en curso viven en memoria y no se guardan hasta finalizar.

## Archivos

- `app.py`: servidor local y corrección.
- `web/`: interfaz del navegador.
- `preguntas.json`: banco editable.
- `tools/`: scripts utilizados para extraer y construir el banco; no hacen falta para ejecutar la aplicación.
- `tools/build_desktop.py`: genera un paquete compilado en el sistema operativo actual.
