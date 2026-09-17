// src/runtime/nameinput.mjs — 「写给你的一页」署名输入（纪念站）
import { config } from './core.mjs';
import { escapeHtml } from './core.mjs';

export function ensureNameInput() {
  if (!config.nameInput || config.preview || document.getElementById('arg-name-input')) return;
  const host = document.querySelector('[data-arg-slot="body"]');
  if (!host) return;
  const wrap = document.createElement('div');
  wrap.id = 'arg-name-input';
  wrap.style.marginTop = '14px';
  wrap.innerHTML = '<input id="arg-name-field" placeholder="写下你的名字（会留在这台机器里）" style="width:70%;padding:6px 8px;background:#0a0e16;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);font-family:inherit"> <button id="arg-name-save" style="padding:6px 12px;background:#16335f;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);cursor:pointer;font-family:inherit">留下</button><div id="arg-name-line" style="margin-top:8px"></div>';
  host.appendChild(wrap);
  function render() {
    let n = ''; try { n = localStorage.getItem('arg_your_name') || ''; } catch (e) {}
    const line = document.getElementById('arg-name-line');
    if (line) line.innerHTML = n ? ('&gt; 本页献给调查者：<b>' + escapeHtml(n) + '</b>。海记住了。') : '';
  }
  document.getElementById('arg-name-save').addEventListener('click', function () {
    const v = (document.getElementById('arg-name-field').value || '').trim().slice(0, 20);
    if (!v) return;
    try { localStorage.setItem('arg_your_name', v); } catch (e) {}
    render();
  });
  render();
}
