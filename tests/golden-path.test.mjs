import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../scripts/golden-path.mjs';

const r = analyze();
test('全部 13 个结局在各自门槛下可达', () => {
  assert.equal(r.endings, 13);
  const unreachable = r.rows.filter((x) => !x.reachableFull);
  assert.equal(unreachable.length, 0, '不可达结局: ' + unreachable.map((x) => x.id).join(','));
});
test('高阶/硬核结局均由“须解题”门槛把关（断锁不可随手集齐）', () => {
  const mustSolve = ['end_true', 'end_secret', 'end_signal', 'end_wall', 'end_reef'];
  for (const id of mustSolve) {
    const row = r.rows.find((x) => x.id === id);
    assert.ok(row && row.gatedBySolve, id + ' 未受解题门槛保护');
  }
});
test('真结局需 9 条核心线索（跨三道锁）', () => {
  const t = r.rows.find((x) => x.id === 'end_true');
  assert.equal(t.need, 9);
});
