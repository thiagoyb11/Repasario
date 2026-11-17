import { scoreQuiz } from '../domain/quiz';
import type { Attempt, QuizInProgress } from '../domain/types';
import { db } from './database';

const PROGRESS_KEY = 'cuestionario';

/** Intentos del más reciente al más antiguo. */
export function listAttempts(): Promise<Attempt[]> {
  return db.intentos.orderBy('fecha').reverse().toArray();
}

export function getAttempt(id: string): Promise<Attempt | undefined> {
  return db.intentos.get(id);
}

export async function loadProgress(): Promise<QuizInProgress | null> {
  const entry = await db.estado.get(PROGRESS_KEY);
  return (entry?.valor as QuizInProgress | undefined) ?? null;
}

/** Guarda el cuestionario en curso, para retomarlo aunque se cierre la aplicación. */
export async function saveProgress(quiz: QuizInProgress): Promise<void> {
  await db.estado.put({ clave: PROGRESS_KEY, valor: quiz });
}

export async function discardProgress(): Promise<void> {
  await db.estado.delete(PROGRESS_KEY);
}

/** Corrige el cuestionario, guarda el intento y descarta el progreso. */
export async function finishQuiz(quiz: QuizInProgress): Promise<Attempt> {
  const attempt = scoreQuiz(quiz);
  await db.transaction('rw', db.intentos, db.estado, async () => {
    await db.intentos.put(attempt);
    await db.estado.delete(PROGRESS_KEY);
  });
  return attempt;
}
