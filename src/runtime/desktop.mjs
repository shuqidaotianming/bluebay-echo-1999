// src/runtime/desktop.mjs — 桌面拟真：视口/横屏/时钟/窗口管理/开关机/纹理
import { config, readVisited } from './core.mjs';
import { playSynthSound } from './audio.mjs';

export function ensureViewportMeta() {
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

export var ARG_DISPLAY = { w: 0, h: 0, dpr: 1, orient: '', forced: false };
export function ensureLandscapeProbe() {
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

export var CLOCK_START_KEY = 'arg_game_start';
export function gameClockText() {
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

export function ensureGameClock() {
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

export function ensureWindowManager() {
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

export function ensurePowerMenu() {
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

export function ensureTrayTexture() {
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
