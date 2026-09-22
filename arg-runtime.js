/* 白噪1999 运行时（构建产物）。由 src/runtime/*.mjs 打包生成；请勿直接编辑本文件，改 src/runtime 后运行 node scripts/build.mjs。 */
(function(){
"use strict";
try{
/* ---- logic.mjs ---- */
// src/runtime/logic.mjs — 纯函数（无 DOM），测试与运行时共用，单一事实来源
// 注意：这些函数不引用 config/document，可被 node 直接 import 测试。

function normShadow(s) {
  let out = '';
  String(s || '').toLowerCase().split('').forEach(function (c) {
    if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || c === '.') out += c;
  });
  if (out.slice(0, 2) === 'fm') out = out.slice(2);
  while (out.slice(-2) === '.0') out = out.slice(0, -2);
  return out;
}

// 线索是否集齐：req 逗号分隔（小写），visited 全部命中才算
function hasClueOf(visited, req) {
  if (!req) return true;
  const list = (visited || []).map((v) => String(v).toLowerCase());
  const reqList = String(req).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return reqList.every((r) => list.some((v) => v === r));
}

// 口令归一化：小写、按 , ; | / 拆分多解
function allowedPasswords(raw) {
  return String(raw == null ? '' : raw).split(/[,，;|/]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function passwordOk(rawExpected, value) {
  const list = allowedPasswords(rawExpected);
  if (!list.length) return true;
  return list.indexOf(String(value || '').trim().toLowerCase()) !== -1;
}

// 答案校验（solve-credit）：config.verifyAnswers = { 归一化答案: clueId, ... }
function verifyAnswer(map, text) {
  const k = String(text || '').trim().toLowerCase();
  if (!map || !k) return null;
  // 先精确 key，再宽松（去空格）
  if (Object.prototype.hasOwnProperty.call(map, k)) return map[k];
  const kk = k.replace(/\s+/g, '');
  for (const key of Object.keys(map)) if (key.replace(/\s+/g, '') === kk) return map[key];
  return null;
}

// 时间锁谓词：now=Date 实例，elapsedMin=真实经过分钟（游戏时钟），返回 {ok, phase, need}
// cfg.timeLock =
//   { mode:'gameclock', start:'HH:MM', end:'HH:MM' }         // 游戏内钟（1 真实分=4 游戏分, 18:00→23:30）
//   { mode:'hour', start, end }                              // 真实小时本地制（跨零点支持）
//   { mode:'afterDate'|'beforeDate', date:'YYYY-MM-DD' }     // 真实日历日锁
//   { mode:'holdMinutes', minutes }                          // 持续收听（需宿主上报已停留分钟）
function gameClock(elapsedMin) {
  const gameMin = 18 * 60 + Math.min((elapsedMin || 0) * 4, (23 * 60 + 30) - (18 * 60));
  const hh = Math.floor(gameMin / 60) % 24, mm = gameMin % 60;
  return (hh < 10 ? '0' + hh : '' + hh) + ':' + (mm < 10 ? '0' + mm : '' + mm);
}
function toMin(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); }
function inWindow(cur, start, end) { return start <= end ? (cur >= start && cur < end) : (cur >= start || cur < end); }

function timeLockSatisfied(tl, ctx = {}) {
  if (!tl || !tl.mode) return { ok: true, phase: '', need: '' };
  const now = ctx.now || new Date();
  if (tl.mode === 'gameclock') {
    const cur = toMin(gameClock(ctx.elapsedMin));
    const ok = inWindow(cur, toMin(tl.start), toMin(tl.end));
    return { ok, phase: gameClock(ctx.elapsedMin), need: tl.start + '–' + tl.end };
  }
  if (tl.mode === 'hour') {
    const cur = now.getHours();
    const ok = inWindow(cur, tl.start, tl.end);
    return { ok, phase: String(cur), need: tl.start + ':00–' + tl.end + ':00' };
  }
  if (tl.mode === 'afterDate' || tl.mode === 'beforeDate') {
    const d = new Date(tl.date + 'T00:00:00');
    const ok = tl.mode === 'afterDate' ? now.getTime() >= d.getTime() : now.getTime() < d.getTime();
    return { ok, phase: now.toISOString().slice(0, 10), need: tl.date };
  }
  if (tl.mode === 'holdMinutes') {
    const ok = (ctx.holdMinutes || 0) >= tl.minutes;
    return { ok, phase: String(Math.floor(ctx.holdMinutes || 0)), need: '连续 ' + tl.minutes + ' 分钟' };
  }
  return { ok: true, phase: '', need: '' };
}

// 存档版本化：把散落 localStorage 键聚成带版本的快照，可导入/导出
const SAVE_VERSION = 1;
function packSave(store) {
  // store: 类 localStorage（getItem 可缺）
  const g = (k) => { try { return store.getItem(k); } catch (e) { return null; } };
  return {
    v: SAVE_VERSION,
    visited: JSON.parse(g('arg_visited_nodes') || '[]'),
    chat: JSON.parse(g('arg_chat_log_v1') || '{}'),
    name: g('arg_your_name') || '',
    shadow: g('arg_shadow_949') || '',
    start: g('arg_game_start') || '',
    notify: g('arg_notify_v1') || null,
    postOpen: (g('arg_post_open_flags') || '').split(',').filter(Boolean),
    unlocked: JSON.parse(g('arg_unlocked_locks') || '[]'),
    timeClues: JSON.parse(g('arg_time_clues') || '[]'),
  };
}
function normalizeVisited(raw) {
  let arr;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch (e) { arr = []; } } else arr = raw;
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const x of arr) { const k = String(x); if (!seen.has(k)) { seen.add(k); out.push(k); } }
  return out;
}


/* ---- core.mjs ---- */
// src/runtime/core.mjs — config 解析、结果槽、线索状态机、影子权限、敏感词、转义收口


const configEl = (typeof document !== 'undefined') ? document.getElementById('arg-config') : null;
const config = configEl ? JSON.parse(configEl.textContent || '{}') : { rules: {}, files: {}, links: {} };
// 全局数据文件 arg-data.js 提供整站 files/names；页内若带则作覆盖（省体积：多数页不再内嵌大表）
(function mergeGlobalData() {
  const G = (typeof window !== 'undefined' && window.ARG_DATA) ? window.ARG_DATA : {};
  config.files = Object.assign({}, G.files || {}, config.files || {});
  config.names = Object.assign({}, G.names || {}, config.names || {});
})();
const result = (text) => { const el = document.querySelector('[data-arg-result]'); if (el) el.textContent = text; };

// HTML 转义：所有拼进 innerHTML 的动态字符串一律过这里（XSS 收口）
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---- 线索状态机 ----
function readVisited() {
  try { return normalizeVisited(localStorage.getItem('arg_visited_nodes') || '[]'); } catch (e) { return []; }
}
function writeVisited(list) {
  try { localStorage.setItem('arg_visited_nodes', JSON.stringify(list)); } catch (e) {}
}
if (typeof window !== 'undefined' && config.trackProgress !== false) {
  try {
    const visited = readVisited();
    const currentPageId = config.nodeId || config.pageName || window.location.pathname.split('/').pop().replace('.html', '');
    const unlocked = !config.requiresClue || hasClue(config.requiresClue);
    if (unlocked && currentPageId && !visited.includes(currentPageId)) { visited.push(currentPageId); writeVisited(visited); }
    // 地址栏 hash 谜题（#firstlight / #sixtysix）——命中即记入线索
    if (unlocked && config.hashClue && config.hashValue &&
        String(window.location.hash).toLowerCase() === String(config.hashValue).toLowerCase()) {
      if (!visited.includes(config.hashClue)) { visited.push(config.hashClue); writeVisited(visited); }
    }
    // 存档版本戳（缺失即写，不破坏既有键）
    if (!localStorage.getItem('arg_save_version')) localStorage.setItem('arg_save_version', String(1));
  } catch (e) {}
}

function hasClue(req) {
  if (!req) return true;
  try {
    const visited = readVisited();
    let unlocked = [];
    try { unlocked = (JSON.parse(localStorage.getItem('arg_unlocked_locks') || '[]') || []).map((x) => String(x).toLowerCase()); } catch (e) {}
    const parts = String(req).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return parts.every((r) => r.startsWith('lock:') ? unlocked.includes(r.slice(5)) : visited.some((v) => String(v).toLowerCase() === r));
  } catch (e) { return true; }
}
function triggerClue(id) {
  if (!id) return;
  try {
    const visited = readVisited();
    if (!visited.includes(id)) {
      visited.push(id); writeVisited(visited);
      if (typeof config === 'undefined' || !config.preview) {
        try {
          if (id !== (config && config.nodeId) && typeof pushNotify === 'function') {
            pushNotify('新线索 · ' + ((config.names && config.names[id]) || id) + '。有些门，现在能推得开了。', (config.files && config.files[id]) ? id : '');
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}
function getClues() { try { return readVisited().slice(); } catch (e) { return []; } }

// ---- 影子搜索权限 / 敏感词涂码 ----
var CENSOR_WORDS = ['白噪计划', '第九夜', '六十六', '听潮会', '随船', '失踪名单'];
function isShadow() {
  try { return config.shadowClue ? hasClue(config.shadowClue) : localStorage.getItem('arg_shadow_949') === '1'; } catch (e) { return false; }
}
function applyShadowSkin(fresh) {
  const host = document.querySelector('[data-arg-result]') || document.querySelector('.search-container,.term-container,.yahoo-container,.bbs-container');
  const id = 'arg-shadow-ribbon';
  if (document.getElementById(id)) return;
  const r = document.createElement('div'); r.id = id;
  r.textContent = '检索权限：档案员（94.9 MHz）· 内线索引已并入';
  r.style.cssText = 'margin:10px 0;padding:7px 12px;border-radius:8px;background:rgba(13,148,136,.12);border:1px dashed rgba(13,148,136,.55);color:#0f766e;font-size:12px;letter-spacing:1px';
  if (host && host.parentElement) host.parentElement.insertBefore(r, host);
  else document.body.insertBefore(r, document.body.firstChild);
  if (fresh) {
    const cands = Object.keys(config.shadowRules || {});
    if (cands.length) result('✔ 权限已切换：档案员检索。现在试试这些当年被挡在后面的词——' + cands.slice(0, 4).join(' / '));
  }
}
function maskText(s) {
  let out = String(s || '');
  if (isShadow()) return out;
  CENSOR_WORDS.forEach(function (w) {
    while (out.indexOf(w) !== -1) {
      const bar = new Array(w.length + 1).join('▇');
      out = out.replace(w, bar);
    }
  });
  return out;
}


/* ---- audio.mjs ---- */
// src/runtime/audio.mjs — Web Audio 合成（零素材、离线）
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSynthSound(kind) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (kind === 'click' || kind === 'type') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(kind === 'type' ? 380 + Math.random() * 160 : 700, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.035);
    } else if (kind === 'notify') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else if (kind === 'unlock') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.22);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.06); osc.stop(ctx.currentTime + i * 0.06 + 0.22);
      });
    } else if (kind === 'error') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.18);
    }
  } catch (e) {}
}

// ---- 4.5Hz 低频底噪 ----
let droneCtx = null, droneMaster = null, droneOn = false, droneBtn = null;
function ensureDroneToggle() {
  if (droneBtn || !config.drone || config.preview || document.getElementById('arg-drone-toggle')) return;
  droneBtn = document.createElement('button'); droneBtn.id = 'arg-drone-toggle';
  droneBtn.textContent = '◍ 白噪'; droneBtn.title = '开启/关闭 4.5Hz 低频底噪（FM99.4）';
  document.body.appendChild(droneBtn);
  const st = document.createElement('style');
  st.textContent = '#arg-drone-toggle{position:fixed;left:10px;bottom:10px;z-index:99990;font-size:11px;letter-spacing:1px;color:#94a3b8;background:rgba(10,14,22,.5);border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:4px 11px;cursor:pointer;opacity:.6;font-family:inherit}#arg-drone-toggle:hover{opacity:.95;color:#e2e8f0}';
  document.head.appendChild(st);
  droneBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleDrone(); });
}
function buildDrone() {
  const AC = window.AudioContext || window.webkitAudioContext;
  droneCtx = new AC();
  droneMaster = droneCtx.createGain(); droneMaster.gain.value = 0.0001; droneMaster.connect(droneCtx.destination);
  [52, 56.5].forEach(function (f) {
    const o = droneCtx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = droneCtx.createGain(); g.gain.value = 0.5;
    o.connect(g); g.connect(droneMaster); o.start();
  });
  const len = 2 * droneCtx.sampleRate, buf = droneCtx.createBuffer(1, len, droneCtx.sampleRate), d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  const src = droneCtx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = droneCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
  const ng = droneCtx.createGain(); ng.gain.value = 0.7;
  src.connect(lp); lp.connect(ng); ng.connect(droneMaster); src.start();
}
function toggleDrone() {
  try {
    if (!droneCtx) buildDrone();
    if (droneCtx.state === 'suspended') droneCtx.resume();
    droneOn = !droneOn;
    const t = droneCtx.currentTime;
    droneMaster.gain.cancelScheduledValues(t);
    droneMaster.gain.setValueAtTime(droneMaster.gain.value, t);
    droneMaster.gain.linearRampToValueAtTime(droneOn ? 0.12 : 0.0001, t + 0.8);
    droneBtn.textContent = droneOn ? '◉ 白噪' : '◍ 白噪';
  } catch (e) {}
}


/* ---- typewriter.mjs ---- */
// src/runtime/typewriter.mjs — 按行打字机



function ensureTwStyle() {
  if (document.getElementById('tw-style')) return;
  var st = document.createElement('style'); st.id = 'tw-style';
  st.textContent = '.tw-cursor{display:inline-block;width:.6em;margin-left:1px;animation:twblink 1s steps(1) infinite}@keyframes twblink{50%{opacity:0}}';
  document.head.appendChild(st);
}
function applyTypewriter(el, speed) {
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


/* ---- desktop.mjs ---- */
// src/runtime/desktop.mjs — 桌面拟真：视口/横屏/时钟/窗口管理/开关机/纹理



function ensureViewportMeta() {
  if (!document.querySelector('meta[name="viewport"]')) {
    const mv = document.createElement('meta');
    mv.setAttribute('name', 'viewport');
    mv.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    document.head.appendChild(mv);
  }
  if (!document.querySelector('link[rel="icon"]')) {
    var fx = document.createElement('link');
    fx.rel = 'icon'; fx.type = 'image/svg+xml';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0c1720"/><path d="M16 5l4 6v14h-8V11z" fill="#facc15"/><circle cx="16" cy="9" r="2.4" fill="#fef3c7"/><path d="M4 27h24" stroke="#22d3ee" stroke-width="2" fill="none"/></svg>';
    fx.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    document.head.appendChild(fx);
  }
}

var ARG_DISPLAY = { w: 0, h: 0, dpr: 1, orient: '', forced: false };
function ensureLandscapeProbe() {
  if (document.getElementById('arg-land-style')) return;
  const st = document.createElement('style'); st.id = 'arg-land-style';
  st.textContent = [
    'html.arg-force-land{overflow:hidden}',
    'html.arg-force-land body{position:absolute;top:0;left:100vw;width:100vh;width:100dvh;height:100vw!important;min-height:0!important;min-width:0!important;max-width:none;box-sizing:border-box!important;transform:rotate(90deg);transform-origin:0 0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;background:inherit}',
    '#arg-display-chip{position:fixed;right:10px;top:10px;z-index:99992;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#9fb3c8;background:rgba(8,12,20,.74);border:1px solid rgba(148,163,184,.28);border-radius:6px;padding:3px 8px;letter-spacing:.5px;pointer-events:none;opacity:.9}',
    '#arg-display-chip.fade{opacity:.26;transition:opacity 1.4s}',
    '@media (pointer:fine){#arg-display-chip{display:none}}',
    'html.arg-tiny .scp-card{padding:16px 12px!important}',
    'html.arg-tiny .news-content{padding:14px 10px!important}',
    'html.arg-tiny .mag-container{padding:18px 12px!important}'
  ].join(String.fromCharCode(10));
  document.head.appendChild(st);

  function measure() {
    const w = window.innerWidth, h = window.innerHeight;
    ARG_DISPLAY.w = w; ARG_DISPLAY.h = h;
    ARG_DISPLAY.dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
    const portrait = h > w;
    const forced = portrait && coarse;
    ARG_DISPLAY.orient = portrait ? 'portrait' : 'landscape';
    ARG_DISPLAY.forced = forced;
    window.ARG_DISPLAY = ARG_DISPLAY;
    const root = document.documentElement;
    root.classList.toggle('arg-force-land', forced);
    root.classList.toggle('arg-tiny', Math.min(w, h) < 340);
    let chip = document.getElementById('arg-display-chip');
    if (!chip && coarse) { chip = document.createElement('div'); chip.id = 'arg-display-chip'; document.body.appendChild(chip); }
    if (chip) {
      chip.textContent = ARG_DISPLAY.w + '×' + ARG_DISPLAY.h + ' @' + ARG_DISPLAY.dpr + 'x · ' + (forced ? '横置锁定' : (portrait ? '竖屏' : '横屏'));
      chip.classList.remove('fade');
      clearTimeout(chip._fadeT);
      chip._fadeT = setTimeout(function () { chip.classList.add('fade'); }, 4200);
    }
    if (config.nodeId === 'node_prologue') {
      let val = document.getElementById('arg-display-meta-val');
      if (!val) {
        const row = document.querySelector('.cyber-meta-row');
        if (row) {
          const sp = document.createElement('span'); sp.id = 'arg-display-meta';
          sp.appendChild(document.createTextNode('DISPLAY: '));
          val = document.createElement('strong'); val.id = 'arg-display-meta-val';
          sp.appendChild(val); row.appendChild(sp);
        }
      }
      if (val) val.textContent = ARG_DISPLAY.w + '×' + ARG_DISPLAY.h + '@' + ARG_DISPLAY.dpr + 'x ' + (forced ? 'LAND-FORCED' : (portrait ? 'PORTRAIT' : 'LANDSCAPE'));
    }
  }
  function tryLock() {
    try {
      const so = window.screen && window.screen.orientation;
      if (so && typeof so.lock === 'function') { const pr = so.lock('landscape'); if (pr && pr.catch) pr.catch(function () {}); }
    } catch (e) {}
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', function () { setTimeout(measure, 120); setTimeout(measure, 620); });
  document.addEventListener('pointerdown', function once() { tryLock(); document.removeEventListener('pointerdown', once); });
  tryLock();
}

var CLOCK_START_KEY = 'arg_game_start';
function gameClockText() {
  var t0 = 0;
  try {
    t0 = parseInt(localStorage.getItem(CLOCK_START_KEY) || '0', 10);
    if (!t0) { t0 = Date.now(); localStorage.setItem(CLOCK_START_KEY, String(t0)); }
  } catch (e) { t0 = Date.now(); }
  var elapsedMin = Math.floor((Date.now() - t0) / 60000);
  return gameClockElapsed(elapsedMin);
}
function gameClockElapsed(elapsedMin) {
  var gameMin = 18 * 60 + Math.min(elapsedMin * 4, (23 * 60 + 30) - (18 * 60));
  var hh = Math.floor(gameMin / 60) % 24, mm = gameMin % 60;
  return (hh < 10 ? '0' + hh : '' + hh) + ':' + (mm < 10 ? '0' + mm : '' + mm);
}
window.ARG_CLOCK = { time: gameClockText };

function ensureGameClock() {
  if (window.__argClockOn) return; window.__argClockOn = true;
  function paint() {
    var txt = gameClockText();
    ['.tray-time', '.mac-time', '.cyber-clock', '.tray-status', '[data-arg-clock]'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.dataset.argClockLocked === '1') return;
        el.dataset.argClockLocked = '1';
        el.textContent = txt;
      });
    });
    document.querySelectorAll('[data-arg-clock-fill]').forEach(function (el) { el.textContent = txt; });
  }
  paint();
  setInterval(paint, 15000);
}

