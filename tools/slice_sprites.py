"""Recorta as folhas de sprites em quadros individuais (assets/<char>/<anim>_<n>.png)
e gera assets/frames.js com tamanho e ponto de apoio (pés) de cada quadro.

Uso: python3 tools/slice_sprites.py
"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "sprites")
OUT = os.path.join(ROOT, "assets")
DOWN = 4          # fator de redução para achar componentes
TARGET_H = 300    # altura (px) do personagem parado no quadro final

P = "Imagem do ChatGPT 23 de out. de 2026, "
SHEETS = {
    "soldado": {
        "idle":    (P + "17_00_34-1.png", 6, 2),
        "walk":    (P + "17_00_35-2.png", 6, 2),
        "jump":    (P + "17_00_35-3.png", 4, 2),
        "attack1": (P + "17_00_36-4.png", 4, 2),
        "attack2": (P + "17_00_36-5.png", 5, 2),
        "hit":     (P + "17_00_37-6.png", 3, 1),
        "ko":      (P + "17_00_37-7.png", 6, 2),
    },
    "bonezinho": {
        "idle":    ("Seis mascotes em grade transparente-8.png", 6, 2),
        "walk":    ("Folha de sprites do mascote caminhando-10.png", 6, 2),
        "jump":    ("Salto lateral do mascote Faceponto-3.png", 4, 2),
        "attack1": ("Golpe de aba em quatro quadros-4.png", 4, 2),
        "attack2": ("Ataque bumerangue de boné mágico-5.png", 4, 1),
        "hit":     ("Mascote do boné azul_ reação ao impacto-6.png", 3, 1),
        "ko":      ("Seis mascotes de boné azul isolados-11.png", 6, 2),
    },
    "vr": {
        "idle":    ("Feiticeiro acadêmico com cubo mágico-1.png", 6, 2),
        "walk":    ("Caminhada mágica com cubo flutuante-2.png", 6, 2),
        "jump":    ("Salto mágico com cubo colorido-3.png", 4, 2),
        "attack1": ("Golpe rápido do cubo mágico-4.png", 4, 2),
        "attack2": ("Truque mágico do cubo multicolorido-5.png", 5, 1),
        "hit":     ("Reações cômicas do mago com cubo mágico-6.png", 3, 1),
        "ko":      ("Mago derrotado com cubo mágico flutuante-7.png", 6, 2),
    },
    "manel": {
        "idle":    ("Lutador urbano com escudo eletrônico-2.png", 6, 2),
        "walk":    ("Lutador da Placa-Mãe em Caminhada-1.png", 6, 2),
        "jump":    ("Salto acrobático com escudo de placa-mãe-4.png", 4, 2),
        "attack1": ("Ataque lateral com placa-mãe-3.png", 4, 2),
        "attack2": ("Sequência de ataque com placa-mãe elétrica-8.png", 5, 1),
        "hit":     ("Reação de impacto do lutador tecnológico-5.png", 3, 1),
        "ko":      ("Nocaute do lutador com placa-mãe-6.png", 6, 2),
    },
    "wanessinha": {
        "idle":    ("Sprite sheet de goleira em espera-1.png", 6, 2),
        "walk":    ("Loop de caminhada da goleira Wanessinha-2.png", 6, 2),
        "jump":    ("Salto da goleira em quatro poses-3.png", 4, 2),
        "attack1": ("Soco de goleira em quatro quadros-4.png", 4, 2),
        "attack2": ("Sequência de chute da goleira-5.png", 5, 1),
        "hit":     ("Goleira Wanessinha reage ao impacto-6.png", 3, 1),
        "ko":      ("Queda cômica da goleira Wanessinha-7.png", 6, 2),
    },
    "deborah": {
        "idle":    ("Spritesheet de ovelha em guarda-1.png", 6, 2),
        "walk":    ("Ovelha lutadora em caminhada lateral-2.png", 6, 2),
        "jump":    ("Spritesheet de salto da ovelha-3.png", 4, 2),
        "attack1": ("Spritesheet de quatro cabeçadas do cordeiro-4.png", 4, 2),
        "attack2": ("Arremesso da bola de lã-5.png", 5, 1),
        "hit":     ("Ovelha em reação de impacto-6.png", 3, 1),
        "ko":      ("Sequência de nocaute da cordeira-7.png", 6, 2),
    },
    "petista": {
        "idle":    ("Ciclo de guarda do lutador-1.png", 6, 2),
        "walk":    ("Ciclo de caminhada do lutador-2.png", 6, 2),
        "jump":    ("Salto cômico em quatro poses-3.png", 4, 2),
        "attack1": ("Sequência de ataque com livro vermelho-4.png", 4, 2),
        "attack2": ("Ataque sônico de megafone em cinco quadros-5.png", 5, 1),
        "hit":     ("Reação cômica ao golpe-6.png", 3, 1),
        "ko":      ("Nocaute cômico em seis quadros-7.png", 6, 2),
    },
    "pastor": {
        "idle":    ("Pastor carismático em guarda de combate-1.png", 6, 2),
        "walk":    ("Spritesheet do pastor em caminhada-2.png", 6, 2),
        "jump":    ("Pastor carismático em salto-3.png", 4, 2),
        "attack1": ("Golpe de Bíblia em quatro poses-4.png", 4, 2),
        "attack2": ("Pastor lança onda de luz dourada-5.png", 5, 1),
        "hit":     ("Pastor em três poses de reação-6.png", 3, 1),
        "ko":      ("Pastor em queda_ seis poses cômicas-7.png", 6, 2),
    },
    "bandicoot": {
        "idle":    ("Spritesheet de espera do raposo lutador-1.png", 6, 2),
        "walk":    ("Folha de sprites_ raposo em caminhada-2.png", 6, 2),
        "jump":    ("Salto acrobático da raposa bandicoot-3.png", 4, 2),
        "attack1": ("Golpe giratório do marsupial de boné-4.png", 4, 2),
        "attack2": ("Golpe bumerangue com boné azul-5.png", 5, 1),
        "hit":     ("Raposa de boné reagindo ao golpe-6.png", 3, 1),
        "ko":      ("Queda cômica do bandicoot de boné-7.png", 6, 2),
    },
    "cristorey": {
        "idle":    ("Spritesheet de lutador musculoso em guarda-1.png", 6, 2),
        "walk":    ("Seis quadros da caminhada do fisiculturista-2.png", 6, 2),
        "jump":    ("Salto do fisiculturista em quatro poses-3.png", 4, 2),
        "attack1": ("Spritesheet de soco explosivo em quatro quadros-4.png", 4, 2),
        "attack2": ("Spritesheet de ataque com bomba cartunesca-5.png", 5, 1),
        "hit":     ("Três reações do lutador ao impacto-6.png", 3, 1),
        "ko":      ("Queda cômica do lutador de óculos-7.png", 6, 2),
    },
    "bolsotron": {
        "idle":    ("Bolsodroid em guarda cibernética-1.png", 6, 2),
        "walk":    ("Spritesheet de caminhada do Bolsodroid-2.png", 6, 2),
        "jump":    ("Spritesheet do salto do Bolsodroid-3.png", 4, 2),
        "attack1": ("Bolsodroid disparando pistola de energia-4.png", 4, 2),
        "attack2": ("Bolsodroid dispara canhão de energia-5.png", 5, 1),
        "hit":     ("Ciborgue recupera o equilíbrio após pane mecânica-6.png", 3, 1),
        "ko":      ("Bolsodroid desliga em seis poses-7.png", 6, 2),
    },
    "luladroid": {
        "idle":    ("Lulatron em guarda com garrafa de cachaça-1.png", 6, 2),
        "walk":    ("Lulatron em caminhada mecânica-2.png", 6, 2),
        "jump":    ("Salto mecânico do Lulatron ciborgue-3.png", 4, 2),
        "attack1": ("Lulatron golpeia com garrafa reforçada-4.png", 4, 2),
        "attack2": ("Lulatron dispara rajada âmbar-5.png", 5, 1),
        "hit":     ("Lulatron reage com garrafa de cachaça-6.png", 3, 1),
        "ko":      ("Lulatron_ queda cômica em seis quadros-7.png", 6, 2),
    },
}


def label(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    for y, x in zip(*np.nonzero(mask)):
        if lab[y, x]:
            continue
        n += 1
        lab[y, x] = n
        q = deque([(y, x)])
        while q:
            cy, cx = q.popleft()
            for ny in range(cy - 1, cy + 2):
                for nx in range(cx - 1, cx + 2):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        q.append((ny, nx))
    return lab, n


def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= shift(m, dy, dx, False)
    return out


def bbox(m):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def erode(m):
    out = m.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out &= shift(m, dy, dx, False)
    return out


def upscale(m, H, W):
    full = np.zeros((H, W), bool)
    k = np.kron(m, np.ones((DOWN, DOWN), bool))
    full[: k.shape[0], : k.shape[1]] = k
    return full


def dist(a, b):
    """Menor distância entre dois conjuntos de pontos (contornos)."""
    d = ((a[:, None, :] - b[None, :, :]) ** 2).sum(-1)
    return d.min()


def frame_from_mask(rgba, fm, body):
    alpha = rgba[:, :, 3]
    fm = fm & (alpha > 8)
    body = body & fm
    x0, y0, x1, y1 = bbox(fm)
    crop = rgba[y0:y1, x0:x1].copy()
    crop[:, :, 3] = np.where(fm[y0:y1, x0:x1], crop[:, :, 3], 0)
    # ponto de apoio: centro dos pés (faixa de baixo do corpo principal)
    bx0, by0, bx1, by1 = bbox(body & (alpha > 128))
    band = body[max(by0, by1 - max(8, (by1 - by0) // 8)):by1]
    return {"img": crop, "ax": np.nonzero(band)[1].mean() - x0, "ay": by1 - y0, "bodyh": by1 - by0,
            "x0": x0, "y0": y0}


def shift(m, dy, dx, fill=0):
    """Desloca a matriz sem dar a volta nas bordas (np.roll daria)."""
    out = np.full_like(m, fill)
    h, w = m.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def grow(m, r):
    out = m.copy()
    for _ in range(r):
        prev = out.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                out |= shift(prev, dy, dx, False)
    return out


def shrink(m, r):
    return ~grow(~m, r)


def resize_to(a, H, W):
    """Amplia um mapa da grade reduzida para a folha inteira, suavizando (bilinear)."""
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((a.shape[1] * GROW_DOWN, a.shape[0] * GROW_DOWN),
                                                            Image.BILINEAR)
    full = np.zeros((H, W), np.float32)
    k = np.array(im, np.float32) / 255
    full[: k.shape[0], : k.shape[1]] = k[:H, :W]
    return full


GROW_DOWN = 2      # grade usada para separar quadros que se encostam
SEED_MARGIN = 20   # px (na grade) que a semente de cada quadro fica longe da divisa com o vizinho
SEAM = 7           # px (na grade) em que o alfa esmaece perto da divisa entre dois quadros


def split_manual(rgba, rects_per_frame):
    """Quadros que se encostam: os retângulos só dizem onde fica cada corpo. Cada quadro cresce
    a partir do seu corpo pelos pixels opacos (como tinta escorrendo), então a divisa segue o
    desenho em vez de uma linha reta, e o alfa esmaece suavemente nela."""
    H, W = rgba.shape[:2]
    D = GROW_DOWN
    h, w = H // D, W // D
    alpha = rgba[:, :, 3]
    opaque = alpha[: h * D, : w * D].reshape(h, D, w, D).max(axis=(1, 3)) > 8
    own = np.zeros((h, w), np.int32)        # dono de cada ponto pelos retângulos (o primeiro tem prioridade)
    for i, rects in enumerate(rects_per_frame):
        for x0, y0, x1, y1 in rects:
            reg = own[y0 // D: -(-y1 // D), x0 // D: -(-x1 // D)]
            reg[reg == 0] = i + 1
    lab = np.zeros((h, w), np.int32)
    for i in range(len(rects_per_frame)):
        mine = own == i + 1
        # longe da divisa com os vizinhos (a borda da folha não conta)
        lab[shrink(mine | (own == 0), SEED_MARGIN) & mine & opaque] = i + 1
    while True:
        free = opaque & (lab == 0)
        nb = np.zeros_like(lab)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nb = np.maximum(nb, shift(lab, dy, dx))
        new = free & (nb > 0)
        if not new.any():
            break
        lab[new] = nb[new]
    lab[opaque & (lab == 0)] = own[opaque & (lab == 0)]   # pedaços soltos: pelo retângulo
    frames = []
    for i in range(len(rects_per_frame)):
        mine = lab == i + 1
        # esmaece o alfa perto de pixels que ficaram com outro quadro
        other = (lab > 0) & ~mine
        ramp = np.ones((h, w), np.float32)
        near = other.copy()
        for k in range(SEAM):
            near = grow(near, 1)
            ramp[near & (ramp == 1)] = (k + 1) / (SEAM + 1)
        ramp[other] = 0
        # o fundo em volta do quadro fica 1 (não come a borda do desenho na interpolação),
        # e o que é de outro quadro some de vez
        ramp[~mine & ~grow(mine, 2)] = 0
        soft = resize_to(ramp, H, W) * upscale_to(~other, H, W, D)
        fr = rgba.copy()
        fr[:, :, 3] = (alpha * soft).astype(np.uint8)
        fm = fr[:, :, 3] > 8
        body = upscale_to(shrink(mine, 2) & opaque, H, W, D) & fm
        frames.append(frame_from_mask(fr, fm, body if body.any() else fm))
    return frames


def upscale_to(m, H, W, d):
    k = np.kron(m, np.ones((d, d), bool))[:H, :W]
    return np.pad(k, ((0, H - k.shape[0]), (0, W - k.shape[1])), mode="edge")


def soft_erase(rgba, box, r=16):
    """Apaga o objeto que vira projétil: zera a caixa e esmaece r px em volta (sem corte reto)."""
    x0, y0, x1, y1 = box
    H, W = rgba.shape[:2]
    ys, xs = np.mgrid[0:H, 0:W]
    d = np.maximum(np.maximum(x0 - xs, xs - (x1 - 1)), np.maximum(y0 - ys, ys - (y1 - 1)))
    keep = np.clip(d / r, 0, 1)
    rgba[:, :, 3] = (rgba[:, :, 3] * keep).astype(np.uint8)


BORDER = 6         # px apagados na borda de cada folha
SPECK_AREA = 40    # componentes menores que isso (px na grade reduzida)...
SPECK_DIST = 30    # ...e mais longe que isso de um corpo são sujeira da folha e somem


def split_sheet(path, count, rows, manual=None, erase=()):
    img = Image.open(path).convert("RGBA")
    rgba = np.array(img)
    # algumas folhas têm uma linha de sujeira colada na borda da imagem
    rgba[:BORDER, :, 3] = rgba[-BORDER:, :, 3] = rgba[:, :BORDER, 3] = rgba[:, -BORDER:, 3] = 0
    for box in erase:
        soft_erase(rgba, box)
    if manual:
        return split_manual(rgba, manual)
    alpha = rgba[:, :, 3]
    H, W = alpha.shape
    h, w = H // DOWN, W // DOWN
    small = alpha[: h * DOWN, : w * DOWN].reshape(h, DOWN, w, DOWN).max(axis=(1, 3))
    mask = dilate(small > 40, 1)
    lab, n = label(mask)
    comps = []
    for i in range(1, n + 1):
        m = lab == i
        pts = np.argwhere(m & ~erode(m))
        comps.append({"id": i, "area": int(m.sum()), "box": bbox(m), "pts": pts[:: max(1, len(pts) // 300)]})
    # agrupamento: junta sempre o menor grupo ao vizinho mais próximo até sobrar `count`
    big = [c for c in comps if c["area"] >= SPECK_AREA]
    comps = big + [c for c in comps if 2 <= c["area"] < SPECK_AREA
                   and min(dist(c["pts"], b["pts"]) for b in big) <= SPECK_DIST ** 2]
    groups = [{"parts": [c], "area": c["area"], "pts": c["pts"]} for c in comps]
    while len(groups) > count:
        groups.sort(key=lambda g: g["area"])
        g = groups.pop(0)
        k = min(groups, key=lambda o: dist(g["pts"], o["pts"]))
        k["parts"] += g["parts"]
        k["area"] += g["area"]
        k["pts"] = np.concatenate([k["pts"], g["pts"]])
    groups = [sorted(g["parts"], key=lambda c: -c["area"]) for g in groups]
    row_h = h / rows

    def order(g):
        b = g[0]["box"]
        return (int(((b[1] + b[3]) / 2) // row_h), (b[0] + b[2]) / 2)

    groups.sort(key=order)
    frames = []
    for g in groups:
        m = np.zeros((h, w), bool)
        for c in g:
            m |= lab == c["id"]
        frames.append(frame_from_mask(rgba, upscale(dilate(m, 2), H, W), upscale(lab == g[0]["id"], H, W)))
    return frames


def head_box(im):
    """Caixa da cabeça [x0, x1, y0]: parte opaca dos 42% de cima do quadro (enquadra o retrato da seleção)."""
    a = np.array(im.convert("RGBA"))[: round(im.height * 0.42), :, 3] >= 128
    ys, xs = np.nonzero(a)
    return [int(xs.min()), int(xs.max()), int(ys.min())]


def main():
    meta = {}
    for char, anims in SHEETS.items():
        os.makedirs(os.path.join(OUT, char), exist_ok=True)
        meta[char] = {}
        for anim, (fname, count, rows) in anims.items():
            fx = [f for f in FX if f["char"] == char and f["anim"] == anim]
            frames = split_sheet(os.path.join(SRC, fname), count, rows, MANUAL.get(char, {}).get(anim),
                                 [b for f in fx for b in f.get("erase", [f["box"]])])
            for i in FLIP.get(char, {}).get(anim, ()):
                fr = frames[i]
                fr["img"] = fr["img"][:, ::-1].copy()
                fr["ax"] = fr["img"].shape[1] - fr["ax"]
            scale = TARGET_H / STAND_H[char].get(anim, STAND_H[char]["idle"])
            for f in fx:
                export_fx(f, fname, frames[f["frame"]], scale, meta)
            for i, n in FEATHER.get(char, {}).get(anim, {}).items():
                a = frames[i]["img"][:, :, 3]
                if n < 0:   # negativo: esmaece as primeiras colunas (lado esquerdo)
                    n = min(-n, a.shape[1])
                    a[:, :n] = (a[:, :n] * np.linspace(0, 1, n)[None, :]).astype(np.uint8)
                else:
                    n = min(n, a.shape[1])
                    a[:, -n:] = (a[:, -n:] * np.linspace(1, 0, n)[None, :]).astype(np.uint8)
            out = []
            for i, fr in enumerate(frames):
                im = Image.fromarray(fr["img"])
                im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
                name = f"{anim}_{i}.png"
                im.save(os.path.join(OUT, char, name), optimize=True)
                out.append({"src": f"assets/{char}/{name}", "w": im.width, "h": im.height,
                            "ax": round(fr["ax"] * scale), "ay": round(fr["ay"] * scale)})
                if anim == "idle":
                    out[-1]["head"] = head_box(im)
            meta[char][anim] = out
            print(char, anim, [int(f["bodyh"]) for f in frames])
    with open(os.path.join(OUT, "frames.js"), "w") as f:
        f.write("// Gerado por tools/slice_sprites.py — não editar à mão.\n")
        f.write("window.FRAMES = " + json.dumps({k: v for k, v in meta.items() if k != "fx"}) + ";\n")
        f.write("window.FX = " + json.dumps(meta.get("fx", {})) + ";\n")


def export_fx(fx, fname, frame, scale, meta):
    """Recorta um objeto (ex.: o míssil) da folha e guarda sua posição relativa aos pés."""
    os.makedirs(os.path.join(OUT, "fx"), exist_ok=True)
    x0, y0, x1, y1 = fx["box"]
    im = Image.open(os.path.join(SRC, fname)).convert("RGBA").crop((x0, y0, x1, y1))
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if "fade" in fx:   # esmaece a cauda (lado esquerdo), cortada do rastro que sai da mão
        a = np.array(im)
        ramp = np.clip(np.arange(im.width) / (im.width * fx["fade"]), 0, 1)
        a[:, :, 3] = (a[:, :, 3] * ramp[None, :]).astype(np.uint8)
        im = Image.fromarray(a)
    im.save(os.path.join(OUT, "fx", fx["name"] + ".png"), optimize=True)
    feet_x, feet_y = frame["x0"] + frame["ax"], frame["y0"] + frame["ay"]
    meta.setdefault("fx", {})[fx["name"]] = {
        "src": f"assets/fx/{fx['name']}.png", "w": im.width, "h": im.height,
        "dx": round((x0 - feet_x) * scale), "dy": round((y0 - feet_y) * scale), "angle": fx["angle"]}


# folhas em que quadros vizinhos se encostam: retângulos (x0, y0, x1, y1) de cada
# quadro, em px da folha original; quadros anteriores têm prioridade na sobreposição
MANUAL = {
    "soldado": {"ko": [
        [(0, 0, 537, 513)], [(537, 0, 1060, 513)], [(1060, 0, 1536, 513)],
        [(0, 513, 520, 1024)], [(520, 513, 1036, 1024)], [(1036, 513, 1536, 1024)],
    ]},
    "vr": {
        "attack2": [
            [(0, 0, 395, 420), (0, 420, 355, 793)], [(355, 0, 762, 380), (355, 380, 742, 793)],
            [(742, 0, 1245, 420), (742, 420, 1160, 793)], [(1160, 0, 1630, 793)], [(1630, 0, 1983, 793)],
        ],
        "ko": [
            [(0, 0, 500, 560)], [(500, 0, 1000, 560)], [(1000, 0, 1536, 560)],
            [(0, 600, 505, 1024)], [(505, 600, 1030, 1024)], [(1030, 600, 1536, 1024)],
        ],
    },
    "manel": {"ko": [
        [(0, 0, 480, 560)], [(480, 0, 1010, 560)], [(1010, 0, 1536, 560)],
        [(0, 600, 500, 1024)], [(500, 600, 1022, 1024)], [(1022, 600, 1536, 1024)],
    ]},
    "wanessinha": {
        "walk": [
            [(0, 0, 455, 509)], [(455, 0, 933, 509)], [(933, 0, 1536, 509)],
            [(0, 509, 465, 1024)], [(465, 509, 954, 1024)], [(954, 509, 1536, 1024)],
        ],
        "attack2": [
            [(0, 0, 300, 793)], [(295, 0, 740, 793), (740, 500, 780, 793)],
            [(740, 0, 1060, 793), (1060, 500, 1195, 793)], [(1060, 0, 1660, 500), (1195, 500, 1590, 793)],
            [(1590, 0, 1983, 793)],
        ],
        "ko": [
            [(0, 0, 520, 560)], [(520, 0, 980, 560)], [(980, 0, 1536, 560)],
            [(0, 560, 460, 1024), (460, 850, 500, 1024)], [(460, 560, 1025, 1024)], [(1025, 560, 1536, 1024)],
        ],
    },
    "deborah": {
        "attack2": [
            [(0, 0, 345, 793)], [(345, 0, 680, 793)], [(680, 0, 1150, 793), (1150, 300, 1190, 430)],
            [(1150, 0, 1690, 793)], [(1690, 0, 1983, 793)],
        ],
        "ko": [
            [(0, 0, 500, 560)], [(500, 0, 1000, 560)], [(1000, 0, 1536, 560)],
            [(0, 600, 430, 1024)], [(430, 600, 990, 1024)], [(990, 600, 1536, 1024)],
        ],
    },
    "petista": {
        "attack2": [
            [(0, 0, 380, 793)], [(380, 0, 740, 793)], [(740, 0, 1190, 793)],
            [(1190, 0, 1650, 793)], [(1650, 0, 1983, 793)],
        ],
        "ko": [
            [(0, 0, 500, 560)], [(500, 0, 1000, 560)], [(1000, 0, 1536, 560)],
            [(0, 600, 520, 1024)], [(520, 600, 1010, 1024)], [(1010, 600, 1536, 1024)],
        ],
    },
    "pastor": {
        "walk": [
            [(0, 0, 463, 506)], [(463, 0, 900, 506)], [(900, 0, 1536, 506)],
            [(0, 506, 486, 1024)], [(486, 506, 900, 1024)], [(900, 506, 1536, 1024)],
        ],
        "attack2": [
            [(0, 0, 330, 793)], [(330, 0, 690, 620), (330, 620, 660, 793)],
            [(690, 0, 1140, 540), (660, 540, 1040, 793)], [(1040, 0, 1490, 793)],
            [(1660, 0, 1983, 793), (1622, 618, 1660, 793)],
        ],
    },
    "bandicoot": {
        "attack2": [
            [(0, 0, 400, 793)], [(400, 0, 755, 793)], [(755, 300, 1240, 793), (1240, 300, 1320, 450), (755, 0, 1210, 300)],
            [(1210, 0, 1640, 300), (1320, 300, 1640, 793), (1240, 450, 1320, 793)], [(1640, 0, 1983, 793)],
        ],
    },
    "cristorey": {
        "attack2": [
            [(0, 0, 375, 793)], [(375, 0, 750, 793)], [(750, 0, 1340, 255), (750, 255, 1130, 793)],
            [(1340, 0, 1690, 255), (1130, 255, 1660, 793)], [(1660, 0, 1983, 793)],
        ],
    },
    "bolsotron": {
        "attack2": [
            [(0, 0, 355, 793)], [(355, 0, 706, 793)], [(706, 0, 1230, 793)],
            [(1230, 0, 1645, 793)], [(1645, 0, 1983, 793)],
        ],
        "ko": [
            [(0, 0, 500, 600), (500, 385, 575, 600)], [(500, 0, 1045, 330), (500, 330, 990, 600)], [(1045, 0, 1536, 330), (990, 330, 1536, 600)],
            [(0, 600, 505, 1024)], [(505, 600, 985, 1024)], [(985, 600, 1536, 1024)],
        ],
    },
    "luladroid": {
        "attack2": [
            [(0, 0, 345, 793)], [(345, 0, 700, 793)], [(700, 0, 1075, 793)],
            [(1075, 0, 1640, 793)], [(1640, 0, 1983, 793)],
        ],
    },
}

# quadros cujo corte à direita atravessa um brilho: esmaece as últimas n colunas (px da folha);
# n negativo esmaece as primeiras (fumaça que sai pela borda esquerda da folha)
FEATHER = {
    "soldado": {"attack2": {3: -70}},
    "pastor": {"attack2": {2: 90, 3: 15}},
}

# quadros desenhados virados para a esquerda: espelha para ficarem de frente para a direita
FLIP = {
    "cristorey": {"hit": [0, 1]},
}

# objetos recortados da folha (e apagados do quadro) para virarem projéteis;
# "erase" troca a caixa apagada do quadro quando o objeto não cabe num retângulo só
FX = [
    {"name": "rocket", "char": "soldado", "anim": "attack2", "frame": 3,
     "box": (440, 520, 615, 615), "angle": -14},
    {"name": "capwave", "char": "bonezinho", "anim": "attack2", "frame": 2,
     "box": (1295, 335, 1620, 575), "angle": 0, "fade": 0.2},
    {"name": "cubewave", "char": "vr", "anim": "attack2", "frame": 2,
     "box": (1095, 140, 1245, 340), "angle": 0, "fade": 0.3},
    # a parede de luz na frente da placa-mãe (a placa fica na mão)
    {"name": "firewall", "char": "manel", "anim": "attack2", "frame": 3,
     "box": (1522, 262, 1655, 508), "angle": 0, "fade": 0.12},
    {"name": "ball", "char": "wanessinha", "anim": "attack2", "frame": 3,
     "box": (1535, 205, 1650, 315), "angle": 0},
    {"name": "woolball", "char": "deborah", "anim": "attack2", "frame": 2,
     "box": (1030, 315, 1190, 415), "angle": 0, "fade": 0.35},
    {"name": "soundwave", "char": "petista", "anim": "attack2", "frame": 2,
     "box": (1100, 240, 1190, 400), "angle": 0, "fade": 0.25},
    {"name": "holywave", "char": "pastor", "anim": "attack2", "frame": 3,
     "box": (1478, 150, 1660, 618), "angle": 0, "fade": 0.12,
     # a frente da onda passa da caixa: apaga também acima e abaixo da mão (que fica)
     "erase": [(1478, 150, 1660, 640), (1385, 150, 1478, 318), (1385, 425, 1478, 640)]},
    {"name": "capcomet", "char": "bandicoot", "anim": "attack2", "frame": 2,
     "box": (1195, 350, 1320, 440), "angle": 0,
     # o boné também aparece lá no alto no quadro seguinte: apaga a explosão azul
     "erase": [(1195, 350, 1320, 440), (1280, 110, 1640, 335)]},
    {"name": "bomb", "char": "cristorey", "anim": "attack2", "frame": 2,
     "box": (1200, 115, 1330, 192), "angle": 0,
     # some também o rastro de fogo e a explosão perto da mão (a bomba estoura onde cai)
     "erase": [(1085, 110, 1335, 205), (1475, 155, 1690, 300), (1598, 300, 1690, 350)]},
    {"name": "greenbeam", "char": "bolsotron", "anim": "attack2", "frame": 2,
     "box": (1085, 190, 1232, 440), "angle": 0, "fade": 0.25},
    # o jato de cachaça: as gotas que caem abaixo da caixa também somem do quadro
    {"name": "amberspray", "char": "luladroid", "anim": "attack2", "frame": 3,
     "box": (1385, 255, 1640, 520), "angle": 0, "fade": 0.15,
     "erase": [(1385, 255, 1640, 520), (1470, 515, 1640, 565)]},
]

# altura aproximada (px na folha original) do personagem em pé em cada folha,
# já que cada imagem foi gerada numa escala diferente
STAND_H = {
    "soldado": {"idle": 485, "walk": 485, "jump": 520, "attack1": 520, "attack2": 470, "hit": 620, "ko": 480},
    "bonezinho": {"idle": 480, "walk": 465, "jump": 520, "attack1": 520, "attack2": 440, "hit": 640, "ko": 490},
    "vr": {"idle": 491, "walk": 491, "jump": 520, "attack1": 524, "attack2": 618, "hit": 685, "ko": 495},
    "manel": {"idle": 490, "walk": 490, "jump": 645, "attack1": 554, "attack2": 554, "hit": 850, "ko": 554},
    "wanessinha": {"idle": 505, "walk": 505, "jump": 600, "attack1": 593, "attack2": 562, "hit": 684, "ko": 505},
    "deborah": {"idle": 476, "walk": 476, "jump": 560, "attack1": 566, "attack2": 395, "hit": 660, "ko": 490},
    "petista": {"idle": 492, "walk": 492, "jump": 490, "attack1": 490, "attack2": 435, "hit": 565, "ko": 492},
    "pastor": {"idle": 465, "walk": 465, "jump": 520, "attack1": 556, "attack2": 435, "hit": 630, "ko": 470},
    "bandicoot": {"idle": 450, "walk": 476, "jump": 515, "attack1": 512, "attack2": 395, "hit": 660, "ko": 465},
    "cristorey": {"idle": 486, "walk": 492, "jump": 540, "attack1": 620, "attack2": 520, "hit": 700, "ko": 560},
    "bolsotron": {"idle": 490, "walk": 492, "jump": 560, "attack1": 589, "attack2": 507, "hit": 678, "ko": 490},
    "luladroid": {"idle": 465, "walk": 462, "jump": 540, "attack1": 525, "attack2": 445, "hit": 690, "ko": 475},
}

if __name__ == "__main__":
    main()
