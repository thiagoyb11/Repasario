import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { importQuestions, listSubjects, type ImportDestination, type ImportResult, type ImportSource } from '../db/subjects';
import { aikenPrompt, IMPORT_PLACEHOLDER } from '../domain/prompt';
import { plainText } from '../domain/richText';
import { isEssay } from '../domain/types';
import { Button, buttonClasses, FieldLabel, INPUT_CLASSES, Message, PageHeader, Panel } from '../components/ui';
import { optionLetter, plural } from '../lib/format';
import { rememberSubject } from '../lib/preferences';

const PREVIEW_COUNT = 5;
const QUESTION_FILE = /\.(txt|json)$/i;

/** Suma los archivos nuevos a los anteriores; uno con el mismo nombre reemplaza al anterior. */
function mergeByName<T>(current: T[], added: T[], name: (item: T) => string): T[] {
  const addedNames = new Set(added.map(name));
  return [...current.filter(item => !addedNames.has(name(item))), ...added];
}

const hasFiles = (event: DragEvent | globalThis.DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

/** Evita que el navegador abra un archivo soltado fuera de la zona y se pierda lo cargado. */
function useIgnoreStrayDrops() {
  useEffect(() => {
    const ignore = (event: globalThis.DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    window.addEventListener('dragover', ignore);
    window.addEventListener('drop', ignore);
    return () => {
      window.removeEventListener('dragover', ignore);
      window.removeEventListener('drop', ignore);
    };
  }, []);
}

/** Recuadro donde se sueltan los archivos, con el botón para elegirlos. */
function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  // dragenter y dragleave se disparan también al pasar por cada elemento hijo: se cuentan
  // para saber cuándo el arrastre salió de verdad del recuadro.
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  return (
    <div
      className={`mt-3.5 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-10 text-center transition ${over ? 'border-brand bg-brand-soft' : 'border-line-strong bg-canvas'}`}
      onDragEnter={event => {
        if (!hasFiles(event)) return;
        depth.current += 1;
        setOver(true);
      }}
      onDragLeave={event => {
        if (!hasFiles(event)) return;
        depth.current -= 1;
        if (depth.current === 0) setOver(false);
      }}
      onDragOver={event => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={event => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        onFiles([...event.dataTransfer.files]);
      }}
    >
      <p className="font-bold text-ink">{over ? 'Soltá los archivos' : 'Arrastrá los archivos acá'}</p>
      <p className="text-[13px] text-muted">Archivos .txt (Aiken) o .json, junto con las imágenes que usen. Podés elegir varios a la vez.</p>
      <label className="cursor-pointer">
        <input
          type="file"
          multiple
          accept=".txt,.json,image/*"
          className="sr-only"
          onChange={event => {
            onFiles([...(event.target.files ?? [])]);
            // Permite volver a elegir el mismo archivo después de quitarlo.
            event.target.value = '';
          }}
        />
        <span className={buttonClasses({ variant: 'ghost' })}>Elegir archivos…</span>
      </label>
    </div>
  );
}

type Origin = 'ia' | 'archivos';

const ORIGINS: { value: Origin; title: string; detail: string }[] = [
  { value: 'ia', title: 'Con una IA', detail: 'Copiá un pedido y pegá lo que te responda' },
  { value: 'archivos', title: 'Subir archivos', detail: 'Archivos .txt (Aiken) o .json de una materia' },
];

/** Selector de cómo se cargan las preguntas. */
function OriginTabs({ value, onChange }: { value: Origin; onChange: (value: Origin) => void }) {
  return (
    <div role="tablist" aria-label="Cómo cargar las preguntas" className="animate-rise mb-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-panel">
      {ORIGINS.map(origin => (
        <button
          key={origin.value}
          type="button"
          role="tab"
          aria-selected={value === origin.value}
          onClick={() => onChange(origin.value)}
          className={`rounded-xl px-4 py-3 text-left transition ${value === origin.value ? 'bg-brand-soft' : 'hover:bg-canvas'}`}
        >
          <span className={`block font-extrabold ${value === origin.value ? 'text-brand-strong-fg' : 'text-ink'}`}>{origin.title}</span>
          <span className="mt-0.5 hidden text-[13px] text-muted sm:block">{origin.detail}</span>
        </button>
      ))}
    </div>
  );
}

/** Lista de archivos elegidos, cada uno con un botón para quitarlo. */
function ChosenFiles({ names, onRemove }: { names: string[]; onRemove: (name: string) => void }) {
  if (!names.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {names.map(name => (
        <li key={name} className="flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pr-1.5 pl-3 text-[13px] font-semibold text-body">
          {name}
          <button
            type="button"
            aria-label={`Quitar ${name}`}
            onClick={() => onRemove(name)}
            className="grid size-5 place-items-center rounded-full text-muted hover:bg-bad-soft hover:text-bad"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <Panel className="relative mb-4 px-5 py-6 sm:py-7 sm:pr-8 sm:pl-[78px]">
      <div className="mb-2.5 grid size-8 place-items-center rounded-full bg-brand-tint font-black text-brand-fg sm:absolute sm:top-6 sm:left-7">{number}</div>
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
        Formato {result.formatos.join(' y ')}: {plural(result.preguntas.length, 'pregunta válida', 'preguntas válidas')}.
        {adding && ` La materia va a quedar con ${result.total}.`}
      </Message>
      {result.errores.length > 0 && (
        <Message tone="warn" className="mt-3">
          {`No se van a importar las preguntas de:\n${result.errores.join('\n')}`}
        </Message>
      )}
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

  const [origin, setOrigin] = useState<Origin>('ia');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Required<ImportSource>[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [mode, setMode] = useState<'nueva' | 'existente'>(target ? 'existente' : 'nueva');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState(target ?? '');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [saved, setSaved] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useIgnoreStrayDrops();

  if (!subjects) return null;
  if (saved) {
    const importMore = () => {
      setSaved(null);
      setText('');
      setFiles([]);
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

  const openFiles = async (chosen: File[]) => {
    const questionFiles = chosen.filter(file => QUESTION_FILE.test(file.name));
    const imageFiles = chosen.filter(file => file.type.startsWith('image/'));
    const sources = await Promise.all(questionFiles.map(async file => ({ archivo: file.name, texto: await file.text() })));
    edit(setFiles)(mergeByName(files, sources, source => source.archivo));
    setImages(mergeByName(images, imageFiles, file => file.name));
    if (!name && questionFiles.length) setName(questionFiles[0].name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
  };

  const removeFile = (fileName: string) => {
    edit(setFiles)(files.filter(source => source.archivo !== fileName));
    setImages(images.filter(file => file.name !== fileName));
  };

  const sources: ImportSource[] = origin === 'ia' ? [{ texto: text }] : files;

  const send = async (save: boolean) => {
    const destino: ImportDestination = adding ? { tipo: 'existente', materiaId: destinationId } : { tipo: 'nueva', nombre: name, descripcion: description };
    setBusy(true);
    try {
      const result = await importQuestions({ textos: sources, destino, imagenes: origin === 'archivos' ? images : [], guardar: save });
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
        Pedile las preguntas a la IA que uses o subí archivos .txt en formato Aiken (el de Moodle) o el .json de una materia, y revisá el resultado antes de guardarlo.
      </PageHeader>

      <OriginTabs value={origin} onChange={edit(setOrigin)} />

      {origin === 'ia' ? (
        <>
          <PromptStep />
          <Step number={2} title="Pegá la respuesta">
            <textarea
              aria-label="Texto con las preguntas"
              spellCheck={false}
              rows={14}
              placeholder={IMPORT_PLACEHOLDER}
              value={text}
              onChange={event => edit(setText)(event.target.value)}
              className={`${INPUT_CLASSES} mt-3.5 min-h-64 w-full resize-y font-mono text-[13px] leading-relaxed`}
            />
          </Step>
        </>
      ) : (
        <Step number={1} title="Elegí los archivos">
          <DropZone onFiles={openFiles} />
          <ChosenFiles names={[...files.map(source => source.archivo), ...images.map(file => file.name)]} onRemove={removeFile} />
        </Step>
      )}

      <Step number={origin === 'ia' ? 3 : 2} title="Elegí dónde guardarlas">
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
          <Button disabled={busy || !sources.some(source => source.texto.trim())} onClick={() => send(false)}>Revisar preguntas</Button>
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
