# Builds the p00.webp … files used by data.js: dedupe by size, resize to 1200px,
# stamp the Naghsh Ara logo + domain in the corner, save as WebP.
#   python scripts/import-products/prepare-images.py "C:\path\to\source folder"
import os, sys
from PIL import Image, ImageDraw, ImageFont

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'images'); os.makedirs(OUT, exist_ok=True)
LOGO = os.path.join(HERE, '..', '..', 'public', 'icons', 'naghshe-ara-logo.png')

files, seen = [], set()
for f in sorted(os.listdir(SRC)):
    if not f.lower().startswith('chatgpt'): continue
    size = os.path.getsize(os.path.join(SRC, f))
    if size in seen: continue
    seen.add(size); files.append(f)

logo = Image.open(LOGO).convert('RGBA')
font = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', 26)
with open(os.path.join(HERE, 'source-files.txt'), 'w', encoding='utf8') as fh:
    for i, f in enumerate(files):
        fh.write(f'{i}\t{f}\n')
        im = Image.open(os.path.join(SRC, f)).convert('RGB')
        im.thumbnail((1200, 1200), Image.LANCZOS)
        W, H = im.size
        layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
        lw = int(W * 0.13); lg = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        lg.putalpha(lg.split()[3].point(lambda p: int(p * 0.6)))
        x, y = W - lw - 28, H - lg.height - 56
        layer.paste(lg, (x, y), lg)
        d = ImageDraw.Draw(layer); txt = 'naghsh-araco.com'; tw = d.textlength(txt, font=font)
        d.text((x + lw / 2 - tw / 2 + 1, y + lg.height + 5), txt, font=font, fill=(0, 0, 0, 70))
        d.text((x + lw / 2 - tw / 2, y + lg.height + 4), txt, font=font, fill=(20, 90, 50, 190))
        Image.alpha_composite(im.convert('RGBA'), layer).convert('RGB').save(
            os.path.join(OUT, f'p{i:02d}.webp'), 'WEBP', quality=82, method=6)
print(len(files), 'images written to', OUT)
