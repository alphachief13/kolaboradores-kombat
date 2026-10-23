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
    "chef": {
        "idle":    (P + "17_04_52-1.png", 6, 2),
        "walk":    (P + "17_04_53-2.png", 6, 2),
        "jump":    (P + "17_04_54-3.png", 4, 2),
        "attack1": (P + "17_04_55-4.png", 4, 2),
        "attack2": (P + "17_04_56-5.png", 5, 2),
        "hit":     (P + "17_04_56-6.png", 3, 1),
        "ko":      (P + "17_04_57-7.png", 6, 2),
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
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def bbox(m):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def erode(m):
    out = m.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out &= np.roll(np.roll(m, dy, 0), dx, 1)
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


def split_manual(rgba, rects_per_frame):
    H, W = rgba.shape[:2]
    taken = np.zeros((H, W), bool)
    frames = []
    for rects in rects_per_frame:
        fm = np.zeros((H, W), bool)
        for x0, y0, x1, y1 in rects:
            fm[y0:y1, x0:x1] = True
        fm &= ~taken
        taken |= fm
        frames.append(fm)
    return [frame_from_mask(rgba, fm, fm) for fm in frames]


def split_sheet(path, count, rows, manual=None, erase=()):
    img = Image.open(path).convert("RGBA")
    rgba = np.array(img)
    for x0, y0, x1, y1 in erase:
        rgba[y0:y1, x0:x1, 3] = 0
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
    groups = [{"parts": [c], "area": c["area"], "pts": c["pts"]} for c in comps if c["area"] >= 2]
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


def main():
    meta = {}
    for char, anims in SHEETS.items():
        os.makedirs(os.path.join(OUT, char), exist_ok=True)
        meta[char] = {}
        for anim, (fname, count, rows) in anims.items():
            fx = [f for f in FX if f["char"] == char and f["anim"] == anim]
            frames = split_sheet(os.path.join(SRC, fname), count, rows, MANUAL.get(char, {}).get(anim),
                                 [f["box"] for f in fx])
            scale = TARGET_H / STAND_H[char].get(anim, STAND_H[char]["idle"])
            for f in fx:
                export_fx(f, fname, frames[f["frame"]], scale, meta)
            out = []
            for i, fr in enumerate(frames):
                im = Image.fromarray(fr["img"])
                im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
                name = f"{anim}_{i}.png"
                im.save(os.path.join(OUT, char, name), optimize=True)
                out.append({"src": f"assets/{char}/{name}", "w": im.width, "h": im.height,
                            "ax": round(fr["ax"] * scale), "ay": round(fr["ay"] * scale)})
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
    "chef": {"attack2": [
        [(0, 0, 507, 513)], [(507, 0, 893, 513), (893, 0, 933, 400)], [(893, 0, 1536, 513)],
        [(0, 513, 747, 1024), (747, 700, 775, 880)], [(747, 513, 1536, 1024)],
    ]},
}

# objetos recortados da folha (e apagados do quadro) para virarem projéteis
FX = [
    {"name": "rocket", "char": "soldado", "anim": "attack2", "frame": 3,
     "box": (440, 520, 615, 615), "angle": -14},
]

# altura aproximada (px na folha original) do personagem em pé em cada folha,
# já que cada imagem foi gerada numa escala diferente
STAND_H = {
    "soldado": {"idle": 485, "walk": 485, "jump": 520, "attack1": 520, "attack2": 470, "hit": 620, "ko": 480},
    "chef":    {"idle": 475, "walk": 492, "jump": 520, "attack1": 540, "attack2": 460, "hit": 660, "ko": 490},
}

if __name__ == "__main__":
    main()
