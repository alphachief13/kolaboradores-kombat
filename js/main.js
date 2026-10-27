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
  let mode = 'pvp';         // 'cpu': jogador 2 é o computador · 'cup': torneio contra a CPU · 'net': partida em rede (ver online.js)
  const SELECT_HINT = {
    pvp: $('#select-hint').innerHTML,
    net: 'Escolha com <kbd>A</kbd>/<kbd>D</kbd> ou <kbd>←</kbd>/<kbd>→</kbd>, confirme com <kbd>F</kbd>/<kbd>K</kbd>, desfaça com <kbd>G</kbd>/<kbd>L</kbd> · ou clique no retrato',
    watch: 'Assistindo: os jogadores estão escolhendo seus lutadores.',
    cup: 'Escolha seu lutador para o torneio: <kbd>A</kbd>/<kbd>D</kbd> ou <kbd>←</kbd>/<kbd>→</kbd> escolhe, <kbd>F</kbd>/<kbd>K</kbd> confirma · <kbd>Esc</kbd> volta · ou clique no retrato',
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
    document.body.classList.toggle('cup', mode === 'cup' && (inGame || name === 'cup'));
    if (!inGame) $('#announce').className = '';
    const first = document.querySelector(`#screen-${name} button`);
    if (first && name !== 'select') first.focus({ preventScroll: true });
    CK.Online.onShow(name);
    // no torneio só o próprio lutador muda (em rede, a partir do próximo round)
    if (name === 'result') {
      $('#result-select').textContent = mode === 'cup' || document.body.classList.contains('tourney') ? 'Trocar lutador' : 'Trocar personagens';
    }
  }

  function startFight() {
    CK.Input.clear();
    if (mode === 'net') mode = 'pvp';
    const cpu = mode === 'cpu' || mode === 'cup';
    const level = mode === 'cup' ? cupLevel() : settings.difficulty;
    game = CK.current = new CK.Game(picks[0], picks[1], settings, false, cpu ? level : null);
    ['p1', 'p2'].forEach((p, i) => { $(`#hud .${p} .bar-name`).textContent = CK.CHARACTERS[picks[i]].name; });
    if (cpu) $('#hud .p2 .bar-name').textContent += ` · CPU ${CK.BOT_LEVELS[level].name}`;
    if (mode === 'cup') {
      game.onFinish = cupFinished;
      game.noRematch = true;   // no torneio, o resultado segue para a chave (ver cupNext)
    }
    else $('#result-hint').innerHTML = RESULT_HINT[mode];
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
    cup = null;
    show('menu');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    CK.Sfx.play('move');
    switch (btn.dataset.action) {
      case 'play': show('play'); break;
      case 'play-vs-cpu': show('vscpu'); break;
      case 'play-cpu': mode = 'cpu'; openSelect(); break;
      case 'play-pvp': mode = 'pvp'; openSelect(); break;
      case 'play-cup': mode = 'cup'; cup = null; openSelect(); break;
      case 'cup-fight': cupFight(); break;
      case 'cup-next': cupNext(); break;
      case 'cup-pick': cupPick(); break;
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
      case 'select':
        if (mode === 'net') CK.Online.reselect();
        else if (mode === 'cup') cupPick();
        else { game = null; openSelect(); }
        break;
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
    else if (screen === 'vscpu' || screen === 'net') show('play');
    else if (['controls', 'settings', 'play'].includes(screen)) show('menu');
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
    // duas linhas: três colunas até 6 personagens, quatro até 8 e cinco acima disso (cards mais estreitos)
    const n = CK.CHAR_IDS.length;
    const cols = n > 8 ? 5 : n > 6 ? 4 : 3;
    box.classList.toggle('cols4', cols === 4);
    box.classList.toggle('cols5', cols === 5);
    const tiles = CK.CHAR_IDS.map((id, i) => {
      const c = CK.CHARACTERS[id];
      const card = document.createElement('div');
      card.className = 'card';
      card.style.setProperty('--accent', c.color);
      card.innerHTML = `<img src="${frameSrc(id, 'idle', 0)}" alt="${c.name}">
        <span class="tag p1">1P</span><span class="tag p2">2P</span>`;
      framePortrait(card.querySelector('img'), window.FRAMES[id].idle[0], { 3: 150, 4: 140, 5: 112 }[cols]);
      card.onclick = () => {
        const p = mode === 'net' ? CK.Online.mySlot : !sel.ok[0] ? 0 : !sel.ok[1] && mode !== 'cup' ? 1 : -1;
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
    $('#screen-select').classList.toggle('solo', mode === 'cup');
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
    if (mode === 'cup' && sel.ok[0]) sel.ok[0] = false;
    else if (sel.ok[1]) sel.ok[1] = false;
    else if (sel.ok[0]) sel.ok[0] = false;
    else if (mode === 'cup' && cup) return showCup();
    else return show(mode === 'pvp' ? 'play' : 'vscpu');
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
    if (mode === 'cup') {
      setTimeout(() => { if (screen === 'select' && sel.ok[0]) cupPicked(CK.CHAR_IDS[sel.idx[0]]); }, 900);
    } else if (mode !== 'net' && sel.ok[0] && sel.ok[1]) {
      picks = sel.idx.map((i) => CK.CHAR_IDS[i]);
      setTimeout(() => { if (screen === 'select' && sel.ok[0] && sel.ok[1]) startFight(); }, 900);
    }
  }

  function renderSelect() {
    document.querySelectorAll('#cards .card').forEach((card, i) => {
      card.classList.toggle('sel-p1', sel.idx[0] === i);
      card.classList.toggle('sel-p2', mode !== 'cup' && sel.idx[1] === i);
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
      const label = (mode === 'cpu' || mode === 'cup') && p === 1 ? 'CPU' : mode === 'net' ? esc(CK.Online.slotName(p)) : `J${p + 1}`;
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
    if (mode === 'cup') {
      const inp = CK.Input.merge(inputs[0], inputs[1]);
      if (inp.a2P && sel.ok[0]) { sel.ok[0] = false; renderSelect(); }
      else if (!sel.ok[0]) stepPick(0, inp);
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

  // ---------- torneio contra a CPU ----------
  // mata-mata de 8: o jogador e sete adversários sorteados (sem repetir o lutador dele);
  // as lutas entre CPUs são decididas na sorte, e a CPU fica mais forte a cada rodada
  const CUP_ROUNDS = ['Quartas', 'Semifinal', 'Final'];
  const CUP_PELA = ['pelas Quartas', 'pela Semifinal', 'pela Final'];
  const LEVELS = Object.keys(CK.BOT_LEVELS);   // easy, normal, hard
  let cup = null;            // { ids, rounds: [[{ a, b, w }]], r: rodada atual, champion, result }

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  function startCup(me) {
    const size = 1 << CUP_ROUNDS.length;
    const rivals = shuffle(CK.CHAR_IDS.filter((id) => id !== me));
    // com poucos personagens, completa a chave repetindo lutadores
    while (rivals.length < size - 1) rivals.push(CK.CHAR_IDS[Math.floor(Math.random() * CK.CHAR_IDS.length)]);
    // o jogador entra na posição 0; os outros são identificados pela posição na chave
    const ids = [me, ...rivals.slice(0, size - 1)];
    const first = [];
    for (let i = 0; i < size; i += 2) first.push({ a: i, b: i + 1, w: null });
    const rounds = [first];
    for (let n = size / 4; n >= 1; n /= 2) rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, w: null })));
    cup = { ids, rounds, r: 0, champion: null, result: null };
    resolveCpuMatches();
    showCup();
  }

  // escolha do lutador: no começo monta a chave; no meio do torneio só troca o do jogador
  function cupPicked(id) {
    if (!cup) return startCup(id);
    cup.ids[0] = id;
    showCup();
  }

  // trocar de lutador no meio do torneio (no chaveamento, na pausa ou no resultado)
  function cupPick() {
    if (!cup) return;
    if (game && game.phase === 'over' && cup.result === 0) cupAdvance();   // a vitória já conta
    if (cup.champion != null) return showCup();
    game = null;
    picks[0] = cup.ids[0];
    openSelect();
  }

  const cupMatch = () => cup.rounds[cup.r].find((m) => m.a === 0 || m.b === 0);
  // dificuldade sobe a cada rodada em torno da escolhida nas configurações: abaixo, igual, acima
  const cupLevel = () => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, LEVELS.indexOf(settings.difficulty) + cup.r - 1))];

  function setCupWinner(r, i, w) {
    cup.rounds[r][i].w = w;
    if (r + 1 < cup.rounds.length) cup.rounds[r + 1][i >> 1][i & 1 ? 'b' : 'a'] = w;
    else cup.champion = w;
  }

  // CPU contra CPU: sorteio
  function resolveCpuMatches() {
    cup.rounds[cup.r].forEach((m, i) => {
      if (m.w == null && m.a !== 0 && m.b !== 0) setCupWinner(cup.r, i, Math.random() < 0.5 ? m.a : m.b);
    });
  }

  function showCup() {
    const nm = (k) => (k == null ? '—' : esc(CK.CHARACTERS[cup.ids[k]].name) + (k === 0 ? ' <i>(você)</i>' : ''));
    const next = cup.champion == null ? cupMatch() : null;
    $('#cup-bracket').innerHTML = cup.rounds.map((round, r) => `<div class="bk-round">
      <h4>${CUP_ROUNDS[r]}</h4><div class="bk-list">
      ${round.map((m) => {
        const cls = (k) => `bk-p${k === 0 ? ' me' : ''}${m.w != null && m.w === k ? ' win' : m.w != null && k != null ? ' lose' : ''}`;
        return `<div class="bk-match${m === next ? ' cur' : ''}">
          <div class="${cls(m.a)}">${nm(m.a)}</div>
          <div class="${cls(m.b)}">${nm(m.b)}</div>
        </div>`;
      }).join('')}
    </div></div>`).join('') + `<div class="bk-round champ"><h4>Campeão</h4><div class="bk-list"><div class="bk-match${cup.champion != null ? ' cur' : ''}"><div class="bk-p win">${cup.champion != null ? '🏆 ' + esc(CK.CHARACTERS[cup.ids[cup.champion]].name) : '?'}</div></div></div></div>`;
    // quem perde tenta de novo, então o torneio só acaba com o jogador campeão
    $('#cup-title').textContent = next ? 'Torneio' : 'Você é o campeão!';
    $('#cup-hint').innerHTML = next
      ? `${CUP_ROUNDS[cup.r]}: você × ${nm(next.a === 0 ? next.b : next.a)} · CPU ${CK.BOT_LEVELS[cupLevel()].name} · aperte <kbd>F</kbd> / <kbd>K</kbd> para lutar`
      : `${esc(CK.CHARACTERS[cup.ids[0]].name)} venceu o torneio!`;
    $('#cup-fight').classList.toggle('hidden', !next);
    $('#cup-pick').classList.toggle('hidden', !next);
    $('#cup-again').classList.toggle('hidden', !!next);
    $('#cup-quit').textContent = next ? 'Desistir' : 'Menu principal';
    game = null;
    show('cup');
    if (!next) CK.Sfx.play('win');
  }

  function cupFight() {
    if (!cup || screen !== 'cup') return;
    const m = cupMatch();
    if (!m || cup.champion != null) return;
    picks = [cup.ids[0], cup.ids[m.a === 0 ? m.b : m.a]];
    startFight();
  }

  // fim de uma luta do jogador: avança na chave ou é eliminado (pode tentar de novo)
  function cupFinished(w) {
    const last = cup.r === CUP_ROUNDS.length - 1;
    cup.result = w;
    $('#cup-next').textContent = w === 0 ? (last ? 'Ver o campeão' : 'Próxima rodada') : 'Tentar de novo';
    $('#result-hint').innerHTML = w === 0
      ? `Você passou ${CUP_PELA[cup.r]}! Aperte <kbd>F</kbd> / <kbd>K</kbd> ou clique em ${last ? 'Ver o campeão' : 'Próxima rodada'}.`
      : `${w < 0 ? 'Empate: a luta precisa de um vencedor.' : 'Não desista!'} Aperte <kbd>F</kbd> / <kbd>K</kbd> para tentar de novo, ou troque de lutador.`;
  }

  function cupNext() {
    if (!cup || !game || game.phase !== 'over') return;
    if (cup.result !== 0) {        // revanche da mesma luta
      CK.Input.clear();
      game.reset();
      return;
    }
    cupAdvance();
    showCup();
  }

  function cupAdvance() {
    setCupWinner(cup.r, cup.rounds[cup.r].indexOf(cupMatch()), 0);
    cup.result = null;
    if (cup.champion == null) {
      cup.r++;
      resolveCpuMatches();
    }
  }

  // teclado no chaveamento e no resultado; a revanche automática do modo vs CPU não vale aqui
  function cupTick(inputs) {
    const inp = CK.Input.merge(inputs[0], inputs[1]);
    if (screen === 'cup' && inp.a1P) cupFight();
    else if (screen === 'result' && inp.a1P) cupNext();
  }

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
        // fôlego do golpe rápido e do dash; pisca quando não dá nem para um golpe
        box.querySelector('.stamina-fill').style.width = (f.stamina / CK.STAMINA) * 100 + '%';
        box.classList.toggle('tired', f.stamina < (f.def.attacks.attack1.stamina || 0));
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
        const label = (mode === 'cpu' || mode === 'cup') && i === 1 ? 'CPU' : mode === 'net' ? CK.Online.slotName(i) : `J${i + 1}`;
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
      $('#screen-select').classList.remove('solo');
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
      if (mode === 'cup') cupTick(inputs);
    }
  }

  function loop(now) {
    step(now);
    if (screen !== 'loading') {
      const g = game || demo;
      ctx.setTransform(1, 0, 0, 1, CK.view.ox, CK.view.oy);
      g.draw(ctx, now / 1000);
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
