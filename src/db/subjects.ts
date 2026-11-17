import { parseImport, prepareQuestions, slugify, type ImportFormat } from '../domain/importText';
import { fileName, imagePaths } from '../domain/richText';
import type { Question, Subject, SubjectRef } from '../domain/types';
import { isEssay } from '../domain/types';
import { ValidationError, validateQuestions } from '../domain/validate';
import { db } from './database';

export const EXAMPLE_SUBJECT_ID = 'diseno-sistemas-p2';

export async function listSubjects(): Promise<Subject[]> {
  const subjects = await db.materias.toArray();
  return subjects.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export type ImportDestination =
  | { tipo: 'nueva'; nombre: string; descripcion: string }
  | { tipo: 'existente'; materiaId: string };

export interface ImportRequest {
  texto: string;
  destino: ImportDestination;
  /** Imágenes elegidas junto con el archivo; se relacionan con las rutas por el nombre del archivo. */
  imagenes?: File[];
  /** false solo valida y devuelve la vista previa. */
  guardar: boolean;
}

export interface ImportResult {
  formato: ImportFormat;
  materia: SubjectRef;
  preguntas: Question[];
  /** Cantidad de preguntas que tiene la materia después de importar. */
  total: number;
  /** Nombre que trae el JSON de una materia, para sugerirlo. */
  nombreSugerido: string;
}

function questionImagePaths(question: Question): string[] {
  const texts = [question.pregunta, question.explicacion, ...(isEssay(question) ? [question.respuesta] : question.opciones)];
  return texts.flatMap(imagePaths);
}

export async function importQuestions({ texto, destino, imagenes = [], guardar }: ImportRequest): Promise<ImportResult> {
  if (!texto.trim()) throw new ValidationError('Pegá el texto con las preguntas o abrí un archivo');
  const parsed = parseImport(texto);

  let subject: Subject;
  if (destino.tipo === 'existente') {
    const existing = await db.materias.get(destino.materiaId);
    if (!existing) throw new ValidationError('La materia elegida ya no existe');
    subject = existing;
  } else {
    const nombre = destino.nombre.trim() || parsed.nombre;
    if (guardar && !nombre) throw new ValidationError('Escribí el nombre de la materia nueva');
    const id = nombre ? slugify(nombre) : 'materia';
    if (nombre && (await db.materias.get(id))) {
      throw new ValidationError(`Ya existe una materia con el identificador "${id}". Elegí otro nombre o agregá las preguntas a esa materia.`);
    }
    subject = { id, nombre, descripcion: destino.descripcion.trim() || parsed.descripcion, preguntas: [], actualizada: '' };
  }

  const storedImages = new Set(await db.imagenes.toCollection().primaryKeys());
  const imageFiles = new Map(imagenes.map(file => [file.name, file]));
  const added = prepareQuestions(parsed.preguntas, {
    subjectId: subject.id,
    existing: subject.preguntas,
    imageExists: path => storedImages.has(path) || imageFiles.has(fileName(path)),
  });

  const result: ImportResult = {
    formato: parsed.formato,
    materia: { id: subject.id, nombre: subject.nombre },
    preguntas: added,
    total: subject.preguntas.length + added.length,
    nombreSugerido: parsed.nombre,
  };
  if (!guardar) return result;

  const newImages = [...new Set(added.flatMap(questionImagePaths))]
    .filter(path => !storedImages.has(path))
    .map(path => ({ ruta: path, blob: imageFiles.get(fileName(path)) as Blob }));

  await db.transaction('rw', db.materias, db.imagenes, async () => {
    await db.imagenes.bulkPut(newImages);
    await db.materias.put({ ...subject, preguntas: [...subject.preguntas, ...added], actualizada: new Date().toISOString() });
  });
  return result;
}

/** Borra la materia y las imágenes que solo usaba ella. Los intentos se conservan. */
export async function deleteSubject(id: string): Promise<void> {
  await db.transaction('rw', db.materias, db.imagenes, async () => {
    await db.materias.delete(id);
    const remaining = await db.materias.toArray();
    const used = new Set(remaining.flatMap(subject => subject.preguntas.flatMap(questionImagePaths)));
    const orphans = (await db.imagenes.toCollection().primaryKeys()).filter(path => !used.has(path));
    await db.imagenes.bulkDelete(orphans);
  });
}

/** Agrega la materia de ejemplo que viene con la aplicación, si todavía no está. */
export async function loadExampleSubject(): Promise<string> {
  if (await db.materias.get(EXAMPLE_SUBJECT_ID)) return EXAMPLE_SUBJECT_ID;
  const response = await fetch(`${import.meta.env.BASE_URL}ejemplos/${EXAMPLE_SUBJECT_ID}.json`);
  if (!response.ok) throw new Error('No se pudo descargar la materia de ejemplo');
  const data = await response.json();
  await db.materias.put({
    id: EXAMPLE_SUBJECT_ID,
    nombre: data.nombre,
    descripcion: data.descripcion ?? '',
    preguntas: validateQuestions(data.preguntas, { origin: 'la materia de ejemplo' }),
    actualizada: new Date().toISOString(),
  });
  return EXAMPLE_SUBJECT_ID;
}

/** JSON de la materia en el formato de importación, para compartirla. No incluye las imágenes. */
export async function exportSubject(id: string): Promise<Blob> {
  const subject = await db.materias.get(id);
  if (!subject) throw new Error('La materia ya no existe');
  const { nombre, descripcion, preguntas } = subject;
  return new Blob([JSON.stringify({ nombre, descripcion, preguntas }, null, 2) + '\n'], { type: 'application/json' });
}
