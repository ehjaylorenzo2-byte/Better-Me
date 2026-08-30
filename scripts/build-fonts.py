#!/usr/bin/env python3
"""
Build the self-hosted Better Me webfonts.

Neither Creato Display nor RT Rondelle ships U+20B1 PESO SIGN, and Better Me shows a peso on
almost every screen. Falling back to a system font for that one character makes
the biggest number on the page look broken, so we synthesise the glyph here from
the font's own capital P plus two bars sized from the font's own stem. Doing it
per weight keeps the peso as heavy as the digits beside it.

Also maps U+00A0 to the space glyph, because Intl.NumberFormat emits a
non-breaking space in some locales and a missing nbsp shows as a tofu box.

Run:  python3 scripts/build-fonts.py
Out:  public/fonts/CreatoDisplay-{Regular,Medium,Black}.woff2
      public/fonts/RTRondelle-{Book,Bold}.woff2
"""

import os
import sys

from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.t2CharStringPen import T2CharStringPen

UPLOADS = os.environ.get(
    "CREATO_SRC",
    "/root/.claude/uploads/089a0716-12b6-519e-b2f1-5ee79704ec85",
)

SOURCES = {
    "b8a3e4f3-CreatoDisplayRegular.otf": "CreatoDisplay-Regular.woff2",
    "577145cf-CreatoDisplayMedium.otf": "CreatoDisplay-Medium.woff2",
    "f4d82adc-CreatoDisplayBlack.otf": "CreatoDisplay-Black.woff2",
    # RT Rondelle, the rounded geometric the redesign uses. Same peso problem.
    "2380d777-RTRondelleBook.otf": "RTRondelle-Book.woff2",
    "fc4ccb58-RTRondelleBold.otf": "RTRondelle-Bold.woff2",
}

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "fonts")


def contour_area(points):
    """Signed area via the shoelace formula. Sign tells us the winding direction."""
    total = 0.0
    for i in range(len(points)):
        x0, y0 = points[i]
        x1, y1 = points[(i + 1) % len(points)]
        total += x0 * y1 - x1 * y0
    return total / 2.0


def outer_winding_is_ccw(glyph_set, glyph_name):
    """
    Returns True when the glyph's largest contour runs counter-clockwise.

    We need this because we add the peso bars as plain rectangles and the fill
    is non-zero. A rectangle wound against the outer contour would subtract
    where it overlaps the stem and punch a hole straight through the glyph
    instead of drawing a bar.
    """
    pen = RecordingPen()
    glyph_set[glyph_name].draw(pen)

    contours = []
    current = []
    for op, args in pen.value:
        if op == "moveTo":
            if current:
                contours.append(current)
            current = [args[0]]
        elif op in ("lineTo", "curveTo", "qCurveTo"):
            # Sampling on-curve endpoints only is enough to get the sign right.
            current.extend(p for p in args if p is not None)
        elif op == "closePath":
            if current:
                contours.append(current)
            current = []
    if current:
        contours.append(current)

    if not contours:
        return True
    largest = max(contours, key=lambda c: abs(contour_area(c)))
    return contour_area(largest) > 0


def draw_rect(pen, x0, y0, x1, y1, ccw):
    if ccw:
        pen.moveTo((x0, y0))
        pen.lineTo((x1, y0))
        pen.lineTo((x1, y1))
        pen.lineTo((x0, y1))
    else:
        pen.moveTo((x0, y0))
        pen.lineTo((x0, y1))
        pen.lineTo((x1, y1))
        pen.lineTo((x1, y0))
    pen.closePath()


def add_peso(font):
    glyph_set = font.getGlyphSet()

    if "P" not in glyph_set or "I" not in glyph_set:
        raise SystemExit("Source font has no P or I to build the peso from.")

    bounds = BoundsPen(glyph_set)
    glyph_set["P"].draw(bounds)
    x_min, _y_min, x_max, y_max = bounds.bounds

    # Capital I is a bare stem in this family, so its width is the stem weight.
    stem_bounds = BoundsPen(glyph_set)
    glyph_set["I"].draw(stem_bounds)
    stem = stem_bounds.bounds[2] - stem_bounds.bounds[0]

    p_width = font["hmtx"]["P"][0]
    cap = y_max

    # Horizontals read lighter than verticals at the same measure, so the bars
    # are a touch thinner than the stem. Both bar and gap are also capped
    # against cap height: Black has a 194 unit stem, and scaling purely off that
    # produces two slabs that swallow the whole letter.
    bar = round(min(stem * 0.62, cap * 0.105))
    gap = round(max(bar * 0.75, cap * 0.062))

    # Centre the pair so both bars cross the bowl rather than hanging off the
    # bare stem underneath it. The bowl bottom sits near 0.39 of cap in this
    # family, so 0.56 keeps the lower bar comfortably inside it.
    pair_centre = round(cap * 0.56)
    lower_y0 = pair_centre - gap // 2 - bar
    lower_y1 = lower_y0 + bar
    upper_y0 = pair_centre + gap // 2
    upper_y1 = upper_y0 + bar

    overhang_left = round(min(stem * 0.5, cap * 0.075))
    overhang_right = round(min(stem * 0.16, cap * 0.028))
    bar_x0 = x_min - overhang_left
    bar_x1 = x_max + overhang_right

    # Widen the advance so the bars do not crowd whatever follows the peso.
    advance = p_width + overhang_left + overhang_right

    ccw = outer_winding_is_ccw(glyph_set, "P")

    pen = T2CharStringPen(advance, glyph_set)
    glyph_set["P"].draw(pen)
    draw_rect(pen, bar_x0, lower_y0, bar_x1, lower_y1, ccw)
    draw_rect(pen, bar_x0, upper_y0, bar_x1, upper_y1, ccw)

    cff = font["CFF "].cff
    top_dict = cff.topDictIndex[0]
    charstring = pen.getCharString(private=top_dict.Private, globalSubrs=top_dict.GlobalSubrs)

    name = "peso"
    charstrings = top_dict.CharStrings
    # CharStrings.__setitem__ only rebinds names it already knows, so a brand new
    # glyph has to be pushed onto the index and registered by hand first.
    charstring.private = top_dict.Private
    charstring.globalSubrs = top_dict.GlobalSubrs
    charstrings.charStringsIndex.append(charstring)
    charstrings.charStrings[name] = len(charstrings.charStringsIndex) - 1
    if name not in top_dict.charset:
        top_dict.charset.append(name)

    font["hmtx"].metrics[name] = (advance, bar_x0)
    order = font.getGlyphOrder()
    if name not in order:
        font.setGlyphOrder(list(order) + [name])

    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[0x20B1] = name
            if 0x00A0 not in table.cmap and "space" in glyph_set:
                table.cmap[0x00A0] = "space"

    font["maxp"].numGlyphs = len(font.getGlyphOrder())
    return {
        "stem": stem,
        "bar": bar,
        "advance": advance,
        "bars": [(lower_y0, lower_y1), (upper_y0, upper_y1)],
        "ccw": ccw,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for src_name, out_name in SOURCES.items():
        path = os.path.join(UPLOADS, src_name)
        if not os.path.exists(path):
            print(f"{out_name:32} skipped, source not present")
            continue
        font = TTFont(path)
        info = add_peso(font)
        font.flavor = "woff2"
        out = os.path.join(OUT_DIR, out_name)
        font.save(out)
        size = os.path.getsize(out)
        print(f"{out_name:32} {size / 1024:6.1f} KB  stem={info['stem']} bar={info['bar']} ccw={info['ccw']}")


if __name__ == "__main__":
    main()
