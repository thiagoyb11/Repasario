// Preferencias de la interfaz en localStorage. Son comodidades: si el almacenamiento no está
// disponible (por ejemplo, en una ventana privada), la aplicación funciona igual.

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento local.
  }
}

export const storedTheme = () => read('tema');
export const saveTheme = (theme: string) => write('tema', theme);

export const rememberedSubject = () => read('materia');
export const rememberSubject = (id: string) => write('materia', id);

export function collapsedGroups(): Set<string> {
  try {
    return new Set(JSON.parse(read('grupos-cerrados') ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function saveCollapsedGroups(groups: Set<string>): void {
  write('grupos-cerrados', JSON.stringify([...groups]));
}
