import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex } from '../scripts/build-search-index.mjs';
import { readJSON } from '../scripts/lib/util.mjs';

const { count, missing } = buildSearchIndex({ write: false });
const inc = readJSON('scripts/content/search-include.json');

test('搜索索引可复现（327 条 / 无缺失节点）', () => {
  assert.equal(missing.length, 0, '白名单缺失节点: ' + missing.join(','));
  assert.equal(count, inc.ids.length);
  assert.ok(count >= 300);
});

test('白名单不含结局页/锁后核心线索，防剧透与绕锁', () => {
  const ids = new Set(inc.ids);
  assert.ok(![...ids].some((x) => /^end_/.test(x)), '索引不应含结局页');
  assert.ok(!ids.has('doc_experiment'), '锁后核心线索不应进索引');
  assert.ok(!ids.has('doc_raw_data'), '灯塔顶层线索不应进索引');
});
