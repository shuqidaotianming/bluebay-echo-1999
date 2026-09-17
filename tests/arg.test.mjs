import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exists, readJSON } from '../scripts/lib/util.mjs';
import { pageConfig, loadBlueprint } from '../scripts/lib/blueprint.mjs';
import { LIVEWAVE_CLUES } from '../scripts/content/guard.mjs';

test('时间锁：夜航值守=游戏钟 03:14 窗口；周年=到日期；守夜=持续 1 分钟', () => {
  assert.equal(pageConfig('node_nightwatch').timeLock.mode, 'gameclock');
  assert.equal(pageConfig('node_anniv').timeLock.mode, 'afterDate');
  assert.equal(pageConfig('node_sitwith').timeLock.mode, 'holdMinutes');
});
test('双标签页：发信/手机端互为对端，共享 clue_twotabs', () => {
  const r = pageConfig('node_dial_radio').dualTab, p = pageConfig('node_dial_phone').dualTab;
  assert.equal(r.role, 'radio'); assert.deepEqual(p.partners, ['radio']); assert.equal(r.clue, p.clue);
});
test('源码/DevTools：hidden_recs 答案只在源码注释、经 verify 发放', () => {
  const html = readJSON ? pageConfig('node_hidden_recs') : null;
  assert.equal(html.verify.answers.deadairo, 'clue_hidden_recs');
  assert.ok(pageConfig('node_hidden_recs').verify.clue === 'clue_hidden_recs');
});
test('robots.txt 已生成并指向隐藏页', () => {
  assert.ok(exists('robots.txt'));
});
test('聊天含「现场直播」结局，需 3 条 ARG 线索', () => {
  const chat = pageConfig('node_chat');
  const my = (chat.contacts || []).find((c) => /明月/.test(c.name));
  const ch = (my.choices || []).find((x) => x.target === 'end_livewave');
  assert.ok(ch); assert.equal(ch.requires, LIVEWAVE_CLUES.join(','));
});
