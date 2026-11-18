import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { listAttempts, loadProgress } from '../db/attempts';
import { isAnswered } from '../domain/quiz';
import { formatDate } from '../lib/format';
import { groupAttempts, type AttemptGroup } from '../lib/groupAttempts';
import { collapsedGroups, saveCollapsedGroups } from '../lib/preferences';
import { THEME_OPTIONS, useTheme } from '../lib/theme';

export function Brand() {
  return (
    <span className="flex items-center gap-2.5 text-[19px] font-extrabold tracking-tight whitespace-nowrap text-ink">
      <span className="grid size-[35px] place-items-center rounded-[10px] bg-navy-mark text-lg text-white">R</span>
      <span>
        Repas<span className="text-brand-fg">ario</span>
      </span>
    </span>
  );
}

const SIDE_ACTION = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink/90 hover:bg-sidebar-hover';
const ITEM = 'flex w-full items-center justify-between gap-2 rounded-lg py-1.5 pr-3 pl-7 text-[13px] text-body/85 hover:bg-sidebar-hover';
const ITEM_ACTIVE = 'bg-sidebar-active font-semibold text-navy';

function Settings() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="px-3 pt-1 pb-2">
      <div className="pb-2 text-[11px] font-extrabold tracking-[1.2px] text-subtle uppercase">Configuración</div>
      <div className="flex items-center justify-between gap-3">
        <span id="tema-label" className="text-[13px] font-semibold text-ink/90">Tema</span>
        <div role="radiogroup" aria-labelledby="tema-label" className="flex rounded-lg border border-line bg-surface p-0.5">
          {THEME_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => setTheme(option.value)}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                theme === option.value ? 'bg-brand-soft text-brand-strong-fg' : 'text-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function scoreColor(percentage: number | null): string {
  if (percentage === null) return 'text-subtle';
  if (percentage >= 70) return 'text-ok';
  if (percentage >= 40) return 'text-warn';
  return 'text-bad';
}

function Group({ group, open, onToggle }: { group: AttemptGroup; open: boolean; onToggle: (open: boolean) => void }) {
  const progress = group.enCurso;
  const answered = progress ? progress.preguntas.filter(q => isAnswered(q, progress.respuestas[q.id])).length : 0;

  return (
    <details className="group mb-1.5" open={open} onToggle={event => onToggle(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold text-ink hover:bg-sidebar-hover [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="w-2 text-subtle transition group-open:rotate-90">›</span>
        <span className="min-w-0 flex-1 truncate">{group.nombre}</span>
        <span className="text-[11px] text-subtle">{group.intentos.length}</span>
      </summary>

      {progress && (
        <NavLink to="/cuestionario" className={({ isActive }) => `${ITEM} ${isActive ? ITEM_ACTIVE : ''}`}>
          <span className="flex items-center gap-2 font-bold text-brand-fg">
            <span className="size-[7px] rounded-full bg-brand" />
            En curso
          </span>
          <span className="text-xs font-bold text-subtle">
            {answered}/{progress.preguntas.length}
          </span>
        </NavLink>
      )}

      {group.intentos.map(attempt => (
        <NavLink
          key={attempt.id}
          to={`/intento/${attempt.id}`}
          title={`${formatDate(attempt.fecha)} · ${attempt.preguntas.length} preguntas`}
          className={({ isActive }) => `${ITEM} ${isActive ? ITEM_ACTIVE : ''}`}
        >
          <span className="truncate">{formatDate(attempt.fecha)}</span>
          <span className={`shrink-0 text-xs font-bold ${scoreColor(attempt.porcentaje)}`}>
            {attempt.porcentaje === null ? '—' : `${Math.round(attempt.porcentaje)}%`}
          </span>
        </NavLink>
      ))}
    </details>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const attempts = useLiveQuery(listAttempts);
  const progress = useLiveQuery(loadProgress);
  const [collapsed, setCollapsed] = useState(collapsedGroups);
  const groups = groupAttempts(attempts ?? [], progress ?? null);

  const toggle = (id: string, isOpen: boolean) => {
    const next = new Set(collapsed);
    if (isOpen) next.delete(id);
    else next.add(id);
    setCollapsed(next);
    saveCollapsedGroups(next);
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-[#0b152659] lg:hidden" onClick={onClose} />}
      <aside
        aria-label="Cuestionarios"
        className={
          'fixed inset-y-0 left-0 z-40 flex w-[min(300px,86vw)] flex-col border-r border-line bg-sidebar px-3 pt-4 pb-3 shadow-2xl transition-transform ' +
          'lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="flex items-center justify-between px-2 pb-4">
          <Link to="/" aria-label="Ir al inicio">
            <Brand />
          </Link>
          <button type="button" aria-label="Cerrar menú" className="grid size-9 place-items-center rounded-lg text-lg text-muted hover:bg-sidebar-hover lg:hidden" onClick={onClose}>
            ✕
          </button>
        </div>

        <nav className="grid gap-1">
          <Link to="/" className={`${SIDE_ACTION} border border-line bg-surface shadow-sm hover:border-brand/40 hover:bg-surface`}>
            <span aria-hidden>＋</span> Nuevo cuestionario
          </Link>
          <Link to="/importar" className={SIDE_ACTION}>
            <span aria-hidden>⇪</span> Importar preguntas
          </Link>
        </nav>

        <div className="px-3 pt-6 pb-2 text-[11px] font-extrabold tracking-[1.2px] text-subtle uppercase">Cuestionarios</div>
        <nav aria-label="Cuestionarios por materia" className="-mx-1 flex-1 overflow-y-auto px-1">
          {attempts && groups.length === 0 && (
            <p className="px-3 text-[13px] leading-normal text-subtle">Los cuestionarios que completes aparecen acá, ordenados por materia.</p>
          )}
          {groups.map(group => (
            <Group key={group.id} group={group} open={!collapsed.has(group.id)} onToggle={isOpen => toggle(group.id, isOpen)} />
          ))}
        </nav>

        <div className="mt-2 border-t border-line pt-3">
          <Settings />
          <Link to="/datos" className={SIDE_ACTION}>
            <span aria-hidden>⛁</span> Datos y copia de seguridad
          </Link>
        </div>
      </aside>
    </>
  );
}
