// src/runtime/osboot.mjs — 潮声OS 会话：开机 POST → 带密码登录 → 关机/重启/休眠/锁屏
import { SKINS, applyTheme, currentTheme } from './ostheme.mjs';

const SESSION = 'os_session_v1'; // sessionStorage：本会话是否已登录（关机后清）
export function isLoggedIn() { try { return sessionStorage.getItem(SESSION) === '1'; } catch (e) { return false; } }
export function setLoggedIn(v) { try { v ? sessionStorage.setItem(SESSION, '1') : sessionStorage.removeItem(SESSION); } catch (e) {} }

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

// 开机自检 + 启动
export function boot(done) {
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
  const speed = reduced() ? 0 : 130;
  const iv = setInterval(() => {
    if (i < lines.length) { log.textContent += lines[i] + '\n'; i++; }
    else { clearInterval(iv); setTimeout(() => { if (done) done(); else login(); }, reduced() ? 200 : 650); }
  }, speed || 1);
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
  setLoggedIn(false);
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
  setLoggedIn(false);
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
