// scripts/stamp-version.mjs — 依据 arg-runtime.js 内容哈希，重写全部页面的 <script src="arg-runtime.js?v=...">，强制拉新
// 同时修历史遗留的 `arg-runtime.js?v=xxxx""` 多余引号。
import { read, write } from './lib/util.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { abs } from './lib/util.mjs';

export function stamp({ dry = false } = {}) {
  const code = read('arg-runtime.js');
  const v = crypto.createHash('sha1').update(code).digest('hex').slice(0, 8);
  let touched = 0;
  const files = fs.readdirSync(abs('.')).filter((f) => f.endsWith('.html'));
  for (const f of files) {
    const html = read(f);
    // 匹配任意 src 指向 arg-runtime.js 的 script（带或不带旧 ?v=），规范成一个正确属性
    const re = /<script\s+src="arg-runtime\.js(?:\?v=[^"]*)?"?\s*"><\/script>/g;
    const fixed = html.replace(re, `<script src="arg-runtime.js?v=${v}"></script>`);
    if (fixed !== html) { if (!dry) write(f, fixed); touched++; }
  }
  return { version: v, touched };
}

if (process.argv[1] && process.argv[1].endsWith('stamp-version.mjs')) {
  const r = stamp();
  console.log(`[stamp] 运行时版本 ?v=${r.version}，更新 ${r.touched} 个页面`);
}
