import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Brand, Sidebar } from './components/Sidebar';
import { AttemptPage } from './pages/AttemptPage';
import { DataPage } from './pages/DataPage';
import { HomePage } from './pages/HomePage';
import { ImportPage } from './pages/ImportPage';
import { QuizPage } from './pages/QuizPage';

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Al cambiar de pantalla se cierra el menú (en pantallas angostas) y se vuelve arriba.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface px-2.5 lg:hidden">
          <button type="button" aria-label="Abrir menú" className="grid size-9 place-items-center rounded-lg text-lg text-muted hover:bg-sidebar-hover" onClick={() => setMenuOpen(true)}>
            ☰
          </button>
          <Brand />
        </header>

        <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 sm:px-7">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/cuestionario" element={<QuizPage />} />
            <Route path="/intento/:id" element={<AttemptPage />} />
            <Route path="/datos" element={<DataPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="p-7 text-center text-xs text-subtle">Tus materias y tu historial se guardan solo en este navegador.</footer>
      </div>
    </div>
  );
}
