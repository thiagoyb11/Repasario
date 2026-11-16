const main = document.querySelector('#main');
let meta = null;
let quiz = null;
let answers = {};
let current = 0;
let report = null;
let message = '';
let submitting = false;

function el(tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== '') node.textContent = content;
  return node;
}

function button(label, className, onClick) {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

// Imagen dentro de un texto: ![descripción](ruta relativa a la carpeta de materias).
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

function imageUrl(path) { return '/materias/' + path.split('/').map(encodeURIComponent).join('/'); }

// Texto sin la sintaxis de imágenes, para etiquetas accesibles.
function plainText(text) { return text.replace(IMAGE, (_, alt) => alt ? `[${alt}]` : '[imagen]').replace(/\s+/g, ' ').trim(); }

// Divide un texto en partes {texto} e {imagen, alt}.
function textParts(text) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(IMAGE)) {
    if (match.index > last) parts.push({ texto: text.slice(last, match.index) });
    parts.push({ imagen: match[2], alt: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ texto: text.slice(last) });
  return parts;
}

function openLightbox(src, alt) {
  const overlay = el('div', 'lightbox');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', alt || 'Imagen ampliada');
  const image = el('img');
  image.src = src; image.alt = alt;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  const closeButton = button('✕ Cerrar', 'lightbox-close', close);
  overlay.addEventListener('click', event => { if (event.target === overlay || event.target === image) close(); });
  document.addEventListener('keydown', onKey);
  overlay.append(closeButton, image);
  document.body.append(overlay);
  closeButton.focus();
}

// Figura que se amplía al hacer clic. Dentro de una opción, el clic amplía la imagen sin marcar la opción.
function figure(src, alt) {
  const box = el('figure', 'figure');
  const image = el('img');
  image.src = imageUrl(src); image.alt = alt; image.loading = 'lazy';
  const zoom = button('⤢ Ampliar', 'zoom-button', event => { event.preventDefault(); event.stopPropagation(); openLightbox(image.src, alt); });
  zoom.setAttribute('aria-label', `Ampliar imagen${alt ? ': ' + alt : ''}`);
  box.append(image, zoom);
  if (alt) box.append(el('figcaption', '', alt));
  return box;
}

// Agrega a node el texto con sus imágenes; el texto se coloca en elementos creados por makeText.
function appendRich(node, text, makeText = chunk => document.createTextNode(chunk)) {
  textParts(text).forEach(part => {
    if (part.imagen) node.append(figure(part.imagen, part.alt));
    else if (part.texto.trim()) node.append(makeText(part.texto));
  });
  return node;
}

function richBlock(tag, className, text) {
  return appendRich(el(tag, className), text, chunk => el('span', 'rich-text', chunk.trim()));
}

function hasImage(text) { return typeof text === 'string' && textParts(text).some(part => part.imagen); }

function questionContent(text, review = false) {
  const wrapper = el('div', review ? 'review-stem' : 'question-stem');
  text.split('```').forEach((part, index) => {
    if (!part.trim()) return;
    if (index % 2 === 1) {
      const pre = el('pre', 'code-block');
      pre.append(el('code', '', part.trimEnd()));
      wrapper.append(pre);
    } else {
      appendRich(wrapper, part, chunk => el(review ? 'div' : 'h1', 'question-prose', chunk.trim()));
    }
  });
  return wrapper;
}

function isEssay(q) { return q.tipo === 'desarrollo'; }

function isAnswered(q) {
  const answer = answers[q.id];
  return isEssay(q) ? typeof answer === 'string' && answer.trim().length > 0 : Array.isArray(answer) && answer.length > 0;
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  let data;
  try { data = await response.json(); } catch { throw new Error('No se pudo leer la respuesta del servidor.'); }
  if (!response.ok) throw new Error(data.error || 'Ocurrió un error.');
  return data;
}

