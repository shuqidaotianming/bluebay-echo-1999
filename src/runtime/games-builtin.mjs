// src/runtime/games-builtin.mjs — 6 个「声音修复师」小游戏（Canvas/DOM 为主，可选音效，均有可视判定）
import { registerGame } from './games.mjs';
import { playSynthSound } from './audio.mjs';

const CSS = '#arg-game-wrap canvas{display:block;width:100%;height:auto;border-radius:8px;background:#05070a;touch-action:none}' +
  '.arg-gctrl{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}' +
  '.arg-gctrl button{padding:6px 12px;border:1px solid #22d3ee;background:#0b2733;color:#a5f3fc;border-radius:8px;cursor:pointer;font-family:inherit}' +
  '.arg-gctrl button.on{background:#22d3ee;color:#05070a}' +
  '.arg-gctrl input[type=range]{flex:1;min-width:140px}';
let cssOn = false;
function ensureCss() { if (cssOn) return; cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
function mk(stage, h) { ensureCss(); const c = document.createElement('canvas'); c.width = 360; c.height = h || 150; stage.appendChild(c); return c; }
function say(status, t) { if (status) status.textContent = t; }

// 1) 补全频谱：频谱图上有一块“塌陷缺口”，补对频段显字
registerGame('spectral-repair', function (stage, opts, done, status) {
  const c = mk(stage, 160), x = c.getContext('2d');
  let patched = null;
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 160);
    for (let col = 0; col < 72; col++) for (let row = 0; row < 12; row++) {
      const band = row < 4 ? 0 : row < 8 ? 1 : 2; // 低/中/高
      let lit = ((col * 7 + row * 13) % 5 === 0);
      if (col >= 20 && col <= 52 && band === 1) lit = (patched === 1); // 中频被挖空
      x.fillStyle = lit ? 'rgba(34,211,238,' + (0.35 + ((col + row) % 3) * 0.2) + ')' : 'rgba(30,41,59,.5)';
      x.fillRect(col * 5, 160 - (row + 1) * 13, 5, 13);
    }
    if (patched === 1) { x.fillStyle = '#fef08a'; x.font = 'bold 22px monospace'; x.fillText('HARBOR', 150, 88); }
  }
  draw(); say(status, '频谱中频被抹掉了。选一个频段补回去（低/中/高）：');
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  ['低频', '中频', '高频'].forEach((lab, i) => {
    const b = document.createElement('button'); b.textContent = lab;
    b.onclick = () => { patched = i; draw(); playSynthSound('click'); if (i === 1) { say(status, '✔ 中频补上了，藏字显形：HARBOR。'); playSynthSound('unlock'); setTimeout(() => done(true), 500); } else say(status, '（还是一片糊——再试别的频段。）'); };
    bar.appendChild(b);
  });
  stage.appendChild(bar);
});

// 2) 去噪门限：滑到“海轰噪声”被滤掉、人声能量达标
registerGame('noise-gate', function (stage, opts, done, status) {
  const c = mk(stage, 130), x = c.getContext('2d'); let thr = 0.8;
  const target = 0.45; // 门限落在 0.40–0.50 之间为“听清”
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 130);
    x.strokeStyle = '#22d3ee'; x.beginPath();
    for (let i = 0; i < 360; i++) {
      const hum = (1 - thr) * 26 * Math.sin(i / 4) + (1 - thr) * (Math.random() * 6);
      const voice = 10 * Math.sin(i / 18) * Math.exp(-Math.pow((i - 180) / 90, 2));
      const y = 65 + hum + (thr < 0.55 ? voice : voice * 0.2);
      i ? x.lineTo(i, y) : x.moveTo(i, y);
    }
    x.stroke();
  }
  draw(); say(status, '拉门限把 4.5Hz 海轰噪声压下去，露出被埋的一句人声：');
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  const rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.value = 80;
  rg.oninput = () => { thr = rg.value / 100; draw(); const ok = thr >= 0.40 && thr <= 0.50; if (ok && !rg._won) { rg._won = true; done(true); } };
  bar.appendChild(rg); stage.appendChild(bar);
});

// 3) 走带对位：左右声道相位对齐，相关峰归零
registerGame('tape-align', function (stage, opts, done, status) {
  const c = mk(stage, 130), x = c.getContext('2d'); const off0 = 46; let off = 0;
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 130);
    const wave = (dy, shift, col) => { x.strokeStyle = col; x.beginPath(); for (let i = 0; i < 360; i++) { const y = dy + 22 * Math.sin((i + shift) / 12); i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); };
    wave(45, 0, '#22d3ee'); wave(95, off0 + off, '#facc15');
    x.fillStyle = '#94a3b8'; x.font = '11px monospace'; x.fillText('错位 ' + Math.abs(off0 + off) + '（对齐到 0）', 8, 14);
  }
  draw(); say(status, '两路信号错位了。拖动滑块让黄色波与青波对齐：');
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  const rg = document.createElement('input'); rg.type = 'range'; rg.min = -60; rg.max = 20; rg.value = 0;
  rg.oninput = () => { off = +rg.value; draw(); if (Math.abs(off0 + off) <= 2 && !rg._won) { rg._won = true; done(true); } };
  bar.appendChild(rg); stage.appendChild(bar);
});

