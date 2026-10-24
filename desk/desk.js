import { STRINGS, getLang, setLang } from './i18n.js';

const $ = (sel) => document.querySelector(sel);
let lang = getLang();
let state = null;
let lastSig = '';
let selected = null;
const t = (key) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg']);
const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
}

function toast(msg) {
  const box = $('#toast');
  box.textContent = msg;
  box.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('show'), 2600);
}

function card(file, rel) {
  const thumb = el('div', { class: 'thumb' });
  if (IMAGE.has(file.ext)) {
    thumb.append(el('img', { src: `/api/file?path=${encodeURIComponent(rel)}`, alt: '', loading: 'lazy', decoding: 'async' }));
  } else {
    thumb.textContent = file.ext || file.kind.slice(0, 3);
  }
  const li = el('li', { class: 'card', tabindex: '0', draggable: 'true', 'data-rel': rel, title: file.name },
    thumb,
    el('div', { class: 'meta' }, el('div', { class: 'name' }, file.name), el('div', { class: 'sub' }, `${file.kind} · ${fmtBytes(file.bytes)}`), qualityLine(state.quality?.[file.name])));
  li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-cullyard', rel); li.classList.add('dragging'); });
  li.addEventListener('dragend', () => li.classList.remove('dragging'));
  li.addEventListener('focus', () => select(rel));
  li.addEventListener('click', () => select(rel));
  if (rel === selected) li.classList.add('sel');
  return li;
}

// What assess_photos measured, so the person sees the same evidence the agent used.
function qualityLine(q) {
  if (!q) return null;
  const tags = q.flags.map((f) => el('span', { class: `q q-${f}` }, t(`flag_${f}`)));
  if (q.similarGroup && !q.flags.includes('duplicate')) tags.push(el('span', { class: 'q q-best' }, t('flag_best')));
  return el('div', { class: 'quality' }, el('span', { class: 'q-rank' }, `${t('rank')} ${q.rank} · ${Math.round(q.relativeSharpness * 100)}%`), ...tags);
}

function select(rel) {
  selected = rel;
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.rel === rel));
}

function fillCards(list, files, prefix) {
  list.replaceChildren(...(files.length ? files.map((f) => card(f, prefix ? `${prefix}/${f.name}` : f.name)) : [el('li', { class: 'empty' }, t('empty'))]));
}

function laneColumn(name, index) {
  const list = el('ul', { class: 'cards' });
  const files = state.lanes[name] ?? [];
  fillCards(list, files, name);
  const col = el('section', { class: 'lane', 'data-lane': name },
    el('header', {}, el('h2', {}, index < 9 ? el('span', { class: 'lane-key' }, String(index + 1)) : null, name), el('span', { class: 'count' }, String(files.length))),
    list);
  dropTarget(col, name);
  return col;
}

function addLaneControl() {
  const btn = el('button', { class: 'add-lane', type: 'button' }, `+ ${t('newLane')}`);
  btn.addEventListener('click', () => {
    const input = el('input', { name: 'lane', placeholder: t('laneName'), maxlength: '40', required: '' });
    const form = el('form', { class: 'add-form' }, input,
      el('div', {}, el('button', { type: 'button', onclick: () => render(true) }, t('cancel')), el('button', { type: 'submit' }, t('create'))));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await api('/api/lane', { name: input.value });
      if (res) refresh(true);
    });
    btn.replaceWith(form);
    input.focus();
  });
  return btn;
}

function dropTarget(node, lane) {
  node.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('text/x-cullyard')) { e.preventDefault(); node.classList.add('over'); }
  });
  node.addEventListener('dragleave', () => node.classList.remove('over'));
  node.addEventListener('drop', (e) => {
    const rel = e.dataTransfer.getData('text/x-cullyard');
    node.classList.remove('over');
    if (!rel) return;
    e.preventDefault();
    e.stopPropagation();
    move(rel, lane);
  });
}

async function api(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { toast(`${t('failed')}: ${data.error ?? res.status}`); return null; }
  return data;
}

async function move(rel, lane) {
  const node = document.querySelector(`.card[data-rel="${CSS.escape(rel)}"]`);
  node?.classList.add('leave');
  if (await api('/api/move', { file: rel, lane })) refresh(true);
  else node?.classList.remove('leave');
}

function feedItem(entry) {
  const time = el('time', { datetime: entry.ts }, fmtTime(entry.ts));
  if (entry.action === 'seal') {
    const link = el('a', { href: `https://explorer.solana.com/tx/${entry.signature}?cluster=devnet`, target: '_blank', rel: 'noopener' }, `${entry.signature.slice(0, 10)}…`);
    return el('li', {}, time, el('em', {}, t('action_seal')), ' ', link);
  }
  if (entry.action === 'move') return el('li', {}, time, `${t('action_move')} `, el('b', {}, entry.file), ` ${t('to')} `, el('em', {}, entry.lane), entry.reason ? el('q', {}, entry.reason) : null);
  if (entry.action === 'assess') return el('li', {}, time, `${t('action_assess')} `, el('b', {}, `${entry.count} ${t('photos')}`));
  return el('li', {}, time, `${t(`action_${entry.action}`)} `, el('b', {}, entry.file ?? ''));
}

function render(force) {
  if (!state) return;
  const sig = JSON.stringify([state.laneOrder, state.inbox, state.lanes, state.log[0], state.quality, lang]);
  if (!force && sig === lastSig) return;
  lastSig = sig;
  // Folder name only: the full path carries the Windows user name into every screenshot.
  $('#ws').textContent = state.workspace.split(/[\\/]/).filter(Boolean).pop() ?? state.workspace;
  $('#ws').title = state.workspace;
  $('#inbox-count').textContent = state.inbox.length;
  fillCards($('#inbox'), state.inbox, '');
  $('#lanes').replaceChildren(...state.laneOrder.map(laneColumn), addLaneControl());
  $('#feed').replaceChildren(...(state.log.length ? state.log.map(feedItem) : [el('li', {}, t('noActivity'))]));
}

async function refresh(force = false) {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    state = await res.json();
    $('#status').classList.remove('off');
    $('#status span').textContent = t('live');
    render(force);
  } catch {
    $('#status').classList.add('off');
    $('#status span').textContent = t('offline');
  }
}

async function upload(files) {
  for (const file of files) {
    const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
    toast(res.ok ? `${t('uploaded')}: ${file.name}` : `${t('failed')}: ${file.name}`);
  }
  refresh(true);
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  render(true);
}

document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; setLang(lang); applyLang(); }));

// Files dragged in from Explorer can land anywhere on the page.
let depth = 0;
const isOsDrag = (e) => [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', (e) => { if (isOsDrag(e)) { depth++; $('#veil').hidden = false; } });
window.addEventListener('dragleave', (e) => { if (isOsDrag(e) && --depth <= 0) { depth = 0; $('#veil').hidden = true; } });
window.addEventListener('dragover', (e) => { if (isOsDrag(e)) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!isOsDrag(e)) return;
  e.preventDefault();
  depth = 0;
  $('#veil').hidden = true;
  upload(e.dataTransfer.files);
});
$('#picker').addEventListener('change', (e) => upload(e.target.files));

window.addEventListener('keydown', (e) => {
  if (!selected || e.target.closest('input') || !/^[1-9]$/.test(e.key) || !state) return;
  const lane = state.laneOrder[Number(e.key) - 1];
  if (lane) move(selected, lane);
});

applyLang();
refresh(true);
setInterval(refresh, 1500);
