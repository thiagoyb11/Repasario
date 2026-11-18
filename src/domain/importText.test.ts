import { describe, expect, it } from 'vitest';
import { parseImport, prepareQuestions, slugify } from './importText';
import type { Question } from './types';

const choice = (id: string): Question => ({ id, pregunta: `Pregunta ${id}`, opciones: ['A', 'B'], correctas: [0] });

describe('parseImport', () => {
  it('detecta Aiken dentro de un bloque de código', () => {
    const parsed = parseImport('```text\n¿X?\nA. a\nB. b\nANSWER: B\n```');
    expect(parsed.formato).toBe('Aiken');
    expect(parsed.preguntas).toHaveLength(1);
  });

  it('acepta JSON con texto alrededor y comas finales', () => {
    const json = `{"nombre": "Química", "descripcion": "Unidad 1", "preguntas": [${JSON.stringify(choice('a'))},]}`;
    const parsed = parseImport(`Acá tenés las preguntas:\n${json}\n¡Suerte!`);
    expect(parsed).toMatchObject({ formato: 'JSON', nombre: 'Química', descripcion: 'Unidad 1' });
    expect(parsed.preguntas).toHaveLength(1);
  });

  it('acepta una lista de preguntas sin materia', () => {
    expect(parseImport(JSON.stringify([choice('a')])).nombre).toBe('');
  });

  it.each(['{"preguntas": [', '{"preguntas": []}', '{"otra": 1}'])('rechaza el JSON %j', text => {
    expect(() => parseImport(text)).toThrow();
  });
});

describe('prepareQuestions', () => {
  it('asigna id a las preguntas que no tienen o que repiten uno existente', () => {
    const items = [{ ...choice('x'), id: undefined }, choice('existente'), choice('propia')];
    const prepared = prepareQuestions(items, { subjectId: 'quimica', existing: [choice('existente')] });
    expect(prepared.map(q => q.id)).toEqual(['quimica-002', 'quimica-003', 'propia']);
  });

  it('informa qué pregunta del texto es inválida', () => {
    const items = [choice('a'), { ...choice('b'), correctas: [9] }];
    expect(() => prepareQuestions(items, { subjectId: 'm', existing: [] })).toThrow('la pregunta 2 del texto');
  });

  it('nombra el origen de las preguntas en los errores', () => {
    const items = [{ ...choice('a'), correctas: [9] }];
    expect(() => prepareQuestions(items, { subjectId: 'm', existing: [], source: 'de banco.txt' })).toThrow('la pregunta 1 de banco.txt');
  });

  it('valida las imágenes con la función recibida', () => {
    const pictured = { ...choice('a'), pregunta: '![Diagrama](imagenes/d.png)' };
    expect(() => prepareQuestions([pictured], { subjectId: 'm', existing: [], imageExists: () => false })).toThrow('No se encontró la imagen');
    expect(prepareQuestions([pictured], { subjectId: 'm', existing: [], imageExists: () => true })).toHaveLength(1);
  });
});

describe('slugify', () => {
  it('genera un identificador sin acentos ni símbolos', () => {
    expect(slugify('  Diseño de Sistemas – Parcial 2 ')).toBe('diseno-de-sistemas-parcial-2');
    expect(slugify('¿?')).toBe('materia');
  });
});
