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

export const SKINS = {
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
export function applyTheme(name, root) {
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
export function currentTheme() { try { return localStorage.getItem('os_theme') || 'win98'; } catch (e) { return 'win98'; } }
