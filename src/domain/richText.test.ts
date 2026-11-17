import { describe, expect, it } from 'vitest';
import { isValidImagePath, plainText, stemBlocks, textParts } from './richText';

describe('textos con imágenes y código', () => {
  it('separa el texto de las imágenes', () => {
    expect(textParts('Antes ![Diagrama](imagenes/d.png) después')).toEqual([
      { texto: 'Antes ' },
      { imagen: 'imagenes/d.png', alt: 'Diagrama' },
      { texto: ' después' },
    ]);
  });

  it('genera texto plano sin imágenes ni marcas de código', () => {
    expect(plainText('¿Qué imprime?\n```java\nprint(1)\n```\n![](a.png)')).toBe('¿Qué imprime? print(1) [imagen]');
  });

  it('separa la prosa de los bloques de código', () => {
    expect(stemBlocks('Prosa\n```\ncódigo\n```\nMás')).toEqual([
      { codigo: false, texto: 'Prosa\n' },
      { codigo: true, texto: '\ncódigo\n' },
      { codigo: false, texto: '\nMás' },
    ]);
  });

  it.each([
    ['imagenes/materia/d.png', true],
    ['../secreto.png', false],
    ['/absoluta.png', false],
    ['C:/windows.png', false],
    ['imagenes/archivo.txt', false],
  ])('valida la ruta %s', (path, valid) => {
    expect(isValidImagePath(path)).toBe(valid);
  });
});