function ensureWindowManager() {
  var WIN_SEL = '.win-sticky-note,.dark-sticky-note,.mac-stickies';
  var wins = [].slice.call(document.querySelectorAll(WIN_SEL)).filter(function (w) {
    return (w.textContent || '').trim().length > 6;
  });
  if (!wins.length) return;
  var st = document.createElement('style'); st.id = 'arg-winman';
  st.textContent = [
    '.arg-win{position:absolute!important;margin:0!important;transition:box-shadow .12s;touch-action:none}',
    '.arg-win.arg-win-min{display:none!important}',
    '.arg-win.arg-win-max{width:calc(100% - 24px)!important;height:calc(100% - 24px)!important;top:12px!important;left:12px!important}',
    '.arg-win .arg-win-btns{position:absolute;top:4px;right:5px;display:flex;gap:3px;z-index:2}',
    '.arg-win .arg-win-btns button{width:18px;height:16px;line-height:13px;font:11px/1 "Tahoma","SimSun",sans-serif;border:1px solid rgba(0,0,0,.45);background:#d8d0c0;color:#222;cursor:pointer;padding:0;border-radius:1px}',
    '.arg-win .arg-win-btns button:hover{background:#efe8da}',
    '.arg-win.dragging{opacity:.94;box-shadow:0 18px 44px -12px rgba(0,0,0,.6)!important}',
    '.arg-win-focus{box-shadow:0 12px 34px -10px rgba(0,0,0,.5)!important}',
    '.arg-taskbtn{min-width:74px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;padding:2px 8px;border:1px solid rgba(0,0,0,.3);background:rgba(255,255,255,.72);color:#1f2937;border-radius:2px;cursor:pointer}',
    '.arg-taskbtn.active{background:#1d4ed8;color:#fff;border-color:#1e3a8a}',
    '.arg-taskbar-injected{display:flex;gap:4px;align-items:center;flex-wrap:wrap}',
    '@media (max-width:720px){.arg-win .arg-win-btns button{width:26px;height:22px}}'
  ].join(String.fromCharCode(10));
  document.head.appendChild(st);

  var topZ = 120;
  var host = document.querySelector('.desktop-main,.mac-main-area,.cyber-desktop,.dark-desktop,.win98-desktop,.winxp-desktop') || wins[0].parentElement || document.body;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  wins.forEach(function (w) {
    if (w.parentElement !== host) {
      var r0 = w.getBoundingClientRect(), hr0 = host.getBoundingClientRect();
      w.dataset.argInitX = String(Math.round(r0.left - hr0.left + (host.scrollLeft || 0)));
      w.dataset.argInitY = String(Math.round(r0.top - hr0.top + (host.scrollTop || 0)));
      host.appendChild(w);
    }
  });
  var taskHost = document.querySelector('.taskbar-tasks') || document.querySelector('.dark-taskbar') ||
    document.querySelector('.win98-taskbar') || document.querySelector('.winxp-taskbar') ||
    document.querySelector('.mac-menubar-right') || document.querySelector('.cyber-footer');
  if (taskHost && !taskHost.querySelector('.arg-taskbar-injected')) {
    var bar0 = document.createElement('div'); bar0.className = 'arg-taskbar-injected'; taskHost.appendChild(bar0);
  }
  wins.forEach(function (w, i) {
    var title = (w.querySelector('.note-titlebar') || w.querySelector('h3,h4,.note-title') || w).textContent.trim().slice(0, 14) || ('窗口 ' + (i + 1));
    w.classList.add('arg-win'); w.dataset.argWinTitle = title;
    var r = w.getBoundingClientRect(), hr = host.getBoundingClientRect();
    var initL = w.dataset.argInitX ? parseInt(w.dataset.argInitX, 10) : Math.max(0, r.left - hr.left + (host.scrollLeft || 0));
    var initT = w.dataset.argInitY ? parseInt(w.dataset.argInitY, 10) : Math.max(0, r.top - hr.top + (host.scrollTop || 0));
    w.style.left = initL + 'px'; w.style.top = initT + 'px';
    var bar = document.createElement('div'); bar.className = 'arg-win-btns';
    [['_', 'minimize', '最小化'], ['□', 'maximize', '最大化'], ['×', 'close', '关闭']].forEach(function (b) {
      var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = b[0]; btn.title = b[2]; btn.dataset.act = b[1];
      bar.appendChild(btn);
    });
    w.appendChild(bar);
    var tb = taskHost && taskHost.querySelector('.arg-taskbar-injected');
    if (tb) {
      var tbtn = document.createElement('button'); tbtn.type = 'button'; tbtn.className = 'arg-taskbtn'; tbtn.textContent = title;
      tbtn.addEventListener('click', function () {
        if (w.classList.contains('arg-win-min')) { w.classList.remove('arg-win-min'); focusWin(w); }
        else if (document.activeElement !== document.body && w.classList.contains('arg-win-focus')) { setMin(w, true); }
        else { focusWin(w); }
      });
      tb.appendChild(tbtn); w._taskBtn = tbtn;
    }
    bar.addEventListener('click', function (e) {
      var act = e.target && e.target.dataset ? e.target.dataset.act : '';
      if (!act) return;
      e.preventDefault(); e.stopPropagation();
      if (act === 'minimize') setMin(w, true);
      else if (act === 'maximize') w.classList.toggle('arg-win-max');
      else { setMin(w, true); }
      playSynthSound('click');
    });
    var drag = null;
    w.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.dataset && e.target.dataset.act) return;
      focusWin(w);
      drag = { x: e.clientX, y: e.clientY, l: parseFloat(w.style.left) || 0, t: parseFloat(w.style.top) || 0 };
      w.classList.add('dragging');
      try { w.setPointerCapture(e.pointerId); } catch (err) {}
    });
    w.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var nl = drag.l + (e.clientX - drag.x), nt = drag.t + (e.clientY - drag.y);
      var hostW = host.clientWidth || window.innerWidth, hostH = host.clientHeight || window.innerHeight;
      var maxL = hostW - w.offsetWidth - 4, maxT = hostH - 28;
      w.style.left = Math.min(Math.max(nl, -w.offsetWidth + 60), Math.max(maxL, 0)) + 'px';
      w.style.top = Math.min(Math.max(nt, 0), Math.max(maxT, 0)) + 'px';
    });
    function endDrag() { if (drag) { drag = null; w.classList.remove('dragging'); } }
    w.addEventListener('pointerup', endDrag);
    w.addEventListener('pointercancel', endDrag);
  });
  function setMin(w, on) {
    w.classList.toggle('arg-win-min', on);
    if (w._taskBtn) w._taskBtn.classList.toggle('active', !on);
    if (!on) focusWin(w);
  }
  function focusWin(w) {
    wins.forEach(function (x) { x.classList.remove('arg-win-focus'); if (x._taskBtn) x._taskBtn.classList.remove('active'); });
    w.classList.add('arg-win-focus'); w.style.zIndex = String(++topZ);
    if (w._taskBtn) w._taskBtn.classList.add('active');
  }
  focusWin(wins[0]);
}

function ensurePowerMenu() {
  var start = document.querySelector('.win-start-btn,.xp-start-btn,.dark-start-btn,.cyber-start,.mac-menubar-left');
  if (!start || start.dataset.argPower) return;
  start.dataset.argPower = '1';
  var st = document.createElement('style'); st.id = 'arg-power';
  st.textContent = [
    '#arg-power-menu{position:fixed;z-index:99995;min-width:168px;background:#ece9d8;border:2px outset #fff;box-shadow:4px 4px 12px rgba(0,0,0,.45);padding:4px;font-family:"Tahoma","SimSun",sans-serif;font-size:13px;color:#111}',
    '#arg-power-menu button{display:block;width:100%;text-align:left;background:transparent;border:0;padding:7px 12px;cursor:pointer;font:inherit;color:inherit}',
    '#arg-power-menu button:hover{background:#1d4ed8;color:#fff}',
    '#arg-power-off{position:fixed;inset:0;z-index:99999;background:#000;color:#3f6212;font:14px/1.9 "Courier New",monospace;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:24px}',
    '#arg-power-off .po-line{opacity:.85}',
    '#arg-power-off .po-cursor{display:inline-block;width:9px;height:16px;background:#3f6212;animation:arg-blink 1s steps(2) infinite;vertical-align:-2px}',
    '@keyframes arg-blink{0%,50%{opacity:1}51%,100%{opacity:0}}',
    'body.arg-sleep{filter:brightness(.12) saturate(.4);transition:filter .5s;pointer-events:none}'
  ].join(String.fromCharCode(10));
  document.head.appendChild(st);
  function menu() {
    var old = document.getElementById('arg-power-menu');
    if (old) { old.remove(); return null; }
    var m = document.createElement('div'); m.id = 'arg-power-menu';
    var r = start.getBoundingClientRect();
    m.style.left = Math.max(6, r.left) + 'px';
    m.style.top = Math.max(6, r.top - 132) + 'px';
    [['待机（睡眠）', 'sleep'], ['重新启动', 'reboot'], ['关机', 'off']].forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = o[0];
      b.addEventListener('click', function () { m.remove(); act(o[1]); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    setTimeout(function () { document.addEventListener('pointerdown', function close(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', close); } }); }, 0);
    return m;
  }
  function act(kind) {
    if (kind === 'sleep') { document.body.classList.add('arg-sleep'); setTimeout(function () { document.body.classList.remove('arg-sleep'); }, 2200); return; }
    var ov = document.createElement('div'); ov.id = 'arg-power-off';
    var lines = kind === 'reboot'
      ? ['ACPI: 正在终止进程…', '潮声站备份守护进程：已停止', '系统即将重新启动。', '', 'BOOT SELF-TEST / 开机自检']
      : ['电源已切断。', '', '这台机器停在了 2003 年的某个夜里。', '想再听一次，就得自己按下去。', ''];
    lines.forEach(function (t) { var d = document.createElement('div'); d.className = 'po-line'; d.textContent = t; ov.appendChild(d); });
    var cur = document.createElement('span'); cur.className = 'po-cursor'; ov.appendChild(cur);
    var go = document.createElement('a');
    go.href = (config.files && config.files.node_prologue) ? config.files.node_prologue : 'index.html';
    go.textContent = kind === 'reboot' ? '› 重新启动' : '› 重新通电';
    go.style.cssText = 'margin-top:18px;color:#65a30d;text-decoration:underline;cursor:pointer';
    ov.appendChild(go);
    document.body.appendChild(ov);
    try { if (window.screen && window.screen.orientation && window.screen.orientation.unlock) window.screen.orientation.unlock(); } catch (e) {}
  }
  start.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); playSynthSound('click'); menu(); });
}

function ensureTrayTexture() {
  if (document.getElementById('arg-noise')) return;
  var st = document.createElement('style'); st.id = 'arg-tray';
  st.textContent = [
    '.arg-tray-ind{display:inline-flex;gap:8px;align-items:center;font-size:11px;opacity:.85;margin-right:8px;letter-spacing:.4px}',
    '.arg-tray-ind span{white-space:nowrap}',
    '#arg-noise{position:fixed;inset:0;z-index:99970;pointer-events:none;opacity:.045;background-repeat:repeat;background-size:180px 180px}',
    '.arg-ink{position:fixed;border-radius:52% 48% 61% 39%/47% 55% 45% 53%;pointer-events:none;z-index:99969;filter:blur(.4px)}',
    'body.arg-wall-1{background-image:radial-gradient(1100px 520px at 78% -8%,rgba(30,64,120,.28),transparent)}',
    'body.arg-wall-2{background-image:radial-gradient(900px 480px at 12% 108%,rgba(13,80,74,.26),transparent)}',
    'body.arg-wall-3{background-image:radial-gradient(760px 760px at 92% 88%,rgba(88,28,28,.2),transparent)}'
  ].join(String.fromCharCode(10));
  document.head.appendChild(st);
  var nz = document.createElement('div'); nz.id = 'arg-noise';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="180" height="180" filter="url(#n)" opacity="0.55"/></svg>';
  nz.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  document.body.appendChild(nz);
  var ink = 2 + Math.floor(Math.random() * 3);
  for (var i = 0; i < ink; i++) {
    var d = document.createElement('div'); d.className = 'arg-ink';
    var s = 26 + Math.random() * 62;
    d.style.width = s + 'px'; d.style.height = s * (0.6 + Math.random() * 0.5) + 'px';
    d.style.left = (Math.random() * 90) + 'vw'; d.style.top = (Math.random() * 92) + 'vh';
    d.style.background = 'rgba(20,24,30,' + (0.02 + Math.random() * 0.05).toFixed(3) + ')';
    document.body.appendChild(d);
  }
  var wall = 'arg-wall-' + (1 + Math.floor(Math.random() * 3));
  document.body.classList.add(wall);
  var desk = document.querySelector('.winxp-desktop,.win98-desktop,.macos-desktop,.cyber-desktop,.dark-desktop,.desktop-main');
  if (desk) {
    desk.style.backgroundImage = 'linear-gradient(rgba(9,14,26,.20),rgba(9,14,26,.36)),url("wall-bluebay.jpg")';
    desk.style.backgroundSize = 'cover'; desk.style.backgroundPosition = 'center';
  }
  var tray = document.querySelector('.win-tray,.winxp-tray,.dark-tray,.mac-menubar-right,.cyber-footer');
  if (tray && !tray.querySelector('.arg-tray-ind')) {
    var ind = document.createElement('span'); ind.className = 'arg-tray-ind';
    var vol = 55 + Math.floor(Math.random() * 30), bat = 40 + Math.floor(Math.random() * 55);
    ind.innerHTML = '<span>▂▄▆</span><span>♪ ' + vol + '%</span><span> batt ' + bat + '%</span>';
    tray.insertBefore(ind, tray.firstChild);
  }
}


/* ---- forum.mjs ---- */
// src/runtime/forum.mjs — 帖子级密码锁、论坛生态、联网回退检索






function fbEsc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

function ensurePostLock() {
  if (!config.postPassword) return;
  let unlocked = false;
  try {
    unlocked = config.unlockClue ? hasClue(config.unlockClue) : localStorage.getItem('arg_post_open_' + config.nodeId) === '1';
  } catch (e) {}
  if (unlocked) { document.body.classList.add('arg-post-open'); return; }
  if (document.getElementById('arg-postlock')) return;
  const st = document.createElement('style'); st.id = 'arg-postlock-style';
  st.textContent = [
    '#arg-postlock{position:fixed;right:14px;bottom:44px;z-index:99988;max-width:290px;background:#fffdf6;border:1px solid #d8d2c0;border-left:4px solid #b45309;border-radius:10px;box-shadow:0 18px 44px -16px rgba(80,50,10,.4);padding:12px 14px;font-size:12.5px;color:#44403c}',
    '#arg-postlock .pl-title{font-weight:700;letter-spacing:.5px;margin-bottom:4px}',
    '#arg-postlock .pl-sub{font-size:11px;color:#78716c;margin-bottom:8px}',
    '#arg-postlock .pl-row{display:flex;gap:6px}',
    '#arg-postlock input{flex:1;min-width:0;border:1px solid #c9c2ae;border-radius:6px;padding:6px 8px;font-size:13px}',
    '#arg-postlock button{border:1px solid #b45309;background:#b45309;color:#fff;border-radius:6px;padding:6px 12px;cursor:pointer}',
    '#arg-postlock button:hover{background:#92400e}',
    '#arg-postlock .pl-err{color:#b91c1c;font-size:11px;margin-top:6px;min-height:14px}',
    '#arg-postlock.shake{animation:arg-pl-shake .4s}',
    '@keyframes arg-pl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}',
    '.arg-post-open .arg-redacted{color:inherit!important;background:linear-gradient(transparent 62%,rgba(250,204,21,.4) 0)!important;cursor:auto}',
    '.arg-post-open #arg-postlock{display:none}',
    '@media (max-width:720px){#arg-postlock{left:10px;right:10px;max-width:none;bottom:52px}}'
  ].join(String.fromCharCode(10));
  document.head.appendChild(st);
  const panel = document.createElement('div'); panel.id = 'arg-postlock';
  const lockName = config.lockType || '版务';
  const title = document.createElement('div'); title.className = 'pl-title';
  title.textContent = '🔒 本帖已由【' + lockName + '】加密';
  const sub = document.createElement('div'); sub.className = 'pl-sub';
  sub.textContent = lockName === '本人' ? '楼主本人加密。口令只有他和收信的人知道。'
    : lockName === '系统' ? '系统归档加密。此会话须凭调阅编号开启。'
    : '版务操作记录：此层含违规内容，输口令调阅。';
  const row = document.createElement('div'); row.className = 'pl-row';
  const input = document.createElement('input'); input.placeholder = '输入口令…'; input.setAttribute('autocomplete', 'off');
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = '解锁';
  const err = document.createElement('div'); err.className = 'pl-err';
  row.appendChild(input); row.appendChild(btn);
  panel.appendChild(title); panel.appendChild(sub); panel.appendChild(row); panel.appendChild(err);
  document.body.appendChild(panel);
  function attempt() {
    const v = String(input.value || '').trim().toLowerCase();
    const ok = String(config.postPassword || '').split(/[,，;|]+/).map((s) => s.trim().toLowerCase()).filter(Boolean).indexOf(v) !== -1;
    if (!ok) { err.textContent = '口令不对。'; panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake'); playSynthSound('error'); return; }
    try { if (config.unlockClue) triggerClue(config.unlockClue); else localStorage.setItem('arg_post_open_' + config.nodeId, '1'); } catch (e) {}
    document.body.classList.add('arg-post-open');
    panel.remove();
    playSynthSound('notify');
    pushNotify((config.realAuthor ? '锁着的楼层显形了。真实发帖人：' + config.realAuthor + '。' : '锁着的楼层显形了。'), '');
  }
  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); attempt(); } });
}

function ensureForumLife() {
  const box = document.querySelector('.bbs-container');
  if (!box || document.getElementById('arg-forum-life')) return;
  const st = document.createElement('style'); st.id = 'arg-forum-life-style';
  st.textContent = [
    '.arg-forum-banner{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#f0ede4;border:1px dashed #c9bfa5;border-radius:8px;padding:7px 12px;font-size:11.5px;color:#6b6252;margin-bottom:10px}',
    '.arg-forum-banner .g{color:#a8a29e}',
    '.arg-forum-banner a{color:#0f766e;cursor:pointer;text-decoration:underline}',
    '.arg-online{font-size:11px;color:#94a3b8;letter-spacing:.4px}'
  ].join(String.fromCharCode(10));
  document.head.appendChild(st);
  const banner = document.createElement('div'); banner.className = 'arg-forum-banner'; banner.id = 'arg-forum-life';
  const left = document.createElement('span');
  left.innerHTML = '当前身份：<b>游客</b> · 【听潮会·内圈】板块不可见　<span class="g">（已有权限？从「绝密专题」进入）</span>';
  const deep = document.createElement('a'); deep.textContent = '→ 绝密专题'; deep.dataset.argLink = 'node_login_hard';
  left.appendChild(deep);
  const online = document.createElement('span'); online.className = 'arg-online';
  banner.appendChild(left); banner.appendChild(online);
  box.insertBefore(banner, box.firstChild);
  let n = 980 + Math.floor(Math.random() * 90);
  function paint() { online.textContent = '在线 ' + n.toLocaleString() + ' 人 · 今天是' + gameClockText() + '，还没有人下线'; }
  paint();
  setInterval(function () { n = Math.max(900, n + Math.floor(Math.random() * 15) - 7); paint(); }, 26000);
  var linkBox = document.querySelector('.bbs-links-container');
  if (linkBox && !document.getElementById('arg-sealed') && config.nodeId === 'node_forum') {
    var sealedBox = document.createElement('div'); sealedBox.id = 'arg-sealed';
    sealedBox.style.cssText = 'margin:8px 0 2px;padding:8px 10px;border:1px dashed #cbbfa2;border-radius:8px;background:#f4efe0';
    var cap = document.createElement('div'); cap.style.cssText = 'font-size:11px;color:#8a7f63;letter-spacing:1px;margin-bottom:6px';
    cap.textContent = '—— 以下帖子已被版主或系统封存 ——';
    sealedBox.appendChild(cap);
    [['▇▇▇ 的最后一夜', '引渡', '4 年前 · 回复 ***'],
     ['听潮会 内圈 报名帖', '***', '3 年前 · 回复 ***'],
     ['03:14 打卡（长期更新）', '***', '最近回复：昨天 03:14']].forEach(function (p) {
      var d = document.createElement('div'); d.className = 'arg-sealed-row';
      d.innerHTML = '<span class="arg-sealed-lock">🔒</span><span class="arg-sealed-title"></span><span class="arg-sealed-meta"></span>';
      d.querySelector('.arg-sealed-title').textContent = p[0];
      d.querySelector('.arg-sealed-meta').textContent = '作者 ' + p[1] + ' · ' + p[2];
      sealedBox.appendChild(d);
    });
    var st2 = document.createElement('style');
    st2.textContent = '.arg-sealed-row{display:flex;align-items:center;gap:8px;padding:5px 2px;color:#a89f88;font-size:12.5px;border-top:1px dotted #ddd3b8;cursor:not-allowed}.arg-sealed-row:first-of-type{border-top:0}.arg-sealed-lock{opacity:.6}.arg-sealed-title{flex:1;text-decoration:line-through;overflow-wrap:anywhere}.arg-sealed-meta{font-size:10.5px;opacity:.8}';
    document.head.appendChild(st2);
    linkBox.appendChild(sealedBox);
  }
  function check() {
    if (getClues().some(function (id) { return id.indexOf('ns_') === 0; }) || hasClue('clue_shadow_949')) {
      left.innerHTML = '当前身份：<b>已验证</b> · 欢迎回来，知微。夜航的记录你都看过了。';
      clearInterval(timer);
    }
  }
  const timer = setInterval(check, 4000);
  check();
}

