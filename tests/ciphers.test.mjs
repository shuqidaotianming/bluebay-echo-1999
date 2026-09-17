import { test } from 'node:test';
import assert from 'node:assert/strict';
import C from '../scripts/lib/ciphers.mjs';

test('caesar: WLGH 退三格 = tide（谜题①）', () => {
  assert.equal(C.caesar('tide', 3), 'WLGH');
  assert.equal(C.caesarDecode('WLGH', 3), 'TIDE');
});

test('hex: stillhere（谜题⑥ 隐写）', () => {
  assert.equal(C.hexEncode('stillhere'), '7374696c6c68657265');
  assert.equal(C.hexDecode('7374696c6c68657265'), 'stillhere');
});

test('vigenere 经典向量 ATTACK/LEMON', () => {
  assert.equal(C.vigenereEncode('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(C.vigenereDecode('LXFOPVEFRNHR', 'LEMON'), 'ATTACKATDAWN');
});

test('vigenere: NVGIKBRA 以 tide 解 = undertow（谜题⑧）', () => {
  assert.equal(C.vigenereEncode('UNDERTOW', 'tide'), 'NVGIKBRA');
  assert.equal(C.vigenereDecode('NVGIKBRA', 'tide'), 'UNDERTOW');
});

test('autokey 往返', () => {
  const c = C.autokeyEncode('BLACKFIN', 'tide');
  assert.equal(C.autokeyDecode(c, 'tide'), 'BLACKFIN');
});

test('playfair 往返 + 去 J', () => {
  const c = C.playfairEncode('HIDETHEGOLD', 'monarchy');
  const p = C.playfairDecode(c, 'monarchy');
  assert.ok(p.startsWith('HIDETHEGOLD'), p);
});

test('polybius 往返', () => {
  const c = C.polybiusEncode('TIDEPOOL', 'tide');
  assert.equal(C.polybiusDecode(c, 'tide'), 'TIDEPOOL');
});

test('base64 往返（chaosheng9）', () => {
  assert.equal(C.b64Encode('chaosheng9'), 'Y2hhb3NoZW5nOQ==');
  assert.equal(C.b64Decode('Y2hhb3NoZW5nOQ=='), 'chaosheng9');
});

test('base32 往返', () => {
  assert.equal(C.b32Decode(C.b32Encode('lasttide')), 'lasttide');
});

test('binary 往返', () => {
  const b = C.binaryEncode('lasttide');
  assert.equal(C.binaryDecode(b), 'lasttide');
});

test('morse: SOS', () => {
  assert.equal(C.morseEncode('SOS'), '... --- ...');
  assert.equal(C.morseDecode('.-.. .-- .---- ----. ----. ----.'), 'LW1999');
});

test('atbash / reverse', () => {
  assert.equal(C.atbash('ABC'), 'ZYX');
  assert.equal(C.reverseStr('abcde'), 'edcba');
});

test('xor 双残带：两份异或还原明文', () => {
  const plain = 'HARBORLIGHT';
  const mask = 'XXXXXYYYYYY'; // 同长度任意串
  const tape = C.xorMask(plain, mask);
  assert.equal(C.xorStrings(tape, mask), plain);
});

test('luhn 校验与校验位', () => {
  assert.equal(C.luhnValid('79927398713'), true);
  assert.equal(C.luhnValid('79927398710'), false);
  assert.equal(C.luhnCheckDigit('7992739871'), '3');
});

test('freqTable 排序', () => {
  const f = C.freqTable('AAAB');
  assert.equal(f[0][0], 'A');
  assert.equal(f[0][1], 3);
});
