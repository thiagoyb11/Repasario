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

function questionContent(text, review = false) {
  const wrapper = el('div', review ? 'review-stem' : 'question-stem');
  text.split('```').forEach((part, index) => {
    if (!part.trim()) return;
    if (index % 2 === 1) {
      const pre = el('pre', 'code-block');
      pre.append(el('code', '', part.trimEnd()));
      wrapper.append(pre);
    } else {
      wrapper.append(el(review ? 'div' : 'h1', 'question-prose', part.trim()));
    }
  });
  return wrapper;
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

function showHome() {
  main.replaceChildren();
  const hero = el('section', 'hero');
  hero.append(el('span', 'eyebrow', 'Práctica a tu ritmo'));
  hero.append(el('h1', '', 'Prepará tu próximo parcial de Java.'));
  hero.append(el('p', '', 'Armá un cuestionario aleatorio, respondé todas las preguntas y revisá tus resultados cuando quieras.'));
  main.append(hero);

  const grid = el('div', 'home-grid');
  const setup = el('section', 'panel setup-panel');
  setup.append(el('h2', '', 'Nuevo cuestionario'));
  setup.append(el('p', 'muted', 'Elegí cuántas preguntas querés practicar. Cada intento se guarda al finalizar.'));
  const label = el('label', 'field-label', 'Cantidad de preguntas');
  label.htmlFor = 'count';
  const row = el('div', 'count-row');
  const count = el('input');
  count.id = 'count'; count.type = 'number'; count.min = '1'; count.max = String(meta.maximo); count.value = String(Math.min(20, meta.maximo));
  row.append(count, el('span', 'limit', `De 1 a ${meta.maximo} preguntas`));
  setup.append(label, row);
  setup.append(button('Comenzar cuestionario →', 'button primary start-button', async () => {
    const amount = Number(count.value);
    if (!Number.isInteger(amount) || amount < 1 || amount > meta.maximo) { count.focus(); return; }
    try {
      quiz = await post('/api/quiz', { cantidad: amount });
      answers = {}; current = 0; report = null; message = '';
      showQuiz();
    } catch (error) { showError(error); }
  }));
  if (quiz) setup.append(button('Retomar cuestionario en curso', 'button secondary start-button', showQuiz));
  const info = el('aside', 'panel info-panel');
  info.append(el('h2', '', 'Tu espacio de práctica'));
  info.append(el('p', '', 'Preguntas del campus y ejercicios adicionales sobre Java, colecciones, excepciones, patrones y arquitectura.'));
  info.append(el('div', 'stat', String(meta.cantidad)), el('div', 'stat-label', 'preguntas en el banco editable'));
  const path = el('div', 'path');
  path.append(el('strong', '', 'Historial en esta computadora'), el('span', '', meta.carpeta_historial));
  info.append(path);
  grid.append(setup, info); main.append(grid);
}

function countAnswered() { return quiz.preguntas.filter(q => (answers[q.id] || []).length > 0).length; }

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
    const done = (answers[question.id] || []).length > 0;
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
  head.append(el('span', 'tag', q.tema || 'Java'));
  panel.append(head, questionContent(q.pregunta));
  const selected = answers[q.id] || [];
  const multiple = q.correctas_count > 1;
  panel.append(el('div', 'answer-hint', multiple ? 'Seleccioná todas las respuestas correctas. Cada acierto suma una parte del punto y cada opción incorrecta resta la misma parte.' : 'Seleccioná una respuesta.'));
  const options = el('div', 'options');
  q.opciones.forEach((option, index) => {
    const checked = selected.includes(index);
    const label = el('label', `option${checked ? ' selected' : ''}`);
    const input = el('input');
    input.type = multiple ? 'checkbox' : 'radio';
    input.name = `answer-${q.id}`;
    input.checked = checked;
    input.setAttribute('aria-label', `Opción ${String.fromCharCode(65 + index)}: ${option}`);
    input.addEventListener('change', () => {
      answers[q.id] = multiple ? (checked ? selected.filter(i => i !== index) : [...selected, index].sort((a, b) => a - b)) : [index];
      message = ''; showQuiz();
    });
    const text = el('span', 'option-text');
    text.append(el('span', 'option-letter', `${String.fromCharCode(65 + index)}.`), document.createTextNode(option));
    label.append(input, text); options.append(label);
  });
  panel.append(options);
  if (message) panel.append(el('div', 'notice', message));
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
  actions.append(right); panel.append(actions);
  layout.append(side, panel); main.append(layout);
}

async function submitQuiz() {
  if (submitting) return;
  const missing = quiz.preguntas.findIndex(q => !(answers[q.id] || []).length);
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
  top.append(score, el('div', 'result-meta', `${data.porcentaje}% de los puntos · ${formatDate(data.fecha)}`));
  const controls = el('div'); controls.style.marginTop = '25px';
  controls.append(button('Nuevo cuestionario', 'button primary', showHome), document.createTextNode(' '), button('Ver historial', 'button secondary', showHistory));
  top.append(controls); page.append(top);
  page.append(el('h2', '', 'Revisión de respuestas'));
  const list = el('div', 'review-list');
  data.preguntas.forEach((q, index) => {
    const card = el('article', 'panel review-card');
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
      opts.append(el('div', `review-option${correct ? ' correct' : selected ? ' wrong' : ''}`, `${String.fromCharCode(65 + i)}. ${option}${annotation}`));
    });
    card.append(opts);
    if (q.explicacion) card.append(el('p', 'review-explanation', q.explicacion));
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
      left.append(el('strong', '', formatDate(record.fecha)), el('span', '', `${record.total} preguntas · Abrir revisión`));
      item.append(left, el('div', 'history-score', `${record.aciertos}/${record.total} puntos · ${record.porcentaje}%`));
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
    showHome();
  }
  catch (error) { main.append(el('div', 'error', `No se pudo iniciar la aplicación: ${error.message}`)); }
})();
