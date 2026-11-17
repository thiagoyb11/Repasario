import { imagePaths, isValidImagePath } from './richText';
import type { Question } from './types';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;

export class ValidationError extends Error {}

interface ValidateOptions {
  /** Dónde está la pregunta, para los mensajes de error (por ejemplo, "la pregunta 3 del texto"). */
  origin: string;
  /** Indica si una imagen existe. Sin esta función, solo se valida la forma de la ruta. */
  imageExists?: (path: string) => boolean;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

/** Comprueba que los datos tengan el formato de una pregunta y devuelve la pregunta tipada. */
export function validateQuestion(data: unknown, { origin, imageExists }: ValidateOptions): Question {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ValidationError(`${origin} no es un objeto`);
  }
  const q = data as Record<string, unknown>;
  const where = isNonEmptyString(q.id) ? `${q.id} (${origin})` : origin;

  if (!isNonEmptyString(q.id)) throw new ValidationError(`Falta el id en ${origin}`);
  if (!isNonEmptyString(q.pregunta)) throw new ValidationError(`Enunciado vacío en ${where}`);
  if (q.tipo !== undefined && q.tipo !== 'opciones' && q.tipo !== 'desarrollo') {
    throw new ValidationError(`"tipo" debe ser "opciones" o "desarrollo" en ${where}`);
  }
  for (const field of ['explicacion', 'tema', 'origen', 'fuente', 'respuesta']) {
    if (!optionalString(q[field])) throw new ValidationError(`"${field}" debe ser un texto en ${where}`);
  }

  const texts = [q.pregunta, q.explicacion, q.respuesta, ...(Array.isArray(q.opciones) ? q.opciones : [])];
  for (const text of texts) {
    for (const path of imagePaths(typeof text === 'string' ? text : undefined)) {
      if (!isValidImagePath(path)) throw new ValidationError(`Ruta de imagen inválida "${path}" en ${where}`);
      if (imageExists && !imageExists(path)) throw new ValidationError(`No se encontró la imagen ${path} en ${where}`);
    }
  }

  if (q.tipo === 'desarrollo') {
    if (!isNonEmptyString(q.respuesta)) throw new ValidationError(`Falta la respuesta modelo en la pregunta de desarrollo ${where}`);
    return q as unknown as Question;
  }

  const options = q.opciones;
  if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS || !options.every(isNonEmptyString)) {
    throw new ValidationError(`Opciones inválidas en ${where}: tiene que haber entre ${MIN_OPTIONS} y ${MAX_OPTIONS} opciones con texto`);
  }
  const correct = q.correctas;
  const validIndex = (i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < options.length;
  if (!Array.isArray(correct) || correct.length === 0 || new Set(correct).size !== correct.length || !correct.every(validIndex)) {
    throw new ValidationError(`Respuestas correctas inválidas en ${where}: "correctas" lleva índices de opciones, desde 0`);
  }
  if (q.mezclar !== undefined && typeof q.mezclar !== 'boolean') {
    throw new ValidationError(`"mezclar" debe ser true o false en ${where}`);
  }
  return q as unknown as Question;
}

/** Valida un banco completo: al menos una pregunta y sin id repetidos. */
export function validateQuestions(data: unknown, options: ValidateOptions): Question[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new ValidationError(`${options.origin} debe contener una lista no vacía de preguntas`);
  }
  const seen = new Set<string>();
  return data.map((item, index) => {
    const question = validateQuestion(item, { ...options, origin: `la pregunta ${index + 1} de ${options.origin}` });
    if (seen.has(question.id)) throw new ValidationError(`El id ${question.id} está repetido en ${options.origin}`);
    seen.add(question.id);
    return question;
  });
}