function ensureFbStyle() {
  if (document.getElementById('arg-fb-style')) return;
  const st = document.createElement('style'); st.id = 'arg-fb-style';
  st.textContent = '.arg-ir{background:#ffffff!important;border:1px solid #dbe4f0!important;border-radius:14px!important;padding:20px 24px!important;margin-top:18px!important;box-shadow:0 8px 24px rgba(20,40,80,.08)!important;color:#1f2937!important;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif!important}.arg-ir .fb-head{font-weight:700;font-size:15px;color:#0f172a;margin-bottom:12px}.arg-ir .fb-count{color:#6b7280;font-size:12.5px;margin-bottom:16px}.arg-ir .fb-item{margin-bottom:22px}.arg-ir .fb-item .t{color:#1a58d8;font-size:18px;cursor:pointer;line-height:1.4}.arg-ir .fb-item .t:hover{text-decoration:underline}.arg-ir .fb-item .u{color:#16803d;font-size:12.5px;margin:2px 0;word-break:break-all}.arg-ir .fb-item .s{color:#4b5563;font-size:14px;line-height:1.7}.arg-ir .fb-ext{margin:24px 0 6px;padding:14px 16px;background:#f0f6ff!important;border:1px solid #dbe7ff!important;border-radius:10px!important;font-size:14px;line-height:2;color:#33507a!important}.arg-ir .fb-ext a{color:#1a58d8;font-weight:600;text-decoration:none;margin-right:14px}.arg-ir .fb-ext a:hover{text-decoration:underline}.arg-ir .fb-none{color:#6b7280;font-size:14.5px;margin-bottom:18px}.arg-ir .fb-clear{display:inline-block;margin-top:6px;cursor:pointer;color:#1a58d8;font-size:13px;text-decoration:underline}.arg-ir .fb-real{margin:20px 0 8px;padding-top:10px;border-top:1px dashed #e2e8f0}.arg-ir .fb-item .t a{color:#1a58d8;text-decoration:none}.arg-ir .fb-item .t a:hover{text-decoration:underline}';
  document.head.appendChild(st);
}

function fallbackSearch(text) {
  ensureFbStyle();
  let host = document.querySelector('[data-arg-result]');
  let res;
  if (host) { host.innerHTML = ''; res = document.createElement('div'); res.className = 'arg-ir'; host.appendChild(res); }
  else {
    res = document.createElement('div'); res.className = 'arg-ir';
    res.style.position = 'fixed'; res.style.inset = '24px'; res.style.overflow = 'auto'; res.style.zIndex = '100000';
    document.body.appendChild(res);
  }
  res.textContent = '正在检索全网 ……';
  let tries = 0;
  function render(idx) {
    const q = String(text || '').toLowerCase();
    const terms = q.split(/[\s]+/).filter(Boolean);
    const scored = idx.map(function (it) {
      const hay = (it.t + ' ' + it.s).toLowerCase(); let sc = 0;
      terms.forEach(function (t) { const c = hay.split(t).length - 1; if (c > 0) sc += c + (it.t.toLowerCase().indexOf(t) !== -1 ? 5 : 0); });
      return { it: it, sc: sc };
    }).filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 6);
    res.innerHTML = '';
    const head = document.createElement('div'); head.className = 'fb-head';
    head.textContent = '联网结果 · ' + text;
    res.appendChild(head);
    const count = document.createElement('div'); count.className = 'fb-count';
    count.textContent = '约 ' + (scored.length * 173 + 21) + ' 条结果（用时 0.' + (terms.length * 17 + 3) + ' 秒）· 检索范围：蓝湾档案库 + 外部引擎';
    res.appendChild(count);
    if (!scored.length) {
      const cands = idx.map(function (it) {
        const t = (it.t + ' ' + it.s).toLowerCase(); let best = 0;
        for (let a = 0; a < q.length; a++) for (let len = 3; a + len <= q.length; len++) {
          const seg = q.substr(a, len);
          if (t.indexOf(seg) !== -1) best = Math.max(best, len);
        }
        return { it: it, best: best };
      }).filter(function (x) { return x.best >= 3; }).sort(function (a, b) { return b.best - a.best; }).slice(0, 5);
      const none = document.createElement('div'); none.className = 'fb-none';
      none.textContent = '站内没有找到与「' + text + '」直接相关的档案。';
      res.appendChild(none);
      if (cands.length) {
        const sug = document.createElement('div'); sug.className = 'fb-none';
        sug.innerHTML = '您是不是要找：';
        cands.forEach(function (x, i) {
          const s = document.createElement('span'); s.className = 'fb-clear'; s.textContent = maskText(x.it.t);
          s.addEventListener('click', function () { playSynthSound('click'); fallbackSearch(x.it.t); });
          sug.appendChild(s);
          if (i < cands.length - 1) sug.appendChild(document.createTextNode('　·　'));
        });
        res.appendChild(sug);
      }
    }
    scored.forEach(function (x) {
      const item = document.createElement('div'); item.className = 'fb-item';
      const t = document.createElement('div'); t.className = 't'; t.textContent = maskText(x.it.t) + ' _ 蓝湾档案';
      t.addEventListener('click', function () { playSynthSound('click'); go(x.it.id); });
      const u = document.createElement('div'); u.className = 'u'; u.textContent = 'https://lanwan.archive.fm99.4/' + x.it.u;
      const s = document.createElement('div'); s.className = 's'; s.textContent = maskText(x.it.s);
      item.appendChild(t); item.appendChild(u); item.appendChild(s);
      res.appendChild(item);
    });
    if (!isShadow() && scored.some(function (x) { return ['白噪计划', '第九夜', '六十六', '听潮会', '随船', '失踪名单'].some(function (w) { return (x.it.t + x.it.s).indexOf(w) !== -1; }); })) {
      const warn = document.createElement('div'); warn.className = 'fb-count';
      warn.textContent = '※ 部分字样已按 1999 年《沿海广播临时管理办法》予以遮蔽。';
      res.appendChild(warn);
    }
    const real = document.createElement('div'); real.className = 'fb-real';
    real.innerHTML = '<div class="fb-head">🌐 外部检索 · 维基百科（实时）</div><div class="fb-count">正在外部检索「' + fbEsc(text) + '」……</div>';
    res.appendChild(real);
    fetch('https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(text) + '&format=json&origin=*&srlimit=4')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        const hits = (j.query && j.query.search) || [];
        real.innerHTML = '<div class="fb-head">🌐 外部检索 · 维基百科（实时）</div>';
        if (!hits.length) { const d = document.createElement('div'); d.className = 'fb-none'; d.textContent = '外部检索暂时没有直接相关的内容。'; real.appendChild(d); return; }
        hits.forEach(function (h) {
          const item = document.createElement('div'); item.className = 'fb-item';
          const t = document.createElement('div'); t.className = 't';
          const a = document.createElement('a'); a.href = 'https://zh.wikipedia.org/wiki/' + encodeURIComponent(h.title); a.target = '_blank'; a.rel = 'noopener'; a.textContent = h.title + ' _ 维基百科 ↗';
          t.appendChild(a);
          const u = document.createElement('div'); u.className = 'u'; u.textContent = 'zh.wikipedia.org/wiki/' + h.title;
          const s = document.createElement('div'); s.className = 's'; s.textContent = String(h.snippet || '').replace(/<[^>]+>/g, '');
          item.appendChild(t); item.appendChild(u); item.appendChild(s);
          real.appendChild(item);
        });
      })
      .catch(function () { real.innerHTML = '<div class="fb-none">（外部检索暂不可用。可用下方链接在新窗口搜索。）</div>'; });
    const ext = document.createElement('div'); ext.className = 'fb-ext';
    ext.innerHTML = '继续在外部搜索引擎查证「' + fbEsc(text) + '」：<br>';
    const a1 = document.createElement('a'); a1.href = 'https://www.bing.com/search?q=' + encodeURIComponent(text); a1.target = '_blank'; a1.rel = 'noopener'; a1.textContent = '用必应搜索 ↗';
    const a2 = document.createElement('a'); a2.href = 'https://www.baidu.com/s?wd=' + encodeURIComponent(text); a2.target = '_blank'; a2.rel = 'noopener'; a2.textContent = '用百度搜索 ↗';
    const note = document.createElement('div'); note.className = 'fb-count'; note.textContent = '（外部检索 · 不影响游戏进度）';
    ext.appendChild(a1); ext.appendChild(a2); ext.appendChild(note);
    res.appendChild(ext);
    const clear = document.createElement('span'); clear.className = 'fb-clear'; clear.textContent = '清除结果';
    clear.addEventListener('click', function () { res.innerHTML = ''; result(config.notFoundText || ''); });
    res.appendChild(document.createElement('br')); res.appendChild(clear);
  }
  function load() {
    tries++;
    if (window.ARG_SEARCH_INDEX) return render(window.ARG_SEARCH_INDEX);
    const s = document.createElement('script'); s.src = 'arg-search-index.js?r=' + tries;
    s.onload = function () { render(window.ARG_SEARCH_INDEX || []); };
    s.onerror = function () { if (tries < 3) setTimeout(load, 3000); else render([]); };
    document.head.appendChild(s);
  }
  load();
}


/* ---- router.mjs ---- */
// src/runtime/router.mjs — 核心路由：go / checkRule / checkLink / bindSearch / bindLogin






const go = (target) => {
  if (!target) return;
  playSynthSound('click');
  const key = String(target).trim();
  const next = (config.files && config.files[key]) ? config.files[key] : ((config.files && config.files[target]) ? config.files[target] : key);
  if (config.preview && (window.parent !== window || window.top !== window)) {
    window.parent.postMessage({ type: 'arg-route', target: key }, '*');
  } else {
    window.location.href = next.endsWith('.html') ? next : next + '.html';
  }
};

const checkRule = (kind, value) => {
  const key = String(value || '').trim().toLowerCase();
  if (config.isSearch && kind === 'search' && config.shadowKey && !isShadow() && normShadow(key) === normShadow(config.shadowKey)) {
    if (config.shadowClue) triggerClue(config.shadowClue);
    try { localStorage.setItem('arg_shadow_949', '1'); } catch (e) {}
    applyShadowSkin(true);
    playSynthSound('notify');
    result('✔ 权限已切换：档案员检索（94.9）。有些结果，刚才是不给你看的。');
    return;
  }
  if (config.isSearch && kind === 'search' && isShadow()) {
    const st = (config.shadowRules || {})[key];
    if (st) { playSynthSound('click'); go(st); return; }
  }
  const target = (config.rules[kind] || {})[key];
  if (target) {
    playSynthSound('click');
    go(target);
  } else if (config.isSearch && kind === 'search' && key) {
    playSynthSound('click');
    fallbackSearch(String(value || '').trim());
  } else {
    playSynthSound('error');
    result(config.notFoundText || '没有找到相关结果');
  }
};

const checkLink = (port) => {
  if (!port) return;
  playSynthSound('click');
  const raw = String(port).trim();
  const target = (config.links || {})[raw] || (config.links || {})[port] || ((config.files && config.files[raw]) ? raw : ((config.files && config.files[port]) ? port : null)) || raw;
  go(target);
};

function bindSearch(form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const input = form.querySelector('[data-arg-input="keyword"]') || form.querySelector('input[type="text"]') || form.querySelector('input');
    checkRule('search', input ? input.value : '');
  });
}

function bindLogin(form) {
  const input = form.querySelector('[data-arg-input="password"]') || form.querySelector('input[type="password"]') || form.querySelector('input');
  const error = form.querySelector('[data-arg-error]') || form.querySelector('#error');
  const submitBtn = form.querySelector('[data-arg-submit], button[type="submit"], button');

  function recordUnlock() {
    try {
      const list = JSON.parse(localStorage.getItem('arg_unlocked_locks') || '[]');
      if (config.nodeId && !list.includes(config.nodeId)) { list.push(config.nodeId); localStorage.setItem('arg_unlocked_locks', JSON.stringify(list)); }
    } catch (e) {}
  }

  function doLogin() {
    const val = (input ? input.value : '').trim().toLowerCase();
    const target = config.loginTarget || Object.values(config.links || {})[0] || '';
    if (passwordOk(config.password, val)) {
      playSynthSound('unlock');
      recordUnlock();
      if (config.unlockClue) triggerClue(config.unlockClue);
      if (error) { error.style.color = '#10b981'; error.textContent = '✓ 密码验证成功，正在解密载入...'; }
      setTimeout(() => { if (target) go(target); }, 80);
    } else {
      playSynthSound('error');
      if (error) { error.style.color = '#ef4444'; error.textContent = config.errorMessage || '❌ 密码错误，请重新输入！'; }
      if (input) { input.value = ''; input.focus(); }
    }
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); e.stopPropagation(); doLogin(); return false; });
  if (submitBtn) submitBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); doLogin(); });
  if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doLogin(); } });
}


/* ---- notify.mjs ---- */
// src/runtime/notify.mjs — 跨页未读通知（localStorage + storage 事件总线）



