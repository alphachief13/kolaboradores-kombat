// Constantes do jogo e definição dos personagens.
// Distâncias em pixels do canvas (1280x720), tempos em ticks de 1/60 s.
window.CK = {
  W: 1280,
  H: 720,
  DT: 1 / 60,
  GROUND: 655,
  LEFT: 70,
  RIGHT: 1210,
  SCALE: 0.95,        // escala de desenho dos sprites (gerados com 300 px de altura)
  GRAVITY: 2700,
  JUMP_V: 1200,
  WALK: 340,
  BACK: 260,
  AIR: 330,
  PUSH_DIST: 115,     // distância mínima entre os dois lutadores
  MAX_HP: 100,
  HURT_W: 100,
  HURT_H: 270,
};

// box: [à frente dos pés, topo (negativo = acima do chão), largura, altura]
CK.CHARACTERS = {
  soldado: {
    name: 'Cabo Queijo',
    theme: 'Militar',
    desc: 'Rato das forças especiais. Pequeno no tamanho, gigante na disciplina — e no arsenal.',
    color: '#9bb03a',
    spark: '#ffe36b',
    idle: [0, 1, 0, 3],
    taunt: [2, 4, 5, 4],
    role: 'Artilheiro pesado',
    // lento e baixinho no pulo, mas aguenta pancada e tem o projétil mais forte do jogo
    stats: { hp: 110, walk: 310, back: 235, air: 290, jump: 1100, weight: 0.85 },
    attacks: {
      attack1: {
        name: 'Cassetete Tático',
        desc: 'Pancada curta e firme. Um pouco mais lenta, mas bate forte.',
        preview: 2,
        ticks: [6, 5, 7, 9],
        active: [11, 18],
        box: [30, -240, 185, 130],
        dmg: 9, stun: 17, kb: 280,
      },
      attack2: {
        name: 'Bazuca Tubarão',
        desc: 'O míssil sai devagar e vai acelerando até virar um foguete. Pule cedo!',
        preview: 1,
        ticks: [14, 10, 10, 14, 14],
        heavy: true,
        projectile: {
          at: 34, fx: 'rocket', speed: 400, accel: 2600, maxSpeed: 1500, height: -175,
          dmg: 18, stun: 30, kb: 520,
        },
      },
    },
  },
  bonezinho: {
    name: 'Bonézinho',
    theme: 'Mestre dos bonés',
    desc: 'Óculos no rosto, cachos no lugar e o boné sempre na cabeça — até a hora de usá-lo como arma.',
    color: '#3d5cff',
    spark: '#7fd4ff',
    idle: [0, 1, 0, 5],
    taunt: [2, 4, 2, 3],
    role: 'Equilibrado',
    // o "padrão" do jogo: nada sobra, nada falta
    stats: { hp: 100, walk: 340, back: 260, air: 330, jump: 1200, weight: 1 },
    attacks: {
      attack1: {
        name: 'Golpe de Aba',
        desc: 'Uma cabeçada de lado com a aba do boné. Rápida e certeira.',
        preview: 2,
        ticks: [5, 5, 7, 7],
        active: [9, 17],
        box: [30, -245, 190, 125],
        dmg: 7, stun: 16, kb: 260,
      },
      attack2: {
        name: 'Bumerangue Mágico',
        desc: 'Arremessa o boné, que vai, freia e volta para a mão — acerta na ida e na volta.',
        preview: 1,
        ticks: [10, 12, 14, 10],
        heavy: true,
        projectile: {
          at: 22, fx: 'capwave', kind: 'boomerang', speed: 950, decel: 700, height: -150,
          size: [130, 90], spin: 10, style: 'energy', dmg: 11, stun: 24, kb: 380,
        },
      },
    },
  },
  vr: {
    name: 'V R',
    theme: 'Mago do cubo',
    desc: 'Toga de formatura, cachos no capricho e um cubo mágico que gira sozinho na palma da mão.',
    color: '#2f6bff',
    spark: '#6fd8ff',
    idle: [0, 1, 2, 1],
    taunt: [3, 4, 5, 4],
    role: 'Zoneador técnico',
    // frágil e de pernas curtas, mas controla a distância com o maior alcance de soco e a rajada
    stats: { hp: 90, walk: 320, back: 250, air: 320, jump: 1180, weight: 1.05 },
    attacks: {
      attack1: {
        name: 'Golpe do Cubo',
        desc: 'Empurra o cubo carregado contra o rival. Mais lento, mas alcança longe.',
        preview: 2,
        ticks: [5, 5, 7, 8],
        active: [10, 18],
        box: [40, -235, 220, 120],
        dmg: 7, stun: 16, kb: 240,
      },
      attack2: {
        name: 'Chuva de Cubinhos',
        desc: 'Desmonta o cubo e dispara três peças em alturas diferentes. Difícil desviar de todas!',
        preview: 2,
        ticks: [10, 12, 14, 14, 12],
        heavy: true,
        projectile: {
          at: 22, fx: 'cubewave', speed: 820, height: -170, size: [70, 70], scale: 1.2,
          style: 'energy', dmg: 7, stun: 18, kb: 200,
          shots: [{ at: 22, height: -170 }, { at: 32, height: -230 }, { at: 42, height: -105 }],
        },
      },
    },
  },
  wanessinha: {
    name: 'Wanessinha',
    theme: 'Goleira',
    desc: 'Camisa 1, luvas de paredão e cachos ao vento. Pega tudo — e devolve com um chutaço.',
    color: '#d9a21b',
    spark: '#ffd23f',
    idle: [0, 1, 2, 1],
    taunt: [3, 4, 5, 4],
    role: 'Velocista',
    // a mais rápida e a que pula mais alto, mas é leve e tem pouca vida
    stats: { hp: 85, walk: 410, back: 320, air: 400, jump: 1350, weight: 1.1 },
    attacks: {
      attack1: {
        name: 'Soco de Luva',
        desc: 'O soco mais rápido do jogo. Fraquinho, mas sai na hora.',
        preview: 2,
        ticks: [4, 4, 6, 6],
        active: [7, 13],
        box: [30, -240, 190, 120],
        dmg: 6, stun: 14, kb: 220,
      },
      attack2: {
        name: 'Tiro de Meta',
        desc: 'Chuta a bola, que vai quicando pela arena. Acerte o tempo do pulo!',
        preview: 3,
        ticks: [12, 10, 10, 14, 12],
        heavy: true,
        projectile: {
          at: 32, fx: 'ball', kind: 'bounce', speed: 700, vy: -500, grav: 2400, bounce: 0.78,
          height: -150, size: [60, 60], spin: 14, style: 'energy', dmg: 13, stun: 26, kb: 450,
        },
      },
    },
  },
  deborah: {
    name: 'Dééééééborah',
    theme: 'Cordeira',
    desc: 'Cachos ruivos, orelhas de ovelha e lã por todo lado. Fofa até a primeira cabeçada.',
    color: '#a3203a',
    spark: '#fff1c9',
    idle: [0, 1, 0, 4],
    taunt: [2, 3, 5, 3],
    role: 'Tanque',
    // a mais vida e a mais pesada; lenta e de pulo baixo, avança de cabeça sem ser interrompida
    stats: { hp: 105, walk: 270, back: 210, air: 260, jump: 1000, weight: 0.8 },
    attacks: {
      attack1: {
        name: 'Cabeçada de Cordeira',
        desc: 'Avança de cabeça baixa e não para nem levando golpe. Lenta, mas teimosa.',
        preview: 2,
        ticks: [7, 6, 8, 9],
        active: [10, 18],
        lunge: [6, 16, 620],
        armor: [0, 10],
        box: [20, -250, 170, 130],
        dmg: 9, stun: 20, kb: 380,
      },
      attack2: {
        name: 'Bola de Lã',
        desc: 'Rola um novelo pelo chão. Quem for pego fica enrolado e lento por um tempo.',
        preview: 2,
        ticks: [12, 12, 14, 14, 12],
        heavy: true,
        projectile: {
          at: 24, fx: 'woolball', speed: 520, height: -55, size: [90, 70], spin: 10,
          style: 'energy', dmg: 8, stun: 30, kb: 200, status: { slow: 150 },
        },
      },
    },
  },
  petista: {
    name: 'Petista',
    theme: 'Militante',
    desc: 'Mochila nas costas, tênis vermelho no pé e um megafone sempre à mão. Não perde um debate — nem uma luta.',
    color: '#d81e1e',
    spark: '#ff5a4a',
    idle: [0, 1, 2, 1],
    taunt: [3, 4, 5, 4],
    role: 'Controle de espaço',
    // atributos medianos; empurra o rival para longe e acerta o soco duas vezes
    stats: { hp: 100, walk: 350, back: 270, air: 340, jump: 1200, weight: 1 },
    attacks: {
      attack1: {
        name: 'Livraço Vermelho',
        desc: 'Duas pancadas seguidas com o livro de capa dura. Cheio de argumentos.',
        preview: 2,
        ticks: [5, 5, 8, 8],
        active: [9, 20],
        hits: 2, rehit: 7,
        box: [30, -235, 205, 125],
        dmg: 4, stun: 16, kb: 140,
      },
      attack2: {
        name: 'Grito de Megafone',
        desc: 'Uma onda sonora de curto alcance que cresce e arremessa o rival para longe.',
        preview: 3,
        ticks: [12, 12, 12, 16, 12],
        heavy: true,
        projectile: {
          at: 24, fx: 'soundwave', kind: 'wave', speed: 950, range: 560, grow: 1.8,
          height: -190, size: [90, 130], scale: 1.4, style: 'energy', dmg: 11, stun: 24, kb: 1000,
        },
      },
    },
  },
  pastor: {
    name: 'Pastor',
    theme: 'Pregador',
    desc: 'Terno alinhado, gravata vermelha e a Bíblia sempre debaixo do braço. Prega a paz — mas sabe se defender.',
    color: '#c99a2e',
    spark: '#ffe08a',
    idle: [0, 1, 2, 1],
    taunt: [3, 4, 5, 4],
    role: 'Resistente',
    // lento, mas resistente; bate devagar e forte, e a onda de luz recupera vida
    stats: { hp: 110, walk: 300, back: 240, air: 300, jump: 1100, weight: 0.9 },
    attacks: {
      attack1: {
        name: 'Golpe da Palavra',
        desc: 'Uma pancada pesada com a Bíblia de capa dura. Lenta, mas abençoada.',
        preview: 2,
        ticks: [7, 5, 8, 10],
        active: [12, 20],
        box: [30, -235, 195, 125],
        dmg: 11, stun: 22, kb: 420,
      },
      attack2: {
        name: 'Onda de Luz',
        desc: 'Uma onda dourada lenta que, ao acertar, devolve vida ao Pastor.',
        preview: 3,
        ticks: [12, 14, 12, 16, 12],
        heavy: true,
        projectile: {
          at: 38, fx: 'holywave', speed: 480, height: -165, size: [70, 120], scale: 0.65,
          style: 'energy', dmg: 12, stun: 28, kb: 420, heal: 10,
        },
      },
    },
  },
  mrrobot: {
    name: 'Mr. Robot',
    theme: 'Hacker',
    desc: 'Capuz na cabeça, luvas sem dedo e um terminal no pulso. Invade qualquer sistema — inclusive a sua guarda.',
    color: '#c4182c',
    spark: '#ff2a3a',
    idle: [0, 1, 0, 5],
    taunt: [2, 3, 2, 4],
    attacks: {
      attack1: {
        name: 'Soco Holográfico',
        desc: 'Carrega o punho com código e acerta de perto. Rápido e preciso.',
        preview: 2,
        ticks: [5, 5, 7, 7],
        active: [10, 17],
        box: [30, -240, 200, 125],
        dmg: 7, stun: 16, kb: 260,
      },
      attack2: {
        name: 'Explosão de Glitch',
        desc: 'Digita no terminal do pulso e dispara um pacote de dados corrompidos pela arena. Lento para preparar — pule por cima!',
        preview: 2,
        ticks: [12, 12, 12, 14, 12],
        heavy: true,
        projectile: {
          at: 36, fx: 'glitch', speed: 820, height: -175, size: [80, 130],
          style: 'energy', dmg: 15, stun: 28, kb: 480,
        },
      },
    },
  },
};

CK.CHAR_IDS = Object.keys(CK.CHARACTERS);

// atributos do lutador; quem não define "stats" usa os valores padrão abaixo
CK.statsOf = (def) => ({
  hp: CK.MAX_HP, walk: CK.WALK, back: CK.BACK, air: CK.AIR, jump: CK.JUMP_V,
  weight: 1,          // multiplica o empurrão que leva (menor = mais pesado)
  guard: 100,         // resistência da defesa antes de quebrar
  ...def.stats,
});
