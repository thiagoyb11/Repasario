import { beforeEach, describe, expect, it } from 'vitest';
import { createQuiz } from '../domain/quiz';
import { finishQuiz, getAttempt, listAttempts, loadProgress, saveProgress } from './attempts';
import { exportBackup, importBackupFiles } from './backup';
import { db } from './database';
import { deleteSubject, importQuestions, listSubjects } from './subjects';

const AIKEN = '¿Capital de Francia?\nA. Madrid\nB. París\nANSWER: B\n\n¿Mapa?\n![Mapa](imagenes/mapa.png)\nA. Sí\nB. No\nANSWER: A\n';
const image = () => new File([new Uint8Array([137, 80, 78, 71])], 'mapa.png', { type: 'image/png' });
const newSubject = (nombre: string) => ({ tipo: 'nueva' as const, nombre, descripcion: '' });

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
});

describe('importQuestions', () => {
  it('muestra la vista previa sin guardar nada', async () => {
    const preview = await importQuestions({ texto: AIKEN, destino: newSubject(''), imagenes: [image()], guardar: false });
    expect(preview).toMatchObject({ formato: 'Aiken', total: 2 });
    expect(await db.materias.count()).toBe(0);
  });

  it('crea una materia con sus imágenes y después le agrega preguntas', async () => {
    const saved = await importQuestions({ texto: AIKEN, destino: newSubject('Geografía General'), imagenes: [image()], guardar: true });
    expect(saved.materia).toEqual({ id: 'geografia-general', nombre: 'Geografía General' });
    expect(await db.imagenes.get('imagenes/mapa.png')).toBeDefined();

    // La imagen ya está guardada: no hace falta volver a elegirla.
    const added = await importQuestions({ texto: AIKEN, destino: { tipo: 'existente', materiaId: 'geografia-general' }, guardar: true });
    expect(added.total).toBe(4);
    const [subject] = await listSubjects();
    expect(new Set(subject.preguntas.map(q => q.id)).size).toBe(4);
  });

  it('rechaza nombres vacíos, materias repetidas e imágenes faltantes', async () => {
    await expect(importQuestions({ texto: AIKEN, destino: newSubject(' '), imagenes: [image()], guardar: true })).rejects.toThrow('Escribí el nombre');
    await expect(importQuestions({ texto: AIKEN, destino: newSubject('Geo'), guardar: false })).rejects.toThrow('No se encontró la imagen');
    await importQuestions({ texto: AIKEN, destino: newSubject('Geo'), imagenes: [image()], guardar: true });
    await expect(importQuestions({ texto: AIKEN, destino: newSubject('geo'), imagenes: [image()], guardar: true })).rejects.toThrow('Ya existe');
  });

  it('al borrar una materia borra las imágenes que nadie más usa', async () => {
    await importQuestions({ texto: AIKEN, destino: newSubject('Geo'), imagenes: [image()], guardar: true });
    await deleteSubject('geo');
    expect(await db.imagenes.count()).toBe(0);
  });
});

describe('cuestionarios e historial', () => {
  it('guarda el progreso y lo descarta al finalizar', async () => {
    await importQuestions({ texto: AIKEN, destino: newSubject('Geo'), imagenes: [image()], guardar: true });
    const [subject] = await listSubjects();
    const quiz = createQuiz(subject, 2);
    await saveProgress(quiz);
    expect((await loadProgress())?.id).toBe(quiz.id);

    for (const question of quiz.preguntas) quiz.respuestas[question.id] = [0];
    const attempt = await finishQuiz(quiz);
    expect(await loadProgress()).toBeNull();
    expect(await getAttempt(attempt.id)).toEqual(attempt);
    expect((await listAttempts()).map(a => a.id)).toEqual([attempt.id]);
  });
});

describe('copia de seguridad', () => {
  it('exporta y restaura materias, intentos e imágenes', async () => {
    await importQuestions({ texto: AIKEN, destino: newSubject('Geo'), imagenes: [image()], guardar: true });
    const backup = new File([await exportBackup()], 'copia.json');
    await Promise.all(db.tables.map(table => table.clear()));

    const result = await importBackupFiles([backup]);
    expect(result).toEqual({ materias: 1, intentos: 0, errores: [] });
    const restored = await db.imagenes.get('imagenes/mapa.png');
    expect(new Uint8Array(await restored!.blob.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it('importa intentos de la versión anterior e informa los archivos que no reconoce', async () => {
    const legacy = { id: 'viejo', fecha: '2020-01-01T00:00:00-03:00', aciertos: 1, total: 1, porcentaje: 100, preguntas: [] };
    const result = await importBackupFiles([
      new File([JSON.stringify(legacy)], 'viejo.json'),
      new File(['{"otra": 1}'], 'otra.json'),
      new File(['{'], 'rota.json'),
    ]);
    expect(result.intentos).toBe(1);
    expect(result.errores).toHaveLength(2);
    expect(await getAttempt('viejo')).toMatchObject({ materia: null, desarrollo: 0, fecha: '2020-01-01T03:00:00.000Z' });
  });
});