var NOTIFY_KEY = 'arg_notify_v1', NOTIFY_SEEN_KEY = 'arg_notify_seen';
function pushNotify(text, target) {
  if (!text) return;
  try {
    localStorage.setItem(NOTIFY_KEY, JSON.stringify({ text: text, target: target || '', ts: Date.now(), from: (typeof config !== 'undefined' && config.nodeId) ? config.nodeId : '' }));
    showNotify({ text: text, target: target });
  } catch (e) {}
}
function showNotify(payload) {
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
function ensureNotifyRelay() {
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


/* ---- chat.mjs ---- */
// src/runtime/chat.mjs — 加密聊天：联系人/动态对话/存档/答案校验/行动条





function isImg(src) {
  if (typeof src !== 'string') return false;
  const s = src.split('?')[0].toLowerCase();
  return s.startsWith('data:image/') || s.startsWith('blob:') || s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.gif') || s.endsWith('.webp') || s.endsWith('.svg') || s.endsWith('.ico');
}
function renderAvatar(src, fallback) {
  if (!src) return fallback || '👤';
  if (isImg(src)) return '<img src="' + escapeHtml(src) + '" class="avatar-img" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="avatar">';
  return escapeHtml(src);
}

function bindChat(container) {
  const contacts = config.contacts || [];
  let currentIdx = 0;
  const contactsList = container.querySelector('#contactsList');
  const nameEl = container.querySelector('#currentContactName');
  const bioEl = container.querySelector('#currentContactBio');
  const messagesEl = container.querySelector('#chatMessages');
  const choicesEl = container.querySelector('#chatChoicesArea');
  const form = container.querySelector('#chatForm');
  const input = container.querySelector('#chatInput');

  const CHAT_LOG_KEY = 'arg_chat_log_v1';
  function readChatLog() { try { return JSON.parse(localStorage.getItem(CHAT_LOG_KEY) || '{}'); } catch (e) { return {}; } }
  function logMsg(cid, sender, text) {
    if (!cid) return;
    try {
      const l = readChatLog(); l[cid] = l[cid] || [];
      l[cid].push({ s: sender, t: text });
      if (l[cid].length > 300) l[cid] = l[cid].slice(-300);
      localStorage.setItem(CHAT_LOG_KEY, JSON.stringify(l));
    } catch (e) {}
  }
  function ensureChatStyle() {
    if (document.getElementById('arg-chat-style')) return;
    const st = document.createElement('style'); st.id = 'arg-chat-style';
    st.textContent = [
      '.msg-action{text-align:center;font-size:11px;color:#94a3b8;font-style:italic;margin:8px 0;opacity:.85}',
      '.msg-lost{display:flex;gap:8px;align-items:center;margin:8px 0;font-size:12px}',
      '.msg-lost .lost-tag{color:#f87171;border:1px dashed rgba(248,113,113,.6);border-radius:4px;padding:2px 8px;letter-spacing:1px;flex:0 0 auto}',
      '.msg-lost .lost-txt{color:#6b7280;text-decoration:line-through;opacity:.75;word-break:break-all}',
      '.msg-auto .msg-bubble{opacity:.82;border-style:dashed!important}',
      '.msg-auto .auto-tag{display:block;font-size:10px;letter-spacing:1px;color:#a1a1aa;margin-bottom:2px}',
      '.msg-waiting{text-align:center;font-size:11.5px;color:#94a3b8;margin:10px 0;letter-spacing:.6px}',
      '.msg-call{text-align:center;font-size:11.5px;color:#fbbf24;margin:10px 0;opacity:.9}',
      '.arg-typing{display:inline-flex;gap:4px;align-items:center;padding:10px 14px;border-radius:14px;background:rgba(127,127,127,.16)}',
      '.arg-typing i{width:6px;height:6px;border-radius:50%;background:#9ca3af;display:inline-block;animation:arg-dot 1.05s infinite}',
      '.arg-typing i:nth-child(2){animation-delay:.16s}.arg-typing i:nth-child(3){animation-delay:.32s}',
      '@keyframes arg-dot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}',
      '.msg-ts{font-size:9.5px;opacity:.45;margin:0 46px 6px;letter-spacing:.5px}',
      '.arg-send-armed{animation:arg-armed 1.1s ease-in-out infinite!important}',
      '@keyframes arg-armed{0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,.5)}50%{box-shadow:0 0 0 6px rgba(250,204,21,0)}}',
      '.arg-scripted-hint{font-size:10.5px;color:#94a3b8;text-align:center;width:100%;margin-top:-2px}'
    ].join(String.fromCharCode(10));
    document.head.appendChild(st);
  }
  ensureChatStyle();

  function stampRow() {
    if (!messagesEl) return null;
    const d = document.createElement('div');
    d.className = 'msg-ts';
    try { d.textContent = '  ' + gameClockText(); } catch (e) { d.textContent = '  '; }
    d.style.textAlign = 'right';
    messagesEl.appendChild(d);
    return d;
  }
  function npcSay(text, contact, cb) {
    if (!messagesEl) { if (cb) cb(); return; }
    const row = document.createElement('div');
    row.className = 'msg-row msg-npc received';
    const av = document.createElement('div'); av.className = 'msg-avatar'; av.innerHTML = renderAvatar(contact && contact.avatar, '🤖');
    const bub = document.createElement('div'); bub.className = 'arg-typing';
    bub.innerHTML = '<i></i><i></i><i></i>';
    row.appendChild(av); row.appendChild(bub);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    const wait = 620 + Math.min(1500, String(text || '').length * 26);
    setTimeout(function () {
      row.remove();
      appendMessage('npc', text, contact && contact.avatar);
      stampRow();
      if (contact && contact.id) logMsg(contact.id, 'npc', text);
      if (cb) cb();
    }, wait);
  }
  function renderMessage(m, contact) {
    const type = m.type || '';
    if (!messagesEl) return;
    if (type === 'lost') {
      const row = document.createElement('div'); row.className = 'msg-lost';
      const tag = document.createElement('span'); tag.className = 'lost-tag'; tag.textContent = '[数据丢失]';
      const txt = document.createElement('span'); txt.className = 'lost-txt'; txt.textContent = m.text || '▇▇▇▇▇▇▇▇▇';
      row.appendChild(tag); row.appendChild(txt); messagesEl.appendChild(row);
    } else if (type === 'auto') {
      const row = document.createElement('div'); row.className = 'msg-row msg-npc received msg-auto';
      const av = document.createElement('div'); av.className = 'msg-avatar'; av.innerHTML = renderAvatar(contact && contact.avatar, '🤖');
      const bub = document.createElement('div'); bub.className = 'msg-bubble';
      const lab = document.createElement('span'); lab.className = 'auto-tag'; lab.textContent = '[自动回复]';
      bub.appendChild(lab); bub.appendChild(document.createTextNode(m.text || ''));
      row.appendChild(av); row.appendChild(bub); messagesEl.appendChild(row);
    } else if (type === 'waiting' || type === 'noreply') {
      const d = document.createElement('div'); d.className = 'msg-waiting';
      d.textContent = type === 'waiting' ? '（等待回复…）' : '（无回复）';
      messagesEl.appendChild(d);
    } else if (type === 'call') {
      const d = document.createElement('div'); d.className = 'msg-call';
      d.textContent = '📞 ' + (m.text || '语音通话 · 未接通');
      messagesEl.appendChild(d);
    } else if (type === 'divider') {
      const d = document.createElement('div'); d.className = 'msg-time-divider';
      d.textContent = '—— ' + (m.text || '·') + ' ——';
      messagesEl.appendChild(d);
    } else if (type === 'action') {
      appendAction(m.text, true);
    } else {
      appendMessage(m.sender, m.text, contact && contact.avatar);
    }
  }
  function appendAction(text) {
    if (!messagesEl) return;
    const d = document.createElement('div');
    d.className = 'msg-action';
    d.textContent = '—— ' + text + ' ——';
    messagesEl.appendChild(d);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  if (!contacts.length) {
    if (contactsList) contactsList.innerHTML = '<div style="padding:16px 10px;text-align:center;color:var(--text-muted, #888);font-size:12px;">暂无联系人</div>';
    if (messagesEl) messagesEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted, #888);font-size:13px;">暂无对话内容</div>';
    return;
  }

  function renderContacts() {
    if (!contactsList) return;
    contactsList.innerHTML = '';
    contacts.forEach((c, idx) => {
      const item = document.createElement('div');
      item.className = 'contact-item' + (idx === currentIdx ? ' active' : '');
      item.innerHTML = '<div class="contact-avatar">' + renderAvatar(c.avatar, '👤') + '</div>' +
        '<div class="contact-meta"><div class="contact-name">' + escapeHtml(c.name || '联系人') + '</div>' +
        '<div class="contact-bio">' + escapeHtml(c.bio || '') + '</div></div>';
      item.addEventListener('click', () => {
        playSynthSound('click');
        currentIdx = idx;
        renderContacts();
        loadChat(contacts[idx]);
      });
      contactsList.appendChild(item);
    });
  }

  function appendMessage(sender, text, avatar) {
    if (!messagesEl) return;
    const isUser = sender === 'user' || sender === 'player';
    const row = document.createElement('div');
    row.className = 'msg-row ' + (isUser ? 'msg-user sent' : 'msg-npc received');
    const avDiv = document.createElement('div');
    avDiv.className = 'msg-avatar';
    avDiv.innerHTML = isUser ? '👤' : renderAvatar(avatar, '🤖');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    if (!isUser) playSynthSound('notify');
    if (isUser) { row.appendChild(bubble); row.appendChild(avDiv); }
    else { row.appendChild(avDiv); row.appendChild(bubble); }
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderChoices(choices, contact) {
    if (!choicesEl) return;
    choicesEl.innerHTML = '';
    if (!choices || !choices.length) return;
    const unlockedChoices = choices.filter(choice => hasClue(choice.requires || choice.req));
    if (unlockedChoices.length === 0) {
      const hint = document.createElement('div');
      hint.style.cssText = 'padding: 8px 14px; font-size: 11.5px; color: #94a3b8; font-style: italic; text-align: center; width: 100%;';
      hint.textContent = '（暂无可提交的调查物证。请先在电脑桌面、灵异论坛与全网搜索引擎中搜集线索...）';
      choicesEl.appendChild(hint);
      return;
    }
    unlockedChoices.forEach(choice => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'choice-btn'; btn.textContent = choice.text;
      btn.addEventListener('click', () => { playSynthSound('click'); armChoice(choice, contact); });
      choicesEl.appendChild(btn);
    });
  }

  var pendingChoice = null;
  function disarmSend() {
    pendingChoice = null;
    if (form) {
      const send = form.querySelector('button[type="submit"],.chat-send-btn,button');
      if (send) send.classList.remove('arg-send-armed');
    }
    if (choicesEl) { const hint = choicesEl.querySelector('.arg-scripted-hint'); if (hint) hint.remove(); }
  }
  function armChoice(choice, contact) {
    if (!input || !form || choice.say === false) { fireChoice(choice, contact); return; }
    pendingChoice = { choice: choice, contact: contact };
    input.value = choice.text;
    try { input.focus(); } catch (e) {}
    const send = form.querySelector('button[type="submit"],.chat-send-btn,button');
    if (send) send.classList.add('arg-send-armed');
    if (choicesEl && !choicesEl.querySelector('.arg-scripted-hint')) {
      const hint = document.createElement('div');
      hint.className = 'arg-scripted-hint';
      hint.textContent = '↑ 话替你打在框里了。按不按出去，你自己决定。';
      choicesEl.appendChild(hint);
    }
  }
  function fireChoice(choice, contact) {
    disarmSend();
    appendAction(choice.text);
    logMsg(contact.id, 'action', choice.text);
    if (choice.reply) {
      npcSay(choice.reply, contact, function () { if (choice.target) setTimeout(function () { go(choice.target); }, 460); });
    } else if (choice.target) {
      setTimeout(function () { go(choice.target); }, 260);
    }
  }

  function loadChat(contact) {
    if (nameEl) nameEl.textContent = contact.name;
    if (bioEl) bioEl.textContent = contact.bio || '';
    if (messagesEl) messagesEl.innerHTML = '';
    if (choicesEl) choicesEl.innerHTML = '';
    const timeDiv = document.createElement('div');
    timeDiv.className = 'msg-time-divider';
    timeDiv.textContent = '—— 今日对话加密保护中 ——';
    messagesEl.appendChild(timeDiv);
    if (contact.messages && contact.messages.length) contact.messages.forEach(m => { renderMessage(m, contact); });
    let history = [];
    try { history = readChatLog()[contact.id] || []; } catch (e) {}
    history.forEach(m => {
      if (m.s === 'action') appendAction(m.t);
      else appendMessage(m.s === 'user' ? 'user' : 'npc', m.t, contact.avatar);
    });
    if (contact.dialogue && contact.dialogue.length) {
      contact.dialogue.forEach(item => {
        if (item.sender === 'npc' && item.text) appendMessage('npc', item.text, contact.avatar);
        else if ((item.sender === 'user' || item.sender === 'player') && item.text) appendMessage('user', item.text);
        else if (item.sender === 'choice' && item.options) renderChoices(item.options, contact);
      });
    }
    if (contact.choices && contact.choices.length) renderChoices(contact.choices, contact);
  }

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const contact = contacts[currentIdx];
      if (pendingChoice && pendingChoice.contact === contact && text === pendingChoice.choice.text) {
        const pc = pendingChoice; input.value = ''; fireChoice(pc.choice, pc.contact); return;
      }
      disarmSend();
      input.value = '';
      appendMessage('user', text);
      stampRow();
      logMsg(contact.id, 'user', text);
      const accepted = String(contact.passphrase || '').split(/[,，;|/]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const hit = accepted.length > 0 && accepted.indexOf(text.toLowerCase()) !== -1;
      let replyText;
      if (hit) {
        replyText = contact.passphraseReply || '……对。就是这个。';
        if (contact.passphraseClue) triggerClue(contact.passphraseClue);
      } else {
        const pool = (contact.fallbackReplies && contact.fallbackReplies.length) ? contact.fallbackReplies :
          ['（对方沉默了很久。）', '（对方正在输入，又停下了。）', '（对方只回了一个句号。）', '（对方没有回复。海那头的信号，断断续续。）', '（对方把话头，轻轻收了回去。）'];
        const logLen = (() => { try { return (readChatLog()[contact.id] || []).length; } catch (e) { return 0; } })();
        replyText = pool[logLen % pool.length];
      }
      npcSay(replyText, contact, function () { if (hit && contact.passphraseTarget) setTimeout(() => go(contact.passphraseTarget), 520); });
    });
  }

  renderContacts();
  if (contacts.length > 0) loadChat(contacts[0]);
}


/* ---- save.mjs ---- */
// src/runtime/save.mjs — 存档版本化 + 导入/导出（商业解谜续玩标配）



function exportSave() {
  try {
    const snap = packSave(localStorage);
    const code = 'BAY99.' + btoa(unescape(encodeURIComponent(JSON.stringify(snap))));
    const ta = document.createElement('textarea');
    ta.value = code; document.body.appendChild(ta); ta.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    if (done && window.ARG && ARG.toast) ARG.toast('存档码已复制到剪贴板（含 v' + SAVE_VERSION + '）。');
    else prompt('复制这串存档码，之后可粘贴导入：', code);
    return code;
  } catch (e) { return null; }
}

function applyImport(code) {
  try {
    const raw = String(code).replace(/^BAY99\./, '');
    const snap = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (!snap || !Array.isArray(snap.visited)) throw new Error('bad');
    writeVisited(normalizeVisited(snap.visited));
    const set = (k, v) => { if (v != null) localStorage.setItem(k, v); };
    set('arg_chat_log_v1', JSON.stringify(snap.chat || {}));
    set('arg_your_name', snap.name || '');
    set('arg_shadow_949', snap.shadow || '');
    set('arg_game_start', snap.start || '');
    set('arg_unlocked_locks', JSON.stringify(snap.unlocked || []));
    set('arg_time_clues', JSON.stringify(snap.timeClues || []));
    localStorage.setItem('arg_save_version', String(snap.v || SAVE_VERSION));
    return true;
  } catch (e) { return false; }
}

function importSavePrompt() {
  const code = window.prompt('粘贴存档码以恢复进度（将覆盖当前进度）：');
  if (!code) return;
  if (applyImport(code)) { window.location.reload(); }
  else window.alert('存档码无效或版本不兼容。');
}


/* ---- progress.mjs ---- */
// src/runtime/progress.mjs — 右下角进度角标 + 已收集清单 + 重置



function ensureProgressPill() {
  if (!config.trackProgress || config.preview || document.getElementById('arg-progress-pill')) return;
  var el = document.createElement('div'); el.id = 'arg-progress-pill';
  el.innerHTML = '线索 <b id="arg-pv-num">0</b>/? <span id="arg-pv-save" title="导出/导入存档">⇄</span> <span id="arg-pv-reset" title="重置调查进度">⟳</span>';
  document.body.appendChild(el);
  var st = document.createElement('style');
  st.textContent = '#arg-progress-pill{position:fixed;right:10px;bottom:10px;z-index:99990;font-size:11px;color:#cbd5e1;background:rgba(10,14,22,.55);border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:3px 9px;opacity:.55;pointer-events:auto;font-family:inherit;cursor:pointer}#arg-progress-pill:hover{opacity:.9}#arg-pv-reset,#arg-pv-save{cursor:pointer;margin-left:4px;opacity:.7}#arg-pv-reset:hover{opacity:1;color:#f87171}#arg-pv-save:hover{opacity:1;color:#7dd3fc}#arg-pv-panel{position:fixed;right:10px;bottom:36px;z-index:99991;max-width:300px;max-height:55vh;overflow:auto;font-size:11.5px;line-height:1.7;color:#cbd5e1;background:rgba(10,14,22,.92);border:1px solid rgba(148,163,184,.3);border-radius:8px;padding:10px 12px;display:none}#arg-pv-panel b{color:#e2e8f0}#arg-pv-panel .dim{color:#64748b;font-size:10.5px}';
  document.head.appendChild(st);
  var panel = document.createElement('div'); panel.id = 'arg-pv-panel'; document.body.appendChild(panel);
  function update() { var n = document.getElementById('arg-pv-num'); if (n) n.textContent = String(readVisited().length); }
  function renderPanel() {
    const names = config.names || {};
    const list = readVisited().map(id => names[id] || id);
    panel.innerHTML = '<b>已收集线索 · ' + list.length + '</b><br>' +
      (list.length ? list.map(x => '· ' + x).join('<br>') : '<span class="dim">还没有收集任何线索。</span>') +
      '<br><span class="dim">（只显示已收集的线索；关键证据集齐，才会在聊天里浮现更重的结论。）</span>' +
      '<br><span id="arg-pv-export" style="color:#7dd3fc;cursor:pointer">⇄ 导出/导入存档</span>';
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    var ex = panel.querySelector('#arg-pv-export'); if (ex) ex.addEventListener('click', function (e) { e.stopPropagation(); exportSave(); importSavePrompt(); });
  }
  update();
  window.addEventListener('focus', update);
  el.addEventListener('click', function () { renderPanel(); });
  document.addEventListener('click', function (ev) {
    if (panel.style.display === 'block' && !panel.contains(ev.target) && ev.target !== el && !el.contains(ev.target)) panel.style.display = 'none';
  });
  document.getElementById('arg-pv-reset').addEventListener('click', function (ev) {
    ev.stopPropagation();
    if (window.confirm('确定重置全部调查进度？线索与聊天记录将清空，页面将重新载入。')) {
      try {
        localStorage.removeItem('arg_visited_nodes'); localStorage.removeItem('arg_chat_log_v1');
        localStorage.removeItem('arg_game_start'); localStorage.removeItem('arg_notify_v1'); localStorage.removeItem('arg_notify_seen');
        localStorage.removeItem('arg_unlocked_locks'); localStorage.removeItem('arg_time_clues');
      } catch (e) {}
      window.location.reload();
    }
  });
}


/* ---- stats.mjs ---- */
// src/runtime/stats.mjs — 隐藏访问统计 + 监听终端页（尊重 DNT）


function trackVisit() {
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
function ensureStats() {
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


/* ---- skin.mjs ---- */
// src/runtime/skin.mjs — 全局主题层：统一「蓝湾档案」美学
function ensureGlobalSkin() {
  if (document.getElementById('arg-skin')) return;
  const st = document.createElement('style'); st.id = 'arg-skin';
  st.textContent = [
    '/* —— 全局排印 —— */',
    'body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}',
    '::selection{background:rgba(31,111,237,.22)}',
    '::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:rgba(120,130,150,.35);border-radius:8px}::-webkit-scrollbar-track{background:transparent}',
    '/* —— BBS 论坛 —— */',
    '.bbs-container{max-width:860px!important;margin:0 auto!important}',
    '.bbs-post-card,.bbs-replies-card{background:#fffdf9!important;border:1px solid #e2ddd0!important;border-radius:12px!important;box-shadow:0 8px 24px rgba(60,50,30,.09)!important}',
    '.bbs-title{font-family:"Noto Serif SC","SimSun",serif!important;font-weight:900!important;letter-spacing:.5px!important}',
    '.bbs-post-body{font-size:15.5px!important;line-height:2.05!important;color:#292524!important}',
    '.bbs-floor{color:#a8a29e!important;font-size:12px!important}',
    '.bbs-tag{background:#f0ede4!important;border:1px solid #e0d9c8!important;border-radius:999px!important;padding:2px 10px!important;font-size:11px!important}',
    '.bbs-btn,.bbs-post-links a,.bbs-links-container a{border-radius:8px!important;transition:all .15s!important}',
    '.bbs-btn:hover,.bbs-post-links a:hover,.bbs-links-container a:hover{transform:translateY(-1px)}',
    '.bbs-user-badge{background:#0f766e!important;color:#fff!important;border-radius:4px!important;padding:1px 6px!important;font-size:10px!important}',
    '/* —— 新闻 —— */',
    '.news-content,.news-article{background:#fffdf9!important;border:1px solid #e2ddd0!important;border-radius:12px!important;box-shadow:0 8px 24px rgba(60,50,30,.09)!important;padding:34px 38px!important}',
    '.news-title{font-family:"Noto Serif SC","SimSun",serif!important;font-weight:900!important;line-height:1.5!important;letter-spacing:.5px!important}',
    '.news-content{font-size:15.5px!important;line-height:2.05!important}',
    '.news-divider{border-color:#eae4d5!important}',
    '.news-links-list a{display:block!important;padding:8px 10px!important;border-bottom:1px dotted #e0d9c8!important;color:#0f766e!important;text-decoration:none!important;border-radius:6px!important;transition:all .15s!important}',
    '.news-links-list a:hover{background:#f4f1e8!important;padding-left:16px!important}',
    '.news-btn{border-radius:8px!important;transition:all .15s!important}.news-btn:hover{transform:translateY(-1px)}',
    '/* —— SCP 卷宗 —— */',
    '.scp-page{background:radial-gradient(900px 300px at 50% -5%,rgba(120,20,20,.05),transparent),#f4f2ec!important}',
    '.scp-card{background:#fffef8!important;border:1px solid #d8d2c0!important;border-radius:6px!important;box-shadow:0 14px 40px -14px rgba(60,40,20,.25)!important;padding:38px 44px!important}',
    '.scp-title{font-family:"Noto Serif SC","SimSun",serif!important;font-weight:900!important;letter-spacing:1px!important}',
    '.scp-meta{display:flex!important;gap:10px!important;flex-wrap:wrap!important}',
    '.scp-meta span{background:#efece0!important;border:1px solid #ddd6c2!important;border-radius:4px!important;padding:3px 10px!important;font-size:11.5px!important;color:#57534e!important}',
    '.scp-body{font-size:15.5px!important;line-height:2.1!important;color:#292524!important}',
    '.scp-warning-header{border-left:4px solid #b91c1c!important;padding-left:12px!important}',
    '.scp-seal{opacity:.08!important}',
    '/* —— 手写日记 —— */',
    '.diary-notebook{background:repeating-linear-gradient(180deg,#fbf7ea 0 34px,#f3eedd 34px 35px)!important;border:1px solid #e5decb!important;border-radius:6px!important;box-shadow:0 16px 40px -16px rgba(80,60,20,.35)!important}',
    '.diary-title,.diary-content,.diary-date,.diary-author{font-family:"KaiTi","楷体","Noto Serif SC",cursive!important}',
    '.diary-title{font-size:26px!important;font-weight:700!important}',
    '.diary-content{font-size:18px!important;line-height:2.3!important;color:#3f3a2e!important}',
    '/* —— 黑客数据流 —— */',
    '.cyber-terminal-card{border:1px solid rgba(0,255,170,.25)!important;box-shadow:0 0 0 1px rgba(0,255,170,.05),0 20px 60px -20px rgba(0,255,170,.15),inset 0 0 80px rgba(0,255,170,.03)!important}',
    '.cyber-terminal-card::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px)}',
    '.cyber-body{font-size:14.5px!important;line-height:2.1!important}',
    '.cyber-title{letter-spacing:1px!important;text-shadow:0 0 14px rgba(0,255,170,.45)!important}',
    '/* —— CRT 监控 —— */',
    '.crt{position:relative!important}',
    '.crt::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px),radial-gradient(120% 100% at 50% 50%,transparent 60%,rgba(0,0,0,.35))}',
    '.crt .screen-title,.crt .log{text-shadow:0 0 8px rgba(120,255,180,.5)!important}',
    '/* —— 索引枢纽 —— */',
    '.archive-container{box-shadow:0 26px 70px -22px rgba(0,0,0,.75)!important;border:1px solid rgba(96,165,250,.22)!important}',
    '.archive-header{border-bottom:1px solid rgba(96,165,250,.16)!important}',
    '.archive-title-bar{letter-spacing:2px!important}',
    '.archive-list a{border-left:3px solid rgba(96,165,250,.4)!important;transition:all .15s!important}',
    '.archive-list a:hover{transform:translateX(6px)!important;background:rgba(37,99,235,.22)!important;box-shadow:0 6px 18px rgba(37,99,235,.25)!important}',
    '.archive-nav{letter-spacing:1px!important}',
    '.wiki-content{font-size:15.5px!important;line-height:2.05!important}',
    '.wiki-links a{display:block!important;padding:9px 12px!important;border:1px solid #e5decb!important;border-radius:8px!important;margin:6px 0!important;color:#0f766e!important;text-decoration:none!important;transition:all .15s!important;background:#fffdf9!important}',
    '.wiki-links a:hover{border-color:#0f766e!important;padding-left:18px!important}',
    '.portal-links a{transition:all .15s!important}',
    '/* —— 结局 —— */',
    '.news-masthead-title{font-family:"Noto Serif SC","SimSun",serif!important;font-weight:900!important}',
    '.news-message{font-size:16px!important;line-height:2.1!important}',
    '.verdict-body{font-size:16px!important;line-height:2.1!important}',
    '.crt .screen,.crt .blink{text-shadow:0 0 10px rgba(120,255,180,.55)!important}',
    '/* —— 登录 —— */',
    '.safe-vault-card{box-shadow:0 24px 70px -20px rgba(10,20,40,.5)!important;border-radius:14px!important}',
    '.vault-submit-btn{transition:all .15s!important}.vault-submit-btn:hover{transform:translateY(-1px)}',
    '.bios-screen{text-shadow:0 0 6px rgba(120,255,180,.4)!important}',
    '/* —— 文件夹 —— */',
    '.folder a{transition:all .15s!important}',
    '/* —— 聊天通用 —— */',
    '.choice-btn{border-radius:10px!important;transition:all .15s!important;line-height:1.7!important}',
    '.choice-btn:hover{transform:translateY(-1px)!important;filter:brightness(1.03)!important}',
    '.msg-bubble{line-height:1.85!important}',
    '.msg-time-divider{opacity:.65!important}',
    '.contact-item{transition:background .15s!important}',
    '/* —— 桌面 —— */',
    '.desktop-icons a,.mac-desktop-icons a,.cyber-icons a{text-shadow:0 1px 4px rgba(0,0,0,.65)!important}',
    '.win-sticky-note,.dark-sticky-note,.mac-stickies{box-shadow:0 14px 34px -12px rgba(20,30,20,.5)!important}',
    '/* —— 移动端适配（≤720px）—— */',
    '@media (max-width:720px){',
    '*{-webkit-tap-highlight-color:transparent}',
    'body{overflow-x:hidden!important}',
    'img{max-width:100%!important;height:auto!important}',
    '#arg-pv-panel{max-width:calc(100vw - 20px)!important}',
    '#arg-progress-pill,#arg-drone-toggle{font-size:13px!important;padding:6px 12px!important}',
    '[data-arg-result]{max-width:100%!important;overflow-wrap:break-word!important}',
    '.archive-container,.portal,.wiki-container,.yahoo-container,.bbs-container,.cyber-container,.news-article,.news-content,.scp-page,.scp-card,.diary-notebook,.folder,.search-container,.term-container,.mag-container{width:auto!important;max-width:100%!important;box-sizing:border-box!important}',
    '.archive-container,.portal,.folder{margin-left:10px!important;margin-right:10px!important}',
    '.scp-card{padding:22px 16px!important}',
    '.news-content{padding:20px 14px!important}',
    '.yahoo-container{padding:14px!important}',
    '.bbs-post-body,.scp-body,.news-content,.wiki-content{font-size:15px!important}',
    '.diary-content{font-size:16.5px!important}',
    '.wiki-container{flex-direction:column!important}',
    '.wiki-sidebar{width:auto!important;border-right:none!important;border-bottom:1px solid #a7d7f9!important}',
    '.wiki-content{padding:18px 14px!important}',
    '.wiki-toc{min-width:0!important;max-width:100%!important;box-sizing:border-box!important}',
    '.archive-list a{padding:10px 12px!important}',
    '.archive-list a:hover{transform:none!important}',
    '.yahoo-directory{grid-template-columns:1fr!important}',
    '.search-input-wrap,.search-input-box,.term-input-line{max-width:100%!important}',
    '.folder{margin-top:20px!important;margin-bottom:20px!important}',
    '.chat-app{flex-direction:column!important}',
    '.chat-sidebar{width:100%!important;max-width:100%!important;height:auto!important;max-height:132px!important;border-right:none!important;border-bottom:1px solid rgba(127,127,127,.35)!important}',
    '.chat-sidebar-header{padding:6px 8px!important}',
    '.chat-contacts-list{display:flex!important;flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important;padding:4px 6px!important}',
    '.contact-item{min-width:128px!important;flex:0 0 auto!important}',
    '.chat-main{flex:1!important;min-height:0!important;width:100%!important}',
    '.chat-messages{padding:10px!important}',
    '.msg-bubble{max-width:86%!important}',
    '.desktop-icons,.mac-desktop-icons,.cyber-icons{flex-direction:row!important;flex-wrap:wrap!important;max-height:none!important;align-content:flex-start!important;gap:8px 4px!important}',
    '.desktop-main,.mac-main-area{flex-direction:column!important;justify-content:flex-start!important;gap:16px!important}',
    '.desktop-icon{width:72px!important}',
    '.icon-symbol{font-size:30px!important}',
    '.win-sticky-note,.dark-sticky-note,.mac-stickies{width:auto!important;max-width:100%!important}',
    '.cyber-topbar{flex-wrap:wrap!important;gap:4px 10px!important}',
    '.cyber-topbar span,.cyber-meta-row span{overflow-wrap:anywhere!important;white-space:normal!important}',
    'pre{white-space:pre-wrap!important;overflow-wrap:anywhere!important}',
    '.wiki-links a,.hot-link-btn,.arg-link-desc,.bbs-tag{overflow-wrap:anywhere!important;white-space:normal!important}',
    '}',
    '/* —— 减少动效偏好：关扫描线/闪烁/噪点 —— */',
    '@media (prefers-reduced-motion: reduce){',
    '.arg-atmosphere-glitch{animation:none!important}',
    '#arg-noise{display:none!important}',
    '*{scroll-behavior:auto!important}',
    '}'
  ].join(String.fromCharCode(10));
  document.head.appendChild(st);
}


/* ---- nameinput.mjs ---- */
// src/runtime/nameinput.mjs — 「写给你的一页」署名输入（纪念站）



function ensureNameInput() {
  if (!config.nameInput || config.preview || document.getElementById('arg-name-input')) return;
  const host = document.querySelector('[data-arg-slot="body"]');
  if (!host) return;
  const wrap = document.createElement('div');
  wrap.id = 'arg-name-input';
  wrap.style.marginTop = '14px';
  wrap.innerHTML = '<input id="arg-name-field" placeholder="写下你的名字（会留在这台机器里）" style="width:70%;padding:6px 8px;background:#0a0e16;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);font-family:inherit"> <button id="arg-name-save" style="padding:6px 12px;background:#16335f;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);cursor:pointer;font-family:inherit">留下</button><div id="arg-name-line" style="margin-top:8px"></div>';
  host.appendChild(wrap);
  function render() {
    let n = ''; try { n = localStorage.getItem('arg_your_name') || ''; } catch (e) {}
    const line = document.getElementById('arg-name-line');
    if (line) line.innerHTML = n ? ('&gt; 本页献给调查者：<b>' + escapeHtml(n) + '</b>。海记住了。') : '';
  }
  document.getElementById('arg-name-save').addEventListener('click', function () {
    const v = (document.getElementById('arg-name-field').value || '').trim().slice(0, 20);
    if (!v) return;
    try { localStorage.setItem('arg_your_name', v); } catch (e) {}
    render();
  });
  render();
}


/* ---- audio-games.mjs ---- */
// src/runtime/audio-games.mjs — 小游戏实时音频工作台（Web Audio；无 AudioContext 时安全 no-op）
function createStudio() {
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  let ctx, master, rumbleOsc, rumbleGain, voiceOsc, voiceGain, voiceFilter, hissSrc, hissGain, hissFilter, analyser;
  let running = false;

  function noiseBuffer(sec) {
    const len = ctx.sampleRate * sec, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    return buf;
  }
  function start() {
    if (!AC || running) return;
    try {
      ctx = ctx || new AC();
      if (ctx.state === 'suspended') ctx.resume();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      // 低频海轰（52/56.5Hz 双正弦 → 4.5Hz 拍频）
      rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0.5; rumbleGain.connect(master);
      [52, 56.5].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(rumbleGain); o.start(); });
      // 中频人声带（一个被带通塑形的锯齿，模拟一句话）
      voiceOsc = ctx.createOscillator(); voiceOsc.type = 'sawtooth'; voiceOsc.frequency.value = 220;
      voiceFilter = ctx.createBiquadFilter(); voiceFilter.type = 'bandpass'; voiceFilter.frequency.value = 700; voiceFilter.Q.value = 4;
      voiceGain = ctx.createGain(); voiceGain.gain.value = 0;
      voiceOsc.connect(voiceFilter); voiceFilter.connect(voiceGain); voiceGain.connect(master); voiceOsc.start();
      // 高频嘶声（白噪→高通）
      hissSrc = ctx.createBufferSource(); hissSrc.buffer = noiseBuffer(2); hissSrc.loop = true;
      hissFilter = ctx.createBiquadFilter(); hissFilter.type = 'highpass'; hissFilter.frequency.value = 3200;
      hissGain = ctx.createGain(); hissGain.gain.value = 0.3;
      hissSrc.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(master); hissSrc.start();
      running = true;
    } catch (e) {}
  }
  function stop() {
    if (!running) return;
    try { [rumbleOsc].forEach((o) => o && o.stop && o.stop()); } catch (e) {}
    try { voiceOsc && voiceOsc.stop(); } catch (e) {}
    try { hissSrc && hissSrc.stop(); } catch (e) {}
    // 断开主链路（各子节点随之释放）
    try { master && master.disconnect(); } catch (e) {}
    running = false;
  }
  const set = (node, v) => { if (running && node) { try { node.gain.setTargetAtTime(v, ctx.currentTime, 0.05); } catch (e) { node.gain.value = v; } } };
  return {
    get available() { return !!AC; },
    get running() { return running; },
    start, stop,
    setRumble(x) { set(rumbleGain, Math.max(0, Math.min(1, x)) * 0.9); },   // 海轰噪声强度
    setVoice(x) { set(voiceGain, Math.max(0, Math.min(1, x)) * 0.5); },      // 人声清晰度/音量
    setHiss(x) { set(hissGain, Math.max(0, Math.min(1, x)) * 0.4); },        // 高频嘶声
    setVoiceFreq(f) { if (running && voiceOsc) try { voiceOsc.frequency.value = f; } catch (e) {} },
    // 失谐拍频：offset 越大越“毛刺”（走带对位用）
    setDetune(offsetHz) { if (running && voiceOsc) { try { voiceOsc.detune.value = offsetHz * 100; } catch (e) {} } },
  };
}


/* ---- games.mjs ---- */
// src/runtime/games.mjs — 声音修复师小游戏宿主 + 注册表（阶段4 填充各 game）




// 注册表：type -> mount(canvasHost, opts, done) ；done(true) 记线索
const __ARG_GAMES = (window.__ARG_GAMES = window.__ARG_GAMES || {});

function mountGame() {
  const g = config.minigame;
  if (!g || !g.type) return;
  const host = document.querySelector('[data-arg-game]') || document.querySelector('[data-arg-slot="body"]') || document.body;
  if (!host || host === document.body) return;
  if (document.getElementById('arg-game-wrap')) return;
  const fn = __ARG_GAMES[g.type];
  if (!fn) { const w = document.createElement('div'); w.id = 'arg-game-wrap'; w.style.cssText = 'margin:14px 0;padding:10px;border:1px dashed #888;font-size:12px;opacity:.7'; w.textContent = '（本作小游戏：' + escapeHtml(g.type) + ' · 待载入）'; host.appendChild(w); return; }
  const wrap = document.createElement('div'); wrap.id = 'arg-game-wrap';
  wrap.style.cssText = 'margin:16px 0;padding:14px;border:1px solid rgba(148,163,184,.35);border-radius:12px;background:rgba(10,14,22,.35)';
  const title = document.createElement('div'); title.style.cssText = 'font-size:13px;letter-spacing:1px;margin-bottom:10px;opacity:.85';
  title.textContent = g.title || '声音修复工作台';
  wrap.appendChild(title);
  const stage = document.createElement('div'); stage.style.cssText = 'position:relative;width:100%';
  wrap.appendChild(stage);
  const status = document.createElement('div'); status.id = 'arg-game-status'; status.style.cssText = 'margin-top:10px;font-size:12.5px;min-height:16px;color:#94a3b8';
  wrap.appendChild(status);
  host.appendChild(wrap);
  const already = g.clue ? hasClue(g.clue) : false;
  if (already) { status.innerHTML = '<span style="color:#22c55e">✔ 这条线索已经拿到。</span>'; }
  function done(ok) {
    if (ok && g.clue && !already) {
      triggerClue(g.clue); playSynthSound('unlock');
      status.innerHTML = '<span style="color:#22c55e">' + escapeHtml(g.successText || '✔ 修复完成，声音回来了。') + '</span>';
      if (pushNotify) pushNotify('修好了：' + ((config.names && config.names[g.clue]) || g.clue), g.clue);
      if (g.target) setTimeout(function () { try { (window.ARG_RUNTIME || {}).go && (window.ARG_RUNTIME || {}).go(g.target); } catch (e) {} }, 600);
    } else if (!ok) {
      status.innerHTML = '<span style="color:#ef4444">' + escapeHtml(g.failText || '还没对准。再试一次。') + '</span>';
    }
  }
  try { fn(stage, g, done, status); } catch (e) { status.textContent = '（小游戏加载失败：' + e.message + '）'; }
}

// 供外部/阶段4 注册新游戏
function registerGame(type, fn) { __ARG_GAMES[type] = fn; }


/* ---- games-builtin.mjs ---- */
// src/runtime/games-builtin.mjs — 6 个「声音修复师」小游戏（Canvas/DOM 为主，可选音效，均有可视判定）




const CSS = '#arg-game-wrap canvas{display:block;width:100%;height:auto;border-radius:8px;background:#05070a;touch-action:none}' +
  '.arg-gctrl{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}' +
  '.arg-gctrl button{padding:6px 12px;border:1px solid #22d3ee;background:#0b2733;color:#a5f3fc;border-radius:8px;cursor:pointer;font-family:inherit}' +
  '.arg-gctrl button.on{background:#22d3ee;color:#05070a}' +
  '.arg-gctrl input[type=range]{flex:1;min-width:140px}';
let cssOn = false;
function ensureCss() { if (cssOn) return; cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
function mk(stage, h) { ensureCss(); const c = document.createElement('canvas'); c.width = 360; c.height = h || 150; stage.appendChild(c); return c; }
function say(status, t) { if (status) status.textContent = t; }
// 给偏听觉的游戏挂一个 ▶/⏹ 实时音频开关；apply(studio) 每次交互调用以更新参数
function attachAudio(stage, apply, onWin) {
  const studio = createStudio();
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  const btn = document.createElement('button'); btn.textContent = '▶ 播放坏带子'; btn.style.borderColor = '#16a34a'; btn.style.color = '#86efac';
  btn.onclick = () => {
    if (!studio.available) { say(bar, '（本环境无 Web Audio；视觉判定照常可用。）'); return; }
    if (studio.running) { studio.stop(); btn.textContent = '▶ 播放坏带子'; }
    else { studio.start(); apply(studio); btn.textContent = '⏹ 停止'; }
    playSynthSound('click');
  };
  bar.appendChild(btn); stage.appendChild(bar);
  return { studio, apply, stop() { try { studio.stop(); } catch (e) {} } };
}

// 1) 补全频谱：频谱图上有一块“塌陷缺口”，补对频段显字
registerGame('spectral-repair', function (stage, opts, done, status) {
  const c = mk(stage, 160), x = c.getContext('2d');
  let patched = null;
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 160);
    for (let col = 0; col < 72; col++) for (let row = 0; row < 12; row++) {
      const band = row < 4 ? 0 : row < 8 ? 1 : 2; // 低/中/高
      let lit = ((col * 7 + row * 13) % 5 === 0);
      if (col >= 20 && col <= 52 && band === 1) lit = (patched === 1); // 中频被挖空
      x.fillStyle = lit ? 'rgba(34,211,238,' + (0.35 + ((col + row) % 3) * 0.2) + ')' : 'rgba(30,41,59,.5)';
      x.fillRect(col * 5, 160 - (row + 1) * 13, 5, 13);
    }
    if (patched === 1) { x.fillStyle = '#fef08a'; x.font = 'bold 22px monospace'; x.fillText('HARBOR', 150, 88); }
  }
  draw(); say(status, '频谱中频被抹掉了。选一个频段补回去（低/中/高）：');
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  ['低频', '中频', '高频'].forEach((lab, i) => {
    const b = document.createElement('button'); b.textContent = lab;
    b.onclick = () => { patched = i; draw(); playSynthSound('click'); if (i === 1) { say(status, '✔ 中频补上了，藏字显形：HARBOR。'); playSynthSound('unlock'); setTimeout(() => done(true), 500); } else say(status, '（还是一片糊——再试别的频段。）'); };
    bar.appendChild(b);
  });
  stage.appendChild(bar);
});

