// Telas (menu, seleção, configurações), HUD e laço principal.
(() => {
  const $ = (s) => document.querySelector(s);
  const wrap = $('#wrap');
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');

  // ---------- configurações ----------
  // showIntro/introCount: controles na tela antes das primeiras lutas (ver INTRO_TIMES)
  const settings = { roundTime: 99, sound: true, showBoxes: false, difficulty: 'normal', showIntro: true, introCount: 0 };
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
  // religar pelas configurações mostra de novo nas próximas lutas
  $('#opt-intro').checked = settings.showIntro;
  $('#opt-intro').onchange = (e) => { settings.showIntro = e.target.checked; settings.introCount = 0; saveSettings(); };

  // ---------- telas ----------
  let screen = 'loading';
  let game = null;          // partida em andamento
  let demo = null;          // lutadores parados atrás do menu
  let picks = ['soldado', 'bonezinho'];
  let mode = 'pvp';         // 'cpu': jogador 2 é o computador · 'net': partida em rede (ver online.js)
  const SELECT_HINT = {
    pvp: $('#select-hint').innerHTML,
    net: 'Escolha com <kbd>A</kbd>/<kbd>D</kbd> ou <kbd>←</kbd>/<kbd>→</kbd>, confirme com <kbd>F</kbd>/<kbd>K</kbd>, desfaça com <kbd>G</kbd>/<kbd>L</kbd> · ou clique no retrato',
    watch: 'Assistindo: os jogadores estão escolhendo seus lutadores.',
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
    CK.Online.onShow(name);
  }

  function startFight() {
    CK.Input.clear();
    if (mode === 'net') mode = 'pvp';
    const cpu = mode === 'cpu';
    game = CK.current = new CK.Game(picks[0], picks[1], settings, false, cpu ? settings.difficulty : null);
    ['p1', 'p2'].forEach((p, i) => { $(`#hud .${p} .bar-name`).textContent = CK.CHARACTERS[picks[i]].name; });
    if (cpu) $('#hud .p2 .bar-name').textContent += ` · CPU ${CK.BOT_LEVELS[settings.difficulty].name}`;
    $('#result-hint').innerHTML = RESULT_HINT[mode];
    show('fight');
    if (settings.showIntro && settings.introCount < INTRO_TIMES) {
      settings.introCount++;
      saveSettings();
      game.startIntro(INTRO_TICKS);
    }
  }

  // ---------- controles antes da luta ----------
  const INTRO_TIMES = 3;        // quantas lutas mostram os controles antes de começar
  const INTRO_TICKS = 6 * 60;   // duração da contagem (6 s)

  function updatePrefight() {
    const on = !!game && game.phase === 'intro' && screen === 'fight';
    $('#prefight').classList.toggle('hidden', !on);
    if (!on) return;
    const n = String(Math.max(1, Math.ceil((game.introLen - game.phaseT) / 60)));
    const el = $('#prefight-n');
    if (el.textContent !== n) {
      el.textContent = n;
      el.classList.remove('tick');
      void el.offsetWidth;     // reinicia a animação
      el.classList.add('tick');
      CK.Sfx.play('move');
    }
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
      case 'play-net': show('net'); CK.Online.open(); break;
      case 'controls': show('controls'); break;
      case 'intro-go': if (game) game.skipIntro(); break;
      case 'intro-never':
        settings.showIntro = false;
        $('#opt-intro').checked = false;
        saveSettings();
        if (game) game.skipIntro();
        break;
      case 'settings': show('settings'); break;
      case 'back': show('menu'); break;
      case 'resume': show('fight'); break;
      case 'menu': toMenu(); break;
      case 'select': if (mode === 'net') CK.Online.reselect(); else { game = null; openSelect(); } break;
      case 'rematch-p1':
      case 'rematch-p2':
        if (mode === 'net') CK.Online.rematch();
        else if (game) game.acceptRematch(btn.dataset.action === 'rematch-p1' ? 0 : 1);
        break;
    }
  });

  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (screen === 'fight') show('pause');
    else if (screen === 'pause') show('fight');
    else if (screen === 'select') selectBack();
    else if (['controls', 'settings', 'net'].includes(screen)) show('menu');
  });

  // ---------- seleção de personagem ----------
  const sel = { idx: [0, 1], ok: [false, false] };
  const frameSrc = (id, anim, n) => window.FRAMES[id][anim][n].src;

  // enquadra o retrato: escala a caixa da cabeça (pré-calculada em tools/slice_sprites.py)
  // para caber no card e centraliza nela
  function framePortrait(img, fr, TILE_W) {
    const [x0, x1, y0] = fr.head;
    const TILE_H = 176;                              // altura interna do card
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
    // duas linhas: três colunas até 6 personagens, quatro (cards mais estreitos) acima disso
    const cols = CK.CHAR_IDS.length > 6 ? 4 : 3;
    box.classList.toggle('cols4', cols === 4);
    const tiles = CK.CHAR_IDS.map((id, i) => {
      const c = CK.CHARACTERS[id];
      const card = document.createElement('div');
      card.className = 'card';
      card.style.setProperty('--accent', c.color);
      card.innerHTML = `<img src="${frameSrc(id, 'idle', 0)}" alt="${c.name}">
        <span class="tag p1">1P</span><span class="tag p2">2P</span>`;
      framePortrait(card.querySelector('img'), window.FRAMES[id].idle[0], cols === 4 ? 140 : 150);
      card.onclick = () => {
        const p = mode === 'net' ? CK.Online.mySlot : !sel.ok[0] ? 0 : !sel.ok[1] ? 1 : -1;
        if (p < 0 || sel.ok[p]) return;
        sel.idx[p] = i;
        confirmPick(p);
      };
      return card;
    });
    // o emblema preenche as vagas da última linha: no meio, ou dos dois lados de um retrato sozinho
    const emblem = () => {
      const e = document.createElement('div');
      e.className = 'emblem';
      e.innerHTML = '<span>KK</span>';
      return e;
    };
    const rest = tiles.length % cols;
    const pad = (cols - rest) % cols;
    if (rest === 1 && pad === 2) {
      tiles.splice(tiles.length - 1, 0, emblem());
      tiles.push(emblem());
    } else if (pad) {
      tiles.splice(tiles.length - rest + Math.ceil(rest / 2), 0, ...Array.from({ length: pad }, emblem));
    }
    tiles.forEach((t) => box.appendChild(t));
  }

  // lutador de corpo inteiro ao lado da grade, ancorado pelos pés
  const FIG_SCALE = 0.92;   // lutador de corpo inteiro nas laterais (cabe em .mk-fig)
  function drawSide(p, now) {
    const id = CK.CHAR_IDS[sel.idx[p]];
    const c = CK.CHARACTERS[id];
    const seq = sel.ok[p] ? c.taunt : c.idle;
    const f = window.FRAMES[id].idle[seq[Math.floor(now / 450) % seq.length]];
    const img = document.querySelector(`#side-p${p + 1} .mk-fig img`);
    if (img.dataset.src !== f.src) {
      img.dataset.src = f.src;
      img.src = f.src;
      img.style.width = `calc(var(--u) * ${f.w * FIG_SCALE})`;
      img.style.left = `calc(50% - var(--u) * ${f.ax * FIG_SCALE})`;
      img.style.bottom = `calc(var(--u) * ${(f.ay - f.h) * FIG_SCALE})`;
    }
  }

  function openSelect() {
    if (mode === 'net') mode = 'pvp';
    sel.ok = [false, false];
    sel.idx = [CK.CHAR_IDS.indexOf(picks[0]), CK.CHAR_IDS.indexOf(picks[1])];
    document.querySelectorAll('#cards .tag.p2').forEach((t) => { t.textContent = mode === 'cpu' ? 'CPU' : '2P'; });
    $('#select-hint').innerHTML = SELECT_HINT[mode];
    CK.Input.clear();
    show('select');
    renderSelect();
  }

  function selectBack() {
    if (mode === 'net') {
      const p = CK.Online.mySlot;
      if (p >= 0 && sel.ok[p]) { sel.ok[p] = false; picked(p); }
      return;
    }
    if (sel.ok[1]) sel.ok[1] = false;
    else if (sel.ok[0]) sel.ok[0] = false;
    else return show('menu');
    renderSelect();
  }

  // em rede, a própria escolha vai para o anfitrião (que decide quando a luta começa)
  function picked(p) {
    renderSelect();
    if (mode === 'net') CK.Online.pickChanged(sel.idx[p], sel.ok[p]);
  }

  function confirmPick(p) {
    if (sel.ok[p]) return;
    sel.ok[p] = true;
    CK.Sfx.play('confirm');
    picked(p);
    if (mode !== 'net' && sel.ok[0] && sel.ok[1]) {
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
        <div class="theme">${c.theme}${c.role ? ` · ${c.role}` : ''}</div>
        ${statBars(c)}
        <div class="move"><b>Rápido</b> ${a1.name}</div>
        <div class="move"><b>Forte</b> ${a2.name}</div>`;
      drawSide(p, Date.now());
      const label = mode === 'cpu' && p === 1 ? 'CPU' : mode === 'net' ? esc(CK.Online.slotName(p)) : `J${p + 1}`;
      $(`#st-p${p + 1}`).innerHTML = `<b>${label}</b> ${sel.ok[p] ? '<em>PRONTO ✓</em>' : '<i>escolhendo…</i>'}`;
    });
  }

  // barras de atributos; as faixas são fixas para o elenco poder crescer sem recalibrar
  function statBars(c) {
    const st = CK.statsOf(c);
    const total = (a) => (a.projectile
      ? a.projectile.dmg * (a.projectile.shots || [0]).length
      : a.dmg * (a.hits || 1));
    const rows = [
      ['Vida', st.hp, 75, 130],
      ['Força', total(c.attacks.attack1) + total(c.attacks.attack2), 14, 28],
      ['Velocidade', st.walk, 250, 420],
      ['Pulo', st.jump, 950, 1400],
    ];
    return `<div class="stats">${rows.map(([label, v, lo, hi]) => {
      const pct = Math.round(15 + 85 * Math.max(0, Math.min(1, (v - lo) / (hi - lo))));
      return `<div class="stat"><span>${label}</span><i><b style="width:${pct}%"></b></i></div>`;
    }).join('')}</div>`;
  }

  function stepPick(p, inp) {
    const n = CK.CHAR_IDS.length;
    if (inp.leftP || inp.rightP) {
      sel.idx[p] = (sel.idx[p] + (inp.rightP ? 1 : n - 1)) % n;
      CK.Sfx.play('move');
      picked(p);
    }
    if (inp.a1P) confirmPick(p);
  }

  function selectTick(inputs) {
    if (mode === 'net') {
      // cada computador controla só o seu lado, com qualquer um dos dois esquemas de teclas
      const p = CK.Online.mySlot;
      if (p < 0) return;
      const inp = CK.Input.merge(inputs[0], inputs[1]);
      if (sel.ok[p]) {
        if (inp.a2P) { sel.ok[p] = false; picked(p); }
      } else stepPick(p, inp);
      return;
    }
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
        box.querySelector('.bar-fill').style.width = (f.hp / f.maxHp) * 100 + '%';
        box.querySelector('.bar-trail').style.width = (f.trailHp / f.maxHp) * 100 + '%';
        box.classList.toggle('low', f.hp <= f.maxHp * 0.25);
        // energia do ataque forte; acende quando dá para disparar
        box.querySelector('.energy-fill').style.width = (f.energy / CK.ENERGY) * 100 + '%';
        box.classList.toggle('charged', f.energy >= (f.def.attacks.attack2.cost || 0));
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
        const label = mode === 'cpu' && i === 1 ? 'CPU' : mode === 'net' ? CK.Online.slotName(i) : `J${i + 1}`;
        b.textContent = `${label}: ${r[i] ? 'pronto ✓' : 'aceitar'}`;
        b.disabled = mode === 'net' && CK.Online.mySlot !== i;
      });
    },
  };

  // ---------- ponte com o modo em rede (online.js) ----------
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  CK.App = {
    settings,
    get screen() { return screen; },
    show,
    setGame(g) {
      game = CK.current = g;
      if (g) mode = 'net';
    },
    setNames(names) {
      ['p1', 'p2'].forEach((p, i) => { $(`#hud .${p} .bar-name`).textContent = names[i]; });
    },
    // abre a escolha de lutadores com o estado vindo do anfitrião
    netSelect(idx, ok) {
      mode = 'net';
      sel.idx = [...idx];
      sel.ok = [...ok];
      document.querySelectorAll('#cards .tag.p2').forEach((t) => { t.textContent = '2P'; });
      $('#select-hint').innerHTML = SELECT_HINT[CK.Online.mySlot >= 0 ? 'net' : 'watch'];
      CK.Input.clear();
      show('select');
      renderSelect();
    },
    // escolhas atualizadas pelo anfitrião; a do próprio jogador só muda se ele forçar (tempo esgotado)
    setSel(idx, ok, force) {
      if (screen !== 'select') return;
      const mine = CK.Online.mySlot;
      [0, 1].forEach((p) => {
        if (p === mine && !force) return;
        if (sel.idx[p] !== idx[p]) CK.Sfx.play('move');
        if (ok[p] && !sel.ok[p]) CK.Sfx.play('confirm');
        sel.idx[p] = idx[p];
        sel.ok[p] = ok[p];
      });
      renderSelect();
    },
    pump() { step(performance.now()); },
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
    CK.view = { ox: (canvas.width - CK.W) / 2, oy: (canvas.height - CK.H) / 2, w: canvas.width, h: canvas.height, s };
  }
  addEventListener('resize', resize);
  resize();

  // ---------- laço principal ----------
  let last = performance.now();
  let acc = 0;

  // avança os ticks lógicos; em rede a partida nunca pausa (quem abre o menu continua na luta)
  function step(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (screen === 'loading') return;
    const online = CK.Online.active;
    const active = game && (online || screen !== 'pause') ? game : null;
    acc += dt * (active && active.slowmo > 0 ? 0.35 : 1);
    while (acc >= CK.DT) {
      acc -= CK.DT;
      const inputs = CK.Input.poll();
      if (online) CK.Online.tick(inputs);
      else if (active) active.tick(inputs);
      if (!game) demo.tick(inputs);
      if (screen === 'select') selectTick(inputs);
    }
  }

  // mira do mouse (jogador 1, ou o próprio lutador em rede): some o cursor e desenha a mira na arena
  function drawAim(now) {
    const m = CK.Input.mouse;
    const me = !game || screen !== 'fight' || game.phase === 'intro' || !m.in ? -1 : mode === 'net' ? CK.Online.mySlot : 0;
    document.body.classList.toggle('aiming', me >= 0);
    if (me < 0) return;
    const f = game.fighters[me];
    const ready = f.state !== 'ko' && f.canShoot(game);
    const color = ready ? f.def.spark : 'rgba(255,255,255,.45)';
    const r = 18 + (ready ? Math.sin(now / 150) * 2 : 0);
    ctx.save();
    ctx.lineCap = 'round';
    // linha pontilhada da mão até a mira
    if (ready) {
      const hx = f.x + Math.sign(m.x - f.x || f.facing) * 60, hy = f.y - 170;
      ctx.setLineDash([4, 12]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const [w, c] of [[7, 'rgba(0,0,0,.6)'], [3, color]]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(m.x + dx * (r - 8), m.y + dy * (r - 8));
        ctx.lineTo(m.x + dx * (r + 9), m.y + dy * (r + 9));
      }
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function loop(now) {
    step(now);
    if (screen !== 'loading') {
      const g = game || demo;
      ctx.setTransform(1, 0, 0, 1, CK.view.ox, CK.view.oy);
      g.draw(ctx, now / 1000);
      drawAim(now);
      if (game) CK.UI.updateHud(game);
      updatePrefight();
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
    srcs.push(...CK.Stage.SRCS);
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
    CK.Controls.render($('#controls-board'));
    CK.Controls.render($('#prefight-board'), { table: false });
    demo = new CK.Game('soldado', 'bonezinho', settings, true);
    show('menu');
    // link de convite (?sala=1234): vai direto para a sala
    const code = new URLSearchParams(location.search).get('sala');
    if (code) { show('net'); CK.Online.open(code); }
  });
  requestAnimationFrame(loop);
})();
