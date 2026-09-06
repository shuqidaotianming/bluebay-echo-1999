
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
    st.textContent = '#arg-progress-pill{position:fixed;right:10px;bottom:10px;z-index:99990;font-size:11px;color:#cbd5e1;background:rgba(10,14,22,.55);border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:3px 9px;opacity:.55;pointer-events:auto;font-family:inherit}#arg-progress-pill:hover{opacity:.9}#arg-pv-reset{cursor:pointer;margin-left:4px;opacity:.7}#arg-pv-reset:hover{opacity:1;color:#f87171}';
    document.head.appendChild(st);
    function update(){ var n = document.getElementById('arg-pv-num'); if (n) n.textContent = String(readVisited().length); }
    update();
    window.addEventListener('focus', update);
    document.getElementById('arg-pv-reset').addEventListener('click', function(ev){
      ev.stopPropagation();
      if (window.confirm('确定重置全部调查进度？线索记录将清空，页面将重新载入。')) {
        try { localStorage.removeItem('arg_visited_nodes'); } catch (e) {}
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
          appendMessage('user', choice.text);
          if (choice.reply) {
            setTimeout(() => appendMessage('npc', choice.reply, contact.avatar), 300);
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
        setTimeout(() => appendMessage('npc', '收到。请继续核查其他线索。', contact?.avatar), 350);
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