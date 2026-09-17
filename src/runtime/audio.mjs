// src/runtime/audio.mjs — Web Audio 合成（零素材、离线）
export let audioCtx = null;
export function getAudioCtx() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function playSynthSound(kind) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (kind === 'click' || kind === 'type') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(kind === 'type' ? 380 + Math.random() * 160 : 700, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.035);
    } else if (kind === 'notify') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else if (kind === 'unlock') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.22);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.06); osc.stop(ctx.currentTime + i * 0.06 + 0.22);
      });
    } else if (kind === 'error') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.18);
    }
  } catch (e) {}
}

// ---- 4.5Hz 低频底噪 ----
export let droneCtx = null, droneMaster = null, droneOn = false, droneBtn = null;
export function ensureDroneToggle() {
  if (droneBtn || !config.drone || config.preview || document.getElementById('arg-drone-toggle')) return;
  droneBtn = document.createElement('button'); droneBtn.id = 'arg-drone-toggle';
  droneBtn.textContent = '◍ 白噪'; droneBtn.title = '开启/关闭 4.5Hz 低频底噪（FM99.4）';
  document.body.appendChild(droneBtn);
  const st = document.createElement('style');
  st.textContent = '#arg-drone-toggle{position:fixed;left:10px;bottom:10px;z-index:99990;font-size:11px;letter-spacing:1px;color:#94a3b8;background:rgba(10,14,22,.5);border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:4px 11px;cursor:pointer;opacity:.6;font-family:inherit}#arg-drone-toggle:hover{opacity:.95;color:#e2e8f0}';
  document.head.appendChild(st);
  droneBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleDrone(); });
}
export function buildDrone() {
  const AC = window.AudioContext || window.webkitAudioContext;
  droneCtx = new AC();
  droneMaster = droneCtx.createGain(); droneMaster.gain.value = 0.0001; droneMaster.connect(droneCtx.destination);
  [52, 56.5].forEach(function (f) {
    const o = droneCtx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = droneCtx.createGain(); g.gain.value = 0.5;
    o.connect(g); g.connect(droneMaster); o.start();
  });
  const len = 2 * droneCtx.sampleRate, buf = droneCtx.createBuffer(1, len, droneCtx.sampleRate), d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  const src = droneCtx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = droneCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
  const ng = droneCtx.createGain(); ng.gain.value = 0.7;
  src.connect(lp); lp.connect(ng); ng.connect(droneMaster); src.start();
}
export function toggleDrone() {
  try {
    if (!droneCtx) buildDrone();
    if (droneCtx.state === 'suspended') droneCtx.resume();
    droneOn = !droneOn;
    const t = droneCtx.currentTime;
    droneMaster.gain.cancelScheduledValues(t);
    droneMaster.gain.setValueAtTime(droneMaster.gain.value, t);
    droneMaster.gain.linearRampToValueAtTime(droneOn ? 0.12 : 0.0001, t + 0.8);
    droneBtn.textContent = droneOn ? '◉ 白噪' : '◍ 白噪';
  } catch (e) {}
}
