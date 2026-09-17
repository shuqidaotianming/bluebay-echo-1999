// src/runtime/typewriter.mjs — 按行打字机
import { playSynthSound } from './audio.mjs';
import { config } from './core.mjs';

export function ensureTwStyle() {
  if (document.getElementById('tw-style')) return;
  var st = document.createElement('style'); st.id = 'tw-style';
  st.textContent = '.tw-cursor{display:inline-block;width:.6em;margin-left:1px;animation:twblink 1s steps(1) infinite}@keyframes twblink{50%{opacity:0}}';
  document.head.appendChild(st);
}
export function applyTypewriter(el, speed) {
  speed = speed || 55;
  if (!el || el.dataset.typewriterDone) return;
  // 尊重减少动效偏好：直接出终稿
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.dataset.typewriterDone = 'true'; return; }
  var html = el.innerHTML || '';
  var textOnly = html.replace(/<[^>]*>/g, '').trim();
  if (!textOnly || textOnly.length < 3) return;
  ensureTwStyle();
  el.dataset.typewriterDone = 'pending';
  var segs = html.split(/<br[^>]*>/i);
  var plain = segs.map(function (s) { var d = document.createElement('div'); d.innerHTML = s; return d.textContent || ''; });
  el.innerHTML = '';
  var lineEls = plain.map(function () { var d = document.createElement('div'); d.style.minHeight = '1em'; el.appendChild(d); return d; });
  var cursor = document.createElement('span'); cursor.className = 'tw-cursor'; cursor.textContent = '▋';
  var li = 0, ci = 0, timer = null;
  function placeCursor() { lineEls[Math.min(li, lineEls.length - 1)].appendChild(cursor); }
  function complete() {
    if (timer) clearInterval(timer);
    el.innerHTML = html;
    el.dataset.typewriterDone = 'true';
    document.removeEventListener('click', complete);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === ' ' || e.key === 'Enter') complete(); }
  document.addEventListener('click', complete, { once: true });
  document.addEventListener('keydown', onKey, { once: true });
  placeCursor();
  timer = setInterval(function () {
    if (li >= plain.length) { complete(); return; }
    lineEls[li].textContent = plain[li].slice(0, ci);
    placeCursor();
    if (ci % 2 === 0 && plain[li].length) playSynthSound('type');
    if (ci < plain[li].length) { ci++; } else { li++; ci = 0; }
  }, speed);
}
