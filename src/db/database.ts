import Dexie, { type Table } from 'dexie';
import type { Attempt, Subject } from '../domain/types';

/** Imagen usada en las preguntas, guardada con la ruta con la que la citan los textos. */
export interface StoredImage {
  ruta: string;
  blob: Blob;
}

/** Valores sueltos de la aplicación, por ejemplo el cuestionario en curso. */
export interface StateEntry {
  clave: string;
  valor: unknown;
}

export class RepasarioDatabase extends Dexie {
  materias!: Table<Subject, string>;
  intentos!: Table<Attempt, string>;
  imagenes!: Table<StoredImage, string>;
  estado!: Table<StateEntry, string>;

  constructor(name = 'repasario') {
    super(name);
    // Solo se declaran la clave primaria y los campos por los que se busca u ordena.
    this.version(1).stores({
      materias: 'id',
      intentos: 'id, fecha, materia.id',
      imagenes: 'ruta',
      estado: 'clave',
    });
  }
}

export const db = new RepasarioDatabase();
