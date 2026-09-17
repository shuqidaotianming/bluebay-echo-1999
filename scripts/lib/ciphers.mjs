// scripts/lib/ciphers.mjs
// 白噪1999 谜题算法库（纯函数、零依赖、无 DOM）。
// 既是「谜题作者」生成密文的工具，也是运行时校验答案 / 测试证明可解性的单一事实来源。
// 约定：除非特别说明，明文/密文均按大写字母 A–Z 处理，非字母字符默认丢弃（可 keepNonLetters）。

const A = 65; // 'A'.charCodeAt(0)

export const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 25 字母，去 J（Playfair/Polybius 用，I/J 合并）

// ---------- 基础工具 ----------
export function letters(s) {
  return String(s).toUpperCase().replace(/[^A-Z]/g, '');
}
export function toBytes(s) {
  return Array.from(String(s)).map((c) => c.charCodeAt(0) & 0xff);
}
export function fromBytes(bytes) {
  return bytes.map((b) => String.fromCharCode(b & 0xff)).join('');
}

// ---------- 凯撒 ----------
export function caesar(text, shift, { keepNonLetters = false } = {}) {
  let out = '';
  for (const ch of String(text)) {
    const u = ch.toUpperCase();
    if (u >= 'A' && u <= 'Z') {
      out += String.fromCharCode(((u.charCodeAt(0) - A + shift) % 26 + 26) % 26 + A);
    } else if (keepNonLetters) out += ch;
  }
  return out;
}
export const caesarDecode = (t, s) => caesar(t, -s);

// ---------- Atbash / 倒读 ----------
export function atbash(text, { keepNonLetters = false } = {}) {
  let out = '';
  for (const ch of String(text)) {
    const u = ch.toUpperCase();
    if (u >= 'A' && u <= 'Z') out += String.fromCharCode(A + 25 - (u.charCodeAt(0) - A));
    else if (keepNonLetters) out += ch;
  }
  return out;
}
export const reverseStr = (s) => Array.from(String(s)).reverse().join('');

