// Teclado + Gamepad API. Cada jogador vira um estado simples por tick:
// { left, right, up, a1, a2 } (segurando) e { upP, a1P, a2P, leftP, rightP } (apertou agora).
CK.Input = (() => {
  const KEYS = [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], a1: ['KeyF'], a2: ['KeyG'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], a1: ['KeyK', 'Numpad1'], a2: ['KeyL', 'Numpad2'] },
  ];
  const ACTIONS = ['left', 'right', 'up', 'a1', 'a2'];
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
    };
  }

  let state = [{}, {}];

  return {
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
      pressed.clear();
      return state;
    },
    get(i) { return state[i]; },
    clear() { pressed.clear(); },
  };
})();
