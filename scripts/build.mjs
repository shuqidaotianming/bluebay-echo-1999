// scripts/build.mjs — 一键构建：运行时打包 → 共享数据 → 页面瘦身 → 缓存指纹 → 搜索索引 → 防旁路校验
import { bundle } from './build-runtime.mjs';
import { buildData } from './build-data.mjs';
import { slimPages } from './slim-pages.mjs';
import { stamp } from './stamp-version.mjs';
import { buildSearchIndex } from './build-search-index.mjs';
import { runValidation } from './validate.mjs';

console.log('[build] 1/6 运行时打包');
const r = bundle();
console.log('  ' + (r.skipped ? r.note : `打包 ${r.modules} 个模块 (${r.bytes} bytes)`));

console.log('[build] 2/6 共享数据 arg-data.js');
const d = buildData();
console.log(`  ${d.pages} 项映射 (${d.bytes} bytes)`);

console.log('[build] 3/6 页面瘦身（移除页内 files/names）');
const sl = slimPages();
console.log(`  删表 ${sl.stripped} · 注入 arg-data.js ${sl.injected} / 共 ${sl.pages} 页`);

console.log('[build] 4/6 缓存指纹');
const st = stamp();
console.log(`  runtime ?v=${st.runtime} · data ?v=${st.data} · 更新 ${st.touched} 页`);

console.log('[build] 5/6 搜索索引');
const s = buildSearchIndex();
console.log(`  生成 ${s.count} 条${s.missing.length ? ' | 缺失: ' + s.missing.join(', ') : ''}`);

console.log('[build] 6/6 防旁路 + 完整性校验');
const v = runValidation();
for (const w of v.warnings) console.log('  ⚠ ' + w);
for (const e of v.errors) console.log('  ✖ ' + e);
console.log(v.ok ? '\n[build] ✔ 构建完成，硬门槛通过。' : `\n[build] ✘ 构建失败：${v.errors.length} 个错误。`);
process.exit(v.ok ? 0 : 1);
