// src/runtime/stats.mjs — 隐藏访问统计 + 监听终端页（尊重 DNT）
import { config } from './core.mjs';

export function trackVisit() {
  if (config.preview || !config.trackProgress) return;
  try {
    if (navigator.doNotTrack === '1') return; // 尊重「请勿追踪」
    var UV_KEY = 'arg_uv_done';
    if (!localStorage.getItem(UV_KEY)) {
      localStorage.setItem(UV_KEY, '1');
      fetch('https://abacus.jasoncameron.dev/hit/bluebay-echo-1999/visitors').catch(function () {});
    }
    fetch('https://abacus.jasoncameron.dev/hit/bluebay-echo-1999/pages').catch(function () {});
  } catch (e) {}
}
export function ensureStats() {
  if (!config.stats || config.preview || document.getElementById('arg-stats-line')) return;
  var host = document.querySelector('[data-arg-slot="body"]');
  if (!host) return;
  var line = document.createElement('div');
  line.id = 'arg-stats-line'; line.style.marginTop = '12px'; line.style.opacity = '.8';
  line.textContent = '> 正在从远端信标同步计数 ……';
  host.appendChild(line);
  function get(key, cb) {
    fetch('https://abacus.jasoncameron.dev/get/bluebay-echo-1999/' + key)
      .then(function (r) { return r.text(); })
      .then(function (t) { cb(t.replace(/[^0-9]/g, '') || '?'); })
      .catch(function () { cb('?'); });
  }
  get('pages', function (pv) { get('visitors', function (uv) { line.textContent = '> 到访 ' + pv + ' 次 ｜ 踏足者 ' + uv + ' 人 ｜ 信标仍在闪。'; }); });
}