// 2) 去噪门限：滑到“海轰噪声”被滤掉、人声能量达标（实时听感：噪声渐弱、一句人声渐显）
registerGame('noise-gate', function (stage, opts, done, status) {
  const c = mk(stage, 130), x = c.getContext('2d'); let thr = 0.8;
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 130);
    x.strokeStyle = '#22d3ee'; x.beginPath();
    for (let i = 0; i < 360; i++) {
      const hum = (1 - thr) * 26 * Math.sin(i / 4) + (1 - thr) * (Math.random() * 6);
      const voice = 10 * Math.sin(i / 18) * Math.exp(-Math.pow((i - 180) / 90, 2));
      const y = 65 + hum + (thr < 0.55 ? voice : voice * 0.2);
      i ? x.lineTo(i, y) : x.moveTo(i, y);
    }
    x.stroke();
  }
  const audio = attachAudio(stage, (s) => { s.setRumble(1 - thr); s.setVoice(thr < 0.55 ? 1 : 0.15); s.setHiss(0.1); });
  function sync() { audio.studio.setRumble(1 - thr); audio.studio.setVoice(thr < 0.55 ? 1 : 0.15); }
  draw(); say(status, '拉门限把 4.5Hz 海轰噪声压下去，露出被埋的一句人声（可点上方 ▶ 实时试听）：');
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  const rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.value = 80;
  rg.oninput = () => { thr = rg.value / 100; draw(); sync(); const ok = thr >= 0.40 && thr <= 0.50; if (ok && !rg._won) { rg._won = true; audio.stop(); done(true); } };
  bar.appendChild(rg); stage.appendChild(bar);
});

// 3) 走带对位：左右声道相位对齐，相关峰归零（实时听感：错位时拍频毛刺，对齐后单一清音）
registerGame('tape-align', function (stage, opts, done, status) {
  const c = mk(stage, 130), x = c.getContext('2d'); const off0 = 46; let off = 0;
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 130);
    const wave = (dy, shift, col) => { x.strokeStyle = col; x.beginPath(); for (let i = 0; i < 360; i++) { const y = dy + 22 * Math.sin((i + shift) / 12); i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); };
    wave(45, 0, '#22d3ee'); wave(95, off0 + off, '#facc15');
    x.fillStyle = '#94a3b8'; x.font = '11px monospace'; x.fillText('错位 ' + Math.abs(off0 + off) + '（对齐到 0）', 8, 14);
  }
  const audio = attachAudio(stage, (s) => { s.setRumble(0.1); s.setHiss(0.05); s.setVoice(0.9); s.setDetune(off0 + off); });
  function sync() { audio.studio.setDetune(off0 + off); }
  draw(); say(status, '两路信号错位了。拖动滑块让黄色波与青波对齐（▶ 试听：对齐前拍频毛刺，对齐后归一）：');
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  const rg = document.createElement('input'); rg.type = 'range'; rg.min = -60; rg.max = 20; rg.value = 0;
  rg.oninput = () => { off = +rg.value; draw(); sync(); if (Math.abs(off0 + off) <= 2 && !rg._won) { rg._won = true; audio.stop(); done(true); } };
  bar.appendChild(rg); stage.appendChild(bar);
});

// 4) 调谐旋钮：方向键拧到精确频率才“锁相”，冷热引导（错误频率是诱饵；实时听感：偏离越大噪声越响）
registerGame('tuning-dial', function (stage, opts, done, status) {
  const target = (opts.freq || 94.90);
  let f = 99.40;
  const c = mk(stage, 90), x = c.getContext('2d');
  function nearAmt() { return Math.max(0, 1 - Math.abs(f - target) / 10); }
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 90);
    const near = nearAmt();
    x.fillStyle = 'rgba(34,211,238,' + (0.2 + near * 0.8) + ')'; x.fillRect(0, 62, 360, 6);
    x.fillStyle = '#a5f3fc'; x.font = 'bold 20px monospace'; x.fillText(f.toFixed(2) + ' MHz', 12, 34);
    x.fillStyle = '#facc15'; x.font = '12px monospace'; x.fillText(['冷', '凉', '温', '热', '锁相!'][Math.min(4, Math.floor(near * 5))], 250, 34);
  }
  const audio = attachAudio(stage, (s) => { s.setRumble(0.15); s.setHiss(1 - nearAmt()); s.setVoice(nearAmt() > 0.85 ? 0.8 : 0); });
  function sync() { audio.studio.setHiss(1 - nearAmt()); audio.studio.setVoice(nearAmt() > 0.85 ? 0.8 : 0); }
  draw(); say(status, '用 ← → 方向键微调频率，找回那个“获批未启用”的备用台（比 99.40 低一点；▶ 试听：拧准了噪声退去）：');
  function key(e) { if (e.key === 'ArrowLeft') f = +(f - 0.05).toFixed(2); else if (e.key === 'ArrowRight') f = +(f + 0.05).toFixed(2); else return; draw(); sync(); if (Math.abs(f - target) < 0.005 && !key._w) { key._w = true; audio.stop(); done(true); } }
  document.addEventListener('keydown', key);
  stage.addEventListener('mouseenter', () => document.removeEventListener('keydown', key));
});

// 5) 剪辑拼接：把碎磁带按时间顺序拖回正确排列，重组顺序拼出答案
registerGame('splice-order', function (stage, opts, done, status) {
  const segs = [{ id: 0, t: '03:11 · 台呼' }, { id: 1, t: '03:12 · 66 个名字' }, { id: 2, t: '03:13 · 一句对不起' }, { id: 3, t: '03:14 · 话筒切断了' }];
  let order = [2, 0, 3, 1];
  const c = mk(stage, 40); // 占位，主体用按钮
  const bar = document.createElement('div'); bar.className = 'arg-gctrl'; bar.style.flexDirection = 'column'; bar.style.alignItems = 'stretch';
  function render() {
    bar.innerHTML = '<div style="font-size:12px;opacity:.8">点两段交换，把它们按时间前后排好：</div>';
    order.forEach((sid, idx) => { const b = document.createElement('button'); b.textContent = (idx + 1) + '. ' + segs[sid].t; b.dataset.i = idx; bar.appendChild(b); });
    say(status, '把顺序排成 03:11 → 03:12 → 03:13 → 03:14。');
  }
  let sel = null;
  bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i; if (sel == null) { sel = i; b.classList.add('on'); playSynthSound('click'); return; } const t = order[sel]; order[sel] = order[i]; order[i] = t; sel = null; render(); if (order.every((s, k) => s === k)) { say(status, '✔ 带子接好了，那一夜的顺序还原了。'); done(true); } });
  render(); stage.appendChild(bar);
});

// 6) 三段 EQ：切掉低频海噪、保留人声中频、压掉高频嘶声
registerGame('eq-band', function (stage, opts, done, status) {
  const c = mk(stage, 130), x = c.getContext('2d'); const eq = { low: 0.5, mid: 0.5, high: 0.5 };
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 130);
    x.strokeStyle = '#22d3ee'; x.beginPath();
    const lowCut = 1 - Math.min(1, Math.max(0, (eq.low - 0.6) / 0.25));
    const highCut = 1 - Math.min(1, Math.max(0, (eq.high - 0.6) / 0.25));
    const voiceGain = 1 - Math.min(1, eq.mid);
    for (let i = 0; i < 360; i++) {
      const sea = 26 * lowCut * Math.sin(i / 4);
      const hiss = 12 * highCut * Math.sin(i / 1.6);
      const voice = 15 * Math.max(0, voiceGain) * Math.sin(i / 22) * Math.exp(-Math.pow((i - 180) / 120, 2));
      const y = 65 + sea + hiss + voice;
      i ? x.lineTo(i, y) : x.moveTo(i, y);
    }
    x.stroke();
    x.fillStyle = '#94a3b8'; x.font = '11px monospace'; x.fillText('海噪 ' + (100 - Math.round(lowCut * 100)) + '% ｜ 人声 ' + Math.round(voiceGain * 100) + '% ｜ 嘶声 ' + (100 - Math.round(highCut * 100)) + '%', 8, 14);
  }
  function audioParams() {
    const lowCut = 1 - Math.min(1, Math.max(0, (eq.low - 0.6) / 0.25));
    const highCut = 1 - Math.min(1, Math.max(0, (eq.high - 0.6) / 0.25));
    return { rumble: lowCut, hiss: highCut, voice: 1 - Math.min(1, eq.mid) };
  }
  const audio = attachAudio(stage, (s) => { const p = audioParams(); s.setRumble(p.rumble); s.setHiss(p.hiss); s.setVoice(p.voice); });
  function sync() { const p = audioParams(); audio.studio.setRumble(p.rumble); audio.studio.setHiss(p.hiss); audio.studio.setVoice(p.voice); }
  draw(); say(status, '把「低频海噪」和「高频嘶声」压下去、让「中频人声」抬起来，那句话就会露出来（▶ 实时试听）：');
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  function slider(name, label, init) { const rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.value = (init * 100); const lab = document.createElement('span'); lab.textContent = label; lab.style.fontSize = '12px'; rg.oninput = () => { eq[name] = rg.value / 100; draw(); sync(); check(); }; bar.appendChild(lab); bar.appendChild(rg); }
  function check() { const win = eq.low > 0.68 && eq.mid < 0.34 && eq.high > 0.68; if (win && !bar._w) { bar._w = true; audio.stop(); say(status, '✔ 那句话清楚了。'); done(true); } }
  slider('low', '切低频', 0.5); slider('mid', '中频', 0.5); slider('high', '切高频', 0.5); stage.appendChild(bar);
});


