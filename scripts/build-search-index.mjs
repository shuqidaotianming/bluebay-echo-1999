// scripts/build-search-index.mjs — 从「可检索白名单」+ 页面正文重建 arg-search-index.js
// 口径：白名单是权威（防止锁定/剧透内容泄入）；标题取蓝图节点名，摘要取页面 body 文本首段。
import { read, write, readJSON, abs, exists } from './lib/util.mjs';
import { loadBlueprint, pageConfig } from './lib/blueprint.mjs';

function bodyTextOf(nodeId) {
  const file = abs(nodeId + '.html');
  if (!exists(nodeId + '.html')) return '';
  const html = read(nodeId + '.html');
  let m = html.match(/<[^>]*data-arg-slot="body"[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) m = html.match(/<[^>]*class="[^"]*(?:cyber-body|scp-body|diary-content|news-content|mag-body|bbs-post-body)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
  if (!m) return '';
  return m[1]
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchIndex({ write: emit = true } = {}) {
  const bp = loadBlueprint();
  const { ids } = readJSON('scripts/content/search-include.json');
  const nameMap = {};
  for (const n of bp.nodes) nameMap[n.id] = n.name;
  const entries = [];
  const missing = [];
  for (const id of ids) {
    if (!nameMap[id]) { missing.push(id); continue; }
    const file = id === 'node_prologue' ? 'index.html' : id + '.html';
    const body = bodyTextOf(id);
    entries.push({
      id,
      t: nameMap[id],
      u: file,
      s: body.slice(0, 140),
    });
  }
  const out = 'window.ARG_SEARCH_INDEX=' + JSON.stringify(entries) + ';\n';
  if (emit) write('arg-search-index.js', out);
  return { count: entries.length, missing, bytes: out.length };
}

if (process.argv[1] && process.argv[1].endsWith('build-search-index.mjs')) {
  const r = buildSearchIndex();
  console.log(`[build:index] 生成 ${r.count} 条检索条目 → arg-search-index.js (${r.bytes} bytes)${r.missing.length ? ' | 白名单缺失节点: ' + r.missing.join(', ') : ''}`);
  if (r.missing.length) process.exit(1);
}
