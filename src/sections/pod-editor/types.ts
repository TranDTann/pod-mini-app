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

/** One product color of a mockup: Solid Color layers switched on or off when rendering. */
export interface MockupVariant {
  name: string
  /** The fill layer(s) with this color */
  paths: string[]
  /** Their groups, which must be visible for the fill to show */
  parents: string[]
}

export interface MockupPsd {
  id: number
  name: string
  width: number
  height: number
  thumbnailUrl: string
  /** Key of the compiled PSD in the mockup engine's worker */
  engineKey: string
  /** Smart Object slots (lib/mockup-engine) */
  slots: string[]
  /** Slot of the biggest visible Smart Object */
  mainSlot: string
  /** PSD features the engine can't reproduce */
  warnings: string[]
  variants: MockupVariant[]
  colors: PrintAreaColor[]
  defaultColor: string
}
