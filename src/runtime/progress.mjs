// src/runtime/progress.mjs — 右下角进度角标 + 已收集清单 + 重置
import { config, readVisited } from './core.mjs';
import { exportSave, importSavePrompt } from './save.mjs';

export function ensureProgressPill() {
  if (!config.trackProgress || config.preview || document.getElementById('arg-progress-pill')) return;
  var el = document.createElement('div'); el.id = 'arg-progress-pill';
  el.innerHTML = '线索 <b id="arg-pv-num">0</b>/? <span id="arg-pv-save" title="导出/导入存档">⇄</span> <span id="arg-pv-reset" title="重置调查进度">⟳</span>';
  document.body.appendChild(el);
  var st = document.createElement('style');
  st.textContent = '#arg-progress-pill{position:fixed;right:10px;bottom:10px;z-index:99990;font-size:11px;color:#cbd5e1;background:rgba(10,14,22,.55);border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:3px 9px;opacity:.55;pointer-events:auto;font-family:inherit;cursor:pointer}#arg-progress-pill:hover{opacity:.9}#arg-pv-reset,#arg-pv-save{cursor:pointer;margin-left:4px;opacity:.7}#arg-pv-reset:hover{opacity:1;color:#f87171}#arg-pv-save:hover{opacity:1;color:#7dd3fc}#arg-pv-panel{position:fixed;right:10px;bottom:36px;z-index:99991;max-width:300px;max-height:55vh;overflow:auto;font-size:11.5px;line-height:1.7;color:#cbd5e1;background:rgba(10,14,22,.92);border:1px solid rgba(148,163,184,.3);border-radius:8px;padding:10px 12px;display:none}#arg-pv-panel b{color:#e2e8f0}#arg-pv-panel .dim{color:#64748b;font-size:10.5px}';
  document.head.appendChild(st);
  var panel = document.createElement('div'); panel.id = 'arg-pv-panel'; document.body.appendChild(panel);
  function update() { var n = document.getElementById('arg-pv-num'); if (n) n.textContent = String(readVisited().length); }
  function renderPanel() {
    const names = config.names || {};
    const list = readVisited().map(id => names[id] || id);
    panel.innerHTML = '<b>已收集线索 · ' + list.length + '</b><br>' +
      (list.length ? list.map(x => '· ' + x).join('<br>') : '<span class="dim">还没有收集任何线索。</span>') +
      '<br><span class="dim">（只显示已收集的线索；关键证据集齐，才会在聊天里浮现更重的结论。）</span>' +
      '<br><span id="arg-pv-export" style="color:#7dd3fc;cursor:pointer">⇄ 导出/导入存档</span>';
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    var ex = panel.querySelector('#arg-pv-export'); if (ex) ex.addEventListener('click', function (e) { e.stopPropagation(); exportSave(); importSavePrompt(); });
  }
  update();
  window.addEventListener('focus', update);
  el.addEventListener('click', function () { renderPanel(); });
  document.addEventListener('click', function (ev) {
    if (panel.style.display === 'block' && !panel.contains(ev.target) && ev.target !== el && !el.contains(ev.target)) panel.style.display = 'none';
  });
  document.getElementById('arg-pv-reset').addEventListener('click', function (ev) {
    ev.stopPropagation();
    if (window.confirm('确定重置全部调查进度？线索与聊天记录将清空，页面将重新载入。')) {
      try {
        localStorage.removeItem('arg_visited_nodes'); localStorage.removeItem('arg_chat_log_v1');
        localStorage.removeItem('arg_game_start'); localStorage.removeItem('arg_notify_v1'); localStorage.removeItem('arg_notify_seen');
        localStorage.removeItem('arg_unlocked_locks'); localStorage.removeItem('arg_time_clues');
      } catch (e) {}
      window.location.reload();
    }
  });
}
