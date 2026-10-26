// Teclado desenhado na tela + tabela de comandos. Tudo sai de CK.Input.KEYS, então se as teclas
// mudarem a tela acompanha. As teclas acendem quando são apertadas de verdade.
CK.Controls = (() => {
  const ACTIONS = {
    left:  { label: 'andar', icon: '◀' },
    right: { label: 'andar', icon: '▶' },
    up:    { label: 'pular', icon: '▲' },
    a1:    { label: 'rápido', icon: '👊' },
    a2:    { label: 'forte', icon: '💥' },
    block: { label: 'defender', icon: '🛡' },
  };

  // linhas do teclado (códigos de KeyboardEvent.code); null = espaço vazio. O recuo de cada
  // fileira, como num teclado de verdade, fica no CSS (.kb-block.main)
  const MAIN = [
    ['Escape', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
    ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
    ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'],
  ];
  const ARROWS = [[null, 'ArrowUp', null], ['ArrowLeft', 'ArrowDown', 'ArrowRight']];
  const NUMPAD = [['Numpad7', 'Numpad8', 'Numpad9'], ['Numpad4', 'Numpad5', 'Numpad6'], ['Numpad1', 'Numpad2', 'Numpad3']];

  const keyName = (code) => {
    if (code === 'Escape') return 'Esc';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Numpad')) return code.slice(6);
    return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] || code;
  };
  const kbdName = (code) => (code.startsWith('Numpad') ? 'Num ' + code.slice(6) : keyName(code));

  // código da tecla → { player, action }
  function lookup() {
    const map = {};
    CK.Input.KEYS.forEach((keys, p) => {
      for (const [action, codes] of Object.entries(keys)) for (const c of codes) map[c] = { p, action };
    });
    return map;
  }

  function keyHtml(code, map) {
    if (!code) return '<span class="key gap"></span>';
    const m = map[code];
    if (code === 'Escape') return `<span class="key esc" data-code="${code}"><b>Esc</b><small>pausa</small></span>`;
    if (!m) return `<span class="key off" data-code="${code}"><b>${keyName(code)}</b></span>`;
    const a = ACTIONS[m.action];
    return `<span class="key p${m.p + 1}" data-code="${code}" title="Jogador ${m.p + 1}: ${a.label}">
      <b>${keyName(code)}</b><small>${a.icon} ${a.label}</small></span>`;
  }

  const block = (rows, map, cls) =>
    `<div class="kb-block ${cls}">${rows.map((r) => `<div class="kb-row">${r.map((c) => keyHtml(c, map)).join('')}</div>`).join('')}</div>`;

  function keyboardHtml() {
    const map = lookup();
    return `<div class="kb">
      ${block(MAIN, map, 'main')}
      ${block(ARROWS, map, 'arrows')}
      ${block(NUMPAD, map, 'numpad')}
    </div>
    <div class="kb-legend"><span class="dot p1"></span> Jogador 1 <span class="dot p2"></span> Jogador 2
      <em>· aperte as teclas para testar</em></div>`;
  }

  // uma linha por comando; "pad" = controle de videogame
  const ROWS = [
    { name: 'Andar', acts: ['left', 'right'], pad: 'Direcional / analógico', tip: 'Para trás você anda mais devagar.' },
    { name: 'Pular', acts: ['up'], pad: 'A', tip: 'Pule por cima dos especiais que vêm pelo chão.' },
    { name: 'Ataque rápido', acts: ['a1'], pad: 'X', tip: 'Golpe de perto que sai na hora. Funciona no ar.' },
    { name: 'Ataque forte', acts: ['a2'], pad: 'Y / B', tip: 'O especial do personagem. Só um por vez na arena.' },
    { name: 'Defender', acts: ['block'], pad: 'LB / RB / ↓', tip: 'Segure de frente para o golpe: leva pouco dano, mas a guarda quebra se abusar.' },
  ];

  function tableHtml() {
    const keys = CK.Input.KEYS;
    const cell = (p, acts) => acts.flatMap((a) => keys[p][a]).map((c) => `<kbd>${kbdName(c)}</kbd>`).join(' ');
    return `<table class="ctrl-table">
      <thead><tr><th>Comando</th><th class="p1">Jogador 1</th><th class="p2">Jogador 2</th><th>Controle</th><th>Dica</th></tr></thead>
      <tbody>${ROWS.map((r) => `<tr>
        <td><span class="ico">${ACTIONS[r.acts[0]].icon}</span> ${r.name}</td>
        <td>${cell(0, r.acts)}</td><td>${cell(1, r.acts)}</td>
        <td>${r.pad}</td><td class="tip">${r.tip}</td></tr>`).join('')}
        <tr><td><span class="ico">⏸</span> Pausar</td><td colspan="2"><kbd>Esc</kbd></td><td>—</td><td class="tip">Contra a CPU vale qualquer um dos dois lados do teclado.</td></tr>
      </tbody></table>`;
  }

  // acende as teclas apertadas em todos os teclados da página
  const light = (code, on) => {
    document.querySelectorAll(`.kb [data-code="${code}"]`).forEach((el) => el.classList.toggle('down', on));
  };
  addEventListener('keydown', (e) => light(e.code, true));
  addEventListener('keyup', (e) => light(e.code, false));
  addEventListener('blur', () => document.querySelectorAll('.kb .down').forEach((el) => el.classList.remove('down')));

  return {
    // preenche um container com o teclado (e a tabela, se table = true)
    render(el, { table = true } = {}) {
      el.innerHTML = keyboardHtml() + (table ? tableHtml() : '');
    },
  };
})();
