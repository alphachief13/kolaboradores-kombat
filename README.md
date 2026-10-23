# kolaboradores-kombat

**Cartoon Kombat**: jogo de luta 2D 1x1 para navegador, multiplayer local (dois jogadores no mesmo teclado ou com controles). HTML + CSS + JavaScript puro, sem build e sem servidor.

## Como jogar

Abra o `index.html` no navegador. Também roda servido por qualquer servidor estático (`npx serve .`, `python3 -m http.server`).

| Ação           | Jogador 1 | Jogador 2         | Controle   |
|----------------|-----------|-------------------|------------|
| Andar          | `A` / `D` | `←` / `→`         | direcional |
| Pular          | `W`       | `↑`               | A          |
| Ataque rápido  | `F`       | `K` ou `Num 1`    | X          |
| Ataque forte   | `G`       | `L` ou `Num 2`    | Y / B      |
| Pausar         | `Esc`     | `Esc`             |            |

Fluxo: menu → seleção de personagem (cada jogador escolhe e confirma) → contagem 3, 2, 1, FIGHT! → luta → K.O. → revanche quando os dois aceitam.

## Personagens

- **Cabo Queijo** (militar): cassetete tático (rápido) e bazuca tubarão (míssil que cruza a arena; dá para pular por cima).
- **Chef Calabresa** (cozinha italiana): fatia quente (rápido) e frigideira bolonhesa (golpe forte de médio alcance).

## Estrutura

```
index.html          telas e HUD
css/style.css       visual (a escala acompanha a janela pela variável --u)
js/config.js        constantes e dados dos personagens/ataques (dano, alcance, frames)
js/input.js         teclado + Gamepad API
js/fighter.js       máquina de estados, física, hitbox/hurtbox, animação
js/game.js          partida: contagem, colisão entre lutadores, projéteis, K.O., tempo, revanche
js/effects.js       partículas de impacto, explosão, poeira, tremor de tela
js/stage.js         arena desenhada no canvas
js/audio.js         efeitos sonoros sintetizados (WebAudio)
js/main.js          telas, seleção, configurações, laço principal (60 ticks/s fixos)
sprites/            folhas de sprite originais
assets/             quadros recortados + assets/frames.js (gerados)
tools/slice_sprites.py
```

## Sprites

As folhas em `sprites/` têm layouts irregulares. O script `tools/slice_sprites.py` encontra cada pose, recorta, normaliza a escala entre as folhas, calcula o ponto de apoio (pés) e gera `assets/`:

```
python3 tools/slice_sprites.py   # requer Pillow e numpy
```

Para adicionar um personagem: coloque as 7 folhas (idle, walk, jump, attack1, attack2, hit, ko), registre-as em `SHEETS` e `STAND_H` no script, rode o script e adicione a definição em `CK.CHARACTERS` (`js/config.js`).
