// Partículas de impacto, explosões, poeira e tremor de tela.
CK.Effects = (() => {
  let parts = [];
  let shake = 0;

  const rand = (a, b) => a + Math.random() * (b - a);

  function add(p) {
    p.life = p.max = p.max || 0.4;
    parts.push(p);
  }

  return {
    get shake() { return shake; },
    addShake(v) { shake = Math.max(shake, v); },
    clear() { parts = []; shake = 0; },

    hit(x, y, color, heavy) {
      const n = heavy ? 22 : 12;
      add({ type: 'flash', x, y, size: heavy ? 120 : 70, max: 0.12 });
      add({ type: 'ring', x, y, size: heavy ? 110 : 60, color: '#fff', max: 0.25 });
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(300, heavy ? 1100 : 750);
        add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: i % 3 ? color : '#fff', size: rand(3, 7), max: rand(0.2, 0.45) });
      }
      add({ type: 'text', x, y: y - 40, vy: -120, text: heavy ? 'POW!' : 'PÁ!', color, size: heavy ? 64 : 42, max: 0.55 });
    },

    // golpe defendido: faíscas batendo no escudo
    block(x, y, color) {
      add({ type: 'ring', x, y, size: 70, color, max: 0.25 });
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(200, 500);
        add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: i % 2 ? color : '#fff', size: rand(2, 5), max: rand(0.15, 0.3) });
      }
      add({ type: 'text', x, y: y - 40, vy: -120, text: 'DEFENDEU!', color: '#fff', size: 34, max: 0.5 });
    },

    // texto solto subindo (ex.: vida recuperada)
    label(x, y, text, color) {
      add({ type: 'text', x, y, vy: -90, text, color, size: 40, max: 0.9 });
    },

    explosion(x, y) {
      add({ type: 'flash', x, y, size: 170, max: 0.16 });
      add({ type: 'ring', x, y, size: 160, color: '#ffd24a', max: 0.35 });
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(150, 700);
        add({ type: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, size: rand(14, 34), max: rand(0.35, 0.7) });
      }
      for (let i = 0; i < 10; i++) {
        add({ type: 'smoke', x: x + rand(-40, 40), y: y + rand(-30, 30), vx: rand(-60, 60), vy: rand(-140, -40), size: rand(30, 60), max: rand(0.8, 1.3) });
      }
    },

    // variante elétrica (azul) da explosão e do rastro, para projéteis de energia
    energyBurst(x, y, color) {
      add({ type: 'flash', x, y, size: 160, max: 0.16 });
      add({ type: 'ring', x, y, size: 150, color, max: 0.35 });
      add({ type: 'ring', x, y, size: 90, color: '#fff', max: 0.25 });
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(250, 900);
        add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: i % 3 ? color : '#fff', size: rand(3, 8), max: rand(0.25, 0.5) });
      }
    },

    energyTrail(x, y, color) {
      add({ type: 'spark', x: x + rand(-20, 20), y: y + rand(-30, 30), vx: rand(-80, 80), vy: rand(-80, 80), color, size: rand(2, 5), max: rand(0.15, 0.3) });
    },

    trail(x, y) {
      add({ type: 'smoke', x, y: y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-40, -10), size: rand(10, 20), max: rand(0.4, 0.7) });
    },

    dust(x, y, n = 8) {
      for (let i = 0; i < n; i++) {
        add({ type: 'smoke', x: x + rand(-40, 40), y: y - 6, vx: rand(-160, 160), vy: rand(-80, -10), size: rand(10, 22), max: rand(0.35, 0.6), dust: true });
      }
    },

    update(dt) {
      shake *= 0.86;
      if (shake < 0.3) shake = 0;
      for (const p of parts) {
        p.life -= dt;
        if (p.vx !== undefined) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.type === 'spark' || p.type === 'fire') { p.vx *= 0.9; p.vy = p.vy * 0.9 + 900 * dt; }
          if (p.type === 'smoke') { p.vx *= 0.96; }
        } else if (p.vy !== undefined) {
          p.y += p.vy * dt;
        }
      }
      parts = parts.filter((p) => p.life > 0);
    },

    draw(ctx) {
      for (const p of parts) {
        const k = p.life / p.max;      // 1 → 0
        ctx.save();
        switch (p.type) {
          case 'flash': {
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            g.addColorStop(0, `rgba(255,255,230,${k})`);
            g.addColorStop(1, 'rgba(255,200,80,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'ring':
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = k;
            ctx.lineWidth = 8 * k + 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1.2 - k), 0, Math.PI * 2);
            ctx.stroke();
            break;
          case 'spark':
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = Math.min(1, k * 1.5);
            ctx.lineWidth = p.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
            break;
          case 'fire': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = k;
            ctx.fillStyle = k > 0.6 ? '#fff3a0' : k > 0.3 ? '#ff9a2a' : '#c23a1a';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'smoke':
            ctx.globalAlpha = k * (p.dust ? 0.45 : 0.5);
            ctx.fillStyle = p.dust ? '#c9b597' : '#555';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'text':
            ctx.globalAlpha = Math.min(1, k * 2);
            ctx.font = `${p.size * (1 + (1 - k) * 0.3)}px Bangers, Impact, sans-serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#1a0a14';
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
            break;
        }
        ctx.restore();
      }
    },
  };
})();
