// src/runtime/index.mjs — 装配入口 bind()、对外 API、维基侧栏接线、彩蛋
import { config, hasClue, triggerClue, getClues, readVisited, isShadow, applyShadowSkin } from './core.mjs';
import { playSynthSound } from './audio.mjs';
import { applyTypewriter } from './typewriter.mjs';
import { ensureProgressPill } from './progress.mjs';
import { ensureDroneToggle } from './audio.mjs';
import { trackVisit, ensureStats } from './stats.mjs';
import { ensureNameInput } from './nameinput.mjs';
import { ensureGlobalSkin } from './skin.mjs';
import { ensureNotifyRelay } from './notify.mjs';
import { ensureViewportMeta, ensureLandscapeProbe, ensureGameClock, ensureWindowManager, ensurePowerMenu, ensureTrayTexture, gameClockText } from './desktop.mjs';
import { go, checkRule, checkLink, bindSearch, bindLogin } from './router.mjs';
import { bindChat } from './chat.mjs';
import { ensurePostLock, ensureForumLife } from './forum.mjs';
import { runPuzzleHost } from './puzzles.mjs';
import { ensureOS } from './osshell.mjs';
import { registerGame } from './games.mjs';
import './games-builtin.mjs'; // 副作用：注册内置小游戏

export function bind() {
  if (window.__argBound) return;
  window.__argBound = true;
  document.querySelectorAll('[data-arg-component="search"]').forEach(bindSearch);
  document.querySelectorAll('[data-arg-component="login"]').forEach(bindLogin);
  document.querySelectorAll('[data-arg-component="chat"]').forEach(bindChat);

  if (config.typewriter) {
    document.querySelectorAll('[data-arg-slot="body"], [data-arg-slot="message"]').forEach(el => applyTypewriter(el, 48));
  }
  if (config.atmosphere) document.body.classList.add('arg-atmosphere-' + config.atmosphere);

  document.addEventListener('click', function (e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-arg-link], [data-arg-port]') : null;
    if (el) { e.preventDefault(); const port = el.dataset.argLink || el.dataset.argPort; if (port) checkLink(port); }
  });
  document.addEventListener('dblclick', function (e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-arg-link], [data-arg-port]') : null;
    if (el) { e.preventDefault(); const port = el.dataset.argLink || el.dataset.argPort; if (port) checkLink(port); }
  });

  try { ensureViewportMeta(); } catch (e) {}
  try { ensureLandscapeProbe(); } catch (e) {}
  try { ensureGameClock(); } catch (e) {}
  try { ensureNotifyRelay(); } catch (e) {}
  try { ensurePostLock(); } catch (e) {}
  try { ensureForumLife(); } catch (e) {}
  try { if (config.isSearch && config.shadowKey && isShadow()) applyShadowSkin(false); } catch (e) {}
  try {
    if (document.querySelector('.win98-desktop,.xp-desktop,.winxp-desktop,.macos-desktop,.cyber-desktop,.dark-desktop,.desktop-main,.mac-main-area')) {
      ensureWindowManager(); ensurePowerMenu(); ensureTrayTexture();
    }
  } catch (e) {}
  try { ensureProgressPill(); } catch (e) {}
  try { ensureDroneToggle(); } catch (e) {}
  try { trackVisit(); } catch (e) {}
  try { ensureStats(); } catch (e) {}
  try { ensureNameInput(); } catch (e) {}
  try { ensureGlobalSkin(); } catch (e) {}
  try { runPuzzleHost(); } catch (e) {}
  try { ensureOS(); } catch (e) {}

  // 维基侧栏：给「首页/最近更改/随机条目/绝密专题」真实功能
  try {
    const menu = document.querySelector('.wiki-menu');
    if (menu && !menu.dataset.wired) {
      menu.dataset.wired = '1';
      const wst = document.createElement('style');
      wst.textContent = '.wiki-menu-item{cursor:pointer;transition:all .15s}.wiki-menu-item:hover{color:#1a58d8;text-decoration:underline}';
      document.head.appendChild(wst);
      const WMAP = { '首页': 'node_desktop', '最近更改': 'node_timeline', '绝密专题': 'node_login_hard' };
      menu.querySelectorAll('.wiki-menu-item').forEach(function (el) {
        const t = el.textContent.trim();
        el.addEventListener('click', function () {
          playSynthSound('click');
          if (t === '随机条目') {
            const jump = function (idx) {
              let pool = (idx && idx.length) ? idx : Object.keys(config.files || {}).map(function (k) { return { id: k }; });
              pool = pool.filter(function (x) { return !/^end_/.test(x.id); });
              if (!pool.length) return;
              let pick = pool[Math.floor(Math.random() * pool.length)], guard = 0;
              while (guard++ < 10 && pick.id === config.nodeId) pick = pool[Math.floor(Math.random() * pool.length)];
              go(pick.id);
            };
            if (window.ARG_SEARCH_INDEX) jump(window.ARG_SEARCH_INDEX);
            else {
              const s = document.createElement('script'); s.src = 'arg-search-index.js?r=' + Date.now();
              s.onload = function () { jump(window.ARG_SEARCH_INDEX || []); };
              s.onerror = function () { jump([]); };
              document.head.appendChild(s);
            }
          } else if (WMAP[t]) { go(WMAP[t]); }
        });
      });
    }
  } catch (e) {}

  try { console.log('%cFM 99.4 · 潮声%c ——还有人的名字，没有被念完。', 'color:#22d3ee;font-weight:bold', 'color:#94a3b8'); } catch (e) {}

  // 对外 API
  window.ARG_RUNTIME = { go, checkLink, playSynthSound, triggerClue, getClues, checkRule, config, registerGame };
}

export function bootGlobalApi() {
  window.ARG = window.ARG || {};
  window.ARG.bind = bind; window.ARG.go = go; window.ARG.checkRule = checkRule; window.ARG.checkLink = checkLink; window.ARG.playSynthSound = playSynthSound;
  try { window['潮声'] = window.ARG; } catch (e) {}
  if (!window.ARG.toast) {
    window.ARG.toast = function (msg) {
      try { const t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);background:#0f766e;color:#fff;padding:6px 14px;border-radius:8px;z-index:99996;font-size:12.5px'; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 2600); } catch (e) {}
    };
  }
}

bootGlobalApi();
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  window.addEventListener('load', bind);
}
