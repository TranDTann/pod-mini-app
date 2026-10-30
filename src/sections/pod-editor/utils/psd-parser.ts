import { readPsd, initializeCanvas } from '@harry2401/ag-psd'
import type { Layer } from '@harry2401/ag-psd'
import type { PsdTemplate, PrintArea, PrintAreaColor, LayerImage, RgbColor } from '../types'

export function ensureCanvasInit() {
  initializeCanvas(
    (w: number, h: number) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      return canvas
    },
    undefined,
    (w: number, h: number) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      return canvas.getContext('2d')!.createImageData(w, h)
    },
  )
}

export const COMPOSITE_ID = -1

export function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  canvas.getContext('2d')!.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function isPrintAreaLayer(child: Layer): boolean {
  const name = child.name?.toLowerCase() ?? ''
  return name === 'print area' || name === 'print_area'
}

/** Color layers are solid fills (clipped, multiply); site-admin reads their vectorFill color. */
export function getLayerColor(layer: Layer): RgbColor | null {
  const l = layer as Layer & { layerColor?: string; vectorFill?: { color?: RgbColor } }
  if (!l.layerColor || l.layerColor === 'none') return null
  const color = l.vectorFill?.color
  return color && 'r' in color ? color : null
}

export function toHex({ r, g, b }: RgbColor): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

export function extractColors(group: Layer): PrintAreaColor[] {
  const colors: PrintAreaColor[] = []
  for (const child of group.children ?? []) {
    const rgb = getLayerColor(child)
    if (rgb) {
      colors.push({
        name: child.name || toHex(rgb),
        hex: toHex(rgb),
        rgb,
        blendMode: child.blendMode,
        opacity: child.opacity,
      })
    }
  }
  return colors
}

/** The color visible in Photoshop, else White (like site-admin), else the first one. */
export function pickDefaultColor(group: Layer, colors: PrintAreaColor[]): string {
  const visible = group.children?.find((child) => getLayerColor(child) && !child.hidden)
  if (visible?.name) return visible.name
  return (colors.find((c) => c.name.toLowerCase() === 'white') ?? colors[0])?.name ?? ''
}

/** Rectangle of a shape layer, taken from its vector path (exact Photoshop coordinates). */
function vectorPathBounds(layer: Layer) {
  const knots = layer.vectorMask?.paths.flatMap((path) => path.knots) ?? []
  if (!knots.length) return null
  const xs = knots.map((k) => k.points[2])
  const ys = knots.map((k) => k.points[3])
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}

export function extractLayerBounds(layer: Layer) {
  // Shape layers (e.g. "Print area" rectangle) have empty pixel bounds; their
  // real rectangle lives in the vector mask, which is what Photoshop draws.
  const hasPixels = (layer.right ?? 0) > (layer.left ?? 0) && (layer.bottom ?? 0) > (layer.top ?? 0)
  const source = !hasPixels && layer.mask ? layer.mask : layer
  const left = source.left ?? 0
  const top = source.top ?? 0
  const right = source.right ?? 0
  const bottom = source.bottom ?? 0
  return { left, top, width: right - left, height: bottom - top }
}

export async function parsePsd(buffer: ArrayBuffer): Promise<PsdTemplate> {
  ensureCanvasInit()

  // Same as site-admin: the fork only exposes pixels through the post-image-data
  // handler (layer.canvas / psd.canvas stay empty unless useCanvasData is set).
  const layerImageData = new Map<number, ImageData>()
  let compositeImageData: ImageData | null = null

  const psd = await readPsd(
    buffer,
    { useImageData: false, useRawThumbnail: false, useCanvasData: false },
    async (imageData, { id, layerName }) => {
      if (id === COMPOSITE_ID) compositeImageData = imageData as ImageData
      // Mask data is reported with the same id but without layerName
      else if (id != null && layerName !== undefined) layerImageData.set(id, imageData as ImageData)
    },
  )

  const mockupDataUrl = compositeImageData ? imageDataToDataUrl(compositeImageData) : ''

  const printAreas: PrintArea[] = []
  const layerImages: LayerImage[] = []

  if (psd.children) {
    for (const group of psd.children) {
      if (!group.children) continue

      const baseLayer = group.children.find(
        (child: Layer) => child.name === group.name,
      )
      if (!baseLayer) continue

      const printAreaLayer = group.children.find(isPrintAreaLayer)
      const boundsSource = printAreaLayer ?? baseLayer
      const bounds = (printAreaLayer && vectorPathBounds(printAreaLayer)) ?? extractLayerBounds(boundsSource)

      if (bounds.width <= 0 || bounds.height <= 0) continue

      const baseBounds = extractLayerBounds(baseLayer)
      const baseImageData = baseLayer.id != null ? layerImageData.get(baseLayer.id) : undefined
      const imageUrl = baseImageData ? imageDataToDataUrl(baseImageData) : ''
      if (baseLayer.id != null) {
        layerImages.push({
          imageUrl,
          id: baseLayer.id,
          width: baseBounds.width,
          height: baseBounds.height,
          layerName: baseLayer.name || '',
          isLayerColor: false,
        })
      }

      const colors = extractColors(group)
      printAreas.push({
        name: group.name || 'Unnamed',
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        blendMode: boundsSource.blendMode || 'normal',
        opacity: boundsSource.opacity ?? 1,
        imageUrl,
        imageBounds: baseBounds,
        colors,
        defaultColor: pickDefaultColor(group, colors),
      })
    }
  }

  return {
    name: psd.name || 'Untitled',
    width: psd.width,
    height: psd.height,
    mockupDataUrl,
    printAreas,
    layerImages,
  }
}

/**
 * Tints a product image with a color fill layer's blend: multiply (site-admin
 * handleFillColor) or a flat fill for "normal". Done with canvas compositing, not
 * getImageData/putImageData: the canvas stores premultiplied alpha, so per-pixel
 * edits wreck the soft, semi-transparent edges of cut-out images (dark fringes).
 */
export function tintCanvas(
  source: CanvasImageSource & { width: number; height: number },
  color: RgbColor,
  { blendMode = 'multiply', opacity = 1 }: { blendMode?: string; opacity?: number } = {},
): HTMLCanvasElement {
  const { width, height } = source
  const tinted = document.createElement('canvas')
  tinted.width = width
  tinted.height = height
  const tctx = tinted.getContext('2d')!
  tctx.drawImage(source, 0, 0)
  tctx.globalCompositeOperation = blendMode === 'normal' ? 'source-in' : 'multiply'
  tctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
  tctx.fillRect(0, 0, width, height)
  // multiply also paints the transparent area: keep the source's own alpha
  tctx.globalCompositeOperation = 'destination-in'
  tctx.drawImage(source, 0, 0)
  if (opacity >= 1) return tinted

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const octx = out.getContext('2d')!
  octx.drawImage(source, 0, 0)
  octx.globalAlpha = opacity
  octx.drawImage(tinted, 0, 0)
  return out
}

/** Multiply the base layer with the product color (mirrors site-admin handleFillColor). */
export async function fillColor(imageUrl: string, color: RgbColor): Promise<string> {
  const image = new Image()
  image.src = imageUrl
  await image.decode()
  return tintCanvas(image, color).toDataURL('image/png')
}
