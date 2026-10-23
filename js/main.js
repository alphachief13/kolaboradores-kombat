// Telas (menu, seleção, configurações), HUD e laço principal.
(() => {
  const $ = (s) => document.querySelector(s);
  const wrap = $('#wrap');
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');

  // ---------- configurações ----------
  const settings = { roundTime: 99, sound: true, showBoxes: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('ck-settings') || '{}')); } catch (e) { /* sem storage */ }
  const saveSettings = () => {
    try { localStorage.setItem('ck-settings', JSON.stringify(settings)); } catch (e) { /* sem storage */ }
    CK.Sfx.setEnabled(settings.sound);
  };
  CK.Sfx.setEnabled(settings.sound);
  $('#opt-time').value = String(settings.roundTime);
  $('#opt-sound').checked = settings.sound;
  $('#opt-boxes').checked = settings.showBoxes;
  $('#opt-time').onchange = (e) => { settings.roundTime = +e.target.value; saveSettings(); };
  $('#opt-sound').onchange = (e) => { settings.sound = e.target.checked; saveSettings(); };
  $('#opt-boxes').onchange = (e) => { settings.showBoxes = e.target.checked; saveSettings(); };

  // ---------- telas ----------
  let screen = 'loading';
  let game = null;          // partida em andamento
  let demo = null;          // lutadores parados atrás do menu
  let picks = ['soldado', 'chef'];

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
    game = CK.current = new CK.Game(picks[0], picks[1], settings);
    ['p1', 'p2'].forEach((p, i) => { $(`#hud .${p} .bar-name`).textContent = CK.CHARACTERS[picks[i]].name; });
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
      case 'play': openSelect(); break;
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

  function buildCards() {
    const box = $('#cards');
    box.innerHTML = '';
    CK.CHAR_IDS.forEach((id, i) => {
      const c = CK.CHARACTERS[id];
      const a1 = c.attacks.attack1, a2 = c.attacks.attack2;
      const card = document.createElement('div');
      card.className = 'card';
      card.style.setProperty('--accent', c.color);
      card.innerHTML = `
        <div class="tags"><span class="tag p1">J1</span><span class="tag p2">J2</span></div>
        <div class="portrait"><img src="${frameSrc(id, 'idle', 0)}" alt=""></div>
        <div class="info">
          <h3>${c.name}</h3>
          <div class="theme">${c.theme}</div>
          <p>${c.desc}</p>
          <div class="moves">
            <div class="move"><img src="${frameSrc(id, 'attack1', a1.preview)}" alt="">
              <div><b>Rápido · ${a1.name}</b><span>${a1.desc}</span></div></div>
            <div class="move"><img src="${frameSrc(id, 'attack2', a2.preview)}" alt="">
              <div><b>Forte · ${a2.name}</b><span>${a2.desc}</span></div></div>
          </div>
        </div>`;
      card.onclick = () => {
        const p = !sel.ok[0] ? 0 : !sel.ok[1] ? 1 : -1;
        if (p < 0) return;
        sel.idx[p] = i;
        confirmPick(p);
      };
      box.appendChild(card);
    });
  }

  function openSelect() {
    sel.ok = [false, false];
    sel.idx = [CK.CHAR_IDS.indexOf(picks[0]), CK.CHAR_IDS.indexOf(picks[1])];
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
      $(`#st-p${p + 1}`).innerHTML = `<b>J${p + 1}</b> ${c.name} ${sel.ok[p] ? '<em>PRONTO ✓</em>' : '<i>escolhendo…</i>'}`;
    });
  }

  function selectTick(inputs) {
    inputs.forEach((inp, p) => {
      if (sel.ok[p]) {
        if (inp.a2P) { sel.ok[p] = false; renderSelect(); }
        return;
      }
      const n = CK.CHAR_IDS.length;
      if (inp.leftP || inp.rightP) {
        sel.idx[p] = (sel.idx[p] + (inp.rightP ? 1 : n - 1)) % n;
        CK.Sfx.play('move');
        renderSelect();
      }
      if (inp.a1P) confirmPick(p);
    });
  }

  // anima os retratos dos cards
  setInterval(() => {
    if (screen !== 'select') return;
    document.querySelectorAll('#cards .card').forEach((card, i) => {
      const id = CK.CHAR_IDS[i];
      const seq = sel.idx.includes(i) ? CK.CHARACTERS[id].taunt : CK.CHARACTERS[id].idle;
      const n = seq[Math.floor(Date.now() / 450) % seq.length];
      card.querySelector('.portrait img').src = frameSrc(id, 'idle', n);
    });
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
        b.textContent = `J${i + 1}: ${r[i] ? 'pronto ✓' : 'aceitar'}`;
      });
    },
  };

  // ---------- escala responsiva ----------
  function resize() {
    const w = Math.min(innerWidth, (innerHeight * 16) / 9);
    wrap.style.width = w + 'px';
    wrap.style.height = (w * 9) / 16 + 'px';
    wrap.style.setProperty('--u', w / 1280 + 'px');
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
    demo = new CK.Game('soldado', 'chef', settings, true);
    show('menu');
  });
  requestAnimationFrame(loop);
})();
