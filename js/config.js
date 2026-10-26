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
    attacks: {
      attack1: {
        name: 'Cassetete Tático',
        desc: 'Pancada rápida e curta. Dá para usar sem parar.',
        preview: 2,
        ticks: [5, 5, 7, 7],
        active: [10, 17],
        box: [30, -240, 175, 130],
        dmg: 7, stun: 16, kb: 260,
      },
      attack2: {
        name: 'Bazuca Tubarão',
        desc: 'Dispara um míssil que cruza a arena. Lento para recarregar — pule por cima!',
        preview: 1,
        ticks: [14, 10, 10, 14, 14],
        heavy: true,
        projectile: { at: 34, fx: 'rocket', speed: 820, height: -175, dmg: 15, stun: 28, kb: 480 },
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
        desc: 'Carrega o boné de energia e o arremessa pela arena. Lento para preparar — pule por cima!',
        preview: 1,
        ticks: [12, 14, 18, 12],
        heavy: true,
        projectile: {
          at: 26, fx: 'capwave', speed: 780, height: -150, size: [130, 90],
          style: 'energy', dmg: 15, stun: 28, kb: 480,
        },
      },
    },
  },
};

CK.CHAR_IDS = Object.keys(CK.CHARACTERS);
