// scripts/build-runtime.mjs — 零依赖极简 ESM 打包器
// 把 src/runtime/*.mjs 按 manifest 顺序「扁平拼接 + 剥离 import/export」为单个经典脚本 arg-runtime.js。
// 约定：跨模块顶层符号唯一；所有模块最终共处同一 IIFE 作用域（core 最先声明 config 等）。
import { read, write, exists, readJSON } from './lib/util.mjs';
import path from 'node:path';

export function bundle({ out = 'arg-runtime.js' } = {}) {
  const manifestPath = 'src/runtime/manifest.json';
  if (!exists(manifestPath)) {
    return { skipped: true, note: 'src/runtime/manifest.json 未就绪，保留现有 arg-runtime.js' };
  }
  const { order } = readJSON(manifestPath);
  const seen = new Set();
  const chunks = [];

  const norm = (p) => path.posix.normalize(p).replace(/^(\.\/)+/, '');
  const stripExt = (p) => p.replace(/\.m?js$/, '');

  function load(rel) {
    const key = norm(rel);
    if (seen.has(key)) return;
    seen.add(key);
    let src = read('src/runtime', key);

    // 先递归纳入本地依赖，保证声明顺序（支持具名/默认 import 与裸副作用 import，容忍行尾注释）
    const importRe = /^[ \t]*import\s+(?:[^;'"]*?[ \t]from[ \t])?['"](\.[^'"]+)['"];?[ \t]*(?:\/\/[^\n]*)?$/gm;
    let m;
    while ((m = importRe.exec(src))) {
      const dep = norm(path.posix.join(path.posix.dirname(key), m[1]));
      load(dep.endsWith('.mjs') || dep.endsWith('.js') ? dep : dep + '.mjs');
    }
    // 剥离 import 行；把 export 降级为普通声明；去掉 export {} / export default
    src = src
      .replace(/^[ \t]*import\s+(?:[^;'"]*?[ \t]from[ \t])?['"]\.[^'"]+['"];?[ \t]*(?:\/\/[^\n]*)?$/gm, '')
      .replace(/^[ \t]*export\s+(async\s+)?(function|class|const|let|var)[ ]/gm, '$1$2 ')
      .replace(/^[ \t]*export\s*\{[^}]*\};?[ \t]*$/gm, '')
      .replace(/^[ \t]*export\s+default\s+/gm, '');
    chunks.push({ key, src });
  }
  for (const f of order) load(f);

  const body = chunks.map((c) => `/* ---- ${c.key} ---- */\n${c.src}`).join('\n\n');
  const banner = '/* 白噪1999 运行时（构建产物）。由 src/runtime/*.mjs 打包生成；请勿直接编辑本文件，改 src/runtime 后运行 node scripts/build.mjs。 */\n';
  const final = `${banner}(function(){\n"use strict";\ntry{\n${body}\n}catch(err){\n  try{var p=document.createElement("div");p.style.cssText="position:fixed;left:0;bottom:0;background:#7f1d1d;color:#fff;font:12px/1.4 monospace;padding:4px 8px;z-index:2147483647";p.textContent="运行时错误(调试)："+err.message;document.body&&document.body.appendChild(p);}catch(e2){}\n  if(window.console)console.error("[ARG runtime]",err);\n}\n})();\n`;
  write(out, final);
  return { skipped: false, bytes: final.length, modules: seen.size, names: [...seen] };
}

if (process.argv[1] && process.argv[1].endsWith('build-runtime.mjs')) {
  const r = bundle();
  console.log(r.skipped ? `[build:runtime] ${r.note}` : `[build:runtime] 打包 ${r.modules} 个模块 → arg-runtime.js (${r.bytes} bytes)`);
}
