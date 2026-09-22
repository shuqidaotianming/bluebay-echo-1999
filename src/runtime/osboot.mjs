// src/runtime/osboot.mjs — 潮声OS 会话：开机 POST → 带密码登录 → 关机/重启/休眠/锁屏
import { SKINS, applyTheme, currentTheme } from './ostheme.mjs';

const SESSION = 'os_session_v1'; // sessionStorage：本会话是否已登录（关机后清）
const BOOTED = 'os_booted_v1';   // sessionStorage：本会话是否已开机（关机/重启后清，重开则再放开机加载）
export function isLoggedIn() { try { return sessionStorage.getItem(SESSION) === '1'; } catch (e) { return false; } }
export function setLoggedIn(v) { try { v ? sessionStorage.setItem(SESSION, '1') : sessionStorage.removeItem(SESSION); } catch (e) {} }
export function hasBooted() { try { return sessionStorage.getItem(BOOTED) === '1'; } catch (e) { return false; } }
export function markBooted() { try { sessionStorage.setItem(BOOTED, '1'); } catch (e) {} }
export function powerOff() { try { sessionStorage.removeItem(SESSION); sessionStorage.removeItem(BOOTED); } catch (e) {} }

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

// 开机：BIOS 自检逐行 → 潮声OS Logo + 进度条 → 回调（固定时间轴，单一 finish 幂等 + 看门狗兜底）
export function boot(done) {
  let finished = false;
  const finish = () => { if (finished) return; finished = true; try { if (done) done(); } catch (e) {} };
  const fast = reduced();
  try {
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
    // 固定时间轴：每行 90ms，共 8 行 → 720ms；再 300ms 进入加载页
    const lineMs = fast ? 0 : 90;
    lines.forEach((ln, idx) => { if (fast) { log.textContent += ln + '\n'; } else setTimeout(() => { log.textContent += ln + '\n'; }, lineMs * (idx + 1)); });
    setTimeout(showOsLoading, fast ? 120 : lineMs * lines.length + 320);
  } catch (e) { finish(); }

  function showOsLoading() {
    try {
      const d = document.getElementById('os-screen'); if (!d) return;
      d.style.alignItems = 'center'; d.style.background = '#0a1622';
      d.innerHTML = '<div style="text-align:center;color:#cfe8ff;width:280px">' +
        '<div style="font-size:40px;line-height:1">📻</div>' +
        '<div style="font-size:22px;letter-spacing:6px;margin:12px 0 22px;font-weight:300">潮声 OS</div>' +
        '<div style="height:8px;border:1px solid rgba(180,220,255,.4);border-radius:5px;overflow:hidden;background:rgba(255,255,255,.06)"><div id="os-prog" style="height:100%;width:0;background:linear-gradient(90deg,#2b6cb0,#5fb0ff);transition:width .18s"></div></div>' +
        '<div id="os-loading-txt" style="margin-top:14px;font-size:12px;color:#8fb0cc;letter-spacing:1px">正在载入档案 …</div></div>';
      spinner(d);
      const steps = ['正在载入档案 …', '校验调阅权限 …', '重建声音索引 …', '接入 4.5Hz 底噪 …', '就差一个签名。'];
      const bar = document.getElementById('os-prog'), txt = document.getElementById('os-loading-txt');
      if (fast) { if (bar) bar.style.width = '100%'; setTimeout(finish, 250); return; }
      // 固定 5 步、每步 380ms → 1900ms；最后一步后再 350ms 收尾
      steps.forEach((s, idx) => setTimeout(() => {
        if (bar) bar.style.width = Math.round(((idx + 1) / steps.length) * 100) + '%';
        if (txt) txt.textContent = s;
      }, 380 * (idx + 1)));
      setTimeout(finish, 380 * steps.length + 420); // 约 2.3s 后必然进入登录
    } catch (e) { finish(); }
  }
  // 看门狗：无论如何 5.5s 兜底推进，绝不再卡住
  setTimeout(finish, 5500);
}

// 登录（有密码）
export function login(onOk) {
  setLoggedIn(false);
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
export function shutdown() {
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
export function restart() {
  powerOff();
  const d = fullscreen(); d.innerHTML = '<div style="color:#fff;font-size:18px">正在重新启动…</div>'; spinner(d);
  setTimeout(() => { const old = document.getElementById('os-screen'); if (old) old.remove(); boot(() => login(() => location.reload())); }, reduced() ? 250 : 1700);
}
export function sleep() {
  const d = fullscreen(); d.style.background = '#000';
  const clock = document.createElement('div'); clock.style.cssText = 'color:#e6e6e6;font-size:56px;font-weight:200'; clock.textContent = nowHM();
  const hint = document.createElement('div'); hint.style.cssText = 'color:#5a7183;font-size:13px;margin-top:14px'; hint.textContent = '已休眠 · 点按任意处唤醒';
  d.appendChild(clock); d.appendChild(hint);
  const wake = () => { const e = document.getElementById('os-screen'); if (e) e.remove(); document.removeEventListener('pointerdown', wake); document.removeEventListener('keydown', wake); };
  setTimeout(() => { document.addEventListener('pointerdown', wake); document.addEventListener('keydown', wake); }, 120);
}
export function lock() { setLoggedIn(false); login(() => location.reload()); }
