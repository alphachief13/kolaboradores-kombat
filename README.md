# kolaboradores-kombat

**Kolaboradores Kombat**: jogo de luta 2D 1x1 para navegador, contra a CPU, multiplayer local (dois jogadores no mesmo teclado ou com controles) ou em rede entre computadores (1x1 ou torneio, com espectadores). HTML + CSS + JavaScript puro, sem build e sem servidor.

## Como jogar

Jogue em `https://alphachief13.github.io/kolaboradores-kombat/` ou abra o `index.html` direto no navegador (também roda em qualquer servidor estático).

| Ação           | Jogador 1 | Jogador 2         | Controle   |
|----------------|-----------|-------------------|------------|
| Andar          | `A` / `D` | `←` / `→`         | direcional |
| Pular          | `W`       | `↑`               | A          |
| Ataque rápido  | `F`       | `K` ou `Num 1`    | X          |
| Ataque forte   | `G`       | `L` ou `Num 2`    | Y / B      |
| Dash           | `E` (ou toque duplo em `A`/`D`) | `J` ou `Num 0` (ou toque duplo em `←`/`→`) | LT / RT |
| Defender       | `S` ou `H` (segure) | `↓` ou `Num 3` (segure) | LB / RB / baixo |
| Pausar         | `Esc`     | `Esc`             |            |

**Defesa**: segurando a defesa de frente para o golpe você leva só 20% do dano e não sofre efeitos (confuso, enrolado).
O escudo nunca quebra.

**Energia**: o ataque forte (projétil) gasta energia, a barra azul embaixo da vida. Ela recupera sozinha;
quando acende, dá para disparar de novo.

**Fôlego**: o ataque rápido e o dash gastam fôlego, a barra amarela embaixo da energia. Ele volta rápido
quando você para de bater; quando pisca, não dá nem para mais um golpe.

**Dash**: arrancada para o lado que estiver apertado (sem direção, para trás). No começo dele o lutador fica
transparente e não pode ser atingido, então dá para atravessar golpes e projéteis com o tempo certo.

**Sem paredes**: quem passa da borda da arena reaparece do outro lado.

**Mouse**: durante a luta o mouse também controla o jogador 1 (em rede, quem está em cada computador):
botão esquerdo dá o ataque rápido e botão direito o ataque forte, à distância.

Modos (menu **Jogar**):

- **vs CPU → Luta rápida**: o jogador 2 é controlado pelo computador (dificuldade Fácil, Normal ou Difícil em Configurações;
  o jogador pode usar as teclas de qualquer um dos dois lados).
- **vs CPU → Torneio**: mata-mata de 8 contra lutadores sorteados (quartas, semifinal e final). A CPU fica mais forte a cada
  rodada, começando um nível abaixo da dificuldade escolhida; quem perde tenta a mesma luta de novo. Dá para trocar de
  lutador no chaveamento, na pausa ou no resultado.
- **2 Jogadores**: local, no mesmo teclado ou com controles.
- **Em rede (LAN)**: ver abaixo.

Fluxo: menu → seleção de personagem (cada jogador escolhe, troca a variação se houver, e confirma) → contagem 3, 2, 1, FIGHT! → luta → K.O. → revanche quando os dois aceitam.

## Jogar em rede

1. Num computador: **Jogar → Em rede (LAN) → Criar sala**. Aparece um código de 4 números, um QR code e o botão **Copiar link**.
2. Nos outros: **Jogar → Em rede (LAN) → Entrar numa sala** e digite o código (ou abra o link / leia o QR code).
3. Na sala, o anfitrião escolhe **1x1** ou **Torneio** (melhor de 1 ou de 3) e o tempo da luta, e aperta **Começar**.
   Cada um pode se marcar como **Jogador** ou **Espectador**; o anfitrião pode mudar o de qualquer um.

- **1x1**: exatamente 2 jogadores; os outros assistem. Revanche e troca de personagens como no modo local.
- **Torneio**: 2 a 8 jogadores em mata-mata sorteado (quem sobra passa direto). Quem não está lutando assiste.
  Quem sai da sala perde por W.O. No torneio, cada um tem 30 s para escolher o lutador.
  Numa melhor de 3, quem quiser trocar de lutador para o próximo round aperta o ataque forte depois do K.O.
  (ou clica em **Trocar lutador**, também no menu do `Esc`).
