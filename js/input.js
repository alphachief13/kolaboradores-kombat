// Teclado + Gamepad API. Cada jogador vira um estado simples por tick:
// { left, right, up, a1, a2, block } (segurando) e { upP, a1P, a2P, blockP, leftP, rightP } (apertou agora).
// O mouse é do jogador 1: botão esquerdo = ataque rápido, botão direito = ataque forte (à distância).
CK.Input = (() => {
  const KEYS = [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], a1: ['KeyF'], a2: ['KeyG'], block: ['KeyS', 'KeyH'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], a1: ['KeyK', 'Numpad1'], a2: ['KeyL', 'Numpad2'], block: ['ArrowDown', 'Numpad3'] },
  ];
  const ACTIONS = ['left', 'right', 'up', 'a1', 'a2', 'block'];
  const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

  const held = new Set();
  const pressed = new Set();
  const padPrev = [{}, {}];

  addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  // cliques do mouse na luta (botão 0 = esquerdo, 2 = direito)
  const mouse = { a1: false, a2: false };
  const inFight = (e) => CK.App && CK.App.screen === 'fight' && !e.target.closest('button');
  addEventListener('mousedown', (e) => {
    if (!inFight(e)) return;
    if (e.button === 0) mouse.a1 = true;
    else if (e.button === 2) mouse.a2 = true;
  });
  addEventListener('contextmenu', (e) => { if (inFight(e)) e.preventDefault(); });

  function readPad(i) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[i];
    if (!p) return {};
    const b = (n) => !!(p.buttons[n] && p.buttons[n].pressed);
    const ax = p.axes[0] || 0;
    return {
      left: b(14) || ax < -0.4,
      right: b(15) || ax > 0.4,
      up: b(0) || b(12) || (p.axes[1] || 0) < -0.6,
      a1: b(2),
      a2: b(3) || b(1),
      block: b(4) || b(5) || b(13) || (p.axes[1] || 0) > 0.6,   // LB, RB ou baixo
    };
  }

  let state = [{}, {}];

  return {
    KEYS,   // mapeamento de teclas por jogador (a tela de controles desenha a partir dele)
    // chamado uma vez por tick lógico
    poll() {
      state = KEYS.map((map, i) => {
        const pad = readPad(i);
        const s = {};
        for (const a of ACTIONS) {
          s[a] = map[a].some((k) => held.has(k)) || !!pad[a];
          s[a + 'P'] = map[a].some((k) => pressed.has(k)) || (!!pad[a] && !padPrev[i][a]);
        }
        padPrev[i] = pad;
        return s;
      });
      if (mouse.a1) state[0].a1P = true;
      if (mouse.a2) state[0].a2P = true;
      mouse.a1 = mouse.a2 = false;
      pressed.clear();
      return state;
    },
    get(i) { return state[i]; },
    // junta os dois esquemas de controle (modo contra o computador: o jogador usa qualquer um)
    merge(a, b) {
      const s = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) s[k] = a[k] || b[k];
      return s;
    },
    clear() { pressed.clear(); mouse.a1 = mouse.a2 = false; },
  };
})();
