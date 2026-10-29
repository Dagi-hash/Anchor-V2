"""Builds Android launcher icons from icon.png.
usage: python3 make_icons.py <icon.png> <android res dir>"""
import os, shutil, sys
from PIL import Image, ImageDraw

src, res = sys.argv[1], sys.argv[2]
base = Image.open(src).convert("RGBA")
sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}

# use plain PNG icons on every Android version
shutil.rmtree(os.path.join(res, "mipmap-anydpi-v26"), ignore_errors=True)

def masked(size, shape):
    big = size * 4
    img = base.resize((big, big), Image.LANCZOS)
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    if shape == "round":
        d.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.22), fill=255)
    img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)

for dpi, px in sizes.items():
    folder = os.path.join(res, "mipmap-" + dpi)
    os.makedirs(folder, exist_ok=True)
    masked(px, "square").save(os.path.join(folder, "ic_launcher.png"))
    masked(px, "round").save(os.path.join(folder, "ic_launcher_round.png"))
    masked(px, "square").save(os.path.join(folder, "ic_launcher_foreground.png"))
print("icons written to", res)