/* ---- puzzles.mjs ---- */
// src/runtime/puzzles.mjs — 硬核谜题能力：解锁前置 / 答案校验 / 时间锁 / 双标签页 / 小游戏宿主







// —— 解锁前置：未满足 requiresClue 时显「封存」，防直接 URL 白嫖线索（core 里也已不记账）——
function ensurePrecondition() {
  if (!config.requiresClue || hasClue(config.requiresClue)) return;
  if (document.getElementById('arg-sealed-gate')) return;
  const panel = document.createElement('div');
  panel.id = 'arg-sealed-gate';
  panel.style.cssText = 'position:fixed;inset:0;z-index:99994;display:flex;align-items:center;justify-content:center;background:rgba(6,10,18,.95);color:#e2e8f0;font-family:ui-monospace,Consolas,monospace;padding:20px;text-align:center';
  panel.innerHTML = '<div style="max-width:420px"><div style="font-size:34px">🔒</div>' +
    '<div style="letter-spacing:2px;margin:8px 0">此档案已封存</div>' +
    '<div style="font-size:13px;line-height:1.8;opacity:.8">还没到能打开它的时候。<br>先解开前面那道锁，再回来。<br>（即便直接敲网址，机器也不会替你把线索记进账。）</div>' +
    '<div style="margin-top:16px"><a id="arg-sealed-back" style="color:#7dd3fc;cursor:pointer;text-decoration:underline">← 退回上一页</a></div></div>';
  document.body.appendChild(panel);
  const bk = panel.querySelector('#arg-sealed-back');
  if (bk) bk.addEventListener('click', function () { window.history.back(); });
}

// —— 答案校验（solve-credit）：输入解出的词才记线索、才放行 ——
function bindVerify() {
  const v = config.verify;
  if (!v) return;
  if (document.getElementById('arg-verify')) return;
  const host = document.querySelector('[data-arg-verify]') || document.querySelector('[data-arg-slot="body"]');
  if (!host) return;
  const box = document.createElement('div');
  box.id = 'arg-verify';
  box.style.cssText = 'margin:14px 0;padding:12px 14px;border:1px dashed rgba(148,163,184,.5);border-radius:10px;background:rgba(148,163,184,.06)';
  const already = v.clue ? hasClue(v.clue) : false;
  box.innerHTML = '<div style="font-size:12.5px;opacity:.85;margin-bottom:8px">' + escapeHtml(v.hint || '把你解出的答案，输入下面：') + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="arg-verify-in" placeholder="' + escapeHtml(v.placeholder || '答案…') + '" autocomplete="off" style="flex:1;min-width:160px;padding:7px 9px;border:1px solid rgba(148,163,184,.5);border-radius:8px;background:rgba(8,12,20,.6);color:#e2e8f0;font-family:inherit">' +
    '<button id="arg-verify-btn" type="button" style="padding:7px 14px;border:1px solid #16a34a;background:#166534;color:#fff;border-radius:8px;cursor:pointer">校验</button></div>' +
    '<div id="arg-verify-out" style="margin-top:8px;font-size:12.5px;min-height:16px">' + (already ? '<span style="color:#22c55e">✔ 已记下这条线索。</span>' : '') + '</div>';
  host.appendChild(box);
  const inp = box.querySelector('#arg-verify-in');
  const out = box.querySelector('#arg-verify-out');
  function attempt() {
    const val = String(inp.value || '').trim();
    const clue = verifyAnswer(v.answers, val);
    if (clue) {
      playSynthSound('unlock');
      triggerClue(clue);
      out.innerHTML = '<span style="color:#22c55e">' + escapeHtml(v.successText || '✔ 正确。机器替你记下了这条线索。') + '</span>';
      try { const lu = JSON.parse(localStorage.getItem('arg_unlocked_locks') || '[]'); if (!lu.includes('verify:' + clue)) { lu.push('verify:' + clue); localStorage.setItem('arg_unlocked_locks', JSON.stringify(lu)); } } catch (e) {}
      if (v.target) setTimeout(function () { go(v.target); }, 520);
    } else {
      playSynthSound('error');
      out.innerHTML = '<span style="color:#ef4444">' + escapeHtml(v.failText || '不对。再想想——答案就在你刚查到的东西里。') + '</span>';
    }
  }
  box.querySelector('#arg-verify-btn').addEventListener('click', attempt);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); attempt(); } });
}

// —— 时间锁：真实时钟 / 周年日期 / 持续收听，满足才发放线索 ——
function elapsedMin() {
  try {
    let t0 = parseInt(localStorage.getItem('arg_game_start') || '0', 10);
    if (!t0) { t0 = Date.now(); localStorage.setItem('arg_game_start', String(t0)); }
    return Math.floor((Date.now() - t0) / 60000);
  } catch (e) { return 0; }
}
function markTimeClueDone(id) { try { const l = JSON.parse(localStorage.getItem('arg_time_clues') || '[]'); if (id && !l.includes(id)) { l.push(id); localStorage.setItem('arg_time_clues', JSON.stringify(l)); } } catch (e) {} }
function timeClueDone(id) { try { return (JSON.parse(localStorage.getItem('arg_time_clues') || '[]') || []).includes(id); } catch (e) { return false; } }

function ensureTimeLock() {
  const tl = config.timeLock;
  if (!tl) return;
  const host = document.querySelector('[data-arg-result]') || document.querySelector('[data-arg-slot="body"]');
  if (!host) return;
  let line = document.getElementById('arg-timelock');
  if (!line) { line = document.createElement('div'); line.id = 'arg-timelock'; line.style.cssText = 'margin-top:12px;font-size:12.5px;letter-spacing:.5px'; host.appendChild(line); }
  let holdStart = 0;
  function tick() {
    if (!holdStart) holdStart = Date.now();
    const holdMin = Math.floor((Date.now() - holdStart) / 60000);
    const r = timeLockSatisfied(tl, { now: new Date(), elapsedMin: elapsedMin(), holdMinutes: holdMin });
    if (r.ok) {
      if (tl.clue && !timeClueDone(tl.clue)) {
        markTimeClueDone(tl.clue); triggerClue(tl.clue);
        playSynthSound('unlock');
        if (pushNotify) pushNotify('时机到了——' + ((config.names && config.names[tl.clue]) || tl.clue) + '。', tl.clueTarget || '');
      }
      line.innerHTML = '<span style="color:#22c55e">◉ ' + escapeHtml(tl.okText || '窗口开启。') + '</span>';
    } else {
      const detail = tl.mode === 'gameclock' ? ('游戏钟 ' + r.phase + '，应在 ' + r.need)
        : tl.mode === 'holdMinutes' ? ('已守 ' + r.phase + ' 分钟，需 ' + r.need)
        : ('现在 ' + r.phase + '，应在 ' + r.need);
      line.innerHTML = '<span style="color:#f59e0b">◔ ' + escapeHtml(tl.waitText || '未到窗口') + '（' + escapeHtml(detail) + '）。' + (tl.mode === 'gameclock' ? '去别处多逛一会儿，时间在走。' : '') + '</span>';
    }
  }
  tick();
  if (tl.mode === 'gameclock' || tl.mode === 'holdMinutes' || tl.mode === 'hour') setInterval(tick, tl.mode === 'holdMinutes' ? 5000 : 20000);
}

// —— 双标签页握手：电台端 + 手机端各开一个，互相 echo 到才发线索 ——
function ensureDualTab() {
  const d = config.dualTab;
  if (!d || !d.clue || hasClue(d.clue)) return;
  const KEY = 'arg_dualtab_echo';
  const role = d.role || (config.nodeId || 'x');
  function write() { try { localStorage.setItem(KEY, JSON.stringify({ role: role, ts: Date.now() })); } catch (e) {} }
  function othersSeen() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      const seen = JSON.parse(localStorage.getItem('arg_dualtab_seen') || '{}');
      if (raw && raw.role !== role && Date.now() - raw.ts < 12000) { seen[raw.role] = Date.now(); localStorage.setItem('arg_dualtab_seen', JSON.stringify(seen)); }
      const now = Date.now();
      const partners = d.partners || [];
      return partners.length ? partners.every(p => seen[p] && now - seen[p] < 20000) : Object.keys(seen).some(p => p !== role && now - seen[p] < 20000);
    } catch (e) { return false; }
  }
  function pulse() {
    write();
    if (othersSeen()) { triggerClue(d.clue); markTimeClueDone(d.clue); playSynthSound('unlock'); clearInterval(timer); const el = document.querySelector('[data-arg-result]'); if (el) el.textContent = '✔ 两端信号对上了。'; }
  }
  const timer = setInterval(pulse, 3000);
  pulse();
}

// —— 统一调度 ——
function runPuzzleHost() {
  try { ensurePrecondition(); } catch (e) {}
  try { bindVerify(); } catch (e) {}
  try { ensureTimeLock(); } catch (e) {}
  try { ensureDualTab(); } catch (e) {}
  try { mountGame(); } catch (e) {}
}


/* ---- ostheme.mjs ---- */
// src/runtime/ostheme.mjs — 桌面皮肤引擎：win98 / winxp / classic 三套可切换
const BASE = [
  '.os-win{position:absolute;display:flex;flex-direction:column;min-width:220px;min-height:120px;overflow:hidden;font-family:"Tahoma","Microsoft YaHei",sans-serif;box-shadow:var(--os-shadow)}',
  '.os-win>.os-bar{display:flex;align-items:center;gap:6px;height:26px;padding:0 6px;background:var(--os-titlebar);color:var(--os-title-fg);font-size:12.5px;user-select:none;flex:0 0 auto}',
  '.os-win>.os-bar .os-title{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
  '.os-win>.os-bar button{width:20px;height:18px;line-height:15px;border:var(--os-btn-border);background:var(--os-btn);color:var(--os-btn-fg);cursor:pointer;font-size:11px;padding:0;border-radius:var(--os-radius)}',
  '.os-win>.os-body{flex:1;overflow:auto;background:var(--os-face);color:var(--os-fg);font-size:13px}',
  '.os-win.os-max{left:0!important;top:0!important;width:100%!important;height:calc(100% - 30px)!important;border-radius:0}',
  '.os-win.os-min{display:none}',
  '.os-rz{position:absolute;width:12px;height:12px;right:0;bottom:0;cursor:nwse-resize}',
  '.os-res{position:absolute;left:0;bottom:-1px;right:0;height:22px;background:var(--os-face);border-top:var(--os-border);display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--os-muted);padding:0 8px;flex:0 0 auto}',
  'html.os-reduce *{animation:none!important;transition:none!important}',
  'html.os-reduce #arg-noise,html.os-reduce .arg-atmosphere-glitch{display:none!important}',
  'html.os-contrast .os-win>.os-body,html.os-contrast .os-tree{background:#000!important;color:#fff!important}',
  'html.os-contrast .os-tree .os-node{color:#fff!important}',
].join('\n');

const SKINS = {
  win98: { label: 'Win98 青灰', vars: {
    '--os-face':'#c0c0c0','--os-fg':'#000','--os-muted':'#3a3a3a','--os-border':'1px solid #808080',
    '--os-titlebar':'linear-gradient(90deg,#000080,#1084d0)','--os-title-fg':'#fff',
    '--os-btn':'#c0c0c0','--os-btn-fg':'#000','--os-btn-border':'1px solid #000','--os-radius':'0',
    '--os-shadow':'4px 4px 0 rgba(0,0,0,.35)','--os-accent':'#000080','--os-sel':'#000080',
  }},
  winxp: { label: 'Win XP Luna', vars: {
    '--os-face':'#ece9d8','--os-fg':'#202020','--os-muted':'#5a5a5a','--os-border':'1px solid #a0a0a0',
    '--os-titlebar':'linear-gradient(180deg,#0058e6,#3a86ff 8%,#0054e3 92%,#003fb0)','--os-title-fg':'#fff',
    '--os-btn':'#ece9d8','--os-btn-fg':'#222','--os-btn-border':'1px solid #7f9db9','--os-radius':'3px',
    '--os-shadow':'0 10px 30px -8px rgba(0,0,0,.5)','--os-accent':'#2a6ee0','--os-sel':'#316ac5',
  }},
  classic: { label: 'Classic Mac', vars: {
    '--os-face':'#d8d8d0','--os-fg':'#000','--os-muted':'#555','--os-border':'1px solid #7a7a72',
    '--os-titlebar':'repeating-linear-gradient(180deg,#fff 0 1px,#c9c9c1 1px 3px)','--os-title-fg':'#000',
    '--os-btn':'#e6e6de','--os-btn-fg':'#000','--os-btn-border':'1px solid #6b6b63','--os-radius':'0',
    '--os-shadow':'3px 3px 0 rgba(0,0,0,.25)','--os-accent':'#3a5fcd','--os-sel':'#3a5fcd',
  }},
};

let injected = null;
function applyTheme(name, root) {
  const skin = SKINS[name] || SKINS.win98;
  const host = root || document.documentElement;
  host.classList.add('os-skin');
  for (const [k, v] of Object.entries(skin.vars)) host.style.setProperty(k, v);
  if (injected !== name) {
    let st = document.getElementById('os-theme-style');
    if (!st) { st = document.createElement('style'); st.id = 'os-theme-style'; document.head.appendChild(st); }
    const extra = name === 'classic'
      ? '.os-win>.os-bar{font-weight:bold;letter-spacing:.3px}'
      : name === 'win98'
      ? '.os-win>.os-bar button{border-radius:0}.os-tree .os-node.sel{background:#000080;color:#fff}'
      : '.os-win>.os-bar{border-radius:8px 8px 0 0}';
    st.textContent = BASE + '\n' + extra;
    injected = name;
  }
  try { localStorage.setItem('os_theme', name); } catch (e) {}
  return name;
}
function currentTheme() { try { return localStorage.getItem('os_theme') || 'win98'; } catch (e) { return 'win98'; } }


/* ---- os.mjs ---- */
// src/runtime/os.mjs — 桌面窗口管理器（零依赖）：创建/拖动/缩放/最小化/最大化/还原/z序/任务栏/Alt-Tab/状态持久化



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

function openWindow({ id, title, render, x = 60, y = 40, w = 460, h = 320 }) {
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

function initOS({ work, bar } = {}) {
  workArea = work || document.querySelector('.os-workarea') || document.body;
  taskbar = bar || document.querySelector('.os-taskbar .os-tasks') || null;
  applyTheme(currentTheme());
  document.addEventListener('keydown', (e) => { if (e.altKey && e.key === 'Tab') { e.preventDefault(); cycle(); } });
}
function listWindows() { return [...windows.keys()]; }
function _resetOS() { windows.forEach((w) => { try { w.el.remove(); w.tb && w.tb.remove(); } catch (e) {} }); windows.clear(); }


/* ---- osboot.mjs ---- */
// src/runtime/osboot.mjs — 潮声OS 会话：开机 POST → 带密码登录 → 关机/重启/休眠/锁屏


const SESSION = 'os_session_v1'; // sessionStorage：本会话是否已登录（关机后清）
const BOOTED = 'os_booted_v1';   // sessionStorage：本会话是否已开机（关机/重启后清，重开则再放开机加载）
function isLoggedIn() { try { return sessionStorage.getItem(SESSION) === '1'; } catch (e) { return false; } }
function setLoggedIn(v) { try { v ? sessionStorage.setItem(SESSION, '1') : sessionStorage.removeItem(SESSION); } catch (e) {} }
function hasBooted() { try { return sessionStorage.getItem(BOOTED) === '1'; } catch (e) { return false; } }
function markBooted() { try { sessionStorage.setItem(BOOTED, '1'); } catch (e) {} }
function powerOff() { try { sessionStorage.removeItem(SESSION); sessionStorage.removeItem(BOOTED); } catch (e) {} }

function reduced() { try { return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || localStorage.getItem('os_reduce') === '1'; } catch (e) { return false; } }

function fullscreen() {
  const d = document.createElement('div');
  d.id = 'os-screen';
  d.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000;color:#e6e6e6;font-family:"Segoe UI","Microsoft YaHei",sans-serif;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;user-select:none';
  document.body.appendChild(d);
  return d;
}
function spinner(d) {
  const s = document.createElement('div');
  s.style.cssText = 'width:34px;height:34px;border:3px solid rgba(255,255,255,.25);border-top-color:#3ba0ff;border-radius:50%;margin:18px auto 0';
  if (!reduced()) s.style.animation = 'osspin 0.9s linear infinite';
  const st = document.createElement('style'); st.textContent = '@keyframes osspin{to{transform:rotate(360deg)}}';
  document.head.appendChild(st);
  d.appendChild(s);
}

// 开机：BIOS 自检逐行 → 潮声OS Logo + 进度条加载 → 回调
function boot(done) {
  const d = fullscreen();
  d.style.alignItems = 'flex-start'; d.style.padding = '28px 32px'; d.style.background = '#0a0a0a';
  const log = document.createElement('pre');
  log.style.cssText = 'font:13px/1.7 "Courier New",monospace;color:#7fe07f;margin:0;white-space:pre-wrap;text-align:left;width:100%';
  d.appendChild(log);
  const lines = [
    'FM-BIOS v99.4  (C) 蓝湾电子 1962–2003', 'CPU: SHEN-YAN @ 800MHz  OK',
    'Memory Test: 262144K  OK', 'Detect IDE Primary ..... 旧磁带机 [DETECTED]',
    '潮声 音频子系统 ......... INIT', '挂载档案分区 D: \\蓝湾\\1999 ...... OK',
    '', '> 正在启动 潮声 OS ...',
  ];
  let i = 0;
  const speed = reduced() ? 0 : 110;
  const iv = setInterval(() => {
    if (i < lines.length) { log.textContent += lines[i] + '\n'; i++; }
    else { clearInterval(iv); setTimeout(showOsLoading, reduced() ? 150 : 400); }
  }, speed || 1);

  // 第二阶段：Logo + 进度条 + 转圈（真·加载观感）
  function showOsLoading() {
    d.style.alignItems = 'center'; d.style.background = '#0a1622';
    d.innerHTML = '<div style="text-align:center;color:#cfe8ff;width:280px">' +
      '<div style="font-size:40px;line-height:1">📻</div>' +
      '<div style="font-size:22px;letter-spacing:6px;margin:12px 0 22px;font-weight:300">潮声 OS</div>' +
      '<div style="height:8px;border:1px solid rgba(180,220,255,.4);border-radius:5px;overflow:hidden;background:rgba(255,255,255,.06)"><div id="os-prog" style="height:100%;width:0;background:linear-gradient(90deg,#2b6cb0,#5fb0ff);transition:width .18s"></div></div>' +
      '<div id="os-loading-txt" style="margin-top:14px;font-size:12px;color:#8fb0cc;letter-spacing:1px">正在载入档案 …</div></div>';
    spinner(d, true);
    const bar = () => document.getElementById('os-prog');
    const txt = () => document.getElementById('os-loading-txt');
    if (reduced()) { if (bar()) bar().style.width = '100%'; setTimeout(() => done && done(), 300); return; }
    const steps = ['正在载入档案 …', '校验调阅权限 …', '重建声音索引 …', '接入 4.5Hz 底噪 …', '就差一个签名。'];
    let pct = 0, k = 0;
    const pv = setInterval(() => {
      pct = Math.min(100, pct + 8 + Math.random() * 14);
      const b = bar(); if (b) b.style.width = pct + '%';
      if (txt() && k < steps.length) { txt().textContent = steps[k++]; }
      if (pct >= 100) { clearInterval(pv); setTimeout(() => done && done(), 520); }
    }, reduced() ? 60 : 260);
  }
}

// 登录（有密码）
function login(onOk) {
  powerOff();
  // 去掉 boot 屏
  const old = document.getElementById('os-screen'); if (old) old.remove();
  const d = fullscreen();
  d.style.justifyContent = 'flex-end'; d.style.paddingBottom = '12vh';
  d.style.background = 'linear-gradient(160deg,#06182b 0%,#0a2b40 60%,#05131f 100%)';
  const clock = document.createElement('div'); clock.style.cssText = 'position:absolute;top:8%;font-size:64px;font-weight:200;color:#fff;letter-spacing:2px'; clock.textContent = nowHM();
  d.appendChild(clock);
  const tile = document.createElement('div'); tile.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px';
  tile.innerHTML = '<div style="width:96px;height:96px;border-radius:50%;background:#2b6cb0;display:flex;align-items:center;justify-content:center;font-size:40px;color:#fff;border:2px solid rgba(255,255,255,.5)">🎙</div>' +
    '<div style="color:#fff;font-size:20px">沈知微</div>';
  const form = document.createElement('div'); form.style.cssText = 'display:flex;gap:8px;margin-top:6px';
  const inp = document.createElement('input'); inp.type = 'password'; inp.placeholder = '输入登录密码'; inp.style.cssText = 'width:230px;padding:9px 12px;border:1px solid rgba(255,255,255,.4);border-radius:4px;background:rgba(0,0,0,.35);color:#fff;font-size:14px';
  const go = document.createElement('button'); go.textContent = '→'; go.style.cssText = 'width:42px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.12);color:#fff;border-radius:4px;cursor:pointer;font-size:16px';
  const hint = document.createElement('div'); hint.style.cssText = 'color:#9fb6c8;font-size:12px;margin-top:8px;max-width:280px';
  hint.textContent = '提示：这台机器登记的使用者，是沈砚的妹妹——用她的名字（拼音）登录。';
  const err = document.createElement('div'); err.style.cssText = 'color:#ff9a9a;font-size:12.5px;min-height:16px;margin-top:6px';
  form.appendChild(inp); form.appendChild(go);
  tile.appendChild(form); tile.appendChild(hint); tile.appendChild(err); d.appendChild(tile);
  setTimeout(() => inp.focus(), 60);
  const OK = ['zhiwei', 'shenzhiwei', '知微', '沈知微', 'szw'];
  function submit() {
    const v = (inp.value || '').trim().toLowerCase();
    if (OK.indexOf(v) !== -1) { setLoggedIn(true); d.remove(); if (onOk) onOk(); }
    else { err.textContent = '密码不对。（她叫沈知微。）'; tile.animate ? tile.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 280 }) : 0; inp.value = ''; inp.focus(); }
  }
  go.onclick = submit;
  inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
}

