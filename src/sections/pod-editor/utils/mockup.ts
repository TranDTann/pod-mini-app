import { readPsd } from '@harry2401/ag-psd'
import type { Layer } from '@harry2401/ag-psd'
import type { MockupConfig } from '@/lib/mockup/config'
import { composeArt, loadBitmap } from '@/lib/mockup/browser'
import { prepareMockup, type PreparedMockup } from '@/lib/mockup/render'
import { GroupLayersEnum } from '../types'
import type { Bounds, MockupDrawable, MockupPsd, PrintAreaColor } from '../types'
import {
  COMPOSITE_ID,
  ensureCanvasInit,
  extractColors,
  extractLayerBounds,
  getLayerColor,
  pickDefaultColor,
} from './psd-parser'

// Mockup PSD → the parameters of src/lib/mockup (same steps as scripts/extract_psd.py):
//   smart object  = first visible placed layer; its group = the "Smart Object" group
//   size / quad   = placedLayer width·height / nonAffineTransform
//   meshX / meshY = warp.customEnvelopeWarp.meshPoints (else the regular 4×4 grid)
//   printArea     = layer mask of the layer the smart object is clipped to ("Mask")
//   base          = top-level layers below the group, flattened
//   effect        = first visible top-level layer above it: raw pixels, Multiply,
//                   effectOpacity = opacity × fill opacity
// Rendering is lib/mockup's "straight" mode: the print covers printArea upright,
// over the white Mask fill, Linear Burn, then × Effect.
// The product color is the PSD's own Colors group with the chosen fill shown.

const THUMBNAIL_SIDE = 320

let nextMockupId = 1

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

