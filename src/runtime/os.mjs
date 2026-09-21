// src/runtime/os.mjs — 桌面窗口管理器（零依赖）：创建/拖动/缩放/最小化/最大化/还原/z序/任务栏/Alt-Tab/状态持久化
import { playSynthSound } from './audio.mjs';
import { applyTheme, currentTheme } from './ostheme.mjs';

const STATE_KEY = 'os_windows_v1';
const windows = new Map(); // id -> handle
let topZ = 100, activeId = null, taskbar = null, workArea = null;

function persist(id) {
  try {
    const all = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    const w = windows.get(id); if (!w) return;
    all[id] = { x: w.el.offsetLeft, y: w.el.offsetTop, w: w.el.offsetWidth, h: w.el.offsetHeight, min: w.min, max: w.max };
    localStorage.setItem(STATE_KEY, JSON.stringify(all));
  } catch (e) {}
}
function restore(id) { try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}')[id] || null; } catch (e) { return null; } }

function makeBar(win) {
  const bar = document.createElement('div'); bar.className = 'os-bar';
  const title = document.createElement('span'); title.className = 'os-title'; title.textContent = win.title;
  const mk = (t, act, ttl) => { const b = document.createElement('button'); b.textContent = t; b.title = ttl; b.onclick = (e) => { e.stopPropagation(); act(); }; return b; };
  bar.appendChild(title);
  bar.appendChild(mk('–', () => minimize(win.id), '最小化'));
  bar.appendChild(mk('□', () => toggleMax(win.id), '最大化/还原'));
  bar.appendChild(mk('×', () => close(win.id), '关闭'));
  return bar;
}
function focusWin(id) {
  if (!windows.has(id)) return;
  activeId = id; const w = windows.get(id); w.el.style.zIndex = String(++topZ); w.el.classList.add('os-focus');
  windows.forEach((x, k) => { if (k !== id) x.el.classList.remove('os-focus'); if (x.tb) x.tb.classList.toggle('active', k === id); });
}
function minimize(id) { const w = windows.get(id); if (!w) return; w.min = !w.min; w.el.classList.toggle('os-min', w.min); if (w.tb) w.tb.classList.toggle('active', !w.min); if (!w.min) focusWin(id); playSynthSound('click'); }
function toggleMax(id) { const w = windows.get(id); if (!w) return; w.max = !w.max; w.el.classList.toggle('os-max', w.max); persist(id); focusWin(id); playSynthSound('click'); }
function close(id) { const w = windows.get(id); if (!w) return; try { w.el.remove(); if (w.tb) w.tb.remove(); } catch (e) {} windows.delete(id); if (activeId === id) activeId = null; playSynthSound('click'); }

function dragResize(win) {
  const bar = win.el.querySelector('.os-bar');
  let d = null;
  bar.addEventListener('pointerdown', (e) => { if (e.target.tagName === 'BUTTON') return; focusWin(win.id); const r = win.el.getBoundingClientRect(), h = (workArea||document.body).getBoundingClientRect(); d = { dx: e.clientX - r.left, dy: e.clientY - r.top, baseL: r.left - h.left, baseT: r.top - h.top }; win.el.classList.add('os-drag'); try { bar.setPointerCapture(e.pointerId); } catch (_) {} });
  bar.addEventListener('pointermove', (e) => { if (!d) return; const h = (workArea||document.body).getBoundingClientRect(); win.el.style.left = Math.max(0, e.clientX - h.left - d.dx) + 'px'; win.el.style.top = Math.max(0, e.clientY - h.top - d.dy) + 'px'; });
  bar.addEventListener('pointerup', () => { if (d) { d = null; win.el.classList.remove('os-drag'); persist(win.id); } });
  const rz = document.createElement('div'); rz.className = 'os-rz'; win.el.appendChild(rz);
  let g = null;
  rz.addEventListener('pointerdown', (e) => { e.stopPropagation(); focusWin(win.id); g = { x: e.clientX, y: e.clientY, w: win.el.offsetWidth, h: win.el.offsetHeight }; try { rz.setPointerCapture(e.pointerId); } catch (_) {} });
  rz.addEventListener('pointermove', (e) => { if (!g) return; win.el.style.width = Math.max(200, g.w + (e.clientX - g.x)) + 'px'; win.el.style.height = Math.max(120, g.h + (e.clientY - g.y)) + 'px'; });
  rz.addEventListener('pointerup', () => { if (g) { g = null; persist(win.id); } });
}

export function openWindow({ id, title, render, x = 60, y = 40, w = 460, h = 320 }) {
  id = id || ('win_' + Math.random().toString(36).slice(2, 8));
  if (windows.has(id)) { focusWin(id); return windows.get(id); }
  applyTheme(currentTheme());
  const el = document.createElement('div'); el.className = 'os-win';
  const st = restore(id); if (st && !st.max) { x = st.x; y = st.y; w = st.w; h = st.h; }
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
  el.appendChild(makeBar({ id, title }));
  const body = document.createElement('div'); body.className = 'os-body'; el.appendChild(body);
  const res = document.createElement('div'); res.className = 'os-res'; res.textContent = '就绪'; el.appendChild(res);
  (workArea || document.body).appendChild(el);
  const win = { id, title, el, body, res, min: false, max: !!(st && st.max) };
  if (win.max) el.classList.add('os-max');
  el.addEventListener('pointerdown', () => focusWin(id));
  if (taskbar) { const tb = document.createElement('button'); tb.className = 'os-tbtn'; tb.textContent = title; tb.onclick = () => { if (win.min) minimize(id); else if (activeId === id) minimize(id); else focusWin(id); }; taskbar.appendChild(tb); win.tb = tb; }
  windows.set(id, win); dragResize(win); focusWin(id);
  try { if (render) render(body, win); } catch (e) { body.textContent = '（窗口渲染出错：' + e.message + '）'; }
  return win;
}

function cycle() { const ids = [...windows.keys()]; if (ids.length < 2) return; const i = ids.indexOf(activeId); focusWin(ids[(i + 1) % ids.length]); playSynthSound('click'); }

export function initOS({ work, bar } = {}) {
  workArea = work || document.querySelector('.os-workarea') || document.body;
  taskbar = bar || document.querySelector('.os-taskbar .os-tasks') || null;
  applyTheme(currentTheme());
  document.addEventListener('keydown', (e) => { if (e.altKey && e.key === 'Tab') { e.preventDefault(); cycle(); } });
}
export function listWindows() { return [...windows.keys()]; }
export function _resetOS() { windows.forEach((w) => { try { w.el.remove(); w.tb && w.tb.remove(); } catch (e) {} }); windows.clear(); }
