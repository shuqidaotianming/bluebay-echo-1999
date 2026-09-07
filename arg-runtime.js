
(function(){
  const configEl = document.getElementById('arg-config');
  const config = configEl ? JSON.parse(configEl.textContent || '{}') : { rules: {}, files: {}, links: {}, preview: false };
  const result = (text) => { const el = document.querySelector('[data-arg-result]'); if (el) el.textContent = text; };

  // ==================== Clue & Story State Engine ====================
  // 进度存 localStorage（跨标签页/会话保留）；重置用进度角标上的 ⟳
  function readVisited() {
    try { return JSON.parse(localStorage.getItem('arg_visited_nodes') || '[]'); } catch (e) { return []; }
  }
  function writeVisited(list) {
    try { localStorage.setItem('arg_visited_nodes', JSON.stringify(list)); } catch (e) {}
  }
  if (config.trackProgress !== false) {
    try {
      const visited = readVisited();
      const currentPageId = config.nodeId || config.pageName || window.location.pathname.split('/').pop().replace('.html', '');
      if (currentPageId && !visited.includes(currentPageId)) {
        visited.push(currentPageId);
        writeVisited(visited);
      }
      // ARG：地址栏 hash 谜题（如 #firstlight）——命中即记入线索
      if (config.hashClue && config.hashValue &&
          String(window.location.hash).toLowerCase() === String(config.hashValue).toLowerCase()) {
        if (!visited.includes(config.hashClue)) { visited.push(config.hashClue); writeVisited(visited); }
      }
    } catch (e) {}
  }

  function hasClue(req) {
    if (!req) return true;
    try {
      const visited = readVisited();
      const reqList = String(req).split(',').map(s => s.trim().toLowerCase());
      return reqList.every(r => visited.some(v => String(v).toLowerCase() === r));
    } catch (e) {
      return true;
    }
  }

  // 线索 API：手动记一条线索 / 读取已收集线索
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
  function getClues() {
    try { return readVisited().slice(); } catch (e) { return []; }
  }

  // ==================== 跨页未读通知（localStorage + storage 事件总线） ====================
  var NOTIFY_KEY = 'arg_notify_v1', NOTIFY_SEEN_KEY = 'arg_notify_seen';
  function pushNotify(text, target){
    if (!text) return;
    try {
      localStorage.setItem(NOTIFY_KEY, JSON.stringify({ text: text, target: target || '', ts: Date.now(), from: (typeof config !== 'undefined' && config.nodeId) ? config.nodeId : '' }));
      showNotify({ text: text, target: target });
    } catch (e) {}
  }
  function showNotify(payload){
    var old = document.getElementById('arg-notify');
    if (old) old.remove();
    var b = document.createElement('div'); b.id = 'arg-notify';
    var head = document.createElement('div'); head.className = 'arg-notify-head'; head.textContent = '📟 潮声通讯 · 新消息';
    var body = document.createElement('div'); body.className = 'arg-notify-body'; body.textContent = payload.text;
    b.appendChild(head); b.appendChild(body);
    if (payload.target) {
      b.classList.add('clickable');
      b.addEventListener('click', function(){ try { go(payload.target); } catch (e) { location.href = (config.files && config.files[payload.target]) || (payload.target + '.html'); } });
    }
    document.body.appendChild(b);
    try { localStorage.setItem(NOTIFY_SEEN_KEY, String(payload.ts || Date.now())); } catch (e) {}
    setTimeout(function(){ b.classList.add('out'); setTimeout(function(){ if (b.parentNode) b.remove(); }, 700); }, 7000);
  }
  function ensureNotifyRelay(){
    if (window.__argNotifyOn) return; window.__argNotifyOn = true;
    if (!document.getElementById('arg-notify-style')) {
      var st = document.createElement('style'); st.id = 'arg-notify-style';
      st.textContent = [
        '#arg-notify{position:fixed;left:50%;transform:translateX(-50%);bottom:46px;z-index:99993;max-width:min(88vw,380px);background:rgba(12,18,28,.95);border:1px solid rgba(148,163,184,.35);border-left:3px solid #38bdf8;border-radius:10px;padding:9px 13px;color:#e2e8f0;font-size:12.5px;line-height:1.6;box-shadow:0 16px 40px -14px rgba(0,0,0,.7);animation:arg-notify-in .32s ease-out}',
        '#arg-notify.clickable{cursor:pointer}#arg-notify.clickable:hover{border-left-color:#facc15}',
        '#arg-notify-head{font-size:10.5px;letter-spacing:1.2px;color:#7dd3fc;opacity:.9;margin-bottom:2px}',
        '#arg-notify-body{color:#e5e7eb}',
        '#arg-notify.out{opacity:0;transform:translateX(-50%) translateY(12px);transition:all .6s}',
        '@keyframes arg-notify-in{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
      ].join(String.fromCharCode(10));
      document.head.appendChild(st);
    }
    window.addEventListener('storage', function(e){
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

  // ==================== Web Audio Synthesizer (Zero-Asset Offline Engine) ====================
  let audioCtx = null;
  function getAudioCtx(){
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSynthSound(kind){
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;

      if (kind === 'click' || kind === 'type') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(kind === 'type' ? 380 + Math.random() * 160 : 700, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.035);
      } else if (kind === 'notify') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (kind === 'unlock') {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
          gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.06);
          osc.stop(ctx.currentTime + i * 0.06 + 0.22);
        });
      } else if (kind === 'error') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch (e) {}
  }

  // ==================== Typewriter Typography Engine ====================
  function ensureTwStyle(){
    if (document.getElementById('tw-style')) return;
    var st = document.createElement('style'); st.id = 'tw-style';
    st.textContent = '.tw-cursor{display:inline-block;width:.6em;margin-left:1px;animation:twblink 1s steps(1) infinite}@keyframes twblink{50%{opacity:0}}';
    document.head.appendChild(st);
  }
  function applyTypewriter(el, speed = 55){
    if (!el || el.dataset.typewriterDone) return;
    var html = el.innerHTML || '';
    var textOnly = html.replace(/<[^>]*>/g, '').trim();
    if (!textOnly || textOnly.length < 3) return;
    ensureTwStyle();
    el.dataset.typewriterDone = 'pending';
    // 按 <br> 分行逐行打字（正则不含反斜杠，避免模板字符串吞掉转义）；结束后恢复原始 HTML
    var segs = html.split(/<br[^>]*>/i);
    var plain = segs.map(function(s){ var d = document.createElement('div'); d.innerHTML = s; return d.textContent || ''; });
    el.innerHTML = '';
    var lineEls = plain.map(function(){ var d = document.createElement('div'); d.style.minHeight = '1em'; el.appendChild(d); return d; });
    var cursor = document.createElement('span'); cursor.className = 'tw-cursor'; cursor.textContent = '▋';
    var li = 0, ci = 0, timer = null;
    function placeCursor(){ lineEls[Math.min(li, lineEls.length - 1)].appendChild(cursor); }
    function complete(){
      if (timer) clearInterval(timer);
      el.innerHTML = html;
      el.dataset.typewriterDone = 'true';
      document.removeEventListener('click', complete);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e){ if (e.key === ' ' || e.key === 'Enter') complete(); }
    document.addEventListener('click', complete, { once: true });
    document.addEventListener('keydown', onKey, { once: true });
    placeCursor();
    timer = setInterval(function(){
      if (li >= plain.length) { complete(); return; }
      lineEls[li].textContent = plain[li].slice(0, ci);
      placeCursor();
      if (ci % 2 === 0 && plain[li].length) playSynthSound('type');
      if (ci < plain[li].length) { ci++; } else { li++; ci = 0; }
    }, speed);
  }

  // ==================== 进度角标 / 重置入口 ====================
  function ensureProgressPill(){
    if (!config.trackProgress || config.preview || document.getElementById('arg-progress-pill')) return;
    var el = document.createElement('div'); el.id = 'arg-progress-pill';
    el.innerHTML = '线索 <b id="arg-pv-num">0</b>/? <span id="arg-pv-reset" title="重置调查进度">⟳</span>';
    document.body.appendChild(el);
    var st = document.createElement('style');
    st.textContent = '#arg-progress-pill{position:fixed;right:10px;bottom:10px;z-index:99990;font-size:11px;color:#cbd5e1;background:rgba(10,14,22,.55);border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:3px 9px;opacity:.55;pointer-events:auto;font-family:inherit;cursor:pointer}#arg-progress-pill:hover{opacity:.9}#arg-pv-reset{cursor:pointer;margin-left:4px;opacity:.7}#arg-pv-reset:hover{opacity:1;color:#f87171}#arg-pv-panel{position:fixed;right:10px;bottom:36px;z-index:99991;max-width:300px;max-height:55vh;overflow:auto;font-size:11.5px;line-height:1.7;color:#cbd5e1;background:rgba(10,14,22,.92);border:1px solid rgba(148,163,184,.3);border-radius:8px;padding:10px 12px;display:none}#arg-pv-panel b{color:#e2e8f0}#arg-pv-panel .dim{color:#64748b;font-size:10.5px}';
    document.head.appendChild(st);
    var panel = document.createElement('div'); panel.id = 'arg-pv-panel'; document.body.appendChild(panel);
    function update(){ var n = document.getElementById('arg-pv-num'); if (n) n.textContent = String(readVisited().length); }
    function renderPanel(){
      const names = config.names || {};
      const list = readVisited().map(id => names[id] || id);
      panel.innerHTML = '<b>已收集线索 · ' + list.length + '</b><br>' +
        (list.length ? list.map(x => '· ' + x).join('<br>') : '<span class="dim">还没有收集任何线索。</span>') +
        '<br><span class="dim">（只显示已收集的线索；关键证据集齐，才会在聊天里浮现更重的结论。）</span>';
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    }
    update();
    window.addEventListener('focus', update);
    el.addEventListener('click', function(){ renderPanel(); });
    document.addEventListener('click', function(ev){
      if (panel.style.display === 'block' && !panel.contains(ev.target) && ev.target !== el && !el.contains(ev.target)) panel.style.display = 'none';
    });
    document.getElementById('arg-pv-reset').addEventListener('click', function(ev){
      ev.stopPropagation();
      if (window.confirm('确定重置全部调查进度？线索与聊天记录将清空，页面将重新载入。')) {
        try { localStorage.removeItem('arg_visited_nodes'); localStorage.removeItem('arg_chat_log_v1'); } catch (e) {}
        window.location.reload();
      }
    });
  }

  // ==================== 4.5Hz 低频底噪（Web Audio 合成，零素材） ====================
  var droneCtx = null, droneMaster = null, droneOn = false, droneBtn = null;
  function ensureDroneToggle(){
    if (droneBtn || !config.drone || config.preview || document.getElementById('arg-drone-toggle')) return;
    droneBtn = document.createElement('button'); droneBtn.id = 'arg-drone-toggle';
    droneBtn.textContent = '◍ 白噪'; droneBtn.title = '开启/关闭 4.5Hz 低频底噪（FM99.4）';
    document.body.appendChild(droneBtn);
    var st = document.createElement('style');
    st.textContent = '#arg-drone-toggle{position:fixed;left:10px;bottom:10px;z-index:99990;font-size:11px;letter-spacing:1px;color:#94a3b8;background:rgba(10,14,22,.5);border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:4px 11px;cursor:pointer;opacity:.6;font-family:inherit}#arg-drone-toggle:hover{opacity:.95;color:#e2e8f0}';
    document.head.appendChild(st);
    droneBtn.addEventListener('click', function(ev){ ev.stopPropagation(); toggleDrone(); });
  }
  function buildDrone(){
    var AC = window.AudioContext || window.webkitAudioContext;
    droneCtx = new AC();
    droneMaster = droneCtx.createGain(); droneMaster.gain.value = 0.0001; droneMaster.connect(droneCtx.destination);
    // 双低频正弦 52Hz / 56.5Hz → 4.5Hz 拍频（"白噪"的频率感）
    [52, 56.5].forEach(function(f){
      var o = droneCtx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      var g = droneCtx.createGain(); g.gain.value = 0.5;
      o.connect(g); g.connect(droneMaster); o.start();
    });
    // 低通海噪（brown-ish noise）
    var len = 2 * droneCtx.sampleRate, buf = droneCtx.createBuffer(1, len, droneCtx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++){ var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    var src = droneCtx.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = droneCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
    var ng = droneCtx.createGain(); ng.gain.value = 0.7;
    src.connect(lp); lp.connect(ng); ng.connect(droneMaster); src.start();
  }
  function toggleDrone(){
    try {
      if (!droneCtx) buildDrone();
      if (droneCtx.state === 'suspended') droneCtx.resume();
      droneOn = !droneOn;
      var t = droneCtx.currentTime;
      droneMaster.gain.cancelScheduledValues(t);
      droneMaster.gain.setValueAtTime(droneMaster.gain.value, t);
      droneMaster.gain.linearRampToValueAtTime(droneOn ? 0.12 : 0.0001, t + 0.8);
      droneBtn.textContent = droneOn ? '◉ 白噪' : '◍ 白噪';
    } catch (e) {}
  }

  // ==================== 隐藏访问统计（不影响沉浸，无可见元素） ====================
  // Abacus 新版 API 为两段式 命名空间/键名；旧单段式会 308 跳官网，导致计数丢失
  function trackVisit(){
    if (config.preview || !config.trackProgress) return;
    try {
      var UV_KEY = 'arg_uv_done';
      if (!localStorage.getItem(UV_KEY)) {
        localStorage.setItem(UV_KEY, '1');
        fetch('https://abacus.jasoncameron.dev/hit/bluebay-echo-1999/visitors').catch(function(){});
      }
      fetch('https://abacus.jasoncameron.dev/hit/bluebay-echo-1999/pages').catch(function(){});
    } catch (e) {}
  }

  // ==================== 隐藏「监听终端」页：实时回传 PV/UV ====================
  function ensureStats(){
    if (!config.stats || config.preview || document.getElementById('arg-stats-line')) return;
    var host = document.querySelector('[data-arg-slot="body"]');
    if (!host) return;
    var line = document.createElement('div');
    line.id = 'arg-stats-line';
    line.style.marginTop = '12px';
    line.style.opacity = '.8';
    line.textContent = '> 正在从远端信标同步计数 ……';
    host.appendChild(line);
    function get(key, cb){
      fetch('https://abacus.jasoncameron.dev/get/bluebay-echo-1999/' + key)
        .then(function(r){ return r.text(); })
        .then(function(t){ cb(t.replace(/[^0-9]/g, '') || '?'); })
        .catch(function(){ cb('?'); });
    }
    get('pages', function(pv){
      get('visitors', function(uv){
        line.textContent = '> 到访 ' + pv + ' 次 ｜ 踏足者 ' + uv + ' 人 ｜ 信标仍在闪。';
      });
    });
  }

  // ==================== 移动端：viewport 兜底 ====================
  function ensureViewportMeta(){
    if (!document.querySelector('meta[name="viewport"]')) {
      const mv = document.createElement('meta');
      mv.setAttribute('name', 'viewport');
      mv.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
      document.head.appendChild(mv);
    }
    // 灯塔 favicon（顺带消掉浏览器每次请求 /favicon.ico 的 404）
    if (!document.querySelector('link[rel="icon"]')) {
      var fx = document.createElement('link');
      fx.rel = 'icon'; fx.type = 'image/svg+xml';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0c1720"/><path d="M16 5l4 6v14h-8V11z" fill="#facc15"/><circle cx="16" cy="9" r="2.4" fill="#fef3c7"/><path d="M4 27h24" stroke="#22d3ee" stroke-width="2" fill="none"/></svg>';
      fx.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
      document.head.appendChild(fx);
    }
  }

  // ==================== 移动端：强制横屏 + 分辨率检测 ====================
  var ARG_DISPLAY = { w: 0, h: 0, dpr: 1, orient: '', forced: false };
  function ensureLandscapeProbe(){
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

    function measure(){
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
        chip._fadeT = setTimeout(function(){ chip.classList.add('fade'); }, 4200);
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

    function tryLock(){
      try {
        const so = window.screen && window.screen.orientation;
        if (so && typeof so.lock === 'function') { const pr = so.lock('landscape'); if (pr && pr.catch) pr.catch(function(){}); }
      } catch (e) {}
    }
    measure();
    try {
      console.log('%cDISPLAY %c' + ARG_DISPLAY.w + '×' + ARG_DISPLAY.h + ' @' + ARG_DISPLAY.dpr + 'x · ' + (ARG_DISPLAY.forced ? 'LAND-FORCED' : ARG_DISPLAY.orient.toUpperCase()),
        'color:#38bdf8;font-weight:bold', 'color:#94a3b8');
    } catch (e) {}
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', function(){ setTimeout(measure, 120); setTimeout(measure, 620); });
    document.addEventListener('pointerdown', function once(){ tryLock(); document.removeEventListener('pointerdown', once); });
    tryLock();
  }

  // ==================== 桌面拟真 ①：游戏内时钟（真实流逝时间映射 18:00→23:30） ====================
  var CLOCK_START_KEY = 'arg_game_start';
  function gameClockText(){
    var t0 = 0;
    try {
      t0 = parseInt(localStorage.getItem(CLOCK_START_KEY) || '0', 10);
      if (!t0) { t0 = Date.now(); localStorage.setItem(CLOCK_START_KEY, String(t0)); }
    } catch (e) { t0 = Date.now(); }
    var elapsedMin = Math.floor((Date.now() - t0) / 60000);
    var gameMin = 18 * 60 + Math.min(elapsedMin * 4, (23 * 60 + 30) - (18 * 60)); // 1 真实分钟 = 4 游戏分钟，封顶 23:30
    var hh = Math.floor(gameMin / 60) % 24, mm = gameMin % 60;
    return (hh < 10 ? '0' + hh : '' + hh) + ':' + (mm < 10 ? '0' + mm : '' + mm);
  }
  window.ARG_CLOCK = { time: gameClockText };

  function ensureGameClock(){
    if (window.__argClockOn) return; window.__argClockOn = true;
    function paint(){
      var txt = gameClockText();
      ['.tray-time', '.mac-time', '.cyber-clock', '.tray-status', '[data-arg-clock]'].forEach(function(sel){
        document.querySelectorAll(sel).forEach(function(el){
          if (el.dataset.argClockLocked === '1') return;
          el.dataset.argClockLocked = '1';
          el.textContent = txt;
        });
      });
      document.querySelectorAll('[data-arg-clock-fill]').forEach(function(el){ el.textContent = txt; });
    }
    paint();
    setInterval(paint, 15000);
  }

  // ==================== 桌面拟真 ②：真拖拽多窗口 + 最小化/最大化/关闭 + 任务栏切换 ====================
  function ensureWindowManager(){
    var WIN_SEL = '.win-sticky-note,.dark-sticky-note,.mac-stickies';
    var wins = [].slice.call(document.querySelectorAll(WIN_SEL)).filter(function(w){
      return (w.textContent || '').trim().length > 6; // 模板里的空便签不做成窗口
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
    // 把窗口重挂到整块桌面区域（.desktop-main 等），否则会被零高度的便签容器钳死坐标
    var host = document.querySelector('.desktop-main,.mac-main-area,.cyber-desktop,.dark-desktop,.win98-desktop,.winxp-desktop') || wins[0].parentElement || document.body;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    wins.forEach(function(w){
      if (w.parentElement !== host) {
        var r0 = w.getBoundingClientRect(), hr0 = host.getBoundingClientRect();
        w.dataset.argInitX = String(Math.round(r0.left - hr0.left + (host.scrollLeft || 0)));
        w.dataset.argInitY = String(Math.round(r0.top - hr0.top + (host.scrollTop || 0)));
        host.appendChild(w);
      }
    });

    // 任务栏容器
    var taskHost = document.querySelector('.taskbar-tasks') || document.querySelector('.dark-taskbar') ||
      document.querySelector('.win98-taskbar') || document.querySelector('.winxp-taskbar') ||
      document.querySelector('.mac-menubar-right') || document.querySelector('.cyber-footer');
    if (taskHost && !taskHost.querySelector('.arg-taskbar-injected')) {
      var bar = document.createElement('div');
      bar.className = 'arg-taskbar-injected';
      taskHost.appendChild(bar);
    }

    wins.forEach(function(w, i){
      var title = (w.querySelector('.note-titlebar') || w.querySelector('h3,h4,.note-title') || w).textContent.trim().slice(0, 14) || ('窗口 ' + (i + 1));
      w.classList.add('arg-win');
      w.dataset.argWinTitle = title;
      var r = w.getBoundingClientRect(), hr = host.getBoundingClientRect();
      var initL = w.dataset.argInitX ? parseInt(w.dataset.argInitX, 10) : Math.max(0, r.left - hr.left + (host.scrollLeft || 0));
      var initT = w.dataset.argInitY ? parseInt(w.dataset.argInitY, 10) : Math.max(0, r.top - hr.top + (host.scrollTop || 0));
      w.style.left = initL + 'px';
      w.style.top = initT + 'px';

      var bar = document.createElement('div'); bar.className = 'arg-win-btns';
      [['_', 'minimize', '最小化'], ['□', 'maximize', '最大化'], ['×', 'close', '关闭']].forEach(function(b){
        var btn = document.createElement('button');
        btn.type = 'button'; btn.textContent = b[0]; btn.title = b[2]; btn.dataset.act = b[1];
        bar.appendChild(btn);
      });
      w.appendChild(bar);

      var tb = taskHost && taskHost.querySelector('.arg-taskbar-injected');
      if (tb) {
        var tbtn = document.createElement('button');
        tbtn.type = 'button'; tbtn.className = 'arg-taskbtn'; tbtn.textContent = title;
        tbtn.addEventListener('click', function(){
          if (w.classList.contains('arg-win-min')) { w.classList.remove('arg-win-min'); focusWin(w); }
          else if (document.activeElement !== document.body && w.classList.contains('arg-win-focus')) { setMin(w, true); }
          else { focusWin(w); }
        });
        tb.appendChild(tbtn);
        w._taskBtn = tbtn;
      }

      bar.addEventListener('click', function(e){
        var act = e.target && e.target.dataset ? e.target.dataset.act : '';
        if (!act) return;
        e.preventDefault(); e.stopPropagation();
        if (act === 'minimize') setMin(w, true);
        else if (act === 'maximize') w.classList.toggle('arg-win-max');
        else { setMin(w, true); }
        playSynthSound('click');
      });

      var drag = null;
      w.addEventListener('pointerdown', function(e){
        if (e.target && e.target.dataset && e.target.dataset.act) return;
        focusWin(w);
        var onBar = !!(e.target.closest && e.target.closest('.note-titlebar,.arg-win-btns')) || true;
        if (!onBar) return;
        drag = { x: e.clientX, y: e.clientY, l: parseFloat(w.style.left) || 0, t: parseFloat(w.style.top) || 0 };
        w.classList.add('dragging');
        try { w.setPointerCapture(e.pointerId); } catch (err) {}
      });
      w.addEventListener('pointermove', function(e){
        if (!drag) return;
        var nl = drag.l + (e.clientX - drag.x), nt = drag.t + (e.clientY - drag.y);
        var hostW = host.clientWidth || window.innerWidth, hostH = host.clientHeight || window.innerHeight;
        var maxL = hostW - w.offsetWidth - 4, maxT = hostH - 28;
        w.style.left = Math.min(Math.max(nl, -w.offsetWidth + 60), Math.max(maxL, 0)) + 'px';
        w.style.top = Math.min(Math.max(nt, 0), Math.max(maxT, 0)) + 'px';
      });
      function endDrag(){ if (drag) { drag = null; w.classList.remove('dragging'); } }
      w.addEventListener('pointerup', endDrag);
      w.addEventListener('pointercancel', endDrag);
    });

    function setMin(w, on){
      w.classList.toggle('arg-win-min', on);
      if (w._taskBtn) w._taskBtn.classList.toggle('active', !on);
      if (!on) focusWin(w);
    }
    function focusWin(w){
      wins.forEach(function(x){ x.classList.remove('arg-win-focus'); if (x._taskBtn) x._taskBtn.classList.remove('active'); });
      w.classList.add('arg-win-focus');
      w.style.zIndex = String(++topZ);
      if (w._taskBtn) w._taskBtn.classList.add('active');
    }
    focusWin(wins[0]);
  }

  // ==================== 桌面拟真 ③：假关机 / 重启 / 睡眠 回环 ====================
  function ensurePowerMenu(){
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

    function menu(){
      var old = document.getElementById('arg-power-menu');
      if (old) { old.remove(); return null; }
      var m = document.createElement('div'); m.id = 'arg-power-menu';
      var r = start.getBoundingClientRect();
      m.style.left = Math.max(6, r.left) + 'px';
      m.style.top = Math.max(6, r.top - 132) + 'px';
      [['待机（睡眠）', 'sleep'], ['重新启动', 'reboot'], ['关机', 'off']].forEach(function(o){
        var b = document.createElement('button'); b.type = 'button'; b.textContent = o[0];
        b.addEventListener('click', function(){ m.remove(); act(o[1]); });
        m.appendChild(b);
      });
      document.body.appendChild(m);
      setTimeout(function(){ document.addEventListener('pointerdown', function close(ev){ if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', close); } }); }, 0);
      return m;
    }
    function act(kind){
      if (kind === 'sleep') {
        document.body.classList.add('arg-sleep');
        setTimeout(function(){ document.body.classList.remove('arg-sleep'); }, 2200);
        return;
      }
      var ov = document.createElement('div'); ov.id = 'arg-power-off';
      var lines = kind === 'reboot'
        ? ['ACPI: 正在终止进程…', '潮声站备份守护进程：已停止', '系统即将重新启动。', '', 'BOOT SELF-TEST / 开机自检']
        : ['电源已切断。', '', '这台机器停在了 2003 年的某个夜里。', '想再听一次，就得自己按下去。', ''];
      lines.forEach(function(t){ var d = document.createElement('div'); d.className = 'po-line'; d.textContent = t; ov.appendChild(d); });
      var cur = document.createElement('span'); cur.className = 'po-cursor'; ov.appendChild(cur);
      var go = document.createElement('a');
      go.href = (config.files && config.files.node_prologue) ? config.files.node_prologue : 'index.html';
      go.textContent = kind === 'reboot' ? '› 重新启动' : '› 重新通电';
      go.style.cssText = 'margin-top:18px;color:#65a30d;text-decoration:underline;cursor:pointer';
      ov.appendChild(go);
      document.body.appendChild(ov);
      try { if (window.screen && window.screen.orientation && window.screen.orientation.unlock) window.screen.orientation.unlock(); } catch (e) {}
    }
    start.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); playSynthSound('click'); menu(); });
  }

  // ==================== 桌面拟真 ④：托盘指示器 + 静态噪点 + 随机墨渍/壁纸 ====================
  function ensureTrayTexture(){
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

    // 噪点层（SVG feTurbulence，无外链）
    var nz = document.createElement('div'); nz.id = 'arg-noise';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="180" height="180" filter="url(#n)" opacity="0.55"/></svg>';
    nz.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    document.body.appendChild(nz);

    // 随机墨渍 2–4 处
    var ink = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < ink; i++) {
      var d = document.createElement('div'); d.className = 'arg-ink';
      var s = 26 + Math.random() * 62;
      d.style.width = s + 'px'; d.style.height = s * (0.6 + Math.random() * 0.5) + 'px';
      d.style.left = (Math.random() * 90) + 'vw'; d.style.top = (Math.random() * 92) + 'vh';
      d.style.background = 'rgba(20,24,30,' + (0.02 + Math.random() * 0.05).toFixed(3) + ')';
      document.body.appendChild(d);
    }

    // 每次进桌面换一层壁纸色温
    var wall = 'arg-wall-' + (1 + Math.floor(Math.random() * 3));
    document.body.classList.add(wall);

    // 桌面壁纸：蓝湾海岸（1999 年感），暗色压一层保证图标可读
    var desk = document.querySelector('.winxp-desktop,.win98-desktop,.macos-desktop,.cyber-desktop,.dark-desktop,.desktop-main');
    if (desk) {
      desk.style.backgroundImage = 'linear-gradient(rgba(9,14,26,.20),rgba(9,14,26,.36)),url("wall-bluebay.jpg")';
      desk.style.backgroundSize = 'cover';
      desk.style.backgroundPosition = 'center';
    }

    // 托盘假指示器
    var tray = document.querySelector('.win-tray,.winxp-tray,.dark-tray,.mac-menubar-right,.cyber-footer');
    if (tray && !tray.querySelector('.arg-tray-ind')) {
      var ind = document.createElement('span'); ind.className = 'arg-tray-ind';
      var vol = 55 + Math.floor(Math.random() * 30), bat = 40 + Math.floor(Math.random() * 55);
      ind.innerHTML = '<span>▂▄▆</span><span>♪ ' + vol + '%</span><span> batt ' + bat + '%</span>';
      tray.insertBefore(ind, tray.firstChild);
    }
  }

  // ==================== 全局主题层：统一「蓝湾档案」美学 ====================
  function ensureGlobalSkin(){
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

    '/* —— 新闻 2001 —— */',
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
    /* 容器统一收缩 */
    '.archive-container,.portal,.wiki-container,.yahoo-container,.bbs-container,.cyber-container,.news-article,.news-content,.scp-page,.scp-card,.diary-notebook,.folder,.search-container,.term-container,.mag-container{width:auto!important;max-width:100%!important;box-sizing:border-box!important}',
    '.archive-container,.portal,.folder{margin-left:10px!important;margin-right:10px!important}',
    '.scp-card{padding:22px 16px!important}',
    '.news-content{padding:20px 14px!important}',
    '.yahoo-container{padding:14px!important}',
    '.bbs-post-body,.scp-body,.news-content,.wiki-content{font-size:15px!important}',
    '.diary-content{font-size:16.5px!important}',
    /* 维基/索引：侧栏纵向堆叠 */
    '.wiki-container{flex-direction:column!important}',
    '.wiki-sidebar{width:auto!important;border-right:none!important;border-bottom:1px solid #a7d7f9!important}',
    '.wiki-content{padding:18px 14px!important}',
    '.wiki-toc{min-width:0!important;max-width:100%!important;box-sizing:border-box!important}',
    '.archive-list a{padding:10px 12px!important}',
    '.archive-list a:hover{transform:none!important}',
    /* 搜索 */
    '.yahoo-directory{grid-template-columns:1fr!important}',
    '.search-input-wrap,.search-input-box,.term-input-line{max-width:100%!important}',
    /* 文件夹 */
    '.folder{margin-top:20px!important;margin-bottom:20px!important}',
    /* 聊天：侧栏变横向联系人条 */
    '.chat-app{flex-direction:column!important}',
    '.chat-sidebar{width:100%!important;max-width:100%!important;height:auto!important;max-height:132px!important;border-right:none!important;border-bottom:1px solid rgba(127,127,127,.35)!important}',
    '.chat-sidebar-header{padding:6px 8px!important}',
    '.chat-contacts-list{display:flex!important;flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important;padding:4px 6px!important}',
    '.contact-item{min-width:128px!important;flex:0 0 auto!important}',
    '.chat-main{flex:1!important;min-height:0!important;width:100%!important}',
    '.chat-messages{padding:10px!important}',
    '.msg-bubble{max-width:86%!important}',
    /* 桌面：图标横向换行，便签随流堆叠 */
    '.desktop-icons,.mac-desktop-icons,.cyber-icons{flex-direction:row!important;flex-wrap:wrap!important;max-height:none!important;align-content:flex-start!important;gap:8px 4px!important}',
    '.desktop-main,.mac-main-area{flex-direction:column!important;justify-content:flex-start!important;gap:16px!important}',
    '.desktop-icon{width:72px!important}',
    '.icon-symbol{font-size:30px!important}',
    '.win-sticky-note,.dark-sticky-note,.mac-stickies{width:auto!important;max-width:100%!important}',
    /* 黑客终端：长token强制断行 */
    '.cyber-topbar{flex-wrap:wrap!important;gap:4px 10px!important}',
    '.cyber-topbar span,.cyber-meta-row span{overflow-wrap:anywhere!important;white-space:normal!important}',
    'pre{white-space:pre-wrap!important;overflow-wrap:anywhere!important}',
    /* 长词兜底：词条/按钮/链接描述 */
    '.wiki-links a,.hot-link-btn,.arg-link-desc,.bbs-tag{overflow-wrap:anywhere!important;white-space:normal!important}',
    '}'
    ].join(String.fromCharCode(10));
    document.head.appendChild(st);
  }

  // ==================== 「写给你的一页」：纪念站署名输入 ====================
  function ensureNameInput(){
    if (!config.nameInput || config.preview || document.getElementById('arg-name-input')) return;
    const host = document.querySelector('[data-arg-slot="body"]');
    if (!host) return;
    const wrap = document.createElement('div');
    wrap.style.marginTop = '14px';
    wrap.innerHTML = '<input id="arg-name-field" placeholder="写下你的名字（会留在这台机器里）" style="width:70%;padding:6px 8px;background:#0a0e16;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);font-family:inherit"> <button id="arg-name-save" style="padding:6px 12px;background:#16335f;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);cursor:pointer;font-family:inherit">留下</button><div id="arg-name-line" style="margin-top:8px"></div>';
    host.appendChild(wrap);
    function render(){
      let n = ''; try { n = localStorage.getItem('arg_your_name') || ''; } catch (e) {}
      document.getElementById('arg-name-line').textContent = n ? ('> 本页献给调查者：' + n + '。海记住了。') : '';
    }
    document.getElementById('arg-name-save').addEventListener('click', function(){
      const v = (document.getElementById('arg-name-field').value || '').trim().slice(0, 20);
      if (!v) return;
      try { localStorage.setItem('arg_your_name', v); } catch (e) {}
      render();
    });
    render();
  }

  // ==================== Core Routing ====================
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
    // —— 影子搜索：输对档案员暗号（FM 94.9），检索权限升级 ——
    if (config.isSearch && kind === 'search' && config.shadowKey && !isShadow() && normShadow(key) === normShadow(config.shadowKey)) {
      if (config.shadowClue) triggerClue(config.shadowClue);
      applyShadowSkin(true);
      playSynthSound('notify');
      result('✔ 权限已切换：档案员检索（94.9）。有些结果，刚才是不给你看的。');
      return;
    }
    // 影子索引优先（档案员权限下）
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

  // ==================== 权限层：影子搜索 / 帖子级密码 / 敏感词涂码 / 论坛生态 ====================
  function normShadow(s){
    let out = '';
    String(s || '').toLowerCase().split('').forEach(function(c){
      if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || c === '.') out += c;
    });
    if (out.slice(0, 2) === 'fm') out = out.slice(2);
    while (out.slice(-2) === '.0') out = out.slice(0, -2);
    return out;
  }
  function isShadow(){
    try { return config.shadowClue ? hasClue(config.shadowClue) : localStorage.getItem('arg_shadow_949') === '1'; } catch (e) { return false; }
  }
  function applyShadowSkin(fresh){
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
      if (cands.length) {
        result('✔ 权限已切换：档案员检索。现在试试这些当年被挡在后面的词——' + cands.slice(0, 4).join(' / '));
      }
    }
  }
  var CENSOR_WORDS = ['白噪计划', '第九夜', '六十六', '听潮会', '随船', '失踪名单'];
  function maskText(s){
    let out = String(s || '');
    if (isShadow()) return out;
    CENSOR_WORDS.forEach(function(w){
      while (out.indexOf(w) !== -1) {
        const bar = new Array(w.length + 1).join('▇');
        out = out.replace(w, bar);
      }
    });
    return out;
  }

  function ensurePostLock(){
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
    sub.textContent = lockName === '本人' ? '楼主本人加密。口令只有他和收信的人知道。' : '版务操作记录：此层含违规内容，输口令调阅。';
    const row = document.createElement('div'); row.className = 'pl-row';
    const input = document.createElement('input'); input.placeholder = '输入口令…';
    input.setAttribute('autocomplete', 'off');
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = '解锁';
    const err = document.createElement('div'); err.className = 'pl-err';
    row.appendChild(input); row.appendChild(btn);
    panel.appendChild(title); panel.appendChild(sub); panel.appendChild(row); panel.appendChild(err);
    document.body.appendChild(panel);

    function attempt(){
      const v = String(input.value || '').trim().toLowerCase();
      const ok = String(config.postPassword || '').split(/[,，;|]+/).map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean).indexOf(v) !== -1;
      if (!ok) {
        err.textContent = '口令不对。';
        panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake');
        playSynthSound('error');
        return;
      }
      try { if (config.unlockClue) triggerClue(config.unlockClue); else localStorage.setItem('arg_post_open_' + config.nodeId, '1'); } catch (e) {}
      document.body.classList.add('arg-post-open');
      panel.remove();
      playSynthSound('notify');
      pushNotify((config.realAuthor ? '锁着的楼层显形了。真实发帖人：' + config.realAuthor + '。' : '锁着的楼层显形了。'), '');
    }
    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); attempt(); } });
  }

  function ensureForumLife(){
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
    const deep = document.createElement('a'); deep.textContent = '→ 绝密专题';
    deep.dataset.argLink = 'node_login_hard';
    left.appendChild(deep);
    const online = document.createElement('span'); online.className = 'arg-online';
    banner.appendChild(left); banner.appendChild(online);
    box.insertBefore(banner, box.firstChild);

    let n = 980 + Math.floor(Math.random() * 90);
    function paint(){ online.textContent = '在线 ' + n.toLocaleString() + ' 人 · 今天是' + gameClockText() + '，还没有人下线'; }
    paint();
    setInterval(function(){ n = Math.max(900, n + Math.floor(Math.random() * 15) - 7); paint(); }, 26000);

    function check(){
      if (getClues().some(function(id){ return id.indexOf('ns_') === 0; }) || hasClue('clue_shadow_949')) {
        left.innerHTML = '当前身份：<b>已验证</b> · 欢迎回来，知微。夜航的记录你都看过了。';
        clearInterval(timer);
      }
    }
    const timer = setInterval(check, 4000);
    check();
  }

  // ==================== 联网结果视图：未命中时在「游戏页内」展示 Bing 风格结果 + 外部引擎外链 ====================
  function fbEsc(s){ return String(s).replace(/[&<>"]/g, function(c){ return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function ensureFbStyle(){
    if (document.getElementById('arg-fb-style')) return;
    const st = document.createElement('style'); st.id = 'arg-fb-style';
    st.textContent = '.arg-ir{background:#ffffff!important;border:1px solid #dbe4f0!important;border-radius:14px!important;padding:20px 24px!important;margin-top:18px!important;box-shadow:0 8px 24px rgba(20,40,80,.08)!important;color:#1f2937!important;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif!important}.arg-ir .fb-head{font-weight:700;font-size:15px;color:#0f172a;margin-bottom:12px}.arg-ir .fb-count{color:#6b7280;font-size:12.5px;margin-bottom:16px}.arg-ir .fb-item{margin-bottom:22px}.arg-ir .fb-item .t{color:#1a58d8;font-size:18px;cursor:pointer;line-height:1.4}.arg-ir .fb-item .t:hover{text-decoration:underline}.arg-ir .fb-item .u{color:#16803d;font-size:12.5px;margin:2px 0;word-break:break-all}.arg-ir .fb-item .s{color:#4b5563;font-size:14px;line-height:1.7}.arg-ir .fb-ext{margin:24px 0 6px;padding:14px 16px;background:#f0f6ff!important;border:1px solid #dbe7ff!important;border-radius:10px!important;font-size:14px;line-height:2;color:#33507a!important}.arg-ir .fb-ext a{color:#1a58d8;font-weight:600;text-decoration:none;margin-right:14px}.arg-ir .fb-ext a:hover{text-decoration:underline}.arg-ir .fb-none{color:#6b7280;font-size:14.5px;margin-bottom:18px}.arg-ir .fb-clear{display:inline-block;margin-top:6px;cursor:pointer;color:#1a58d8;font-size:13px;text-decoration:underline}.arg-ir .fb-real,.arg-ir .fb-bing{margin:20px 0 8px;padding-top:10px;border-top:1px dashed #e2e8f0}.arg-ir .fb-bing iframe{width:100%;height:560px;border:1px solid #dbe4f0;border-radius:10px;background:#fff}.arg-ir .fb-item .t a{color:#1a58d8;text-decoration:none}.arg-ir .fb-item .t a:hover{text-decoration:underline}';
    document.head.appendChild(st);
  }
  function fallbackSearch(text){
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
    function render(idx){
      const q = text.toLowerCase();
      const terms = q.split(/s+/).filter(Boolean);
      const scored = idx.map(function(it){
        const hay = (it.t + ' ' + it.s).toLowerCase(); let sc = 0;
        terms.forEach(function(t){ const c = hay.split(t).length - 1; if (c > 0) sc += c + (it.t.toLowerCase().indexOf(t) !== -1 ? 5 : 0); });
        return { it: it, sc: sc };
      }).filter(function(x){ return x.sc > 0; }).sort(function(a, b){ return b.sc - a.sc; }).slice(0, 6);
      res.innerHTML = '';
      const head = document.createElement('div'); head.className = 'fb-head';
      head.textContent = '联网结果 · ' + text;
      res.appendChild(head);
      const count = document.createElement('div'); count.className = 'fb-count';
      count.textContent = '约 ' + (scored.length * 173 + 21) + ' 条结果（用时 0.' + (terms.length * 17 + 3) + ' 秒）· 检索范围：蓝湾档案库 + 外部引擎';
      res.appendChild(count);
      if (!scored.length) {
        // 拼写建议：取与查询有公共片段的标题（模拟真引擎的“您是不是要找”）
        const cands = idx.map(function(it){
          const t = (it.t + ' ' + it.s).toLowerCase(); let best = 0;
          for (let a = 0; a < q.length; a++) for (let len = 3; a + len <= q.length; len++) {
            const seg = q.substr(a, len);
            if (t.indexOf(seg) !== -1) best = Math.max(best, len);
          }
          return { it: it, best: best };
        }).filter(function(x){ return x.best >= 3; }).sort(function(a, b){ return b.best - a.best; }).slice(0, 5);
        const none = document.createElement('div'); none.className = 'fb-none';
        none.textContent = '站内没有找到与「' + text + '」直接相关的档案。';
        res.appendChild(none);
        if (cands.length) {
          const sug = document.createElement('div'); sug.className = 'fb-none';
          sug.innerHTML = '您是不是要找：';
          cands.forEach(function(x, i){
            const s = document.createElement('span'); s.className = 'fb-clear'; s.textContent = maskText(x.it.t);
            s.addEventListener('click', function(){ playSynthSound('click'); fallbackSearch(x.it.t); });
            sug.appendChild(s);
            if (i < cands.length - 1) sug.appendChild(document.createTextNode('　·　'));
          });
          res.appendChild(sug);
        }
      }
      scored.forEach(function(x){
        const item = document.createElement('div'); item.className = 'fb-item';
        const t = document.createElement('div'); t.className = 't'; t.textContent = maskText(x.it.t) + ' _ 蓝湾档案';
        t.addEventListener('click', function(){ playSynthSound('click'); go(x.it.id); });
        const u = document.createElement('div'); u.className = 'u'; u.textContent = 'https://lanwan.archive.fm99.4/' + x.it.u;
        const s = document.createElement('div'); s.className = 's'; s.textContent = maskText(x.it.s);
        item.appendChild(t); item.appendChild(u); item.appendChild(s);
        res.appendChild(item);
      });
      if (!isShadow() && scored.some(function(x){ return CENSOR_WORDS.some(function(w){ return (x.it.t + x.it.s).indexOf(w) !== -1; }); })) {
        const warn = document.createElement('div'); warn.className = 'fb-count';
        warn.textContent = '※ 部分字样已按 1999 年《沿海广播临时管理办法》予以遮蔽。';
        res.appendChild(warn);
      }
      const real = document.createElement('div'); real.className = 'fb-real';
      real.innerHTML = '<div class="fb-head">🌐 外部检索 · 维基百科（实时）</div><div class="fb-count">正在外部检索「' + fbEsc(text) + '」……</div>';
      res.appendChild(real);
      fetch('https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(text) + '&format=json&origin=*&srlimit=4')
        .then(function(r){ return r.json(); })
        .then(function(j){
          const hits = (j.query && j.query.search) || [];
          real.innerHTML = '<div class="fb-head">🌐 外部检索 · 维基百科（实时）</div>';
          if (!hits.length) { const d = document.createElement('div'); d.className = 'fb-none'; d.textContent = '外部检索暂时没有直接相关的内容。'; real.appendChild(d); return; }
          hits.forEach(function(h){
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
        .catch(function(){ real.innerHTML = '<div class="fb-none">（外部检索暂不可用。可用下方链接在新窗口搜索。）</div>'; });
      const bing = document.createElement('div'); bing.className = 'fb-real';
      bing.innerHTML = '<div class="fb-head">🌐 外部检索 · DuckDuckGo（实时）</div><div class="fb-count">正在检索「' + fbEsc(text) + '」……</div>';
      res.appendChild(bing);
      fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(text) + '&format=json&no_html=1&skip_disambig=1&t=bluebay')
        .then(function(r){ return r.json(); })
        .then(function(j){
          bing.innerHTML = '<div class="fb-head">🌐 外部检索 · DuckDuckGo（实时）</div>';
          const items = [];
          if (j.AbstractText) items.push({ t: (j.Heading || 'DuckDuckGo') + ' _ 外部条目 ↗', u: String(j.AbstractURL || '').replace(/^https?:[/][/]/, ''), s: j.AbstractText });
          (j.RelatedTopics || []).slice(0, 4).forEach(function(rt){ if (rt.FirstURL && rt.Text) items.push({ t: rt.Text.split(' - ')[0] + ' _ 外部条目 ↗', u: rt.FirstURL.replace(/^https?:[/][/]/, ''), s: rt.Text }); });
          if (!items.length) { const d = document.createElement('div'); d.className = 'fb-none'; d.textContent = '外部检索暂无直接相关条目。可用下方链接在新窗口搜索。'; bing.appendChild(d); return; }
          items.forEach(function(h){
            const item = document.createElement('div'); item.className = 'fb-item';
            const t = document.createElement('div'); t.className = 't';
            const a = document.createElement('a'); a.href = 'https://' + h.u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = h.t;
            t.appendChild(a);
            const u = document.createElement('div'); u.className = 'u'; u.textContent = h.u;
            const s = document.createElement('div'); s.className = 's'; s.textContent = h.s;
            item.appendChild(t); item.appendChild(u); item.appendChild(s);
            bing.appendChild(item);
          });
        })
        .catch(function(){ bing.innerHTML = '<div class="fb-none">（外部检索暂不可用。可用下方链接在新窗口搜索。）</div>'; });
      res.appendChild(bing);
      const ext = document.createElement('div'); ext.className = 'fb-ext';
      ext.innerHTML = '继续在外部搜索引擎查证「' + fbEsc(text) + '」：<br>';
      const a1 = document.createElement('a'); a1.href = 'https://www.bing.com/search?q=' + encodeURIComponent(text); a1.target = '_blank'; a1.rel = 'noopener'; a1.textContent = '用必应搜索 ↗';
      const a2 = document.createElement('a'); a2.href = 'https://www.baidu.com/s?wd=' + encodeURIComponent(text); a2.target = '_blank'; a2.rel = 'noopener'; a2.textContent = '用百度搜索 ↗';
      const note = document.createElement('div'); note.className = 'fb-count'; note.textContent = '（外部检索 · 不影响游戏进度）';
      ext.appendChild(a1); ext.appendChild(a2); ext.appendChild(note);
      res.appendChild(ext);
      const clear = document.createElement('span'); clear.className = 'fb-clear'; clear.textContent = '清除结果';
      clear.addEventListener('click', function(){ res.innerHTML = ''; result(config.notFoundText || ''); });
      res.appendChild(document.createElement('br')); res.appendChild(clear);
    }
    function load(){
      tries++;
      if (window.ARG_SEARCH_INDEX) return render(window.ARG_SEARCH_INDEX);
      const s = document.createElement('script'); s.src = 'arg-search-index.js?r=' + tries;
      s.onload = function(){ render(window.ARG_SEARCH_INDEX || []); };
      s.onerror = function(){ if (tries < 3) setTimeout(load, 3000); else render([]); };
      document.head.appendChild(s);
    }
    load();
  }

  const checkLink = (port) => {
    if (!port) return;
    playSynthSound('click');
    const raw = String(port).trim();
    const target = (config.links || {})[raw] || (config.links || {})[port] || ((config.files && config.files[raw]) ? raw : ((config.files && config.files[port]) ? port : null)) || raw;
    go(target);
  };

  window.ARG = { bind, go, checkRule, checkLink, playSynthSound };

  function bindSearch(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const input = form.querySelector('[data-arg-input="keyword"]') || form.querySelector('input[type="text"]') || form.querySelector('input');
      checkRule('search', input ? input.value : '');
    });
  }

  function bindLogin(form){
    const input = form.querySelector('[data-arg-input="password"]') || form.querySelector('input[type="password"]') || form.querySelector('input');
    const error = form.querySelector('[data-arg-error]') || form.querySelector('#error');
    const submitBtn = form.querySelector('[data-arg-submit], button[type="submit"], button');

    function doLogin(){
      const val = (input ? input.value : '').trim().toLowerCase();
      const rawExpected = String(config.password || '').trim().toLowerCase();
      const target = config.loginTarget || Object.values(config.links || {})[0] || '';
      
      const allowedPasswords = rawExpected ? rawExpected.split(/[,，;|/]+/).map(s => s.trim()).filter(Boolean) : [];
      const isMatch = allowedPasswords.length === 0 ? true : allowedPasswords.includes(val);

      if (isMatch) {
        playSynthSound('unlock');
        if (error) {
          error.style.color = '#10b981';
          error.textContent = '✓ 密码验证成功，正在解密载入...';
        }
        setTimeout(() => {
          if (target) go(target);
        }, 80);
      } else {
        playSynthSound('error');
        if (error) {
          error.style.color = '#ef4444';
          error.textContent = config.errorMessage || '❌ 密码错误，请重新输入！';
        }
        if (input) {
          input.value = '';
          input.focus();
        }
      }
    }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      e.stopPropagation();
      doLogin();
      return false;
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        doLogin();
      });
    }

    if (input) {
      input.addEventListener('keydown', function(e){
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          doLogin();
        }
      });
    }
  }

  function isImg(src){
    if (typeof src !== 'string') return false;
    const s = src.split('?')[0].toLowerCase();
    return s.startsWith('data:image/') || s.startsWith('blob:') || s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.gif') || s.endsWith('.webp') || s.endsWith('.svg') || s.endsWith('.ico');
  }

  function renderAvatar(src, fallback){
    if (!src) return fallback || '👤';
    if (isImg(src)) return '<img src="' + src.replace(/"/g, '&quot;') + '" class="avatar-img" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="avatar">';
    return src;
  }

  function bindChat(container){
    const contacts = config.contacts || [];
    let currentIdx = 0;
    const contactsList = container.querySelector('#contactsList');
    const nameEl = container.querySelector('#currentContactName');
    const bioEl = container.querySelector('#currentContactBio');
    const messagesEl = container.querySelector('#chatMessages');
    const choicesEl = container.querySelector('#chatChoicesArea');
    const form = container.querySelector('#chatForm');
    const input = container.querySelector('#chatInput');

    // —— 聊天存档：按联系人持久化动态对话（打字/选项/回复），localStorage，跨会话保留 ——
    const CHAT_LOG_KEY = 'arg_chat_log_v1';
    function readChatLog(){ try { return JSON.parse(localStorage.getItem(CHAT_LOG_KEY) || '{}'); } catch (e) { return {}; } }
    function logMsg(cid, sender, text){
      if (!cid) return;
      try {
        const l = readChatLog(); l[cid] = l[cid] || [];
        l[cid].push({ s: sender, t: text });
        if (l[cid].length > 300) l[cid] = l[cid].slice(-300);
        localStorage.setItem(CHAT_LOG_KEY, JSON.stringify(l));
      } catch (e) {}
    }
    function ensureChatStyle(){
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

    // 消息渲染分支：数据丢失 / 自动回复 / 等待回复 / 未接通语音 / 自定义分隔
    function stampRow(){
      if (!messagesEl) return null;
      const d = document.createElement('div');
      d.className = 'msg-ts';
      try { d.textContent = '  ' + gameClockText(); } catch (e) { d.textContent = '  '; }
      d.style.textAlign = 'right';
      messagesEl.appendChild(d);
      return d;
    }
    function npcSay(text, contact, cb){
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
      setTimeout(function(){
        row.remove();
        appendMessage('npc', text, contact && contact.avatar);
        stampRow();
        if (contact && contact.id) logMsg(contact.id, 'npc', text);
        if (cb) cb();
      }, wait);
    }
    function renderMessage(m, contact){
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
    // 行动条：玩家"做了某事"而非"说了某话"（避免把指令当台词念出来）
    function appendAction(text, silent){
      if (!messagesEl) return;
      const d = document.createElement('div');
      d.className = 'msg-action';
      d.textContent = '—— ' + text + ' ——';
      messagesEl.appendChild(d);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    if (!contacts.length) {
      if (contactsList) {
        contactsList.innerHTML = '<div style="padding:16px 10px;text-align:center;color:var(--text-muted, #888);font-size:12px;">暂无联系人</div>';
      }
      if (messagesEl) {
        messagesEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted, #888);font-size:13px;">暂无对话内容</div>';
      }
      return;
    }

    function renderContacts(){
      if (!contactsList) return;
      contactsList.innerHTML = '';
      contacts.forEach((c, idx) => {
        const item = document.createElement('div');
        item.className = 'contact-item' + (idx === currentIdx ? ' active' : '');
        item.innerHTML = '<div class="contact-avatar">' + renderAvatar(c.avatar, '👤') + '</div>' +
          '<div class="contact-meta"><div class="contact-name">' + (c.name || '联系人') + '</div>' +
          '<div class="contact-bio">' + (c.bio || '') + '</div></div>';
        item.addEventListener('click', () => {
          playSynthSound('click');
          currentIdx = idx;
          renderContacts();
          loadChat(contacts[idx]);
        });
        contactsList.appendChild(item);
      });
    }

    function appendMessage(sender, text, avatar){
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
      
      if (!isUser) {
        playSynthSound('notify');
      }

      if (isUser) {
        // WeChat User style: [Bubble] [Avatar] on far right
        row.appendChild(bubble);
        row.appendChild(avDiv);
      } else {
        // WeChat NPC style: [Avatar] [Bubble] on left
        row.appendChild(avDiv);
        row.appendChild(bubble);
      }
      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderChoices(choices, contact){
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
        btn.type = 'button';
        btn.className = 'choice-btn';
        btn.textContent = choice.text;
        btn.addEventListener('click', () => {
          playSynthSound('click');
          armChoice(choice, contact);
        });
        choicesEl.appendChild(btn);
      });
    }

    // —— scripted 演出：话先打在框里，按不按出去由玩家决定 ——
    var pendingChoice = null;
    function disarmSend(){
      pendingChoice = null;
      if (form) {
        const send = form.querySelector('button[type="submit"],.chat-send-btn,button');
        if (send) send.classList.remove('arg-send-armed');
      }
      if (choicesEl) {
        const hint = choicesEl.querySelector('.arg-scripted-hint');
        if (hint) hint.remove();
      }
    }
    function armChoice(choice, contact){
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
    function fireChoice(choice, contact){
      disarmSend();
      appendAction(choice.text);
      logMsg(contact.id, 'action', choice.text);
      if (choice.reply) {
        npcSay(choice.reply, contact, function(){
          if (choice.target) setTimeout(function(){ go(choice.target); }, 460);
        });
      } else if (choice.target) {
        setTimeout(function(){ go(choice.target); }, 260);
      }
    }

    function loadChat(contact){
      if (nameEl) nameEl.textContent = contact.name;
      if (bioEl) bioEl.textContent = contact.bio || '';
      if (messagesEl) messagesEl.innerHTML = '';
      if (choicesEl) choicesEl.innerHTML = '';

      const timeDiv = document.createElement('div');
      timeDiv.className = 'msg-time-divider';
      timeDiv.textContent = '—— 今日对话加密保护中 ——';
      messagesEl.appendChild(timeDiv);

      if (contact.messages && contact.messages.length) {
        contact.messages.forEach(m => { renderMessage(m, contact); });
      }

      // 重放历史动态对话（打字/选项/回复），跨会话持久
      let history = [];
      try { history = readChatLog()[contact.id] || []; } catch (e) {}
      history.forEach(m => {
        if (m.s === 'action') appendAction(m.t, true);
        else appendMessage(m.s === 'user' ? 'user' : 'npc', m.t, contact.avatar);
      });

      if (contact.dialogue && contact.dialogue.length) {
        contact.dialogue.forEach(item => {
          if (item.sender === 'npc' && item.text) appendMessage('npc', item.text, contact.avatar);
          else if ((item.sender === 'user' || item.sender === 'player') && item.text) appendMessage('user', item.text);
          else if (item.sender === 'choice' && item.options) renderChoices(item.options, contact);
        });
      }

      if (contact.choices && contact.choices.length) {
        renderChoices(contact.choices, contact);
      }
    }

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const contact = contacts[currentIdx];
        // scripted：这一句是选项替你打好的，按出去才真正执行
        if (pendingChoice && pendingChoice.contact === contact && text === pendingChoice.choice.text) {
          const pc = pendingChoice;
          input.value = '';
          fireChoice(pc.choice, pc.contact);
          return;
        }
        disarmSend();
        input.value = '';
        appendMessage('user', text);
        stampRow();
        logMsg(contact.id, 'user', text);
        // ARG：联系人答案校验——把查到的答案打字发给他，对了才给回信并记线索
        const accepted = String(contact.passphrase || '').split(/[,，;|/]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const hit = accepted.length > 0 && accepted.indexOf(text.toLowerCase()) !== -1;
        let replyText;
        if (hit) {
          replyText = contact.passphraseReply || '……对。就是这个。';
          if (contact.passphraseClue) triggerClue(contact.passphraseClue);
        } else {
          // 角色化敷衍回复：轮换池（可用联系人自定义 fallbackReplies 覆盖）
          const pool = (contact.fallbackReplies && contact.fallbackReplies.length) ? contact.fallbackReplies :
            ['（对方沉默了很久。）', '（对方正在输入，又停下了。）', '（对方只回了一个句号。）', '（对方没有回复。海那头的信号，断断续续。）', '（对方把话头，轻轻收了回去。）'];
          const logLen = (() => { try { return (readChatLog()[contact.id] || []).length; } catch (e) { return 0; } })();
          replyText = pool[logLen % pool.length];
        }
        npcSay(replyText, contact, function(){
          if (hit && contact.passphraseTarget) setTimeout(() => go(contact.passphraseTarget), 520);
        });
      });
    }

    renderContacts();
    if (contacts.length > 0) loadChat(contacts[0]);
  }

  let bound = false;
  function bind(){
    if (bound) return;
    bound = true; // 无论本页有没有 data-arg-component，都只绑一次（桌面页此前会重复执行 3 次）
    document.querySelectorAll('[data-arg-component="search"]').forEach(bindSearch);
    document.querySelectorAll('[data-arg-component="login"]').forEach(bindLogin);
    document.querySelectorAll('[data-arg-component="chat"]').forEach(bindChat);

    // Apply typewriter on configured text bodies
    if (config.typewriter) {
      document.querySelectorAll('[data-arg-slot="body"], [data-arg-slot="message"]').forEach(el => applyTypewriter(el, 48));
    }

    // Atmosphere overlay
    if (config.atmosphere) {
      document.body.classList.add('arg-atmosphere-' + config.atmosphere);
    }

    // Click handler for all links/ports
    document.addEventListener('click', function(e){
      const el = e.target && e.target.closest ? e.target.closest('[data-arg-link], [data-arg-port]') : null;
      if (el) {
        e.preventDefault();
        const port = el.dataset.argLink || el.dataset.argPort;
        if (port) checkLink(port);
      }
    });

    // Double click handler for desktop icons
    document.addEventListener('dblclick', function(e){
      const el = e.target && e.target.closest ? e.target.closest('[data-arg-link], [data-arg-port]') : null;
      if (el) {
        e.preventDefault();
        const port = el.dataset.argLink || el.dataset.argPort;
        if (port) checkLink(port);
      }
    });

    // 进度角标/重置、4.5Hz 底噪开关、隐藏访问统计（均兜底，不影响游戏）
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
    // 维基模板侧栏：给「首页/最近更改/随机条目/绝密专题」真实功能
    try {
      const menu = document.querySelector('.wiki-menu');
      if (menu && !menu.dataset.wired) {
        menu.dataset.wired = '1';
        const wst = document.createElement('style');
        wst.textContent = '.wiki-menu-item{cursor:pointer;transition:all .15s}.wiki-menu-item:hover{color:#1a58d8;text-decoration:underline}';
        document.head.appendChild(wst);
        const WMAP = { '首页': 'node_desktop', '最近更改': 'node_timeline', '绝密专题': 'node_login_hard' };
        menu.querySelectorAll('.wiki-menu-item').forEach(function(el){
          const t = el.textContent.trim();
          el.addEventListener('click', function(){
            playSynthSound('click');
            if (t === '随机条目') {
              const jump = function(idx){
                let pool = (idx && idx.length) ? idx : Object.keys(config.files || {}).map(function(k){ return { id: k }; });
                pool = pool.filter(function(x){ return !/^end_/.test(x.id); });
                if (!pool.length) return;
                let pick = pool[Math.floor(Math.random() * pool.length)], guard = 0;
                while (guard++ < 10 && pick.id === config.nodeId) pick = pool[Math.floor(Math.random() * pool.length)];
                go(pick.id);
              };
              if (window.ARG_SEARCH_INDEX) jump(window.ARG_SEARCH_INDEX);
              else {
                const s = document.createElement('script'); s.src = 'arg-search-index.js?r=' + Date.now();
                s.onload = function(){ jump(window.ARG_SEARCH_INDEX || []); };
                s.onerror = function(){ jump([]); };
                document.head.appendChild(s);
              }
            } else if (WMAP[t]) { go(WMAP[t]); }
          });
        });
      }
    } catch (e) {}
    // ARG 彩蛋：控制台问候
    try { console.log('%cFM 99.4 · 潮声%c ——还有人的名字，没有被念完。', 'color:#22d3ee;font-weight:bold', 'color:#94a3b8'); } catch (e) {}

    // Expose official API for custom templates
    window.ARG_RUNTIME = {
      go: go,
      checkLink: checkLink,
      playSynthSound: playSynthSound,
      triggerClue: triggerClue,
      getClues: getClues,
      config: config
    };
  }

  bind();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  }
  window.addEventListener('load', bind);
})();