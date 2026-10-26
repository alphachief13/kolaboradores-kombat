// Telas (menu, seleção, configurações), HUD e laço principal.
(() => {
  const $ = (s) => document.querySelector(s);
  const wrap = $('#wrap');
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');

  // ---------- configurações ----------
  const settings = { roundTime: 99, sound: true, showBoxes: false, difficulty: 'normal' };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('ck-settings') || '{}')); } catch (e) { /* sem storage */ }
  const saveSettings = () => {
    try { localStorage.setItem('ck-settings', JSON.stringify(settings)); } catch (e) { /* sem storage */ }
    CK.Sfx.setEnabled(settings.sound);
  };
  CK.Sfx.setEnabled(settings.sound);
  $('#opt-time').value = String(settings.roundTime);
  $('#opt-diff').value = settings.difficulty;
  $('#opt-sound').checked = settings.sound;
  $('#opt-boxes').checked = settings.showBoxes;
  $('#opt-time').onchange = (e) => { settings.roundTime = +e.target.value; saveSettings(); };
  $('#opt-diff').onchange = (e) => { settings.difficulty = e.target.value; saveSettings(); };
  $('#opt-sound').onchange = (e) => { settings.sound = e.target.checked; saveSettings(); };
  $('#opt-boxes').onchange = (e) => { settings.showBoxes = e.target.checked; saveSettings(); };

  // ---------- telas ----------
  let screen = 'loading';
  let game = null;          // partida em andamento
  let demo = null;          // lutadores parados atrás do menu
  let picks = ['soldado', 'bonezinho'];
  let mode = 'pvp';         // 'cpu': jogador 2 é o computador
  const SELECT_HINT = {
    pvp: $('#select-hint').innerHTML,
    cpu: 'Escolha seu lutador e depois o da CPU: <kbd>A</kbd>/<kbd>D</kbd> ou <kbd>←</kbd>/<kbd>→</kbd> escolhe, <kbd>F</kbd>/<kbd>K</kbd> confirma, <kbd>G</kbd>/<kbd>L</kbd> desfaz · <kbd>Esc</kbd> volta · ou clique no retrato',
  };
  const RESULT_HINT = {
    pvp: $('#result-hint').innerHTML,
    cpu: 'Revanche? Aperte seu ataque rápido (<kbd>F</kbd> / <kbd>K</kbd>) ou clique.',
  };

  function show(name) {
    screen = name;
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('hidden', el.id !== 'screen-' + name));
    const inGame = ['fight', 'pause', 'result'].includes(name);
    $('#hud').classList.toggle('hidden', !inGame);
    if (!inGame) $('#announce').className = '';
    const first = document.querySelector(`#screen-${name} button`);
    if (first && name !== 'select') first.focus({ preventScroll: true });
  }

  function startFight() {
    CK.Input.clear();
    const cpu = mode === 'cpu';
    game = CK.current = new CK.Game(picks[0], picks[1], settings, false, cpu ? settings.difficulty : null);
    ['p1', 'p2'].forEach((p, i) => { $(`#hud .${p} .bar-name`).textContent = CK.CHARACTERS[picks[i]].name; });
    if (cpu) $('#hud .p2 .bar-name').textContent += ` · CPU ${CK.BOT_LEVELS[settings.difficulty].name}`;
    $('#result-hint').innerHTML = RESULT_HINT[mode];
    show('fight');
  }

  function toMenu() {
    game = null;
    show('menu');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    CK.Sfx.play('move');
    switch (btn.dataset.action) {
      case 'play-cpu': mode = 'cpu'; openSelect(); break;
      case 'play-pvp': mode = 'pvp'; openSelect(); break;
      case 'controls': show('controls'); break;
      case 'settings': show('settings'); break;
      case 'back': show('menu'); break;
      case 'resume': show('fight'); break;
      case 'menu': toMenu(); break;
      case 'select': game = null; openSelect(); break;
      case 'rematch-p1': game && game.acceptRematch(0); break;
      case 'rematch-p2': game && game.acceptRematch(1); break;
    }
  });

  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (screen === 'fight') show('pause');
    else if (screen === 'pause') show('fight');
    else if (screen === 'select') selectBack();
    else if (['controls', 'settings'].includes(screen)) show('menu');
  });

  // ---------- seleção de personagem ----------
  const sel = { idx: [0, 1], ok: [false, false] };
  const frameSrc = (id, anim, n) => window.FRAMES[id][anim][n].src;

  // enquadra o retrato: escala a caixa da cabeça (pré-calculada em tools/slice_sprites.py)
  // para caber no card e centraliza nela
  function framePortrait(img, fr) {
    const [x0, x1, y0] = fr.head;
    const TILE_W = 150, TILE_H = 176;                // área interna do card
    const scale = Math.min(TILE_W * 1.02 / (x1 - x0), TILE_H * 1.5 / fr.h);
    const cx = (x0 + x1) / 2;
    img.style.height = `calc(var(--u) * ${fr.h * scale})`;
    img.style.left = `calc(50% - var(--u) * ${cx * scale})`;
    img.style.top = `calc(var(--u) * ${8 - y0 * scale})`;
  }

  // grade estilo Mortal Kombat: retratos com o emblema no meio
  function buildCards() {
    const box = $('#cards');
    box.innerHTML = '';
    const tiles = CK.CHAR_IDS.map((id, i) => {
      const c = CK.CHARACTERS[id];
      const card = document.createElement('div');
      card.className = 'card';
      card.style.setProperty('--accent', c.color);
      card.innerHTML = `<img src="${frameSrc(id, 'idle', 0)}" alt="${c.name}">
        <span class="tag p1">1P</span><span class="tag p2">2P</span>`;
      framePortrait(card.querySelector('img'), window.FRAMES[id].idle[0]);
      card.onclick = () => {
        const p = !sel.ok[0] ? 0 : !sel.ok[1] ? 1 : -1;
        if (p < 0) return;
        sel.idx[p] = i;
        confirmPick(p);
      };
      return card;
    });
    const emblem = document.createElement('div');
    emblem.className = 'emblem';
    emblem.innerHTML = '<span>KK</span>';
    tiles.splice(Math.floor(tiles.length / 2), 0, emblem);
    tiles.forEach((t) => box.appendChild(t));
  }

  // lutador de corpo inteiro ao lado da grade, ancorado pelos pés
  function drawSide(p, now) {
    const id = CK.CHAR_IDS[sel.idx[p]];
    const c = CK.CHARACTERS[id];
    const seq = sel.ok[p] ? c.taunt : c.idle;
    const f = window.FRAMES[id].idle[seq[Math.floor(now / 450) % seq.length]];
    const img = document.querySelector(`#side-p${p + 1} .mk-fig img`);
    if (img.dataset.src !== f.src) {
      img.dataset.src = f.src;
      img.src = f.src;
      img.style.width = `calc(var(--u) * ${f.w * 1.1})`;
      img.style.left = `calc(50% - var(--u) * ${f.ax * 1.1})`;
      img.style.bottom = `calc(var(--u) * ${(f.ay - f.h) * 1.1})`;
    }
  }

  function openSelect() {
    sel.ok = [false, false];
    sel.idx = [CK.CHAR_IDS.indexOf(picks[0]), CK.CHAR_IDS.indexOf(picks[1])];
    document.querySelectorAll('#cards .tag.p2').forEach((t) => { t.textContent = mode === 'cpu' ? 'CPU' : '2P'; });
    $('#select-hint').innerHTML = SELECT_HINT[mode];
    CK.Input.clear();
    show('select');
    renderSelect();
  }

  function selectBack() {
    if (sel.ok[1]) sel.ok[1] = false;
    else if (sel.ok[0]) sel.ok[0] = false;
    else return show('menu');
    renderSelect();
  }

  function confirmPick(p) {
    if (sel.ok[p]) return;
    sel.ok[p] = true;
    CK.Sfx.play('confirm');
    renderSelect();
    if (sel.ok[0] && sel.ok[1]) {
      picks = sel.idx.map((i) => CK.CHAR_IDS[i]);
      setTimeout(() => { if (screen === 'select' && sel.ok[0] && sel.ok[1]) startFight(); }, 900);
    }
  }

  function renderSelect() {
    document.querySelectorAll('#cards .card').forEach((card, i) => {
      card.classList.toggle('sel-p1', sel.idx[0] === i);
      card.classList.toggle('sel-p2', sel.idx[1] === i);
      card.classList.toggle('ok-p1', sel.ok[0] && sel.idx[0] === i);
      card.classList.toggle('ok-p2', sel.ok[1] && sel.idx[1] === i);
    });
    [0, 1].forEach((p) => {
      const c = CK.CHARACTERS[CK.CHAR_IDS[sel.idx[p]]];
      const a1 = c.attacks.attack1, a2 = c.attacks.attack2;
      const side = $(`#side-p${p + 1}`);
      side.classList.toggle('ok', sel.ok[p]);
      side.style.setProperty('--accent', c.color);
      side.querySelector('.mk-plate').innerHTML = `
        <h3>${c.name}</h3>
        <div class="theme">${c.theme}</div>
        <div class="move"><b>Rápido</b> ${a1.name}</div>
        <div class="move"><b>Forte</b> ${a2.name}</div>`;
      drawSide(p, Date.now());
      const label = mode === 'cpu' && p === 1 ? 'CPU' : `J${p + 1}`;
      $(`#st-p${p + 1}`).innerHTML = `<b>${label}</b> ${sel.ok[p] ? '<em>PRONTO ✓</em>' : '<i>escolhendo…</i>'}`;
    });
  }

  function stepPick(p, inp) {
    const n = CK.CHAR_IDS.length;
    if (inp.leftP || inp.rightP) {
      sel.idx[p] = (sel.idx[p] + (inp.rightP ? 1 : n - 1)) % n;
      CK.Sfx.play('move');
      renderSelect();
    }
    if (inp.a1P) confirmPick(p);
  }

  function selectTick(inputs) {
    if (mode === 'cpu') {
      // um jogador escolhe os dois: primeiro o seu, depois o da CPU
      const inp = CK.Input.merge(inputs[0], inputs[1]);
      if (inp.a2P && sel.ok[0]) { sel.ok[sel.ok[1] ? 1 : 0] = false; renderSelect(); }
      else if (!sel.ok[1]) stepPick(sel.ok[0] ? 1 : 0, inp);
      return;
    }
    inputs.forEach((inp, p) => {
      if (sel.ok[p]) {
        if (inp.a2P) { sel.ok[p] = false; renderSelect(); }
        return;
      }
      stepPick(p, inp);
    });
  }

  // anima os lutadores ao lado da grade
  setInterval(() => {
    if (screen !== 'select') return;
    const now = Date.now();
    drawSide(0, now);
    drawSide(1, now);
  }, 150);

  // ---------- HUD ----------
  const announce = $('#announce');
  CK.UI = {
    announce(text, cls) {
      announce.textContent = text;
      announce.className = '';
      void announce.offsetWidth;   // reinicia a animação CSS
      announce.className = 'show ' + cls;
    },
    updateHud(g) {
      g.fighters.forEach((f, i) => {
        const box = document.querySelector(`#hud .p${i + 1}`);
        box.querySelector('.bar-fill').style.width = (f.hp / CK.MAX_HP) * 100 + '%';
        box.querySelector('.bar-trail').style.width = (f.trailHp / CK.MAX_HP) * 100 + '%';
        box.classList.toggle('low', f.hp <= 25);
      });
      $('#timer').textContent = g.settings.roundTime ? g.time : '∞';
    },
    showResult(title, winnerIdx) {
      $('#result-title').textContent = title;
      $('#result-title').className = winnerIdx >= 0 ? 'p' + (winnerIdx + 1) : '';
      CK.UI.updateRematch([false, false]);
      show('result');
    },
    hideResult() {
      if (screen === 'result') show('fight');
    },
    updateRematch(r) {
      ['p1', 'p2'].forEach((p, i) => {
        const b = document.querySelector(`#screen-result button.${p}`);
        b.classList.toggle('ok', r[i]);
        const label = mode === 'cpu' && i === 1 ? 'CPU' : `J${i + 1}`;
        b.textContent = `${label}: ${r[i] ? 'pronto ✓' : 'aceitar'}`;
      });
    },
  };

  // ---------- escala responsiva ----------
  function resize() {
    const w = Math.min(innerWidth, (innerHeight * 16) / 9);
    wrap.style.width = w + 'px';
    wrap.style.height = (w * 9) / 16 + 'px';
    wrap.style.setProperty('--u', w / 1280 + 'px');
    // canvas na proporção da janela, em unidades do jogo; a arena 1280x720 fica no centro
    const s = w / CK.W;
    canvas.width = Math.round(innerWidth / s);
    canvas.height = Math.round(innerHeight / s);
    CK.view = { ox: (canvas.width - CK.W) / 2, oy: (canvas.height - CK.H) / 2, w: canvas.width, h: canvas.height };
  }
  addEventListener('resize', resize);
  resize();

  // ---------- laço principal ----------
  let last = performance.now();
  let acc = 0;

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (screen !== 'loading') {
      const active = game && screen !== 'pause' ? game : null;
      acc += dt * (active && active.slowmo > 0 ? 0.35 : 1);
      while (acc >= CK.DT) {
        acc -= CK.DT;
        const inputs = CK.Input.poll();
        if (active) active.tick(inputs);
        else if (!game) demo.tick(inputs);
        if (screen === 'select') selectTick(inputs);
      }
      const g = game || demo;
      ctx.setTransform(1, 0, 0, 1, CK.view.ox, CK.view.oy);
      g.draw(ctx, now / 1000);
      if (game) CK.UI.updateHud(game);
    }
    requestAnimationFrame(loop);
  }

  // ---------- carregamento ----------
  function preload() {
    const srcs = [];
    for (const id of Object.keys(window.FRAMES)) {
      for (const anim of Object.values(window.FRAMES[id])) for (const f of anim) srcs.push(f.src);
    }
    for (const fx of Object.values(window.FX)) srcs.push(fx.src);
    srcs.push(CK.Stage.SRC);
    let done = 0;
    return Promise.all(srcs.map((src) => new Promise((res) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        done++;
        $('#load-pct').textContent = Math.round((done / srcs.length) * 100) + '%';
        res();
      };
      img.src = src;
      CK.images[src] = img;
    })));
  }

  preload().then(() => {
    buildCards();
    demo = new CK.Game('soldado', 'bonezinho', settings, true);
    show('menu');
  });
  requestAnimationFrame(loop);
})();
