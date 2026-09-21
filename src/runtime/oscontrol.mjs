// src/runtime/oscontrol.mjs — 控制面板 App：皮肤切换 + 减少动效 + 高对比 + 存档导出/导入/重置
import { openWindow } from './os.mjs';
import { applyTheme, currentTheme, SKINS } from './ostheme.mjs';
import { exportSave, importSavePrompt } from './save.mjs';
import { playSynthSound } from './audio.mjs';

function toggleClass(cls, on) { try { document.documentElement.classList.toggle(cls, !!on); } catch (e) {} }
function persistPref(k, v) { try { localStorage.setItem(k, v ? '1' : ''); } catch (e) {} }

export function applyOsuia11y() {
  try {
    toggleClass('os-reduce', localStorage.getItem('os_reduce') === '1');
    toggleClass('os-contrast', localStorage.getItem('os_contrast') === '1');
  } catch (e) {}
}

export function openControlPanel(onThemeChange) {
  return openWindow({
    id: 'os_control', title: '🎛️ 控制面板', w: 400, h: 340,
    render: (body, win) => {
      body.style.padding = '12px 14px';
      const h = (t) => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'font-weight:bold;margin:10px 0 4px;font-size:13px'; return d; };
      const row = () => { const d = document.createElement('label'); d.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;padding:3px 0;cursor:pointer'; return d; };
      // 皮肤
      body.appendChild(h('桌面皮肤'));
      const grp = document.createElement('div');
      Object.keys(SKINS).forEach((k) => {
        const r = row(); const rb = document.createElement('input'); rb.type = 'radio'; rb.name = 'os_skin'; rb.checked = currentTheme() === k;
        rb.onchange = () => { applyTheme(k); playSynthSound('unlock'); if (onThemeChange) onThemeChange(k); };
        r.appendChild(rb); r.appendChild(document.createTextNode(SKINS[k].label)); grp.appendChild(r);
      });
      body.appendChild(grp);
      // 无障碍
      body.appendChild(h('无障碍'));
      const mkToggle = (key, lab, cls) => { const r = row(); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = (localStorage.getItem(key) === '1'); c.onchange = () => { persistPref(key, c.checked); toggleClass(cls, c.checked); playSynthSound('click'); }; r.appendChild(c); r.appendChild(document.createTextNode(lab)); body.appendChild(r); };
      mkToggle('os_reduce', '减少动效（关打字机/闪烁/噪点）', 'os-reduce');
      mkToggle('os_contrast', '高对比度', 'os-contrast');
      // 存档
      body.appendChild(h('调查存档'));
      const btn = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'margin:3px 6px 3px 0;padding:5px 10px;border:1px solid rgba(0,0,0,.4);background:var(--os-btn);color:var(--os-btn-fg);border-radius:var(--os-radius);cursor:pointer'; b.onclick = () => { playSynthSound('click'); fn(); }; return b; };
      body.appendChild(btn('导出存档码', () => exportSave()));
      body.appendChild(btn('导入存档码', () => importSavePrompt()));
      const info = document.createElement('div'); info.style.cssText = 'margin-top:8px;font-size:11.5px;color:var(--os-muted)';
      info.textContent = '存档保存在本机浏览器(localStorage)。导出码可跨设备续玩。';
      body.appendChild(info);
    },
  });
}
