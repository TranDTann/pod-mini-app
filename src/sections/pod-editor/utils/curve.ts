import { IText, Path, Point } from 'fabric'

/** Custom property holding a text's bend, -100 (smile) … 0 (straight) … 100 (arch). */
export const CURVE_KEY = '_curve'

/** At ±100 the text wraps a full circle (a hair short, so its two ends don't collide). */
const MAX_ANGLE = Math.PI * 2 * 0.97

type CurvedText = IText & { [CURVE_KEY]?: number }

export function getCurve(text: IText) {
  return (text as CurvedText)[CURVE_KEY] ?? 0
}

/** Only single-line text can follow a path (Fabric stacks every line on the same path). */
export function canCurve(text: IText) {
  return !text.text.includes('\n')
}

/**
 * Arc with its apex at (0, 0): an arch (center below) for curve > 0, a smile for curve < 0.
 * Fabric sizes a path text's box to its path, so the arc spans just the text's length —
 * any extra would show up as empty space in the selection box.
 */
function arcPath(radius: number, span: number, arch: boolean) {
  // Two arcs meeting at the apex, each at most a half circle, so the path can wrap a full circle
  const half = span / 2
  const x = radius * Math.sin(half)
  const y = radius * (1 - Math.cos(half))
  const r = `${radius} ${radius} 0 0`
  return arch
    ? `M ${-x} ${y} A ${r} 1 0 0 A ${r} 1 ${x} ${y}`
    : `M ${-x} ${-y} A ${r} 0 0 0 A ${r} 0 ${x} ${-y}`
}

/** Bends (or straightens) the text along an arc sized to its current width. */
export function applyCurve(text: IText, curve: number) {
  const value = canCurve(text) ? Math.max(-100, Math.min(100, Math.round(curve))) : 0
  ;(text as CurvedText)[CURVE_KEY] = value || undefined

  // Measure straight
  text.path = undefined
  text.initDimensions()
  if (value === 0) return

  const width = Math.max(1, text.calcTextWidth())
  const angle = (Math.abs(value) / 100) * MAX_ANGLE
  const radius = width / angle
  // A hair longer than the text so the last glyph never runs past the end of the path
  const span = Math.min(angle * 1.02, Math.PI * 2 * 0.995)
  text.set({
    path: new Path(arcPath(radius, span, value > 0), { visible: false }),
    // Letters always sit on the outside of the circle — standing on an arch, hanging under
    // a smile — so they stay upright, readable and never crowd the center at full curve
    pathAlign: value > 0 ? 'baseline' : 'ascender',
  })
  text.initDimensions()
}

// ── Selection box that hugs the curved letters ──
//
// Fabric sizes text-on-a-path to the path's own box, which ignores the letters' height:
// the selection ends up a thin strip (or wider than the text). Glyphs are drawn at
// "point on path − path.pathOffset", so re-centering pathOffset on the glyphs' real bounds
// and sizing the box to them makes the box wrap exactly what's drawn.

type CharBox = { renderLeft?: number; renderTop?: number; angle?: number; kernedWidth: number }
type PathWithOrigin = Path & { _baseOffset?: Point }

/** Letters' extent across the path, × font size (ascender to descender). */
const GLYPH_HEIGHT = 1.12

function fitBoxToGlyphs(text: IText) {
  const path = text.path as PathWithOrigin | undefined
  if (!path) return
  path._baseOffset ??= new Point(path.pathOffset)
  path.pathOffset = new Point(path._baseOffset)
  ;(text as unknown as { _clearCache: () => void })._clearCache()
  text.calcTextWidth() // lays the glyphs out on the path with the base offset

  const boxes = ((text as unknown as { __charBounds: CharBox[][] }).__charBounds[0] ?? []).filter(
    (b) => b.renderLeft !== undefined,
  )
  if (boxes.length === 0) return
  const h = text.fontSize * GLYPH_HEIGHT
  // Letters hang below the path (ascender) or stand on it (descender)
  const [y0, y1] =
    text.pathAlign === 'ascender'
      ? [0, h]
      : text.pathAlign === 'descender'
        ? [-h, 0]
        : text.pathAlign === 'baseline'
          ? [-h * 0.8, h * 0.2]
          : [-h / 2, h / 2]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    const cos = Math.cos(b.angle ?? 0)
    const sin = Math.sin(b.angle ?? 0)
    const w = b.kernedWidth / 2
    for (const [x, y] of [[-w, y0], [w, y0], [-w, y1], [w, y1]]) {
      const px = b.renderLeft! + x * cos - y * sin
      const py = b.renderTop! + x * sin + y * cos
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minY = Math.min(minY, py)
      maxY = Math.max(maxY, py)
    }
  }
  const pad = (text.strokeWidth || 0) / 2
  // renderLeft/Top are relative to the base offset; move the offset to the glyphs' center
  path.pathOffset = new Point(path._baseOffset.x + (minX + maxX) / 2, path._baseOffset.y + (minY + maxY) / 2)
  ;(text as unknown as { _clearCache: () => void })._clearCache()
  text.calcTextWidth()
  text.width = maxX - minX + pad * 2
  text.height = maxY - minY + pad * 2
}

let installed = false

/** Makes every curved text (also ones restored from history) keep a box that hugs its letters. */
export function installCurvedTextBox() {
  if (installed) return
  installed = true
  const original = IText.prototype.initDimensions
  IText.prototype.initDimensions = function (this: IText) {
    original.call(this)
    if (this.path && getCurve(this) !== 0) fitBoxToGlyphs(this)
  }
}