// ---------- 十六进制 ----------
export function hexEncode(str) {
  return toBytes(str).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function hexDecode(hex) {
  const h = String(hex).replace(/[^0-9a-fA-F]/g, '');
  const bytes = [];
  for (let i = 0; i + 2 <= h.length; i += 2) bytes.push(parseInt(h.substr(i, 2), 16));
  return fromBytes(bytes);
}

// ---------- 二进制（每字符 8 位） ----------
export function binaryEncode(str) {
  return toBytes(str).map((b) => b.toString(2).padStart(8, '0')).join(' ');
}
export function binaryDecode(bin) {
  const bits = String(bin).replace(/[^01]/g, '');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
  return fromBytes(bytes);
}

// ---------- Base64 ----------
export function b64Encode(str) {
  return Buffer.from(String(str), 'utf-8').toString('base64');
}
export function b64Decode(b64) {
  return Buffer.from(String(b64).replace(/[^A-Za-z0-9+/=]/g, ''), 'base64').toString('utf-8');
}

// ---------- Base32 (RFC4648) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32Encode(str) {
  const bytes = Buffer.from(String(str), 'utf-8');
  let bits = 0, val = 0, out = '';
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}
export function b32Decode(s) {
  const str = String(s).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0, out = [];
  for (const c of str) {
    val = (val << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((val >> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out).toString('utf-8');
}

// ---------- 摩尔斯 ----------
export const MORSE_MAP = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '---..', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));
export function morseEncode(text) {
  return String(text).toUpperCase().split('').filter((c) => c !== ' ').map((c) => MORSE_MAP[c] || '').join(' ');
}
export function morseDecode(morse) {
  return String(morse).trim().split(/\s+/).map((t) => MORSE_REV[t] || '').join('');
}

// ---------- 维吉尼亚（Vigenère） ----------
export function vigenereEncode(plain, key, { keepNonLetters = false } = {}) {
  const k = letters(key); if (!k) throw new Error('vigenere: empty key');
  let ki = 0, out = '';
  for (const ch of String(plain)) {
    const u = ch.toUpperCase();
    if (u >= 'A' && u <= 'Z') {
      const s = k.charCodeAt(ki % k.length) - A; ki++;
      out += String.fromCharCode(((u.charCodeAt(0) - A + s) % 26) + A);
    } else if (keepNonLetters) out += ch;
  }
  return out;
}
export function vigenereDecode(cipher, key, { keepNonLetters = false } = {}) {
  const k = letters(key); if (!k) throw new Error('vigenere: empty key');
  let ki = 0, out = '';
  for (const ch of String(cipher)) {
    const u = ch.toUpperCase();
    if (u >= 'A' && u <= 'Z') {
      const s = k.charCodeAt(ki % k.length) - A; ki++;
      out += String.fromCharCode(((u.charCodeAt(0) - A - s + 26) % 26) + A);
    } else if (keepNonLetters) out += ch;
  }
  return out;
}

// ---------- 自动密钥（Autokey，密钥后接明文） ----------
export function autokeyEncode(plain, primer) {
  const p = letters(plain), k = letters(primer);
  const stream = (k + p).slice(0, p.length);
  let out = '';
  for (let i = 0; i < p.length; i++) out += String.fromCharCode(((p.charCodeAt(i) - A + stream.charCodeAt(i) - A) % 26) + A);
  return out;
}
export function autokeyDecode(cipher, primer) {
  const c = letters(cipher), k = letters(primer);
  let out = '';
  for (let i = 0; i < c.length; i++) {
    const keyChar = i < k.length ? k.charCodeAt(i) : out.charCodeAt(i - k.length);
    out += String.fromCharCode(((c.charCodeAt(i) - A - (keyChar - A) + 26) % 26) + A);
  }
  return out;
}

// ---------- 波利比奥斯方（Polybius，5×5，I/J 合并） ----------
export function polybiusGrid(keyword = '') {
  const seen = new Set(); let g = '';
  for (const c of letters(keyword + ALPHA)) { if (c === 'J') continue; if (!seen.has(c)) { seen.add(c); g += c; } }
  return g; // 25 字母，index = row*5+col
}
export function polybiusEncode(text, keyword = '') {
  const g = polybiusGrid(keyword);
  let out = [];
  for (const ch of letters(text)) {
    const c = ch === 'J' ? 'I' : ch;
    const idx = g.indexOf(c); if (idx < 0) continue;
    out.push((Math.floor(idx / 5) + 1) + '' + ((idx % 5) + 1));
  }
  return out.join('·');
}
export function polybiusDecode(code, keyword = '') {
  const g = polybiusGrid(keyword);
  const nums = String(code).replace(/[^0-9]/g, '');
  let out = '';
  for (let i = 0; i + 2 <= nums.length; i += 2) {
    const r = +nums[i] - 1, c = +nums[i + 1] - 1;
    if (r >= 0 && r < 5 && c >= 0 && c < 5) out += g[r * 5 + c];
  }
  return out;
}

// ---------- Playfair ----------
export function playfairSquare(keyword) {
  const seen = new Set(); let sq = '';
  for (const c of letters(keyword + ALPHA)) { if (c === 'J') continue; if (!seen.has(c)) { seen.add(c); sq += c; } }
  return sq; // 25
}
function pfPos(sq, ch) { const i = sq.indexOf(ch === 'J' ? 'I' : ch); return [Math.floor(i / 5), i % 5]; }
export function playfairPairs(text) {
  const t = letters(text).replace(/J/g, 'I'); const pairs = [];
  for (let i = 0; i < t.length; i++) {
    const a = t[i]; let b = t[i + 1] || 'X';
    if (a === b) { b = 'X'; i--; } // 同对之间插 X，不跳过第二个字母
    pairs.push([a, b]); if (t[i + 1]) i++;
  }
  if (pairs.length && pairs[pairs.length - 1][1] === undefined) {}
  return pairs;
}
export function playfairEncode(text, keyword) {
  const sq = playfairSquare(keyword); const pairs = playfairPairs(text); let out = '';
  for (const [a, b] of pairs) {
    const [r1, c1] = pfPos(sq, a), [r2, c2] = pfPos(sq, b);
    if (r1 === r2) out += sq[r1 * 5 + (c1 + 1) % 5] + sq[r2 * 5 + (c2 + 1) % 5];
    else if (c1 === c2) out += sq[((r1 + 1) % 5) * 5 + c1] + sq[((r2 + 1) % 5) * 5 + c2];
    else out += sq[r1 * 5 + c2] + sq[r2 * 5 + c1];
  }
  return out;
}
export function playfairDecode(text, keyword) {
  const sq = playfairSquare(keyword); const t = letters(text); let out = '';
  for (let i = 0; i + 2 <= t.length; i += 2) {
    const a = t[i], b = t[i + 1];
    const [r1, c1] = pfPos(sq, a), [r2, c2] = pfPos(sq, b);
    if (r1 === r2) out += sq[r1 * 5 + (c1 + 4) % 5] + sq[r2 * 5 + (c2 + 4) % 5];
    else if (c1 === c2) out += sq[((r1 + 4) % 5) * 5 + c1] + sq[((r2 + 4) % 5) * 5 + c2];
    else out += sq[r1 * 5 + c2] + sq[r2 * 5 + c1];
  }
  return out;
}

// ---------- 异或（逐字节） ----------
export function xorBytes(a, b) {
  const x = toBytes(a), y = toBytes(b); const n = Math.min(x.length, y.length);
  const out = []; for (let i = 0; i < n; i++) out.push(x[i] ^ y[i]);
  return out;
}
export const xorStrings = (a, b) => fromBytes(xorBytes(a, b));
// 生成与目标明文异或得到 key 的另一串（用于「双残带」谜题）
export function xorMask(plain, known) { return fromBytes(xorBytes(plain, known)); }

// ---------- Luhn（船籍/工单号校验位） ----------
export function luhnValid(digits) {
  const d = String(digits).replace(/[^0-9]/g, '').split('').map(Number);
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}
export function luhnCheckDigit(digits) {
  const base = String(digits).replace(/[^0-9]/g, '');
  for (let c = 0; c <= 9; c++) if (luhnValid(base + c)) return String(c);
  throw new Error('luhn: no check digit');
}

// ---------- 频率分析辅助（单表替换验证用） ----------
export function freqTable(text) {
  const t = letters(text); const f = {};
  for (const c of t) f[c] = (f[c] || 0) + 1;
  return Object.entries(f).sort((a, b) => b[1] - a[1]);
}

export default {
  letters, caesar, caesarDecode, atbash, reverseStr, hexEncode, hexDecode,
  binaryEncode, binaryDecode, b64Encode, b64Decode, b32Encode, b32Decode,
  morseEncode, morseDecode, vigenereEncode, vigenereDecode, autokeyEncode, autokeyDecode,
  polybiusEncode, polybiusDecode, playfairEncode, playfairDecode, xorBytes, xorStrings, xorMask,
  luhnValid, luhnCheckDigit, freqTable,
};
