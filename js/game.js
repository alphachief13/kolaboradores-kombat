// Uma partida: contagem regressiva, combate, projéteis, K.O., tempo e revanche.
const NO_INPUT = { left: false, right: false, up: false, a1: false, a2: false, block: false, upP: false, a1P: false, a2P: false, blockP: false };

// executa um evento da partida (som, aviso, efeito visual, tela de resultado); ver Game.emit
CK.present = (type, args) => {
  switch (type) {
    case 'sfx': CK.Sfx.play(args[0], args[1]); break;
    case 'fx': CK.Effects[args[0]](...args.slice(1)); break;
    case 'announce': CK.UI.announce(args[0], args[1]); break;
    case 'result': CK.UI.showResult(args[0], args[1]); break;
    case 'rematch': CK.UI.updateRematch(args[0]); break;
    case 'hideResult': CK.UI.hideResult(); break;
  }
};

CK.Game = class Game {
  constructor(charA, charB, settings, demo = false, botLevel = null) {
    this.fighters = [new CK.Fighter(0, charA), new CK.Fighter(1, charB)];
    this.settings = settings;
    this.demo = demo;
    this.bot = botLevel ? new CK.Bot(botLevel) : null;   // controla o jogador 2
    this.stage = CK.Stage.pick();   // arena (em rede, vem da partida)
    this.names = null;        // nomes dos jogadores (partida em rede)
    this.events = null;       // anfitrião em rede: guarda os eventos de cada tick para os outros
    this.onFinish = null;
    this.noRematch = false;   // torneio contra a CPU: quem decide o que vem depois é main.js
    for (const f of this.fighters) f.game = this;
    this.reset();
  }

  reset() {
    for (const f of this.fighters) f.reset();
    this.projectiles = [];
    this.emit('fx', 'clear');
    this.phase = this.demo ? 'demo' : 'countdown';
    this.phaseT = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.time = this.settings.roundTime;
    this.timeAcc = 0;
    this.controlsEnabled = false;
    this.rematch = [false, false];
    this.winner = null;
    if (this.bot) this.bot.reset();
    if (!this.demo) {
      this.emit('hideResult');
      CK.UI.updateHud(this);
    }
  }

  tick(inputs) {
    CK.Effects.update(CK.DT);
    this.phaseT++;
    if (this.slowmo > 0) this.slowmo--;
    if (this.bot) inputs = [CK.Input.merge(inputs[0], inputs[1]), NO_INPUT];

    // preparação: contagem com os controles na tela; o ataque rápido de qualquer um adianta
    if (this.phase === 'intro') {
      if (inputs.some((inp) => inp.a1P)) this.phaseT = this.introLen;
      if (this.phaseT >= this.introLen) this.skipIntro();
    }

    if (this.phase === 'countdown') {
      const steps = { 1: '3', 50: '2', 100: '1' };
      if (steps[this.phaseT]) { this.emit('announce', steps[this.phaseT], 'count'); this.emit('sfx', 'beep'); }
      if (this.phaseT === 150) {
        this.emit('announce', 'FIGHT!', 'fight');
        this.emit('sfx', 'fight');
        this.phase = 'fight';
        this.controlsEnabled = true;
      }
    }

    if (this.phase === 'over') {
      inputs.forEach((inp, i) => { if (inp.a1P) this.acceptRematch(i); });
    }

    if (this.hitstop > 0) { this.hitstop--; return; }

    const [a, b] = this.fighters;
    if (this.bot) inputs[1] = this.bot.think(b, a, this);
    a.tick(this.controlsEnabled ? inputs[0] : NO_INPUT, b, this);
    b.tick(this.controlsEnabled ? inputs[1] : NO_INPUT, a, this);
    this.separate(a, b);
    this.updateProjectiles();

    if (this.phase === 'fight' && this.time > 0 && ++this.timeAcc >= 60) {
      this.timeAcc = 0;
      if (--this.time === 0) this.timeUp();
    }
    if (this.phase === 'ko' && this.phaseT === 110) this.finish();
  }

  // antes do "3, 2, 1": "ticks" de preparação com os controles na tela (ver main.js)
  startIntro(ticks) {
    this.phase = 'intro';
    this.phaseT = 0;
    this.introLen = ticks;
  }

  skipIntro() {
    if (this.phase !== 'intro') return;
    this.phase = 'countdown';
    this.phaseT = 0;
  }

  // impede que um atravesse o outro (exceto pulando por cima)
  separate(a, b) {
    if (a.state === 'ko' || b.state === 'ko') return;
    if (Math.abs(a.y - b.y) > 190) return;
    const dx = b.x - a.x;
    const gap = CK.PUSH_DIST - Math.abs(dx);
    if (gap <= 0) return;
    const s = dx !== 0 ? Math.sign(dx) : a.facing;
    // sem paredes: quem passa da borda reaparece do outro lado
    a.x = CK.wrapX(a.x - (s * gap) / 2);
    b.x = CK.wrapX(b.x + (s * gap) / 2);
  }

  spawnProjectile(f, p) {
    const fx = window.FX[p.fx];
    const s = CK.SCALE;
    const x = f.x + f.facing * (fx.dx + fx.w / 2) * s;
    const y = f.y + (fx.dy + fx.h / 2) * s;
    const pr = {
      owner: f, dir: f.facing, fx, p,
      px: f.x,   // posição anterior: a colisão varre de px até x (não atravessa quem está colado)
      py: y,
      x,
      y,
      x0: x,             // onde nasceu (alcance da onda)
      y0: y,
      v: p.speed,        // velocidade atual (o bumerangue fica negativo na volta)
      vy: p.vy || 0,
      t: 0,
      bounces: 0,
      immune: 0,         // ticks sem poder acertar de novo (bumerangue)
      k: 1,              // escala extra (a onda cresce)
      alpha: 1,
    };
    this.projectiles.push(pr);
    this.emit('sfx', 'shot', f.charId);
  }

  updateProjectiles() {
    for (const pr of this.projectiles) {
      this.moveProjectile(pr);
      if (pr.dead) continue;
      const energy = pr.p.style === 'energy';
      const dir = Math.sign(pr.v) * pr.dir || pr.dir;   // sentido real (o bumerangue volta)
      if (pr.p.kind !== 'blink') {
        // o rastro fica atrás do projétil, na direção em que ele anda
        if (energy) this.emit('fx', 'energyTrail', pr.x - dir * 70 * pr.k, pr.y, pr.owner.def.spark);
        else this.emit('fx', 'trail', pr.x - dir * 55, pr.y);
      }
      const target = this.fighters[1 - pr.owner.idx];
      const hurt = target.hurtbox();
      const [w, h] = (pr.p.size || [70, 28]).map((n) => n * pr.k);
      const x0 = Math.min(pr.px, pr.x) - w / 2;
      const y0 = Math.min(pr.py, pr.y) - h / 2;
      const sweep = { x: x0, y: y0, w: Math.max(pr.px, pr.x) + w / 2 - x0, h: Math.max(pr.py, pr.y) + h / 2 - y0 };
      pr.px = pr.x;
      pr.py = pr.y;
      if (pr.immune > 0) pr.immune--;
      else if (pr.p.hitSpeed && Math.abs(pr.v) < pr.p.hitSpeed) continue;   // freando quase parado não machuca
      else if (hurt && CK.overlap(sweep, hurt)) {
        if (energy) this.emit('fx', 'energyBurst', pr.x, pr.y, pr.owner.def.spark);
        else this.emit('fx', 'explosion', pr.x, pr.y);
        this.hit(pr.owner, target, pr.p, pr.x, pr.y, dir);
        if (pr.p.kind === 'boomerang' && pr.v > 0) {
          // na ida: volta na hora para a mão, sem acertar de novo
          pr.v = -Math.min(pr.v, 450);
          pr.immune = Infinity;
        } else {
          pr.dead = true;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  // trajetória de cada tipo de projétil (p.kind); sem kind = reto, com aceleração opcional
  moveProjectile(pr) {
    const p = pr.p;
    pr.t++;
    switch (p.kind) {
      case 'boomerang': {
        // freia, inverte e volta para a mão de quem jogou
        pr.v = Math.max(-p.speed, pr.v - p.decel * CK.DT);
        pr.x += pr.dir * pr.v * CK.DT;
        const ty = (pr.v > 0 ? CK.GROUND : pr.owner.y) + p.height;   // volta na mesma altura da ida
        pr.y += (ty - pr.y) * 0.12;
        if (pr.v < 0 && Math.abs(pr.x - pr.owner.x) < 70) this.caught(pr);   // pegou de volta
        break;
      }
      case 'bounce': {
        // bola com gravidade quicando no chão
        const r = (p.size || [60, 60])[1] / 2;
        pr.vy += p.grav * CK.DT;
        pr.y += pr.vy * CK.DT;
        pr.x += pr.dir * pr.v * CK.DT;
        if (pr.y > CK.GROUND - r) {
          pr.y = CK.GROUND - r;
          pr.vy = -Math.abs(pr.vy) * p.bounce;
          if (++pr.bounces > (p.bounces ?? 4)) {
            pr.dead = true;
            if (p.blast) this.blast(pr);
            // sem quique (bounces: 0): estoura onde cai
            else if (!p.bounces && p.style === 'energy') this.emit('fx', 'energyBurst', pr.x, pr.y, pr.owner.def.spark);
          }
          this.emit('fx', 'dust', pr.x, CK.GROUND, 3);
          this.emit('sfx', 'bounce');
        }
        break;
      }
      case 'blink': {
        // parado, mas some e reaparece mais à frente a cada "every" ticks
        if (pr.t % p.every === 0) {
          pr.x += pr.dir * p.step;
          this.emit('sfx', 'blink');
        }
        pr.y += (CK.GROUND + p.height - pr.y) * 0.12;
        break;
      }
      default: {
        if (p.accel) pr.v = Math.min(p.maxSpeed || Infinity, pr.v + p.accel * CK.DT);
        pr.x += pr.dir * pr.v * CK.DT;
        pr.y += (CK.GROUND + p.height - pr.y) * 0.12;
        if (p.kind === 'wave') {
          // cresce e some depois de "range" pixels
          const k = Math.abs(pr.x - pr.x0) / p.range;
          pr.k = 1 + k * (p.grow - 1);
          pr.alpha = Math.min(1, (1 - k) * 3);
          if (k >= 1) pr.dead = true;
        }
      }
    }
    if (pr.x < -150 || pr.x > CK.W + 150) pr.dead = true;
  }

  // bomba: estoura no chão e acerta quem estiver a até "blast" px da explosão
  blast(pr) {
    const x = pr.x, y = CK.GROUND - 40;
    this.emit('fx', 'explosion', x, y);
    this.emit('fx', 'dust', x, CK.GROUND, 8);
    this.emit('fx', 'addShake', 12);
    const target = this.fighters[1 - pr.owner.idx];
    const hurt = target.hurtbox();
    // distância da explosão até o corpo: de lado ou até os pés (pulando alto dá para escapar)
    const d = hurt ? Math.max(hurt.x - x, x - (hurt.x + hurt.w), CK.GROUND - (hurt.y + hurt.h)) : Infinity;
    if (d <= pr.p.blast) this.hit(pr.owner, target, pr.p, x, y, target.x >= x ? 1 : -1);
    else this.emit('sfx', 'shotHit', pr.owner.charId);
  }

  // o bumerangue voltou para a mão de quem jogou
  caught(pr) {
    pr.dead = true;
    this.emit('sfx', 'catch');
  }

  // dir só vem dos projéteis (o golpe corpo a corpo usa a posição do atacante)
  hit(att, def, a, px, py, dir) {
    if (def.state === 'ko' || this.phase === 'over') return;
    const heavy = a.dmg >= 12;
    const from = dir || (att.x <= def.x ? 1 : -1);
    if (def.blocks(from)) {
      def.takeBlock(a, from);
      this.emit('fx', 'block', px, py, def.def.spark);
      this.emit('fx', 'addShake', 4);
      this.emit('sfx', 'block');
      this.hitstop = 4;
      return;
    }
    def.takeHit(a, from);
    this.emit('fx', 'hit', px, py, att.def.spark, heavy);
    this.emit('fx', 'addShake', heavy ? 16 : 7);
    this.emit('sfx', heavy ? 'heavyHit' : 'hit');
    this.emit('sfx', dir ? 'shotHit' : 'a1Hit', att.charId);
    if (def.hp > 0) this.emit('sfx', 'hurt', def.charId);
    if (a.status && a.status.invert) this.emit('sfx', 'glitched');
    if (a.status && a.status.slow) this.emit('sfx', 'wrapped');
    this.hitstop = heavy ? 9 : 5;
    if (a.heal && att.hp > 0) {
      att.hp = Math.min(att.maxHp, att.hp + a.heal);
      att.trailHp = Math.max(att.trailHp, att.hp);
      this.emit('sfx', 'heal');
      this.emit('fx', 'label', att.x, att.y - CK.HURT_H - 30, `+${a.heal}`, '#7dff8a');
    }
    if (def.hp <= 0 && this.phase === 'fight') this.ko(att);
  }

  ko(winner) {
    this.phase = 'ko';
    this.phaseT = 0;
    this.controlsEnabled = false;
    this.winner = winner;
    this.slowmo = 45;
    this.emit('announce', 'K.O.', 'ko');
    this.emit('sfx', 'ko');
    this.emit('sfx', 'koVoice', this.fighters[1 - winner.idx].charId);
  }

  timeUp() {
    const [a, b] = this.fighters;
    this.phase = 'ko';
    this.phaseT = 0;
    this.controlsEnabled = false;
    // vidas máximas diferentes: vence quem tem a maior porcentagem
    const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    this.winner = ra === rb ? null : ra > rb ? a : b;
    this.emit('announce', 'TEMPO!', 'ko');
    this.emit('sfx', 'timeUp');
  }

  finish() {
    this.phase = 'over';
    if (this.onFinish) this.onFinish(this.winner ? this.winner.idx : -1);   // placar da partida em rede
    let title = 'Empate!';
    if (this.winner) {
      this.winner.setState('win');
      this.emit('sfx', 'win');
      title = this.bot ? (this.winner.idx === 0 ? 'Você venceu!' : 'Você perdeu!')
        : `${this.names ? this.names[this.winner.idx] : this.winner.def.name} vence!`;
    }
    this.emit('result', title, this.winner ? this.winner.idx : -1);
    if (this.bot && !this.noRematch) {   // o computador sempre aceita a revanche
      this.rematch[1] = true;
      this.emit('rematch', this.rematch);
    }
  }

  acceptRematch(i) {
    if (this.phase !== 'over' || this.rematch[i] || this.noRematch) return;
    this.rematch[i] = true;
    this.emit('sfx', 'confirm');
    this.emit('rematch', this.rematch);
    if (this.rematch[0] && this.rematch[1]) this.reset();
  }

  // sons, avisos e efeitos visuais: executa aqui e, no anfitrião em rede, guarda para enviar
  emit(type, ...args) {
    CK.present(type, args);
    if (this.events) this.events.push([type, ...args]);
  }

  // estado completo da luta para enviar pela rede (os clientes só desenham)
  serialize() {
    return {
      f: this.fighters.map((f) => f.serialize()),
      p: this.projectiles.map((pr) => ({
        o: pr.owner.idx, d: pr.dir, x: pr.x, y: pr.y, t: pr.t, k: pr.k, a: pr.alpha,
        q: { fx: pr.p.fx, kind: pr.p.kind, every: pr.p.every, scale: pr.p.scale, spin: pr.p.spin },
      })),
      ph: this.phase, pt: this.phaseT, hs: this.hitstop, sm: this.slowmo, tm: this.time,
      ce: this.controlsEnabled, rm: this.rematch, w: this.winner ? this.winner.idx : -1,
    };
  }

  applyState(s) {
    s.f.forEach((st, i) => this.fighters[i].applyState(st));
    this.projectiles = s.p.map((p) => ({
      owner: this.fighters[p.o], dir: p.d, x: p.x, y: p.y, t: p.t, k: p.k, alpha: p.a, p: p.q, fx: window.FX[p.q.fx],
    }));
    this.phase = s.ph;
    this.phaseT = s.pt;
    this.hitstop = s.hs;
    this.slowmo = s.sm;
    this.time = s.tm;
    this.controlsEnabled = s.ce;
    this.rematch = s.rm;
    this.winner = s.w >= 0 ? this.fighters[s.w] : null;
  }

  draw(ctx, time) {
    CK.Stage.draw(ctx, this.stage);
    ctx.save();
    const sh = CK.Effects.shake;
    if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    // quem está atacando é desenhado por cima
    const rank = (f) => (f.state === 'attack1' || f.state === 'attack2' ? 1 : 0);
    const order = [...this.fighters].sort((a, b) => rank(a) - rank(b));
    for (const f of order) f.draw(ctx, this.settings.showBoxes);
    for (const pr of this.projectiles) {
      const img = CK.images[pr.fx.src];
      ctx.save();
      ctx.globalAlpha = pr.alpha;
      if (pr.p.kind === 'blink' && pr.t % pr.p.every < 2) ctx.globalAlpha = 0.35;   // pisca ao teleportar
      ctx.translate(pr.x, pr.y);
      const k = CK.SCALE * (pr.p.scale || 1) * pr.k;
      ctx.scale(pr.dir * k, k);
      ctx.rotate((-pr.fx.angle * Math.PI) / 180 + (pr.p.spin || 0) * time);
      ctx.drawImage(img, -pr.fx.w / 2, -pr.fx.h / 2, pr.fx.w, pr.fx.h);
      ctx.restore();
    }
    CK.Effects.draw(ctx);
    ctx.restore();
  }
};
