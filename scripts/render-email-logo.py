"""Render the animated LeadFlow AI email-signature logo (GIF; email clients strip CSS/JS animation).

    python -m pip install pillow
    python scripts/render-email-logo.py

Writes apps/web/public/email/leadflow-logo-animated.gif (2x size; display at 240x58).
The mark is the same geometry as apps/web/public/favicon.svg.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "apps/web/public/email/leadflow-logo-animated.gif"
W, H = 480, 116          # output size (2x of display size)
SS = 4                   # supersampling factor for smooth edges
INK, MINT, DEEP, WHITE = (10, 16, 14), (184, 213, 194), (60, 87, 71), (255, 255, 255)
FONT = "C:/Windows/Fonts/arialbd.ttf"
FONT_LIGHT = "C:/Windows/Fonts/arial.ttf"


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def frame(t_bar, t_top, t_bottom, t_text, t_shine) -> Image.Image:
    s = SS
    img = Image.new("RGB", (W * s, H * s), WHITE)
    d = ImageDraw.Draw(img)
    size = 112                                   # mark square, output px
    ox, oy = 2, (H - size) // 2
    k = size / 64                                # favicon viewBox is 64x64

    def box(x0, y0, x1, y1):
        return [round((ox + x0 * k) * s), round((oy + y0 * k) * s), round((ox + x1 * k) * s), round((oy + y1 * k) * s)]

    d.rounded_rectangle(box(0, 0, 64, 64), radius=round(12 * k * s), fill=INK)
    # 1. tall bar grows upward from its base
    if t_bar > 0:
        top = 47 - 30 * ease(t_bar)
        d.rectangle(box(19, top, 28, 47), fill=MINT)
    # 2. top block drops in
    if t_top > 0:
        dy = -10 * (1 - ease(t_top))
        d.rectangle(box(35, 17 + dy, 45, 26 + dy), fill=MINT)
    # 3. lower block grows upward
    if t_bottom > 0:
        top = 47 - 15 * ease(t_bottom)
        d.rectangle(box(35, top, 45, 47), fill=MINT)
    # 4. light sweep across the mark
    if 0 < t_shine < 1:
        sweep = Image.new("L", img.size, 0)
        sd = ImageDraw.Draw(sweep)
        cx = (ox - 30 + (size + 60) * t_shine) * s
        band = 14 * s
        sd.polygon([(cx, oy * s), (cx + band, oy * s), (cx + band - 40 * s, (oy + size) * s), (cx - 40 * s, (oy + size) * s)], fill=90)
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle(box(0, 0, 64, 64), radius=round(12 * k * s), fill=255)
        from PIL import ImageChops
        sweep = ImageChops.multiply(sweep, mask)
        img.paste(WHITE, (0, 0), sweep)
    # 5. wordmark reveals left to right
    if t_text > 0:
        text = Image.new("RGB", img.size, WHITE)
        td = ImageDraw.Draw(text)
        tx = (ox + size + 18) * s
        big = ImageFont.truetype(FONT, 44 * s)
        small = ImageFont.truetype(FONT_LIGHT, 17 * s)
        td.text((tx, (oy + 14) * s), "LeadFlow", font=big, fill=INK)
        lw = td.textlength("LeadFlow ", font=big)
        td.text((tx + lw, (oy + 14) * s), "AI", font=big, fill=DEEP)
        td.text((tx + 2 * s, (oy + 72) * s), "WEB  ·  MOBILE  ·  AI AUTOMATION", font=small, fill=DEEP)
        reveal = tx + (W * s - tx) * ease(t_text)
        clip = Image.new("L", img.size, 0)
        ImageDraw.Draw(clip).rectangle([tx, 0, reveal, H * s], fill=255)
        img.paste(text, (0, 0), clip)
    return img.resize((W, H), Image.LANCZOS)


def main() -> None:
    frames, durations = [], []
    steps = 34
    for i in range(steps):
        f = i / (steps - 1) * 1.7          # timeline 0..1.7 "seconds"
        frames.append(frame(f / 0.4, (f - 0.3) / 0.3, (f - 0.5) / 0.3, (f - 0.7) / 0.5, (f - 1.2) / 0.5 if f > 1.2 else 0))
        durations.append(50)
    durations[-1] = 2600                    # hold the finished logo, then replay
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pal = [fr.convert("P", palette=Image.ADAPTIVE, colors=64) for fr in frames]
    pal[0].save(OUT, save_all=True, append_images=pal[1:], duration=durations, loop=0, optimize=True, disposal=1)
    print(f"{OUT} {OUT.stat().st_size // 1024} KB, {len(frames)} frames")


if __name__ == "__main__":
    main()
