import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { importQuestions, listSubjects, type ImportDestination, type ImportResult } from '../db/subjects';
import { aikenPrompt, IMPORT_PLACEHOLDER } from '../domain/prompt';
import { plainText } from '../domain/richText';
import { isEssay } from '../domain/types';
import { Button, buttonClasses, FieldLabel, INPUT_CLASSES, Message, PageHeader, Panel } from '../components/ui';
import { optionLetter, plural } from '../lib/format';
import { rememberSubject } from '../lib/preferences';

const PREVIEW_COUNT = 5;

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <Panel className="relative mb-4 px-5 py-6 sm:py-7 sm:pr-8 sm:pl-[78px]">
      <div className="mb-2.5 grid size-8 place-items-center rounded-full bg-brand-tint font-black text-brand sm:absolute sm:top-6 sm:left-7">{number}</div>
      <h2 className="text-[19px] font-extrabold tracking-tight text-ink">{title}</h2>
      {children}
    </Panel>
  );
}

function PromptStep() {
  const [amount, setAmount] = useState(25);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const prompt = aikenPrompt(amount);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <Step number={1} title="Pedile las preguntas a tu IA">
      <p className="mt-1.5 mb-4 leading-relaxed text-muted">Copiá este pedido y pegalo en ChatGPT, Claude, Gemini u otra IA, junto con tu apunte o PDF.</p>
      <div className="flex flex-wrap items-center gap-3">
        <FieldLabel htmlFor="prompt-amount" className="mb-0">Cantidad de preguntas</FieldLabel>
        <input
          id="prompt-amount"
          type="number"
          min={1}
          max={100}
          value={amount}
          onChange={event => setAmount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
          className={`${INPUT_CLASSES} w-21 py-2 font-bold`}
        />
        <Button onClick={copy}>{copyState === 'copied' ? '✓ Copiado' : 'Copiar pedido'}</Button>
      </div>
      {copyState === 'failed' && <Message tone="warn" className="mt-3">No se pudo copiar automáticamente. Seleccioná el texto de abajo y copialo.</Message>}
      <pre className="mt-3.5 max-h-56 overflow-auto rounded-xl border border-line bg-canvas px-4 py-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-body">{prompt}</pre>
    </Step>
  );
}

function Preview({ result, adding }: { result: ImportResult; adding: boolean }) {
  return (
    <div className="mt-4">
      <Message tone="ok">
        Formato {result.formato}: {plural(result.preguntas.length, 'pregunta válida', 'preguntas válidas')}.
        {adding && ` La materia va a quedar con ${result.total}.`}
      </Message>
      <ol className="mt-3 grid list-decimal gap-3.5 pl-6">
        {result.preguntas.slice(0, PREVIEW_COUNT).map(question => (
          <li key={question.id} className="text-sm text-body">
            <strong className="mb-1.5 block leading-snug">{plainText(question.pregunta).slice(0, 220)}</strong>
            {isEssay(question) ? (
              <div className="rounded-md bg-ok-soft px-2 py-1 text-[13px] font-semibold text-ok">Respuesta esperada: {plainText(question.respuesta).slice(0, 200)}</div>
            ) : (
              question.opciones.map((option, index) => (
                <div key={index} className={`rounded-md px-2 py-0.5 text-[13px] ${question.correctas.includes(index) ? 'bg-ok-soft font-semibold text-ok' : 'text-muted'}`}>
                  {optionLetter(index)}. {plainText(option)}
                </div>
              ))
            )}
            {question.tema && <span className="mt-1.5 inline-block rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-navy">{question.tema}</span>}
          </li>
        ))}
      </ol>
      {result.preguntas.length > PREVIEW_COUNT && <p className="mt-2 text-muted">… y {result.preguntas.length - PREVIEW_COUNT} más.</p>}
    </div>
  );
}

function Imported({ result, onImportMore }: { result: ImportResult; onImportMore: () => void }) {
  const navigate = useNavigate();
  return (
    <Panel className="mx-auto my-16 max-w-[640px] p-12 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Se guardaron {plural(result.preguntas.length, 'pregunta')}</h1>
      <p className="mt-2 text-muted">«{result.materia.nombre}» tiene ahora {plural(result.total, 'pregunta')}.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button
          variant="primary"
          onClick={() => {
            rememberSubject(result.materia.id);
            navigate('/');
          }}
        >
          Practicar ahora →
        </Button>
        <Button onClick={onImportMore}>Importar más</Button>
      </div>
    </Panel>
  );
}

