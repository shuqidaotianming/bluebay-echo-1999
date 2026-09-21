// src/runtime/audio-games.mjs — 小游戏实时音频工作台（Web Audio；无 AudioContext 时安全 no-op）
export function createStudio() {
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  let ctx, master, rumbleOsc, rumbleGain, voiceOsc, voiceGain, voiceFilter, hissSrc, hissGain, hissFilter, analyser;
  let running = false;

  function noiseBuffer(sec) {
    const len = ctx.sampleRate * sec, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    return buf;
  }
  function start() {
    if (!AC || running) return;
    try {
      ctx = ctx || new AC();
      if (ctx.state === 'suspended') ctx.resume();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      // 低频海轰（52/56.5Hz 双正弦 → 4.5Hz 拍频）
      rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0.5; rumbleGain.connect(master);
      [52, 56.5].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(rumbleGain); o.start(); });
      // 中频人声带（一个被带通塑形的锯齿，模拟一句话）
      voiceOsc = ctx.createOscillator(); voiceOsc.type = 'sawtooth'; voiceOsc.frequency.value = 220;
      voiceFilter = ctx.createBiquadFilter(); voiceFilter.type = 'bandpass'; voiceFilter.frequency.value = 700; voiceFilter.Q.value = 4;
      voiceGain = ctx.createGain(); voiceGain.gain.value = 0;
      voiceOsc.connect(voiceFilter); voiceFilter.connect(voiceGain); voiceGain.connect(master); voiceOsc.start();
      // 高频嘶声（白噪→高通）
      hissSrc = ctx.createBufferSource(); hissSrc.buffer = noiseBuffer(2); hissSrc.loop = true;
      hissFilter = ctx.createBiquadFilter(); hissFilter.type = 'highpass'; hissFilter.frequency.value = 3200;
      hissGain = ctx.createGain(); hissGain.gain.value = 0.3;
      hissSrc.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(master); hissSrc.start();
      running = true;
    } catch (e) {}
  }
  function stop() {
    if (!running) return;
    try { [rumbleOsc].forEach((o) => o && o.stop && o.stop()); } catch (e) {}
    try { voiceOsc && voiceOsc.stop(); } catch (e) {}
    try { hissSrc && hissSrc.stop(); } catch (e) {}
    // 断开主链路（各子节点随之释放）
    try { master && master.disconnect(); } catch (e) {}
    running = false;
  }
  const set = (node, v) => { if (running && node) { try { node.gain.setTargetAtTime(v, ctx.currentTime, 0.05); } catch (e) { node.gain.value = v; } } };
  return {
    get available() { return !!AC; },
    get running() { return running; },
    start, stop,
    setRumble(x) { set(rumbleGain, Math.max(0, Math.min(1, x)) * 0.9); },   // 海轰噪声强度
    setVoice(x) { set(voiceGain, Math.max(0, Math.min(1, x)) * 0.5); },      // 人声清晰度/音量
    setHiss(x) { set(hissGain, Math.max(0, Math.min(1, x)) * 0.4); },        // 高频嘶声
    setVoiceFreq(f) { if (running && voiceOsc) try { voiceOsc.frequency.value = f; } catch (e) {} },
    // 失谐拍频：offset 越大越“毛刺”（走带对位用）
    setDetune(offsetHz) { if (running && voiceOsc) { try { voiceOsc.detune.value = offsetHz * 100; } catch (e) {} } },
  };
}
