// Copia de seguridad: un único JSON con las materias, los intentos y las imágenes.
// La importación también acepta los archivos de intentos de la versión anterior de Repasario,
// que guardaba un JSON por intento en la carpeta "historial".

import type { Attempt, Subject } from '../domain/types';
import { isEssay } from '../domain/types';
import { validateQuestions } from '../domain/validate';
import { db } from './database';

const BACKUP_FORMAT = 'repasario-copia';
const BACKUP_VERSION = 1;

interface BackupImage {
  ruta: string;
  tipo: string;
  /** Contenido en base64. */
  datos: string;
}

interface Backup {
  formato: typeof BACKUP_FORMAT;
  version: number;
  exportada: string;
  materias: Subject[];
  intentos: Attempt[];
  imagenes: BackupImage[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // De a partes, para no pasar demasiados argumentos a String.fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

export async function exportBackup(): Promise<Blob> {
  const [materias, intentos, imagenes] = await Promise.all([db.materias.toArray(), db.intentos.toArray(), db.imagenes.toArray()]);
  const backup: Backup = {
    formato: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportada: new Date().toISOString(),
    materias,
    intentos,
    imagenes: await Promise.all(imagenes.map(async ({ ruta, blob }) => ({ ruta, tipo: blob.type, datos: await blobToBase64(blob) }))),
  };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export function backupFileName(date = new Date()): string {
  return `repasario-copia-${date.toISOString().slice(0, 10)}.json`;
}

function isBackup(data: unknown): data is Backup {
  return typeof data === 'object' && data !== null && (data as Backup).formato === BACKUP_FORMAT;
}

/** Intento guardado por la versión anterior: un objeto con id, fecha, aciertos y preguntas. */
function asLegacyAttempt(data: unknown): Attempt | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Partial<Attempt>;
  if (typeof record.id !== 'string' || typeof record.fecha !== 'string' || typeof record.aciertos !== 'number' || !Array.isArray(record.preguntas)) {
    return null;
  }
  const essays = record.preguntas.filter(isEssay).length;
  return {
    id: record.id,
    fecha: new Date(record.fecha).toISOString(),
    materia: record.materia ?? null,
    aciertos: record.aciertos,
    total: record.total ?? record.preguntas.length - essays,
    desarrollo: record.desarrollo ?? essays,
    porcentaje: record.porcentaje ?? null,
    preguntas: record.preguntas,
  };
}

export interface BackupImportResult {
  materias: number;
  intentos: number;
  errores: string[];
}

/**
 * Importa copias de seguridad e intentos de la versión anterior. Las materias y los intentos
 * con el mismo identificador se reemplazan.
 */
export async function importBackupFiles(files: File[]): Promise<BackupImportResult> {
  const result: BackupImportResult = { materias: 0, intentos: 0, errores: [] };
  for (const file of files) {
    try {
      const data: unknown = JSON.parse(await file.text());
      if (isBackup(data)) {
        const materias = data.materias.map(subject => ({
          ...subject,
          preguntas: validateQuestions(subject.preguntas, { origin: `la materia ${subject.nombre}` }),
        }));
        await db.transaction('rw', db.materias, db.intentos, db.imagenes, async () => {
          await db.materias.bulkPut(materias);
          await db.intentos.bulkPut(data.intentos);
          await db.imagenes.bulkPut(data.imagenes.map(image => ({ ruta: image.ruta, blob: base64ToBlob(image.datos, image.tipo) })));
        });
        result.materias += materias.length;
        result.intentos += data.intentos.length;
        continue;
      }
      const attempt = asLegacyAttempt(data);
      if (!attempt) throw new Error('no es una copia de seguridad ni un intento de Repasario');
      await db.intentos.put(attempt);
      result.intentos += 1;
    } catch (error) {
      result.errores.push(`${file.name}: ${(error as Error).message}`);
    }
  }
  return result;
}

/** Pide al navegador que no borre los datos del sitio cuando falte espacio. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}
