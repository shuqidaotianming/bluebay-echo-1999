// scripts/build-data.mjs — 从蓝图生成共享数据文件 arg-data.js（全站 files/names 的单一来源）
import { loadBlueprint } from './lib/blueprint.mjs';
import { write } from './lib/util.mjs';

export function buildData() {
  const bp = loadBlueprint();
  const files = {}, names = {};
  for (const n of bp.nodes) {
    files[n.id] = n.id === 'node_prologue' ? 'index.html' : n.id + '.html';
    names[n.id] = n.name;
  }
  const out = 'window.ARG_DATA=' + JSON.stringify({ files, names }) + ';\n';
  write('arg-data.js', out);
  return { pages: Object.keys(files).length, bytes: out.length };
}

if (process.argv[1] && process.argv[1].endsWith('build-data.mjs')) {
  const r = buildData();
  console.log(`[build:data] arg-data.js 生成（${r.pages} 项，${r.bytes} bytes）`);
}
