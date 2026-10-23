// Arena desenhada proceduralmente: céu de pôr do sol, montanhas, cidade, piso e tochas.
CK.Stage = (() => {
  let bg = null;
  const TORCHES = [110, 1170];

  function build() {
    const c = document.createElement('canvas');
    c.width = CK.W;
    c.height = CK.H;
    const g = c.getContext('2d');
    const horizon = 470;

    // céu
    let gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, '#1b0b33');
    gr.addColorStop(0.45, '#5a1c56');
    gr.addColorStop(0.8, '#d4523f');
    gr.addColorStop(1, '#ffb050');
    g.fillStyle = gr;
    g.fillRect(0, 0, CK.W, horizon);

    // estrelas
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 70; i++) {
      const x = (i * 197) % CK.W, y = (i * 83) % 200;
      g.fillRect(x, y, i % 5 ? 1.5 : 2.5, i % 5 ? 1.5 : 2.5);
    }

    // sol com listras
    g.save();
    g.beginPath();
    g.arc(640, 400, 170, 0, Math.PI * 2);
    g.clip();
    gr = g.createLinearGradient(0, 230, 0, 570);
    gr.addColorStop(0, '#fff07a');
    gr.addColorStop(1, '#ff5a3c');
    g.fillStyle = gr;
    g.fillRect(470, 230, 340, 340);
    g.fillStyle = '#d4523f';
    for (let i = 0; i < 7; i++) g.fillRect(470, 360 + i * 18, 340, 3 + i * 1.5);
    g.restore();

    // montanhas
    const ridge = (color, base, amp, seed) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, horizon);
      for (let x = 0; x <= CK.W; x += 20) {
        const y = base - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + seed) * Math.cos(x * 0.013 + seed * 2));
        g.lineTo(x, y);
      }
      g.lineTo(CK.W, horizon);
      g.fill();
    };
    ridge('#7a2f5a', 440, 160, 1);
    ridge('#4b1d45', 470, 120, 4);

    // silhueta da cidade
    g.fillStyle = '#2a1030';
    let x = 0, i = 0;
    while (x < CK.W) {
      const w = 40 + ((i * 37) % 50);
      const h = 50 + ((i * 53) % 110);
      g.fillRect(x, horizon - h, w, h);
      g.fillStyle = 'rgba(255,200,90,0.55)';
      for (let wy = horizon - h + 10; wy < horizon - 10; wy += 16) {
        for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          if ((wx * 7 + wy * 3 + i) % 5 === 0) g.fillRect(wx, wy, 5, 7);
        }
      }
      g.fillStyle = '#2a1030';
      x += w + 4;
      i++;
    }

    // piso em perspectiva
    gr = g.createLinearGradient(0, horizon, 0, CK.H);
    gr.addColorStop(0, '#5b3a2e');
    gr.addColorStop(0.4, '#7c5039');
    gr.addColorStop(1, '#3b2219');
    g.fillStyle = gr;
    g.fillRect(0, horizon, CK.W, CK.H - horizon);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let k = -14; k <= 14; k++) {
      g.beginPath();
      g.moveTo(640 + k * 30, horizon);
      g.lineTo(640 + k * 140, CK.H);
      g.stroke();
    }
    for (let k = 1; k < 9; k++) {
      const y = horizon + Math.pow(k / 9, 1.8) * (CK.H - horizon);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(CK.W, y);
      g.stroke();
    }
    // brilho do sol no piso
    gr = g.createRadialGradient(640, horizon, 10, 640, horizon, 520);
    gr.addColorStop(0, 'rgba(255,170,80,0.45)');
    gr.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = gr;
    g.fillRect(0, horizon, CK.W, CK.H - horizon);
    // borda do horizonte
    g.fillStyle = '#2a1424';
    g.fillRect(0, horizon - 2, CK.W, 6);

    // pilares das tochas
    for (const tx of TORCHES) {
      gr = g.createLinearGradient(tx - 24, 0, tx + 24, 0);
      gr.addColorStop(0, '#3a2a2a');
      gr.addColorStop(0.5, '#7a6458');
      gr.addColorStop(1, '#3a2a2a');
      g.fillStyle = gr;
      g.fillRect(tx - 22, 330, 44, 330);
      g.fillStyle = '#2a1c1c';
      g.fillRect(tx - 34, 318, 68, 18);
      g.fillRect(tx - 30, 640, 60, 20);
    }

    // vinheta
    gr = g.createRadialGradient(640, 380, 300, 640, 380, 820);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = gr;
    g.fillRect(0, 0, CK.W, CK.H);
    return c;
  }

  function flame(ctx, x, y, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(x, y, 5, x, y, 140);
    glow.addColorStop(0, 'rgba(255,170,60,0.45)');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 140, y - 140, 280, 280);
    for (let i = 0; i < 3; i++) {
      const f = Math.sin(t * (9 + i * 3) + i * 2) * 4;
      const h = 46 - i * 12 + Math.sin(t * 13 + i) * 6;
      ctx.fillStyle = ['#ff5a1a', '#ffa22a', '#fff2a0'][i];
      ctx.beginPath();
      ctx.moveTo(x - 16 + i * 5, y);
      ctx.quadraticCurveTo(x - 14 + i * 4 + f, y - h * 0.6, x + f, y - h);
      ctx.quadraticCurveTo(x + 14 - i * 4 + f, y - h * 0.6, x + 16 - i * 5, y);
      ctx.fill();
    }
    ctx.restore();
  }

  return {
    draw(ctx, time) {
      if (!bg) bg = build();
      ctx.drawImage(bg, 0, 0);
      for (const tx of TORCHES) flame(ctx, tx, 318, time + tx);
    },
  };
})();
