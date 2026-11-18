import type { ButtonHTMLAttributes, HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

/** "bare" no impone colores: los define quien usa el botón. */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'bare';
type Size = 'md' | 'sm';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition ' +
  'hover:-translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_SIZES: Record<Size, string> = {
  md: 'px-5 py-3',
  sm: 'px-3.5 py-2.5 text-[13px]',
};

const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-[0_7px_16px_#266fd52b] hover:bg-brand-strong',
  secondary: 'bg-brand-soft text-brand-strong-fg hover:bg-brand-tint',
  ghost: 'border border-line-strong bg-surface text-body hover:border-brand/50',
  danger: 'border border-bad-line bg-surface text-bad hover:bg-bad-soft',
  bare: '',
};

interface ButtonStyle {
  variant?: Variant;
  size?: Size;
  /** Clases extra que no pisan las del botón: márgenes, ancho, colores de la variante "bare". */
  className?: string;
}

export function buttonClasses({ variant = 'secondary', size = 'md', className = '' }: ButtonStyle): string {
  return `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle;

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = LinkProps & ButtonStyle;

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

export function Panel({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`animate-rise rounded-2xl border border-line bg-surface shadow-panel ${className}`} {...props} />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-brand-tint px-3 py-2 text-[11px] font-extrabold uppercase tracking-[2px] text-brand-fg">
      {children}
    </span>
  );
}

export function FieldLabel({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`mb-2 block text-[13px] font-bold text-ink/85 ${className}`} {...props} />;
}

/** Estilo de los campos de texto. El ancho lo define cada uso (w-full, w-[120px], etc.). */
export const INPUT_CLASSES = 'block rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-[15px] text-field';

type Tone = 'info' | 'ok' | 'warn' | 'bad';

const TONES: Record<Tone, string> = {
  info: 'border-line bg-brand-soft text-navy',
  ok: 'border-ok-line bg-ok-soft text-ok',
  warn: 'border-warn-line bg-warn-soft text-warn-text',
  bad: 'border-bad-line bg-bad-soft text-bad-text',
};

export function Message({ tone = 'info', className = '', children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <div role={tone === 'bad' ? 'alert' : undefined} className={`animate-rise whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="animate-rise mb-6">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3.5 mb-1.5 text-[34px] font-extrabold tracking-tight text-ink max-sm:text-[27px]">{title}</h1>
      {children && <p className="max-w-2xl leading-relaxed text-muted">{children}</p>}
    </header>
  );
}