function downscale(imageData: ImageData, maxSide: number): string {
  const full = createCanvas(imageData.width, imageData.height)
  full.getContext('2d')!.putImageData(imageData, 0, 0)
  const scale = Math.min(1, maxSide / Math.max(imageData.width, imageData.height))
  const out = createCanvas(imageData.width * scale, imageData.height * scale)
  out.getContext('2d')!.drawImage(full, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

type LayerMask = NonNullable<Layer['mask']>

const hasMask = (layer: Layer) => !!layer.mask && !layer.mask.disabled

/** Layer mask as an alpha canvas covering `region` (outside the mask: its default color). */
function maskCanvas(maskData: ImageData, mask: LayerMask, region: Bounds): HTMLCanvasElement {
  const gray = createCanvas(maskData.width, maskData.height)
  const alpha = new ImageData(maskData.width, maskData.height)
  for (let i = 0; i < maskData.data.length; i += 4) {
    alpha.data[i] = alpha.data[i + 1] = alpha.data[i + 2] = 255
    alpha.data[i + 3] = maskData.data[i]
  }
  gray.getContext('2d')!.putImageData(alpha, 0, 0)

  const out = createCanvas(region.width, region.height)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = `rgba(255,255,255,${(mask.defaultColor ?? 0) / 255})`
  ctx.fillRect(0, 0, out.width, out.height)
  const x = (mask.left ?? 0) - region.left
  const y = (mask.top ?? 0) - region.top
  ctx.clearRect(x, y, gray.width, gray.height)
  ctx.drawImage(gray, x, y)
  return out
}

/** Photoshop blend mode → canvas operation (closest available) */
const COMPOSITE_OPS: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  'pass through': 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color burn': 'color-burn',
  'linear burn': 'multiply',
  'darker color': 'darken',
  'lighter color': 'lighten',
  'linear dodge': 'lighter',
  'hard light': 'hard-light',
  'soft light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
}

const opacityOf = (layer: Layer) => (layer.opacity ?? 1) * (layer.fillOpacity ?? 1)

export async function parseMockupPsd(buffer: ArrayBuffer, name: string): Promise<MockupPsd> {
  ensureCanvasInit()

  const layerImageData = new Map<number, ImageData>()
  const maskImageData = new Map<number, ImageData>()
  let compositeImageData: ImageData | null = null

  const psd = await readPsd(
    buffer,
    { useImageData: false, useRawThumbnail: false, useCanvasData: false },
    async (imageData, { id, layerName }) => {
      if (id === COMPOSITE_ID) compositeImageData = imageData as ImageData
      else if (id == null) return
      // Mask data is reported with the same id but without layerName
      else if (layerName !== undefined) layerImageData.set(id, imageData as ImageData)
      else maskImageData.set(id, imageData as ImageData)
    },
  )
  const docBounds: Bounds = { left: 0, top: 0, width: psd.width, height: psd.height }
  const top = psd.children ?? []

  // --- smart object + its group --------------------------------------------------
  let soLayer: Layer | null = null
  let soGroup: Layer[] = top
  const findPlaced = (nodes: Layer[]): boolean => {
    for (const node of nodes) {
      if (node.hidden) continue
      if (node.children ? findPlaced(node.children) : !!node.placedLayer) {
        if (!node.children) {
          soLayer = node
          soGroup = nodes
        }
        return true
      }
    }
    return false
  }
  findPlaced(top)
  const so = soLayer as Layer | null
  if (!so?.placedLayer) throw new Error('This mockup has no Smart Object to place the design in')
  const placed = so.placedLayer

  const size = { width: placed.width ?? 0, height: placed.height ?? 0 }
  const q = placed.nonAffineTransform?.length === 8 ? placed.nonAffineTransform : placed.transform
  const quad = [0, 1, 2, 3].map((i) => [q[i * 2], q[i * 2 + 1]] as const)
  const mesh = placed.warp?.customEnvelopeWarp?.meshPoints
  let meshX: number[], meshY: number[]
  if (mesh?.length === 16) {
    meshX = mesh.map((p) => p.x)
    meshY = mesh.map((p) => p.y)
  } else {
    // No warp → the regular grid: the formula reduces to pure perspective
    meshX = Array.from({ length: 16 }, (_, k) => ((k % 4) * size.width) / 3)
    meshY = Array.from({ length: 16 }, (_, k) => (Math.floor(k / 4) * size.height) / 3)
  }

  // Print area = mask of the layer the smart object is clipped to (same group)
  const maskLayer = soGroup.find((l) => l !== so && hasMask(l))
  const m = maskLayer?.mask
  const soBounds = extractLayerBounds(so)
  const printArea = m
    ? { x: m.left ?? 0, y: m.top ?? 0, width: (m.right ?? 0) - (m.left ?? 0), height: (m.bottom ?? 0) - (m.top ?? 0) }
    : { x: soBounds.left, y: soBounds.top, width: soBounds.width, height: soBounds.height }

  // --- base / effect: top-level layers below / above the smart object's group -------
  const groupIndex = top.findIndex((node) => node === so || (node.children && contains(node, so)))

  let colors: PrintAreaColor[] = []
  let defaultColor = ''

  /** Layer pixels with the layer mask baked in; solid color fills are painted. */
  const layerCanvas = (layer: Layer): { canvas: HTMLCanvasElement; bounds: Bounds } | null => {
    const data = layer.id != null ? layerImageData.get(layer.id) : undefined
    const maskData = layer.id != null ? maskImageData.get(layer.id) : undefined
    const masked = hasMask(layer) && !!maskData
    let bounds = extractLayerBounds(layer)
    let canvas: HTMLCanvasElement
    if (data && bounds.width > 0 && bounds.height > 0) {
      canvas = createCanvas(data.width, data.height)
      canvas.getContext('2d')!.putImageData(data, 0, 0)
    } else {
      const fill = getLayerColor(layer)
      if (!fill) return null
      const lm = layer.mask
      bounds =
        masked && (lm!.defaultColor ?? 0) === 0
          ? { left: lm!.left ?? 0, top: lm!.top ?? 0, width: (lm!.right ?? 0) - (lm!.left ?? 0), height: (lm!.bottom ?? 0) - (lm!.top ?? 0) }
          : docBounds
      if (bounds.width <= 0 || bounds.height <= 0) return null
      canvas = createCanvas(bounds.width, bounds.height)
      const fctx = canvas.getContext('2d')!
      fctx.fillStyle = `rgb(${fill.r}, ${fill.g}, ${fill.b})`
      fctx.fillRect(0, 0, bounds.width, bounds.height)
    }
    if (masked) {
      const ctx = canvas.getContext('2d')!
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(maskCanvas(maskData!, layer.mask!, bounds), 0, 0)
    }
    return { canvas, bounds }
  }

  /** Visible layer tree as drawables; the Colors group keeps every fill, tagged by name. */
  const toDrawables = (nodes: Layer[], inColors = false): MockupDrawable[] => {
    const out: MockupDrawable[] = []
    for (const node of nodes) {
      if (node.children) {
        if (node.name === GroupLayersEnum.COLORS) {
          colors = extractColors(node)
          defaultColor = pickDefaultColor(node, colors)
          out.push({ ...drawableBase(node), children: toDrawables(node.children, true), isColors: true })
          continue
        }
        if (node.hidden) continue
        out.push({ ...drawableBase(node), children: toDrawables(node.children, inColors) })
        continue
      }
      if (node.hidden && !inColors) continue
      const image = layerCanvas(node)
      if (!image) continue
      out.push({ ...drawableBase(node), ...image, colorName: inColors ? node.name : undefined })
    }
    return out
  }
  const drawableBase = (node: Layer) => ({
    blendMode: node.blendMode ?? 'normal',
    opacity: opacityOf(node),
    clipping: !!node.clipping,
  })

  const base = toDrawables(top.slice(0, groupIndex))
  const above = top.slice(groupIndex + 1).filter((l) => !l.hidden)
  const effectNode = above[0]
  // Effect: raw (Normal) pixels of its pixel layers — the Multiply happens in lib/mockup
  const effect = effectNode ? pixelLayers(effectNode).map(layerCanvas).filter((x) => !!x) : []
  const rest = toDrawables(above.slice(1))

  const config: MockupConfig = {
    canvas: { width: psd.width, height: psd.height },
    smartObject: size,
    quad,
    meshX,
    meshY,
    printArea,
    effectOpacity: effectNode ? opacityOf(effectNode) : 0,
  }

  return {
    id: nextMockupId++,
    name,
    width: psd.width,
    height: psd.height,
    thumbnailUrl: compositeImageData ? downscale(compositeImageData, THUMBNAIL_SIDE) : '',
    config,
    base,
    effect,
    rest,
    colors,
    defaultColor,
  }
}

function contains(group: Layer, layer: Layer): boolean {
  return !!group.children?.some((c) => c === layer || (c.children && contains(c, layer)))
}

function pixelLayers(node: Layer): Layer[] {
  if (!node.children) return [node]
  return node.children.filter((c) => !c.hidden).flatMap(pixelLayers)
}

// --- rendering ------------------------------------------------------------------------

/** Flattens drawables onto `ctx` (document space), with the chosen product color. */
function drawAll(ctx: CanvasRenderingContext2D, items: MockupDrawable[], colorName: string, inColors = false) {
  const { width, height } = ctx.canvas
  let clipBase: HTMLCanvasElement | null = null
  for (const item of items) {
    // Colors group: only the selected fill is shown
    if (inColors && item.colorName !== undefined && item.colorName !== colorName) continue
    let layer: HTMLCanvasElement
    if (item.children) {
      layer = createCanvas(width, height)
      drawAll(layer.getContext('2d')!, item.children, colorName, inColors || !!item.isColors)
    } else {
      layer = createCanvas(width, height)
      layer.getContext('2d')!.drawImage(item.canvas!, item.bounds!.left, item.bounds!.top)
    }
    if (item.clipping) {
      if (!clipBase) continue
      const lctx = layer.getContext('2d')!
      lctx.globalCompositeOperation = 'destination-in'
      lctx.drawImage(clipBase, 0, 0)
    } else {
      clipBase = layer
    }
    ctx.globalAlpha = item.opacity
    ctx.globalCompositeOperation = COMPOSITE_OPS[item.blendMode] ?? 'source-over'
    ctx.drawImage(layer, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

const prepared = new WeakMap<MockupPsd, Map<string, PreparedMockup>>()

function prepare(mockup: MockupPsd, colorName: string): PreparedMockup {
  let byColor = prepared.get(mockup)
  if (!byColor) prepared.set(mockup, (byColor = new Map()))
  const hit = byColor.get(colorName)
  if (hit) return hit

  const { width, height } = mockup
  const base = createCanvas(width, height)
  const bctx = base.getContext('2d', { willReadFrequently: true })!
  drawAll(bctx, mockup.base, colorName)
  const effect = createCanvas(width, height)
  const ectx = effect.getContext('2d', { willReadFrequently: true })!
  for (const e of mockup.effect) ectx.drawImage(e.canvas, e.bounds.left, e.bounds.top)

  const prep = prepareMockup(
    { width, height, data: bctx.getImageData(0, 0, width, height).data },
    { width, height, data: ectx.getImageData(0, 0, width, height).data },
    mockup.config,
  )
  byColor.set(colorName, prep)
  return prep
}

/**
 * Renders the mockup with the design (lib/mockup "straight" mode, cover fit) and the
 * product in the chosen color; layers above the Effect group are drawn on top.
 */
export async function renderMockup(mockup: MockupPsd, designUrl: string | null, colorName: string): Promise<string> {
  const prep = prepare(mockup, colorName)
  const pixels = designUrl
    ? await composeArt(prep, mockup.config, await loadBitmap(designUrl), 'straight', 'cover')
    : prep.blank
  const out = createCanvas(prep.width, prep.height)
  const ctx = out.getContext('2d')!
  ctx.putImageData(new ImageData(pixels, prep.width, prep.height), 0, 0)
  if (mockup.rest.length) drawAll(ctx, mockup.rest, colorName)
  return out.toDataURL('image/png')
}

