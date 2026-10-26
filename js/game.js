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

  // impede que um atravesse o outro (exceto pulando por cima)
  separate(a, b) {
    if (a.state === 'ko' || b.state === 'ko') return;
    if (Math.abs(a.y - b.y) > 190) return;
    const dx = b.x - a.x;
    const gap = CK.PUSH_DIST - Math.abs(dx);
    if (gap <= 0) return;
    const s = dx !== 0 ? Math.sign(dx) : a.facing;
    a.x -= (s * gap) / 2;
    b.x += (s * gap) / 2;
    const clamp = (f) => { f.x = Math.max(CK.LEFT, Math.min(CK.RIGHT, f.x)); };
    clamp(a);
    clamp(b);
    // encostado na parede: empurra só o outro
    const left = Math.abs(b.x - a.x);
    if (left < CK.PUSH_DIST) {
      if (a.x <= CK.LEFT || a.x >= CK.RIGHT) b.x = a.x + s * CK.PUSH_DIST;
      else a.x = b.x - s * CK.PUSH_DIST;
      clamp(a);
      clamp(b);
    }
  }

  // aim: [x, y] mirado com o mouse (vai em linha reta até lá e segue em frente); sem aim, reto à frente
  spawnProjectile(f, p, aim) {
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
      ang: 0,            // inclinação do desenho (mira)
    };
    if (aim) {
      const len = Math.hypot(aim[0] - x, aim[1] - y) || 1;
      pr.ux = (aim[0] - x) / len;   // direção da mira (vetor unitário)
      pr.uy = (aim[1] - y) / len;
      if (p.kind === 'bounce') {
        // a bola é chutada na direção da mira e a gravidade faz o resto
        pr.v = pr.ux * pr.dir * p.speed;
        pr.vy = pr.uy * p.speed;
      } else if (p.kind !== 'boomerang' && !p.spin) {
        pr.ang = Math.atan2(pr.uy, pr.ux * pr.dir);
      }
    }
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
        const [bx, by] = pr.ux !== undefined && pr.p.kind !== 'bounce'
          ? [pr.ux * Math.sign(pr.v), pr.uy * Math.sign(pr.v)] : [dir, 0];
        if (energy) this.emit('fx', 'energyTrail', pr.x - bx * 70 * pr.k, pr.y - by * 70 * pr.k, pr.owner.def.spark);
        else this.emit('fx', 'trail', pr.x - bx * 55, pr.y - by * 55);
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
      else if (hurt && CK.overlap(sweep, hurt)) {
        if (energy) this.emit('fx', 'energyBurst', pr.x, pr.y, pr.owner.def.spark);
        else this.emit('fx', 'explosion', pr.x, pr.y);
        this.hit(pr.owner, target, pr.p, pr.x, pr.y, dir);
        if (pr.p.kind === 'boomerang' && pr.v > 0) {
          // na ida: volta na hora e pode acertar de novo no caminho de volta
          pr.v = -Math.min(pr.v, 450);
          pr.immune = 25;
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
    if (pr.ux !== undefined && p.kind !== 'bounce') return this.moveAimed(pr);
    switch (p.kind) {
      case 'boomerang': {
        // freia, inverte e volta para a mão de quem jogou
        pr.v = Math.max(-p.speed, pr.v - p.decel * CK.DT);
        pr.x += pr.dir * pr.v * CK.DT;
        const ty = pr.v > 0 ? CK.GROUND + p.height : pr.owner.y - 160;
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
            // sem quique (bounces: 0): estoura onde cai
            if (!p.bounces && p.style === 'energy') this.emit('fx', 'energyBurst', pr.x, pr.y, pr.owner.def.spark);
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

  // mesmas trajetórias, mas seguindo a direção da mira (ux, uy) em vez da altura fixa
  moveAimed(pr) {
    const p = pr.p;
    const { ux, uy } = pr;
    switch (p.kind) {
      case 'boomerang': {
        pr.v = Math.max(-p.speed, pr.v - p.decel * CK.DT);
        if (pr.v > 0) {
          pr.x += ux * pr.v * CK.DT;
          pr.y += uy * pr.v * CK.DT;
        } else {
          // na volta, persegue a mão de quem jogou
          const tx = pr.owner.x - pr.x, ty = pr.owner.y - 160 - pr.y;
          const d = Math.hypot(tx, ty) || 1;
          pr.x += (tx / d) * -pr.v * CK.DT;
          pr.y += (ty / d) * -pr.v * CK.DT;
          if (d < 80) this.caught(pr);   // pegou de volta
        }
        break;
      }
      case 'blink': {
        if (pr.t % p.every === 0) {
          pr.x += ux * p.step;
          pr.y += uy * p.step;
          this.emit('sfx', 'blink');
        }
        break;
      }
      default: {
        if (p.accel) pr.v = Math.min(p.maxSpeed || Infinity, pr.v + p.accel * CK.DT);
        pr.x += ux * pr.v * CK.DT;
        pr.y += uy * pr.v * CK.DT;
        if (p.kind === 'wave') {
          const k = Math.hypot(pr.x - pr.x0, pr.y - pr.y0) / p.range;
          pr.k = 1 + k * (p.grow - 1);
          pr.alpha = Math.min(1, (1 - k) * 3);
          if (k >= 1) pr.dead = true;
        }
      }
    }
    // mirou no chão: estoura lá (o bumerangue raspa e volta)
    if (pr.y > CK.GROUND - 20) {
      if (p.kind === 'boomerang') {
        pr.y = CK.GROUND - 20;
        if (pr.v > 0) pr.v = 0;
      } else {
        pr.dead = true;
        if (p.style === 'energy') this.emit('fx', 'energyBurst', pr.x, CK.GROUND - 20, pr.owner.def.spark);
        else this.emit('fx', 'explosion', pr.x, CK.GROUND - 20);
        this.emit('fx', 'dust', pr.x, CK.GROUND, 5);
        this.emit('sfx', 'shotHit', pr.owner.charId);
      }
    }
    if (p.kind !== 'boomerang' && (pr.x < -150 || pr.x > CK.W + 150 || pr.y < -400)) pr.dead = true;
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
      const broke = def.takeBlock(a, from);
      this.emit('fx', 'block', px, py, def.def.spark, broke);
      this.emit('fx', 'addShake', broke ? 14 : 4);
      this.emit('sfx', broke ? 'guardBreak' : 'block');
      this.hitstop = broke ? 12 : 4;
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
    let title = 'Empate!';
    if (this.winner) {
      this.winner.setState('win');
      this.emit('sfx', 'win');
      title = this.bot ? (this.winner.idx === 0 ? 'Você venceu!' : 'Você perdeu!') : `${this.winner.def.name} vence!`;
    }
    this.emit('result', title, this.winner ? this.winner.idx : -1);
    if (this.bot) {          // o computador sempre aceita a revanche
      this.rematch[1] = true;
      this.emit('rematch', this.rematch);
    }
  }

  acceptRematch(i) {
    if (this.phase !== 'over' || this.rematch[i]) return;
    this.rematch[i] = true;
    this.emit('sfx', 'confirm');
    this.emit('rematch', this.rematch);
    if (this.rematch[0] && this.rematch[1]) this.reset();
  }

  // sons, avisos e efeitos visuais (ver CK.present)
  emit(type, ...args) {
    CK.present(type, args);
  }

  draw(ctx, time) {
    CK.Stage.draw(ctx, time);
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
      ctx.rotate(pr.ang + (-pr.fx.angle * Math.PI) / 180 + (pr.p.spin || 0) * time);
      ctx.drawImage(img, -pr.fx.w / 2, -pr.fx.h / 2, pr.fx.w, pr.fx.h);
      ctx.restore();
    }
    CK.Effects.draw(ctx);
    ctx.restore();
  }
};