// 4) 调谐旋钮：方向键拧到精确频率才“锁相”，冷热引导（错误频率是诱饵）
registerGame('tuning-dial', function (stage, opts, done, status) {
  const target = (opts.freq || 94.90);
  let f = 99.40;
  const c = mk(stage, 90), x = c.getContext('2d');
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 90);
    const err = Math.abs(f - target); const near = Math.max(0, 1 - err / 10);
    x.fillStyle = 'rgba(34,211,238,' + (0.2 + near * 0.8) + ')'; x.fillRect(0, 62, 360, 6);
    x.fillStyle = '#a5f3fc'; x.font = 'bold 20px monospace'; x.fillText(f.toFixed(2) + ' MHz', 12, 34);
    x.fillStyle = '#facc15'; x.font = '12px monospace'; x.fillText(['冷', '凉', '温', '热', '锁相!'][Math.min(4, Math.floor(near * 5))], 250, 34);
  }
  draw(); say(status, '用 ← → 方向键微调频率，找回那个“获批未启用”的备用台（提示：比 99.40 低一点）：');
  function key(e) { if (e.key === 'ArrowLeft') f = +(f - 0.05).toFixed(2); else if (e.key === 'ArrowRight') f = +(f + 0.05).toFixed(2); else return; draw(); if (Math.abs(f - target) < 0.005 && !key._w) { key._w = true; done(true); } }
  document.addEventListener('keydown', key);
  stage.addEventListener('mouseenter', () => document.removeEventListener('keydown', key));
});

// 5) 剪辑拼接：把碎磁带按时间顺序拖回正确排列，重组顺序拼出答案
registerGame('splice-order', function (stage, opts, done, status) {
  const segs = [{ id: 0, t: '03:11 · 台呼' }, { id: 1, t: '03:12 · 66 个名字' }, { id: 2, t: '03:13 · 一句对不起' }, { id: 3, t: '03:14 · 话筒切断了' }];
  let order = [2, 0, 3, 1];
  const c = mk(stage, 40); // 占位，主体用按钮
  const bar = document.createElement('div'); bar.className = 'arg-gctrl'; bar.style.flexDirection = 'column'; bar.style.alignItems = 'stretch';
  function render() {
    bar.innerHTML = '<div style="font-size:12px;opacity:.8">点两段交换，把它们按时间前后排好：</div>';
    order.forEach((sid, idx) => { const b = document.createElement('button'); b.textContent = (idx + 1) + '. ' + segs[sid].t; b.dataset.i = idx; bar.appendChild(b); });
    say(status, '把顺序排成 03:11 → 03:12 → 03:13 → 03:14。');
  }
  let sel = null;
  bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i; if (sel == null) { sel = i; b.classList.add('on'); playSynthSound('click'); return; } const t = order[sel]; order[sel] = order[i]; order[i] = t; sel = null; render(); if (order.every((s, k) => s === k)) { say(status, '✔ 带子接好了，那一夜的顺序还原了。'); done(true); } });
  render(); stage.appendChild(bar);
});

// 6) 三段 EQ：切掉低频海噪、保留人声中频、压掉高频嘶声
registerGame('eq-band', function (stage, opts, done, status) {
  const c = mk(stage, 130), x = c.getContext('2d'); const eq = { low: 0.5, mid: 0.5, high: 0.5 };
  function draw() {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 360, 130);
    x.strokeStyle = '#22d3ee'; x.beginPath();
    const lowCut = 1 - Math.min(1, Math.max(0, (eq.low - 0.6) / 0.25));
    const highCut = 1 - Math.min(1, Math.max(0, (eq.high - 0.6) / 0.25));
    const voiceGain = 1 - Math.min(1, eq.mid);
    for (let i = 0; i < 360; i++) {
      const sea = 26 * lowCut * Math.sin(i / 4);
      const hiss = 12 * highCut * Math.sin(i / 1.6);
      const voice = 15 * Math.max(0, voiceGain) * Math.sin(i / 22) * Math.exp(-Math.pow((i - 180) / 120, 2));
      const y = 65 + sea + hiss + voice;
      i ? x.lineTo(i, y) : x.moveTo(i, y);
    }
    x.stroke();
    x.fillStyle = '#94a3b8'; x.font = '11px monospace'; x.fillText('海噪 ' + (100 - Math.round(lowCut * 100)) + '% ｜ 人声 ' + Math.round(voiceGain * 100) + '% ｜ 嘶声 ' + (100 - Math.round(highCut * 100)) + '%', 8, 14);
  }
  draw(); say(status, '把「低频海噪」和「高频嘶声」压下去、让「中频人声」抬起来，那句话就会露出来。');
  const bar = document.createElement('div'); bar.className = 'arg-gctrl';
  function slider(name, label, init) { const rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.value = (init * 100); const lab = document.createElement('span'); lab.textContent = label; lab.style.fontSize = '12px'; rg.oninput = () => { eq[name] = rg.value / 100; draw(); check(); }; bar.appendChild(lab); bar.appendChild(rg); }
  function check() { const win = eq.low > 0.68 && eq.mid < 0.34 && eq.high > 0.68; if (win && !bar._w) { bar._w = true; say(status, '✔ 那句话清楚了。'); done(true); } }
  slider('low', '切低频', 0.5); slider('mid', '中频', 0.5); slider('high', '切高频', 0.5); stage.appendChild(bar);
});
