import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { getAttempt } from '../db/attempts';
import { hasImage } from '../domain/richText';
import type { Attempt, ReviewedChoice, ReviewedEssay, ReviewedQuestion } from '../domain/types';
import { QuestionStem, RichText } from '../components/RichText';
import { ButtonLink, Eyebrow, Panel } from '../components/ui';
import { formatDate, optionLetter } from '../lib/format';

function Explanation({ text }: { text?: string }) {
  if (!text) return null;
  return <RichText text={text} className="mt-3.5 border-t border-line pt-3 text-[13px] leading-relaxed text-muted" />;
}

function EssayReview({ question, number }: { question: ReviewedEssay; number: number }) {
  return (
    <>
      <div className="text-xs font-extrabold text-[#53739b]">Pregunta {number} · Desarrollo · Sin puntaje automático</div>
      <QuestionStem text={question.pregunta} size="small" />
      <div className="my-3 rounded-lg bg-canvas px-3.5 py-3 text-[13px] leading-relaxed text-body">
        <strong className="mb-1 block text-xs text-ink">Tu respuesta</strong>
        <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{question.respuesta_usuario}</span>
      </div>
      <div className="my-3 rounded-lg bg-ok-soft px-3.5 py-3 text-[13px] leading-relaxed text-ok">
        <strong className="mb-1 block text-xs">Respuesta esperada</strong>
        <RichText text={question.respuesta} />
      </div>
      <Explanation text={question.explicacion} />
    </>
  );
}

function choiceStatus(question: ReviewedChoice): { label: string; color: string } {
  if (question.acierto) return { label: 'Correcta', color: 'text-ok' };
  if (question.puntaje > 0) return { label: 'Parcialmente correcta', color: 'text-warn' };
  return { label: 'Incorrecta', color: 'text-bad' };
}

function ChoiceReview({ question, number }: { question: ReviewedChoice; number: number }) {
  const status = choiceStatus(question);
  const withImages = question.opciones.some(hasImage);
  return (
    <>
      <div className={`text-xs font-extrabold ${status.color}`}>
        Pregunta {number} · {status.label} · {question.puntaje} / 1 punto
      </div>
      <QuestionStem text={question.pregunta} size="small" />
      <div className={`my-3 grid gap-1 text-[13px] text-[#566a86] ${withImages ? 'max-h-[min(60vh,520px)] overflow-y-auto' : ''}`}>
        {question.opciones.map((option, index) => {
          const correct = question.correctas.includes(index);
          const selected = question.seleccionadas.includes(index);
          const tone = correct ? 'bg-ok-soft text-[#216d40]' : selected ? 'bg-[#fff0ef] text-[#a63e3e]' : '';
          let note = '';
          if (correct) note = selected ? ' ✓ Correcta · Tu respuesta' : ' ✓ Correcta · No seleccionada';
          else if (selected) note = ' ✕ Tu respuesta';
          return (
            <div key={index} className={`rounded-md px-2.5 py-1.5 ${tone}`}>
              {optionLetter(index)}. <RichText text={option} captions={false} inline />
              {note && <span className="font-bold">{note}</span>}
            </div>
          );
        })}
      </div>
      <Explanation text={question.explicacion} />
    </>
  );
}

function ReviewCard({ question, number }: { question: ReviewedQuestion; number: number }) {
  return (
    <Panel className="px-6 py-5">
      {question.tipo === 'desarrollo' ? <EssayReview question={question} number={number} /> : <ChoiceReview question={question} number={number} />}
    </Panel>
  );
}

function Summary({ attempt }: { attempt: Attempt }) {
  const details = [
    attempt.materia?.nombre,
    attempt.porcentaje === null ? '' : `${attempt.porcentaje}% de los puntos`,
    attempt.desarrollo ? `${attempt.desarrollo} de desarrollo sin puntaje` : '',
    formatDate(attempt.fecha),
  ].filter(Boolean);

  return (
    <Panel className="p-8 text-center">
      <Eyebrow>Cuestionario finalizado</Eyebrow>
      <h1 className="mt-2 mb-1 text-[33px] font-extrabold tracking-tight text-ink">Tu resultado</h1>
      <div className="text-[61px] leading-tight font-black tracking-tighter text-[#2169cb] max-sm:text-5xl">
        {attempt.aciertos}
        <small className="text-[25px] tracking-normal text-[#7b91ae]"> / {attempt.total}</small>
      </div>
      <div className="text-[13px] text-muted">{details.join(' · ')}</div>
      <ButtonLink to="/" variant="primary" className="mt-6">Nuevo cuestionario</ButtonLink>
    </Panel>
  );
}

export function AttemptPage() {
  const { id = '' } = useParams();
  // undefined mientras carga, null si no existe.
  const attempt = useLiveQuery(async () => (await getAttempt(id)) ?? null, [id]);

  if (attempt === undefined) return null;
  if (attempt === null) {
    return (
      <Panel className="mx-auto my-16 max-w-xl p-12 text-center">
        <h1 className="text-2xl font-extrabold text-ink">No se encontró el intento</h1>
        <ButtonLink to="/" className="mt-5">Volver al inicio</ButtonLink>
      </Panel>
    );
  }

  return (
    <div className="mx-auto my-10 max-w-[840px]">
      <Summary attempt={attempt} />
      <h2 className="mt-8 text-xl font-extrabold text-ink">Revisión de respuestas</h2>
      <div className="mt-4 grid gap-3.5">
        {attempt.preguntas.map((question, index) => (
          <ReviewCard key={question.id} question={question} number={index + 1} />
        ))}
      </div>
    </div>
  );
}
