// scripts/lib/util.mjs — 零依赖 IO / 路径 / 文本工具
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function abs(...p) { return path.join(ROOT, ...p); }
export function read(...p) { return fs.readFileSync(abs(...p), 'utf8'); }
export function readJSON(...p) { return JSON.parse(read(...p)); }
export function write(p, data) {
  const full = abs(p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
  return full;
}
export function writeJSON(p, obj) { return write(p, JSON.stringify(obj, null, 2) + '\n'); }
export function exists(...p) { return fs.existsSync(abs(...p)); }

// 从一页 HTML 里解析内嵌的 arg-config JSON
export function parsePageConfig(html) {
  const m = String(html).match(/<script\s+type="application\/json"\s+id="arg-config">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return { __parseError: e.message }; }
}
export function htmlUnescape(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// 原地改某页内嵌 arg-config（mutator 返回要合并进 config 的补丁对象）；保持 JSON 合法
export function patchPageConfig(nodeId, patch) {
  const file = nodeId === 'node_prologue' ? 'index.html' : nodeId + '.html';
  const html = read(file);
  const re = /(<script\s+type="application\/json"\s+id="arg-config">)([\s\S]*?)(<\/script>)/;
  const m = html.match(re);
  if (!m) throw new Error('no arg-config in ' + file);
  const cfg = JSON.parse(m[2]);
  Object.assign(cfg, patch);
  const out = m[1] + JSON.stringify(cfg) + m[3];
  write(file, html.replace(re, out));
  return cfg;
}

// 合并写入断锁门槛登记表（按 clueId 去重），供各内容生成器复用
export function mergeGuarded(entries) {
  const f = 'scripts/content/extra-guarded.json';
  let doc = { note: '各内容生成器维护；validate.mjs 强制断锁后不可达。', guarded: [] };
  if (exists(f)) doc = readJSON(f);
  const byId = new Map(doc.guarded.map((g) => [g.clueId, g]));
  for (const g of entries) byId.set(g.clueId, g);
  doc.guarded = [...byId.values()];
  writeJSON(f, doc);
  return doc;
}
export { fs, path };