function nowHM() { const n = new Date(); return (n.getHours() < 10 ? '0' : '') + n.getHours() + ':' + (n.getMinutes() < 10 ? '0' : '') + n.getMinutes(); }

// 关机 / 重启 / 休眠 / 锁屏
function shutdown() {
  powerOff();
  const d = fullscreen();
  d.innerHTML = '<div style="color:#fff;font-size:18px">正在关机…</div>';
  spinner(d);
  setTimeout(() => {
    d.innerHTML = '<div style="color:#c8c8c8;font-size:15px;line-height:2">电源已切断。<br>这台机器停在了 2003 年的某个夜里。<br>想再听一次，就得自己按下去。</div>';
    const b = document.createElement('button'); b.textContent = '⏻ 重新开机';
    b.style.cssText = 'margin-top:20px;padding:9px 18px;border:1px solid #3ba0ff;background:rgba(59,160,255,.12);color:#cfe8ff;border-radius:6px;cursor:pointer;font-size:14px';
    b.onclick = () => { location.href = (window.ARG_RUNTIME && ARG_RUNTIME.config && ARG_RUNTIME.config.files && ARG_RUNTIME.config.files.node_prologue) || 'index.html'; };
    d.appendChild(b);
  }, reduced() ? 250 : 1800);
}
function restart() {
  powerOff();
  const d = fullscreen(); d.innerHTML = '<div style="color:#fff;font-size:18px">正在重新启动…</div>'; spinner(d);
  setTimeout(() => { const old = document.getElementById('os-screen'); if (old) old.remove(); boot(() => login(() => location.reload())); }, reduced() ? 250 : 1700);
}
function sleep() {
  const d = fullscreen(); d.style.background = '#000';
  const clock = document.createElement('div'); clock.style.cssText = 'color:#e6e6e6;font-size:56px;font-weight:200'; clock.textContent = nowHM();
  const hint = document.createElement('div'); hint.style.cssText = 'color:#5a7183;font-size:13px;margin-top:14px'; hint.textContent = '已休眠 · 点按任意处唤醒';
  d.appendChild(clock); d.appendChild(hint);
  const wake = () => { const e = document.getElementById('os-screen'); if (e) e.remove(); document.removeEventListener('pointerdown', wake); document.removeEventListener('keydown', wake); };
  setTimeout(() => { document.addEventListener('pointerdown', wake); document.addEventListener('keydown', wake); }, 120);
}
function lock() { setLoggedIn(false); login(() => location.reload()); }


/* ---- osdoc.mjs ---- */
// src/runtime/osdoc.mjs — 窗口内文档阅读器：取目标页正文，在 Explorer 窗口里分页/搜索呈现；取不到则回退整页导航





function fileFor(id) { return (config.files && config.files[id]) || (id === 'node_prologue' ? 'index.html' : id + '.html'); }

// 从一段 HTML 文本抽取正文（data-arg-slot=body 优先，兜底常见正文容器）
function extractBody(html) {
  let m = html.match(/<[^>]*data-arg-slot="body"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
  if (!m) m = html.match(/<[^>]*class="[^"]*(?:cyber-body|scp-body|diary-content|news-content|mag-body|bbs-post-body)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
  if (!m) { const t = html.match(/<title>([\s\S]*?)<\/title>/i); return t ? t[1].trim() : ''; }
  return m[1]
    .replace(/<br\s*\/?>(?=)/gi, '\u0000') // 先占位保护换行
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\u0000/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
function extractTitle(html) { const t = html.match(/<title>([\s\S]*?)<\/title>/i); return t ? t[1].replace(/\[[^\]]*\]\s*/g, '').trim() : ''; }

const PER_PAGE = 12; // 段/页

function openDoc(nodeId, title) {
  const url = fileFor(nodeId);
  return openWindow({
    id: 'os_doc_' + nodeId, title: '📄 ' + (title || nodeId), w: 560, h: 460,
    render: (body, win) => {
      body.style.cssText = 'display:flex;flex-direction:column;height:100%';
      const tb = document.createElement('div'); tb.style.cssText = 'display:flex;gap:6px;align-items:center;padding:4px 6px;border-bottom:1px solid rgba(0,0,0,.2);font-size:12px';
      const q = document.createElement('input'); q.placeholder = '文内搜索…'; q.style.cssText = 'flex:1;padding:3px 6px;border:1px solid rgba(0,0,0,.3);border-radius:4px;background:#fff;color:#111';
      const nav = document.createElement('div'); nav.style.cssText = 'flex:1;overflow:auto;padding:12px 14px;line-height:1.9;font-size:14px;white-space:pre-wrap';
      const pager = document.createElement('div'); pager.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;padding:4px;border-top:1px solid rgba(0,0,0,.2);font-size:12px';
      const prev = document.createElement('button'); prev.textContent = '‹ 上页'; const next = document.createElement('button'); next.textContent = '下页 ›'; const label = document.createElement('span');
      tb.appendChild(q); pager.appendChild(prev); pager.appendChild(label); pager.appendChild(next);
      body.appendChild(tb); body.appendChild(nav); body.appendChild(pager);

      let paras = [];
      try { paras = (localStorage.getItem('arg_doccache_' + nodeId) || '').split('\u0001'); } catch (e) {}
      let page = 0, filter = '';
      function paint() {
        const list = filter ? paras.filter((p) => p.toLowerCase().includes(filter)) : paras;
        const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
        page = Math.min(page, pages - 1);
        const slice = list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).join('\n\n');
        nav.innerHTML = slice ? escapeHtml(slice) : '<i>（此页无正文，或为纯图/交互页）</i>';
        label.textContent = (page + 1) + ' / ' + pages + ' 页 · ' + list.length + ' 段';
        prev.disabled = page <= 0; next.disabled = page >= pages - 1;
      }
      function load(txt, ttl) {
        paras = txt.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
        try { localStorage.setItem('arg_doccache_' + nodeId, paras.join('\u0001')); } catch (e) {}
        if (ttl) win.el.querySelector('.os-title').textContent = '📄 ' + ttl;
        if (!paras.length) { nav.innerHTML = '本页无文本正文。'; label.textContent = '0 段'; }
      }
      if (paras.length > 1 && paras[0]) { paint(); }
      else {
        nav.textContent = '正在载入 …';
        fetch(url, { cache: 'force-cache' }).then((r) => r.text()).then((html) => {
          const txt = extractBody(html); load(txt, extractTitle(html)); win.res && (win.res.textContent = nodeId); paint();
        }).catch(() => {
          nav.innerHTML = '（离线/本地 file:// 无法在此窗内预览。）<br><a style="color:#22d3ee;cursor:pointer;text-decoration:underline">→ 整页打开</a>';
          const a = nav.querySelector('a'); if (a) a.onclick = () => go(nodeId);
        });
      }
      q.addEventListener('input', () => { filter = q.value.trim().toLowerCase(); page = 0; paint(); });
      prev.onclick = () => { page--; paint(); playSynthSound('click'); };
      next.onclick = () => { page++; paint(); playSynthSound('click'); };
      nav.tabIndex = 0;
      nav.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { page = Math.max(0, page - 1); paint(); } if (e.key === 'ArrowRight') { page++; paint(); } });
    },
  });
}


/* ---- osexplorer.mjs ---- */
// src/runtime/osexplorer.mjs — 资源管理器 App（消费 arg-vfs.js：目录树 + 文件区四视图 + 面包屑 + 排序 + 多选 + 右键 + ACL）






const V = () => (typeof window !== 'undefined' && window.ARG_VFS) || { folders: [], lockedBy: {} };
const ICON = { doc:'📄', txt:'📃', pdf:'📕', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', wav:'🎧', mp3:'🎵', exe:'⚙️', msg:'✉️' };
function extOf(name) { const m = /\.(txt|pdf|jpg|jpeg|png|wav|mp3|exe|doc|msg)$/i.exec(name || ''); return m ? m[1].toLowerCase() : 'doc'; }

function openExplorer(startFolder) {
  return openWindow({
    id: 'os_explorer', title: '潮声资源管理器', w: 640, h: 440,
    render: (body, win) => renderExplorer(body, win, startFolder),
  });
}

// 由“某个文件柜/回收站页自身的 config.links”构造一个专属文件夹（name→{id,name,lockedBy}）
function folderFromLinks(pageName, linksMap) {
  const vfs = V();
  const items = Object.entries(linksMap || {}).map(([label, id]) => ({ id, name: label, lockedBy: (vfs.lockedBy && vfs.lockedBy[id]) || null }));
  return { folder: pageName, items, custom: true };
}

function renderExplorer(body, win, startFolder) {
  const vfs = V();
  const allFolders = vfs.folders.slice();
  if (startFolder && startFolder.custom) allFolders.unshift(startFolder); // 专属夹置顶
  let cur = (startFolder && startFolder.custom) ? startFolder
    : (allFolders.find((f) => f.folder === startFolder) || allFolders[0]);
  let view = 'list', sortKey = 'name', sortDir = 1, sel = new Set();

  body.style.cssText = 'display:flex;height:100%';
  const tree = document.createElement('div'); tree.className = 'os-tree'; tree.style.cssText = 'width:180px;overflow:auto;border-right:1px solid rgba(0,0,0,.25);flex:0 0 auto;font-size:12.5px;padding:4px 0';
  const main = document.createElement('div'); main.style.cssText = 'flex:1;display:flex;flex-direction:column;min-width:0';
  body.appendChild(tree); body.appendChild(main);

  const nav = document.createElement('div'); nav.className = 'os-nav'; nav.style.cssText = 'display:flex;gap:6px;align-items:center;padding:4px 6px;border-bottom:1px solid rgba(0,0,0,.2);font-size:12px';
  const crumbs = document.createElement('div'); crumbs.style.cssText = 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  const seg = (t, on) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'border:1px solid rgba(0,0,0,.35);background:var(--os-btn);color:var(--os-btn-fg);cursor:pointer;border-radius:var(--os-radius);padding:1px 6px;font-size:11px'; if (on) { b.style.background = 'var(--os-accent)'; b.style.color = '#fff'; } b.onclick = () => { view = t; renderList(); }; return b; };
  nav.appendChild(crumbs); ['图标', '列表', '详细', '平铺'].forEach((v) => nav.appendChild(seg(v, false)));
  const mainHost = document.createElement('div'); mainHost.className = 'os-list'; mainHost.style.cssText = 'flex:1;overflow:auto';
  const status = document.createElement('div'); status.className = 'os-status'; status.style.cssText = 'border-top:1px solid rgba(0,0,0,.2);padding:2px 8px;font-size:11.5px;color:var(--os-muted)';
  main.appendChild(nav); main.appendChild(mainHost); main.appendChild(status); win.res.textContent = '资源管理器';

  function renderTree() {
    tree.innerHTML = '';
    allFolders.filter((f) => f.custom || f.items.some(acc)).forEach((f) => {
      const n = document.createElement('div'); n.className = 'os-node'; n.textContent = f.folder; n.title = f.folder;
      n.style.cssText = 'padding:2px 8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      if (f === cur) { n.classList.add('sel'); n.style.background = 'var(--os-sel)'; n.style.color = '#fff'; }
      n.onclick = () => { cur = f; sel.clear(); renderTree(); renderList(); };
      tree.appendChild(n);
    });
  }
  function locked(it) { return it.lockedBy ? !hasClue(it.lockedBy) : false; }
  function realName(it) { const N = (typeof window !== 'undefined' && window.ARG_DATA && window.ARG_DATA.names) || {}; return it.name || N[it.id] || it.id; }
  function dispName(it) { return locked(it) ? '🔒 加密档案 · 未解锁' : realName(it); }
  // 防泄露：锁住且未解锁的条目【整条隐藏】，不暴露其存在/数量；只有解锁后才现身
  function acc(it) { return !locked(it); }
  function sorted() {
    const arr = cur.items.filter(acc);
    arr.sort((a, b) => { const ka = sortKey === 'size' ? String(realName(a)).length : (sortKey === 'type' ? a.id : realName(a)), kb = sortKey === 'size' ? String(realName(b)).length : (sortKey === 'type' ? b.id : realName(b)); return String(ka).localeCompare(String(kb), 'zh') * sortDir; });
    return arr;
  }
  function open(it) { if (locked(it)) { playSynthSound('error'); toast('🔒 无权访问：' + realName(it) + '（先解锁 ' + it.lockedBy + '）'); return; } playSynthSound('click'); openDoc(it.id, realName(it)); }
  function openFull(it) { if (locked(it)) { toast('🔒 未解锁'); return; } go(it.id); }

  function renderList() {
    mainHost.innerHTML = '';
    crumbs.textContent = '🖥️ 我的电脑 › ' + cur.folder;
    [...nav.querySelectorAll('button')].forEach((b) => { const on = ['图标','列表','详细','平铺'][['图标','列表','详细','平铺'].indexOf(b.textContent)] === view; b.style.background = on ? 'var(--os-accent)' : 'var(--os-btn)'; b.style.color = on ? '#fff' : 'var(--os-btn-fg)'; });
    const items = sorted();
    if (view === '详细') {
      const t = document.createElement('table'); t.style.cssText = 'width:100%;border-collapse:collapse;font-size:12.5px';
      const head = document.createElement('tr');
      [['名称','name'],['类型','type'],['大小','size']].forEach(([lab,k]) => { const th = document.createElement('th'); th.textContent = lab + (sortKey===k ? (sortDir>0?' ▲':' ▼') : ''); th.style.cssText='text-align:left;padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.3);cursor:pointer;user-select:none'; th.onclick=()=>{ if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=1;} renderList(); }; head.appendChild(th); });
      t.appendChild(head);
      items.forEach((it) => { const tr = document.createElement('tr'); if (sel.has(it.id)) tr.style.background = 'var(--os-sel)'; tr.onclick = (e) => { if (!e.ctrlKey && !e.metaKey) sel.clear(); sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); renderList(); }; tr.ondblclick = () => open(it); tr.oncontextmenu = (e) => { e.preventDefault(); menu(e, it); };
        ['<td>'+ escapeHtml(dispName(it)) +'</td>','<td>' + extOf(realName(it)).toUpperCase() + ' 文件</td>','<td>' + ((realName(it).length*137)%900+80) + ' KB</td>'].forEach((c) => { const td = document.createElement('td'); td.innerHTML = c; td.style.cssText = 'padding:2px 8px;border-bottom:1px solid rgba(0,0,0,.08);opacity:' + (locked(it)?'.5':'1'); tr.appendChild(td); });
        t.appendChild(tr); });
      mainHost.appendChild(t);
    } else {
      const grid = document.createElement('div');
      grid.style.cssText = view === '平铺' ? 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:8px'
        : view === '图标' ? 'display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;padding:10px'
        : 'display:flex;flex-direction:column';
      items.forEach((it) => {
        const cell = document.createElement('div'); const lk = locked(it);
        cell.style.cssText = 'display:flex;align-items:center;gap:8px;padding:' + (view==='列表'?'2px 8px':'8px') + ';cursor:pointer;border-radius:var(--os-radius);' + (sel.has(it.id) ? 'background:var(--os-sel);color:#fff' : '');
        cell.innerHTML = '<span style="font-size:' + (view === '图标' || view === '平铺' ? '30px' : '16px') + '">' + (lk ? '🔒' : ICON[extOf(realName(it))]) + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:' + (lk ? '.6' : '1') + '">' + escapeHtml(dispName(it)) + '</span>';
        cell.onclick = (e) => { if (!e.ctrlKey && !e.metaKey) sel.clear(); sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); renderList(); };
        cell.ondblclick = () => open(it);
        cell.oncontextmenu = (e) => { e.preventDefault(); menu(e, it); };
        grid.appendChild(cell);
      });
      mainHost.appendChild(grid);
    }
    status.textContent = items.length + ' 个项目' + (sel.size ? ' ｜ 已选 ' + sel.size : '');
  }

  let tmr;
  function toast(t) { status.textContent = t; clearTimeout(tmr); tmr = setTimeout(renderList, 3000); }
  function menu(e, it) {
    document.querySelectorAll('.os-menu').forEach((m) => m.remove());
    const m = document.createElement('div'); m.className = 'os-menu'; m.style.cssText = 'position:fixed;z-index:99998;min-width:160px;background:var(--os-face);border:var(--os-border);box-shadow:var(--os-shadow);padding:3px;font-size:12.5px';
    const item = (lab, fn, dis) => { const b = document.createElement('div'); b.textContent = lab; b.style.cssText = 'padding:5px 10px;cursor:' + (dis ? 'not-allowed' : 'pointer') + ';color:' + (dis ? '#999' : 'var(--os-fg)'); if (!dis) b.onmouseenter = () => b.style.background = 'var(--os-accent)', b.onmouseleave = () => b.style.background = '', b.onclick = () => { m.remove(); fn(); }; b.onmouseenter = () => { if (!dis) b.style.background = 'var(--os-accent)'; }; b.onmouseleave = () => (b.style.background = ''); return b; };
    m.appendChild(item('打开（窗口内阅读）', () => open(it)));
    m.appendChild(item('整页打开', () => openFull(it)));
    m.appendChild(item('重命名（只读档案）', () => toast('调查资料不可重命名。'), true));
    m.appendChild(item('属性', () => toast(it.id + ' · ' + extOf(it.name) + (it.lockedBy ? ' · 需 ' + it.lockedBy : ''))));
    m.style.left = Math.min(e.clientX, innerWidth - 180) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - 120) + 'px';
    document.body.appendChild(m);
    setTimeout(() => document.addEventListener('click', function h() { m.remove(); document.removeEventListener('click', h); }), 0);
  }

  renderTree(); renderList();
}


/* ---- osmail.mjs ---- */
// src/runtime/osmail.mjs — 邮件客户端：把 mail_/pm_/letter_ 节点当收件箱，未读标记、窗口内读信





const READ_KEY = 'os_mail_read_v1';
function readSet() { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch (e) { return new Set(); } }
function markRead(id) { try { const s = readSet(); if (!s.has(id)) { s.add(id); localStorage.setItem(READ_KEY, JSON.stringify([...s])); } } catch (e) {} }

function mailItems() {
  const vfs = (typeof window !== 'undefined' && window.ARG_VFS) || { folders: [] };
  const out = [];
  for (const f of vfs.folders) for (const it of f.items) {
    if (/^(mail_|pm_|letter_)/.test(it.id) && it.id !== 'letter_new') out.push(it);
  }
  return out;
}

