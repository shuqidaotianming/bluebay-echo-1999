// src/runtime/forum.mjs — 帖子级密码锁、论坛生态、联网回退检索
import { config, result, hasClue, triggerClue, isShadow, maskText, escapeHtml, getClues } from './core.mjs';
import { go } from './router.mjs';
import { playSynthSound } from './audio.mjs';
import { pushNotify } from './notify.mjs';
import { gameClockText } from './desktop.mjs';

export function fbEsc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

export function ensurePostLock() {
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

export function ensureForumLife() {
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

export function ensureFbStyle() {
  if (document.getElementById('arg-fb-style')) return;
  const st = document.createElement('style'); st.id = 'arg-fb-style';
  st.textContent = '.arg-ir{background:#ffffff!important;border:1px solid #dbe4f0!important;border-radius:14px!important;padding:20px 24px!important;margin-top:18px!important;box-shadow:0 8px 24px rgba(20,40,80,.08)!important;color:#1f2937!important;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif!important}.arg-ir .fb-head{font-weight:700;font-size:15px;color:#0f172a;margin-bottom:12px}.arg-ir .fb-count{color:#6b7280;font-size:12.5px;margin-bottom:16px}.arg-ir .fb-item{margin-bottom:22px}.arg-ir .fb-item .t{color:#1a58d8;font-size:18px;cursor:pointer;line-height:1.4}.arg-ir .fb-item .t:hover{text-decoration:underline}.arg-ir .fb-item .u{color:#16803d;font-size:12.5px;margin:2px 0;word-break:break-all}.arg-ir .fb-item .s{color:#4b5563;font-size:14px;line-height:1.7}.arg-ir .fb-ext{margin:24px 0 6px;padding:14px 16px;background:#f0f6ff!important;border:1px solid #dbe7ff!important;border-radius:10px!important;font-size:14px;line-height:2;color:#33507a!important}.arg-ir .fb-ext a{color:#1a58d8;font-weight:600;text-decoration:none;margin-right:14px}.arg-ir .fb-ext a:hover{text-decoration:underline}.arg-ir .fb-none{color:#6b7280;font-size:14.5px;margin-bottom:18px}.arg-ir .fb-clear{display:inline-block;margin-top:6px;cursor:pointer;color:#1a58d8;font-size:13px;text-decoration:underline}.arg-ir .fb-real{margin:20px 0 8px;padding-top:10px;border-top:1px dashed #e2e8f0}.arg-ir .fb-item .t a{color:#1a58d8;text-decoration:none}.arg-ir .fb-item .t a:hover{text-decoration:underline}';
  document.head.appendChild(st);
}

export function fallbackSearch(text) {
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
