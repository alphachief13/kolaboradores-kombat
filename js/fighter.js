// Um lutador: máquina de estados, física, caixas de colisão e animação por sprites.
CK.images = {};

CK.Fighter = class Fighter {
  constructor(idx, charId) {
    this.idx = idx;
    this.charId = charId;
    this.def = CK.CHARACTERS[charId];
    this.frames = window.FRAMES[charId];
    this.st = CK.statsOf(this.def);
    this.maxHp = this.st.hp;
    this.reset();
  }

  reset() {
    this.x = this.idx === 0 ? 360 : 920;
    this.y = CK.GROUND;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.idx === 0 ? 1 : -1;
    this.hp = this.maxHp;
    this.trailHp = this.maxHp;   // barra "fantasma" que desce devagar
    this.status = { invert: 0, slow: 0 };   // ticks restantes de cada efeito
    this.state = 'idle';
    this.t = 0;
    this.clock = 0;
    this.anim = 'idle';
    this.frame = 0;
    this.flash = 0;
    this.atk = null;
    this.hasHit = false;
    this.stun = 0;
    this.energy = CK.ENERGY;      // gasta no ataque forte e recupera sozinha
    this.stamina = CK.STAMINA;    // gasta no golpe rápido e no dash; volta mais rápido
    this.tap = { dir: 0, t: -99 }; // último toque em uma direção (toque duplo = dash)
  }

  get onGround() { return this.y >= CK.GROUND - 0.5; }
  get busy() { return this.state !== 'idle' && this.state !== 'walk'; }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  // o golpe rápido gasta fôlego (stamina): sem ele, não dá para ficar só batendo
  canStrike() {
    return this.stamina >= (this.def.attacks.attack1.stamina || 0);
  }

  // dash: arrancada rápida para o lado (o que estiver apertado ou, sem direção, para trás)
  canDash() {
    return this.onGround && this.stamina >= CK.DASH_COST;
  }

  startDash(dir) {
    this.stamina -= CK.DASH_COST;
    this.dashDir = dir || -this.facing;
    this.setState('dash');
    this.game.emit('fx', 'dust', this.x, CK.GROUND, 6);
    this.game.emit('sfx', 'dash', this.charId);
  }

  get dodging() { return this.state === 'dash' && this.t < CK.DASH_IFRAMES; }

  // só um disparo do especial por vez na arena, e só com energia suficiente
  canShoot(game) {
    const a = this.def.attacks.attack2;
    if (this.energy < (a.cost || 0)) return false;
    return !a.projectile || !game.projectiles.some((p) => p.owner === this);
  }

  startAttack(name) {
    this.atk = this.def.attacks[name];
    this.hasHit = false;
    this.hits = 0;
    this.nextHit = 0;
    this.setState(name);
    this.energy -= this.atk.cost || 0;
    this.stamina -= this.atk.stamina || 0;
    if (this.onGround) this.vx = 0;
    this.game.emit('sfx', name === 'attack1' ? 'a1' : 'a2', this.charId);
  }

  tick(inp, opp, game) {
    let dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (this.status.invert > 0) dir = -dir;          // glitch: controles invertidos
    const slow = this.status.slow > 0 ? 0.55 : 1;      // lã: movimentos mais lentos
    const st = this.st;
    const canAct = game.controlsEnabled;
    this.t++;
    this.clock++;
    if (this.flash > 0) this.flash--;
    for (const k in this.status) if (this.status[k] > 0) this.status[k]--;
    if (canAct && this.state !== 'attack2') this.energy = Math.min(CK.ENERGY, this.energy + CK.ENERGY_REGEN);
    if (canAct && this.state !== 'attack1' && this.state !== 'dash') this.stamina = Math.min(CK.STAMINA, this.stamina + CK.STAMINA_REGEN);
    // toque duplo na mesma direção em até 12 ticks também dá o dash
    let dash = canAct && inp.dashP;
    const tapDir = inp.leftP ? -1 : inp.rightP ? 1 : 0;
    if (canAct && tapDir) {
      if (tapDir === this.tap.dir && this.clock - this.tap.t <= 12) { dash = true; this.tap.dir = 0; }
      else this.tap = { dir: tapDir, t: this.clock };
    }
    if (this.trailHp > this.hp) this.trailHp = Math.max(this.hp, this.trailHp - 0.35);

    switch (this.state) {
      case 'idle':
      case 'walk':
        if (canAct && inp.a1P && this.canStrike()) this.startAttack('attack1');
        else if (canAct && inp.a2P && this.canShoot(game)) this.startAttack('attack2');
        else if (dash && this.canDash()) this.startDash(dir);
        else if (canAct && inp.block) { this.setState('block'); this.stun = 0; this.vx = 0; }
        else if (canAct && (inp.up || inp.upP)) { this.setState('prejump'); this.vx = 0; }
        else if (canAct && dir) {
          this.vx = dir * (dir === this.facing ? st.walk : st.back) * slow;
          if (this.state !== 'walk') this.setState('walk');
        } else {
          this.vx = 0;
          if (this.state !== 'idle') this.setState('idle');
        }
        break;
      case 'prejump':
        if (this.t >= 4) {
          this.vy = -st.jump * (slow < 1 ? 0.85 : 1);
          this.vx = dir * st.air * slow;
          this.setState('air');
          this.game.emit('sfx', 'jump', this.charId);
        }
        break;
      case 'air':
        if (canAct && inp.a1P && this.canStrike()) this.startAttack('attack1');
        else if (canAct && inp.a2P && this.canShoot(game)) this.startAttack('attack2');
        break;
      case 'dash': {
        // arranca forte e vai freando; no fim fica parado um instante (recuperação)
        const k = 1 - this.t / (CK.DASH_TICKS - 4);
        this.vx = k > 0 ? this.dashDir * CK.DASH_SPEED * k * slow : 0;
        if (this.t % 3 === 0 && k > 0) this.game.emit('fx', 'trail', this.x - this.dashDir * 40, this.y - 120);
        if (this.t >= CK.DASH_TICKS) this.setState('idle');
        break;
      }
      case 'land':
        this.vx = 0;
        if (this.t >= 6) this.setState('idle');
        break;
      case 'attack1':
      case 'attack2':
        this.updateAttack(opp, game);
        break;
      case 'block':
        // segurando a defesa; depois de defender um golpe fica preso por "stun" ticks (bloqueio)
        this.vx *= 0.85;
        if (this.t < this.stun) break;
        if (canAct && inp.a1P && this.canStrike()) this.startAttack('attack1');
        else if (canAct && inp.a2P && this.canShoot(game)) this.startAttack('attack2');
        else if (dash && this.canDash()) this.startDash(dir);
        else if (!canAct || !inp.block) this.setState('idle');
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
        this.game.emit('fx', 'dust', this.x, CK.GROUND, 6);
        this.game.emit('sfx', 'land');
        if (this.state === 'air') this.setState('land');
        else if (this.state === 'attack1' || this.state === 'attack2') this.vx = 0;
      }
    }
    this.x = CK.wrapX(this.x);   // saiu por um lado da arena, entra pelo outro

    const prevFrame = this.frame;
    if (['idle', 'walk', 'prejump', 'land', 'block'].includes(this.state)) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }
    this.updateAnim();
    // passos: quando o pé de trás ou o da frente toca o chão na caminhada
    if (this.state === 'walk' && this.frame !== prevFrame && this.frame % 3 === 0) this.game.emit('sfx', 'step');
  }

  updateAttack(opp, game) {
    const a = this.atk;
    // lunge: [de, até, velocidade] — avança sozinho durante o golpe
    if (a.lunge && this.onGround) {
      const [l0, l1, speed] = a.lunge;
      if (this.t >= l0 && this.t <= l1) this.vx = this.facing * speed * (1 - (this.t - l0) / (l1 - l0 + 1));
      else if (this.t > l1) this.vx = 0;
    }
    // hits: quantas vezes o golpe pode acertar · rehit: ticks entre um acerto e o próximo
    if (a.active && !this.hasHit && this.t >= this.nextHit && this.t >= a.active[0] && this.t <= a.active[1]) {
      const hb = this.hitbox(a.box);
      const hurt = opp.hurtbox();
      if (hurt && overlap(hb, hurt)) {
        this.hits++;
        this.hasHit = this.hits >= (a.hits || 1);
        this.nextHit = this.t + (a.rehit || 0);
        const px = (Math.max(hb.x, hurt.x) + Math.min(hb.x + hb.w, hurt.x + hurt.w)) / 2;
        const py = (Math.max(hb.y, hurt.y) + Math.min(hb.y + hb.h, hurt.y + hurt.h)) / 2;
        game.hit(this, opp, a, px, py);
      }
    }
    // shots: vários disparos no mesmo golpe, cada um com seu tick e altura
    const p = a.projectile;
    if (p) {
      for (const s of p.shots || [p]) {
        if (this.t !== s.at) continue;
        game.spawnProjectile(this, s === p ? p : { ...p, ...s });
      }
    }
    const total = a.ticks.reduce((s, n) => s + n, 0);
    if (this.t >= total) this.setState(this.onGround ? 'idle' : 'air');
  }

  // armor: [de, até] — durante esses ticks do golpe, apanha mas não é interrompido
  get armored() {
    const a = this.atk;
    return (this.state === 'attack1' || this.state === 'attack2') && a.armor &&
      this.t >= a.armor[0] && this.t <= a.armor[1];
  }

  // defende se está na defesa e de frente para o golpe (fromDir aponta do atacante para cá)
  blocks(fromDir) {
    return this.state === 'block' && this.facing === -fromDir;
  }

  // golpe defendido: tira pouca vida (nunca nocauteia) e não aplica efeitos; a defesa não quebra
  takeBlock(a, fromDir) {
    this.hp = Math.max(1, this.hp - a.dmg * CK.CHIP);
    this.vx = fromDir * a.kb * 0.5 * this.st.weight;
    this.setState('block');
    this.stun = Math.round(a.stun * 0.6);
  }

  takeHit(a, fromDir) {
    this.hp = Math.max(0, this.hp - a.dmg);
    this.flash = 6;
    if (a.status) for (const k in a.status) this.status[k] = a.status[k];
    if (this.hp > 0 && this.armored) return;
    const kb = a.kb * this.st.weight;
    this.vx = fromDir * kb;
    if (this.hp <= 0) {
      this.setState('ko');
      this.vx = fromDir * kb * 1.4;
      this.vy = -650;
      return;
    }
    this.setState('hit');
    this.stun = a.stun;
    if (!this.onGround) this.vy = -350;
  }

  // campos que mudam durante a luta (ver Game.serialize); o golpe vai pelo nome
  serialize() {
    const s = {};
    for (const k of Fighter.NET_KEYS) s[k] = this[k];
    s.status = { ...this.status };
    s.atk = this.atk === this.def.attacks.attack1 ? 1 : this.atk ? 2 : 0;
    return s;
  }

  applyState(s) {
    for (const k of Fighter.NET_KEYS) this[k] = s[k];
    this.status = s.status;
    this.atk = s.atk ? this.def.attacks['attack' + s.atk] : null;
  }

  hitbox(box) {
    const [ox, oy, w, h] = box;
    return { x: this.facing > 0 ? this.x + ox : this.x - ox - w, y: this.y + oy, w, h };
  }

  hurtbox() {
    if (this.state === 'ko' || this.dodging) return null;
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
      case 'walk':
      case 'dash': {
        // no dash as pernas giram três vezes mais rápido
        const k = Math.floor(this.clock / (this.state === 'dash' ? 2 : 6)) % 6;
        this.set('walk', Math.sign(this.vx || this.dashDir) === this.facing ? k : 5 - k);
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
      case 'block': this.set('jump', 0); break;          // agachado, se protegendo
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

    const { invert, slow } = this.status;
    ctx.save();
    // glitch: o lutador treme para os lados de vez em quando
    ctx.translate(this.x + (invert > 0 && this.clock % 9 < 2 ? (Math.random() - 0.5) * 24 : 0), this.y);
    ctx.scale(this.facing * s, s);
    if (this.flash > 0) ctx.filter = 'brightness(2.4) saturate(0.4)';
    else if (invert > 0) ctx.filter = `hue-rotate(${(this.clock * 23) % 360}deg) saturate(1.6)`;
    else if (slow > 0) ctx.filter = 'sepia(0.55) brightness(1.15)';
    if (this.armored) ctx.filter = 'brightness(1.3) drop-shadow(0 0 12px #fff)';
    if (this.dodging) ctx.globalAlpha = 0.55;   // invencível no começo do dash
    ctx.drawImage(img, -fr.ax, -fr.ay, fr.w, fr.h);
    ctx.restore();

    if (this.state === 'block') this.drawShield(ctx);

    // aviso do efeito em cima da cabeça
    const label = invert > 0 ? ['CONFUSO!', '#ff3a4a'] : slow > 0 ? ['ENROLADO!', '#fff1c9'] : null;
    if (label && this.state !== 'ko') {
      ctx.save();
      ctx.font = '26px Bangers, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1a0a14';
      const ty = this.y - CK.HURT_H - 24 + Math.sin(this.clock / 6) * 4;
      ctx.strokeText(label[0], this.x, ty);
      ctx.fillStyle = label[1];
      ctx.fillText(label[0], this.x, ty);
      ctx.restore();
    }

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

// escudo em arco na frente do lutador
CK.Fighter.prototype.drawShield = function (ctx) {
  const hit = this.t < this.stun;               // acabou de defender: escudo pisca
  const cx = this.x + this.facing * 20, cy = this.y - 140;
  const pulse = 0.5 + 0.5 * Math.sin(this.clock / 5);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(this.facing, 1);
  // bolha translúcida na frente do corpo
  const g = ctx.createRadialGradient(-40, 0, 40, -40, 0, 160);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, this.def.spark);
  ctx.globalAlpha = hit ? 0.55 : 0.25 + 0.1 * pulse;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 95, 150, 0, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  // borda brilhante
  ctx.globalAlpha = hit ? 1 : 0.6 + 0.3 * pulse;
  ctx.strokeStyle = hit ? '#fff' : this.def.spark;
  ctx.lineWidth = hit ? 9 : 5;
  ctx.shadowColor = this.def.spark;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(0, 0, 95, 150, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.restore();
};

CK.Fighter.NET_KEYS = ['x', 'y', 'vx', 'vy', 'facing', 'hp', 'trailHp', 'state', 't', 'clock',
  'anim', 'frame', 'flash', 'hasHit', 'hits', 'nextHit', 'stun', 'energy', 'stamina', 'dashDir'];

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
CK.overlap = overlap;

// a arena dá a volta: x sempre em [0, W)
CK.wrapX = (x) => ((x % CK.W) + CK.W) % CK.W;

