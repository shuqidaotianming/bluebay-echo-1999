// scripts/slim-pages.mjs — 从各页 arg-config 移除整站 files/names（改由 arg-data.js 提供），并注入 arg-data.js 引用
// 幂等：已瘦身页跳过删表；缺 arg-data.js 标签则补在 arg-runtime.js 之前。
import fs from 'node:fs';
import { read, write, abs } from './lib/util.mjs';

export function slimPages({ dry = false } = {}) {
  const files = fs.readdirSync(abs('.')).filter((f) => f.endsWith('.html'));
  let stripped = 0, injected = 0;
  for (const f of files) {
    let html = read(f);
    const re = /(<script\s+type="application\/json"\s+id="arg-config">)([\s\S]*?)(<\/script>)/;
    const m = html.match(re);
    if (m) {
      let cfg;
      try { cfg = JSON.parse(m[2]); } catch (e) { cfg = null; }
      if (cfg && (cfg.files || cfg.names)) {
        delete cfg.files; delete cfg.names;
        html = html.replace(re, m[1] + JSON.stringify(cfg) + m[3]);
        stripped++;
      }
    }
    // 注入 arg-data.js + arg-vfs.js（在 arg-runtime.js 之前）
    if (!/src="arg-data\.js/.test(html)) {
      const inj = html.replace(/(<script src="arg-runtime\.js)/, '<script src="arg-data.js"></script>\n<script src="arg-vfs.js"></script>\n$1');
      if (inj !== html) { html = inj; injected++; }
    } else if (!/src="arg-vfs\.js/.test(html)) {
      const inj = html.replace(/(<script src="arg-runtime\.js)/, '<script src="arg-vfs.js"></script>\n$1');
      if (inj !== html) { html = inj; injected++; }
    }
    if (!dry) write(f, html);
  }
  return { pages: files.length, stripped, injected };
}

if (process.argv[1] && process.argv[1].endsWith('slim-pages.mjs')) {
  const r = slimPages();
  console.log(`[slim] ${r.pages} 页：删表 ${r.stripped} · 注入 arg-data.js ${r.injected}`);
}
