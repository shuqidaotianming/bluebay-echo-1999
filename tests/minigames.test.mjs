import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBlueprint, reachability, pageConfig } from '../scripts/lib/blueprint.mjs';
import { GOLD_CLUES } from '../scripts/content/guard.mjs';

const bp = loadBlueprint();
const ids = new Set(bp.nodes.map((n) => n.id));
const pages = ['mg_workbench', 'mg_spectral', 'mg_gate', 'mg_align', 'mg_dial', 'mg_splice', 'mg_eq', 'end_goldear'];
const cut = reachability(bp, { cutLocks: true });

test('工作台集群节点已入蓝图且挂在保险箱锁后', () => {
  for (const p of pages) assert.ok(ids.has(p), '缺节点 ' + p);
  const hub = pageConfig('mg_workbench');
  assert.equal(hub.requiresClue, 'lock:node_login_safe'); // apply-locks 规范化为“破解”门控
});
test('6 个小游戏页各接一种游戏类型', () => {
  const types = ['mg_spectral', 'mg_gate', 'mg_align', 'mg_dial', 'mg_splice', 'mg_eq'].map((p) => pageConfig(p).minigame.type);
  assert.deepEqual(types.sort(), ['eq-band', 'noise-gate', 'spectral-repair', 'splice-order', 'tape-align', 'tuning-dial']);
});
test('金耳朵结局在聊天里、需 6 段修复线索；断锁后工作台页不可达', () => {
  const chat = pageConfig('node_chat');
  const my = (chat.contacts || []).find((c) => /明月/.test(c.name));
  const ch = (my.choices || []).find((x) => x.target === 'end_goldear');
  assert.ok(ch, '聊天缺金耳朵选项');
  assert.equal(ch.requires, GOLD_CLUES.join(','));
  for (const p of ['mg_workbench', 'mg_spectral', 'mg_eq']) assert.ok(!cut.has(p), '旁路: ' + p);
});
