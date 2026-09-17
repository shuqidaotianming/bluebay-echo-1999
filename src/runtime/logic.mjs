// src/runtime/logic.mjs — 纯函数（无 DOM），测试与运行时共用，单一事实来源
// 注意：这些函数不引用 config/document，可被 node 直接 import 测试。

export function normShadow(s) {
  let out = '';
  String(s || '').toLowerCase().split('').forEach(function (c) {
    if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || c === '.') out += c;
  });
  if (out.slice(0, 2) === 'fm') out = out.slice(2);
  while (out.slice(-2) === '.0') out = out.slice(0, -2);
  return out;
}

// 线索是否集齐：req 逗号分隔（小写），visited 全部命中才算
export function hasClueOf(visited, req) {
  if (!req) return true;
  const list = (visited || []).map((v) => String(v).toLowerCase());
  const reqList = String(req).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return reqList.every((r) => list.some((v) => v === r));
}

// 口令归一化：小写、按 , ; | / 拆分多解
export function allowedPasswords(raw) {
  return String(raw == null ? '' : raw).split(/[,，;|/]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}
export function passwordOk(rawExpected, value) {
  const list = allowedPasswords(rawExpected);
  if (!list.length) return true;
  return list.indexOf(String(value || '').trim().toLowerCase()) !== -1;
}

// 答案校验（solve-credit）：config.verifyAnswers = { 归一化答案: clueId, ... }
export function verifyAnswer(map, text) {
  const k = String(text || '').trim().toLowerCase();
  if (!map || !k) return null;
  // 先精确 key，再宽松（去空格）
  if (Object.prototype.hasOwnProperty.call(map, k)) return map[k];
  const kk = k.replace(/\s+/g, '');
  for (const key of Object.keys(map)) if (key.replace(/\s+/g, '') === kk) return map[key];
  return null;
}

// 时间锁谓词：now=Date 实例，elapsedMin=真实经过分钟（游戏时钟），返回 {ok, phase, need}
// cfg.timeLock =
//   { mode:'gameclock', start:'HH:MM', end:'HH:MM' }         // 游戏内钟（1 真实分=4 游戏分, 18:00→23:30）
//   { mode:'hour', start, end }                              // 真实小时本地制（跨零点支持）
//   { mode:'afterDate'|'beforeDate', date:'YYYY-MM-DD' }     // 真实日历日锁
//   { mode:'holdMinutes', minutes }                          // 持续收听（需宿主上报已停留分钟）
export function gameClock(elapsedMin) {
  const gameMin = 18 * 60 + Math.min((elapsedMin || 0) * 4, (23 * 60 + 30) - (18 * 60));
  const hh = Math.floor(gameMin / 60) % 24, mm = gameMin % 60;
  return (hh < 10 ? '0' + hh : '' + hh) + ':' + (mm < 10 ? '0' + mm : '' + mm);
}
function toMin(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); }
function inWindow(cur, start, end) { return start <= end ? (cur >= start && cur < end) : (cur >= start || cur < end); }

export function timeLockSatisfied(tl, ctx = {}) {
  if (!tl || !tl.mode) return { ok: true, phase: '', need: '' };
  const now = ctx.now || new Date();
  if (tl.mode === 'gameclock') {
    const cur = toMin(gameClock(ctx.elapsedMin));
    const ok = inWindow(cur, toMin(tl.start), toMin(tl.end));
    return { ok, phase: gameClock(ctx.elapsedMin), need: tl.start + '–' + tl.end };
  }
  if (tl.mode === 'hour') {
    const cur = now.getHours();
    const ok = inWindow(cur, tl.start, tl.end);
    return { ok, phase: String(cur), need: tl.start + ':00–' + tl.end + ':00' };
  }
  if (tl.mode === 'afterDate' || tl.mode === 'beforeDate') {
    const d = new Date(tl.date + 'T00:00:00');
    const ok = tl.mode === 'afterDate' ? now.getTime() >= d.getTime() : now.getTime() < d.getTime();
    return { ok, phase: now.toISOString().slice(0, 10), need: tl.date };
  }
  if (tl.mode === 'holdMinutes') {
    const ok = (ctx.holdMinutes || 0) >= tl.minutes;
    return { ok, phase: String(Math.floor(ctx.holdMinutes || 0)), need: '连续 ' + tl.minutes + ' 分钟' };
  }
  return { ok: true, phase: '', need: '' };
}

// 存档版本化：把散落 localStorage 键聚成带版本的快照，可导入/导出
export const SAVE_VERSION = 1;
export function packSave(store) {
  // store: 类 localStorage（getItem 可缺）
  const g = (k) => { try { return store.getItem(k); } catch (e) { return null; } };
  return {
    v: SAVE_VERSION,
    visited: JSON.parse(g('arg_visited_nodes') || '[]'),
    chat: JSON.parse(g('arg_chat_log_v1') || '{}'),
    name: g('arg_your_name') || '',
    shadow: g('arg_shadow_949') || '',
    start: g('arg_game_start') || '',
    notify: g('arg_notify_v1') || null,
    postOpen: (g('arg_post_open_flags') || '').split(',').filter(Boolean),
    unlocked: JSON.parse(g('arg_unlocked_locks') || '[]'),
    timeClues: JSON.parse(g('arg_time_clues') || '[]'),
  };
}
export function normalizeVisited(raw) {
  let arr;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch (e) { arr = []; } } else arr = raw;
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const x of arr) { const k = String(x); if (!seen.has(k)) { seen.add(k); out.push(k); } }
  return out;
}
