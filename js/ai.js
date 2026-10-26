// Oponente controlado pelo computador. A cada tick devolve uma entrada no mesmo formato do
// teclado ({ left, right, up, a1, a2, block, upP, a1P, a2P }), então o lutador não sabe que é um bot.
CK.BOT_LEVELS = {
  //        react: ticks até reagir a uma ameaça · think: ticks entre decisões
  //        aggro: vontade de atacar de perto · dodge: chance de reagir a ameaças · zone: chance de atirar de longe
  //        guard: chance de reagir defendendo em vez de pular/recuar
  easy:   { name: 'Fácil',   react: 26, think: 28, aggro: 0.35, dodge: 0.25, zone: 0.2,  combo: 0.1, guard: 0.2 },
  normal: { name: 'Normal',  react: 14, think: 16, aggro: 0.6,  dodge: 0.6,  zone: 0.4,  combo: 0.4, guard: 0.45 },
  hard:   { name: 'Difícil', react: 6,  think: 8,  aggro: 0.85, dodge: 0.92, zone: 0.55, combo: 0.8, guard: 0.6 },
};

CK.Bot = class Bot {
  constructor(level) {
    this.lv = CK.BOT_LEVELS[level] || CK.BOT_LEVELS.normal;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.move = 0;         // -1 recua, 0 parado, 1 avança (relativo ao oponente)
    this.next = 30;        // tick da próxima decisão
    this.cool = 0;         // tick a partir do qual pode atacar de novo
    this.queue = [];       // ações atrasadas pelo tempo de reação: { at, act }
    this.seen = new WeakMap(); // projéteis já notados → tick em que pode reagir (ou -1 = ignora)
    this.oppWasAttacking = false;
    this.blockUntil = 0;   // segura a defesa até este tick
  }

  later(act, delay) {
    this.queue.push({ at: this.t + delay, act });
  }

  think(me, opp, game) {
    const out = { left: false, right: false, up: false, a1: false, a2: false, block: false, upP: false, a1P: false, a2P: false, blockP: false };
    this.t++;
    if (!game.controlsEnabled || me.state === 'ko') { this.queue = []; return out; }

    const lv = this.lv;
    const rnd = Math.random;
    const dx = opp.x - me.x;
    const dist = Math.abs(dx);
    const toward = Math.sign(dx) || me.facing;
    const free = !me.busy;
    const oppAttacking = opp.state === 'attack1' || opp.state === 'attack2';
    const willBlock = () => rnd() < lv.guard;

    // pular projéteis: decide uma vez por projétil e pula quando ele está chegando
    for (const pr of game.projectiles) {
      if (pr.owner !== opp) continue;
      if (!this.seen.has(pr)) this.seen.set(pr, rnd() < lv.dodge ? this.t + lv.react : -1);
      const ready = this.seen.get(pr);
      const coming = Math.sign(me.x - pr.x) === (Math.sign(pr.v) * pr.dir || pr.dir);   // o bumerangue volta
      const eta = ((Math.abs(pr.x - me.x) - 100) / Math.max(200, Math.abs(pr.v))) * 60;
      if (ready >= 0 && this.t >= ready && coming && eta < 22 && free) {
        if (willBlock()) this.blockUntil = this.t + Math.max(0, eta) + 14;
        else {
          out.upP = out.up = true;
          this.move = rnd() < 0.5 ? 1 : 0;
        }
        this.seen.set(pr, -1);
      }
    }

    // reage quando o oponente começa um golpe de perto: defende, recua ou pula por cima
    if (oppAttacking && !this.oppWasAttacking && dist < 280 && rnd() < lv.dodge * 0.6) {
      this.later(willBlock() ? 'block' : rnd() < 0.7 ? 'back' : 'jump', lv.react);
    }
    this.oppWasAttacking = oppAttacking;

    // emenda golpes enquanto o oponente está atordoado
    if (free && opp.state === 'hit' && dist < 235 && this.t >= this.cool && rnd() < lv.combo * 0.25) {
      out.a1P = out.a1 = true;
      this.cool = this.t + 10;
    }

    // anti-aéreo / ataque no ar
    if (this.t >= this.cool && dist < 230 && rnd() < lv.aggro * 0.08) {
      if ((free && !opp.onGround) || me.state === 'air') {
        out.a1P = out.a1 = true;
        this.cool = this.t + 20;
      }
    }

    if (this.t >= this.next) this.decide(me, opp, dist, oppAttacking, game);

    // ações atrasadas que venceram
    this.queue = this.queue.filter((q) => {
      if (q.at > this.t) return true;
      if (q.act === 'a1') out.a1P = out.a1 = true;
      else if (q.act === 'a2') out.a2P = out.a2 = true;
      else if (q.act === 'jump') out.upP = out.up = true;
      else if (q.act === 'back') { this.move = -1; this.next = this.t + 18; }
      else if (q.act === 'block') this.blockUntil = this.t + 30;
      return false;
    });

    // nunca aperta um ataque se o lutador não pode executá-lo agora
    if (!free && me.state !== 'air') out.a1P = out.a2P = false;

    if (this.t < this.blockUntil) out.block = true;

    const dir = this.move * toward;
    out.right = dir > 0;
    out.left = dir < 0;
    return out;
  }

  decide(me, opp, dist, oppAttacking, game) {
    const lv = this.lv;
    const rnd = Math.random;
    const proj = me.def.attacks.attack2.projectile;
    // só atira se o disparo anterior já sumiu e, para a onda de curto alcance, se ela chega no rival
    const hasProjectile = !!proj && me.canShoot(game) && (!proj.range || dist < proj.range + 60);
    const losing = me.hp / me.maxHp < opp.hp / opp.maxHp - 0.2;
    const canAttack = this.t >= this.cool;
    const box = me.def.attacks.attack1.box;
    const reach = box ? box[0] + box[2] + 30 : 235;   // alcance do golpe rápido
    this.next = this.t + lv.think + Math.floor(rnd() * lv.think);

    if (dist < reach) {
      // de perto: bate, recua para respirar ou fica parado esperando o erro
      if (canAttack && !oppAttacking && rnd() < lv.aggro) {
        this.later('a1', 2 + Math.floor(rnd() * 4));
        this.cool = this.t + 24;
        this.move = 0;
      } else if (rnd() < lv.guard * 0.5) {
        // defende por antecipação: golpes rápidos demais não dão tempo de reagir
        this.blockUntil = this.t + 20 + Math.floor(rnd() * 25);
        this.move = 0;
      } else if (rnd() < (losing ? 0.6 : 0.35)) {
        this.move = -1;
      } else {
        this.move = rnd() < 0.5 ? 0 : 1;
      }
    } else if (dist < 480) {
      // meia distância: aproxima, às vezes pulando
      this.move = 1;
      if (rnd() < 0.12) this.later('jump', 1);
      else if (hasProjectile && canAttack && rnd() < lv.zone * 0.35) {
        this.later('a2', 1);
        this.cool = this.t + 70;
        this.move = 0;
      }
    } else {
      // longe: atira ou avança
      if (hasProjectile && canAttack && rnd() < lv.zone * (losing ? 1.4 : 1)) {
        this.later('a2', 1);
        this.cool = this.t + 80;
        this.move = 0;
      } else {
        this.move = rnd() < 0.85 ? 1 : 0;
      }
    }
  }
};
