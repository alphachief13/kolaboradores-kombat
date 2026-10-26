// Um lutador: máquina de estados, física, caixas de colisão e animação por sprites.
CK.images = {};

CK.Fighter = class Fighter {
  constructor(idx, charId) {
    this.idx = idx;
    this.charId = charId;
    this.def = CK.CHARACTERS[charId];
    this.frames = window.FRAMES[charId];
    this.reset();
  }

  reset() {
    this.x = this.idx === 0 ? 360 : 920;
    this.y = CK.GROUND;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.idx === 0 ? 1 : -1;
    this.hp = CK.MAX_HP;
    this.trailHp = CK.MAX_HP;    // barra "fantasma" que desce devagar
    this.state = 'idle';
    this.t = 0;
    this.clock = 0;
    this.anim = 'idle';
    this.frame = 0;
    this.flash = 0;
    this.atk = null;
    this.hasHit = false;
    this.stun = 0;
  }

  get onGround() { return this.y >= CK.GROUND - 0.5; }
  get busy() { return this.state !== 'idle' && this.state !== 'walk'; }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  startAttack(name) {
    this.atk = this.def.attacks[name];
    this.hasHit = false;
    this.setState(name);
    if (this.onGround) this.vx = 0;
    CK.Sfx.play(this.atk.heavy ? 'heavySwing' : 'swing');
  }

  tick(inp, opp, game) {
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const canAct = game.controlsEnabled;
    this.t++;
    this.clock++;
    if (this.flash > 0) this.flash--;
    if (this.trailHp > this.hp) this.trailHp = Math.max(this.hp, this.trailHp - 0.35);

    switch (this.state) {
      case 'idle':
      case 'walk':
        if (canAct && inp.a1P) this.startAttack('attack1');
        else if (canAct && inp.a2P) this.startAttack('attack2');
        else if (canAct && (inp.up || inp.upP)) { this.setState('prejump'); this.vx = 0; }
        else if (canAct && dir) {
          this.vx = dir * (dir === this.facing ? CK.WALK : CK.BACK);
          if (this.state !== 'walk') this.setState('walk');
        } else {
          this.vx = 0;
          if (this.state !== 'idle') this.setState('idle');
        }
        break;
      case 'prejump':
        if (this.t >= 4) {
          this.vy = -CK.JUMP_V;
          this.vx = dir * CK.AIR;
          this.setState('air');
          CK.Sfx.play('jump');
        }
        break;
      case 'air':
        if (canAct && inp.a1P) this.startAttack('attack1');
        else if (canAct && inp.a2P) this.startAttack('attack2');
        break;
      case 'land':
        this.vx = 0;
        if (this.t >= 6) this.setState('idle');
        break;
      case 'attack1':
      case 'attack2':
        this.updateAttack(opp, game);
        break;
      case 'hit':
        this.vx *= 0.88;
        if (this.t >= this.stun) this.setState(this.onGround ? 'idle' : 'air');
        break;
      case 'ko':
        if (this.onGround) this.vx *= 0.9;
        break;
      case 'win':
        this.vx = 0;
        break;
    }

    // física
    const wasAir = !this.onGround;
    if (wasAir || this.vy < 0) this.vy += CK.GRAVITY * CK.DT;
    this.y += this.vy * CK.DT;
    this.x += this.vx * CK.DT;
    if (this.y >= CK.GROUND) {
      this.y = CK.GROUND;
      if (wasAir) {
        this.vy = 0;
        CK.Effects.dust(this.x, CK.GROUND, 6);
        CK.Sfx.play('land');
        if (this.state === 'air') this.setState('land');
        else if (this.state === 'attack1' || this.state === 'attack2') this.vx = 0;
      }
    }
    this.x = Math.max(CK.LEFT, Math.min(CK.RIGHT, this.x));

    if (['idle', 'walk', 'prejump', 'land'].includes(this.state)) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }
    this.updateAnim();
  }

  updateAttack(opp, game) {
    const a = this.atk;
    if (a.active && !this.hasHit && this.t >= a.active[0] && this.t <= a.active[1]) {
      const hb = this.hitbox(a.box);
      const hurt = opp.hurtbox();
      if (hurt && overlap(hb, hurt)) {
        this.hasHit = true;
        const px = (Math.max(hb.x, hurt.x) + Math.min(hb.x + hb.w, hurt.x + hurt.w)) / 2;
        const py = (Math.max(hb.y, hurt.y) + Math.min(hb.y + hb.h, hurt.y + hurt.h)) / 2;
        game.hit(this, opp, a, px, py);
      }
    }
    if (a.projectile && this.t === a.projectile.at) game.spawnProjectile(this, a.projectile);
    const total = a.ticks.reduce((s, n) => s + n, 0);
    if (this.t >= total) this.setState(this.onGround ? 'idle' : 'air');
  }

  takeHit(a, fromDir) {
    this.hp = Math.max(0, this.hp - a.dmg);
    this.flash = 6;
    this.vx = fromDir * a.kb;
    if (this.hp <= 0) {
      this.setState('ko');
      this.vx = fromDir * a.kb * 1.4;
      this.vy = -650;
      return;
    }
    this.setState('hit');
    this.stun = a.stun;
    if (!this.onGround) this.vy = -350;
  }

  hitbox(box) {
    const [ox, oy, w, h] = box;
    return { x: this.facing > 0 ? this.x + ox : this.x - ox - w, y: this.y + oy, w, h };
  }

  hurtbox() {
    if (this.state === 'ko') return null;
    return { x: this.x - CK.HURT_W / 2, y: this.y - CK.HURT_H, w: CK.HURT_W, h: CK.HURT_H };
  }

  updateAnim() {
    const t = this.t;
    switch (this.state) {
      case 'idle': {
        const seq = this.def.idle;
        this.set('idle', seq[Math.floor(this.clock / 12) % seq.length]);
        break;
      }
      case 'walk': {
        const k = Math.floor(this.clock / 6) % 6;
        this.set('walk', Math.sign(this.vx) === this.facing ? k : 5 - k);
        break;
      }
      case 'prejump': this.set('jump', 0); break;
      case 'air': this.set('jump', this.vy < 0 ? 1 : 2); break;
      case 'land': this.set('jump', 3); break;
      case 'attack1':
      case 'attack2': {
        let acc = 0, f = 0;
        const ticks = this.atk.ticks;
        while (f < ticks.length - 1 && t >= acc + ticks[f]) acc += ticks[f++];
        this.set(this.state, f);
        break;
      }
      case 'hit': this.set('hit', Math.min(2, Math.floor((t / this.stun) * 3))); break;
      case 'ko': this.set('ko', Math.min(this.frames.ko.length - 1, Math.floor(t / 9))); break;
      case 'win': {
        const seq = this.def.taunt;
        this.set('idle', seq[Math.floor(t / 16) % seq.length]);
        break;
      }
    }
  }

  set(anim, frame) {
    this.anim = anim;
    this.frame = frame;
  }

  draw(ctx, showBoxes) {
    const fr = this.frames[this.anim][this.frame];
    const img = CK.images[fr.src];
    const s = CK.SCALE;

    // sombra
    const lift = Math.min(1, (CK.GROUND - this.y) / 300);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.35 - lift * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(this.x, CK.GROUND + 4, 75 * (1 - lift * 0.4), 14 * (1 - lift * 0.4), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing * s, s);
    if (this.flash > 0) ctx.filter = 'brightness(2.4) saturate(0.4)';
    ctx.drawImage(img, -fr.ax, -fr.ay, fr.w, fr.h);
    ctx.restore();

    if (showBoxes) {
      ctx.save();
      ctx.lineWidth = 2;
      const hurt = this.hurtbox();
      if (hurt) {
        ctx.strokeStyle = '#3cf';
        ctx.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);
      }
      const a = this.atk;
      if ((this.state === 'attack1' || this.state === 'attack2') && a.active &&
          this.t >= a.active[0] && this.t <= a.active[1]) {
        const hb = this.hitbox(a.box);
        ctx.strokeStyle = '#f33';
        ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
      }
      ctx.restore();
    }
  }
};

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
CK.overlap = overlap;
