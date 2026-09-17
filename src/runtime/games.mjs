// src/runtime/games.mjs — 声音修复师小游戏宿主 + 注册表（阶段4 填充各 game）
import { config, hasClue, triggerClue, escapeHtml } from './core.mjs';
import { playSynthSound } from './audio.mjs';
import { pushNotify } from './notify.mjs';

// 注册表：type -> mount(canvasHost, opts, done) ；done(true) 记线索
export const __ARG_GAMES = (window.__ARG_GAMES = window.__ARG_GAMES || {});

export function mountGame() {
  const g = config.minigame;
  if (!g || !g.type) return;
  const host = document.querySelector('[data-arg-game]') || document.querySelector('[data-arg-slot="body"]') || document.body;
  if (!host || host === document.body) return;
  if (document.getElementById('arg-game-wrap')) return;
  const fn = __ARG_GAMES[g.type];
  if (!fn) { const w = document.createElement('div'); w.id = 'arg-game-wrap'; w.style.cssText = 'margin:14px 0;padding:10px;border:1px dashed #888;font-size:12px;opacity:.7'; w.textContent = '（本作小游戏：' + escapeHtml(g.type) + ' · 待载入）'; host.appendChild(w); return; }
  const wrap = document.createElement('div'); wrap.id = 'arg-game-wrap';
  wrap.style.cssText = 'margin:16px 0;padding:14px;border:1px solid rgba(148,163,184,.35);border-radius:12px;background:rgba(10,14,22,.35)';
  const title = document.createElement('div'); title.style.cssText = 'font-size:13px;letter-spacing:1px;margin-bottom:10px;opacity:.85';
  title.textContent = g.title || '声音修复工作台';
  wrap.appendChild(title);
  const stage = document.createElement('div'); stage.style.cssText = 'position:relative;width:100%';
  wrap.appendChild(stage);
  const status = document.createElement('div'); status.id = 'arg-game-status'; status.style.cssText = 'margin-top:10px;font-size:12.5px;min-height:16px;color:#94a3b8';
  wrap.appendChild(status);
  host.appendChild(wrap);
  const already = g.clue ? hasClue(g.clue) : false;
  if (already) { status.innerHTML = '<span style="color:#22c55e">✔ 这条线索已经拿到。</span>'; }
  function done(ok) {
    if (ok && g.clue && !already) {
      triggerClue(g.clue); playSynthSound('unlock');
      status.innerHTML = '<span style="color:#22c55e">' + escapeHtml(g.successText || '✔ 修复完成，声音回来了。') + '</span>';
      if (pushNotify) pushNotify('修好了：' + ((config.names && config.names[g.clue]) || g.clue), g.clue);
      if (g.target) setTimeout(function () { try { (window.ARG_RUNTIME || {}).go && (window.ARG_RUNTIME || {}).go(g.target); } catch (e) {} }, 600);
    } else if (!ok) {
      status.innerHTML = '<span style="color:#ef4444">' + escapeHtml(g.failText || '还没对准。再试一次。') + '</span>';
    }
  }
  try { fn(stage, g, done, status); } catch (e) { status.textContent = '（小游戏加载失败：' + e.message + '）'; }
}

// 供外部/阶段4 注册新游戏
export function registerGame(type, fn) { __ARG_GAMES[type] = fn; }