export function ImportPage() {
  const subjects = useLiveQuery(listSubjects);
  const [searchParams] = useSearchParams();
  const target = searchParams.get('materia');

  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [mode, setMode] = useState<'nueva' | 'existente'>(target ? 'existente' : 'nueva');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState(target ?? '');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [saved, setSaved] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!subjects) return null;
  if (saved) {
    const importMore = () => {
      setSaved(null);
      setText('');
      setImages([]);
      setPreview(null);
      setMode('existente');
      setSubjectId(saved.materia.id);
    };
    return <Imported result={saved} onImportMore={importMore} />;
  }

  const canAdd = subjects.length > 0;
  const adding = mode === 'existente' && canAdd;
  const destinationId = subjects.some(s => s.id === subjectId) ? subjectId : subjects[0]?.id;

  /** Cualquier cambio invalida la vista previa: hay que volver a revisar antes de guardar. */
  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPreview(null);
    setError('');
  };

  const openFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const all = [...files];
    const textFile = all.find(file => /\.(txt|json)$/i.test(file.name));
    edit(setImages)(all.filter(file => file.type.startsWith('image/')));
    if (textFile) {
      setText(await textFile.text());
      if (!name) setName(textFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
    }
  };

  const send = async (save: boolean) => {
    const destino: ImportDestination = adding ? { tipo: 'existente', materiaId: destinationId } : { tipo: 'nueva', nombre: name, descripcion: description };
    setBusy(true);
    try {
      const result = await importQuestions({ texto: text, destino, imagenes: images, guardar: save });
      if (save) setSaved(result);
      else {
        setPreview(result);
        if (!adding && !name.trim() && result.nombreSugerido) setName(result.nombreSugerido);
      }
      setError('');
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto my-10 max-w-[860px]">
      <PageHeader eyebrow="Importar" title="Sumá preguntas en un minuto">
        Pedile las preguntas a la IA que uses, pegá su respuesta y revisá el resultado antes de guardarlo. También podés abrir un archivo .txt en formato Aiken (el de Moodle) o el .json de una materia.
      </PageHeader>

      <PromptStep />

      <Step number={2} title="Pegá la respuesta">
        <textarea
          aria-label="Texto con las preguntas"
          spellCheck={false}
          rows={14}
          placeholder={IMPORT_PLACEHOLDER}
          value={text}
          onChange={event => edit(setText)(event.target.value)}
          className={`${INPUT_CLASSES} mt-3.5 mb-3 min-h-64 w-full resize-y font-mono text-[13px] leading-relaxed`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer">
            <input type="file" multiple accept=".txt,.json,image/*" className="sr-only" onChange={event => openFiles(event.target.files)} />
            <span className={buttonClasses({ variant: 'ghost' })}>Abrir archivos…</span>
          </label>
          <span className="text-[13px] text-subtle">
            Un .txt (Aiken) o .json, junto con las imágenes que use.
            {images.length > 0 && ` ${plural(images.length, 'imagen elegida', 'imágenes elegidas')}.`}
          </span>
        </div>
      </Step>

      <Step number={3} title="Elegí dónde guardarlas">
        <div className="my-4 flex flex-wrap gap-2.5">
          {(['nueva', 'existente'] as const)
            .filter(value => value === 'nueva' || canAdd)
            .map(value => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink has-checked:border-brand has-checked:bg-brand-soft">
                <input type="radio" name="destino" className="accent-brand" checked={mode === value} onChange={() => edit(setMode)(value)} />
                {value === 'nueva' ? 'Materia nueva' : 'Agregar a una materia existente'}
              </label>
            ))}
        </div>

        {adding ? (
          <select aria-label="Materia de destino" className={`${INPUT_CLASSES} w-full font-bold`} value={destinationId} onChange={event => edit(setSubjectId)(event.target.value)}>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.nombre} ({plural(s.preguntas.length, 'pregunta')})</option>
            ))}
          </select>
        ) : (
          <>
            <FieldLabel htmlFor="import-name">Nombre de la materia</FieldLabel>
            <input id="import-name" className={`${INPUT_CLASSES} mb-4 w-full`} placeholder="Por ejemplo: Historia Argentina" value={name} onChange={event => edit(setName)(event.target.value)} />
            <FieldLabel htmlFor="import-description">Descripción (opcional)</FieldLabel>
            <input id="import-description" className={`${INPUT_CLASSES} w-full`} placeholder="Unidades 1 a 4" value={description} onChange={event => edit(setDescription)(event.target.value)} />
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button disabled={busy || !text.trim()} onClick={() => send(false)}>Revisar preguntas</Button>
          <Button variant="primary" disabled={busy || !preview || (!adding && !name.trim())} onClick={() => send(true)}>
            {preview ? `Guardar ${plural(preview.preguntas.length, 'pregunta')}` : 'Guardar'}
          </Button>
        </div>
        {error && <Message tone="bad" className="mt-4">{error}</Message>}
        {preview && <Preview result={preview} adding={adding} />}
      </Step>
    </div>
  );
}
