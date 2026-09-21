// scripts/stamp-version.mjs — 依据 arg-runtime.js / arg-data.js 内容哈希，重写页面引用 ?v=，强制拉新
// 同时把历史遗留 `arg-runtime.js?v=xxxx""` 的多余引号规范化。
import { read, write, exists, abs } from './lib/util.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

function hashOf(file) { return exists(file) ? crypto.createHash('sha1').update(read(file)).digest('hex').slice(0, 8) : null; }

export function stamp({ dry = false } = {}) {
  const versions = { runtime: hashOf('arg-runtime.js'), data: hashOf('arg-data.js') };
  let touched = 0;
  const files = fs.readdirSync(abs('.')).filter((f) => f.endsWith('.html'));
  for (const f of files) {
    const html = read(f);
    let next = html;
    if (versions.runtime) next = next.replace(/<script\s+src="arg-runtime\.js(?:\?v=[^"]*)?"?\s*"><\/script>/g, `<script src="arg-runtime.js?v=${versions.runtime}"></script>`);
    if (versions.data) next = next.replace(/<script\s+src="arg-data\.js(?:\?v=[^"]*)?"?\s*"><\/script>/g, `<script src="arg-data.js?v=${versions.data}"></script>`);
    if (next !== html) { if (!dry) write(f, next); touched++; }
  }
  return { ...versions, touched };
}

if (process.argv[1] && process.argv[1].endsWith('stamp-version.mjs')) {
  const r = stamp();
  console.log(`[stamp] runtime ?v=${r.runtime} · data ?v=${r.data} · 更新 ${r.touched} 页`);
}
