// Los nombres de los campos están en español porque son los del formato JSON de las materias
// y del historial de la versión anterior, que se siguen pudiendo importar.

interface BaseQuestion {
  id: string;
  pregunta: string;
  explicacion?: string;
  tema?: string;
  origen?: string;
  fuente?: string;
}

export interface ChoiceQuestion extends BaseQuestion {
  tipo?: 'opciones';
  opciones: string[];
  /** Índices de `opciones`, desde 0. Con más de uno, la pregunta es de respuesta múltiple. */
  correctas: number[];
  /** false conserva el orden escrito de las opciones. */
  mezclar?: boolean;
}

/** Pregunta de desarrollo: se responde con texto libre y no suma puntaje. */
export interface EssayQuestion extends BaseQuestion {
  tipo: 'desarrollo';
  /** Respuesta modelo que se muestra en la revisión. */
  respuesta: string;
}

export type Question = ChoiceQuestion | EssayQuestion;

export interface SubjectRef {
  id: string;
  nombre: string;
}

export interface Subject extends SubjectRef {
  descripcion: string;
  preguntas: Question[];
  /** Fecha ISO de la última modificación. */
  actualizada: string;
}

/** Índices elegidos en una pregunta de opciones, o el texto de una de desarrollo. */
export type Answer = number[] | string;

export interface QuizInProgress {
  id: string;
  materia: SubjectRef;
  /** Preguntas con las opciones ya mezcladas. */
  preguntas: Question[];
  respuestas: Record<string, Answer>;
  actual: number;
}

export interface ReviewedChoice extends ChoiceQuestion {
  seleccionadas: number[];
  acierto: boolean;
  puntaje: number;
}

export interface ReviewedEssay extends EssayQuestion {
  respuesta_usuario: string;
  acierto: null;
  puntaje: null;
}

export type ReviewedQuestion = ReviewedChoice | ReviewedEssay;

export interface Attempt {
  id: string;
  /** Fecha ISO de entrega. */
  fecha: string;
  /** null en intentos de versiones antiguas que no guardaban la materia. */
  materia: SubjectRef | null;
  aciertos: number;
  /** Cantidad de preguntas con puntaje (sin contar las de desarrollo). */
  total: number;
  desarrollo: number;
  porcentaje: number | null;
  preguntas: ReviewedQuestion[];
}

export function isEssay(question: Question): question is EssayQuestion {
  return question.tipo === 'desarrollo';
}
