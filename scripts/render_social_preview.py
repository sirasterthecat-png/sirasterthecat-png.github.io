"""Render the official SirAsterTheCat Open Graph card using existing original art."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/social-preview-furry-extraordinaire.jpg"
W, H = 1200, 630

card = Image.new("RGB", (W, H), "#071326")
draw = ImageDraw.Draw(card)
for y in range(H):
    shade = y / H
    draw.line([(0,y),(W,y)], fill=(round(5+8*shade),round(16+12*shade),round(37+23*shade)))
draw.ellipse((700,-110,1330,520),fill="#102b50")
draw.ellipse((756,-55,1275,464),outline="#378eaa",width=3)
draw.ellipse((785,-25,1244,434),outline="#27617f",width=2)
for x,y,r in [(50,44,2),(210,72,2),(418,55,3),(584,98,2),(694,186,2),(721,477,3),(45,488,2),(364,513,2),(570,557,2),(1115,53,3),(1045,576,2),(1152,524,2)]:
    draw.ellipse((x-r,y-r,x+r,y+r),fill="#8ce6ef")

art = Image.open(ROOT/"assets/SirAsterCompressed.png").convert("RGBA")
art.thumbnail((535,610), Image.Resampling.LANCZOS)
layer = card.convert("RGBA")
x = 763+(437-art.width)//2
layer.alpha_composite(art,(x,630-art.height+16))

draw = ImageDraw.Draw(layer)
bold="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
regular="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
title = ImageFont.truetype(bold,74)
sub = ImageFont.truetype(bold,29)
small = ImageFont.truetype(regular,22)
draw.text((74,165),"SIR ASTER",font=title,fill="#f7fbff")
draw.text((74,252),"THE CAT",font=title,fill="#72e7f1")
draw.line([(76,355),(690,355)],fill="#5fcbdf",width=4)
draw.text((75,384),"FURRY EXTRAORDINAIRE",font=sub,fill="#f6f9ff")
draw.text((77,439),"Gaming adventures under the stars.",font=small,fill="#c7deed")
draw.text((77,555),"sirasterthecat.men",font=small,fill="#95c7db")
layer.convert("RGB").save(OUT,quality=92,optimize=True)
assert Image.open(OUT).size == (1200,630)
print(f"Created {OUT} ({OUT.stat().st_size} bytes)")
