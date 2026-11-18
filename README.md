# Repasario

Aplicación web para repasar cualquier materia con cuestionarios de opción múltiple. Las preguntas se generan con cualquier IA (ChatGPT, Claude, Gemini u otra), se pegan en la aplicación y se practican con cuestionarios aleatorios que se corrigen solos.

Funciona completamente en el navegador: no hay cuenta ni servidor, y una vez abierta funciona sin conexión. Las materias, el historial y el cuestionario en curso se guardan en el navegador (IndexedDB) y se pueden exportar como copia de seguridad.

## Desarrollo

Requiere Node.js 20 o posterior.

```text
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas
npm run typecheck  # verificación de tipos
npm run build      # sitio estático en dist/
npm run preview    # sirve dist/ para probar la versión compilada
```

`npm run build` genera un sitio estático en `dist/` que se puede publicar en cualquier hosting estático (por ejemplo, GitHub Pages). Usa rutas relativas y rutas con `#`, así que funciona en cualquier carpeta. Incluye un service worker para que la aplicación funcione sin conexión y se pueda instalar como PWA.

## Uso

### Importar preguntas

La pantalla **Importar preguntas** tiene dos modos, que se eligen arriba de todo:

- **Con una IA**, en tres pasos:
  1. **Pedirle las preguntas a una IA.** El botón **Copiar pedido** copia un pedido listo para pegar junto con el apunte o PDF. Pide las preguntas en formato Aiken.
  2. **Pegar la respuesta** en el campo de texto.
  3. **Elegir el destino.**
- **Subir archivos**, en dos pasos:
  1. **Elegir los archivos** `.txt` (Aiken) o `.json`, junto con las imágenes que usen, con el botón o arrastrándolos al recuadro. Se pueden elegir varios a la vez, incluso de formatos distintos, y sus preguntas se suman en una sola importación.
  2. **Elegir el destino.**

El destino es una materia nueva o una existente. **Revisar preguntas** muestra cuántas preguntas válidas hay y una vista previa, o los errores con su número de línea. Si un archivo tiene errores, la vista previa lo avisa y se importan los demás. Recién después de revisar se puede guardar.

El formato se detecta solo. En JSON se acepta el formato de una materia o una lista de preguntas, aunque la IA haya agregado texto antes o después, comas finales o un bloque ` ```json `. Los `id` faltantes o repetidos se reemplazan por `<materia>-001`, `<materia>-002`, etc.

### Formato Aiken

Es el formato de texto de Moodle, así que también sirve para importar bancos exportados desde un campus:

```text
¿En qué año se declaró la independencia argentina?
A. 1810
B. 1816
C. 1853
ANSWER: B
EXPLICACION: Se declaró el 9 de julio de 1816 en Tucumán.
TEMA: Independencia
```

- Las opciones usan letras mayúsculas consecutivas desde `A`, seguidas de `.` o `)`; entre 2 y 8 por pregunta.
- `ANSWER` indica la letra correcta. Como extensión de Repasario, admite varias separadas por comas (`ANSWER: A, C`).
- Las líneas `EXPLICACION`, `TEMA` y `FUENTE`, después de `ANSWER`, son opcionales.
- El enunciado puede ocupar varias líneas e incluir código entre dos líneas con tres acentos graves.
- Las preguntas se separan con una línea en blanco. Se ignoran la numeración (`1.`) y las negritas que suelen agregar las IA.

### Formato JSON

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

- Cada pregunta requiere `pregunta`, `opciones` (entre 2 y 8) y `correctas`; `id`, `explicacion`, `tema`, `origen`, `fuente` y `mezclar` son opcionales.
- `correctas` contiene índices que comienzan en **0**. Con varios índices, por ejemplo `[0, 2]`, la pregunta es de respuesta múltiple.
- Las opciones se muestran en orden aleatorio. Las del tipo "Todas las anteriores" o "Ninguna de las anteriores" quedan en su posición. `"mezclar": false` conserva el orden escrito.
- Una pregunta con `"tipo": "desarrollo"` se responde con texto libre. En lugar de `opciones` y `correctas` lleva `respuesta`, la respuesta esperada que se muestra en la revisión.
- En el enunciado, el texto entre dos marcas de tres acentos graves se muestra como bloque de código.
- Los textos pueden incluir imágenes con `![descripción](imagenes/diagrama.png)` (PNG, JPG, GIF, WebP o SVG). Al importar, hay que elegir las imágenes junto con los archivos; se relacionan por el nombre del archivo.

El botón **Exportar** de cada materia descarga su JSON en este formato, para compartirla.

### Cuestionarios y puntaje

Cada cuestionario incluye entre 1 y 50 preguntas de la materia elegida, al azar. Cada pregunta vale **1 punto**. En las de varias respuestas, cada correcta marcada suma `1 / cantidad de correctas` y cada incorrecta marcada resta lo mismo, con un mínimo de **0**. Las preguntas de desarrollo no suman puntaje: la revisión muestra la respuesta escrita junto a la esperada.

El cuestionario en curso se guarda en cada respuesta, así que se puede cerrar el navegador y retomarlo después.

### Historial y datos

La barra lateral muestra los intentos agrupados por materia, del más reciente al más antiguo, con su porcentaje. En pantallas angostas se abre con ☰.

La pantalla **Datos y copia de seguridad** permite:

- Exportar todo (materias, intentos e imágenes) en un archivo e importarlo en otro navegador o dispositivo.
- Importar el historial de la versión anterior de Repasario, que guardaba un archivo `.json` por intento.
- Pedir almacenamiento permanente, para que el navegador no borre los datos cuando falta espacio.
- Cargar la materia de ejemplo, Diseño de Sistemas – Parcial 2, con 310 preguntas.

## Estructura

- `src/domain/`: lógica sin dependencias de la interfaz ni de la base de datos: tipos, validación, formato Aiken, importación y corrección.
- `src/db/`: base de datos local con [Dexie](https://dexie.org/) (materias, intentos, imágenes y cuestionario en curso) y copia de seguridad.
- `src/components/` y `src/pages/`: interfaz en React con Tailwind CSS.
- `src/lib/`: utilidades de la interfaz (formato de fechas, preferencias, agrupación del historial).
- `public/ejemplos/`: materia de ejemplo.
- Las pruebas están junto al código que prueban (`*.test.ts`) y usan Vitest con una IndexedDB simulada.
