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

async function showHome() {
  // Las materias se vuelven a leer para reflejar archivos agregados o editados.
  try { meta = await api('/api/meta'); } catch (error) { main.replaceChildren(); return showError(error); }
  main.replaceChildren();
  const hero = el('section', 'hero');
  hero.append(el('span', 'eyebrow', 'Práctica a tu ritmo'));
  hero.append(el('h1', '', 'Prepará tu próximo examen.'));
  hero.append(el('p', '', 'Elegí una materia, armá un cuestionario aleatorio, respondé todas las preguntas y revisá tus resultados cuando quieras.'));
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
    const help = el('p', 'muted', 'Todavía no hay materias disponibles. Agregá un archivo ');
    help.append(el('code', '', '.json'), document.createTextNode(' con preguntas en la carpeta de materias y volvé a esta pantalla.'));
    setup.append(help);
    info.append(el('h2', '', 'Tu espacio de práctica'), el('p', '', 'Cada archivo de la carpeta de materias es un banco de preguntas independiente.'), folders());
    grid.append(setup, info); main.append(grid);
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
  grid.append(setup, info); main.append(grid);
}

function countAnswered() { return quiz.preguntas.filter(isAnswered).length; }

function showQuiz() {
  if (!quiz) return showHome();
  main.replaceChildren();
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
    showReport(report);
  } catch (error) { showError(error); }
  finally { submitting = false; }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function showReport(data) {
  main.replaceChildren();
  const page = el('div', 'results');
  const top = el('section', 'panel results-top');
  top.append(el('span', 'eyebrow', 'Cuestionario finalizado'));
  top.append(el('h1', '', 'Tu resultado'));
  const score = el('div', 'score');
  score.append(document.createTextNode(String(data.aciertos)), el('small', '', ` / ${data.total}`));
  const essays = data.desarrollo ? `${data.desarrollo} de desarrollo sin puntaje` : '';
  top.append(score, el('div', 'result-meta', [data.materia && data.materia.nombre, data.porcentaje == null ? '' : `${data.porcentaje}% de los puntos`, essays, formatDate(data.fecha)].filter(Boolean).join(' · ')));
  const controls = el('div'); controls.style.marginTop = '25px';
  controls.append(button('Nuevo cuestionario', 'button primary', showHome), document.createTextNode(' '), button('Ver historial', 'button secondary', showHistory));
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

async function showHistory() {
  main.replaceChildren();
  const page = el('div', 'history');
  const head = el('div', 'history-head');
  head.append(el('h1', '', 'Historial de intentos'), button('Nuevo cuestionario', 'button primary', showHome));
  page.append(head, el('p', 'muted', `Tus resultados se guardan en ${meta.carpeta_historial}`));
  main.append(page);
  try {
    const records = await api('/api/history');
    if (!records.length) {
      const empty = el('div', 'panel empty');
      empty.append(el('h2', '', 'Todavía no hay intentos'), el('p', 'muted', 'Completá un cuestionario para empezar tu historial.'), button('Empezar', 'button primary', showHome));
      page.append(empty); return;
    }
    const list = el('div', 'history-list');
    records.forEach(record => {
      const item = button('', 'history-item', async () => {
        try { report = await api(`/api/history/${encodeURIComponent(record.id)}`); showReport(report); }
        catch (error) { showError(error); }
      });
      const left = el('div');
      left.append(el('strong', '', formatDate(record.fecha)), el('span', '', [record.materia && record.materia.nombre, `${record.total} preguntas`, 'Abrir revisión'].filter(Boolean).join(' · ')));
      item.append(left, el('div', 'history-score', record.porcentaje == null ? 'Sin puntaje' : `${record.aciertos}/${record.total} puntos · ${record.porcentaje}%`));
      list.append(item);
    });
    page.append(list);
  } catch (error) { showError(error); }
}

document.querySelector('#nav-new').addEventListener('click', showHome);
document.querySelector('#nav-history').addEventListener('click', showHistory);
document.querySelector('#nav-exit').addEventListener('click', async () => {
  try {
    await post('/api/shutdown', {});
    main.replaceChildren(el('div', 'panel empty', 'La aplicación se cerró. Ya podés cerrar esta pestaña.'));
  } catch (error) { showError(error); }
});
document.querySelector('#home-link').addEventListener('click', showHome);
document.querySelector('#home-link').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') showHome(); });

(async () => {
  try {
    meta = await api('/api/meta');
    document.querySelector('#nav-exit').hidden = !meta.compilada;
    await showHome();
  }
  catch (error) { main.append(el('div', 'error', `No se pudo iniciar la aplicación: ${error.message}`)); }
})();
