import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadProgress, saveProgress } from '../db/attempts';
import { deleteSubject, exportSubject, listSubjects, loadExampleSubject } from '../db/subjects';
import { createQuiz, maxQuestions } from '../domain/quiz';
import type { Subject } from '../domain/types';
import { Button, ButtonLink, Eyebrow, FieldLabel, INPUT_CLASSES, Message, Panel } from '../components/ui';
import { downloadBlob } from '../lib/format';
import { rememberSubject, rememberedSubject } from '../lib/preferences';

const ADVANTAGES = [
  ['Tus preguntas son tuyas', 'Cada materia es un banco de preguntas que revisás, corregís y exportás como archivo para compartirlo, en lugar de depender de lo que un servicio genere en ese momento.'],
  ['Usá la IA que quieras, o ninguna', 'Generá las preguntas con ChatGPT, Claude, Gemini u otra y pegá el resultado. También podés escribirlas a mano o traerlas de Moodle en formato Aiken.'],
  ['Sin cuenta ni conexión', 'Funciona en el navegador, sin iniciar sesión y, una vez abierta, sin internet. Tus materias y tus resultados no salen de tu dispositivo.'],
  ['Corrección exacta', 'Cada respuesta se corrige contra la clave del banco, con puntaje parcial en las preguntas de varias respuestas. La nota no depende de un modelo de IA.'],
  ['Todo tu historial', 'Cada intento queda guardado con tus respuestas y la explicación de cada pregunta, ordenado por materia en la barra lateral.'],
  ['Pensado para parciales', 'Preguntas de parciales reales, diagramas, bloques de código y preguntas de desarrollo en el mismo cuestionario.'],
];

