// src/runtime/osshell.mjs — 桌面外壳装配：任务栏 + 开始(打开资源管理器) + 皮肤快切；仅在桌面/文件柜页激活（DOM 探测）
import { initOS, openWindow, listWindows } from './os.mjs';
import { openExplorer } from './osexplorer.mjs';
import { openControlPanel, applyOsuia11y } from './oscontrol.mjs';
import { applyTheme, currentTheme, SKINS } from './ostheme.mjs';
import { playSynthSound } from './audio.mjs';

function isOSTargetPage() {
  if (typeof document === 'undefined') return false;
  return !!(document.querySelector('.folder') || document.querySelector('.winxp-desktop') || document.querySelector('.desktop-main') || document.querySelector('.desktop-icons'));
}
// Files 页 → 猜要展开哪个文件夹（按该页 nodeId 命中的 vfs 夹）
function guessFolder(nodeId) {
  const vfs = (typeof window !== 'undefined' && window.ARG_VFS) || { folders: [] };
  for (const f of vfs.folders) if (f.items.some((it) => it.id === nodeId)) return f.folder;
  return null;
}

export function ensureOS() {
  if (typeof document === 'undefined') return;
  if (window.__osBooted || !isOSTargetPage()) return;
  window.__osBooted = true;

  // 桌面工作区（浮层容器）：不遮挡原页面，但承载窗口
  const layer = document.createElement('div'); layer.id = 'os-layer';
  layer.style.cssText = 'position:fixed;inset:0 0 30px 0;z-index:99980;pointer-events:none;';
  document.body.appendChild(layer);
  const work = document.createElement('div'); work.className = 'os-workarea'; work.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  layer.appendChild(work);

  // 任务栏
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:30px;z-index:99985;display:flex;align-items:center;gap:6px;padding:0 6px;background:var(--os-titlebar,#000080);color:#fff;font-family:Tahoma,sans-serif;font-size:12px;box-shadow:0 -2px 8px rgba(0,0,0,.3)';
  const start = document.createElement('button'); start.textContent = '▶ 开始'; start.style.cssText = 'border:none;border-radius:6px;padding:3px 10px;font-weight:bold;cursor:pointer;background:linear-gradient(#e8e8e8,#cfcfcf);color:#111';
  const tasks = document.createElement('div'); tasks.className = 'os-tasks'; tasks.style.cssText = 'display:flex;gap:5px;flex:1;overflow:hidden';
  const thm = document.createElement('button'); thm.textContent = '🎨 ' + (SKINS[currentTheme()] ? SKINS[currentTheme()].label.split(' ')[0] : '皮肤'); thm.style.cssText = 'border:none;border-radius:6px;padding:3px 8px;cursor:pointer;background:rgba(255,255,255,.18);color:#fff';
  bar.appendChild(start); bar.appendChild(tasks); bar.appendChild(thm);
  document.body.appendChild(bar);

  // 让窗口落在工作区、按钮落在任务栏
  initOS({ work, bar: tasks });
  try { applyOsuia11y(); } catch (e) {}
  // os-win 需可点（layer pointer-events none，窗口本身 auto）
  const fixPE = () => { document.querySelectorAll('#os-layer .os-win').forEach((w) => (w.style.pointerEvents = 'auto')); };
  const mo = new MutationObserver(fixPE); mo.observe(work, { childList: true });

  start.onclick = () => { playSynthSound('click'); const open = document.createElement('div'); open.className = 'os-menu'; open.style.cssText = 'position:fixed;left:6px;bottom:34px;z-index:99986;min-width:190px;background:var(--os-face);border:var(--os-border);box-shadow:var(--os-shadow);padding:4px;color:var(--os-fg);font-size:12.5px';
    const mi = (lab, fn) => { const b = document.createElement('div'); b.textContent = lab; b.style.cssText = 'padding:7px 10px;cursor:pointer;border-radius:3px'; b.onmouseenter = () => (b.style.background = 'var(--os-accent)'), b.style.color = '#fff'; b.onmouseleave = () => (b.style.background = '', b.style.color = 'var(--os-fg)'); b.onclick = () => { open.remove(); fn(); }; return b; };
    open.appendChild(mi('📁 资源管理器', () => { openExplorer(guessFolder((window.ARG_RUNTIME && ARG_RUNTIME.config && ARG_RUNTIME.config.nodeId) || '')); fixPE(); }));
    open.appendChild(mi('🖥️ 关于本机', () => { openWindow({ id: 'os_about', title: '关于本机', w: 360, h: 200, render: (b) => { b.style.padding = '12px'; b.innerHTML = '<b>潮声 OS · FM99.4</b><br>声音修复师工作台<br>窗口 ' + listWindows().length + ' 个<br>皮肤 ' + (SKINS[currentTheme()] || {}).label; } }); fixPE(); }));
    open.appendChild(mi('🎛️ 控制面板', () => { openControlPanel((k) => { thm.textContent = '🎨 ' + SKINS[k].label.split(' ')[0]; }); fixPE(); }));
    open.appendChild(mi('🎨 换皮肤', () => cycleTheme(thm)));
    document.body.appendChild(open); setTimeout(() => document.addEventListener('click', function h() { open.remove(); document.removeEventListener('click', h); }), 0); };
  function cycleTheme(btn) { const keys = Object.keys(SKINS); const next = keys[(keys.indexOf(currentTheme()) + 1) % keys.length]; applyTheme(next); btn.textContent = '🎨 ' + SKINS[next].label.split(' ')[0]; playSynthSound('unlock'); }

  // 文件柜页：自动开一个资源管理器，直接治“丑”
  if (document.querySelector('.folder')) { const nid = (window.ARG_RUNTIME && ARG_RUNTIME.config && ARG_RUNTIME.config.nodeId) || ''; openExplorer(guessFolder(nid) || undefined); fixPE(); }
}
