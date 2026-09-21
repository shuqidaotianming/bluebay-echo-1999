// src/runtime/osmail.mjs — 邮件客户端：把 mail_/pm_/letter_ 节点当收件箱，未读标记、窗口内读信
import { openWindow } from './os.mjs';
import { openDoc } from './osdoc.mjs';
import { hasClue } from './core.mjs';
import { playSynthSound } from './audio.mjs';

const READ_KEY = 'os_mail_read_v1';
function readSet() { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch (e) { return new Set(); } }
function markRead(id) { try { const s = readSet(); if (!s.has(id)) { s.add(id); localStorage.setItem(READ_KEY, JSON.stringify([...s])); } } catch (e) {} }

function mailItems() {
  const vfs = (typeof window !== 'undefined' && window.ARG_VFS) || { folders: [] };
  const out = [];
  for (const f of vfs.folders) for (const it of f.items) {
    if (/^(mail_|pm_|letter_)/.test(it.id) && it.id !== 'letter_new') out.push(it);
  }
  return out;
}

export function openMail() {
  return openWindow({
    id: 'os_mail', title: '📮 潮声信箱', w: 560, h: 420,
    render: (body, win) => {
      body.style.cssText = 'display:flex;height:100%';
      const list = document.createElement('div'); list.style.cssText = 'width:230px;flex:0 0 auto;overflow:auto;border-right:1px solid rgba(0,0,0,.25)';
      const pane = document.createElement('div'); pane.style.cssText = 'flex:1;overflow:auto;padding:12px 14px;line-height:1.9;font-size:14px;white-space:pre-wrap';
      pane.innerHTML = '<i style="opacity:.6">← 选一封。锁着的（🔒）要先到对应档案页解锁。</i>';
      body.appendChild(list); body.appendChild(pane);

      const items = mailItems();
      const read = readSet();
      let unread = items.filter((it) => !read.has(it.id) && !it.lockedBy).length;
      function paintList(selId) {
        list.innerHTML = '';
        const head = document.createElement('div'); head.style.cssText = 'padding:6px 8px;font-size:11.5px;border-bottom:1px solid rgba(0,0,0,.2);color:var(--os-muted)';
        head.textContent = '收件箱 · ' + items.length + ' 封 · 未读 ' + unread; list.appendChild(head);
        items.forEach((it) => {
          const locked = it.lockedBy && !hasClue(it.lockedBy);
          const row = document.createElement('div');
          const isRead = read.has(it.id);
          row.style.cssText = 'padding:7px 9px;border-bottom:1px solid rgba(0,0,0,.08);cursor:pointer;font-size:12.5px;' + (selId === it.id ? 'background:var(--os-sel);color:#fff' : '') + (locked ? ';opacity:.55' : '');
          row.innerHTML = '<div style="font-weight:' + (isRead || locked ? 'normal' : 'bold') + '">' + (locked ? '🔒 ' : isRead ? '・ ' : '<b>▸ </b>') + escape(it.name) + '</div>' +
            '<div style="font-size:10.5px;opacity:.7">' + it.id.replace(/_(.)/g, (m, c) => ' ' + c.toUpperCase()) + '</div>';
          row.onclick = () => openMail2(it, locked, row, it.id);
          list.appendChild(row);
        });
      }
      function escape(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); }
      function openMail2(it, locked, row, id) {
        if (locked) { playSynthSound('error'); pane.innerHTML = '🔒 这封信要先解锁来源页（' + it.lockedBy + '）。'; return; }
        playSynthSound('click');
        paintList(id);
        // 窗口内直接取正文预览；同时提供“全屏打开”
        pane.innerHTML = '正在拆信 …';
        const url = it.id + '.html';
        fetch(url, { cache: 'force-cache' }).then((r) => r.text()).then((html) => {
          let m = html.match(/<[^>]*data-arg-slot="body"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
          const txt = m ? m[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim() : '（此信无文本正文）';
          pane.innerHTML = ''; const t = document.createElement('div'); t.style.cssText = 'font-weight:bold;margin-bottom:8px;border-bottom:1px dashed rgba(0,0,0,.3);padding-bottom:4px'; t.textContent = '📨 ' + it.name; pane.appendChild(t);
          const b = document.createElement('div'); b.textContent = txt.slice(0, 1200); pane.appendChild(b);
          const more = document.createElement('div'); more.style.marginTop = '10px'; const a = document.createElement('a'); a.textContent = '→ 全屏阅读 / 继续往来'; a.style.cssText = 'color:var(--os-accent);cursor:pointer;text-decoration:underline'; a.onclick = () => openDoc(it.id, it.name); more.appendChild(a); pane.appendChild(more);
          if (!read.has(it.id)) { markRead(it.id); unread = Math.max(0, unread - 1); }
        }).catch(() => { pane.innerHTML = '（离线无法预览。）'; });
      }
      paintList();
    },
  });
}
