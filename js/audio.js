// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
CK.Sfx = (() => {
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
    const c = ac();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur);
  }

  function noise(dur, vol = 0.3, freq = 1500, slideTo = null) {
    const c = ac();
    const t = c.currentTime;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  const sounds = {
    swing: () => noise(0.14, 0.25, 3000, 800),
    heavySwing: () => { noise(0.25, 0.3, 1800, 400); tone(180, 0.2, 'triangle', 0.15, 90); },
    hit: () => { tone(160, 0.14, 'sine', 0.5, 55); noise(0.09, 0.35, 1400); },
    heavyHit: () => { tone(110, 0.3, 'sine', 0.6, 35); noise(0.25, 0.5, 900, 200); },
    rocket: () => { noise(0.6, 0.35, 600, 2500); tone(90, 0.4, 'sawtooth', 0.12, 220); },
    boom: () => { noise(0.6, 0.6, 500, 80); tone(70, 0.5, 'sine', 0.5, 30); },
    jump: () => tone(260, 0.12, 'triangle', 0.12, 520),
    land: () => noise(0.06, 0.12, 400),
    beep: () => tone(660, 0.14, 'square', 0.12),
    fight: () => { tone(880, 0.45, 'square', 0.12); tone(1320, 0.45, 'square', 0.06); },
    ko: () => { tone(220, 1.4, 'sawtooth', 0.18, 40); noise(1, 0.25, 300, 60); },
    move: () => tone(520, 0.05, 'square', 0.08),
    confirm: () => { tone(660, 0.08, 'square', 0.1); tone(990, 0.12, 'square', 0.1, null, 0.07); },
  };

  return {
    play(name) {
      if (!enabled) return;
      try { sounds[name](); } catch (e) { /* áudio indisponível */ }
    },
    setEnabled(v) { enabled = v; },
  };
})();
