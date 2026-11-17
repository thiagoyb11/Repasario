import { parseAiken } from './aiken';
import type { Question } from './types';
import { ValidationError, validateQuestion } from './validate';

export type ImportFormat = 'Aiken' | 'JSON';

export interface ParsedImport {
  formato: ImportFormat;
  /** Preguntas sin validar todavía y quizás sin id. */
  preguntas: unknown[];
  /** Nombre y descripción que trae el JSON de una materia, si los tiene. */
  nombre: string;
  descripcion: string;
}

/** Detecta si el texto es JSON o Aiken y lo interpreta. */
export function parseImport(rawText: string): ParsedImport {
  let text = rawText.replace(/^﻿/, '').trim();

  // Respuesta de una IA envuelta en un único bloque ```json ... ```.
  const fenced = text.match(/^```[\w-]*[ \t]*\n([\s\S]*?)\n?```$/);
  if (fenced) text = fenced[1].trim();

  // JSON aunque la IA haya agregado texto antes o después.
  const looksLikeJson = text.startsWith('{') || text.startsWith('[') || /"(preguntas|pregunta|opciones)"\s*:/.test(text);
  if (looksLikeJson) return { formato: 'JSON', ...parseJsonImport(text) };

  return { formato: 'Aiken', preguntas: parseAiken(text), nombre: '', descripcion: '' };
}

function parseJsonImport(text: string): Omit<ParsedImport, 'formato'> {
  const starts = [text.indexOf('{'), text.indexOf('[')].filter(i => i !== -1);
  const ends = [text.lastIndexOf('}'), text.lastIndexOf(']')].filter(i => i !== -1);
  const chunk = starts.length && ends.length ? text.slice(Math.min(...starts), Math.max(...ends) + 1) : text;

  let data: unknown;
  try {
    data = JSON.parse(chunk);
  } catch (error) {
    try {
      // Las IA suelen dejar una coma antes de } o ].
      data = JSON.parse(chunk.replace(/,(\s*[}\]])/g, '$1'));
    } catch {
      throw new ValidationError(`El JSON no es válido: ${(error as Error).message}`);
    }
  }

  const subject = Array.isArray(data) ? { preguntas: data } : (data as Record<string, unknown> | null);
  if (!subject || typeof subject !== 'object' || !Array.isArray(subject.preguntas) || subject.preguntas.length === 0) {
    throw new ValidationError('El JSON debe ser una lista de preguntas o un objeto con la lista "preguntas"');
  }
  return {
    preguntas: subject.preguntas,
    nombre: typeof subject.nombre === 'string' ? subject.nombre.trim() : '',
    descripcion: typeof subject.descripcion === 'string' ? subject.descripcion.trim() : '',
  };
}

/** Identificador de materia a partir de su nombre: "Diseño de Sistemas" → "diseno-de-sistemas". */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'materia';
}

interface PrepareOptions {
  subjectId: string;
  existing: Question[];
  imageExists?: (path: string) => boolean;
}

/**
 * Valida las preguntas importadas para agregarlas a una materia. Los id faltantes o que ya
 * existen se reemplazan por <materia>-NNN.
 */
export function prepareQuestions(items: unknown[], { subjectId, existing, imageExists }: PrepareOptions): Question[] {
  const taken = new Set(existing.map(q => q.id));
  let counter = existing.length;
  const nextId = () => {
    let id: string;
    do {
      counter += 1;
      id = `${subjectId}-${String(counter).padStart(3, '0')}`;
    } while (taken.has(id));
    return id;
  };

  return items.map((item, index) => {
    const origin = `la pregunta ${index + 1} del texto`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ValidationError(`${origin[0].toUpperCase()}${origin.slice(1)} no es un objeto`);
    }
    const draft = { ...(item as Record<string, unknown>) };
    if (typeof draft.id !== 'string' || !draft.id.trim() || taken.has(draft.id)) draft.id = nextId();
    const question = validateQuestion(draft, { origin, imageExists });
    taken.add(question.id);
    return question;
  });
}
