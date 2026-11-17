// Los textos de las preguntas admiten imágenes con la sintaxis ![descripción](ruta)
// y, en el enunciado, bloques de código entre dos líneas con tres acentos graves.

const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

export const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export type TextPart = { texto: string } | { imagen: string; alt: string };

export function textParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(IMAGE)) {
    if (match.index > last) parts.push({ texto: text.slice(last, match.index) });
    parts.push({ imagen: match[2], alt: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ texto: text.slice(last) });
  return parts;
}

export function imagePaths(text: string | undefined): string[] {
  return text ? [...text.matchAll(IMAGE)].map(match => match[2]) : [];
}

export function hasImage(text: string): boolean {
  return imagePaths(text).length > 0;
}

/** Texto sin la sintaxis de imágenes ni las marcas de código, para vistas previas y etiquetas accesibles. */
export function plainText(text: string): string {
  return text
    .replace(IMAGE, (_, alt: string) => (alt ? `[${alt}]` : '[imagen]'))
    .replace(/```[\w-]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ruta relativa válida para una imagen: sin "..", sin raíz y con una extensión conocida. */
export function isValidImagePath(path: string): boolean {
  if (path.startsWith('/') || path.startsWith('\\') || path.includes(':')) return false;
  if (path.split(/[\\/]/).some(segment => segment === '..')) return false;
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return extension in IMAGE_TYPES;
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Divide un enunciado en prosa y bloques de código. */
export function stemBlocks(text: string): { codigo: boolean; texto: string }[] {
  return text
    .split('```')
    .map((texto, index) => ({ codigo: index % 2 === 1, texto }))
    .filter(block => block.texto.trim());
}