function openMail() {
  return openWindow({
    id: 'os_mail', title: '📮 潮声信箱', w: 560, h: 420,
    render: (body, win) => {
      body.style.cssText = 'display:flex;height:100%';
      const list = document.createElement('div'); list.style.cssText = 'width:230px;flex:0 0 auto;overflow:auto;border-right:1px solid rgba(0,0,0,.25)';
      const pane = document.createElement('div'); pane.style.cssText = 'flex:1;overflow:auto;padding:12px 14px;line-height:1.9;font-size:14px;white-space:pre-wrap';
      pane.innerHTML = '<i style="opacity:.6">← 选一封。锁着的（🔒）要先到对应档案页解锁。</i>';
      body.appendChild(list); body.appendChild(pane);

      const items = mailItems();
      const read = readSet();
      let unread = items.filter((it) => !read.has(it.id) && !it.lockedBy).length;
      function paintList(selId) {
        list.innerHTML = '';
        const head = document.createElement('div'); head.style.cssText = 'padding:6px 8px;font-size:11.5px;border-bottom:1px solid rgba(0,0,0,.2);color:var(--os-muted)';
        head.textContent = '收件箱 · ' + items.length + ' 封 · 未读 ' + unread; list.appendChild(head);
        items.forEach((it) => {
          const locked = it.lockedBy && !hasClue(it.lockedBy);
          const row = document.createElement('div');
          const isRead = read.has(it.id);
          row.style.cssText = 'padding:7px 9px;border-bottom:1px solid rgba(0,0,0,.08);cursor:pointer;font-size:12.5px;' + (selId === it.id ? 'background:var(--os-sel);color:#fff' : '') + (locked ? ';opacity:.55' : '');
          row.innerHTML = '<div style="font-weight:' + (isRead || locked ? 'normal' : 'bold') + '">' + (locked ? '🔒 ' : isRead ? '・ ' : '<b>▸ </b>') + escape(it.name) + '</div>' +
            '<div style="font-size:10.5px;opacity:.7">' + it.id.replace(/_(.)/g, (m, c) => ' ' + c.toUpperCase()) + '</div>';
          row.onclick = () => openMail2(it, locked, row, it.id);
          list.appendChild(row);
        });
      }
      function escape(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); }
      function openMail2(it, locked, row, id) {
        if (locked) { playSynthSound('error'); pane.innerHTML = '🔒 这封信要先解锁来源页（' + it.lockedBy + '）。'; return; }
        playSynthSound('click');
        paintList(id);
        // 窗口内直接取正文预览；同时提供“全屏打开”
        pane.innerHTML = '正在拆信 …';
        const url = it.id + '.html';
        fetch(url, { cache: 'force-cache' }).then((r) => r.text()).then((html) => {
          let m = html.match(/<[^>]*data-arg-slot="body"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
          const txt = m ? m[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim() : '（此信无文本正文）';
          pane.innerHTML = ''; const t = document.createElement('div'); t.style.cssText = 'font-weight:bold;margin-bottom:8px;border-bottom:1px dashed rgba(0,0,0,.3);padding-bottom:4px'; t.textContent = '📨 ' + it.name; pane.appendChild(t);
          const b = document.createElement('div'); b.textContent = txt.slice(0, 1200); pane.appendChild(b);
          const more = document.createElement('div'); more.style.marginTop = '10px'; const a = document.createElement('a'); a.textContent = '→ 全屏阅读 / 继续往来'; a.style.cssText = 'color:var(--os-accent);cursor:pointer;text-decoration:underline'; a.onclick = () => openDoc(it.id, it.name); more.appendChild(a); pane.appendChild(more);
          if (!read.has(it.id)) { markRead(it.id); unread = Math.max(0, unread - 1); }
        }).catch(() => { pane.innerHTML = '（离线无法预览。）'; });
      }
      paintList();
    },
  });
}


/* ---- oscontrol.mjs ---- */
// src/runtime/oscontrol.mjs — 控制面板 App：皮肤切换 + 减少动效 + 高对比 + 存档导出/导入/重置





function toggleClass(cls, on) { try { document.documentElement.classList.toggle(cls, !!on); } catch (e) {} }
function persistPref(k, v) { try { localStorage.setItem(k, v ? '1' : ''); } catch (e) {} }

function applyOsuia11y() {
  try {
    toggleClass('os-reduce', localStorage.getItem('os_reduce') === '1');
    toggleClass('os-contrast', localStorage.getItem('os_contrast') === '1');
  } catch (e) {}
}

function openControlPanel(onThemeChange) {
  return openWindow({
    id: 'os_control', title: '🎛️ 控制面板', w: 400, h: 340,
    render: (body, win) => {
      body.style.padding = '12px 14px';
      const h = (t) => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'font-weight:bold;margin:10px 0 4px;font-size:13px'; return d; };
      const row = () => { const d = document.createElement('label'); d.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;padding:3px 0;cursor:pointer'; return d; };
      // 皮肤
      body.appendChild(h('桌面皮肤'));
      const grp = document.createElement('div');
      Object.keys(SKINS).forEach((k) => {
        const r = row(); const rb = document.createElement('input'); rb.type = 'radio'; rb.name = 'os_skin'; rb.checked = currentTheme() === k;
        rb.onchange = () => { applyTheme(k); playSynthSound('unlock'); if (onThemeChange) onThemeChange(k); };
        r.appendChild(rb); r.appendChild(document.createTextNode(SKINS[k].label)); grp.appendChild(r);
      });
      body.appendChild(grp);
      // 无障碍
      body.appendChild(h('无障碍'));
      const mkToggle = (key, lab, cls) => { const r = row(); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = (localStorage.getItem(key) === '1'); c.onchange = () => { persistPref(key, c.checked); toggleClass(cls, c.checked); playSynthSound('click'); }; r.appendChild(c); r.appendChild(document.createTextNode(lab)); body.appendChild(r); };
      mkToggle('os_reduce', '减少动效（关打字机/闪烁/噪点）', 'os-reduce');
      mkToggle('os_contrast', '高对比度', 'os-contrast');
      // 存档
      body.appendChild(h('调查存档'));
      const btn = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'margin:3px 6px 3px 0;padding:5px 10px;border:1px solid rgba(0,0,0,.4);background:var(--os-btn);color:var(--os-btn-fg);border-radius:var(--os-radius);cursor:pointer'; b.onclick = () => { playSynthSound('click'); fn(); }; return b; };
      body.appendChild(btn('导出存档码', () => exportSave()));
      body.appendChild(btn('导入存档码', () => importSavePrompt()));
      const info = document.createElement('div'); info.style.cssText = 'margin-top:8px;font-size:11.5px;color:var(--os-muted)';
      info.textContent = '存档保存在本机浏览器(localStorage)。导出码可跨设备续玩。';
      body.appendChild(info);
    },
  });
}


/* ---- osshell.mjs ---- */
// src/runtime/osshell.mjs — 潮声OS 装配：会话(开机/登录) + 任务栏 + 开始/电源菜单 + 文件柜/回收站用资源管理器呈现








function isCabinetPage() { return !!document.querySelector('.folder'); }
function isDesktopPage() { return !!(document.querySelector('.winxp-desktop') || document.querySelector('.desktop-icons') || document.querySelector('.desktop-main')); }
function isOSTargetPage() { return typeof document !== 'undefined' && (isCabinetPage() || isDesktopPage()); }
function selfName(nid) { const n = (window.ARG_DATA && window.ARG_DATA.names) || {}; return n[nid] || (isCabinetPage() ? '文件柜' : '桌面'); }
function guessFolder(nodeId) {
  const vfs = (window.ARG_VFS) || { folders: [] };
  for (const f of vfs.folders) if (f.items.some((it) => it.id === nodeId)) return f.folder;
  return null;
}

function ensureOS() {
  if (typeof document === 'undefined') return;
  if (window.__osBooted || !isOSTargetPage()) return;
  window.__osBooted = true;
  const proceed = () => { if (isLoggedIn()) buildShell(); else login(() => buildShell()); };
  if (hasBooted()) proceed();                 // 本会话已开过机：直接进（翻文件夹不再重放开机）
  else boot(() => { markBooted(); proceed(); }); // 首次通电：完整开机加载
}

function buildShell() {
  const cfg = (window.ARG_RUNTIME && window.ARG_RUNTIME.config) || {};
  const nid = cfg.nodeId || '';
  // 文件柜/回收站页：有可展示内容时才交给资源管理器并隐藏旧界面（否则保留原页，避免点开空白“不能用”）
  if (isCabinetPage()) {
    const links = cfg.links || {};
    const back = {}; const seenT = new Set();
    for (const [lab, target] of Object.entries(links)) {
      if (!target || typeof target !== 'string') continue;
      if (/返回|回桌面|桌面|工作台/.test(lab)) continue;
      if (/\.html$/.test(lab) || /^[a-z0-9_]+$/.test(lab)) continue;   // 丢裸 id / .html 变体
      if (target === 'node_desktop' || seenT.has(target)) continue;     // 按目标去重
      seenT.add(target); back[lab] = target;
    }
    if (Object.keys(back).length) {
      let st = document.getElementById('os-cabinet-style');
      if (!st) { st = document.createElement('style'); st.id = 'os-cabinet-style'; st.textContent = '.folder,.folder-container,body.os-cab>h1,body.os-cab>.breadcrumb{display:none!important}body.os-cab{background:linear-gradient(160deg,#0a1622,#0d2233 60%,#08131d)!important}'; document.head.appendChild(st); }
      document.body.classList.add('os-cab');
      window.__osCab = { name: selfName(nid), links: back };
    }
  }

  const layer = document.createElement('div'); layer.id = 'os-layer';
  layer.style.cssText = 'position:fixed;inset:0 0 30px 0;z-index:99980;pointer-events:none;';
  document.body.appendChild(layer);
  const work = document.createElement('div'); work.className = 'os-workarea'; work.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  layer.appendChild(work);

  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:30px;z-index:99985;display:flex;align-items:center;gap:6px;padding:0 6px;background:var(--os-titlebar,#000080);color:#fff;font-family:Tahoma,sans-serif;font-size:12px;box-shadow:0 -2px 8px rgba(0,0,0,.3)';
  const start = document.createElement('button'); start.textContent = '▶ 开始'; start.style.cssText = 'border:none;border-radius:6px;padding:3px 10px;font-weight:bold;cursor:pointer;background:linear-gradient(#e8e8e8,#cfcfcf);color:#111';
  const tasks = document.createElement('div'); tasks.className = 'os-tasks'; tasks.style.cssText = 'display:flex;gap:5px;flex:1;overflow:hidden';
  const thm = document.createElement('button'); thm.textContent = '🎨 ' + (SKINS[currentTheme()] || { label: '皮肤' }).label.split(' ')[0]; thm.style.cssText = 'border:none;border-radius:6px;padding:3px 8px;cursor:pointer;background:rgba(255,255,255,.18);color:#fff';
  const clock = document.createElement('span'); clock.style.cssText = 'padding:0 8px;color:#dbeafe';
  const tick = () => { const n = new Date(); clock.textContent = (n.getHours() < 10 ? '0' : '') + n.getHours() + ':' + (n.getMinutes() < 10 ? '0' : '') + n.getMinutes(); };
  tick(); setInterval(tick, 20000);
  const powerBtn = document.createElement('button'); powerBtn.textContent = '⏻'; powerBtn.title = '电源'; powerBtn.style.cssText = 'border:none;border-radius:6px;padding:3px 8px;cursor:pointer;background:rgba(255,255,255,.12);color:#fff;font-size:14px';
  bar.appendChild(start); bar.appendChild(tasks); bar.appendChild(thm); bar.appendChild(powerBtn); bar.appendChild(clock);
  document.body.appendChild(bar);

  initOS({ work, bar: tasks });
  try { applyOsuia11y(); } catch (e) {}
  const fixPE = () => { document.querySelectorAll('#os-layer .os-win').forEach((w) => (w.style.pointerEvents = 'auto')); };
  try { const mo = new MutationObserver(fixPE); mo.observe(work, { childList: true }); } catch (e) {}

  function openSelfFolder() {
    const w = (window.__osCab && Object.keys(window.__osCab.links).length)
      ? openExplorer(folderFromLinks(window.__osCab.name, window.__osCab.links))
      : openExplorer(guessFolder(nid) || undefined);
    fixPE();
    return w;
  }
  function popup(anchorEl, items) {
    document.querySelectorAll('.os-menu').forEach((m) => m.remove());
    const m = document.createElement('div'); m.className = 'os-menu';
    const r = anchorEl.getBoundingClientRect();
    m.style.cssText = 'position:fixed;bottom:' + (window.innerHeight - r.top + 4) + 'px;left:' + r.left + 'px;z-index:99986;min-width:170px;background:var(--os-face);border:var(--os-border);box-shadow:var(--os-shadow);padding:4px;color:var(--os-fg);font-size:12.5px';
    items.forEach(([lab, fn, dis]) => { const b = document.createElement('div'); b.textContent = lab; b.style.cssText = 'padding:7px 10px;cursor:' + (dis ? 'not-allowed' : 'pointer') + ';border-radius:3px;color:' + (dis ? '#999' : 'var(--os-fg)'); if (!dis) b.onclick = () => { m.remove(); fn(); }; b.onmouseenter = () => { if (!dis) b.style.background = 'var(--os-accent)'; }; b.onmouseleave = () => (b.style.background = ''); m.appendChild(b); });
    document.body.appendChild(m);
    setTimeout(() => document.addEventListener('click', function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', h); } }), 0);
  }
  start.onclick = () => { playSynthSound('click'); popup(start, [
    ['📁 资源管理器', openSelfFolder],
    ['📮 潮声信箱', () => { openMail(); fixPE(); }],
    ['🎛️ 控制面板', () => { openControlPanel((k) => { thm.textContent = '🎨 ' + SKINS[k].label.split(' ')[0]; }); fixPE(); }],
    ['🖥️ 关于本机', () => { openWindow({ id: 'os_about', title: '关于本机', w: 360, h: 200, render: (b) => { b.style.padding = '12px'; b.innerHTML = '<b>潮声 OS · FM99.4</b><br>声音修复师工作台<br>窗口 ' + listWindows().length + ' 个<br>皮肤 ' + (SKINS[currentTheme()] || {}).label; } }); fixPE(); }],
  ]); };
  function cycleTheme() { const keys = Object.keys(SKINS); const next = keys[(keys.indexOf(currentTheme()) + 1) % keys.length]; applyTheme(next); thm.textContent = '🎨 ' + SKINS[next].label.split(' ')[0]; playSynthSound('unlock'); }
  thm.onclick = cycleTheme;
  powerBtn.onclick = () => { playSynthSound('click'); popup(powerBtn, [
    ['🌙 休眠', () => sleep()],
    ['🔒 锁屏', () => lock()],
    ['🔄 重新启动', () => restart()],
    ['⏻ 关机', () => shutdown()],
  ]); };

  // 悬浮图标
  const dicon = document.createElement('div'); dicon.textContent = '🗑️ 回收站';
  dicon.style.cssText = 'position:fixed;right:12px;top:44px;z-index:99987;cursor:pointer;background:rgba(0,0,0,.4);color:#fff;font:12px/1 Tahoma,sans-serif;padding:7px 11px;border-radius:8px;box-shadow:var(--os-shadow);user-select:none';
  dicon.onclick = () => { playSynthSound('click'); if (nid !== 'node_recycle') location.href = 'node_recycle.html'; else openSelfFolder(); };
  const pc = document.createElement('div'); pc.textContent = '💻 我的电脑';
  pc.style.cssText = 'position:fixed;right:12px;top:12px;z-index:99987;cursor:pointer;background:var(--os-titlebar,#000080);color:#fff;font:12px/1 Tahoma,sans-serif;padding:7px 11px;border-radius:8px;box-shadow:var(--os-shadow);user-select:none';
  pc.onclick = openSelfFolder;
  document.body.appendChild(pc); document.body.appendChild(dicon);

  // 自动开一次资源管理器（关过后本会话不再弹）
  let dismissed = false; try { dismissed = sessionStorage.getItem('os_exp_dismissed') === '1'; } catch (e) {}
  if (!dismissed) { const w = openSelfFolder(); if (w && w.el) { const ob = w.el.querySelector('.os-bar button:last-child'); if (ob) ob.addEventListener('click', () => { try { sessionStorage.setItem('os_exp_dismissed', '1'); } catch (e) {} }); } }
}


/* ---- index.mjs ---- */
// src/runtime/index.mjs — 装配入口 bind()、对外 API、维基侧栏接线、彩蛋


















function bind() {
  if (window.__argBound) return;
  window.__argBound = true;
  document.querySelectorAll('[data-arg-component="search"]').forEach(bindSearch);
  document.querySelectorAll('[data-arg-component="login"]').forEach(bindLogin);
  document.querySelectorAll('[data-arg-component="chat"]').forEach(bindChat);

  if (config.typewriter) {
    document.querySelectorAll('[data-arg-slot="body"], [data-arg-slot="message"]').forEach(el => applyTypewriter(el, 48));
  }
  if (config.atmosphere) document.body.classList.add('arg-atmosphere-' + config.atmosphere);

  document.addEventListener('click', function (e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-arg-link], [data-arg-port]') : null;
    if (el) { e.preventDefault(); const port = el.dataset.argLink || el.dataset.argPort; if (port) checkLink(port); }
  });
  document.addEventListener('dblclick', function (e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-arg-link], [data-arg-port]') : null;
    if (el) { e.preventDefault(); const port = el.dataset.argLink || el.dataset.argPort; if (port) checkLink(port); }
  });

  try { ensureViewportMeta(); } catch (e) {}
  try { ensureLandscapeProbe(); } catch (e) {}
  try { ensureGameClock(); } catch (e) {}
  try { ensureNotifyRelay(); } catch (e) {}
  try { ensurePostLock(); } catch (e) {}
  try { ensureForumLife(); } catch (e) {}
  try { if (config.isSearch && config.shadowKey && isShadow()) applyShadowSkin(false); } catch (e) {}
  try {
    if (document.querySelector('.win98-desktop,.xp-desktop,.winxp-desktop,.macos-desktop,.cyber-desktop,.dark-desktop,.desktop-main,.mac-main-area')) {
      ensureWindowManager(); ensurePowerMenu(); ensureTrayTexture();
    }
  } catch (e) {}
  try { ensureProgressPill(); } catch (e) {}
  try { ensureDroneToggle(); } catch (e) {}
  try { trackVisit(); } catch (e) {}
  try { ensureStats(); } catch (e) {}
  try { ensureNameInput(); } catch (e) {}
  try { ensureGlobalSkin(); } catch (e) {}
  try { runPuzzleHost(); } catch (e) {}
  try { ensureOS(); } catch (e) {}

  // 维基侧栏：给「首页/最近更改/随机条目/绝密专题」真实功能
  try {
    const menu = document.querySelector('.wiki-menu');
    if (menu && !menu.dataset.wired) {
      menu.dataset.wired = '1';
      const wst = document.createElement('style');
      wst.textContent = '.wiki-menu-item{cursor:pointer;transition:all .15s}.wiki-menu-item:hover{color:#1a58d8;text-decoration:underline}';
      document.head.appendChild(wst);
      const WMAP = { '首页': 'node_desktop', '最近更改': 'node_timeline', '绝密专题': 'node_login_hard' };
      menu.querySelectorAll('.wiki-menu-item').forEach(function (el) {
        const t = el.textContent.trim();
        el.addEventListener('click', function () {
          playSynthSound('click');
          if (t === '随机条目') {
            const jump = function (idx) {
              let pool = (idx && idx.length) ? idx : Object.keys(config.files || {}).map(function (k) { return { id: k }; });
              pool = pool.filter(function (x) { return !/^end_/.test(x.id); });
              if (!pool.length) return;
              let pick = pool[Math.floor(Math.random() * pool.length)], guard = 0;
              while (guard++ < 10 && pick.id === config.nodeId) pick = pool[Math.floor(Math.random() * pool.length)];
              go(pick.id);
            };
            if (window.ARG_SEARCH_INDEX) jump(window.ARG_SEARCH_INDEX);
            else {
              const s = document.createElement('script'); s.src = 'arg-search-index.js?r=' + Date.now();
              s.onload = function () { jump(window.ARG_SEARCH_INDEX || []); };
              s.onerror = function () { jump([]); };
              document.head.appendChild(s);
            }
          } else if (WMAP[t]) { go(WMAP[t]); }
        });
      });
    }
  } catch (e) {}

  try { console.log('%cFM 99.4 · 潮声%c ——还有人的名字，没有被念完。', 'color:#22d3ee;font-weight:bold', 'color:#94a3b8'); } catch (e) {}

  // 对外 API
  window.ARG_RUNTIME = { go, checkLink, playSynthSound, triggerClue, getClues, checkRule, config, registerGame };
}

function bootGlobalApi() {
  window.ARG = window.ARG || {};
  window.ARG.bind = bind; window.ARG.go = go; window.ARG.checkRule = checkRule; window.ARG.checkLink = checkLink; window.ARG.playSynthSound = playSynthSound;
  try { window['潮声'] = window.ARG; } catch (e) {}
  if (!window.ARG.toast) {
    window.ARG.toast = function (msg) {
      try { const t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);background:#0f766e;color:#fff;padding:6px 14px;border-radius:8px;z-index:99996;font-size:12.5px'; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 2600); } catch (e) {}
    };
  }
}

bootGlobalApi();
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  window.addEventListener('load', bind);
}

}catch(err){
  try{var p=document.createElement("div");p.style.cssText="position:fixed;left:0;bottom:0;background:#7f1d1d;color:#fff;font:12px/1.4 monospace;padding:4px 8px;z-index:2147483647";p.textContent="运行时错误(调试)："+err.message;document.body&&document.body.appendChild(p);}catch(e2){}
  if(window.console)console.error("[ARG runtime]",err);
}
})();
