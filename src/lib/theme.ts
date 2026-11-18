import { useEffect, useState } from 'react';
import { saveTheme, storedTheme } from './preferences';

export type ThemePreference = 'sistema' | 'claro' | 'oscuro';

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'sistema', label: 'Sistema' },
  { value: 'claro', label: 'Claro' },
  { value: 'oscuro', label: 'Oscuro' },
];

/** Color de la barra del navegador para cada tema: el del logo en claro y el fondo en oscuro. */
const BROWSER_BAR = { light: '#213b72', dark: '#161a1d' };

const systemDark = () => matchMedia('(prefers-color-scheme: dark)');

function readPreference(): ThemePreference {
  const stored = storedTheme();
  return THEME_OPTIONS.some(option => option.value === stored) ? (stored as ThemePreference) : 'sistema';
}

/** Pone el tema en <html data-theme>, que es lo que usan los colores de src/index.css. */
function applyTheme(preference: ThemePreference): void {
  const dark = preference === 'oscuro' || (preference === 'sistema' && systemDark().matches);
  const theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR[theme]);
}

/** Tema elegido en la configuración. Con «Sistema», sigue los cambios del sistema en vivo. */
export function useTheme(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== 'sistema') return;
    const media = systemDark();
    const follow = () => applyTheme('sistema');
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, [preference]);

  const choose = (next: ThemePreference) => {
    saveTheme(next);
    setPreference(next);
  };
  return [preference, choose];
}
