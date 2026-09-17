// src/runtime/puzzles.mjs — 硬核谜题能力：解锁前置 / 答案校验 / 时间锁 / 双标签页 / 小游戏宿主
import { config, result, hasClue, triggerClue, escapeHtml } from './core.mjs';
import { go } from './router.mjs';
import { playSynthSound } from './audio.mjs';
import { pushNotify } from './notify.mjs';
import { verifyAnswer, timeLockSatisfied } from './logic.mjs';
import { mountGame } from './games.mjs';

// —— 解锁前置：未满足 requiresClue 时显「封存」，防直接 URL 白嫖线索（core 里也已不记账）——
export function ensurePrecondition() {
  if (!config.requiresClue || hasClue(config.requiresClue)) return;
  if (document.getElementById('arg-sealed-gate')) return;
  const panel = document.createElement('div');
  panel.id = 'arg-sealed-gate';
  panel.style.cssText = 'position:fixed;inset:0;z-index:99994;display:flex;align-items:center;justify-content:center;background:rgba(6,10,18,.95);color:#e2e8f0;font-family:ui-monospace,Consolas,monospace;padding:20px;text-align:center';
  panel.innerHTML = '<div style="max-width:420px"><div style="font-size:34px">🔒</div>' +
    '<div style="letter-spacing:2px;margin:8px 0">此档案已封存</div>' +
    '<div style="font-size:13px;line-height:1.8;opacity:.8">还没到能打开它的时候。<br>先解开前面那道锁，再回来。<br>（即便直接敲网址，机器也不会替你把线索记进账。）</div>' +
    '<div style="margin-top:16px"><a id="arg-sealed-back" style="color:#7dd3fc;cursor:pointer;text-decoration:underline">← 退回上一页</a></div></div>';
  document.body.appendChild(panel);
  const bk = panel.querySelector('#arg-sealed-back');
  if (bk) bk.addEventListener('click', function () { window.history.back(); });
}

// —— 答案校验（solve-credit）：输入解出的词才记线索、才放行 ——
export function bindVerify() {
  const v = config.verify;
  if (!v) return;
  if (document.getElementById('arg-verify')) return;
  const host = document.querySelector('[data-arg-verify]') || document.querySelector('[data-arg-slot="body"]');
  if (!host) return;
  const box = document.createElement('div');
  box.id = 'arg-verify';
  box.style.cssText = 'margin:14px 0;padding:12px 14px;border:1px dashed rgba(148,163,184,.5);border-radius:10px;background:rgba(148,163,184,.06)';
  const already = v.clue ? hasClue(v.clue) : false;
  box.innerHTML = '<div style="font-size:12.5px;opacity:.85;margin-bottom:8px">' + escapeHtml(v.hint || '把你解出的答案，输入下面：') + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="arg-verify-in" placeholder="' + escapeHtml(v.placeholder || '答案…') + '" autocomplete="off" style="flex:1;min-width:160px;padding:7px 9px;border:1px solid rgba(148,163,184,.5);border-radius:8px;background:rgba(8,12,20,.6);color:#e2e8f0;font-family:inherit">' +
    '<button id="arg-verify-btn" type="button" style="padding:7px 14px;border:1px solid #16a34a;background:#166534;color:#fff;border-radius:8px;cursor:pointer">校验</button></div>' +
    '<div id="arg-verify-out" style="margin-top:8px;font-size:12.5px;min-height:16px">' + (already ? '<span style="color:#22c55e">✔ 已记下这条线索。</span>' : '') + '</div>';
  host.appendChild(box);
  const inp = box.querySelector('#arg-verify-in');
  const out = box.querySelector('#arg-verify-out');
  function attempt() {
    const val = String(inp.value || '').trim();
    const clue = verifyAnswer(v.answers, val);
    if (clue) {
      playSynthSound('unlock');
      triggerClue(clue);
      out.innerHTML = '<span style="color:#22c55e">' + escapeHtml(v.successText || '✔ 正确。机器替你记下了这条线索。') + '</span>';
      try { const lu = JSON.parse(localStorage.getItem('arg_unlocked_locks') || '[]'); if (!lu.includes('verify:' + clue)) { lu.push('verify:' + clue); localStorage.setItem('arg_unlocked_locks', JSON.stringify(lu)); } } catch (e) {}
      if (v.target) setTimeout(function () { go(v.target); }, 520);
    } else {
      playSynthSound('error');
      out.innerHTML = '<span style="color:#ef4444">' + escapeHtml(v.failText || '不对。再想想——答案就在你刚查到的东西里。') + '</span>';
    }
  }
  box.querySelector('#arg-verify-btn').addEventListener('click', attempt);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); attempt(); } });
}

