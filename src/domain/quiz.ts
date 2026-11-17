import type { Answer, Attempt, ChoiceQuestion, Question, QuizInProgress, ReviewedQuestion, Subject } from './types';
import { isEssay } from './types';
import { ValidationError } from './validate';

export const MAX_QUESTIONS = 50;
export const MAX_ANSWER_LENGTH = 5000;

/** Número aleatorio en [0, 1). Se puede reemplazar en las pruebas. */
export type Random = () => number;

export const secureRandom: Random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

function shuffle<T>(items: T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Opciones que dependen de su posición ("Todas las anteriores", "Ninguna de las anteriores"): no se mueven.
const FIXED_OPTION = /\b(todas|todos|ninguna|ninguno)\s+(de\s+)?(las|los)\s+anteriores\b/i;

/** Copia de la pregunta con las opciones en orden aleatorio y los índices correctos reubicados. */
export function shuffleOptions(question: Question, random: Random = secureRandom): Question {
  if (isEssay(question) || question.mezclar === false) return question;
  const movable = question.opciones.flatMap((text, i) => (FIXED_OPTION.test(text) ? [] : [i]));
  const shuffled = shuffle(movable, random);
  // order[posición nueva] = índice original
  const order = question.opciones.map((_, i) => i);
  movable.forEach((slot, k) => {
    order[slot] = shuffled[k];
  });
  return {
    ...question,
    opciones: order.map(i => question.opciones[i]),
    correctas: question.correctas.map(i => order.indexOf(i)).sort((a, b) => a - b),
  };
}

export function maxQuestions(subject: Subject): number {
  return Math.min(MAX_QUESTIONS, subject.preguntas.length);
}

export function createQuiz(subject: Subject, count: number, random: Random = secureRandom): QuizInProgress {
  const limit = maxQuestions(subject);
  if (!Number.isInteger(count) || count < 1 || count > limit) {
    throw new ValidationError(`Elegí una cantidad entre 1 y ${limit}`);
  }
  return {
    id: crypto.randomUUID(),
    materia: { id: subject.id, nombre: subject.nombre },
    preguntas: shuffle(subject.preguntas, random).slice(0, count).map(q => shuffleOptions(q, random)),
    respuestas: {},
    actual: 0,
  };
}

export function isAnswered(question: Question, answer: Answer | undefined): boolean {
  if (isEssay(question)) return typeof answer === 'string' && answer.trim().length > 0;
  return Array.isArray(answer) && answer.length > 0;
}

export function isMultiple(question: ChoiceQuestion): boolean {
  return question.correctas.length > 1;
}

/**
 * Puntaje de una pregunta de opciones: vale un punto, cada correcta marcada suma
 * 1 / cantidad de correctas y cada incorrecta marcada resta lo mismo, con mínimo 0.
 */
export function choicePoints(question: ChoiceQuestion, selected: number[]): number {
  const hits = selected.filter(i => question.correctas.includes(i)).length;
  const errors = selected.length - hits;
  return Math.max(0, hits - errors) / question.correctas.length;
}

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

export function scoreQuiz(quiz: QuizInProgress, date: Date = new Date()): Attempt {
  const unanswered = quiz.preguntas.filter(q => !isAnswered(q, quiz.respuestas[q.id]));
  if (unanswered.length) throw new ValidationError(`Faltan responder ${unanswered.length} preguntas`);

  let points = 0;
  let scored = 0;
  const reviewed: ReviewedQuestion[] = quiz.preguntas.map(question => {
    const answer = quiz.respuestas[question.id];
    // Las preguntas de desarrollo no tienen corrección automática: quedan fuera del puntaje.
    if (isEssay(question)) {
      const text = String(answer).trim().slice(0, MAX_ANSWER_LENGTH);
      return { ...question, respuesta_usuario: text, acierto: null, puntaje: null };
    }
    const selected = [...(answer as number[])].sort((a, b) => a - b);
    const correct = [...question.correctas].sort((a, b) => a - b);
    const questionPoints = choicePoints(question, selected);
    points += questionPoints;
    scored += 1;
    return {
      ...question,
      seleccionadas: selected,
      acierto: selected.length === correct.length && selected.every((value, i) => value === correct[i]),
      puntaje: round(questionPoints, 2),
    };
  });

  return {
    id: quiz.id,
    fecha: date.toISOString(),
    materia: quiz.materia,
    aciertos: round(points, 2),
    total: scored,
    desarrollo: reviewed.length - scored,
    porcentaje: scored ? round((points * 100) / scored, 1) : null,
    preguntas: reviewed,
  };
}
