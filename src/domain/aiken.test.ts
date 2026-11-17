import { describe, expect, it } from 'vitest';
import { parseAiken } from './aiken';

describe('parseAiken', () => {
  it('interpreta preguntas con campos extra, varias respuestas y código', () => {
    const text = [
      '1. ¿Capital de Francia?',
      'A. Madrid',
      'B) París',
      'C. Roma',
      'ANSWER: B',
      'EXPLICACION: Es París.',
      'TEMA: Geografía',
      '',
      '¿Qué imprime?',
      '```',
      'A. no es una opción',
      '```',
      'A. 1',
      'B. 2',
      '**ANSWER: A, B**',
      'Pregunta 3: ¿Sin línea en blanco antes?',
      'A. Sí',
      'B. No',
      'ANSWER: a',
    ].join('\n');

    const [first, second, third] = parseAiken(text);
    expect(first).toEqual({
      pregunta: '¿Capital de Francia?',
      opciones: ['Madrid', 'París', 'Roma'],
      correctas: [1],
      explicacion: 'Es París.',
      tema: 'Geografía',
    });
    expect(second.pregunta).toContain('A. no es una opción');
    expect(second.correctas).toEqual([0, 1]);
    expect(third.pregunta).toBe('¿Sin línea en blanco antes?');
    expect(third.correctas).toEqual([0]);
  });

  it('une las líneas de continuación a la opción anterior', () => {
    const [question] = parseAiken('¿X?\nA. primera\nsigue\nB. segunda\nANSWER: A');
    expect(question.opciones).toEqual(['primera\nsigue', 'segunda']);
  });

  it.each([
    ['¿X?\nA. a\nC. c\nANSWER: A', 'se esperaba la opción B.'],
    ['¿X?\nA. a\nB. b\n\n¿Y?\nA. a\nB. b\nANSWER: B', 'falta la línea ANSWER'],
    ['¿X?\nA. a\nB. b\nANSWER: D', 'letras de opciones existentes'],
    ['¿X?\nA. a\nB. b\nANSWER: A and C', 'letras de opciones existentes'],
    ['¿X?\nA. a\nANSWER: A', 'al menos dos opciones'],
    ['   \n  ', 'No se encontraron preguntas'],
  ])('rechaza %j', (text, message) => {
    expect(() => parseAiken(text)).toThrow(message);
  });
});
