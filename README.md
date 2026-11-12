# Repasario

Aplicación local de cuestionarios para repasar cualquier materia en Windows, macOS y Linux. Cada materia es un archivo JSON con su banco de preguntas. Funciona en el navegador mediante un servidor local. La versión de código fuente requiere Python 3.9 o posterior; la versión compilada no requiere instalar Python.

## Versión compilada

La carpeta `release/` contiene versiones compiladas para dos sistemas:

| Sistema | Archivo | Para abrir |
| --- | --- | --- |
| Windows (x64) | [Repasario-Windows-amd64.zip](release/Repasario-Windows-amd64.zip) | **Repasario.exe** |
| macOS (Apple Silicon) | [Repasario-macOS-arm64.zip](release/Repasario-macOS-arm64.zip) | **Repasario.app** |

Para utilizarla, descomprimir el ZIP y abrir la aplicación con doble clic. La carpeta `materias` debe permanecer junto a la aplicación para poder editar los bancos de preguntas o agregar materias. La aplicación abre el navegador y se puede cerrar con el botón **Salir**.

En Windows, la aplicación no tiene firma digital, por lo que la primera vez SmartScreen puede mostrar el aviso "Windows protegió su PC". Para continuar, elegir **Más información** y luego **Ejecutar de todas formas**.

Para obtener una versión compilada en Linux, en una Mac Intel o en Windows ARM, ejecutar la compilación en un equipo con ese sistema y arquitectura. PyInstaller genera binarios para el sistema en el que se ejecuta. Desde la raíz del proyecto:

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

## Materias

Cada archivo `.json` de la carpeta [materias](materias) es una materia. Para agregar una, crear un archivo nuevo en esa carpeta, por ejemplo `materias/historia.json`; para quitarla, borrar o mover el archivo. La pantalla inicial permite elegir la materia del cuestionario y muestra la ubicación de la carpeta. Los cambios se aplican al volver a la pantalla inicial, sin reiniciar la aplicación.

El repositorio incluye las materias [Desarrollo de Software](materias/desarrollo-software.json), con **150 preguntas** sobre Java, [Diseño de Sistemas – Parcial 2](materias/diseno-sistemas-p2.json), con **126 preguntas**, y [Diseño de Sistemas – Banco de parciales](materias/diseno-sistemas-banco-parciales.json), con **60 preguntas** de parciales anteriores, varias con diagramas.

Cada archivo usa esta estructura:

```json
{
  "nombre": "Historia Argentina",
  "descripcion": "Unidades 1 a 4 del programa.",
  "preguntas": [
    {
      "id": "historia-001",
      "pregunta": "¿En qué año se declaró la independencia argentina?",
      "opciones": ["1810", "1816", "1853"],
      "correctas": [1],
      "explicacion": "La independencia se declaró el 9 de julio de 1816 en Tucumán.",
      "tema": "Independencia",
      "origen": "Pregunta nueva",
      "fuente": "Apunte de la unidad 2"
    }
  ]
}
```

- `nombre` es el texto que se muestra en la aplicación. Si falta, se usa el nombre del archivo. `descripcion` es opcional.
- `preguntas` debe tener al menos una pregunta. Cada pregunta requiere `id`, `pregunta`, `opciones` (entre 2 y 8) y `correctas`; `explicacion`, `tema`, `origen`, `fuente` y `mezclar` son opcionales.
- `correctas` contiene índices que comienzan en **0**. Una pregunta con varias respuestas válidas puede usar varios índices, por ejemplo `[0, 2]`.
- Las opciones se muestran en orden aleatorio en cada cuestionario. Las del tipo "Todas las anteriores" o "Ninguna de las anteriores" quedan en la posición en la que se escribieron. Para conservar el orden original de una pregunta, agregar `"mezclar": false`.
- Cada `id` debe ser único dentro de la materia.
- En el enunciado, el texto encerrado entre dos marcas de tres acentos graves se muestra como bloque de código.
- El enunciado, las opciones, la explicación y la respuesta pueden incluir imágenes con la sintaxis `![descripción](imagenes/mi-materia/diagrama.png)`. La ruta es relativa a la carpeta `materias` (formatos PNG, JPG, GIF, WebP o SVG) y la imagen debe existir. Las imágenes se pueden ampliar con el botón **Ampliar**. Si alguna opción tiene una imagen, la lista de opciones tiene una altura fija con barra de desplazamiento.
- Una pregunta con `"tipo": "desarrollo"` se responde con texto libre. En lugar de `opciones` y `correctas` lleva `respuesta`, la respuesta esperada que se muestra en la revisión.
- El archivo también puede contener directamente la lista de preguntas, sin `nombre` ni `descripcion`.

Si un archivo contiene un error, la pantalla inicial indica cuál es y las demás materias siguen disponibles.

## Cuestionarios y puntaje

Cada cuestionario incluye entre 1 y 50 preguntas de la materia elegida, seleccionadas al azar y con las opciones en orden aleatorio.

Cada pregunta vale **1 punto**. Las preguntas con una sola respuesta correcta usan botones de selección; las que tienen varias usan casillas. En estas últimas, cada respuesta correcta marcada suma `1 / cantidad de respuestas correctas` y cada opción incorrecta marcada resta lo mismo, con un mínimo de **0 puntos** por pregunta. Las preguntas de desarrollo no tienen corrección automática: no suman puntaje y la revisión muestra la respuesta escrita junto a la esperada. Es necesario responder todas las preguntas para finalizar. La revisión muestra las respuestas elegidas, las correctas, el puntaje de cada pregunta y una explicación.

## Historial

Al finalizar un cuestionario, se guarda un archivo JSON con la fecha, la materia, las preguntas, las respuestas, la corrección y el puntaje. La pantalla **Historial** permite consultar los intentos anteriores. La ubicación de los archivos aparece en la pantalla inicial y depende del sistema operativo:

| Sistema | Carpeta |
| --- | --- |
| Windows | `%APPDATA%\Repasario\historial` |
| macOS | `~/Library/Application Support/Repasario/historial` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/Repasario/historial` |

Si existe un historial de la versión anterior (carpeta `CuestionariosJava`), la aplicación lo traslada a la carpeta nueva la primera vez que se inicia. Los intentos finalizados permanecen disponibles después de cerrar la aplicación. Los cuestionarios en curso se mantienen en memoria y se guardan al finalizar.

## Servidor MCP

`mcp_server.py` permite que un asistente compatible con MCP (por ejemplo, Claude Code) consulte y edite los bancos de preguntas y abra la aplicación. No requiere dependencias adicionales. El archivo `.mcp.json` lo registra al abrir el proyecto en Claude Code; en otros clientes, configurar el comando `python3 mcp_server.py` desde la raíz del proyecto.

Herramientas: `listar_materias`, `ver_materia`, `guardar_pregunta` (agrega o reemplaza por `id`), `eliminar_pregunta`, `crear_materia` y `abrir_app`. Antes de guardar, se valida el banco completo con las mismas reglas que usa la aplicación.

## Archivos

- `app.py`: servidor local y corrección.
- `mcp_server.py`: servidor MCP para editar materias y abrir la aplicación.
- `web/`: interfaz del navegador.
- `materias/`: un banco de preguntas editable por materia.
- `tools/build_desktop.py`: genera un paquete compilado en el sistema operativo actual.
- `tools/smoke_test.py`: prueba la API con materias de ejemplo, sin tocar las materias ni el historial reales.
- `tools/java/`: scripts con los que se construyó `materias/desarrollo-software.json`.
