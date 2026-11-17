// Formato Aiken (el formato de texto de Moodle):
//
//   ¿Enunciado?
//   A. Opción
//   B. Opción
//   ANSWER: B
//
// Extensiones de Repasario: varias respuestas correctas ("ANSWER: A, C"), enunciados de varias
// líneas con bloques de código, las líneas EXPLICACION, TEMA y FUENTE después de ANSWER, y
// tolerancia a la numeración ("1.") y a las negritas que suelen agregar las IA.

import { ValidationError } from './validate';

export interface AikenQuestion {
  pregunta: string;
  opciones: string[];
  correctas: number[];
  explicacion?: string;
  tema?: string;
  fuente?: string;
}

const OPTION = /^\*{0,2}([A-H])[.)]\*{0,2}\s+(.*)$/;
const ANSWER = /^(?:ANSWER|RESPUESTAS?)\s*:\s*(.*)$/i;
const EXTRA_FIELD = /^(EXPLICACI[OÓ]N|EXPLANATION|TEMA|FUENTE)\s*:\s*(.*)$/i;
const NUMBERING = /^(?:\d+\s*[.)-]|pregunta\s+\d+\s*[:.)-]?)\s+/i;
const MAX_ERRORS = 8;

interface Draft {
  startLine: number;
  stemLines: string[];
  options: string[];
  correct: number[] | null;
  extra: Pick<AikenQuestion, 'explicacion' | 'tema' | 'fuente'>;
  inCode: boolean;
}

/** Línea sin espacios ni marcas de negrita alrededor, para reconocer ANSWER y los campos extra. */
function plain(line: string): string {
  return line.trim().replace(/^[*_]+|[*_]+$/g, '').trim();
}

function preview(draft: Draft): string {
  return draft.stemLines.join(' ').trim().slice(0, 60);
}

function extraFieldKey(name: string): keyof Draft['extra'] {
  const lower = name.toLowerCase();
  if (lower === 'tema') return 'tema';
  if (lower === 'fuente') return 'fuente';
  return 'explicacion';
}

/** Letras de "ANSWER: A, C" como índices, o null si alguna no es una opción existente. */
function answerIndices(value: string, optionCount: number): number[] | null {
  const letters = value
    .replace(/^[\s.*_]+|[\s.*_]+$/g, '')
    .split(/[\s,;/]+|\by\b/)
    .filter(Boolean);
  const indices = letters.map(letter => (letter.length === 1 ? letter.toUpperCase().charCodeAt(0) - 65 : -1));
  if (indices.length === 0 || indices.some(i => i < 0 || i >= optionCount)) return null;
  return [...new Set(indices)].sort((a, b) => a - b);
}

function newDraft(startLine: number): Draft {
  return { startLine, stemLines: [], options: [], correct: null, extra: {}, inCode: false };
}

/** Convierte un borrador terminado en pregunta, o devuelve el error que lo impide. */
function finishDraft(draft: Draft): AikenQuestion | string {
  if (draft.correct === null) {
    return `Línea ${draft.startLine}: a la pregunta «${preview(draft)}» le falta la línea ANSWER`;
  }
  if (draft.options.length < 2) {
    return `Línea ${draft.startLine}: la pregunta «${preview(draft)}» necesita al menos dos opciones (A. y B.)`;
  }
  return {
    pregunta: draft.stemLines.join('\n').trim(),
    opciones: draft.options,
    correctas: draft.correct,
    ...draft.extra,
  };
}

export function parseAiken(text: string): AikenQuestion[] {
  const questions: AikenQuestion[] = [];
  const errors: string[] = [];
  let draft: Draft | null = null;

  const close = () => {
    if (!draft) return;
    const result = finishDraft(draft);
    if (typeof result === 'string') errors.push(result);
    else questions.push(result);
    draft = null;
  };

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length && errors.length < MAX_ERRORS; index++) {
    const lineNumber = index + 1;
    let line = lines[index].trimEnd();

    // Después del ANSWER: campos extra o fin de la pregunta.
    if (draft?.correct) {
      const field = plain(line).match(EXTRA_FIELD);
      if (field) {
        draft.extra[extraFieldKey(field[1])] = field[2].trim();
        continue;
      }
      close();
    }
    if (!draft) {
      if (!line.trim()) continue;
      draft = newDraft(lineNumber);
      line = line.trimStart().replace(NUMBERING, '');
    }

    const trimmed = line.trim();

    // Bloque de código dentro del enunciado: sus líneas no se interpretan.
    if (draft.inCode || (draft.options.length === 0 && trimmed.startsWith('```'))) {
      if (trimmed.startsWith('```')) draft.inCode = !draft.inCode;
      draft.stemLines.push(line);
      continue;
    }

    const option = trimmed.match(OPTION);
    const answer = plain(line).match(ANSWER);

    if (option && draft.stemLines.length > 0) {
      const expected = String.fromCharCode(65 + draft.options.length);
      if (option[1] !== expected) errors.push(`Línea ${lineNumber}: se esperaba la opción ${expected}. y apareció ${option[1]}.`);
      draft.options.push(option[2].trim());
    } else if (answer && draft.options.length > 0) {
      const indices = answerIndices(answer[1], draft.options.length);
      if (!indices) errors.push(`Línea ${lineNumber}: «${trimmed}» debe indicar letras de opciones existentes, por ejemplo ANSWER: B`);
      draft.correct = indices ?? [0];
    } else if (draft.options.length > 0) {
      if (!trimmed) {
        errors.push(`Línea ${lineNumber}: falta la línea ANSWER antes del espacio en blanco (pregunta de la línea ${draft.startLine})`);
        draft = null;
        continue;
      }
      // Continuación de la opción anterior.
      draft.options[draft.options.length - 1] += '\n' + trimmed;
    } else {
      draft.stemLines.push(line);
    }
  }
  close();

  if (errors.length) throw new ValidationError('Hay errores en el texto:\n' + errors.slice(0, MAX_ERRORS).join('\n'));
  if (questions.length === 0) throw new ValidationError('No se encontraron preguntas en el texto');
  return questions;
}
