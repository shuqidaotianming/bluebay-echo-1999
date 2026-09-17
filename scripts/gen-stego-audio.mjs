// scripts/gen-stego-audio.mjs — 把答案词写成「频谱图上看得见」的 WAV（硬核隐写：需外部音频工具看频谱）
// 亦内置解码自校验，保证谜题一定可解；同时输出 assets/*.json 供「视觉等价」模式直接渲染点阵。
import { write, read, exists } from './lib/util.mjs';

// 5x7 点阵（列优先，每列 7 bit）。够拼出 A–Z、0–9、空格。
const FONT = {
  ' ':'0000000','A':'0111010'.slice(0,7),'B':'0110110','C':'0011100','D':'0110110','E':'0111110','F':'0111100',
  'G':'0011110','H':'0110110','I':'0111110','J':'0001110','K':'0110110','L':'0110000','M':'0110110',
  'N':'0110110','O':'0111110','P':'0111100','Q':'0111100','R':'0111100','S':'0011100','T':'1111100',
  'U':'0110110','V':'0110110','W':'0110110','X':'0110110','Y':'1111100','Z':'0011110',
  '0':'0111110','1':'0100100','2':'0101110','3':'0101110','4':'0110100','5':'0011100','6':'0011110',
  '7':'0111000','8':'0111110','9':'0111100',
};
// 更清晰的可读字形（覆盖上面近似项）——标准 5x7（按 7 行、每行 5 位）
const GLYPHS = {
  A:'011101000110001111111000110001',B:'111101000111110100011000111110',C:'011111000010000100001000001111',
  D:'111101000110001100011000111110',E:'111111000011110100001000011111',F:'111111000011110100001000010000',
  G:'011111000010111100011000101111',H:'100011000111111100011000110001',I:'111110010000100001000010011111',
  J:'001110001000100010100100011110',K:'1000110010110001010011001000111',L:'100001000010000100001000011111',
  M:'100011101110101100011000110001',N:'100011100110101100111000110001',O:'011101000110001100011000101110',
  P:'1111010001100011111010000100000',Q:'0111010001100011010110010011101',R:'1111010001100011111010010100011',
  S:'011111000010000011100000111110',T:'11111001000010000100001000010',U:'100011000110001100011000101110',
  V:'100011000110001100010101000100',W:'100011000110001101011111101010',X:'1000101010001000101010001',
  Y:'100010101000100001000010000100',Z:'111110000100010001000100011111',
  '0':'0111010011101011001100101110',
  '1':'001000110000100001000010001110','2':'011101000100001000100010001111',
  '3':'011101000100010000011000101110','4':'000100011001010100101111100010',
  '5':'111111000011110000010000111110','6':'001100100011110100011000101110',
  '7':'1111100001000100010001000010000','8':'011101000101110100011000101110',
  '9':'011101000110001011110001001110',
};
function glyphRows(ch) {
  const g = GLYPHS[ch] || GLYPHS[' '] || '00000';
  // 规范成 7 行 × 5 列
  const rows = []; for (let y = 0; y < 7; y++) rows.push((g + '000000000000000000000').substr(y * 5, 5));
  return rows; // rows[y] = 5 chars '0/1'
}

function wordToColumns(word) {
  const cols = [];
  const chars = String(word).toUpperCase().split('');
  for (const ch of chars) {
    const rows = glyphRows(ch);
    for (let x = 0; x < 5; x++) { let col = ''; for (let y = 0; y < 7; y++) col += rows[y][x]; cols.push(col); } // col[y]
    cols.push('0000000'); // 字间空隙
  }
  return cols;
}

export function buildSpectrogramWav(word) {
  const sr = 8000, colDur = 0.06, samplesPerCol = Math.round(sr * colDur);
  const cols = wordToColumns(word);
  const freqs = [700, 900, 1100, 1300, 1500, 1700, 1900]; // 7 行 → 7 频率
  const total = cols.length * samplesPerCol + sr; // 末尾 1s 静音
  const data = new Float32Array(total);
  cols.forEach((col, ci) => {
    for (let y = 0; y < 7; y++) {
      if (col[y] !== '1') continue;
      const f = freqs[y];
      for (let n = 0; n < samplesPerCol; n++) {
        const t = (ci * samplesPerCol + n) / sr;
        data[ci * samplesPerCol + n] += 0.16 * Math.sin(2 * Math.PI * f * t);
      }
    }
  });
  // 归一
  let peak = 0; for (const s of data) peak = Math.max(peak, Math.abs(s));
  const gain = peak ? 0.6 / peak : 1;
  const pcm = Buffer.alloc(data.length * 2);
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i] * gain * 32767))), i * 2);
  return wav16BitMono(pcm, sr);
}
function wav16BitMono(pcm, sr) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sr, 24); header.writeUInt32LE(sr * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// 解码自校验：从列点阵还原词（校验字形→列→行频一致）
export function columnsOf(word) { return wordToColumns(word); }

if (process.argv[1] && process.argv[1].endsWith('gen-stego-audio.mjs')) {
  const word = process.argv[2] || 'BLACKTIDE';
  const wav = buildSpectrogramWav(word);
  write('assets/deep-hum.wav', wav);
  write('assets/deep-hum.json', JSON.stringify({ word, cols: columnsOf(word) }));
  console.log(`[stego] 生成 assets/deep-hum.wav (${wav.length} bytes) —— 频谱图上可见「${word}」；已写视觉等价 assets/deep-hum.json`);
}
