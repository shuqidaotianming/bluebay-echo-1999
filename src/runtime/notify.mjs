// src/runtime/notify.mjs — 跨页未读通知（localStorage + storage 事件总线）
import { config, triggerClue } from './core.mjs';
import { go } from './router.mjs';

export var NOTIFY_KEY = 'arg_notify_v1', NOTIFY_SEEN_KEY = 'arg_notify_seen';
export function pushNotify(text, target) {
  if (!text) return;
  try {
    localStorage.setItem(NOTIFY_KEY, JSON.stringify({ text: text, target: target || '', ts: Date.now(), from: (typeof config !== 'undefined' && config.nodeId) ? config.nodeId : '' }));
    showNotify({ text: text, target: target });
  } catch (e) {}
}
export function showNotify(payload) {
  var old = document.getElementById('arg-notify');
  if (old) old.remove();
  var b = document.createElement('div'); b.id = 'arg-notify';
  var head = document.createElement('div'); head.className = 'arg-notify-head'; head.textContent = '📟 潮声通讯 · 新消息';
  var body = document.createElement('div'); body.className = 'arg-notify-body'; body.textContent = payload.text;
  b.appendChild(head); b.appendChild(body);
  if (payload.target) {
    b.classList.add('clickable');
    b.addEventListener('click', function () { try { go(payload.target); } catch (e) { location.href = (config.files && config.files[payload.target]) || (payload.target + '.html'); } });
  }
  document.body.appendChild(b);
  try { localStorage.setItem(NOTIFY_SEEN_KEY, String(payload.ts || Date.now())); } catch (e) {}
  setTimeout(function () { b.classList.add('out'); setTimeout(function () { if (b.parentNode) b.remove(); }, 700); }, 7000);
}
export function ensureNotifyRelay() {
  if (window.__argNotifyOn) return; window.__argNotifyOn = true;
  if (!document.getElementById('arg-notify-style')) {
    var st = document.createElement('style'); st.id = 'arg-notify-style';
    st.textContent = [
      '#arg-notify{position:fixed;left:50%;transform:translateX(-50%);bottom:46px;z-index:99993;max-width:min(88vw,380px);background:rgba(12,18,28,.95);border:1px solid rgba(148,163,184,.35);border-left:3px solid #38bdf8;border-radius:10px;padding:9px 13px;color:#e2e8f0;font-size:12.5px;line-height:1.6;box-shadow:0 16px 40px -14px rgba(0,0,0,.7);animation:arg-notify-in .32s ease-out}',
      '#arg-notify.clickable{cursor:pointer}#arg-notify.clickable:hover{border-left-color:#facc15}',
      '.arg-notify-head{font-size:10.5px;letter-spacing:1.2px;color:#7dd3fc;opacity:.9;margin-bottom:2px}',
      '.arg-notify-body{color:#e5e7eb}',
      '#arg-notify.out{opacity:0;transform:translateX(-50%) translateY(12px);transition:all .6s}',
      '@keyframes arg-notify-in{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
    ].join(String.fromCharCode(10));
    document.head.appendChild(st);
  }
  window.addEventListener('storage', function (e) {
    if (e.key !== NOTIFY_KEY || !e.newValue) return;
    try {
      var n = JSON.parse(e.newValue);
      if (n && n.text && n.from !== (config.nodeId || '')) showNotify(n);
    } catch (err) {}
  });
  try {
    var raw = localStorage.getItem(NOTIFY_KEY);
    if (raw) {
      var n2 = JSON.parse(raw), seen = parseInt(localStorage.getItem(NOTIFY_SEEN_KEY) || '0', 10);
      if (n2 && n2.text && n2.ts > seen && n2.from !== (config.nodeId || '')) showNotify(n2);
    }
  } catch (e) {}
}