- Espectadores podem entrar a qualquer momento, inclusive no meio de uma luta.
- Cada computador controla um lutador com qualquer um dos dois esquemas de teclas (ou o controle).
  `Esc` abre o menu, mas a luta continua.

Os computadores precisam de internet para se encontrar (o código da sala passa pelo servidor público do
[PeerJS](https://peerjs.com)); a luta em si vai direto de um computador para o outro pela rede local (WebRTC).
O computador do anfitrião roda a luta e envia o estado para os outros 60 vezes por segundo,
então a janela dele precisa ficar aberta.

## Publicar no GitHub Pages

O jogo é estático (HTML/CSS/JS puro, caminhos relativos), então roda direto no `github.io`.
O workflow `.github/workflows/pages.yml` publica a cada push na `main`, levando só o que o navegador carrega
(`index.html`, `css/`, `js/`, `assets/`). As folhas originais em `sprites/` e o `tools/` ficam fora do site.

Uma vez só: no GitHub, **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Depois de cada push, o jogo fica em `https://alphachief13.github.io/kolaboradores-kombat/`.

## Personagens

Alguns personagens têm **variações**: dividem o mesmo card na seleção, mas cada uma tem visual, atributos e golpes
próprios. Os pontinhos embaixo do retrato mostram quantas são; troque com `W`/`S` ou `↑`/`↓` (ou clicando no nome
da variação ao lado da grade). No torneio, os adversários aparecem em qualquer variação.

- **Cabo Queijo** (militar): cassetete tático (rápido) e bazuca tubarão (míssil que cruza a arena; dá para pular por cima).
- **Bonézinho** (mestre dos bonés): golpe de aba (rápido) e bumerangue mágico (boné de energia que vai e volta e acerta uma vez só; dá para pular por cima).
- **V R** (mago do cubo): golpe do cubo (rápido) e chuva de cubinhos (as peças do cubo cruzam a arena; dá para pular por cima).
  - variação **Manel** (técnico de hardware): placada (rápido, avança um passo) e firewall (parede de luz que avança devagar,
    apaga os projéteis do rival e o empurra para longe; alta demais para pular, atravesse de dash ou defenda).
- **Wanessinha** (goleira): soco de luva (rápido) e tiro de meta (bola chutada que cruza a arena; dá para pular por cima).
- **Dééééééborah** (cordeira): cabeçada de cordeira (rápido) e bola de lã (novelo arremessado que cruza a arena; dá para pular por cima).
- **Petista** (militante): livraço vermelho (rápido) e grito de megafone (onda sonora que cruza a arena; dá para pular por cima).
- **Pastor** (pregador): golpe da palavra (rápido) e onda de luz (onda dourada que cruza a arena; dá para pular por cima).
- **Viva Cristo Rey** (fisiculturista): soco explosivo (rápido, mas lento para sair) e bomba cartunesca (arremessada em arco, quica uma vez e explode em área; pule alto ou fuja para longe).
  - variação **Cordeiro Bandicoot** (acrobata): boné giratório (rápido) e boné cometa (boné lançado em arco que estoura onde cai; fuja para o lado).
- **Bolsotron** (ciborgue patriota): pistola de energia (rápido, de longo alcance) e canhão verde-amarelo (raio de energia, o projétil mais rápido do jogo; pule cedo).
- **Luladroid** (ciborgue boêmio): garrafada (rápido, lento para sair, mas pesado) e rajada de cachaça (jato de curto alcance que deixa o rival tonto, com os controles invertidos).

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
js/stage.js         arenas (fotos em assets/stage/, sorteadas a cada luta)
js/audio.js         efeitos sonoros sintetizados (WebAudio)
js/net.js           transporte da rede (PeerJS/WebRTC): criar sala, entrar, enviar mensagens
js/online.js        modo em rede: sala, 1x1, torneio, espectadores (o anfitrião roda a luta)
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
Para que ele seja uma variação de outro personagem, coloque `variantOf: '<id do personagem base>'` na definição.