function post(path, payload) {
  return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

function showError(error) {
  const box = el('div', 'error', error.message || String(error));
  main.prepend(box);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validSubjects() { return meta.materias.filter(subject => !subject.error); }

function rememberedSubject() {
  try { return localStorage.getItem('materia'); } catch { return null; }
}

function rememberSubject(id) {
  try { localStorage.setItem('materia', id); } catch { /* sin almacenamiento local */ }
}

// ---------- Barra lateral: cuestionarios agrupados por materia ----------

let attempts = [];
let activeAttempt = null;

function collapsedGroups() {
  try { return new Set(JSON.parse(localStorage.getItem('grupos-cerrados') || '[]')); } catch { return new Set(); }
}

function saveCollapsed(set) {
  try { localStorage.setItem('grupos-cerrados', JSON.stringify([...set])); } catch { /* sin almacenamiento local */ }
}

async function loadAttempts() {
  try { attempts = await api('/api/history'); } catch { attempts = []; }
  renderSidebar();
}

function setSidebar(open) {
  document.body.classList.toggle('sidebar-open', open);
  document.querySelector('#sidebar-backdrop').hidden = !open;
}

function renderSidebar() {
  const nav = document.querySelector('#attempts');
  const groups = new Map();
  const group = (id, name) => {
    if (!groups.has(id)) groups.set(id, { nombre: name, items: [] });
    return groups.get(id);
  };
  // El cuestionario en curso encabeza su materia; los intentos ya vienen del más reciente al más antiguo.
  if (quiz) group(quiz.materia.id, quiz.materia.nombre);
  attempts.forEach(record => {
    const subject = record.materia || { id: '', nombre: 'Sin materia' };
    group(subject.id, subject.nombre).items.push(record);
  });
  nav.replaceChildren();
  if (!groups.size) {
    nav.append(el('p', 'sidebar-empty', 'Los cuestionarios que completes aparecen acá, ordenados por materia.'));
    return;
  }
  const collapsed = collapsedGroups();
  groups.forEach((data, id) => {
    const details = el('details', 'attempt-group');
    details.open = !collapsed.has(id);
    details.addEventListener('toggle', () => {
      const set = collapsedGroups();
      if (details.open) set.delete(id); else set.add(id);
      saveCollapsed(set);
    });
    const summary = el('summary', '');
    summary.append(el('span', 'group-name', data.nombre), el('span', 'group-count', String(data.items.length)));
    details.append(summary);
    if (quiz && quiz.materia.id === id) {
      const item = button('', `attempt-item in-progress${main.dataset.view === 'quiz' ? ' active' : ''}`, () => { setSidebar(false); showQuiz(); });
      item.append(el('span', 'attempt-date', 'En curso'), el('span', 'attempt-score', `${countAnswered()}/${quiz.preguntas.length}`));
      details.append(item);
    }
    data.items.forEach(record => {
      const item = button('', `attempt-item${activeAttempt === record.id ? ' active' : ''}`, async () => {
        setSidebar(false);
        try { activeAttempt = record.id; report = await api(`/api/history/${encodeURIComponent(record.id)}`); showReport(report); }
        catch (error) { showError(error); }
      });
      const score = record.porcentaje == null ? '—' : `${Math.round(record.porcentaje)}%`;
      const level = record.porcentaje == null ? '' : record.porcentaje >= 70 ? ' good' : record.porcentaje >= 40 ? ' mid' : ' low';
      item.title = `${formatDate(record.fecha)} · ${record.total} preguntas`;
      item.append(el('span', 'attempt-date', formatDate(record.fecha)), el('span', `attempt-score${level}`, score));
      details.append(item);
    });
    nav.append(details);
  });
}

function setView(name) {
  const changed = main.dataset.view !== name;
  main.dataset.view = name;
  if (name !== 'report') activeAttempt = null;
  renderSidebar();
  if (changed) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

// ---------- Inicio ----------

const ADVANTAGES = [
  ['Tus preguntas son tuyas', 'El banco es un archivo en tu computadora: lo revisás, corregís y compartís pregunta por pregunta, en lugar de depender de lo que un servicio genere en ese momento.'],
  ['Usá la IA que quieras, o ninguna', 'Generá las preguntas con ChatGPT, Claude, Gemini u otra y pegá el resultado. También podés escribirlas a mano o traerlas de Moodle en formato Aiken.'],
  ['Sin cuenta ni conexión', 'Funciona en tu computadora, sin iniciar sesión y sin internet. Tus apuntes y tus resultados no salen de tu equipo.'],
  ['Corrección exacta', 'Cada respuesta se corrige contra la clave del banco, con puntaje parcial en las preguntas de varias respuestas. La nota no depende de un modelo de IA.'],
  ['Todo tu historial', 'Cada intento queda guardado con tus respuestas y la explicación de cada pregunta, ordenado por materia en la barra lateral.'],
  ['Pensado para parciales', 'Preguntas de parciales reales, diagramas, bloques de código y preguntas de desarrollo en el mismo cuestionario.'],
];

function advantages() {
  const section = el('section', 'advantages');
  section.append(el('span', 'eyebrow', 'Por qué Repasario'), el('h2', '', 'Una alternativa local a NotebookLM para practicar'));
  section.append(el('p', 'muted advantages-intro', 'NotebookLM es muy bueno para conversar con tus apuntes. Repasario se enfoca en otra cosa: practicar con un banco de preguntas que controlás vos.'));
  const grid = el('div', 'advantage-grid');
  ADVANTAGES.forEach(([title, text]) => {
    const card = el('article', 'advantage');
    card.append(el('h3', '', title), el('p', '', text));
    grid.append(card);
  });
  section.append(grid);
  return section;
}

async function showHome() {
  // Las materias se vuelven a leer para reflejar archivos agregados o editados.
  try { meta = await api('/api/meta'); } catch (error) { main.replaceChildren(); return showError(error); }
  main.replaceChildren();
  setView('home');
  const hero = el('section', 'hero');
  hero.append(el('span', 'eyebrow', 'Práctica a tu ritmo'));
  hero.append(el('h1', '', 'Prepará tu próximo examen.'));
  hero.append(el('p', '', 'Generá preguntas con tu IA favorita, pegalas acá y practicá con cuestionarios aleatorios que se corrigen solos.'));
  main.append(hero);

  const subjects = validSubjects();
  const grid = el('div', 'home-grid');
  const setup = el('section', 'panel setup-panel');
  setup.append(el('h2', '', 'Nuevo cuestionario'));
  const info = el('aside', 'panel info-panel');
  meta.materias.filter(subject => subject.error).forEach(subject => setup.append(el('div', 'error', `No se pudo cargar la materia «${subject.id}»: ${subject.error}`)));

  function folders() {
    const path = el('div', 'path');
    path.append(el('strong', '', 'Materias en esta computadora'), el('span', '', meta.carpeta_materias));
    path.append(el('strong', '', 'Historial en esta computadora'), el('span', '', meta.carpeta_historial));
    return path;
  }

  if (!subjects.length) {
    setup.append(el('p', 'muted', 'Todavía no hay materias. Importá preguntas generadas por una IA, en formato Aiken o JSON, para crear la primera.'));
    setup.append(button('Importar preguntas →', 'button primary start-button', () => showImport()));
    info.append(el('h2', '', 'Tu espacio de práctica'), el('p', '', 'Cada materia es un archivo de la carpeta de materias con su banco de preguntas.'), folders());
    grid.append(setup, info); main.append(grid, advantages());
    return;
  }

  setup.append(el('p', 'muted', 'Elegí la materia y cuántas preguntas querés practicar. Cada intento se guarda al finalizar.'));
  const subjectLabel = el('label', 'field-label', 'Materia');
  subjectLabel.htmlFor = 'subject';
  const select = el('select', 'subject-select');
  select.id = 'subject';
  subjects.forEach(subject => {
    const option = el('option', '', subject.nombre);
    option.value = subject.id;
    select.append(option);
  });
  const remembered = rememberedSubject();
  if (subjects.some(subject => subject.id === remembered)) select.value = remembered;
  const label = el('label', 'field-label', 'Cantidad de preguntas');
  label.htmlFor = 'count';
  const row = el('div', 'count-row');
  const count = el('input');
  count.id = 'count'; count.type = 'number'; count.min = '1';
  const limit = el('span', 'limit');
  row.append(count, limit);
  setup.append(subjectLabel, select, label, row);

  const selected = () => subjects.find(subject => subject.id === select.value);
  function showSubject() {
    const subject = selected();
    count.max = String(subject.maximo);
    count.value = String(Math.min(20, subject.maximo));
    limit.textContent = subject.maximo === 1 ? '1 pregunta disponible' : `De 1 a ${subject.maximo} preguntas`;
    info.replaceChildren();
    info.append(el('h2', '', subject.nombre));
    info.append(el('p', '', subject.descripcion || 'Banco de preguntas editable para practicar esta materia.'));
    info.append(el('div', 'stat', String(subject.cantidad)), el('div', 'stat-label', subject.cantidad === 1 ? 'pregunta en el banco editable' : 'preguntas en el banco editable'));
    info.append(button('＋ Agregar preguntas a esta materia', 'button info-button', () => showImport(subject.id)));
    info.append(folders());
  }
  select.addEventListener('change', () => { rememberSubject(select.value); showSubject(); });
  showSubject();

  setup.append(button('Comenzar cuestionario →', 'button primary start-button', async () => {
    const amount = Number(count.value);
    if (!Number.isInteger(amount) || amount < 1 || amount > selected().maximo) { count.focus(); return; }
    try {
      quiz = await post('/api/quiz', { materia: select.value, cantidad: amount });
      rememberSubject(select.value);
      answers = {}; current = 0; report = null; message = '';
      showQuiz();
    } catch (error) { showError(error); }
  }));
  if (quiz) setup.append(button(`Retomar cuestionario en curso (${quiz.materia.nombre})`, 'button secondary start-button', showQuiz));
  grid.append(setup, info); main.append(grid, advantages());
}

// ---------- Importar preguntas ----------

function aikenPrompt(amount) {
  return `Generá ${amount} preguntas de opción múltiple para repasar el material que te adjunto. Respondé solo con las preguntas, sin texto antes ni después, en este formato exacto:

¿Enunciado de la pregunta?
A. Primera opción
B. Segunda opción
C. Tercera opción
D. Cuarta opción
ANSWER: B
EXPLICACION: Por qué esa respuesta es la correcta, en una o dos oraciones.
TEMA: Tema o unidad de la pregunta

Reglas:
- Dejá una línea en blanco entre preguntas.
- Entre 2 y 8 opciones por pregunta, con letras mayúsculas consecutivas desde A seguidas de un punto.
- ANSWER lleva la letra de la opción correcta. Si hay varias correctas, separalas con comas (ANSWER: A, C).
- Las opciones incorrectas tienen que ser plausibles. Evitá "Todas las anteriores" salvo que sea necesario.
- Si una pregunta incluye código, ponelo entre dos líneas con tres acentos graves (\`\`\`), dentro del enunciado.
- No uses negritas, numeración ni otro formato Markdown.
- Basate solo en el material adjunto. Si te pido más preguntas, no repitas las anteriores.`;
}

const PLACEHOLDER = `Pegá acá lo que te devolvió la IA. Por ejemplo:

¿En qué año se declaró la independencia argentina?
A. 1810
B. 1816
C. 1853
ANSWER: B
EXPLICACION: Se declaró el 9 de julio de 1816 en Tucumán.

También se acepta el JSON de una materia.`;

function copyText(text, trigger) {
  const done = () => { const label = trigger.textContent; trigger.textContent = '✓ Copiado'; setTimeout(() => { trigger.textContent = label; }, 1600); };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
  const area = el('textarea');
  area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.append(area); area.select();
  try { document.execCommand('copy'); done(); } catch { /* el usuario puede copiar a mano desde la vista previa */ }
  area.remove();
}

async function showImport(targetId = null) {
  try { meta = await api('/api/meta'); } catch (error) { main.replaceChildren(); return showError(error); }
  main.replaceChildren();
  setView('import');
  const page = el('div', 'import-page');
  const head = el('div', 'page-head');
  head.append(el('span', 'eyebrow', 'Importar'), el('h1', '', 'Sumá preguntas en un minuto'));
  head.append(el('p', 'muted', 'Pedile las preguntas a la IA que uses, pegá su respuesta y revisá el resultado antes de guardarlo. También podés abrir un archivo .txt en formato Aiken (el de Moodle) o el .json de una materia.'));
  page.append(head);
  if (!meta.escribible) page.append(el('div', 'error', `La aplicación no puede guardar materias porque no encuentra la carpeta materias junto a ella. Descomprimí el ZIP completo y, en macOS, mové la carpeta fuera de Descargas antes de abrir la aplicación.`));

  // Paso 1: prompt para la IA.
  const step1 = el('section', 'panel import-step');
  step1.append(el('div', 'step-number', '1'), el('h2', '', 'Pedile las preguntas a tu IA'));
  step1.append(el('p', 'muted', 'Copiá este pedido y pegalo en ChatGPT, Claude, Gemini u otra IA, junto con tu apunte o PDF.'));
  const amountRow = el('div', 'inline-row');
  const amountLabel = el('label', 'field-label', 'Cantidad de preguntas');
  amountLabel.htmlFor = 'prompt-amount';
  const amount = el('input', 'small-input');
  amount.id = 'prompt-amount'; amount.type = 'number'; amount.min = '1'; amount.max = '100'; amount.value = '25';
  const promptView = el('pre', 'prompt-view', aikenPrompt(25));
  amount.addEventListener('input', () => { promptView.textContent = aikenPrompt(Math.max(1, Math.min(100, Number(amount.value) || 25))); });
  const copy = button('Copiar pedido', 'button secondary', () => copyText(promptView.textContent, copy));
  amountRow.append(amountLabel, amount, copy);
  step1.append(amountRow, promptView);
  page.append(step1);

  // Paso 2: texto pegado o archivo.
  const step2 = el('section', 'panel import-step');
  step2.append(el('div', 'step-number', '2'), el('h2', '', 'Pegá la respuesta'));
  const area = el('textarea', 'import-text');
  area.placeholder = PLACEHOLDER; area.rows = 14; area.spellcheck = false;
  area.setAttribute('aria-label', 'Texto con las preguntas');
  const fileInput = el('input');
  fileInput.type = 'file'; fileInput.accept = '.txt,.json,.gift,text/plain,application/json'; fileInput.hidden = true;
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    area.value = await file.text();
    if (!nameInput.value && file.name) nameInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    invalidate();
  });
  const fileRow = el('div', 'inline-row');
  fileRow.append(button('Abrir archivo…', 'button ghost', () => fileInput.click()), el('span', 'limit', 'Archivos .txt (Aiken) o .json'), fileInput);
  step2.append(area, fileRow);
  page.append(step2);

  // Paso 3: destino.
  const step3 = el('section', 'panel import-step');
  step3.append(el('div', 'step-number', '3'), el('h2', '', 'Elegí dónde guardarlas'));
  const subjects = validSubjects();
  const modes = el('div', 'mode-row');
  const radio = (value, text) => {
    const label = el('label', 'mode-option');
    const input = el('input');
    input.type = 'radio'; input.name = 'destino'; input.value = value;
    label.append(input, el('span', '', text));
    modes.append(label);
    return input;
  };
  const newMode = radio('nueva', 'Materia nueva');
  const existingMode = subjects.length ? radio('existente', 'Agregar a una materia existente') : null;
  const newFields = el('div', 'dest-fields');
  const nameLabel = el('label', 'field-label', 'Nombre de la materia');
  nameLabel.htmlFor = 'import-name';
  const nameInput = el('input', 'text-input');
  nameInput.id = 'import-name'; nameInput.placeholder = 'Por ejemplo: Historia Argentina';
  const descLabel = el('label', 'field-label', 'Descripción (opcional)');
  descLabel.htmlFor = 'import-desc';
  const descInput = el('input', 'text-input');
  descInput.id = 'import-desc'; descInput.placeholder = 'Unidades 1 a 4';
  newFields.append(nameLabel, nameInput, descLabel, descInput);
  const existingFields = el('div', 'dest-fields');
  const select = el('select', 'subject-select');
  select.setAttribute('aria-label', 'Materia de destino');
  subjects.forEach(subject => { const option = el('option', '', `${subject.nombre} (${subject.cantidad} preguntas)`); option.value = subject.id; select.append(option); });
  existingFields.append(select);
  step3.append(modes, newFields, existingFields);
  const preview = el('div', 'import-preview');
  const actions = el('div', 'import-actions');
  const review = button('Revisar preguntas', 'button secondary', () => send(false));
  const save = button('Guardar', 'button primary', () => send(true));
  save.disabled = true;
  actions.append(review, save);
  step3.append(actions, preview);
  page.append(step3);
  main.append(page);

  const useExisting = () => existingMode && existingMode.checked;
  function syncMode() { newFields.hidden = useExisting(); existingFields.hidden = !useExisting(); invalidate(); }
  if (targetId && existingMode && subjects.some(subject => subject.id === targetId)) { existingMode.checked = true; select.value = targetId; }
  else newMode.checked = true;
  [newMode, existingMode].filter(Boolean).forEach(input => input.addEventListener('change', syncMode));
  [area, nameInput, descInput, select].forEach(input => input.addEventListener('input', invalidate));
  select.addEventListener('change', invalidate);
  syncMode();

  function invalidate() { save.disabled = true; save.textContent = 'Guardar'; preview.replaceChildren(); }

  function payload(store) {
    const destino = useExisting() ? { tipo: 'existente', materia: select.value } : { tipo: 'nueva', nombre: nameInput.value.trim(), descripcion: descInput.value.trim() };
    return { texto: area.value, destino, guardar: store };
  }

  async function send(store) {
    if (!area.value.trim()) { area.focus(); return; }
    if (store && !useExisting() && !nameInput.value.trim()) { nameInput.focus(); return; }
    review.disabled = save.disabled = true;
    try {
      const result = await post('/api/import', payload(store));
      if (store) return showImported(result);
      if (!useExisting() && !nameInput.value.trim() && result.nombre_sugerido) nameInput.value = result.nombre_sugerido;
      renderPreview(result);
      save.disabled = false;
      save.textContent = `Guardar ${result.cantidad} ${result.cantidad === 1 ? 'pregunta' : 'preguntas'}`;
    } catch (error) {
      preview.replaceChildren(el('div', 'error import-error', error.message));
    } finally { review.disabled = false; }
  }

  function renderPreview(result) {
    preview.replaceChildren();
    const summary = el('div', 'notice ok-notice', `Formato ${result.formato}: ${result.cantidad} ${result.cantidad === 1 ? 'pregunta válida' : 'preguntas válidas'}.` + (useExisting() ? ` La materia va a quedar con ${result.total}.` : ''));
    preview.append(summary);
    const list = el('ol', 'preview-list');
    result.preguntas.slice(0, 5).forEach(q => {
      const item = el('li', 'preview-item');
      item.append(el('strong', '', plainText(q.pregunta).slice(0, 220)));
      if (q.tipo === 'desarrollo') item.append(el('div', 'preview-option correct', `Respuesta esperada: ${plainText(q.respuesta).slice(0, 200)}`));
      else (q.opciones || []).forEach((option, i) => item.append(el('div', `preview-option${q.correctas.includes(i) ? ' correct' : ''}`, `${String.fromCharCode(65 + i)}. ${plainText(option)}`)));
      if (q.tema) item.append(el('span', 'tag', q.tema));
      list.append(item);
    });
    preview.append(list);
    if (result.cantidad > 5) preview.append(el('p', 'muted', `… y ${result.cantidad - 5} más.`));
  }
}

function showImported(result) {
  main.replaceChildren();
  setView('import');
  const panel = el('section', 'panel empty imported');
  panel.append(el('span', 'eyebrow', 'Listo'), el('h1', '', `Se guardaron ${result.cantidad} ${result.cantidad === 1 ? 'pregunta' : 'preguntas'}`));
  panel.append(el('p', 'muted', `«${result.materia.nombre}» tiene ahora ${result.total} ${result.total === 1 ? 'pregunta' : 'preguntas'}.`));
  const row = el('div', 'inline-row centered');
  row.append(button('Practicar ahora →', 'button primary', () => { rememberSubject(result.materia.id); showHome(); }), button('Importar más', 'button secondary', () => showImport(result.materia.id)));
  panel.append(row);
  main.append(panel);
}

function countAnswered() { return quiz.preguntas.filter(isAnswered).length; }

function showQuiz() {
  if (!quiz) return showHome();
  main.replaceChildren();
  setView('quiz');
  const layout = el('div', 'quiz-layout');
  const side = el('aside', 'panel quiz-side');
  side.append(el('div', 'side-heading', 'Tu progreso'));
  side.append(el('div', 'side-count', `${countAnswered()} / ${quiz.preguntas.length}`));
  const track = el('div', 'progress-track');
  const bar = el('div', 'progress-bar');
  bar.style.width = `${100 * countAnswered() / quiz.preguntas.length}%`;
  track.append(bar); side.append(track);
  const nav = el('div', 'question-grid');
  quiz.preguntas.forEach((question, index) => {
    const done = isAnswered(question);
    const item = button(String(index + 1), `q-nav${done ? ' answered' : ''}${current === index ? ' active' : ''}`, () => { current = index; message = ''; showQuiz(); });
    item.title = `Pregunta ${index + 1}${done ? ', respondida' : ', pendiente'}`;
    item.setAttribute('aria-label', item.title);
    nav.append(item);
  });
  side.append(nav);

  const q = quiz.preguntas[current];
  const panel = el('section', 'panel question-panel');
  const head = el('div', 'question-header');
  head.append(el('span', 'question-counter', `Pregunta ${current + 1} de ${quiz.preguntas.length}`));
  head.append(el('span', 'tag', [quiz.materia.nombre, q.tema].filter(Boolean).join(' · ')));
  panel.append(head, questionContent(q.pregunta));
  if (isEssay(q)) {
    panel.append(el('div', 'answer-hint', 'Pregunta de desarrollo: escribí tu respuesta. Al finalizar vas a poder compararla con la respuesta esperada; no suma puntaje automático.'));
    const area = el('textarea', 'essay-input');
    area.value = answers[q.id] || '';
    area.maxLength = 5000;
    area.rows = 8;
    area.placeholder = 'Escribí tu respuesta…';
    area.setAttribute('aria-label', 'Tu respuesta');
    area.addEventListener('input', () => {
      const wasAnswered = isAnswered(q);
      answers[q.id] = area.value;
      // Solo se redibuja el progreso si cambió el estado, para no perder el foco del cuadro de texto.
      if (wasAnswered !== isAnswered(q)) updateProgress();
    });
    panel.append(area);
  } else {
    panel.append(optionList(q));
  }
  if (message) panel.append(el('div', 'notice', message));
  panel.append(quizActions());
  layout.append(side, panel); main.append(layout);
}

function updateProgress() {
  renderSidebar();
  document.querySelector('.side-count').textContent = `${countAnswered()} / ${quiz.preguntas.length}`;
  document.querySelector('.progress-bar').style.width = `${100 * countAnswered() / quiz.preguntas.length}%`;
  document.querySelectorAll('.q-nav').forEach((item, index) => {
    const done = isAnswered(quiz.preguntas[index]);
    item.classList.toggle('answered', done);
    item.title = `Pregunta ${index + 1}${done ? ', respondida' : ', pendiente'}`;
    item.setAttribute('aria-label', item.title);
  });
}

function optionList(q) {
  const fragment = document.createDocumentFragment();
  const selected = answers[q.id] || [];
  const multiple = q.correctas_count > 1;
  fragment.append(el('div', 'answer-hint', multiple ? 'Seleccioná todas las respuestas correctas. Cada acierto suma una parte del punto y cada opción incorrecta resta la misma parte.' : 'Seleccioná una respuesta.'));
  // Con diagramas, la lista tiene altura fija y se desplaza, en lugar de agrandar la pregunta.
  const withImages = q.opciones.some(hasImage);
  const options = el('div', withImages ? 'options options-scroll' : 'options');
  if (withImages) options.tabIndex = 0;
  q.opciones.forEach((option, index) => {
    const checked = selected.includes(index);
    const label = el('label', `option${checked ? ' selected' : ''}`);
    const input = el('input');
    input.type = multiple ? 'checkbox' : 'radio';
    input.name = `answer-${q.id}`;
    input.checked = checked;
    input.setAttribute('aria-label', `Opción ${String.fromCharCode(65 + index)}: ${plainText(option)}`);
    input.addEventListener('change', () => {
      answers[q.id] = multiple ? (checked ? selected.filter(i => i !== index) : [...selected, index].sort((a, b) => a - b)) : [index];
      message = ''; showQuiz();
    });
    const text = el('span', 'option-text');
    text.append(el('span', 'option-letter', `${String.fromCharCode(65 + index)}.`));
    appendRich(text, option);
    if (hasImage(option)) label.classList.add('has-image');
    label.append(input, text); options.append(label);
  });
  fragment.append(options);
  return fragment;
}

function quizActions() {
  const actions = el('div', 'quiz-actions');
  const previous = button('← Anterior', 'button ghost', () => { current--; message = ''; showQuiz(); });
  previous.disabled = current === 0;
  actions.append(previous);
  const right = el('div', 'right-actions');
  if (current < quiz.preguntas.length - 1) {
    right.append(button('Siguiente →', 'button secondary', () => { current++; message = ''; showQuiz(); }));
  } else {
    right.append(button('Finalizar', 'button primary', submitQuiz));
  }
  actions.append(right);
  return actions;
}

async function submitQuiz() {
  if (submitting) return;
  const missing = quiz.preguntas.findIndex(q => !isAnswered(q));
  if (missing !== -1) {
    current = missing;
    message = `Respondé todas las preguntas antes de finalizar. Faltan ${quiz.preguntas.length - countAnswered()}.`;
    showQuiz(); return;
  }
  submitting = true;
  try {
    report = await post('/api/submit', { id: quiz.id, respuestas: answers });
    quiz = null; answers = {}; message = '';
    activeAttempt = report.id;
    showReport(report);
    loadAttempts();
  } catch (error) { showError(error); }
  finally { submitting = false; }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function showReport(data) {
  main.replaceChildren();
  setView('report');
  const page = el('div', 'results');
  const top = el('section', 'panel results-top');
  top.append(el('span', 'eyebrow', 'Cuestionario finalizado'));
  top.append(el('h1', '', 'Tu resultado'));
  const score = el('div', 'score');
  score.append(document.createTextNode(String(data.aciertos)), el('small', '', ` / ${data.total}`));
  const essays = data.desarrollo ? `${data.desarrollo} de desarrollo sin puntaje` : '';
  top.append(score, el('div', 'result-meta', [data.materia && data.materia.nombre, data.porcentaje == null ? '' : `${data.porcentaje}% de los puntos`, essays, formatDate(data.fecha)].filter(Boolean).join(' · ')));
  const controls = el('div'); controls.style.marginTop = '25px';
  controls.append(button('Nuevo cuestionario', 'button primary', showHome));
  top.append(controls); page.append(top);
  page.append(el('h2', '', 'Revisión de respuestas'));
  const list = el('div', 'review-list');
  data.preguntas.forEach((q, index) => {
    const card = el('article', 'panel review-card');
    if (isEssay(q)) {
      card.append(el('div', 'status essay', `Pregunta ${index + 1} · Desarrollo · Sin puntaje automático`));
      card.append(questionContent(q.pregunta, true));
      const mine = el('div', 'essay-answer');
      mine.append(el('strong', '', 'Tu respuesta'), el('div', 'essay-text', q.respuesta_usuario || ''));
      const expected = el('div', 'essay-answer expected');
      expected.append(el('strong', '', 'Respuesta esperada'), richBlock('div', 'essay-text', q.respuesta || ''));
      card.append(mine, expected);
      if (q.explicacion) card.append(richBlock('div', 'review-explanation', q.explicacion));
      list.append(card);
      return;
    }
    const points = q.puntaje ?? (q.acierto ? 1 : 0);
    const status = q.acierto ? 'Correcta' : points > 0 ? 'Parcialmente correcta' : 'Incorrecta';
    card.append(el('div', `status ${q.acierto ? 'ok' : points > 0 ? 'partial' : 'bad'}`, `Pregunta ${index + 1} · ${status} · ${points} / 1 punto`));
    card.append(questionContent(q.pregunta, true));
    const opts = el('div', 'review-options');
    q.opciones.forEach((option, i) => {
      const correct = q.correctas.includes(i);
      const selected = q.seleccionadas.includes(i);
      let annotation = '';
      if (correct) annotation = selected ? ' ✓ Correcta · Tu respuesta' : ' ✓ Correcta · No seleccionada';
      else if (selected) annotation = ' ✕ Tu respuesta';
      const row = el('div', `review-option${correct ? ' correct' : selected ? ' wrong' : ''}`);
      row.append(document.createTextNode(`${String.fromCharCode(65 + i)}. `));
      appendRich(row, option);
      if (annotation) row.append(el('span', 'review-annotation', annotation));
      opts.append(row);
    });
    if (q.opciones.some(hasImage)) opts.classList.add('options-scroll');
    card.append(opts);
    if (q.explicacion) card.append(richBlock('div', 'review-explanation', q.explicacion));
    list.append(card);
  });
  page.append(list); main.append(page);
  window.scrollTo(0, 0);
}

document.querySelector('#nav-new').addEventListener('click', () => { setSidebar(false); showHome(); });
document.querySelector('#nav-import').addEventListener('click', () => { setSidebar(false); showImport(); });
document.querySelector('#sidebar-open').addEventListener('click', () => setSidebar(true));
document.querySelector('#sidebar-close').addEventListener('click', () => setSidebar(false));
document.querySelector('#sidebar-backdrop').addEventListener('click', () => setSidebar(false));
document.querySelector('#nav-exit').addEventListener('click', async () => {
  try {
    await post('/api/shutdown', {});
    main.replaceChildren(el('div', 'panel empty', 'La aplicación se cerró. Ya podés cerrar esta pestaña.'));
  } catch (error) { showError(error); }
});
document.querySelector('#home-link').addEventListener('click', () => { setSidebar(false); showHome(); });
document.querySelector('#home-link').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') showHome(); });

(async () => {
  try {
    meta = await api('/api/meta');
    document.querySelector('#nav-exit').hidden = !meta.compilada;
    loadAttempts();
    await showHome();
  }
  catch (error) { main.append(el('div', 'error', `No se pudo iniciar la aplicación: ${error.message}`)); }
})();
