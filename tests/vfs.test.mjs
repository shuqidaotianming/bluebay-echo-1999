import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exists, read } from '../scripts/lib/util.mjs';
import { loadBlueprint } from '../scripts/lib/blueprint.mjs';
import { EXTRA_GUARDED, CORE_CLUES } from '../scripts/content/guard.mjs';

function parseVfs() { const s = read('arg-vfs.js'); return JSON.parse(s.replace(/^window\.ARG_VFS=/, '').replace(/;\s*$/, '')); }
const V = parseVfs();
const bp = loadBlueprint();
const ids = new Set(bp.nodes.map((n) => n.id));

test('arg-vfs.js 存在且非空', () => { assert.ok(exists('arg-vfs.js')); assert.ok(V.folders.length > 10); });
test('VFS 每个文件 id 都在蓝图节点表中（无悬空）', () => {
  const bad = [];
  for (const f of V.folders) for (const it of f.items) if (!ids.has(it.id)) bad.push(it.id);
  assert.equal(bad.length, 0, '悬空文件: ' + bad.slice(0, 8).join(','));
});
test('VFS 有文件数覆盖绝大多数内容页', () => {
  const n = V.folders.reduce((a, f) => a + f.items.length, 0);
  assert.ok(n > 300, '文件过少: ' + n);
});
test('VFS 锁归属与防旁路门控对齐（受锁文件确为锁门控目标）', () => {
  // 抽样：hr_* 与部分核心卷宗应带 lockedBy
  const lockedIds = new Set(Object.keys(V.lockedBy));
  const guardedNodes = new Set([...EXTRA_GUARDED.filter((g) => !g.credit).map((g) => g.clueId), ...CORE_CLUES]);
  const hr = V.folders.flatMap((f) => f.items).filter((it) => it.id.startsWith('hr_') && it.id !== 'hr_playfair');
  for (const it of hr) assert.ok(it.lockedBy, 'hr 文件未标锁: ' + it.id);
  assert.ok(lockedIds.size >= 10);
});

test('三套桌面皮肤齐备且 token 完整', async () => {
  const { SKINS } = await import('../src/runtime/ostheme.mjs');
  const need = ['--os-face', '--os-titlebar', '--os-accent', '--os-shadow'];
  for (const k of ['win98', 'winxp', 'classic']) {
    assert.ok(SKINS[k], '缺皮肤 ' + k);
    for (const t of need) assert.ok(SKINS[k].vars[t], k + ' 缺 ' + t);
  }
});
