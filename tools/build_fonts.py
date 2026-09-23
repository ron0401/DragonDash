#!/usr/bin/env python3
"""Subset the bundled UI fonts to the glyphs the game actually uses.

Re-run after changing any on-screen text in game/index.html:

    pip install fonttools brotli
    python3 tools/build_fonts.py /path/to/source-fonts

Source fonts (SIL Open Font License), e.g. from fontsource on jsDelivr:
  m-plus-rounded-1c: japanese-500 / latin-500 / japanese-800 / latin-800 (.ttf)
  lilita-one: latin-400 (.ttf)
"""
import os, sys
from fontTools import subset
from fontTools.merge import Merger

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/fonts'
OUT = os.path.join(ROOT, 'game', 'fonts')
os.makedirs(OUT, exist_ok=True)

html = open(os.path.join(ROOT, 'game', 'index.html'), encoding='utf-8').read()
chars = set(html)
chars |= {chr(c) for c in range(0x20, 0x7F)}            # ASCII
chars |= {chr(c) for c in range(0x3040, 0x30FF + 1)}    # all kana, so small copy edits keep working
chars |= set('、。「」『』（）！？・ー〜×…　％＋－：')
text = ''.join(sorted(c for c in chars if c.isprintable() or c == '　'))

def build(sources, out_name, txt):
    tmp = []
    for i, src in enumerate(sources):
        opts = subset.Options(); opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
        f = subset.load_font(os.path.join(SRC, src), opts)
        sub = subset.Subsetter(opts); sub.populate(text=txt); sub.subset(f)
        p = os.path.join(OUT, '_tmp%d.ttf' % i); f.save(p); tmp.append(p)
    if len(tmp) > 1:
        font = Merger().merge(tmp)
    else:
        from fontTools.ttLib import TTFont
        font = TTFont(tmp[0])
    font.flavor = 'woff2'
    font.save(os.path.join(OUT, out_name))
    for p in tmp: os.remove(p)
    print(out_name, os.path.getsize(os.path.join(OUT, out_name)), 'bytes')

build(['mpr-latin-500-normal.ttf', 'mpr-japanese-500-normal.ttf'], 'round-500.woff2', text)
build(['mpr-latin-800-normal.ttf', 'mpr-japanese-800-normal.ttf'], 'round-800.woff2', text)
build(['lilita.ttf'], 'display.woff2', ''.join(chr(c) for c in range(0x20, 0x7F)) + '×')
