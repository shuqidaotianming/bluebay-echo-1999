import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import C from '../scripts/lib/ciphers.mjs';
import { buildSpectrogramWav, columnsOf } from '../scripts/gen-stego-audio.mjs';
import { loadBlueprint, reachability, pageConfig } from '../scripts/lib/blueprint.mjs';
import { REEF_CLUES, CORE_CLUES } from '../scripts/content/guard.mjs';

const bp = loadBlueprint();
const cut = reachability(bp, { cutLocks: true });

test('可解·Playfair：EATSZIIAXD 用 tide 解出 DEEPWATER（新锁口令）', () => {
  assert.ok(C.playfairDecode('EATSZIIAXD', 'tide').startsWith('DEEPWATER'));
});
test('可解·Polybius：坐标解出 REEFBELL', () => {
  assert.equal(C.polybiusDecode(C.polybiusEncode('REEFBELL', 'tide'), 'tide'), 'REEFBELL');
});
test('可解·XOR：两遍残带异或回 HARBOR', () => {
  const mask = 'ZZZZZZ', plain = 'HARBOR';
  const tape = C.xorMask(plain, mask);
  assert.equal(C.xorStrings(mask, tape), plain);
});
test('可解·Luhn：0722 的校验位补全后合法', () => {
  const d = C.luhnCheckDigit('0722');
  assert.equal(C.luhnValid('0722' + d), true);
});
test('可解·单表频率：存在替换逆表可还原明文', () => {
  const SUBKEY = 'QWERTYUIOPASDFGHJKLZXCVBNM';
  const plain = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const inv = {}; for (let i = 0; i < 26; i++) inv[SUBKEY[i]] = plain[i];
  // 从页面取密文
  const cfg = fs.readFileSync('hr_freq.html', 'utf8');
  const ct = (cfg.match(/<br>([A-Z ]{40,})<br>/) || ['', ''])[1].replace(/\s/g, '');
  assert.ok(ct.length > 30, '未从页面取到密文');
  assert.equal([...ct].map((c) => inv[c]).join(''), 'THELIGHTHOUSESINGSFORTHESIXTYSIXWHONEVERCAMEBACK');
});
test('可解·频谱隐写：生成合法 RIFF WAV 且词可点阵化', () => {
  const wav = buildSpectrogramWav('BLACKTIDE');
  assert.equal(wav.slice(0, 4).toString(), 'RIFF');
  assert.ok(wav.length > 1000);
  assert.ok(columnsOf('BLACKTIDE').length > 20);
});

test('防旁路·断锁后 6 份硬核卷宗全部不可达', () => {
  for (const id of REEF_CLUES) assert.ok(!cut.has(id), '旁路: ' + id + ' 断锁仍可达');
});
test('防旁路·新集群锁与深潮结局页存在且入口可发现', () => {
  const ids = new Set(bp.nodes.map((n) => n.id));
  for (const n of ['hr_playfair', 'node_login_reef', 'node_files_reef', 'end_reef']) assert.ok(ids.has(n), '缺节点 ' + n);
  assert.ok(bp.edges.some((e) => e.from === 'node_timeline' && e.to === 'hr_playfair'), '入口未从调查板接入');
});
test('hr_stego 已接答案校验（solve-credit clue_stegoaudio）', () => {
  const cfg = pageConfig('hr_stego');
  assert.equal(cfg.verify && cfg.verify.clue, 'clue_stegoaudio');
});
