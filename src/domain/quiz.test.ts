import { describe, expect, it } from 'vitest';
import { choicePoints, createQuiz, scoreQuiz, shuffleOptions, type Random } from './quiz';
import type { ChoiceQuestion, EssayQuestion, QuizInProgress, Subject } from './types';
import { validateQuestion } from './validate';

/** Generador determinista para que las pruebas sean reproducibles. */
function seeded(seed: number): Random {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const single: ChoiceQuestion = { id: 's', pregunta: '¿?', opciones: ['A', 'B', 'C', 'D'], correctas: [0] };
const multiple: ChoiceQuestion = { id: 'm', pregunta: '¿?', opciones: ['A', 'B', 'C', 'D'], correctas: [0, 1] };
const essay: EssayQuestion = { id: 'd', tipo: 'desarrollo', pregunta: 'Explicá', respuesta: 'Modelo' };

function quizWith(respuestas: QuizInProgress['respuestas'], preguntas = [single, multiple, essay]): QuizInProgress {
  return { id: 'q', materia: { id: 'm', nombre: 'Materia' }, preguntas, respuestas, actual: 0 };
}

describe('shuffleOptions', () => {
  const question: ChoiceQuestion = { id: 'x', pregunta: '¿?', opciones: ['A', 'B', 'C', 'D', 'Todas las anteriores'], correctas: [1, 4] };

  it('conserva qué textos son correctos, varía el orden y no mueve las opciones fijas', () => {
    const random = seeded(1);
    const orders = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const mixed = shuffleOptions(question, random) as ChoiceQuestion;
      expect(mixed.correctas.map(index => mixed.opciones[index]).sort()).toEqual(['B', 'Todas las anteriores']);
      expect(mixed.opciones[4]).toBe('Todas las anteriores');
      orders.add(mixed.opciones.join());
    }
    expect(orders.size).toBeGreaterThan(1);
    expect(question.opciones).toEqual(['A', 'B', 'C', 'D', 'Todas las anteriores']);
  });

  it('respeta mezclar: false y las preguntas de desarrollo', () => {
    expect(shuffleOptions({ ...question, mezclar: false })).toEqual({ ...question, mezclar: false });
    expect(shuffleOptions(essay)).toBe(essay);
  });
});

describe('createQuiz', () => {
  const subject: Subject = { id: 'm', nombre: 'Materia', descripcion: '', preguntas: [single, multiple, essay], actualizada: '' };

  it('elige la cantidad pedida sin repetir', () => {
    const quiz = createQuiz(subject, 3, seeded(2));
    expect(new Set(quiz.preguntas.map(q => q.id)).size).toBe(3);
    expect(quiz.materia).toEqual({ id: 'm', nombre: 'Materia' });
  });

  it.each([0, 4, 1.5])('rechaza la cantidad %d', count => {
    expect(() => createQuiz(subject, count)).toThrow('Elegí una cantidad entre 1 y 3');
  });
});

describe('puntaje', () => {
  it('da puntaje parcial en las preguntas de varias respuestas', () => {
    expect(choicePoints(multiple, [0, 1])).toBe(1);
    expect(choicePoints(multiple, [0])).toBe(0.5);
    expect(choicePoints(multiple, [0, 2])).toBe(0);
  });

  it('corrige el cuestionario sin contar las preguntas de desarrollo', () => {
    const attempt = scoreQuiz(quizWith({ s: [0], m: [0], d: ' Mi respuesta ' }), new Date('2026-01-01T00:00:00Z'));
    expect(attempt).toMatchObject({ aciertos: 1.5, total: 2, desarrollo: 1, porcentaje: 75, fecha: '2026-01-01T00:00:00.000Z' });
    const reviewedEssay = attempt.preguntas.find(q => q.id === 'd');
    expect(reviewedEssay).toMatchObject({ respuesta_usuario: 'Mi respuesta', puntaje: null });
  });

  it('exige todas las respuestas', () => {
    expect(() => scoreQuiz(quizWith({ s: [0], m: [], d: '  ' }))).toThrow('Faltan responder 2 preguntas');
  });

  it('no calcula porcentaje si solo hay preguntas de desarrollo', () => {
    expect(scoreQuiz(quizWith({ d: 'texto' }, [essay])).porcentaje).toBeNull();
  });
});

describe('validateQuestion', () => {
  it.each([
    [{ ...single, correctas: [] }, 'Respuestas correctas inválidas'],
    [{ ...single, opciones: ['Solo una'] }, 'Opciones inválidas'],
    [{ ...essay, respuesta: '' }, 'Falta la respuesta modelo'],
    [{ ...essay, tipo: 'otro' }, '"tipo" debe ser'],
    [{ ...single, pregunta: '![](../secreto.png)' }, 'Ruta de imagen inválida'],
  ])('rechaza preguntas inválidas (%#)', (data, message) => {
    expect(() => validateQuestion(data, { origin: 'prueba' })).toThrow(message);
  });
});