function Advantages() {
  return (
    <section className="mx-auto mt-14 mb-5 max-w-[920px] text-center">
      <Eyebrow>Por qué Repasario</Eyebrow>
      <h2 className="mt-4 mb-2 text-[clamp(24px,3vw,32px)] font-extrabold tracking-tight text-ink">Una alternativa local a NotebookLM para practicar</h2>
      <p className="mx-auto mb-6 max-w-[620px] leading-relaxed text-muted">
        NotebookLM es muy bueno para conversar con tus apuntes. Repasario se enfoca en otra cosa: practicar con un banco de preguntas que controlás vos.
      </p>
      <div className="grid gap-3.5 text-left sm:grid-cols-2 lg:grid-cols-3">
        {ADVANTAGES.map(([title, text]) => (
          <article key={title} className="rounded-2xl border border-line bg-white p-5">
            <h3 className="mb-2 text-[15px] font-bold text-ink">{title}</h3>
            <p className="text-[13px] leading-relaxed text-muted">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const loadExample = async () => {
    try {
      rememberSubject(await loadExampleSubject());
    } catch (exception) {
      setError((exception as Error).message);
    }
  };

  return (
    <Panel className="p-8">
      <h2 className="text-[22px] font-extrabold tracking-tight text-ink">Todavía no hay materias</h2>
      <p className="mt-2 mb-6 leading-relaxed text-muted">
        Importá preguntas generadas por una IA, en formato Aiken o JSON, para crear la primera. Si querés probar la aplicación antes, cargá la materia de ejemplo: Diseño de Sistemas, con 310 preguntas.
      </p>
      {error && <Message tone="bad" className="mb-4">{error}</Message>}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => navigate('/importar')}>Importar preguntas →</Button>
        <Button onClick={loadExample}>Cargar materia de ejemplo</Button>
      </div>
    </Panel>
  );
}

function SubjectInfo({ subject }: { subject: Subject }) {
  const remove = async () => {
    const message = `¿Borrar la materia «${subject.nombre}» y sus ${subject.preguntas.length} preguntas? Los intentos ya hechos se conservan.`;
    if (window.confirm(message)) await deleteSubject(subject.id);
  };

  return (
    <aside className="relative overflow-hidden rounded-2xl bg-navy p-7 text-white shadow-panel">
      <h2 className="text-[22px] font-extrabold tracking-tight">{subject.nombre}</h2>
      <p className="mt-3 leading-relaxed text-[#cfdef5]">{subject.descripcion || 'Banco de preguntas para practicar esta materia.'}</p>
      <div className="mt-6 text-[41px] font-black tracking-tighter">{subject.preguntas.length}</div>
      <div className="text-[13px] text-[#bcd0ee]">{subject.preguntas.length === 1 ? 'pregunta en el banco' : 'preguntas en el banco'}</div>
      <div className="mt-6 grid gap-2">
        <ButtonLink variant="bare" size="sm" to={`/importar?materia=${encodeURIComponent(subject.id)}`} className="border border-white/20 bg-white/10 text-white hover:bg-white/20">
          ＋ Agregar preguntas
        </ButtonLink>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="bare" size="sm" className="text-[#cfdef5] hover:bg-white/10" onClick={async () => downloadBlob(await exportSubject(subject.id), `${subject.id}.json`)}>
            Exportar
          </Button>
          <Button variant="bare" size="sm" className="text-[#f3c4c4] hover:bg-white/10" onClick={remove}>
            Borrar
          </Button>
        </div>
      </div>
    </aside>
  );
}

function NewQuiz({ subjects }: { subjects: Subject[] }) {
  const navigate = useNavigate();
  const progress = useLiveQuery(loadProgress);
  const [subjectId, setSubjectId] = useState(() => {
    const remembered = rememberedSubject();
    return subjects.some(subject => subject.id === remembered) ? remembered! : subjects[0].id;
  });
  const subject = subjects.find(s => s.id === subjectId) ?? subjects[0];
  const limit = maxQuestions(subject);
  const [count, setCount] = useState(String(Math.min(20, limit)));
  const [error, setError] = useState('');

  const chooseSubject = (id: string) => {
    const next = subjects.find(s => s.id === id)!;
    setSubjectId(id);
    setCount(String(Math.min(20, maxQuestions(next))));
    rememberSubject(id);
  };

  const start = async () => {
    if (progress && !window.confirm(`Hay un cuestionario en curso de ${progress.materia.nombre}. ¿Descartarlo y empezar otro?`)) return;
    try {
      await saveProgress(createQuiz(subject, Number(count)));
      rememberSubject(subject.id);
      navigate('/cuestionario');
    } catch (exception) {
      setError((exception as Error).message);
    }
  };

  return (
    <div className="mx-auto my-9 grid max-w-[920px] gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.85fr)]">
      <Panel className="p-8">
        <h2 className="text-[22px] font-extrabold tracking-tight text-ink">Nuevo cuestionario</h2>
        <p className="mt-2 mb-7 leading-relaxed text-muted">Elegí la materia y cuántas preguntas querés practicar. Cada intento se guarda al finalizar.</p>

        <FieldLabel htmlFor="subject">Materia</FieldLabel>
        <select id="subject" className={`${INPUT_CLASSES} mb-5 w-full font-bold`} value={subject.id} onChange={event => chooseSubject(event.target.value)}>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>

        <FieldLabel htmlFor="count">Cantidad de preguntas</FieldLabel>
        <div className="flex items-center gap-3">
          <input
            id="count"
            type="number"
            min={1}
            max={limit}
            value={count}
            onChange={event => setCount(event.target.value)}
            className={`${INPUT_CLASSES} w-[120px] text-[21px] font-bold`}
          />
          <span className="text-[13px] text-subtle">{limit === 1 ? '1 pregunta disponible' : `De 1 a ${limit} preguntas`}</span>
        </div>

        {error && <Message tone="bad" className="mt-5">{error}</Message>}
        <Button variant="primary" className="mt-7 w-full" onClick={start}>Comenzar cuestionario →</Button>
        {progress && (
          <ButtonLink to="/cuestionario" className="mt-3 w-full">
            Retomar cuestionario en curso ({progress.materia.nombre})
          </ButtonLink>
        )}
      </Panel>
      <SubjectInfo subject={subject} />
    </div>
  );
}

export function HomePage() {
  const subjects = useLiveQuery(listSubjects);

  return (
    <>
      <section className="mx-auto mt-12 mb-7 max-w-[760px] text-center">
        <Eyebrow>Práctica a tu ritmo</Eyebrow>
        <h1 className="mt-4.5 mb-4 text-[clamp(34px,5vw,57px)] leading-[1.05] font-extrabold tracking-[-2px] text-ink">Prepará tu próximo examen.</h1>
        <p className="mx-auto max-w-[590px] text-[17px] leading-relaxed text-muted">
          Generá preguntas con tu IA favorita, pegalas acá y practicá con cuestionarios aleatorios que se corrigen solos.
        </p>
      </section>

      {subjects && (subjects.length ? <NewQuiz subjects={subjects} /> : <div className="mx-auto my-9 max-w-[720px]"><EmptyState /></div>)}
      <Advantages />
    </>
  );
}
