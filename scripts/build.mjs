// scripts/build.mjs — 一键构建：运行时打包 → 搜索索引 → 校验（任一硬门槛不过即非零退出）
import { bundle } from './build-runtime.mjs';
import { stamp } from './stamp-version.mjs';
import { buildSearchIndex } from './build-search-index.mjs';
import { runValidation } from './validate.mjs';

console.log('[build] 1/4 运行时打包');
const r = bundle();
console.log('  ' + (r.skipped ? r.note : `打包 ${r.modules} 个模块 (${r.bytes} bytes)`));

console.log('[build] 2/4 缓存指纹');
const st = stamp();
console.log(`  ?v=${st.version} · 更新 ${st.touched} 个页面`);

console.log('[build] 3/4 搜索索引');
const s = buildSearchIndex();
console.log(`  生成 ${s.count} 条${s.missing.length ? ' | 缺失: ' + s.missing.join(', ') : ''}`);

console.log('[build] 4/4 防旁路 + 完整性校验');
const v = runValidation();
for (const w of v.warnings) console.log('  ⚠ ' + w);
for (const e of v.errors) console.log('  ✖ ' + e);
console.log(v.ok ? '\n[build] ✔ 构建完成，硬门槛通过。' : `\n[build] ✘ 构建失败：${v.errors.length} 个错误。`);
process.exit(v.ok ? 0 : 1);
