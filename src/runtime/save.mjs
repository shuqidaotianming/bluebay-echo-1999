// src/runtime/save.mjs — 存档版本化 + 导入/导出（商业解谜续玩标配）
import { readVisited, writeVisited } from './core.mjs';
import { packSave, normalizeVisited, SAVE_VERSION } from './logic.mjs';

export function exportSave() {
  try {
    const snap = packSave(localStorage);
    const code = 'BAY99.' + btoa(unescape(encodeURIComponent(JSON.stringify(snap))));
    const ta = document.createElement('textarea');
    ta.value = code; document.body.appendChild(ta); ta.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    if (done && window.ARG && ARG.toast) ARG.toast('存档码已复制到剪贴板（含 v' + SAVE_VERSION + '）。');
    else prompt('复制这串存档码，之后可粘贴导入：', code);
    return code;
  } catch (e) { return null; }
}

export function applyImport(code) {
  try {
    const raw = String(code).replace(/^BAY99\./, '');
    const snap = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (!snap || !Array.isArray(snap.visited)) throw new Error('bad');
    writeVisited(normalizeVisited(snap.visited));
    const set = (k, v) => { if (v != null) localStorage.setItem(k, v); };
    set('arg_chat_log_v1', JSON.stringify(snap.chat || {}));
    set('arg_your_name', snap.name || '');
    set('arg_shadow_949', snap.shadow || '');
    set('arg_game_start', snap.start || '');
    set('arg_unlocked_locks', JSON.stringify(snap.unlocked || []));
    set('arg_time_clues', JSON.stringify(snap.timeClues || []));
    localStorage.setItem('arg_save_version', String(snap.v || SAVE_VERSION));
    return true;
  } catch (e) { return false; }
}

export function importSavePrompt() {
  const code = window.prompt('粘贴存档码以恢复进度（将覆盖当前进度）：');
  if (!code) return;
  if (applyImport(code)) { window.location.reload(); }
  else window.alert('存档码无效或版本不兼容。');
}
