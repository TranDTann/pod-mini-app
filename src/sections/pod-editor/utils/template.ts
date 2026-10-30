import { parseTemplate, type RawImage } from '@/lib/psd-template/parse'
import { renderMockup, type RenderEnv } from '@/lib/psd-template/render'
import { quadBounds } from '@/lib/psd-template/geometry'
import type { Issue, SideSpec, TemplateSpec } from '@/lib/psd-template/types'
import type { PrintArea, PrintAreaColor, PsdTemplate, RgbColor } from '../types'

// PSD template → editor template, via the normalized TemplateSpec of lib/psd-template.
// The parser recognizes layer roles (base / color / design / print area / overlay…) from
// profile overrides, [tags] in layer names, or heuristics, so templates with very different
// layer structures load without template-specific code. The editor only sees the result.

/** Longest edge the side backgrounds are rendered at (enough for a sharp editor view). */
const RENDER_MAX_EDGE = 1800

const env: RenderEnv = {
  createCanvas: (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
}

function toCanvas(img: RawImage) {
  const canvas = env.createCanvas(img.width, img.height) as HTMLCanvasElement
  const data = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height)
  canvas.getContext('2d')!.putImageData(data, 0, 0)
  return canvas
}

function hexToRgb(hex: string): RgbColor {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const SIDE_LABELS: Record<string, string> = {
  front: 'Front', back: 'Back', left_sleeve: 'Left sleeve', right_sleeve: 'Right sleeve', neck: 'Neck', hood: 'Hood',
}

/** Display name of a side: its group name, or a readable key for flat files ("Root"). */
function sideName(side: SideSpec) {
  return side.label && side.label !== 'Root' ? side.label : SIDE_LABELS[side.key] ?? side.key
}

/**
 * Print area of a side in document px. The editor works with an upright rectangle, so a
 * rotated / perspective slot uses its bounding box. Sides without any slot fall back to the
 * middle of the product image (reported as an issue).
 */
function areaRect(spec: TemplateSpec, side: SideSpec, issues: Issue[]) {
  const area = side.printAreas[0]
  if (area) {
    const [l, t, r, b] = quadBounds(area.quad)
    return { left: l, top: t, width: r - l, height: b - t }
  }
  const base = side.stack.find((n) => n.kind === 'image' && (n.role === 'base' || n.colorKey))
  const asset = base?.kind === 'image' ? spec.assets[base.asset] : undefined
  const box = asset ?? { left: 0, top: 0, width: spec.canvas.width, height: spec.canvas.height }
  issues.push({
    level: 'warn',
    code: 'PRINT_AREA_GUESSED',
    message: `Side "${sideName(side)}": no smart object / print area layer — using the middle of the product. Add a "Print area" shape or a [printarea] tag to set it.`,
  })
  return {
    left: box.left + box.width * 0.25,
    top: box.top + box.height * 0.27,
    width: box.width * 0.5,
    height: box.height * 0.45,
  }
}

export type EditorTemplate = PsdTemplate & {
  spec: TemplateSpec
  issues: Issue[]
  /** Product image of a print side in the given color (data URL, full document frame) */
  renderSide: (index: number, colorName?: string) => string
}

/** Reads any supported PSD template into the editor's template model. */
export async function parseTemplateFile(buffer: ArrayBuffer, fileName: string): Promise<EditorTemplate> {
  const { spec, images } = parseTemplate(buffer, { fileName })
  const issues = [...spec.issues]
  const fatal = spec.issues.find((i) => i.level === 'error' && i.code !== 'NO_PRINT_AREA' && i.code !== 'NO_BASE')
  if (fatal) throw new Error(fatal.message)
  if (spec.sides.length === 0) throw new Error('No print side found in this PSD')

  const assets: Record<string, HTMLCanvasElement> = {}
  images.forEach((img, id) => (assets[id] = toCanvas(img)))

  const { width: W, height: H } = spec.canvas
  const scale = Math.min(1, RENDER_MAX_EDGE / Math.max(W, H))
  const colorKeyByName = new Map(spec.colors.map((c) => [c.name, c.key]))
  const cache = new Map<string, string>()

  const renderSide = (index: number, colorName?: string) => {
    const side = spec.sides[index]
    if (!side) return ''
    const color = colorName ? colorKeyByName.get(colorName) ?? null : side.defaultColor ?? side.colors[0] ?? null
    const key = `${index}|${color}`
    let url = cache.get(key)
    if (!url) {
      // No designs: design slots stay empty, the editor puts the artwork on top
      const canvas = renderMockup(spec, env, { side: side.key, color, assets, designs: {}, scale }) as HTMLCanvasElement
      url = canvas.toDataURL('image/png')
      cache.set(key, url)
    }
    return url
  }

  const printAreas: PrintArea[] = spec.sides.map((side, index) => {
    const colors: PrintAreaColor[] = side.colors
      .map((key) => spec.colors.find((c) => c.key === key))
      .filter((c, i, list): c is NonNullable<typeof c> => !!c && list.findIndex((x) => x?.key === c.key) === i)
      .map((c) => ({ name: c.name, hex: c.hex, rgb: hexToRgb(c.hex) }))
    const defaultKey = side.defaultColor ?? side.colors[0]
    return {
      name: sideName(side),
      ...areaRect(spec, side, issues),
      blendMode: 'normal',
      opacity: 1,
      imageUrl: renderSide(index),
      imageBounds: { left: 0, top: 0, width: W, height: H },
      colors,
      defaultColor: spec.colors.find((c) => c.key === defaultKey)?.name ?? '',
    }
  })

  for (const i of issues) if (i.level !== 'info') console.warn(`[template] ${i.code}: ${i.message}`)

  return {
    name: fileName.replace(/\.psd$/i, ''),
    width: W,
    height: H,
    mockupDataUrl: printAreas[0]?.imageUrl ?? '',
    printAreas,
    layerImages: [],
    spec,
    issues,
    renderSide,
  }
}

/** The editor template's renderer, if it was read by parseTemplateFile. */
export function sideRenderer(template: PsdTemplate | null | undefined) {
  return (template as Partial<EditorTemplate> | null | undefined)?.renderSide
}
