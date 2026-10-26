// Arena: arte da fachada da Faceponto/RoboEduc, cobrindo a janela inteira (recorta o que sobrar).
CK.Stage = (() => {
  const SRC = 'assets/stage/faceponto.jpg';
  let bg = null;

  // monta o fundo no tamanho do canvas (CK.view), em modo "cover" ancorado embaixo
  function build(img, v) {
    const c = document.createElement('canvas');
    c.width = v.w;
    c.height = v.h;
    const g = c.getContext('2d');
    const s = Math.max(v.w / img.naturalWidth, v.h / img.naturalHeight);
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    // base da imagem alinhada à base da arena, para o chão continuar no asfalto
    const y = Math.min(0, Math.max(v.h - ih, v.oy + CK.H - ih));
    g.drawImage(img, (v.w - iw) / 2, y, iw, ih);

    // escurece a rua para os lutadores destacarem
    let gr = g.createLinearGradient(0, v.oy + 520, 0, v.h);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = gr;
    g.fillRect(0, v.oy + 520, v.w, v.h - v.oy - 520);

    // vinheta
    const cx = v.w / 2, cy = v.h / 2, r = Math.hypot(cx, cy);
    gr = g.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = gr;
    g.fillRect(0, 0, v.w, v.h);
    return c;
  }

  return {
    SRC,
    draw(ctx) {
      const v = CK.view;
      const img = CK.images[SRC];
      if ((!bg || bg.width !== v.w || bg.height !== v.h) && img && img.complete && img.naturalWidth) bg = build(img, v);
      if (bg) ctx.drawImage(bg, -v.ox, -v.oy);
      else {
        ctx.fillStyle = '#6fa6dc';
        ctx.fillRect(-v.ox, -v.oy, v.w, v.h);
      }
    },
  };
})();
