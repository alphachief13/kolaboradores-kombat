// Uma partida: contagem regressiva, combate, projéteis, K.O., tempo e revanche.
const NO_INPUT = { left: false, right: false, up: false, a1: false, a2: false, upP: false, a1P: false, a2P: false };

CK.Game = class Game {
  constructor(charA, charB, settings, demo = false) {
    this.fighters = [new CK.Fighter(0, charA), new CK.Fighter(1, charB)];
    this.settings = settings;
    this.demo = demo;
    this.reset();
  }

  reset() {
    for (const f of this.fighters) f.reset();
    this.projectiles = [];
    CK.Effects.clear();
    this.phase = this.demo ? 'demo' : 'countdown';
    this.phaseT = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.time = this.settings.roundTime;
    this.timeAcc = 0;
    this.controlsEnabled = false;
    this.rematch = [false, false];
    this.winner = null;
    if (!this.demo) {
      CK.UI.hideResult();
      CK.UI.updateHud(this);
    }
  }

  tick(inputs) {
    CK.Effects.update(CK.DT);
    this.phaseT++;
    if (this.slowmo > 0) this.slowmo--;

    if (this.phase === 'countdown') {
      const steps = { 1: '3', 50: '2', 100: '1' };
      if (steps[this.phaseT]) { CK.UI.announce(steps[this.phaseT], 'count'); CK.Sfx.play('beep'); }
      if (this.phaseT === 150) {
        CK.UI.announce('FIGHT!', 'fight');
        CK.Sfx.play('fight');
        this.phase = 'fight';
        this.controlsEnabled = true;
      }
    }

    if (this.phase === 'over') {
      inputs.forEach((inp, i) => { if (inp.a1P) this.acceptRematch(i); });
    }

    if (this.hitstop > 0) { this.hitstop--; return; }

    const [a, b] = this.fighters;
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

  spawnProjectile(f, p) {
    const fx = window.FX[p.fx];
    const s = CK.SCALE;
    this.projectiles.push({
      owner: f, dir: f.facing, fx, p,
      x: f.x + f.facing * (fx.dx + fx.w / 2) * s,
      y: f.y + (fx.dy + fx.h / 2) * s,
    });
    CK.Sfx.play('rocket');
  }

  updateProjectiles() {
    for (const pr of this.projectiles) {
      pr.x += pr.dir * pr.p.speed * CK.DT;
      pr.y += (CK.GROUND + pr.p.height - pr.y) * 0.12;
      CK.Effects.trail(pr.x - pr.dir * 55, pr.y);
      const target = this.fighters[1 - pr.owner.idx];
      const hurt = target.hurtbox();
      if (hurt && CK.overlap({ x: pr.x - 35, y: pr.y - 14, w: 70, h: 28 }, hurt)) {
        pr.dead = true;
        CK.Effects.explosion(pr.x, pr.y);
        CK.Sfx.play('boom');
        this.hit(pr.owner, target, pr.p, pr.x, pr.y, pr.dir);
      } else if (pr.x < -150 || pr.x > CK.W + 150) {
        pr.dead = true;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  hit(att, def, a, px, py, dir) {
    if (def.state === 'ko' || this.phase === 'over') return;
    const heavy = a.dmg >= 12;
    def.takeHit(a, dir || (att.x <= def.x ? 1 : -1));
    CK.Effects.hit(px, py, att.def.spark, heavy);
    CK.Effects.addShake(heavy ? 16 : 7);
    CK.Sfx.play(heavy ? 'heavyHit' : 'hit');
    this.hitstop = heavy ? 9 : 5;
    if (def.hp <= 0 && this.phase === 'fight') this.ko(att);
  }

  ko(winner) {
    this.phase = 'ko';
    this.phaseT = 0;
    this.controlsEnabled = false;
    this.winner = winner;
    this.slowmo = 45;
    CK.UI.announce('K.O.', 'ko');
    CK.Sfx.play('ko');
  }

  timeUp() {
    const [a, b] = this.fighters;
    this.phase = 'ko';
    this.phaseT = 0;
    this.controlsEnabled = false;
    this.winner = a.hp === b.hp ? null : a.hp > b.hp ? a : b;
    CK.UI.announce('TEMPO!', 'ko');
    CK.Sfx.play('ko');
  }

  finish() {
    this.phase = 'over';
    let title = 'Empate!';
    if (this.winner) {
      this.winner.setState('win');
      title = `${this.winner.def.name} vence!`;
    }
    CK.UI.showResult(title, this.winner ? this.winner.idx : -1);
  }

  acceptRematch(i) {
    if (this.phase !== 'over' || this.rematch[i]) return;
    this.rematch[i] = true;
    CK.Sfx.play('confirm');
    CK.UI.updateRematch(this.rematch);
    if (this.rematch[0] && this.rematch[1]) this.reset();
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
      ctx.translate(pr.x, pr.y);
      ctx.scale(pr.dir * CK.SCALE, CK.SCALE);
      ctx.rotate((-pr.fx.angle * Math.PI) / 180);
      ctx.drawImage(img, -pr.fx.w / 2, -pr.fx.h / 2, pr.fx.w, pr.fx.h);
      ctx.restore();
    }
    CK.Effects.draw(ctx);
    ctx.restore();
  }
};
