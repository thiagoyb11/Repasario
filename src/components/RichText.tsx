import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { db } from '../db/database';
import { stemBlocks, textParts } from '../domain/richText';

/** URL temporal de una imagen guardada en la base: undefined mientras carga, null si no existe. */
function useStoredImageUrl(path: string): string | null | undefined {
  const image = useLiveQuery(async () => (await db.imagenes.get(path)) ?? null, [path]);
  const [url, setUrl] = useState<string | null>();

  useEffect(() => {
    if (!image) {
      setUrl(image);
      return;
    }
    const objectUrl = URL.createObjectURL(image.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  return url;
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={alt || 'Imagen ampliada'}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#0b1526e6] px-4 pt-13 pb-4"
      onClick={onClose}
    >
      <button ref={closeButton} type="button" className="fixed top-3 right-4 rounded-lg bg-white px-3 py-2 font-bold text-ink" onClick={onClose}>
        ✕ Cerrar
      </button>
      <img src={src} alt={alt} className="max-h-[calc(100vh-70px)] max-w-[min(96vw,1600px)] cursor-zoom-out rounded-lg bg-white" />
    </div>
  );
}

/** Imagen de una pregunta. Dentro de una opción, ampliarla no marca la opción. */
function StoredFigure({ path, alt, caption }: { path: string; alt: string; caption: boolean }) {
  const url = useStoredImageUrl(path);
  const [zoomed, setZoomed] = useState(false);

  const zoom = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setZoomed(true);
  };

  if (url === null) {
    return <span className="my-2 block rounded-lg border border-dashed border-bad-line p-3 text-sm text-bad">Falta la imagen {path}</span>;
  }
  return (
    <figure className="relative my-3.5 rounded-xl border border-line bg-white p-2.5 text-center">
      {url && <img src={url} alt={alt} loading="lazy" className="mx-auto block h-auto max-w-full cursor-zoom-in" onClick={zoom} />}
      <button
        type="button"
        aria-label={`Ampliar imagen${alt ? `: ${alt}` : ''}`}
        className="absolute top-2 right-2 rounded-md border border-line-strong bg-white/90 px-2 py-1 text-xs font-bold text-brand-strong hover:bg-brand-soft"
        onClick={zoom}
      >
        ⤢ Ampliar
      </button>
      {caption && alt && <figcaption className="mt-2 text-xs text-muted">{alt}</figcaption>}
      {zoomed && url && <Lightbox src={url} alt={alt} onClose={() => setZoomed(false)} />}
    </figure>
  );
}

interface RichTextProps {
  text: string;
  className?: string;
  /** Muestra la descripción de las imágenes debajo de cada una. */
  captions?: boolean;
  /** Se muestra en línea con el texto que lo rodea, por ejemplo después de la letra de una opción. */
  inline?: boolean;
}

/** Texto con imágenes ![descripción](ruta). */
export function RichText({ text, className = '', captions = true, inline = false }: RichTextProps) {
  return (
    <span className={`${inline ? 'inline' : 'block'} whitespace-pre-wrap [overflow-wrap:anywhere] ${className}`}>
      {textParts(text).map((part, index) =>
        'imagen' in part ? (
          <StoredFigure key={index} path={part.imagen} alt={part.alt} caption={captions} />
        ) : (
          part.texto
        ),
      )}
    </span>
  );
}

/** Enunciado: prosa con imágenes y bloques de código. */
export function QuestionStem({ text, size = 'large' }: { text: string; size?: 'large' | 'small' }) {
  const prose = size === 'large' ? 'text-[23px] leading-snug font-bold tracking-tight text-ink max-sm:text-[19px]' : 'text-base leading-normal font-bold text-ink';
  return (
    <div className={size === 'large' ? 'my-6 space-y-3' : 'my-3 space-y-2'}>
      {stemBlocks(text).map((block, index) =>
        block.codigo ? (
          <pre key={index} className="overflow-x-auto rounded-xl bg-[#14243c] px-5 py-4 font-mono text-[13px] leading-relaxed text-[#edf5ff] [tab-size:4]">
            <code>{block.texto.replace(/^\w*\n/, '').trimEnd()}</code>
          </pre>
        ) : (
          <RichText key={index} text={block.texto.trim()} className={prose} />
        ),
      )}
    </div>
  );
}
