import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runValidation } from '../scripts/validate.mjs';
import { loadBlueprint, reachability } from '../scripts/lib/blueprint.mjs';
import { CORE_CLUES, PROTECTED_ENDINGS } from '../scripts/content/guard.mjs';

const r = runValidation();
const bp = loadBlueprint();
const cut = reachability(bp, { cutLocks: true });
const full = reachability(bp, {});

test('整体校验通过（0 错误）', () => {
  assert.equal(r.errors.length, 0, '错误: ' + r.errors.join(' | '));
  assert.ok(r.ok);
});

test('正常全图可达 417 页', () => {
  assert.equal(full.size, bp.nodes.length);
});

test('断锁后 9 条核心线索全部不可达（防旁路硬门槛）', () => {
  for (const id of CORE_CLUES) assert.ok(!cut.has(id), '旁路: ' + id + ' 断锁仍可达');
});

test('断锁后受保护结局的锁门控缺口成立', () => {
  const lockClueSet = new Set(CORE_CLUES);
  for (const [endId, meta] of Object.entries(PROTECTED_ENDINGS)) {
    if (meta.gate !== 'lock') continue;
    const need = [...CORE_CLUES, ...(meta.extra || [])];
    const gap = need.some((c) => lockClueSet.has(c) && !cut.has(c));
    assert.ok(gap, '结局 ' + endId + ' 无锁门控缺口');
  }
});
