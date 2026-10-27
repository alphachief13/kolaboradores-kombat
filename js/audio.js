// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
// play(nome, personagem): se o personagem tem um som próprio com esse nome, toca ele; senão, o genérico.
CK.Sfx = (() => {
  let ctx = null;
  let master = null;
  let verb = null;
  let noiseBuf = null;
  let enabled = true;
  const last = {};          // último instante de cada som (evita empilhar o mesmo som no mesmo tick)

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // tudo passa por um compressor: os golpes ficam encorpados sem estourar
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 5;
      comp.attack.value = 0.002;
      comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = 0.75;
      master.connect(comp).connect(ctx.destination);
      // reverb de "arena": ruído estéreo com queda exponencial
      verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.6);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      verb.buffer = ir;
      verb.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  // curvas do waveshaper: distorção (tanh) e bitcrush (degraus)
  const curves = {};
  function curve(kind, amt) {
    const key = kind + amt;
    if (!curves[key]) {
      const n = 1024, c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        c[i] = kind === 'dist' ? Math.tanh(x * amt) / Math.tanh(amt) : Math.round(x * amt) / amt;
      }
      curves[key] = c;
    }
    return curves[key];
  }

  // filtros/efeitos opcionais → envelope → saída (seca + reverb)
  // o: { at, dur, vol, attack, hold, lp, hp, bp: [f, q], dist, crush, trem: [Hz, prof.], wet }
  function chain(src, o, t) {
    const c = ctx;
    let node = src;
    const link = (n) => { node.connect(n); node = n; };
    if (o.dist) { const w = c.createWaveShaper(); w.curve = curve('dist', o.dist); link(w); }
    if (o.crush) { const w = c.createWaveShaper(); w.curve = curve('crush', o.crush); link(w); }
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; link(f); }
    if (o.hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; link(f); }
    if (o.bp) {
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = o.bp[0];
      f.Q.value = o.bp[1];
      link(f);
    }
    const dur = o.dur ?? 0.2, vol = o.vol ?? 0.3, attack = o.attack ?? 0.004, hold = o.hold ?? 0;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    if (hold) g.gain.setValueAtTime(vol, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + hold + 0.01));
    link(g);
    if (o.trem) {
      // tremolo: o volume oscila (zumbido do bumerangue, rodinha do cubo)
      const tg = c.createGain();
      tg.gain.value = 1 - o.trem[1];
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = o.trem[0];
      lg.gain.value = o.trem[1];
      lfo.connect(lg).connect(tg.gain);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      link(tg);
    }
    node.connect(master);
    const wet = o.wet ?? 0.12;
    if (wet) {
      const s = c.createGain();
      s.gain.value = wet;
      node.connect(s).connect(verb);
    }
  }

  // oscilador: { type, f, f2 (desliza até), glide, vib: [Hz, cents], detune } + opções de chain
  function osc(o) {
    const c = ac();
    const t = c.currentTime + (o.at || 0);
    const dur = o.dur ?? 0.2;
    const s = c.createOscillator();
    s.type = o.type || 'sine';
    s.frequency.setValueAtTime(o.f, t);
    if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? dur));
    if (o.detune) s.detune.value = o.detune;
    if (o.vib) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1];
      lfo.connect(lg).connect(s.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    chain(s, o, t);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  // ruído filtrado: { f, f2, q, type ('bandpass' | 'lowpass' | 'highpass') } + opções de chain
  function noise(o) {
    const c = ac();
    const t = c.currentTime + (o.at || 0);
    const dur = o.dur ?? 0.2;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1500, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? dur));
    f.Q.value = o.q ?? 1;
    s.connect(f);
    chain(f, o, t);
    s.start(t, Math.random() * 1.2);
    s.stop(t + dur + 0.05);
  }

  // voz sintética: dente de serra passando por formantes de vogal (gritos, balidos, coral)
  const VOWELS = {
    a: [800, 1150, 2900], e: [480, 1900, 2600], i: [300, 2300, 3000],
    o: [450, 800, 2830], u: [325, 700, 2530],
  };
  function voice(o) {
    const c = ac();
    const t = c.currentTime + (o.at || 0);
    const dur = o.dur ?? 0.3;
    const s = c.createOscillator();
    s.type = 'sawtooth';
    s.frequency.setValueAtTime(o.f, t);
    if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? dur));
    if (o.detune) s.detune.value = o.detune;
    if (o.vib) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1];
      lfo.connect(lg).connect(s.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const mix = c.createGain();
    VOWELS[o.vowel || 'a'].forEach((fr, i) => {
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = fr * (o.formant || 1);
      f.Q.value = 9;
      const g = c.createGain();
      g.gain.value = [3, 1.6, 0.6][i];
      s.connect(f).connect(g).connect(mix);
    });
    chain(mix, { attack: 0.02, ...o }, t);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  // sino: parciais inarmônicas que somem em tempos diferentes
  function bell(o) {
    const ratios = o.ratios || [1, 2.76, 5.4, 8.93];
    ratios.forEach((r, i) => osc({
      ...o, type: 'sine', f: o.f * r, f2: null, vol: (o.vol ?? 0.2) / (i + 1), dur: (o.dur ?? 1) / (1 + i * 0.6),
      attack: 0.002,
    }));
  }

  // bumbo: seno que despenca de tom (corpo dos impactos)
  const kick = (o) => osc({ type: 'sine', glide: (o.dur ?? 0.2) * 0.5, attack: 0.002, wet: 0.05, ...o });

  // vários bipes em sequência: [freq, ...] a cada "step" segundos
  const arp = (notes, o) => notes.forEach((f, i) => osc({ ...o, f, at: (o.at || 0) + i * o.step }));

  const whoosh = (o = {}) => noise({ type: 'bandpass', f: 500, f2: 3200, q: 1.4, dur: 0.18, vol: 0.28, attack: 0.05, wet: 0.05, ...o });
  const click = (o = {}) => noise({ type: 'highpass', f: 3500, dur: 0.025, vol: 0.3, wet: 0.02, ...o });

  // ----- sons genéricos -----
  const sounds = {
    a1: () => whoosh({ f: 900, f2: 4200, dur: 0.14 }),
    a2: () => { whoosh({ f: 300, f2: 1800, dur: 0.28, vol: 0.32 }); kick({ f: 160, f2: 70, dur: 0.2, vol: 0.2 }); },
    shot: () => { noise({ f: 600, f2: 2500, dur: 0.5, vol: 0.3 }); osc({ type: 'sawtooth', f: 90, f2: 220, dur: 0.4, vol: 0.1, lp: 900 }); },
    hit: () => {
      kick({ f: rnd(170, 200), f2: 50, dur: 0.16, vol: 0.75 });
      noise({ type: 'highpass', f: 2200, dur: 0.05, vol: 0.45, wet: 0.04 });
      noise({ type: 'bandpass', f: 900, q: 0.8, dur: 0.12, vol: 0.4, wet: 0.15 });
    },
    heavyHit: () => {
      kick({ f: 150, f2: 32, dur: 0.38, vol: 0.95 });
      noise({ type: 'lowpass', f: 2600, f2: 180, dur: 0.4, vol: 0.55, dist: 3, wet: 0.3 });
      noise({ type: 'highpass', f: 1800, dur: 0.07, vol: 0.5, wet: 0.05 });
    },
    // escudo: clangor metálico
    block: () => {
      bell({ f: rnd(820, 900), dur: 0.35, vol: 0.18, wet: 0.2 });
      noise({ type: 'highpass', f: 4000, dur: 0.04, vol: 0.35 });
      kick({ f: 220, f2: 120, dur: 0.08, vol: 0.3 });
    },
    jump: () => whoosh({ f: 400, f2: 2200, dur: 0.16, vol: 0.18 }),
    dash: () => { whoosh({ f: 700, f2: 3200, dur: 0.12, vol: 0.22 }); noise({ type: 'lowpass', f: 600, dur: 0.08, vol: 0.18 }); },
    land: () => {
      kick({ f: 95, f2: 40, dur: 0.12, vol: 0.4 });
      noise({ type: 'lowpass', f: 500, dur: 0.1, vol: 0.25, wet: 0.02 });
    },
    step: () => noise({ type: 'lowpass', f: rnd(450, 700), dur: 0.05, vol: 0.12, wet: 0 }),
    hurt: () => voice({ f: 220, f2: 150, dur: 0.22, vowel: 'u', vol: 0.18 }),
    koVoice: () => voice({ f: 230, f2: 90, dur: 0.9, vowel: 'a', vol: 0.2 }),
    shotHit: () => sounds.boom(),
    beep: () => {
      osc({ type: 'square', f: 523, dur: 0.22, vol: 0.12, lp: 3000 });
      osc({ type: 'square', f: 1046, dur: 0.18, vol: 0.05, lp: 3000, at: 0.02 });
      kick({ f: 140, f2: 60, dur: 0.15, vol: 0.35 });
    },
    // FIGHT!: acorde distorcido + prato
    fight: () => {
      [110, 165, 220, 330].forEach((f) => osc({ type: 'sawtooth', f, dur: 0.9, vol: 0.09, dist: 4, lp: 2400, wet: 0.3 }));
      kick({ f: 120, f2: 35, dur: 0.5, vol: 0.9 });
      noise({ type: 'highpass', f: 5000, dur: 1.1, vol: 0.25, wet: 0.4 });
      whoosh({ f: 300, f2: 5000, dur: 0.35, vol: 0.3 });
    },
    // K.O.: estrondo em câmera lenta + sino grave
    ko: () => {
      kick({ f: 90, f2: 25, dur: 1.2, vol: 1 });
      noise({ type: 'lowpass', f: 1800, f2: 80, dur: 1.4, vol: 0.6, dist: 2, wet: 0.5 });
      bell({ f: 98, dur: 2.4, vol: 0.3, wet: 0.6, at: 0.05 });
      osc({ type: 'sawtooth', f: 220, f2: 40, dur: 1.3, vol: 0.1, lp: 900, wet: 0.4 });
    },
    // tempo esgotado: buzina de ginásio
    timeUp: () => {
      [220, 233].forEach((f) => osc({ type: 'sawtooth', f, dur: 0.9, vol: 0.12, hold: 0.7, lp: 1600, dist: 2, wet: 0.3 }));
    },
    // vitória: fanfarrinha
    win: () => {
      arp([523, 659, 784], { type: 'square', dur: 0.12, vol: 0.09, step: 0.11, lp: 3500, wet: 0.25 });
      [1046, 1318, 1568].forEach((f) => osc({ type: 'square', f, dur: 0.6, vol: 0.06, at: 0.33, lp: 4000, wet: 0.35, vib: [6, 12] }));
    },
    // cura: harpa subindo
    heal: () => arp([523, 659, 784, 1046, 1318], { type: 'sine', dur: 0.5, vol: 0.13, step: 0.06, wet: 0.5 }),
    // controles invertidos: "erro" de computador
    glitched: () => {
      arp([880, 660, 440, 220], { type: 'square', dur: 0.08, vol: 0.09, step: 0.07, crush: 4, wet: 0.05 });
      noise({ type: 'bandpass', f: 3000, dur: 0.3, vol: 0.15, crush: 3, at: 0.05 });
    },
    // enrolado na lã: farfalhar macio
    wrapped: () => {
      noise({ type: 'lowpass', f: 1400, dur: 0.6, vol: 0.3, trem: [14, 0.6], attack: 0.05 });
      osc({ f: 300, f2: 180, dur: 0.4, vol: 0.12, vib: [8, 40] });
    },
    bounce: () => {
      kick({ f: 260, f2: 110, dur: 0.08, vol: 0.4 });
      noise({ type: 'bandpass', f: 1600, q: 2, dur: 0.03, vol: 0.25 });
    },
    catch: () => { osc({ f: 900, f2: 1500, dur: 0.08, vol: 0.12 }); noise({ type: 'lowpass', f: 900, dur: 0.06, vol: 0.25 }); },
    blink: () => osc({ type: 'square', f: rnd(1600, 2400), f2: 3200, dur: 0.04, vol: 0.05, crush: 3, wet: 0 }),
    // projéteis antigos (mantidos para quem não define som próprio)
    rocket: () => sounds.shot(),
    zap: () => { osc({ type: 'sawtooth', f: 300, f2: 1400, dur: 0.5, vol: 0.1 }); noise({ f: 4000, f2: 1200, dur: 0.5, vol: 0.2 }); },
    zapHit: () => { osc({ type: 'square', f: 1200, f2: 120, dur: 0.35, vol: 0.15 }); noise({ f: 2500, f2: 300, dur: 0.4, vol: 0.45 }); },
    boom: () => {
      kick({ f: 80, f2: 25, dur: 0.7, vol: 1 });
      noise({ type: 'lowpass', f: 3000, f2: 90, dur: 1.1, vol: 0.7, dist: 3, wet: 0.45 });
    },
    swing: () => sounds.a1(),
    heavySwing: () => sounds.a2(),
    move: () => osc({ type: 'triangle', f: 660, f2: 880, dur: 0.06, vol: 0.12, wet: 0 }),
    confirm: () => {
      arp([660, 990], { type: 'square', dur: 0.12, vol: 0.08, step: 0.07, lp: 3000, wet: 0.1 });
      kick({ f: 180, f2: 80, dur: 0.1, vol: 0.25 });
    },
  };

  // ----- sons de cada personagem -----
  const CHAR = {
    // rato militar: cassetete de madeira, bazuca e guinchos
    soldado: {
      a1: () => { whoosh({ f: 700, f2: 3000, dur: 0.16 }); osc({ f: 1400, f2: 1800, dur: 0.06, vol: 0.06 }); },
      a1Hit: () => {
        noise({ type: 'bandpass', f: 1700, q: 7, dur: 0.07, vol: 0.6 });   // "toc" da madeira
        osc({ f: 340, f2: 170, dur: 0.1, vol: 0.35 });
      },
      // engatilha a bazuca: dois cliques metálicos
      a2: () => {
        click({ f: 2500 });
        click({ f: 3000, at: 0.09 });
        bell({ f: 1900, dur: 0.15, vol: 0.06, at: 0.1 });
        kick({ f: 120, f2: 70, dur: 0.12, vol: 0.25, at: 0.1 });
      },
      // disparo: tranco grave + chiado de foguete
      shot: () => {
        kick({ f: 90, f2: 28, dur: 0.45, vol: 1 });
        noise({ type: 'lowpass', f: 1200, f2: 200, dur: 0.35, vol: 0.5, dist: 4, wet: 0.2 });
        noise({ type: 'highpass', f: 2500, f2: 900, dur: 1.1, vol: 0.28, attack: 0.08, wet: 0.2 });
        osc({ type: 'sawtooth', f: 180, f2: 420, dur: 1, vol: 0.06, lp: 1200, attack: 0.1 });
      },
      shotHit: () => {
        kick({ f: 70, f2: 20, dur: 0.9, vol: 1 });
        noise({ type: 'lowpass', f: 4000, f2: 70, dur: 1.4, vol: 0.85, dist: 5, wet: 0.5 });
        for (let i = 0; i < 6; i++) noise({ type: 'bandpass', f: rnd(800, 3000), q: 3, dur: 0.05, vol: 0.2, at: rnd(0.1, 0.6) });
      },
      hurt: () => voice({ f: rnd(820, 900), f2: 620, dur: 0.18, vowel: 'i', vol: 0.14 }),       // guincho
      koVoice: () => voice({ f: 1000, f2: 280, dur: 1, vowel: 'i', vol: 0.15, vib: [9, 60] }),
      jump: () => { whoosh({ f: 500, f2: 2600, dur: 0.15, vol: 0.18 }); voice({ f: 900, f2: 1200, dur: 0.1, vowel: 'i', vol: 0.08 }); },
    },
    // mascote do boné: desenho animado, "bonk" e bumerangue zunindo
    bonezinho: {
      a1: () => noise({ type: 'bandpass', f: 2200, q: 1.5, dur: 0.15, vol: 0.3, trem: [32, 0.7], attack: 0.03 }),
      a1Hit: () => {
        osc({ type: 'triangle', f: 620, f2: 260, dur: 0.16, vol: 0.4 });            // bonk!
        osc({ type: 'square', f: 1240, f2: 520, dur: 0.08, vol: 0.06, lp: 3000 });
      },
      // carrega o boné com magia
      a2: () => {
        osc({ f: 300, f2: 1300, dur: 0.35, vol: 0.12, vib: [12, 30], wet: 0.3 });
        for (let i = 0; i < 6; i++) osc({ f: rnd(2500, 5000), dur: 0.12, vol: 0.05, at: 0.05 + i * 0.05, wet: 0.4 });
      },
      // boné girando no ar
      shot: () => {
        osc({ type: 'sawtooth', f: 160, f2: 240, dur: 0.9, vol: 0.12, lp: 1400, trem: [16, 0.8], attack: 0.05, wet: 0.2 });
        whoosh({ f: 800, f2: 2400, dur: 0.9, vol: 0.18, trem: [16, 0.8] });
      },
      shotHit: () => {
        osc({ f: 1600, f2: 180, dur: 0.3, vol: 0.25 });
        noise({ type: 'bandpass', f: 2500, f2: 400, dur: 0.3, vol: 0.4, wet: 0.3 });
        for (let i = 0; i < 5; i++) osc({ f: rnd(3000, 6000), dur: 0.1, vol: 0.05, at: rnd(0, 0.2), wet: 0.4 });
      },
      hurt: () => voice({ f: 380, f2: 240, dur: 0.2, vowel: 'o', vol: 0.15 }),
      // "uá-uá-uáááá" de trombone triste
      koVoice: () => [392, 370, 349, 330].forEach((f, i) => osc({
        type: 'sawtooth', f, f2: i === 3 ? 300 : null, dur: i === 3 ? 0.9 : 0.3, vol: 0.12, lp: 1100, at: i * 0.32,
        vib: i === 3 ? [6, 40] : null, attack: 0.04, wet: 0.25,
      })),
      jump: () => osc({ f: 180, f2: 640, dur: 0.18, vol: 0.2, vib: [30, 80] }),          // boing
    },
    // mago do cubo: cliques do cubo mágico e brilhos de cristal
    vr: {
      a1: () => {
        for (let i = 0; i < 3; i++) click({ f: 2800 + i * 300, at: i * 0.035, vol: 0.22 });
        noise({ type: 'highpass', f: 5000, dur: 0.25, vol: 0.12, attack: 0.05, wet: 0.4 });
      },
      a1Hit: () => bell({ f: rnd(1100, 1300), dur: 0.5, vol: 0.18, wet: 0.35 }),
      // desmonta o cubo: chacoalhada de peças + arpejo subindo
      a2: () => {
        for (let i = 0; i < 10; i++) click({ f: rnd(2000, 4500), at: i * 0.03, vol: 0.2 });
        arp([523, 784, 1046, 1568], { type: 'triangle', dur: 0.25, vol: 0.08, step: 0.07, at: 0.15, wet: 0.4 });
      },
      shot: () => {
        osc({ type: 'square', f: rnd(1300, 1700), f2: 500, dur: 0.15, vol: 0.06, lp: 3500 });
        click({ vol: 0.2 });
        osc({ f: rnd(2500, 3500), dur: 0.2, vol: 0.05, wet: 0.4, at: 0.03 });
      },
      shotHit: () => {
        bell({ f: rnd(1500, 2100), dur: 0.4, vol: 0.15, wet: 0.35 });
        for (let i = 0; i < 4; i++) click({ f: rnd(2500, 4000), at: rnd(0, 0.15), vol: 0.18 });
      },
      hurt: () => voice({ f: 280, f2: 190, dur: 0.2, vowel: 'e', vol: 0.15 }),
      koVoice: () => {
        voice({ f: 260, f2: 110, dur: 1, vowel: 'o', vol: 0.15 });
        for (let i = 0; i < 8; i++) click({ f: rnd(2000, 4000), at: 0.4 + rnd(0, 0.5), vol: 0.2 });   // peças caindo
      },
      jump: () => { whoosh({ dur: 0.15, vol: 0.15 }); arp([1046, 1568], { dur: 0.15, vol: 0.05, step: 0.05, wet: 0.4 }); },
    },
    // goleira: luvas acolchoadas, apito e chute na bola
    wanessinha: {
      a1: () => whoosh({ f: 1000, f2: 4500, dur: 0.1, vol: 0.25 }),
      a1Hit: () => {
        kick({ f: 140, f2: 60, dur: 0.12, vol: 0.5 });
        noise({ type: 'lowpass', f: 700, dur: 0.1, vol: 0.5 });                   // luva acolchoada
      },
      // apito: "fiu-fiuuu"
      a2: () => {
        osc({ f: 2900, dur: 0.1, vol: 0.12, vib: [45, 70], wet: 0.25 });
        osc({ f: 2900, dur: 0.32, vol: 0.12, vib: [45, 70], at: 0.14, hold: 0.2, wet: 0.25 });
      },
      // chute: "tchoc" da bola + torcida
      shot: () => {
        kick({ f: 170, f2: 60, dur: 0.15, vol: 0.8 });
        noise({ type: 'bandpass', f: 2200, q: 2, dur: 0.03, vol: 0.4 });
        noise({ type: 'bandpass', f: 900, q: 0.7, dur: 1.2, vol: 0.12, attack: 0.3, wet: 0.5 });
      },
      shotHit: () => {
        kick({ f: 150, f2: 45, dur: 0.25, vol: 0.9 });
        noise({ type: 'lowpass', f: 1500, dur: 0.15, vol: 0.5 });
        noise({ type: 'bandpass', f: 1000, q: 0.6, dur: 1, vol: 0.18, attack: 0.05, wet: 0.5 });   // "uuuh!" da torcida
      },
      hurt: () => voice({ f: 460, f2: 340, dur: 0.18, vowel: 'a', vol: 0.14, formant: 1.15 }),
      // fim de jogo: três apitos
      koVoice: () => {
        voice({ f: 480, f2: 260, dur: 0.6, vowel: 'o', vol: 0.15, formant: 1.15 });
        [0.5, 0.8, 1.1].forEach((at, i) => osc({ f: 2900, dur: i === 2 ? 0.6 : 0.2, hold: i === 2 ? 0.4 : 0.1, vol: 0.11, vib: [45, 70], at, wet: 0.3 }));
      },
      jump: () => { whoosh({ f: 500, f2: 3000, dur: 0.14, vol: 0.16 }); voice({ f: 520, dur: 0.09, vowel: 'u', vol: 0.08, formant: 1.15 }); },
    },
    // cordeira: "mééé", cabeçada e lã fofa
    deborah: {
      a1: () => {
        voice({ f: 520, f2: 480, dur: 0.38, vowel: 'e', vol: 0.15, vib: [8, 60], formant: 1.1 });   // méééé
        whoosh({ f: 300, f2: 1500, dur: 0.3, vol: 0.2, at: 0.08 });
      },
      a1Hit: () => {
        kick({ f: 110, f2: 38, dur: 0.25, vol: 0.9 });
        noise({ type: 'bandpass', f: 1200, q: 4, dur: 0.05, vol: 0.4 });          // "toc" do coco
      },
      a2: () => {
        noise({ type: 'lowpass', f: 1300, dur: 0.4, vol: 0.25, trem: [12, 0.6], attack: 0.05 });
        voice({ f: 560, dur: 0.25, vowel: 'a', vol: 0.1, vib: [9, 50], at: 0.1, formant: 1.1 });
      },
      // novelo arremessado: "fump" macio
      shot: () => {
        kick({ f: 200, f2: 90, dur: 0.15, vol: 0.4 });
        noise({ type: 'lowpass', f: 900, f2: 300, dur: 0.3, vol: 0.4 });
      },
      shotHit: () => {
        noise({ type: 'lowpass', f: 1000, f2: 200, dur: 0.5, vol: 0.55, wet: 0.2 });   // pufff
        osc({ f: 200, f2: 500, dur: 0.25, vol: 0.12, vib: [25, 60], at: 0.05 });
      },
      hurt: () => voice({ f: 620, f2: 520, dur: 0.2, vowel: 'e', vol: 0.14, vib: [10, 70], formant: 1.1 }),
      koVoice: () => voice({ f: 560, f2: 300, dur: 1.3, vowel: 'e', vol: 0.15, vib: [7, 90], formant: 1.1, wet: 0.3 }),
      jump: () => { osc({ f: 220, f2: 500, dur: 0.15, vol: 0.14 }); voice({ f: 650, dur: 0.1, vowel: 'e', vol: 0.07, vib: [10, 60] }); },
    },
    // militante: livraço de papel e megafone distorcido
    petista: {
      a1: () => {
        whoosh({ f: 700, f2: 3000, dur: 0.16 });
        for (let i = 0; i < 4; i++) noise({ type: 'highpass', f: 3000, dur: 0.02, vol: 0.1, at: 0.02 + i * 0.025 });   // páginas
      },
      a1Hit: () => {
        noise({ type: 'highpass', f: 1400, dur: 0.05, vol: 0.65 });             // "plaft" do livro
        kick({ f: 160, f2: 70, dur: 0.1, vol: 0.45 });
      },
      // microfonia do megafone
      a2: () => {
        click({ f: 2000, vol: 0.2 });
        osc({ f: 2300, f2: 2900, dur: 0.4, vol: 0.06, vib: [7, 20], attack: 0.1, at: 0.05, wet: 0.2 });
      },
      // o grito: voz saturada e filtrada como num megafone
      shot: () => {
        voice({ f: 175, f2: 150, dur: 0.75, vowel: 'a', vol: 0.4, dist: 6, bp: [1500, 1.2], hold: 0.4, vib: [5, 30], wet: 0.35 });
        osc({ type: 'sawtooth', f: 60, dur: 0.7, vol: 0.08, dist: 3, lp: 400 });
      },
      shotHit: () => {
        kick({ f: 90, f2: 30, dur: 0.5, vol: 0.9 });
        noise({ type: 'bandpass', f: 1500, q: 0.8, dur: 0.4, vol: 0.5, dist: 4, wet: 0.3 });
      },
      hurt: () => voice({ f: 170, f2: 120, dur: 0.2, vowel: 'u', vol: 0.18 }),
      koVoice: () => voice({ f: 190, f2: 75, dur: 1.1, vowel: 'o', vol: 0.2 }),
      jump: () => { whoosh({ f: 400, f2: 2200, dur: 0.15, vol: 0.18 }); voice({ f: 180, dur: 0.1, vowel: 'u', vol: 0.1 }); },
    },
    // pregador: Bíblia pesada, coral de anjos e sino de igreja
    pastor: {
      a1: () => whoosh({ f: 300, f2: 2000, dur: 0.24, vol: 0.32 }),
      a1Hit: () => {
        kick({ f: 120, f2: 35, dur: 0.3, vol: 1 });
        noise({ type: 'highpass', f: 1200, dur: 0.06, vol: 0.5 });
        bell({ f: 660, dur: 0.6, vol: 0.06, wet: 0.5 });
      },
      // "aaaah" do coral: acorde maior com vozes levemente desafinadas
      a2: () => [262, 330, 392, 523].forEach((f, i) => voice({
        f, dur: 1.1, vowel: 'a', vol: 0.06, attack: 0.25, hold: 0.4, vib: [5 + i * 0.3, 15], detune: rnd(-8, 8), wet: 0.6,
      })),
      // onda de luz: harpa subindo e brilho
      shot: () => {
        arp([392, 523, 659, 784, 1046, 1318, 1568], { type: 'triangle', dur: 0.6, vol: 0.06, step: 0.035, wet: 0.6 });
        noise({ type: 'highpass', f: 6000, dur: 0.9, vol: 0.12, attack: 0.2, wet: 0.6 });
      },
      shotHit: () => {
        bell({ f: 523, dur: 1.6, vol: 0.22, wet: 0.6 });
        [523, 659, 784].forEach((f) => voice({ f, dur: 0.7, vowel: 'a', vol: 0.05, attack: 0.05, wet: 0.6 }));
      },
      hurt: () => voice({ f: 200, f2: 140, dur: 0.22, vowel: 'o', vol: 0.17 }),
      koVoice: () => {
        voice({ f: 210, f2: 90, dur: 0.9, vowel: 'a', vol: 0.18 });
        bell({ f: 130, dur: 3, vol: 0.3, wet: 0.7, at: 0.3 });                 // sino da igreja
      },
      jump: () => { whoosh({ f: 350, f2: 2000, dur: 0.17, vol: 0.18 }); voice({ f: 200, dur: 0.08, vowel: 'u', vol: 0.08 }); },
    },
    // acrobata: giro de tornado, "boing" de desenho e o famoso "uoa!"
    bandicoot: {
      // giro: três rajadas de vento em sequência
      a1: () => [0, 0.07, 0.14].forEach((at, i) => whoosh({ f: 400 + i * 200, f2: 2600, dur: 0.12, vol: 0.2, at })),
      a1Hit: () => {
        noise({ type: 'highpass', f: 1500, dur: 0.05, vol: 0.55 });             // "plaft" da aba
        kick({ f: 150, f2: 60, dur: 0.12, vol: 0.5 });
      },
      a2: () => {
        osc({ type: 'triangle', f: 300, f2: 900, dur: 0.3, vol: 0.1, vib: [18, 40] });   // carregando o boné
        voice({ f: 330, dur: 0.15, vowel: 'a', vol: 0.09, at: 0.15 });
      },
      // boné subindo: assobio que sobe e cai, como num desenho animado
      shot: () => {
        osc({ type: 'sine', f: 700, f2: 2200, dur: 0.35, vol: 0.09 });
        osc({ type: 'sine', f: 2200, f2: 500, dur: 0.45, vol: 0.08, at: 0.35 });
      },
      shotHit: () => {
        kick({ f: 110, f2: 35, dur: 0.4, vol: 0.9 });
        noise({ type: 'lowpass', f: 3000, f2: 300, dur: 0.45, vol: 0.5, wet: 0.25 });
        bell({ f: 1320, dur: 0.4, vol: 0.05, wet: 0.4 });
      },
      hurt: () => voice({ f: 330, f2: 250, dur: 0.18, vowel: 'u', vol: 0.15 }),
      // "uoooa!"
      koVoice: () => voice({ f: 340, f2: 200, dur: 1, vowel: 'o', vol: 0.18, vib: [6, 40], wet: 0.3 }),
      // "boing"
      jump: () => { osc({ type: 'sine', f: 180, f2: 620, dur: 0.18, vol: 0.14, vib: [30, 50] }); whoosh({ f: 500, f2: 2600, dur: 0.12, vol: 0.12 }); },
    },
    // acrobata: pião de desenho animado e boné que cai assobiando como bomba
    bandicoot: {
      a1: () => {
        noise({ type: 'bandpass', f: 600, f2: 2600, q: 2, dur: 0.32, vol: 0.32, trem: [22, 0.8], attack: 0.04 });   // tornado
        osc({ type: 'triangle', f: 300, f2: 700, dur: 0.3, vol: 0.06, trem: [22, 0.8] });
      },
      a1Hit: () => {
        osc({ type: 'triangle', f: 500, f2: 200, dur: 0.12, vol: 0.35 });
        noise({ type: 'highpass', f: 1800, dur: 0.05, vol: 0.45 });
      },
      a2: () => voice({ f: 330, f2: 520, dur: 0.3, vowel: 'a', vol: 0.14, vib: [6, 30] }),   // "iarrú!"
      // o boné sobe e despenca assobiando
      shot: () => {
        whoosh({ f: 400, f2: 3000, dur: 0.25, vol: 0.22 });
        osc({ f: 900, f2: 2100, dur: 0.35, vol: 0.06, wet: 0.2 });
        osc({ f: 2100, f2: 500, dur: 0.6, vol: 0.07, at: 0.35, wet: 0.2 });
      },
      shotHit: () => {
        kick({ f: 90, f2: 25, dur: 0.6, vol: 1 });
        noise({ type: 'lowpass', f: 3000, f2: 120, dur: 0.8, vol: 0.6, dist: 3, wet: 0.4 });
        for (let i = 0; i < 6; i++) osc({ f: rnd(2500, 5000), dur: 0.12, vol: 0.05, at: rnd(0, 0.25), wet: 0.4 });
      },
      hurt: () => voice({ f: 340, f2: 250, dur: 0.18, vowel: 'o', vol: 0.15 }),
      koVoice: () => voice({ f: 420, f2: 160, dur: 1.2, vowel: 'o', vol: 0.16, vib: [7, 120] }),  // "uóóóóó"
      jump: () => { osc({ f: 200, f2: 700, dur: 0.16, vol: 0.18, vib: [28, 70] }); whoosh({ f: 600, f2: 3000, dur: 0.14, vol: 0.14 }); },
    },
    // fisiculturista: grunhido de academia, soco que explode e bomba de pavio chiando
    cristorey: {
      a1: () => {
        whoosh({ f: 200, f2: 1600, dur: 0.26, vol: 0.34 });
        voice({ f: 120, f2: 95, dur: 0.22, vowel: 'a', vol: 0.16 });            // "rrah!"
      },
      a1Hit: () => {
        kick({ f: 130, f2: 30, dur: 0.4, vol: 1 });
        noise({ type: 'lowpass', f: 2500, f2: 200, dur: 0.35, vol: 0.5, dist: 2 });
      },
      // pavio aceso
      a2: () => noise({ type: 'highpass', f: 4000, dur: 0.7, vol: 0.12, trem: [30, 0.7] }),
      shot: () => {
        whoosh({ f: 250, f2: 1800, dur: 0.3, vol: 0.28 });
        noise({ type: 'highpass', f: 5000, dur: 0.9, vol: 0.08, trem: [35, 0.7], at: 0.1 });
      },
      // explosão grande, com estalos
      shotHit: () => {
        kick({ f: 80, f2: 22, dur: 0.8, vol: 1 });
        noise({ type: 'lowpass', f: 3500, f2: 100, dur: 1, vol: 0.7, dist: 3, wet: 0.4 });
        for (let i = 0; i < 8; i++) noise({ type: 'highpass', f: 2500, dur: 0.04, vol: 0.2, at: rnd(0.05, 0.4) });
      },
      hurt: () => voice({ f: 140, f2: 105, dur: 0.2, vowel: 'u', vol: 0.18 }),
      koVoice: () => voice({ f: 150, f2: 60, dur: 1.2, vowel: 'o', vol: 0.2, vib: [5, 20] }),
      jump: () => { whoosh({ f: 300, f2: 1600, dur: 0.18, vol: 0.2 }); voice({ f: 130, dur: 0.1, vowel: 'u', vol: 0.12 }); },
    },
    // ciborgue patriota: pistola de laser, canhão carregando e servos metálicos
    bolsotron: {
      // "piu!" do laser
      a1: () => {
        osc({ type: 'square', f: 1800, f2: 300, dur: 0.14, vol: 0.1 });
        noise({ type: 'highpass', f: 3000, dur: 0.05, vol: 0.2 });
      },
      a1Hit: () => {
        kick({ f: 140, f2: 50, dur: 0.12, vol: 0.5 });
        osc({ type: 'sawtooth', f: 900, f2: 200, dur: 0.1, vol: 0.08 });
      },
      // canhão carregando: zumbido que sobe
      a2: () => osc({ type: 'sawtooth', f: 120, f2: 900, dur: 0.55, vol: 0.07, vib: [20, 30], lp: 2500 }),
      shot: () => {
        osc({ type: 'sawtooth', f: 900, f2: 120, dur: 0.5, vol: 0.12, dist: 3, wet: 0.3 });
        noise({ type: 'bandpass', f: 2000, f2: 600, q: 1, dur: 0.5, vol: 0.3 });
      },
      shotHit: () => {
        kick({ f: 100, f2: 30, dur: 0.45, vol: 0.9 });
        noise({ type: 'lowpass', f: 4000, f2: 300, dur: 0.5, vol: 0.5, dist: 2, wet: 0.3 });
      },
      hurt: () => { voice({ f: 150, f2: 110, dur: 0.2, vowel: 'e', vol: 0.17 }); osc({ type: 'square', f: 600, f2: 200, dur: 0.1, vol: 0.04 }); },
      // desligando: voz e motor caindo juntos
      koVoice: () => {
        voice({ f: 160, f2: 60, dur: 1.1, vowel: 'a', vol: 0.18 });
        osc({ type: 'sawtooth', f: 400, f2: 30, dur: 1.4, vol: 0.06, lp: 1200, at: 0.2 });
      },
      jump: () => { whoosh({ f: 300, f2: 1800, dur: 0.16, vol: 0.18 }); osc({ type: 'square', f: 300, f2: 500, dur: 0.08, vol: 0.04 }); },
    },
    // ciborgue boêmio: garrafada de vidro, jato borbulhante e propulsores no pulo
    luladroid: {
      a1: () => whoosh({ f: 250, f2: 1800, dur: 0.24, vol: 0.3 }),
      // vidro estourando
      a1Hit: () => {
        kick({ f: 120, f2: 40, dur: 0.25, vol: 0.9 });
        for (let i = 0; i < 6; i++) bell({ f: rnd(2500, 5000), dur: 0.15, vol: 0.04, at: rnd(0, 0.12) });
        noise({ type: 'highpass', f: 2500, dur: 0.15, vol: 0.4 });
      },
      // a garrafa sendo sacudida
      a2: () => noise({ type: 'bandpass', f: 900, q: 2, dur: 0.5, vol: 0.2, trem: [14, 0.8] }),
      // jato borbulhando
      shot: () => {
        noise({ type: 'bandpass', f: 600, f2: 1800, q: 1.5, dur: 0.6, vol: 0.35, trem: [25, 0.6] });
        for (let i = 0; i < 6; i++) osc({ type: 'sine', f: rnd(400, 900), f2: rnd(900, 1500), dur: 0.06, vol: 0.05, at: rnd(0, 0.45) });
      },
      shotHit: () => {
        noise({ type: 'lowpass', f: 2000, f2: 300, dur: 0.4, vol: 0.5 });   // "splash"
        kick({ f: 90, f2: 40, dur: 0.3, vol: 0.6 });
      },
      hurt: () => voice({ f: 130, f2: 100, dur: 0.22, vowel: 'o', vol: 0.18 }),
      koVoice: () => voice({ f: 140, f2: 55, dur: 1.3, vowel: 'a', vol: 0.2, vib: [5, 25] }),
      // propulsores
      jump: () => { noise({ type: 'lowpass', f: 1500, f2: 400, dur: 0.3, vol: 0.3 }); voice({ f: 130, dur: 0.1, vowel: 'u', vol: 0.1 }); },
    },
  };

  return {
    play(name, char) {
      if (!enabled) return;
      try {
        ac();
        const key = name + (char || '');
        const now = ctx.currentTime;
        if (last[key] && now - last[key] < (name === 'hurt' ? 0.18 : 0.03)) return;
        last[key] = now;
        const fn = (char && CHAR[char] && CHAR[char][name]) || sounds[name];
        if (fn) fn();
      } catch (e) { /* áudio indisponível */ }
    },
    setEnabled(v) { enabled = v; },
  };
})();
