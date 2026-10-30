import type { MockupConfig } from '@/lib/mockup/config'
export interface LayerImage {
  imageUrl: string
  id: number
  width: number
  height: number
  layerName: string
  isLayerColor: boolean
}

export interface RgbColor {
  r: number
  g: number
  b: number
}

/** A color layer inside a print side folder — a color allowed for that side */
export interface PrintAreaColor {
  name: string
  hex: string
  rgb: RgbColor
  /** Blend mode / opacity of the color fill layer in Photoshop (multiply for most) */
  blendMode?: string
  opacity?: number
}

export interface PrintArea {
  name: string
  left: number
  top: number
  width: number
  height: number
  blendMode: string
  opacity: number
  /** Base layer image (the layer named like its folder), untinted */
  imageUrl: string
  /** Position of the base layer image in PSD document coordinates */
  imageBounds?: { left: number; top: number; width: number; height: number }
  /** Colors allowed for this side, read from its color fill layers */
  colors?: PrintAreaColor[]
  /** Name of the color selected by default */
  defaultColor?: string
}

export interface PsdTemplate {
  name: string
  width: number
  height: number
  mockupDataUrl: string
  printAreas: PrintArea[]
  layerImages: LayerImage[]
}

export enum GroupLayersEnum {
  BACKGROUND = 'Background',
  BASE_PRODUCT = 'Base Product',
  COLORS = 'Colors',
  SMART_OBJECT = 'Smart Object',
}

export interface LayerInfo {
  id: number
  name: string
  type: string
  thumbnail: string
  visible: boolean
  locked: boolean
}

export interface SelectedObjectProps {
  widthInch: number
  heightInch: number
  leftPercent: number
  topPercent: number
  angle: number
  scalePercent: number
  opacity: number
  locked: boolean
  /** Element was changed since it was added */
  modified: boolean
}

export type EditorTool = 'select' | 'pan'

export interface TextStyleProps {
  kind: 'text'
  fontFamily: string
  fontSize: number
  fill: string
  bold: boolean
  italic: boolean
  underline: boolean
  textAlign: 'left' | 'center' | 'right'
  charSpacing: number
  lineHeight: number
  stroke: string
  strokeWidth: number
  shadow: boolean
  /** -100 (smile) … 0 (straight) … 100 (arch) */
  curve: number
  /** Curving needs single-line text */
  canCurve: boolean
}

export interface ImageStyleProps {
  kind: 'image'
  /** -100..100 */
  brightness: number
  contrast: number
  saturation: number
  /** 0..100 */
  blur: number
  grayscale: boolean
  sepia: boolean
  invert: boolean
  shadow: boolean
}

/** Recolorable vector element from the library (shapes) */
export interface ShapeStyleProps {
  kind: 'shape'
  fill: string
  shadow: boolean
}

export type ObjectStyleProps = TextStyleProps | ImageStyleProps | ShapeStyleProps

export interface Bounds {
  left: number
  top: number
  width: number
  height: number
}

/** A raster placed in document space (PSD px). */
export interface PlacedImage {
  url: string
  bounds: Bounds
}

/** A layer (or group) of a mockup PSD, flattened when rendering. */
export interface MockupDrawable {
  /** Pixels with the layer mask baked in, at `bounds` (document space) */
  canvas?: HTMLCanvasElement
  bounds?: Bounds
  children?: MockupDrawable[]
  blendMode: string
  /** opacity × fill opacity */
  opacity: number
  clipping: boolean
  /** The Colors group: only the selected fill is drawn */
  isColors?: boolean
  /** Fill layer inside the Colors group */
  colorName?: string
}

export interface MockupPsd {
  id: number
  name: string
  width: number
  height: number
  thumbnailUrl: string
  /** Smart object / print area parameters for lib/mockup */
  config: MockupConfig
  /** Layers below the Smart Object group */
  base: MockupDrawable[]
  /** Effect group pixels (Multiply × config.effectOpacity) */
  effect: { canvas: HTMLCanvasElement; bounds: Bounds }[]
  /** Any layers above the Effect group */
  rest: MockupDrawable[]
  colors: PrintAreaColor[]
  defaultColor: string
}
