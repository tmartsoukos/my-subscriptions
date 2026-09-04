"""Παράγει τα εικονίδια και τις οθόνες εκκίνησης από το λογότυπο (icon.svg).

Το icon.svg είναι η πηγή αλήθειας του σχεδίου· εδώ αναπαράγεται πιστά με
Pillow, ώστε να βγαίνουν PNG σε οποιοδήποτε μέγεθος χωρίς εξωτερικό
πρόγραμμα SVG. Αν αλλάξει το λογότυπο, αλλάζει και αυτό το αρχείο.

    python tools/make-icons.py

Όλες οι συντεταγμένες είναι στον χώρο 400x400 του SVG.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

SS = 4            # υπερδειγματοληψία: ζωγραφίζουμε 4x και σμικρύνουμε
BASE = 400        # ο χώρος συντεταγμένων του SVG


def rgb(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def lerp(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def gradient(size, stops, p0=(0, 0), p1=(1, 1)):
    """Γραμμική διαβάθμιση στο πλαίσιο του στοιχείου, όπως στο SVG."""
    w, h = size
    img = Image.new("RGBA", (w, h))
    px = img.load()
    ax, ay = p0[0] * w, p0[1] * h
    bx, by = p1[0] * w, p1[1] * h
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy or 1.0
    for y in range(h):
        for x in range(w):
            t = ((x - ax) * dx + (y - ay) * dy) / denom
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
            for i in range(len(stops) - 1):
                o1, c1 = stops[i]
                o2, c2 = stops[i + 1]
                if t <= o2 or i == len(stops) - 2:
                    span = (o2 - o1) or 1.0
                    px[x, y] = lerp(c1, c2, min(max((t - o1) / span, 0.0), 1.0))
                    break
    return img


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def drop_shadow(layer, offsets):
    """Το feDropShadow του SVG: αντίγραφα της άλφα, θολωμένα και μετατοπισμένα."""
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    alpha = layer.getchannel("A")
    for dy, sigma, opacity in offsets:
        sh = alpha.filter(ImageFilter.GaussianBlur(sigma))
        sh = sh.point(lambda v, o=opacity: int(v * o))
        moved = Image.new("L", layer.size, 0)
        moved.paste(sh, (0, dy))
        black = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        black.putalpha(moved)
        out = Image.alpha_composite(out, black)
    return out


def card(canvas_size, rect, radius, stops, p0, p1, stroke=None, stroke_w=1.0, stroke_grad=None):
    """Μία κάρτα σε δικό της διάφανο στρώμα, στο μέγεθος του καμβά."""
    x, y, w, h = rect
    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    body = gradient((w, h), stops, p0, p1)
    mask = rounded_mask((w, h), radius)
    layer.paste(body, (x, y), mask)

    if stroke or stroke_grad:
        ring = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(ring)
        d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, outline=255, width=max(1, round(stroke_w)))
        paint = stroke_grad if stroke_grad is not None else Image.new("RGBA", (w, h), stroke)
        layer.paste(paint, (x, y), ring)
    return layer


def rotate_about(layer, deg_svg, pivot):
    """Το SVG μετρά τις μοίρες δεξιόστροφα· το Pillow αριστερόστροφα."""
    return layer.rotate(-deg_svg, resample=Image.BICUBIC, center=pivot)


def with_opacity(layer, opacity):
    if opacity >= 1:
        return layer
    a = layer.getchannel("A").point(lambda v: int(v * opacity))
    out = layer.copy()
    out.putalpha(a)
    return out


def draw_mark(size):
    """Το σήμα (η στοίβα των καρτών) σε διάφανο καμβά, στο μέγεθος size."""
    s = size * SS
    k = s / BASE                      # συντελεστής κλίμακας από τον χώρο του SVG
    U = lambda v: round(v * k)        # συντεταγμένη SVG -> pixel

    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ox, oy = U(100), U(105)           # translate(100, 105)
    pivot = (ox + U(100), oy + U(95))
    shadow = [(U(16), U(16), 0.70), (U(6), U(6), 0.45)]

    def place(layer, deg, opacity):
        nonlocal canvas
        lay = rotate_about(layer, deg, pivot)
        composed = Image.alpha_composite(drop_shadow(lay, shadow), lay)
        canvas = Image.alpha_composite(canvas, with_opacity(composed, opacity))

    # --- Κάτω κάρτα ---
    bottom = card((s, s), (ox + U(8), oy + U(25), U(184), U(116)), U(14),
                  [(0.0, rgb("#1e263d")), (1.0, rgb("#121828"))], (0, 0), (1, 1),
                  stroke=rgb("#313d5e"), stroke_w=U(1))
    ImageDraw.Draw(bottom).rounded_rectangle(
        [ox + U(22), oy + U(38), ox + U(50), oy + U(44)], radius=U(3), fill=(255, 255, 255, 20))
    place(bottom, -6, 0.75)

    # --- Μεσαία κάρτα ---
    middle = card((s, s), (ox + U(8), oy + U(32), U(184), U(116)), U(14),
                  [(0.0, rgb("#2a3356")), (0.5, rgb("#1f2845")), (1.0, rgb("#151c32"))], (0, 0), (1, 1),
                  stroke=rgb("#43527a"), stroke_w=U(1))
    ImageDraw.Draw(middle).rounded_rectangle(
        [ox + U(24), oy + U(46), ox + U(60), oy + U(53)], radius=U(3.5), fill=(255, 255, 255, 31))
    place(middle, 3, 0.9)

    # --- Μπροστινή κάρτα ---
    fw, fh = U(184), U(116)
    bevel = gradient((fw, fh),
                     [(0.0, rgb("#ffffff", 77)), (0.5, rgb("#818cf8", 128)), (1.0, rgb("#ffffff", 26))],
                     (0, 0), (1, 0))
    front = card((s, s), (ox + U(8), oy + U(38), fw, fh), U(14),
                 [(0.0, rgb("#273252")), (0.4, rgb("#182035")), (1.0, rgb("#0e1424"))],
                 (0.15, 0), (0.85, 1), stroke_w=U(1.5), stroke_grad=bevel)

    d = ImageDraw.Draw(front)

    # Τσιπ EMV στο translate(26, 62)
    cx, cy = ox + U(26), oy + U(62)
    chip = gradient((U(32), U(24)),
                    [(0.0, rgb("#e2c076")), (0.3, rgb("#c59b47")), (0.7, rgb("#ebd59b")), (1.0, rgb("#a47d2f"))],
                    (0, 0), (1, 1))
    front.paste(chip, (cx, cy), rounded_mask((U(32), U(24)), U(5)))
    groove = rgb("#684f18", 179)
    gw = max(1, U(0.8))
    d.rounded_rectangle([cx + U(2), cy + U(2), cx + U(30), cy + U(22)], radius=U(3), outline=groove, width=gw)
    d.line([cx + U(10), cy + U(2), cx + U(10), cy + U(22)], fill=groove, width=gw)
    d.line([cx + U(22), cy + U(2), cx + U(22), cy + U(22)], fill=groove, width=gw)
    d.line([cx + U(2), cy + U(12), cx + U(30), cy + U(12)], fill=groove, width=gw)

    # Ανέπαφη πληρωμή: δύο τόξα, όπως τα ορίζει το path του SVG
    for r_svg, x_svg, y0, y1, color in ((12, 166, 58, 74, "#818cf8"), (20, 172, 52, 80, "#6366f1")):
        half = (y1 - y0) / 2.0
        dist = math.sqrt(r_svg * r_svg - half * half)
        ccx, ccy = x_svg - dist, (y0 + y1) / 2.0
        ang = math.degrees(math.atan2(half, dist))
        box = [ox + U(ccx - r_svg), oy + U(ccy - r_svg), ox + U(ccx + r_svg), oy + U(ccy + r_svg)]
        d.arc(box, -ang, ang, fill=rgb(color), width=U(2))

    # Ο παλμός: χαραγμένη γραμμή με στρογγυλές ενώσεις
    pulse = [(26, 122), (68, 122), (82, 104), (96, 138), (108, 114), (118, 122), (174, 122)]
    pts = [(ox + U(px), oy + U(py)) for px, py in pulse]
    d.line(pts, fill=rgb("#00f0ff"), width=U(2.5), joint="curve")
    for p in pts:                       # στρογγυλά άκρα και ενώσεις
        r = U(2.5) / 2
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=rgb("#00f0ff"))
    node = U(3.5)
    d.ellipse([ox + U(96) - node, oy + U(138) - node, ox + U(96) + node, oy + U(138) + node], fill=(255, 255, 255, 255))

    place(front, 0, 1.0)
    return canvas.resize((size, size), Image.LANCZOS)


def background(size, rounded):
    """Το φόντο του εικονιδίου: διαβάθμιση, με ή χωρίς στρογγυλές γωνίες."""
    s = size * SS
    bg = gradient((s, s), [(0.0, rgb("#111625")), (1.0, rgb("#080c16"))], (0, 0), (1, 1))
    if rounded:
        r = round(s * 80 / BASE)
        out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        out.paste(bg, (0, 0), rounded_mask((s, s), r))
        d = ImageDraw.Draw(out)
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r,
                            outline=rgb("#232c45"), width=max(1, round(s * 1.5 / BASE)))
        bg = out
    return bg.resize((size, size), Image.LANCZOS)


def build_icon(size, rounded=False, mark_scale=1.0):
    icon = background(size, rounded)
    mark = draw_mark(size)
    if mark_scale != 1.0:
        m = round(size * mark_scale)
        mark = mark.resize((m, m), Image.LANCZOS)
        holder = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        holder.paste(mark, ((size - m) // 2, (size - m) // 2), mark)
        mark = holder
    return Image.alpha_composite(icon, mark)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    # Τα εικονίδια της εφαρμογής βγαίνουν χωρίς στρογγυλές γωνίες:
    # τη στρογγύλεψη την κάνει το λειτουργικό, αλλιώς θα γινόταν δύο φορές.
    full = build_icon(512)
    full.convert("RGB").save("icon-512.png")
    full.resize((192, 192), Image.LANCZOS).convert("RGB").save("icon-192.png")
    # Στο maskable το σήμα μαζεύεται στην ασφαλή ζώνη (80% του πλάτους)
    build_icon(512, mark_scale=0.72).convert("RGB").save("icon-maskable-512.png")

    # Οθόνες εκκίνησης iOS: το στρογγυλεμένο εικονίδιο στο κέντρο
    rounded = build_icon(560, rounded=True)
    sizes = set()
    for name in os.listdir("splash"):
        w, h = name.replace("-light", "").replace("splash-", "").replace(".png", "").split("x")
        sizes.add((int(w), int(h)))
    for w, h in sorted(sizes):
        side = round(min(w, h) * 0.2393)
        logo = rounded.resize((side, side), Image.LANCZOS)
        for bg_hex, suffix in ((("#070d1f"), ""), (("#f4f6fb"), "-light")):
            canvas = Image.new("RGB", (w, h), rgb(bg_hex)[:3])
            canvas.paste(logo, ((w - side) // 2, (h - side) // 2), logo)
            canvas.save(f"splash/splash-{w}x{h}{suffix}.png")
    print(f"έτοιμα: εικονίδια + {len(sizes) * 2} οθόνες εκκίνησης")


if __name__ == "__main__":
    main()
