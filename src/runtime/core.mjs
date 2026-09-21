// src/runtime/core.mjs — config 解析、结果槽、线索状态机、影子权限、敏感词、转义收口
import { normShadow, hasClueOf, normalizeVisited } from './logic.mjs';

export const configEl = (typeof document !== 'undefined') ? document.getElementById('arg-config') : null;
export const config = configEl ? JSON.parse(configEl.textContent || '{}') : { rules: {}, files: {}, links: {} };
// 全局数据文件 arg-data.js 提供整站 files/names；页内若带则作覆盖（省体积：多数页不再内嵌大表）
(function mergeGlobalData() {
  const G = (typeof window !== 'undefined' && window.ARG_DATA) ? window.ARG_DATA : {};
  config.files = Object.assign({}, G.files || {}, config.files || {});
  config.names = Object.assign({}, G.names || {}, config.names || {});
})();
export const result = (text) => { const el = document.querySelector('[data-arg-result]'); if (el) el.textContent = text; };

// HTML 转义：所有拼进 innerHTML 的动态字符串一律过这里（XSS 收口）
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---- 线索状态机 ----
export function readVisited() {
  try { return normalizeVisited(localStorage.getItem('arg_visited_nodes') || '[]'); } catch (e) { return []; }
}
export function writeVisited(list) {
  try { localStorage.setItem('arg_visited_nodes', JSON.stringify(list)); } catch (e) {}
}
if (typeof window !== 'undefined' && config.trackProgress !== false) {
  try {
    const visited = readVisited();
    const currentPageId = config.nodeId || config.pageName || window.location.pathname.split('/').pop().replace('.html', '');
    const unlocked = !config.requiresClue || hasClueOf(visited, config.requiresClue);
    if (unlocked && currentPageId && !visited.includes(currentPageId)) { visited.push(currentPageId); writeVisited(visited); }
    // 地址栏 hash 谜题（#firstlight / #sixtysix）——命中即记入线索
    if (unlocked && config.hashClue && config.hashValue &&
        String(window.location.hash).toLowerCase() === String(config.hashValue).toLowerCase()) {
      if (!visited.includes(config.hashClue)) { visited.push(config.hashClue); writeVisited(visited); }
    }
    // 存档版本戳（缺失即写，不破坏既有键）
    if (!localStorage.getItem('arg_save_version')) localStorage.setItem('arg_save_version', String(1));
  } catch (e) {}
}

export function hasClue(req) {
  if (!req) return true;
  try { return hasClueOf(readVisited(), req); } catch (e) { return true; }
}
export function triggerClue(id) {
  if (!id) return;
  try {
    const visited = readVisited();
    if (!visited.includes(id)) {
      visited.push(id); writeVisited(visited);
      if (typeof config === 'undefined' || !config.preview) {
        try {
          if (id !== (config && config.nodeId) && typeof pushNotify === 'function') {
            pushNotify('新线索 · ' + ((config.names && config.names[id]) || id) + '。有些门，现在能推得开了。', (config.files && config.files[id]) ? id : '');
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}
export function getClues() { try { return readVisited().slice(); } catch (e) { return []; } }

// ---- 影子搜索权限 / 敏感词涂码 ----
export var CENSOR_WORDS = ['白噪计划', '第九夜', '六十六', '听潮会', '随船', '失踪名单'];
export function isShadow() {
  try { return config.shadowClue ? hasClue(config.shadowClue) : localStorage.getItem('arg_shadow_949') === '1'; } catch (e) { return false; }
}
export function applyShadowSkin(fresh) {
  const host = document.querySelector('[data-arg-result]') || document.querySelector('.search-container,.term-container,.yahoo-container,.bbs-container');
  const id = 'arg-shadow-ribbon';
  if (document.getElementById(id)) return;
  const r = document.createElement('div'); r.id = id;
  r.textContent = '检索权限：档案员（94.9 MHz）· 内线索引已并入';
  r.style.cssText = 'margin:10px 0;padding:7px 12px;border-radius:8px;background:rgba(13,148,136,.12);border:1px dashed rgba(13,148,136,.55);color:#0f766e;font-size:12px;letter-spacing:1px';
  if (host && host.parentElement) host.parentElement.insertBefore(r, host);
  else document.body.insertBefore(r, document.body.firstChild);
  if (fresh) {
    const cands = Object.keys(config.shadowRules || {});
    if (cands.length) result('✔ 权限已切换：档案员检索。现在试试这些当年被挡在后面的词——' + cands.slice(0, 4).join(' / '));
  }
}
export function maskText(s) {
  let out = String(s || '');
  if (isShadow()) return out;
  CENSOR_WORDS.forEach(function (w) {
    while (out.indexOf(w) !== -1) {
      const bar = new Array(w.length + 1).join('▇');
      out = out.replace(w, bar);
    }
  });
  return out;
}