// —— 时间锁：真实时钟 / 周年日期 / 持续收听，满足才发放线索 ——
function elapsedMin() {
  try {
    let t0 = parseInt(localStorage.getItem('arg_game_start') || '0', 10);
    if (!t0) { t0 = Date.now(); localStorage.setItem('arg_game_start', String(t0)); }
    return Math.floor((Date.now() - t0) / 60000);
  } catch (e) { return 0; }
}
function markTimeClueDone(id) { try { const l = JSON.parse(localStorage.getItem('arg_time_clues') || '[]'); if (id && !l.includes(id)) { l.push(id); localStorage.setItem('arg_time_clues', JSON.stringify(l)); } } catch (e) {} }
function timeClueDone(id) { try { return (JSON.parse(localStorage.getItem('arg_time_clues') || '[]') || []).includes(id); } catch (e) { return false; } }

export function ensureTimeLock() {
  const tl = config.timeLock;
  if (!tl) return;
  const host = document.querySelector('[data-arg-result]') || document.querySelector('[data-arg-slot="body"]');
  if (!host) return;
  let line = document.getElementById('arg-timelock');
  if (!line) { line = document.createElement('div'); line.id = 'arg-timelock'; line.style.cssText = 'margin-top:12px;font-size:12.5px;letter-spacing:.5px'; host.appendChild(line); }
  let holdStart = 0;
  function tick() {
    if (!holdStart) holdStart = Date.now();
    const holdMin = Math.floor((Date.now() - holdStart) / 60000);
    const r = timeLockSatisfied(tl, { now: new Date(), elapsedMin: elapsedMin(), holdMinutes: holdMin });
    if (r.ok) {
      if (tl.clue && !timeClueDone(tl.clue)) {
        markTimeClueDone(tl.clue); triggerClue(tl.clue);
        playSynthSound('unlock');
        if (pushNotify) pushNotify('时机到了——' + ((config.names && config.names[tl.clue]) || tl.clue) + '。', tl.clueTarget || '');
      }
      line.innerHTML = '<span style="color:#22c55e">◉ ' + escapeHtml(tl.okText || '窗口开启。') + '</span>';
    } else {
      const detail = tl.mode === 'gameclock' ? ('游戏钟 ' + r.phase + '，应在 ' + r.need)
        : tl.mode === 'holdMinutes' ? ('已守 ' + r.phase + ' 分钟，需 ' + r.need)
        : ('现在 ' + r.phase + '，应在 ' + r.need);
      line.innerHTML = '<span style="color:#f59e0b">◔ ' + escapeHtml(tl.waitText || '未到窗口') + '（' + escapeHtml(detail) + '）。' + (tl.mode === 'gameclock' ? '去别处多逛一会儿，时间在走。' : '') + '</span>';
    }
  }
  tick();
  if (tl.mode === 'gameclock' || tl.mode === 'holdMinutes' || tl.mode === 'hour') setInterval(tick, tl.mode === 'holdMinutes' ? 5000 : 20000);
}

// —— 双标签页握手：电台端 + 手机端各开一个，互相 echo 到才发线索 ——
export function ensureDualTab() {
  const d = config.dualTab;
  if (!d || !d.clue || hasClue(d.clue)) return;
  const KEY = 'arg_dualtab_echo';
  const role = d.role || (config.nodeId || 'x');
  function write() { try { localStorage.setItem(KEY, JSON.stringify({ role: role, ts: Date.now() })); } catch (e) {} }
  function othersSeen() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      const seen = JSON.parse(localStorage.getItem('arg_dualtab_seen') || '{}');
      if (raw && raw.role !== role && Date.now() - raw.ts < 12000) { seen[raw.role] = Date.now(); localStorage.setItem('arg_dualtab_seen', JSON.stringify(seen)); }
      const now = Date.now();
      const partners = d.partners || [];
      return partners.length ? partners.every(p => seen[p] && now - seen[p] < 20000) : Object.keys(seen).some(p => p !== role && now - seen[p] < 20000);
    } catch (e) { return false; }
  }
  function pulse() {
    write();
    if (othersSeen()) { triggerClue(d.clue); markTimeClueDone(d.clue); playSynthSound('unlock'); clearInterval(timer); const el = document.querySelector('[data-arg-result]'); if (el) el.textContent = '✔ 两端信号对上了。'; }
  }
  const timer = setInterval(pulse, 3000);
  pulse();
}

// —— 统一调度 ——
export function runPuzzleHost() {
  try { ensurePrecondition(); } catch (e) {}
  try { bindVerify(); } catch (e) {}
  try { ensureTimeLock(); } catch (e) {}
  try { ensureDualTab(); } catch (e) {}
  try { mountGame(); } catch (e) {}
}
