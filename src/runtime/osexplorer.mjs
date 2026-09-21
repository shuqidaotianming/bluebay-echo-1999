// src/runtime/osexplorer.mjs — 资源管理器 App（消费 arg-vfs.js：目录树 + 文件区四视图 + 面包屑 + 排序 + 多选 + 右键 + ACL）
import { openWindow } from './os.mjs';
import { config, hasClue, escapeHtml } from './core.mjs';
import { go } from './router.mjs';
import { playSynthSound } from './audio.mjs';

const V = () => (typeof window !== 'undefined' && window.ARG_VFS) || { folders: [], lockedBy: {} };
const ICON = { doc:'📄', txt:'📃', pdf:'📕', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', wav:'🎧', mp3:'🎵', exe:'⚙️', msg:'✉️' };
function extOf(name) { const m = /\.(txt|pdf|jpg|jpeg|png|wav|mp3|exe|doc|msg)$/i.exec(name || ''); return m ? m[1].toLowerCase() : 'doc'; }

export function openExplorer(startFolder) {
  return openWindow({
    id: 'os_explorer', title: '潮声资源管理器', w: 640, h: 440,
    render: (body, win) => renderExplorer(body, win, startFolder),
  });
}

function renderExplorer(body, win, startFolder) {
  const vfs = V();
  let cur = vfs.folders.find((f) => f.folder === startFolder) || vfs.folders[0];
  let view = 'list', sortKey = 'name', sortDir = 1, sel = new Set();

  body.style.cssText = 'display:flex;height:100%';
  const tree = document.createElement('div'); tree.className = 'os-tree'; tree.style.cssText = 'width:180px;overflow:auto;border-right:1px solid rgba(0,0,0,.25);flex:0 0 auto;font-size:12.5px;padding:4px 0';
  const main = document.createElement('div'); main.style.cssText = 'flex:1;display:flex;flex-direction:column;min-width:0';
  body.appendChild(tree); body.appendChild(main);

  const nav = document.createElement('div'); nav.className = 'os-nav'; nav.style.cssText = 'display:flex;gap:6px;align-items:center;padding:4px 6px;border-bottom:1px solid rgba(0,0,0,.2);font-size:12px';
  const crumbs = document.createElement('div'); crumbs.style.cssText = 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  const seg = (t, on) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'border:1px solid rgba(0,0,0,.35);background:var(--os-btn);color:var(--os-btn-fg);cursor:pointer;border-radius:var(--os-radius);padding:1px 6px;font-size:11px'; if (on) { b.style.background = 'var(--os-accent)'; b.style.color = '#fff'; } b.onclick = () => { view = t; renderList(); }; return b; };
  nav.appendChild(crumbs); ['图标', '列表', '详细', '平铺'].forEach((v) => nav.appendChild(seg(v, false)));
  const mainHost = document.createElement('div'); mainHost.className = 'os-list'; mainHost.style.cssText = 'flex:1;overflow:auto';
  const status = document.createElement('div'); status.className = 'os-status'; status.style.cssText = 'border-top:1px solid rgba(0,0,0,.2);padding:2px 8px;font-size:11.5px;color:var(--os-muted)';
  main.appendChild(nav); main.appendChild(mainHost); main.appendChild(status); win.res.textContent = '资源管理器';

  // 目录树
  function renderTree() {
    tree.innerHTML = '';
    vfs.folders.forEach((f) => {
      const n = document.createElement('div'); n.className = 'os-node'; n.textContent = f.folder; n.title = f.folder;
      n.style.cssText = 'padding:2px 8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      if (f === cur) { n.classList.add('sel'); n.style.background = 'var(--os-sel)'; n.style.color = '#fff'; }
      n.onclick = () => { cur = f; sel.clear(); renderTree(); renderList(); };
      tree.appendChild(n);
    });
  }
  function locked(it) { return it.lockedBy ? !hasClue(it.lockedBy) : false; }
  function sorted() {
    const arr = cur.items.slice();
    arr.sort((a, b) => { const ka = sortKey === 'size' ? String(a.name).length : a[sortKey === 'type' ? 'id' : 'name'], kb = b[sortKey === 'size' ? 'size' : sortKey === 'type' ? 'id' : 'name']; return String(ka).localeCompare(String(kb), 'zh') * sortDir; });
    return arr;
  }
  function open(it) { if (locked(it)) { playSynthSound('error'); toast('🔒 无权访问：' + it.name + '（先解锁 ' + it.lockedBy + '）'); return; } playSynthSound('click'); go(it.id); }

  function renderList() {
    mainHost.innerHTML = '';
    crumbs.textContent = '🖥️ 我的电脑 › ' + cur.folder;
    [...nav.querySelectorAll('button')].forEach((b) => { const on = ['图标','列表','详细','平铺'][['图标','列表','详细','平铺'].indexOf(b.textContent)] === view; b.style.background = on ? 'var(--os-accent)' : 'var(--os-btn)'; b.style.color = on ? '#fff' : 'var(--os-btn-fg)'; });
    const items = sorted();
    if (view === '详细') {
      const t = document.createElement('table'); t.style.cssText = 'width:100%;border-collapse:collapse;font-size:12.5px';
      const head = document.createElement('tr');
      [['名称','name'],['类型','type'],['大小','size']].forEach(([lab,k]) => { const th = document.createElement('th'); th.textContent = lab + (sortKey===k ? (sortDir>0?' ▲':' ▼') : ''); th.style.cssText='text-align:left;padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.3);cursor:pointer;user-select:none'; th.onclick=()=>{ if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=1;} renderList(); }; head.appendChild(th); });
      t.appendChild(head);
      items.forEach((it) => { const tr = document.createElement('tr'); if (sel.has(it.id)) tr.style.background = 'var(--os-sel)'; tr.onclick = (e) => { if (!e.ctrlKey && !e.metaKey) sel.clear(); sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); renderList(); }; tr.ondblclick = () => open(it); tr.oncontextmenu = (e) => { e.preventDefault(); menu(e, it); };
        ['<td>'+ (locked(it)?'🔒':'') + escapeHtml(it.name) +'</td>','<td>' + extOf(it.name).toUpperCase() + ' 文件</td>','<td>' + ((it.name.length*137)%900+80) + ' KB</td>'].forEach((c) => { const td = document.createElement('td'); td.innerHTML = c; td.style.cssText = 'padding:2px 8px;border-bottom:1px solid rgba(0,0,0,.08);opacity:' + (locked(it)?'.5':'1'); tr.appendChild(td); });
        t.appendChild(tr); });
      mainHost.appendChild(t);
    } else {
      const grid = document.createElement('div');
      grid.style.cssText = view === '平铺' ? 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:8px'
        : view === '图标' ? 'display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;padding:10px'
        : 'display:flex;flex-direction:column';
      items.forEach((it) => {
        const cell = document.createElement('div'); const lk = locked(it);
        cell.style.cssText = 'display:flex;align-items:center;gap:8px;padding:' + (view==='列表'?'2px 8px':'8px') + ';cursor:pointer;border-radius:var(--os-radius);' + (sel.has(it.id) ? 'background:var(--os-sel);color:#fff' : '');
        cell.innerHTML = '<span style="font-size:' + (view === '图标' || view === '平铺' ? '30px' : '16px') + '">' + (lk ? '🔒' : ICON[extOf(it.name)]) + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:' + (lk ? '.6' : '1') + '">' + escapeHtml(it.name) + '</span>';
        cell.onclick = (e) => { if (!e.ctrlKey && !e.metaKey) sel.clear(); sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); renderList(); };
        cell.ondblclick = () => open(it);
        cell.oncontextmenu = (e) => { e.preventDefault(); menu(e, it); };
        grid.appendChild(cell);
      });
      mainHost.appendChild(grid);
    }
    status.textContent = cur.items.length + ' 个项目' + (sel.size ? ' ｜ 已选 ' + sel.size : '') + (cur.items.some(locked) ? ' ｜ 🔒=需先解锁' : '');
  }

  let tmr;
  function toast(t) { status.textContent = t; clearTimeout(tmr); tmr = setTimeout(renderList, 3000); }
  function menu(e, it) {
    document.querySelectorAll('.os-menu').forEach((m) => m.remove());
    const m = document.createElement('div'); m.className = 'os-menu'; m.style.cssText = 'position:fixed;z-index:99998;min-width:160px;background:var(--os-face);border:var(--os-border);box-shadow:var(--os-shadow);padding:3px;font-size:12.5px';
    const item = (lab, fn, dis) => { const b = document.createElement('div'); b.textContent = lab; b.style.cssText = 'padding:5px 10px;cursor:' + (dis ? 'not-allowed' : 'pointer') + ';color:' + (dis ? '#999' : 'var(--os-fg)'); if (!dis) b.onmouseenter = () => b.style.background = 'var(--os-accent)', b.onmouseleave = () => b.style.background = '', b.onclick = () => { m.remove(); fn(); }; b.onmouseenter = () => { if (!dis) b.style.background = 'var(--os-accent)'; }; b.onmouseleave = () => (b.style.background = ''); return b; };
    m.appendChild(item('打开', () => open(it)));
    m.appendChild(item('重命名（只读档案）', () => toast('调查资料不可重命名。'), true));
    m.appendChild(item('属性', () => toast(it.id + ' · ' + extOf(it.name) + (it.lockedBy ? ' · 需 ' + it.lockedBy : ''))));
    m.style.left = Math.min(e.clientX, innerWidth - 180) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - 120) + 'px';
    document.body.appendChild(m);
    setTimeout(() => document.addEventListener('click', function h() { m.remove(); document.removeEventListener('click', h); }), 0);
  }

  renderTree(); renderList();
}
