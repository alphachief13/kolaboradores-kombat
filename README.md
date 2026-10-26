# kolaboradores-kombat

**Kolaboradores Kombat**: jogo de luta 2D 1x1 para navegador, contra a CPU ou multiplayer local (dois jogadores no mesmo teclado ou com controles). HTML + CSS + JavaScript puro, sem build e sem servidor.

## Como jogar

Jogue em `https://alphachief13.github.io/kolaboradores-kombat/` ou abra o `index.html` direto no navegador (também roda em qualquer servidor estático).

| Ação           | Jogador 1 | Jogador 2         | Controle   |
|----------------|-----------|-------------------|------------|
| Andar          | `A` / `D` | `←` / `→`         | direcional |
| Pular          | `W`       | `↑`               | A          |
| Ataque rápido  | `F`       | `K` ou `Num 1`    | X          |
| Ataque forte   | `G`       | `L` ou `Num 2`    | Y / B      |
| Pausar         | `Esc`     | `Esc`             |            |

Modos: **1 Jogador · vs CPU** (o jogador 2 é controlado pelo computador; dificuldade Fácil, Normal ou Difícil em Configurações; o jogador pode usar as teclas de qualquer um dos dois lados) e **2 Jogadores** (local).

Fluxo: menu → seleção de personagem (cada jogador escolhe e confirma) → contagem 3, 2, 1, FIGHT! → luta → K.O. → revanche quando os dois aceitam.

## Publicar no GitHub Pages

O jogo é estático (HTML/CSS/JS puro, caminhos relativos), então roda direto no `github.io`.
O workflow `.github/workflows/pages.yml` publica a cada push na `main`, levando só o que o navegador carrega
(`index.html`, `css/`, `js/`, `assets/`). As folhas originais em `sprites/` e o `tools/` ficam fora do site.

Uma vez só: no GitHub, **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Depois de cada push, o jogo fica em `https://alphachief13.github.io/kolaboradores-kombat/`.

## Personagens

- **Cabo Queijo** (militar): cassetete tático (rápido) e bazuca tubarão (míssil que cruza a arena; dá para pular por cima).
- **Bonézinho** (mestre dos bonés): golpe de aba (rápido) e bumerangue mágico (boné de energia que cruza a arena; dá para pular por cima).
- **V R** (mago do cubo): golpe do cubo (rápido) e chuva de cubinhos (as peças do cubo cruzam a arena; dá para pular por cima).
- **Wanessinha** (goleira): soco de luva (rápido) e tiro de meta (bola chutada que cruza a arena; dá para pular por cima).
- **Dééééééborah** (cordeira): cabeçada de cordeira (rápido) e bola de lã (novelo arremessado que cruza a arena; dá para pular por cima).

## Estrutura

```
index.html          telas e HUD
css/style.css       visual (a escala acompanha a janela pela variável --u)
js/config.js        constantes e dados dos personagens/ataques (dano, alcance, frames)
js/input.js         teclado + Gamepad API
js/fighter.js       máquina de estados, física, hitbox/hurtbox, animação
js/ai.js            oponente controlado pelo computador (gera entradas como um jogador)
js/game.js          partida: contagem, colisão entre lutadores, projéteis, K.O., tempo, revanche
js/effects.js       partículas de impacto, explosão, poeira, tremor de tela
js/stage.js         arena (foto em assets/stage/faceponto.jpg)
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
