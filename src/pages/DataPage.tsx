import { useEffect, useState, type ReactNode } from 'react';
import { backupFileName, exportBackup, importBackupFiles, requestPersistentStorage, type BackupImportResult } from '../db/backup';
import { loadExampleSubject } from '../db/subjects';
import { Button, buttonClasses, Message, PageHeader, Panel } from '../components/ui';
import { downloadBlob, plural } from '../lib/format';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="mb-4 p-7">
      <h2 className="mb-2 text-[19px] font-extrabold tracking-tight text-ink">{title}</h2>
      {children}
    </Panel>
  );
}

function Text({ children }: { children: ReactNode }) {
  return <p className="mb-4 leading-relaxed text-muted">{children}</p>;
}

function BackupSection() {
  const [result, setResult] = useState<BackupImportResult | null>(null);

  const importFiles = async (files: FileList | null) => {
    if (files?.length) setResult(await importBackupFiles([...files]));
  };

  return (
    <Section title="Copia de seguridad">
      <Text>
        Exportá todo (materias, intentos e imágenes) en un archivo para guardarlo o pasarlo a otro navegador o dispositivo. Al importarlo, las materias y los intentos con el mismo
        identificador se reemplazan.
      </Text>
      <Text>
        También podés importar el historial de la versión anterior de Repasario: elegí todos los archivos .json de su carpeta «historial» (en macOS, ~/Library/Application Support/Repasario/historial;
        en Windows, %APPDATA%\Repasario\historial).
      </Text>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={async () => downloadBlob(await exportBackup(), backupFileName())}>Exportar copia</Button>
        <label className="cursor-pointer">
          <input type="file" multiple accept=".json,application/json" className="sr-only" onChange={event => importFiles(event.target.files)} />
          <span className={buttonClasses({})}>Importar archivos…</span>
        </label>
      </div>
      {result && (
        <Message tone={result.errores.length ? 'warn' : 'ok'} className="mt-4">
          Se importaron {plural(result.materias, 'materia')} y {plural(result.intentos, 'intento')}.
          {result.errores.length > 0 && `\nNo se pudieron importar:\n${result.errores.join('\n')}`}
        </Message>
      )}
    </Section>
  );
}

function StorageSection() {
  // undefined mientras se consulta.
  const [persistent, setPersistent] = useState<boolean>();

  useEffect(() => {
    if (navigator.storage?.persisted) navigator.storage.persisted().then(setPersistent);
    else setPersistent(false);
  }, []);

  return (
    <Section title="Dónde se guardan tus datos">
      <Text>
        Todo queda en este navegador, en este dispositivo: no hay cuenta ni servidor. Si borrás los datos de navegación de este sitio, se borran también tus materias y tu historial, así que
        conviene exportar una copia de vez en cuando.
      </Text>
      {persistent === true && <Message tone="ok">El navegador conserva estos datos aunque falte espacio en el dispositivo.</Message>}
      {persistent === false && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={async () => setPersistent(await requestPersistentStorage())}>Pedir almacenamiento permanente</Button>
          <span className="text-[13px] text-subtle">Evita que el navegador borre los datos cuando le falta espacio.</span>
        </div>
      )}
    </Section>
  );
}

function ExampleSection() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      await loadExampleSubject();
      setLoaded(true);
      setError('');
    } catch (exception) {
      setError((exception as Error).message);
    }
  };

  return (
    <Section title="Materia de ejemplo">
      <Text>Diseño de Sistemas – Parcial 2, con 310 preguntas, para probar la aplicación. Si ya está cargada, no se duplica.</Text>
      <Button onClick={load}>Cargar materia de ejemplo</Button>
      {loaded && <Message tone="ok" className="mt-4">La materia de ejemplo está disponible en el inicio.</Message>}
      {error && <Message tone="bad" className="mt-4">{error}</Message>}
    </Section>
  );
}

export function DataPage() {
  return (
    <div className="mx-auto my-10 max-w-[760px]">
      <PageHeader eyebrow="Datos" title="Tus datos, en tu dispositivo" />
      <BackupSection />
      <StorageSection />
      <ExampleSection />
    </div>
  );
}
