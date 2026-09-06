
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
      if (!visited.includes(id)) { visited.push(id); writeVisited(visited); }
    } catch (e) {}
  }
  function getClues() {
    try { return readVisited().slice(); } catch (e) { return []; }
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
            const s = document.createElement('span'); s.className = 'fb-clear'; s.textContent = x.it.t;
            s.addEventListener('click', function(){ playSynthSound('click'); fallbackSearch(x.it.t); });
            sug.appendChild(s);
            if (i < cands.length - 1) sug.appendChild(document.createTextNode('　·　'));
          });
          res.appendChild(sug);
        }
      }
      scored.forEach(function(x){
        const item = document.createElement('div'); item.className = 'fb-item';
        const t = document.createElement('div'); t.className = 't'; t.textContent = x.it.t + ' _ 蓝湾档案';
        t.addEventListener('click', function(){ playSynthSound('click'); go(x.it.id); });
        const u = document.createElement('div'); u.className = 'u'; u.textContent = 'https://lanwan.archive.fm99.4/' + x.it.u;
        const s = document.createElement('div'); s.className = 's'; s.textContent = x.it.s;
        item.appendChild(t); item.appendChild(u); item.appendChild(s);
        res.appendChild(item);
      });
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
      st.textContent = '.msg-action{text-align:center;font-size:11px;color:#94a3b8;font-style:italic;margin:8px 0;opacity:.85}';
      document.head.appendChild(st);
    }
    ensureChatStyle();
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
          // 行动条而非台词：玩家是"做了这个决定"，不是把指令念出来
          appendAction(choice.text);
          logMsg(contact.id, 'action', choice.text);
          if (choice.reply) {
            setTimeout(() => { appendMessage('npc', choice.reply, contact.avatar); logMsg(contact.id, 'npc', choice.reply); }, 300);
          }
          if (choice.target) {
            setTimeout(() => go(choice.target), choice.reply ? 600 : 250);
          }
        });
        choicesEl.appendChild(btn);
      });
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
        contact.messages.forEach(m => {
          appendMessage(m.sender, m.text, contact.avatar);
        });
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
        input.value = '';
        appendMessage('user', text);
        const contact = contacts[currentIdx];
        logMsg(contact.id, 'user', text);
        // ARG：联系人答案校验——把查到的答案打字发给他，对了才给回信并记线索
        const accepted = String(contact.passphrase || '').split(/[,，;|/]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const hit = accepted.length > 0 && accepted.indexOf(text.toLowerCase()) !== -1;
        setTimeout(() => {
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
          appendMessage('npc', replyText, contact?.avatar);
          logMsg(contact.id, 'npc', replyText);
          if (hit && contact.passphraseTarget) setTimeout(() => go(contact.passphraseTarget), 700);
        }, 350);
      });
    }

    renderContacts();
    if (contacts.length > 0) loadChat(contacts[0]);
  }

  let bound = false;
  function bind(){
    if (bound) return;
    const comps = document.querySelectorAll('[data-arg-component]');
    if (comps.length) bound = true;
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
    try { ensureProgressPill(); } catch (e) {}
    try { ensureDroneToggle(); } catch (e) {}
    try { trackVisit(); } catch (e) {}
    try { ensureStats(); } catch (e) {}
    try { ensureNameInput(); } catch (e) {}
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