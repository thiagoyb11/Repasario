import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Contenedor de altura fija que se desplaza cuando el contenido no entra. No muestra barra de
 * desplazamiento: en su lugar, una sombra leve abajo indica que hay más contenido.
 */
export function ScrollArea({ className = '', label, children }: { className?: string; label: string; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  const update = () => {
    const element = viewport.current;
    // 1 px de tolerancia por los redondeos del zoom.
    if (element) setMoreBelow(element.scrollTop + element.clientHeight < element.scrollHeight - 1);
  };

  // El contenido puede crecer después de montarse: imágenes que cargan, una respuesta larga, etc.
  useEffect(() => {
    const observer = new ResizeObserver(update);
    if (viewport.current) observer.observe(viewport.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* El relleno horizontal evita que se recorte el contorno de foco de las opciones. */}
      <div
        ref={viewport}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={update}
        className="scrollbar-none -mx-1 h-full overflow-y-auto overscroll-contain px-1"
      >
        <div ref={content}>{children}</div>
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-ink/15 to-transparent transition-opacity duration-200 ${moreBelow ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
