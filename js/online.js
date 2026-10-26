// Modo em rede: sala (lobby), 1x1, torneio e espectadores.
// O anfitrião roda a luta e envia o estado a cada tick; os outros enviam só as teclas e desenham o que recebem.
// Quem não está lutando (espectador, ou esperando a vez no torneio) só recebe o estado.
CK.Online = (() => {
  const $ = (s) => document.querySelector(s);
  const VERSION = 'kk-net-1:' + CK.CHAR_IDS.join(',');
  const MAX_MEMBERS = 16;
  const MAX_PLAYERS = 8;
  const HOST_DELAY = 1;        // ticks de atraso na tecla do anfitrião, para empatar com o atraso da rede dos outros
  const PICK_TIME = 30;        // s para escolher o lutador no torneio (depois confirma o que estiver marcado)
  const BRACKET_TIME = 10;     // s no chaveamento antes da próxima luta
  const NEXT_ROUND = 150;      // ticks entre o fim de um round e o próximo numa melhor de 3
  const TIMEOUT = 8000;        // ms sem notícias = desconectado
  const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

  // entrada de um tick em 10 bits (5 segurando + 5 apertou agora)
  const BITS = ['left', 'right', 'up', 'a1', 'a2', 'block', 'upP', 'a1P', 'a2P', 'blockP', 'leftP', 'rightP'];
  const PRESS = 0b1111100000;
  const encode = (inp) => BITS.reduce((b, k, i) => (inp[k] ? b | (1 << i) : b), 0);
  const decode = (b) => Object.fromEntries(BITS.map((k, i) => [k, !!(b & (1 << i))]));
  const NONE = decode(0);

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Jogador';
  const charName = (id) => CK.CHARACTERS[id].name;

  let S = null;   // sessão atual; null = fora do modo em rede

  // ---------- comum ----------
  const members = () => S.lobby.members;
  const member = (id) => members().find((m) => m.id === id);
  const fighting = () => S && S.match && (S.view === 'select' || S.view === 'fight');
  const mySlot = () => (fighting() ? S.match.slots.indexOf(S.myId) : -1);

  function labels() {
    const m = S.match;
    const shown = m.score[0] + m.score[1] > 0;
    return [0, 1].map((i) => `${m.names[i]} (${charName(m.picks[i])})${shown ? ` · ${m.score[i]}` : ''}`);
  }

  // classes no body controlam quais botões aparecem (pausa, resultado)
  function refreshClasses() {
    const b = document.body.classList;
    b.toggle('net', !!S);
    b.toggle('host', !!(S && S.host));
    b.toggle('player', mySlot() >= 0);
    b.toggle('tourney', !!(S && S.match && S.match.tourney));
    updateBadge();
  }

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.className = '';
    void el.offsetWidth;
    el.className = 'show';
  }

  function setStatus(text, error) {
    const el = $('#net-status');
    el.textContent = text || '';
    el.classList.toggle('error', !!error);
  }

  function pingClass(ms) {
    return ms == null ? '' : ms < 40 ? 'good' : ms < 100 ? 'ok' : 'bad';
  }

  function updateBadge() {
    const el = $('#net-badge');
    const screen = CK.App.screen;
    el.classList.toggle('hidden', !S || !S.code || ['lobby', 'net'].includes(screen));
    if (!S) return;
    const slot = mySlot();
    const me = member(S.myId);
    const role = slot >= 0 ? `Você: J${slot + 1}` : fighting() ? 'Assistindo' : '';
    const ping = S.host ? 'anfitrião' : me && me.ping != null ? `${me.ping} ms` : '';
    el.innerHTML = `<i class="dot ${S.host ? 'good' : pingClass(me && me.ping)}"></i>Sala ${S.code}${role ? ` · ${role}` : ''}${ping ? ` · ${ping}` : ''}`;
  }

  function joinLink() {
    return /^https?:$/.test(location.protocol) ? `${location.origin}${location.pathname}?sala=${S.code}` : null;
  }

  // ---------- telas: sala ----------
  const OPTS = {
    mode: [['1x1', '1x1'], ['torneio', 'Torneio']],
    bestOf: [[1, 'Melhor de 1'], [3, 'Melhor de 3']],
    roundTime: [[60, '60 s'], [99, '99 s'], [0, 'Sem limite']],
  };

  function lobbyProblem() {
    const n = members().filter((m) => m.role === 'player').length;
    if (S.lobby.mode === '1x1') {
      if (n < 2) return 'Esperando mais um jogador entrar na sala…';
      if (n > 2) return `Há ${n} jogadores: escolha Torneio, ou marque os outros como espectadores.`;
    } else {
      if (n < 2) return 'O torneio precisa de pelo menos 2 jogadores.';
      if (n > MAX_PLAYERS) return `O torneio aceita até ${MAX_PLAYERS} jogadores: marque os outros como espectadores.`;
    }
    return null;
  }

  function renderLobby() {
    const L = S.lobby;
    $('#lobby-code').textContent = S.code;
    const link = joinLink();
    $('#lobby-link').classList.toggle('hidden', !link);
    $('#lobby-list').innerHTML = members().map((m) => {
      const me = m.id === S.myId;
      const canToggle = S.host || me;
      return `<li class="${m.role}${me ? ' me' : ''}">
        <i class="dot ${m.id === 'host' ? 'good' : pingClass(m.ping)}" title="${m.ping != null ? m.ping + ' ms' : ''}"></i>
        <span class="nm">${esc(m.name)}${m.id === 'host' ? ' <small>anfitrião</small>' : ''}${me ? ' <small>você</small>' : ''}</span>
        <button class="chip" data-role="${esc(m.id)}" ${canToggle ? '' : 'disabled'}>${m.role === 'player' ? 'Jogador' : 'Espectador'}</button>
      </li>`;
    }).join('');
    const opts = [['mode', 'Modo'], ...(L.mode === 'torneio' ? [['bestOf', 'Cada luta']] : []), ['roundTime', 'Tempo']];
    $('#lobby-opts').innerHTML = opts.map(([k, label]) => `<div class="opt"><span>${label}</span>${OPTS[k].map(([v, t]) =>
      `<button class="chip${L[k] === v ? ' on' : ''}" data-opt="${k}:${v}" ${S.host ? '' : 'disabled'}>${t}</button>`).join('')}</div>`).join('');
    const problem = lobbyProblem();
    $('#lobby-hint').textContent = S.host
      ? problem || (L.mode === '1x1' ? 'Tudo pronto! Aperte Começar.' : 'Tudo pronto! O chaveamento é sorteado ao começar.')
      : 'Aguardando o anfitrião começar…' + (problem ? ` (${problem})` : '');
    $('#lobby-start').classList.toggle('hidden', !S.host);
    $('#lobby-start').disabled = !!problem;
    const me = member(S.myId);
    $('#lobby-role').textContent = me && me.role === 'spectator' ? 'Quero jogar' : 'Quero assistir';
  }

  let qrFor = null;
  function renderQr() {
    const link = joinLink();
    const box = $('#lobby-qr');
    if (!link || qrFor === link) return;
    qrFor = link;
    box.innerHTML = '';
    const draw = () => { if (qrFor === link) new QRCode(box, { text: link, width: 256, height: 256, colorDark: '#12060f', colorLight: '#ffffff' }); };
    if (window.QRCode) return draw();
    const s = document.createElement('script');
    s.src = QR_LIB;
    s.onload = draw;
    s.onerror = () => s.remove();   // sem QR, o código e o link continuam valendo
    document.head.appendChild(s);
  }

  function showLobby() {
    S.view = 'lobby';
    S.match = null;
    S.bracket = null;
    S.deadline = 0;
    CK.App.setGame(null);
    renderLobby();
    renderQr();
    CK.App.show('lobby');
  }

  // ---------- telas: chaveamento ----------
  const ROUND_NAMES = ['Final', 'Semifinal', 'Quartas', 'Oitavas'];

  function renderBracket() {
    const B = S.bracket;
    const nm = (id) => (id == null ? '—' : esc(B.names[id] || '?'));
    const cur = B.current;
    $('#bracket').innerHTML = B.rounds.map((round, r) => `<div class="bk-round">
      <h4>${ROUND_NAMES[B.rounds.length - 1 - r] || `Rodada ${r + 1}`}</h4><div class="bk-list">
      ${round.map((m, i) => {
        const cls = (id) => `bk-p${m.w != null && m.w === id ? ' win' : m.w != null && id != null ? ' lose' : ''}`;
        const isCur = cur && cur[0] === r && cur[1] === i;
        return `<div class="bk-match${isCur ? ' cur' : ''}">
          <div class="${cls(m.a)}">${nm(m.a)}</div>
          <div class="${cls(m.b)}">${r === 0 && m.b == null ? '<i>passa direto</i>' : nm(m.b)}</div>
          ${m.wo ? '<span class="wo">W.O.</span>' : ''}
        </div>`;
      }).join('')}
    </div></div>`).join('') + `<div class="bk-round champ"><h4>Campeão</h4><div class="bk-list"><div class="bk-match${B.champion != null ? ' cur' : ''}"><div class="bk-p win">${B.champion != null ? '🏆 ' + nm(B.champion) : '?'}</div></div></div></div>`;
    $('#bracket-title').textContent = B.champion != null ? `${B.names[B.champion]} é o campeão!` : 'Torneio';
    $('#bracket-next').classList.toggle('hidden', !S.host || B.champion != null);
    $('#bracket-lobby').classList.toggle('hidden', !S.host || B.champion == null);
    updateClock();
  }

  function applyBracket(m) {
    S.view = 'bracket';
    S.match = null;
    S.bracket = m.bracket;
    S.deadline = m.left ? performance.now() + m.left * 1000 : 0;
    CK.App.setGame(null);
    renderBracket();
    CK.App.show('bracket');
    if (m.bracket.champion != null) CK.Sfx.play('fight');
  }

  // contagens regressivas na tela (escolha do lutador, próxima luta do torneio)
  function updateClock() {
    if (!S) return;
    const left = S.deadline ? Math.max(0, Math.ceil((S.deadline - performance.now()) / 1000)) : 0;
    if (S.view === 'select') $('#sel-timer').textContent = left ? left : '';
    if (S.view === 'bracket' && S.bracket) {
      const B = S.bracket;
      const c = B.current && B.rounds[B.current[0]][B.current[1]];
      $('#bracket-hint').textContent = B.champion != null
        ? (S.host ? 'Fim do torneio! Volte para a sala para jogar de novo.' : 'Fim do torneio! Aguardando o anfitrião.')
        : c ? `Próxima luta: ${B.names[c.a]} × ${B.names[c.b]}${left ? ` · começa em ${left} s` : ''}` : '';
    }
  }
  setInterval(updateClock, 250);

  // ---------- telas: escolha e luta ----------
  function applySelect(m) {
    S.view = 'select';
    S.match = m.match;
    S.deadline = m.left ? performance.now() + m.left * 1000 : 0;
    CK.App.setGame(null);
    refreshClasses();
    CK.App.netSelect(m.idx, m.ok);
    updateClock();
  }

  function newGame(match, roundTime) {
    const g = new CK.Game(match.picks[0], match.picks[1], { ...CK.App.settings, roundTime }, false);
    g.names = match.names;
    return g;
  }

  function enterFight(game) {
    S.view = 'fight';
    S.deadline = 0;
    S.game = game;
    CK.App.setGame(game);
    CK.App.setNames(labels());
    refreshClasses();
    CK.App.show('fight');
  }

  // ---------- anfitrião ----------
  function lobbyMsg(go) {
    return { t: 'lobby', go, code: S.code, view: S.view, lobby: S.lobby };
  }

  function broadcastLobby(go) {
    S.link.broadcast(lobbyMsg(go));
    if (S.view === 'lobby') renderLobby();
    updateBadge();
  }

  function selectMsg() {
    return { t: 'select', match: S.match, idx: S.sel.idx, ok: S.sel.ok, left: Math.ceil(S.selT / 60) };
  }

  function bracketMsg() {
    return { t: 'bracket', bracket: S.bracket, left: Math.ceil(S.nextT / 60) };
  }

  function startMsg() {
    return { t: 'start', match: S.match, roundTime: S.lobby.roundTime };
  }

  // quem entra no meio recebe a tela atual
  function sendCurrent(id) {
    if (S.view === 'select') S.link.send(id, selectMsg());
    else if (S.view === 'fight') S.link.send(id, startMsg());
    else if (S.view === 'bracket') S.link.send(id, bracketMsg());
  }

  function hostData(id, m) {
    S.seen.set(id, performance.now());
    const slot = fighting() ? S.match.slots.indexOf(id) : -1;
    switch (m.t) {
      case 'hello': {
        if (m.v !== VERSION) {
          S.link.send(id, { t: 'bye', text: 'O jogo deste computador é de outra versão. Atualize a página (Ctrl+F5) nos dois computadores.' });
          return S.link.kick(id);
        }
        if (members().length >= MAX_MEMBERS) {
          S.link.send(id, { t: 'bye', text: 'A sala está cheia.' });
          return S.link.kick(id);
        }
        if (member(id)) return;
        const name = cleanName(m.name);
        members().push({ id, name, role: 'player', ping: null });
        S.link.send(id, { t: 'welcome', id });
        broadcastLobby();
        sendCurrent(id);
        S.link.broadcast({ t: 'toast', text: `${name} entrou na sala` }, id);
        toast(`${name} entrou na sala`);
        break;
      }
      case 'in': {
        const r = S.remote.get(id) || { held: 0, pressed: 0 };
        r.held = m.b & ~PRESS;
        r.pressed |= m.b & PRESS;
        // clique do mouse: ponto mirado para o ataque forte
        if (Array.isArray(m.aim) && m.aim.length === 2 && m.aim.every(Number.isFinite)) r.aim = m.aim;
        S.remote.set(id, r);
        break;
      }
      case 'sel':
        if (slot >= 0) hostPick(slot, m.idx, m.ok);
        break;
      case 'rematch':
        if (slot >= 0) hostRematch(slot);
        break;
      case 'reselect':
        if (slot >= 0) hostReselect();
        break;
      case 'role': {
        const mm = member(id);
        if (mm) { mm.role = m.role === 'spectator' ? 'spectator' : 'player'; broadcastLobby(); }
        break;
      }
      case 'pong': {
        const mm = member(id);
        if (mm) mm.ping = Math.round(performance.now() - m.ts);
        break;
      }
    }
  }

  function hostLeave(id) {
    const m = member(id);
    S.remote.delete(id);
    S.seen.delete(id);
    if (!m) return;
    S.lobby.members = members().filter((x) => x !== m);
    const text = `${m.name} saiu da sala`;
    S.link.broadcast({ t: 'toast', text });
    toast(text);
    const slot = fighting() ? S.match.slots.indexOf(id) : -1;
    if (slot >= 0) {
      if (S.match.tourney) matchDecided(S.match.slots[1 - slot], true);
      else toLobby();
    }
    broadcastLobby();
  }

  function checkTimeouts(now) {
    for (const [id, t] of S.seen) {
      if (now - t > TIMEOUT) {
        S.link.kick(id);
        hostLeave(id);
      }
    }
  }

  function hostStart() {
    if (lobbyProblem()) return;
    const players = members().filter((m) => m.role === 'player');
    if (S.lobby.mode === '1x1') {
      S.match = newMatch(players.map((m) => m.id), false);
      return startSelect();
    }
    S.bracket = buildBracket(players);
    advanceBracket();
  }

  function newMatch(ids, tourney) {
    return {
      slots: ids,
      names: ids.map((id) => (member(id) || { name: S.bracket.names[id] }).name),
      picks: ids.map((id, i) => S.lastPick[id] || CK.CHAR_IDS[i]),
      score: [0, 0],
      tourney,
      need: tourney ? Math.ceil(S.lobby.bestOf / 2) : 0,
    };
  }

  function startSelect() {
    const M = S.match;
    S.sel = { idx: M.picks.map((id) => CK.CHAR_IDS.indexOf(id)), ok: [false, false] };
    S.selT = M.tourney ? PICK_TIME * 60 : 0;
    S.startT = 0;
    const msg = selectMsg();
    S.link.broadcast(msg);
    applySelect(msg);
  }

  function hostPick(slot, idx, ok) {
    if (S.view !== 'select' || !(idx >= 0 && idx < CK.CHAR_IDS.length)) return;
    S.sel.idx[slot] = idx;
    S.sel.ok[slot] = !!ok;
    S.link.broadcast({ t: 'sel', idx: S.sel.idx, ok: S.sel.ok });
    CK.App.setSel(S.sel.idx, S.sel.ok, false);
  }

  function startFight() {
    const M = S.match;
    M.picks = S.sel.idx.map((i) => CK.CHAR_IDS[i]);
    M.slots.forEach((id, i) => { S.lastPick[id] = M.picks[i]; });
    S.remote.clear();
    S.hostQ = [];
    S.overT = 0;
    const g = newGame(M, S.lobby.roundTime);
    g.events = [];
    g.onFinish = (w) => {
      if (w >= 0) M.score[w]++;
      S.overT = 0;
      S.link.broadcast({ t: 'match', match: M });
      CK.App.setNames(labels());
    };
    S.link.broadcast(startMsg());
    enterFight(g);
  }

  function hostRematch(slot) {
    if (S.view === 'fight' && !S.match.tourney && S.game) S.game.acceptRematch(slot);
  }

  function hostReselect() {
    if (S.view === 'fight' && !S.match.tourney) startSelect();
  }

  // fim de um round no torneio: decide a luta (melhor de N) ou começa o próximo round
  function roundOver() {
    const M = S.match;
    const w = M.score.findIndex((s) => s >= M.need);
    if (w >= 0) matchDecided(M.slots[w]);
    else S.game.reset();
  }

  function toLobby() {
    S.game = null;
    showLobby();
    S.link.broadcast(lobbyMsg(true));
    refreshClasses();
  }

  // ---------- chaveamento (mata-mata simples, com quem sobra passando direto) ----------
  function buildBracket(players) {
    const ids = players.map((m) => m.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    let size = 2;
    while (size < ids.length) size *= 2;
    const byes = size - ids.length;
    const first = [];
    let k = 0;
    for (let i = 0; i < size / 2; i++) {
      first.push(i < byes ? { a: ids[k++], b: null, w: null } : { a: ids[k++], b: ids[k++], w: null });
    }
    const rounds = [first];
    while (rounds[rounds.length - 1].length > 1) {
      rounds.push(Array.from({ length: rounds[rounds.length - 1].length / 2 }, () => ({ a: null, b: null, w: null })));
    }
    return { rounds, names: Object.fromEntries(players.map((m) => [m.id, m.name])), current: null, champion: null };
  }

  function setWinner(r, i, w) {
    const B = S.bracket;
    B.rounds[r][i].w = w;
    if (r + 1 < B.rounds.length) B.rounds[r + 1][i >> 1][i & 1 ? 'b' : 'a'] = w;
    else B.champion = w;
  }

  // resolve quem passa direto e os W.O. (quem saiu da sala), e acha a próxima luta
  function advanceBracket() {
    const B = S.bracket;
    const here = (id) => !!member(id);
    B.current = null;
    B.rounds.forEach((round, r) => round.forEach((m, i) => {
      if (m.w != null) return;
      if (r === 0 && m.b == null) return setWinner(r, i, m.a);
      if (m.a == null || m.b == null) return;
      if (!here(m.a) || !here(m.b)) {
        m.wo = true;
        return setWinner(r, i, here(m.b) ? m.b : m.a);
      }
      if (!B.current) B.current = [r, i];
    }));
    S.match = null;
    S.game = null;
    S.nextT = B.current ? BRACKET_TIME * 60 : 0;
    const msg = bracketMsg();
    S.link.broadcast(msg);
    applyBracket(msg);
    refreshClasses();
  }

  function matchDecided(winnerId, wo) {
    const [r, i] = S.bracket.current;
    if (wo) S.bracket.rounds[r][i].wo = true;
    setWinner(r, i, winnerId);
    advanceBracket();
  }

  function nextMatch() {
    const B = S.bracket;
    if (!B.current) return;
    const m = B.rounds[B.current[0]][B.current[1]];
    if (!member(m.a) || !member(m.b)) return advanceBracket();   // alguém saiu enquanto esperava: W.O.
    S.match = newMatch([m.a, m.b], true);
    startSelect();
  }

  function hostTick(inputs) {
    const local = CK.Input.merge(inputs[0], inputs[1]);
    const now = performance.now();
    if (++S.pingT >= 120) {
      S.pingT = 0;
      S.link.broadcast({ t: 'ping', ts: now });
      checkTimeouts(now);
      if (S) broadcastLobby();
    }
    if (!S) return;
    if (S.view === 'select') {
      if (S.selT > 0 && --S.selT === 0 && !(S.sel.ok[0] && S.sel.ok[1])) {
        // acabou o tempo: confirma o lutador marcado
        S.sel.ok = [true, true];
        S.link.broadcast({ t: 'sel', idx: S.sel.idx, ok: S.sel.ok, force: true });
        CK.App.setSel(S.sel.idx, S.sel.ok, true);
      }
      if (S.sel.ok[0] && S.sel.ok[1]) {
        if (++S.startT === 54) startFight();
      } else S.startT = 0;
    } else if (S.view === 'fight' && S.game) {
      const g = S.game;
      S.hostQ.push(local);
      const mine = S.hostQ.length > HOST_DELAY ? S.hostQ.shift() : NONE;
      let inp = S.match.slots.map((id) => {
        if (id === 'host') return mine;
        const r = S.remote.get(id);
        if (!r) return NONE;
        const s = decode(r.held | r.pressed);
        s.aim = r.aim || null;
        r.pressed = 0;
        r.aim = null;
        return s;
      });
      if (S.match.tourney && g.phase === 'over') inp = [NONE, NONE];
      g.tick(inp);
      S.link.broadcast({ t: 'snap', s: g.serialize(), e: g.events.splice(0) });
      if (S.match.tourney && g.phase === 'over' && ++S.overT === NEXT_ROUND) roundOver();
    } else if (S.view === 'bracket' && S.nextT > 0 && --S.nextT === 0) {
      nextMatch();
    }
  }

  // a aba do anfitrião escondida para de receber requestAnimationFrame; um worker mantém a luta rodando
  let pump = null;
  function startPump() {
    if (pump) return;
    try {
      const src = 'setInterval(() => postMessage(0), 16);';
      pump = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      pump.onmessage = () => { if (document.hidden) CK.App.pump(); };
    } catch (e) { pump = null; }
  }
  function stopPump() {
    if (pump) pump.terminate();
    pump = null;
  }

  // ---------- cliente ----------
  function clientData(m) {
    S.lastMsg = performance.now();
    switch (m.t) {
      case 'welcome': S.myId = m.id; break;
      case 'bye': leave(m.text, true); break;
      case 'toast': toast(m.text); break;
      case 'ping': S.link.send({ t: 'pong', ts: m.ts }); break;
      case 'lobby':
        S.code = m.code;
        S.lobby = m.lobby;
        if (m.go || (!S.view && m.view === 'lobby')) { S.game = null; showLobby(); }
        else if (S.view === 'lobby') renderLobby();
        if (!S.view) S.view = 'waiting';
        refreshClasses();
        break;
      case 'select': applySelect(m); break;
      case 'sel': if (S.view === 'select') CK.App.setSel(m.idx, m.ok, m.force); break;
      case 'start':
        S.match = m.match;
        S.queue = [];
        S.lastIn = -1;
        enterFight(newGame(m.match, m.roundTime));
        break;
      case 'match':
        S.match = m.match;
        if (S.view === 'fight') CK.App.setNames(labels());
        break;
      case 'snap': if (S.view === 'fight') S.queue.push(m); break;
      case 'bracket': applyBracket(m); refreshClasses(); break;
    }
  }

  function applySnap(m, events) {
    S.game.applyState(m.s);
    if (events) for (const e of m.e) CK.present(e[0], e.slice(1));
    CK.Effects.update(CK.DT);
  }

  function clientTick(inputs) {
    if (performance.now() - S.lastMsg > TIMEOUT) return leave('A conexão com o anfitrião caiu.', true);
    if (S.view !== 'fight' || !S.game) return;
    if (mySlot() >= 0) {
      const inp = CK.Input.merge(inputs[0], inputs[1]);
      const b = encode(inp);
      if (inp.aim) S.link.send({ t: 'in', b, aim: inp.aim });
      else if (b !== S.lastIn || b & PRESS) S.link.send({ t: 'in', b });
      S.lastIn = b;
    }
    // um estado por tick, com folga de 2 para absorver a variação da rede; atrasado demais, pula para o último
    const q = S.queue;
    if (q.length > 30) {
      applySnap(q[q.length - 1], false);
      q.length = 0;
    } else if (q.length) {
      applySnap(q.shift(), true);
      while (q.length > 2) applySnap(q.shift(), true);
    }
  }

  // ---------- entrar e sair ----------
  function session(host) {
    return {
      host, link: null, code: '', myId: host ? 'host' : null, view: null, match: null, bracket: null, game: null,
      lobby: { members: [], mode: '1x1', bestOf: 1, roundTime: 99 }, deadline: 0,
      queue: [], lastIn: -1, lastMsg: performance.now(),
      remote: new Map(), seen: new Map(), sel: null, selT: 0, startT: 0, hostQ: [], overT: 0, pingT: 0, nextT: 0, lastPick: {},
    };
  }

  let busy = false;
  function setBusy(b) {
    busy = b;
    document.querySelectorAll('#screen-net button').forEach((el) => { el.disabled = b; });
  }

  function myName() {
    const n = cleanName($('#net-name').value);
    $('#net-name').value = n;
    try { localStorage.setItem('ck-name', n); } catch (e) { /* sem storage */ }
    return n;
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    setStatus('Criando a sala…');
    const s = session(true);
    try {
      s.lobby.members.push({ id: 'host', name: myName(), role: 'player', ping: 0 });
      s.lobby.roundTime = CK.App.settings.roundTime;
      s.link = await CK.Net.host({
        onJoin: (id) => { if (S === s) s.seen.set(id, performance.now()); },
        onData: (id, m) => { if (S === s) hostData(id, m); },
        onLeave: (id) => { if (S === s) hostLeave(id); },
      });
      s.code = s.link.code;
      S = s;
      setStatus('');
      startPump();
      showLobby();
      refreshClasses();
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* file:// */ }
    } catch (e) {
      setStatus(e.message, true);
    }
    setBusy(false);
  }

  async function join(code) {
    if (busy) return;
    code = String(code || '').replace(/\D/g, '').slice(0, 4);
    $('#net-code').value = code;
    if (code.length !== 4) return setStatus('Digite o código de 4 números que aparece na tela de quem criou a sala.', true);
    setBusy(true);
    setStatus(`Entrando na sala ${code}…`);
    const s = session(false);
    s.code = code;
    try {
      S = s;   // as primeiras mensagens podem chegar antes do join terminar
      s.link = await CK.Net.join(code, {
        onData: (m) => { if (S === s) clientData(m); },
        onClose: () => { if (S === s) leave('A conexão com o anfitrião caiu.', true); },
      });
      if (S !== s) return;
      s.lastMsg = performance.now();
      s.link.send({ t: 'hello', v: VERSION, name: myName() });
      setStatus('');
      try { history.replaceState(null, '', `${location.pathname}?sala=${code}`); } catch (e) { /* file:// */ }
    } catch (e) {
      if (S === s) S = null;
      setStatus(e.message, true);
    }
    setBusy(false);
  }

  function leave(text, error) {
    if (!S) return;
    const s = S;
    S = null;
    if (s.host) {
      s.link.broadcast({ t: 'bye', text: 'O anfitrião fechou a sala.' });
      stopPump();
    }
    if (s.link) s.link.close();
    if (!s.host) $('#net-code').value = s.code;
    if (!error) try { history.replaceState(null, '', location.pathname); } catch (e) { /* file:// */ }
    CK.App.setGame(null);
    refreshClasses();
    setStatus(text || '', error);
    CK.App.show('net');
  }

  // ---------- botões ----------
  document.addEventListener('click', (e) => {
    const role = e.target.closest('[data-role]');
    if (role && S) return toggleRole(role.dataset.role);
    const opt = e.target.closest('[data-opt]');
    if (opt && S && S.host) {
      const [k, v] = opt.dataset.opt.split(':');
      S.lobby[k] = k === 'mode' ? v : +v;
      CK.Sfx.play('move');
      return broadcastLobby();
    }
    const btn = e.target.closest('button[data-action^="net-"]');
    if (!btn) return;
    CK.Sfx.play('move');
    switch (btn.dataset.action) {
      case 'net-host': create(); break;
      case 'net-join': join($('#net-code').value); break;
      case 'net-leave': leave(); break;
      case 'net-start': if (S && S.host) hostStart(); break;
      case 'net-role': if (S) toggleRole(S.myId); break;
      case 'net-lobby': if (S && S.host) toLobby(); break;
      case 'net-next': if (S && S.host && S.view === 'bracket') nextMatch(); break;
      case 'net-copy': copyLink(btn); break;
    }
  });

  $('#net-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(e.target.value); });
  $('#net-code').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

  function toggleRole(id) {
    if (!S.host && id !== S.myId) return;
    const m = member(id);
    if (!m) return;
    const role = m.role === 'player' ? 'spectator' : 'player';
    CK.Sfx.play('move');
    if (S.host) {
      m.role = role;
      broadcastLobby();
    } else {
      m.role = role;   // mostra já; o anfitrião confirma
      renderLobby();
      S.link.send({ t: 'role', role });
    }
  }

  function copyLink(btn) {
    const link = joinLink();
    if (!link) return;
    const done = () => {
      btn.textContent = 'Link copiado!';
      setTimeout(() => { btn.textContent = 'Copiar link'; }, 1600);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => prompt('Copie o link:', link));
    else prompt('Copie o link:', link);
  }

  // ---------- interface para o main.js ----------
  return {
    get active() { return !!S && !!S.link; },
    get mySlot() { return mySlot(); },
    slotName(p) { return S && S.match ? S.match.names[p] : `J${p + 1}`; },

    // tela "Jogar em rede": prepara o nome e, se veio por um link (?sala=1234), já entra
    open(autoCode) {
      let name = '';
      try { name = localStorage.getItem('ck-name') || ''; } catch (e) { /* sem storage */ }
      $('#net-name').value = name || `Jogador ${10 + Math.floor(Math.random() * 90)}`;
      if (!busy) setStatus('');
      CK.Net.load().catch(() => {});   // adianta o download do PeerJS
      if (autoCode) {
        $('#net-code').value = autoCode;
        join(autoCode);
      }
    },

    tick(inputs) {
      if (!S || !S.link) return;
      if (S.host) hostTick(inputs);
      else clientTick(inputs);
    },

    // a escolha do próprio lutador mudou na tela de seleção
    pickChanged(idx, ok) {
      if (!S) return;
      const slot = mySlot();
      if (slot < 0) return;
      if (S.host) hostPick(slot, idx, ok);
      else S.link.send({ t: 'sel', idx, ok });
    },

    rematch() {
      const slot = mySlot();
      if (slot < 0) return;
      if (S.host) hostRematch(slot);
      else S.link.send({ t: 'rematch' });
    },

    reselect() {
      if (mySlot() < 0) return;
      if (S.host) hostReselect();
      else S.link.send({ t: 'reselect' });
    },

    // ajusta botões e textos das telas compartilhadas com o modo local
    onShow(name) {
      if (!S) return;
      refreshClasses();
      if (name === 'result' && S.match) {
        const M = S.match;
        const slot = mySlot();
        let hint;
        if (M.tourney) {
          const decided = M.score.some((s) => s >= M.need);
          hint = `${M.names[0]} ${M.score[0]} × ${M.score[1]} ${M.names[1]} · ${decided ? 'voltando ao chaveamento…' : 'próximo round em instantes…'}`;
        } else if (slot >= 0) {
          hint = 'Revanche? Aperte seu ataque rápido (<kbd>F</kbd> / <kbd>K</kbd>) ou clique no seu botão.';
        } else {
          hint = 'Aguardando os jogadores decidirem a revanche…';
        }
        $('#result-hint').innerHTML = hint;
      }
    },

    leave,
  };
})();
