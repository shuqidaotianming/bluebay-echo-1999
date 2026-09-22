// src/runtime/osshell.mjs — 潮声OS 装配：会话(开机/登录) + 任务栏 + 开始/电源菜单 + 文件柜/回收站用资源管理器呈现
import { initOS, openWindow, listWindows } from './os.mjs';
import { openExplorer, folderFromLinks } from './osexplorer.mjs';
import { openControlPanel, applyOsuia11y } from './oscontrol.mjs';
import { openMail } from './osmail.mjs';
import { applyTheme, currentTheme, SKINS } from './ostheme.mjs';
import { playSynthSound } from './audio.mjs';
import { boot, login, isLoggedIn, hasBooted, markBooted, shutdown, restart, sleep, lock } from './osboot.mjs';

function isCabinetPage() { return !!document.querySelector('.folder'); }
function isDesktopPage() { return !!(document.querySelector('.winxp-desktop') || document.querySelector('.desktop-icons') || document.querySelector('.desktop-main')); }
function isOSTargetPage() { return typeof document !== 'undefined' && (isCabinetPage() || isDesktopPage()); }
function selfName(nid) { const n = (window.ARG_DATA && window.ARG_DATA.names) || {}; return n[nid] || (isCabinetPage() ? '文件柜' : '桌面'); }
function guessFolder(nodeId) {
  const vfs = (window.ARG_VFS) || { folders: [] };
  for (const f of vfs.folders) if (f.items.some((it) => it.id === nodeId)) return f.folder;
  return null;
}

export function ensureOS() {
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
