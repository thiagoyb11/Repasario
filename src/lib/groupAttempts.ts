import type { Attempt, QuizInProgress } from '../domain/types';

export interface AttemptGroup {
  /** Identificador de la materia, o "" para los intentos antiguos sin materia. */
  id: string;
  nombre: string;
  enCurso: QuizInProgress | null;
  intentos: Attempt[];
}

/**
 * Agrupa los intentos por materia, conservando su orden (del más reciente al más antiguo).
 * La materia del cuestionario en curso aparece primero.
 */
export function groupAttempts(attempts: Attempt[], inProgress: QuizInProgress | null): AttemptGroup[] {
  const groups = new Map<string, AttemptGroup>();
  const groupFor = (id: string, nombre: string) => {
    let group = groups.get(id);
    if (!group) {
      group = { id, nombre, enCurso: null, intentos: [] };
      groups.set(id, group);
    }
    return group;
  };

  if (inProgress) groupFor(inProgress.materia.id, inProgress.materia.nombre).enCurso = inProgress;
  for (const attempt of attempts) {
    const subject = attempt.materia ?? { id: '', nombre: 'Sin materia' };
    groupFor(subject.id, subject.nombre).intentos.push(attempt);
  }
  return [...groups.values()];
}
