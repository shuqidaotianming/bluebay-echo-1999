// src/runtime/osdoc.mjs — 窗口内文档阅读器：取目标页正文，在 Explorer 窗口里分页/搜索呈现；取不到则回退整页导航
import { openWindow } from './os.mjs';
import { config, escapeHtml } from './core.mjs';
import { go } from './router.mjs';
import { playSynthSound } from './audio.mjs';

function fileFor(id) { return (config.files && config.files[id]) || (id === 'node_prologue' ? 'index.html' : id + '.html'); }

// 从一段 HTML 文本抽取正文（data-arg-slot=body 优先，兜底常见正文容器）
export function extractBody(html) {
  let m = html.match(/<[^>]*data-arg-slot="body"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
  if (!m) m = html.match(/<[^>]*class="[^"]*(?:cyber-body|scp-body|diary-content|news-content|mag-body|bbs-post-body)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
  if (!m) { const t = html.match(/<title>([\s\S]*?)<\/title>/i); return t ? t[1].trim() : ''; }
  return m[1]
    .replace(/<br\s*\/?>(?=)/gi, '\u0000') // 先占位保护换行
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\u0000/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
export function extractTitle(html) { const t = html.match(/<title>([\s\S]*?)<\/title>/i); return t ? t[1].replace(/\[[^\]]*\]\s*/g, '').trim() : ''; }

const PER_PAGE = 12; // 段/页

export function openDoc(nodeId, title) {
  const url = fileFor(nodeId);
  return openWindow({
    id: 'os_doc_' + nodeId, title: '📄 ' + (title || nodeId), w: 560, h: 460,
    render: (body, win) => {
      body.style.cssText = 'display:flex;flex-direction:column;height:100%';
      const tb = document.createElement('div'); tb.style.cssText = 'display:flex;gap:6px;align-items:center;padding:4px 6px;border-bottom:1px solid rgba(0,0,0,.2);font-size:12px';
      const q = document.createElement('input'); q.placeholder = '文内搜索…'; q.style.cssText = 'flex:1;padding:3px 6px;border:1px solid rgba(0,0,0,.3);border-radius:4px;background:#fff;color:#111';
      const nav = document.createElement('div'); nav.style.cssText = 'flex:1;overflow:auto;padding:12px 14px;line-height:1.9;font-size:14px;white-space:pre-wrap';
      const pager = document.createElement('div'); pager.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;padding:4px;border-top:1px solid rgba(0,0,0,.2);font-size:12px';
      const prev = document.createElement('button'); prev.textContent = '‹ 上页'; const next = document.createElement('button'); next.textContent = '下页 ›'; const label = document.createElement('span');
      tb.appendChild(q); pager.appendChild(prev); pager.appendChild(label); pager.appendChild(next);
      body.appendChild(tb); body.appendChild(nav); body.appendChild(pager);

      let paras = [];
      try { paras = (localStorage.getItem('arg_doccache_' + nodeId) || '').split('\u0001'); } catch (e) {}
      let page = 0, filter = '';
      function paint() {
        const list = filter ? paras.filter((p) => p.toLowerCase().includes(filter)) : paras;
        const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
        page = Math.min(page, pages - 1);
        const slice = list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).join('\n\n');
        nav.innerHTML = slice ? escapeHtml(slice) : '<i>（此页无正文，或为纯图/交互页）</i>';
        label.textContent = (page + 1) + ' / ' + pages + ' 页 · ' + list.length + ' 段';
        prev.disabled = page <= 0; next.disabled = page >= pages - 1;
      }
      function load(txt, ttl) {
        paras = txt.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
        try { localStorage.setItem('arg_doccache_' + nodeId, paras.join('\u0001')); } catch (e) {}
        if (ttl) win.el.querySelector('.os-title').textContent = '📄 ' + ttl;
        if (!paras.length) { nav.innerHTML = '本页无文本正文。'; label.textContent = '0 段'; }
      }
      if (paras.length > 1 && paras[0]) { paint(); }
      else {
        nav.textContent = '正在载入 …';
        fetch(url, { cache: 'force-cache' }).then((r) => r.text()).then((html) => {
          const txt = extractBody(html); load(txt, extractTitle(html)); win.res && (win.res.textContent = nodeId); paint();
        }).catch(() => {
          nav.innerHTML = '（离线/本地 file:// 无法在此窗内预览。）<br><a style="color:#22d3ee;cursor:pointer;text-decoration:underline">→ 整页打开</a>';
          const a = nav.querySelector('a'); if (a) a.onclick = () => go(nodeId);
        });
      }
      q.addEventListener('input', () => { filter = q.value.trim().toLowerCase(); page = 0; paint(); });
      prev.onclick = () => { page--; paint(); playSynthSound('click'); };
      next.onclick = () => { page++; paint(); playSynthSound('click'); };
      nav.tabIndex = 0;
      nav.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { page = Math.max(0, page - 1); paint(); } if (e.key === 'ArrowRight') { page++; paint(); } });
    },
  });
}
