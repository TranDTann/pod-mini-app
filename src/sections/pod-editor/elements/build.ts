import { FabricObject, IText, Path, Point, loadSVGFromString, util } from 'fabric'
import { arcPath, type ElementItem, type TextPart } from './library'
import { CURVE_KEY } from '../utils/curve'

/** Marks a vector element whose fill can be recolored from the style panel. */
export const EDITABLE_FILL_KEY = '_editableFill'

/** Fabric places the baseline about this far below a text line's center (× font size). */
const BASELINE_FROM_CENTER = 0.36

/** Wait for a web font so Fabric measures the text with it, not with the fallback. */
async function ensureFont(part: TextPart) {
  try {
    await document.fonts.load(`${part.italic ? 'italic ' : ''}${part.weight === 'bold' ? 700 : 400} ${part.size}px "${part.font}"`)
  } catch {
    // fall back to whatever is available
  }
}

/** One text line of a preset, centered on (0, y) in preset space (center = 0, 0). */
function buildTextPart(part: TextPart) {
  const text = new IText(part.text, {
    fontFamily: part.font,
    fontSize: part.size,
    fill: part.fill,
    fontWeight: part.weight ?? 'normal',
    fontStyle: part.italic ? 'italic' : 'normal',
    charSpacing: part.spacing ?? 0,
    stroke: part.stroke,
    strokeWidth: part.strokeWidth ?? 0,
    paintFirst: part.stroke ? 'stroke' : 'fill',
    textAlign: 'center',
  })
  const y = part.y - 100
  if (!part.curve) {
    text.setPositionByOrigin(new Point(0, y - part.size * BASELINE_FROM_CENTER), 'center', 'center')
    return text
  }

  // Measure straight first, then bend along an arc sized for that length.
  // Letters sit inside the arc's box (hanging from an arch, standing on a smile),
  // so the selection box hugs the curved text.
  const width = text.calcTextWidth()
  const path = new Path(arcPath(part.curve, width), { visible: false })
  // Same scale as the Curve slider (100 = text wraps a full circle), so the panel shows its bend
  ;(text as IText & Record<string, unknown>)[CURVE_KEY] = Math.round(
    Math.sign(part.curve) * Math.min(100, (width / Math.abs(part.curve) / (Math.PI * 2 * 0.97)) * 100),
  )
  text.set({ path, pathAlign: part.curve > 0 ? 'ascender' : 'descender' })
  text.initDimensions()
  // The object's box is the arc's box: the apex is its top (arch) or bottom (smile)
  const cy = part.curve > 0 ? y + text.height / 2 : y - text.height / 2
  text.setPositionByOrigin(new Point(0, cy), 'center', 'center')
  return text
}

/**
 * Fabric objects for a library item, in a shared local space centered on (0, 0).
 * Text presets return one object per line so each stays editable.
 */
export async function buildElement(item: ElementItem): Promise<FabricObject[]> {
  if (item.kind === 'svg') {
    const { objects, options } = await loadSVGFromString(item.svg)
    const shapes = objects.filter((o): o is FabricObject => !!o)
    const obj = shapes.length === 1 ? shapes[0] : util.groupSVGElements(shapes, options)
    if (item.editable) (obj as FabricObject & Record<string, unknown>)[EDITABLE_FILL_KEY] = true
    return [obj]
  }

  await Promise.all(item.parts.map(ensureFont))
  return item.parts.map(buildTextPart)
}
