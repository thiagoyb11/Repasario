/** Pedido para que una IA genere preguntas en el formato Aiken que entiende la importación. */
export function aikenPrompt(amount: number): string {
  return `Generá ${amount} preguntas de opción múltiple para repasar el material que te adjunto. Respondé solo con las preguntas, sin texto antes ni después, en este formato exacto:

¿Enunciado de la pregunta?
A. Primera opción
B. Segunda opción
C. Tercera opción
D. Cuarta opción
ANSWER: B
EXPLICACION: Por qué esa respuesta es la correcta, en una o dos oraciones.
TEMA: Tema o unidad de la pregunta

Reglas:
- Dejá una línea en blanco entre preguntas.
- Entre 2 y 8 opciones por pregunta, con letras mayúsculas consecutivas desde A seguidas de un punto.
- ANSWER lleva la letra de la opción correcta. Si hay varias correctas, separalas con comas (ANSWER: A, C).
- Las opciones incorrectas tienen que ser plausibles. Evitá "Todas las anteriores" salvo que sea necesario.
- Si una pregunta incluye código, ponelo entre dos líneas con tres acentos graves (\`\`\`), dentro del enunciado.
- No uses negritas, numeración ni otro formato Markdown.
- Basate solo en el material adjunto. Si te pido más preguntas, no repitas las anteriores.`;
}

export const IMPORT_PLACEHOLDER = `Pegá acá lo que te devolvió la IA. Por ejemplo:

¿En qué año se declaró la independencia argentina?
A. 1810
B. 1816
C. 1853
ANSWER: B
EXPLICACION: Se declaró el 9 de julio de 1816 en Tucumán.

También se acepta el JSON de una materia.`;
