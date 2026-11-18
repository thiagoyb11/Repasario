import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { discardProgress, finishQuiz, loadProgress, saveProgress } from '../db/attempts';
import { isAnswered, isMultiple, MAX_ANSWER_LENGTH } from '../domain/quiz';
import { plainText } from '../domain/richText';
import type { Answer, ChoiceQuestion, QuizInProgress } from '../domain/types';
import { isEssay } from '../domain/types';
import { QuestionStem, RichText } from '../components/RichText';
import { ScrollArea } from '../components/ScrollArea';
import { Button, INPUT_CLASSES, Message, Panel } from '../components/ui';
import { optionLetter } from '../lib/format';

function Hint({ children }: { children: string }) {
  return <p className="mb-3.5 text-[13px] text-subtle">{children}</p>;
}

function ChoiceAnswer({ question, selected, onChange }: { question: ChoiceQuestion; selected: number[]; onChange: (answer: number[]) => void }) {
  const multiple = isMultiple(question);

  const toggle = (index: number) => {
    if (!multiple) return onChange([index]);
    onChange(selected.includes(index) ? selected.filter(i => i !== index) : [...selected, index].sort((a, b) => a - b));
  };

  return (
    <>
      <Hint>
        {multiple
          ? 'Seleccioná todas las respuestas correctas. Cada acierto suma una parte del punto y cada opción incorrecta resta la misma parte.'
          : 'Seleccioná una respuesta.'}
      </Hint>
      <div className="grid gap-2.5">
        {question.opciones.map((option, index) => {
          const checked = selected.includes(index);
          return (
            <label
              key={index}
              className={`flex cursor-pointer items-start gap-3.5 rounded-xl border px-4 py-3.5 leading-normal transition ${
                checked ? 'border-brand bg-option-checked' : 'border-line bg-surface hover:border-option-hover-line hover:bg-option-hover'
              }`}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={`answer-${question.id}`}
                checked={checked}
                onChange={() => toggle(index)}
                aria-label={`Opción ${optionLetter(index)}: ${plainText(option)}`}
                className="mt-1 size-[17px] shrink-0 accent-brand"
              />
              <span className="flex-1 text-sm text-body">
                <span className="mr-2 font-extrabold text-option-letter">{optionLetter(index)}.</span>
                <RichText text={option} captions={false} inline />
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
}

function ProgressPanel({ quiz, onGo, onDiscard }: { quiz: QuizInProgress; onGo: (index: number) => void; onDiscard: () => void }) {
  const answered = quiz.preguntas.filter(q => isAnswered(q, quiz.respuestas[q.id])).length;
  return (
    <Panel className="p-6 xl:sticky xl:top-5">
      <div className="mb-2 text-xs font-extrabold tracking-[1.2px] text-subtle uppercase">Tu progreso</div>
      <div className="text-[25px] font-extrabold text-ink">
        {answered} / {quiz.preguntas.length}
      </div>
      <div className="my-4 h-[7px] overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(100 * answered) / quiz.preguntas.length}%` }} />
      </div>
      <div className="grid grid-cols-10 gap-2 xl:grid-cols-5">
        {quiz.preguntas.map((question, index) => {
          const done = isAnswered(question, quiz.respuestas[question.id]);
          const state = index === quiz.actual ? 'border-brand bg-brand text-white' : done ? 'border-ok-line bg-done text-ok' : 'border-line bg-surface text-muted';
          const label = `Pregunta ${index + 1}, ${done ? 'respondida' : 'pendiente'}`;
          return (
            <button key={question.id} type="button" title={label} aria-label={label} className={`h-[35px] rounded-lg border text-xs font-bold ${state}`} onClick={() => onGo(index)}>
              {index + 1}
            </button>
          );
        })}
      </div>
      <button type="button" className="mt-5 text-xs font-semibold text-subtle underline-offset-2 hover:text-bad hover:underline" onClick={onDiscard}>
        Descartar cuestionario
      </button>
    </Panel>
  );
}

export function QuizPage() {
  const navigate = useNavigate();
  // undefined mientras carga, null si no hay un cuestionario en curso.
  const [quiz, setQuiz] = useState<QuizInProgress | null>();
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProgress().then(setQuiz);
  }, []);

  if (quiz === undefined) return null;
  if (quiz === null) return <Navigate to="/" replace />;

  const question = quiz.preguntas[quiz.actual];
  const last = quiz.actual === quiz.preguntas.length - 1;

  const update = (changes: Partial<QuizInProgress>) => {
    const next = { ...quiz, ...changes };
    setQuiz(next);
    setNotice('');
    void saveProgress(next);
  };
  const answer = (value: Answer) => update({ respuestas: { ...quiz.respuestas, [question.id]: value } });
  const goTo = (index: number) => update({ actual: index });

  const discard = async () => {
    if (!window.confirm('¿Descartar este cuestionario? Las respuestas no se guardan.')) return;
    await discardProgress();
    navigate('/');
  };

  const submit = async () => {
    const missing = quiz.preguntas.findIndex(q => !isAnswered(q, quiz.respuestas[q.id]));
    if (missing !== -1) {
      const pending = quiz.preguntas.filter(q => !isAnswered(q, quiz.respuestas[q.id])).length;
      goTo(missing);
      setNotice(`Respondé todas las preguntas antes de finalizar. ${pending === 1 ? 'Falta 1.' : `Faltan ${pending}.`}`);
      return;
    }
    setSubmitting(true);
    try {
      const attempt = await finishQuiz(quiz);
      navigate(`/intento/${attempt.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 grid items-start gap-5 xl:mt-10 xl:grid-cols-[245px_minmax(0,1fr)]">
      <ProgressPanel quiz={quiz} onGo={goTo} onDiscard={discard} />

      <Panel className="px-5 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-5">
          <span className="text-xs font-extrabold tracking-[1.1px] text-label uppercase">
            Pregunta {quiz.actual + 1} de {quiz.preguntas.length}
          </span>
          <span className="rounded-full bg-brand-soft px-2.5 py-1.5 text-[11px] font-bold text-tag">
            {[quiz.materia.nombre, question.tema].filter(Boolean).join(' · ')}
          </span>
        </div>

        {/* Altura fija: los botones de navegación no cambian de lugar entre preguntas. La clave
            vuelve a mostrar el principio de cada pregunta nueva. */}
        <ScrollArea key={question.id} label={`Pregunta ${quiz.actual + 1}`} className="animate-rise h-[clamp(360px,60vh,600px)]">
          <QuestionStem text={question.pregunta} />

          {isEssay(question) ? (
            <>
              <Hint>Pregunta de desarrollo: escribí tu respuesta. Al finalizar vas a poder compararla con la respuesta esperada; no suma puntaje automático.</Hint>
              <textarea
                aria-label="Tu respuesta"
                rows={8}
                maxLength={MAX_ANSWER_LENGTH}
                placeholder="Escribí tu respuesta…"
                value={(quiz.respuestas[question.id] as string | undefined) ?? ''}
                onChange={event => answer(event.target.value)}
                className={`${INPUT_CLASSES} min-h-44 w-full resize-y text-sm leading-relaxed`}
              />
            </>
          ) : (
            <ChoiceAnswer question={question} selected={(quiz.respuestas[question.id] as number[] | undefined) ?? []} onChange={answer} />
          )}
        </ScrollArea>

        {notice && <Message tone="warn" className="mt-4">{notice}</Message>}

        {/* Tres columnas: el botón de descartar queda centrado aunque los otros dos tengan distinto ancho.
            En pantallas chicas no entran los tres en una fila y descartar pasa abajo. */}
        <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 border-t border-line pt-6 max-sm:grid-cols-2">
          <Button variant="ghost" className="justify-self-start" disabled={quiz.actual === 0} onClick={() => goTo(quiz.actual - 1)}>
            ← Anterior
          </Button>
          <Button variant="danger" size="sm" className="max-sm:order-last max-sm:col-span-2 max-sm:justify-self-center" onClick={discard}>
            Descartar
          </Button>
          {last ? (
            <Button variant="primary" className="justify-self-end" disabled={submitting} onClick={submit}>Finalizar</Button>
          ) : (
            <Button className="justify-self-end" onClick={() => goTo(quiz.actual + 1)}>Siguiente →</Button>
          )}
        </div>
      </Panel>
    </div>
  );
}
