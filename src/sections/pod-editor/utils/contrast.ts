import type { RgbColor } from '../types'
import { PRINT_AREA_STROKE } from '../constants'

// WCAG relative luminance / contrast ratio
function channel(v: number) {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance({ r, g, b }: RgbColor) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: RgbColor, b: RgbColor) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function hexToRgb(hex: string): RgbColor {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Below this ratio the accent dashes blend into the product color. */
const MIN_CONTRAST = 2.4
const LIGHT = '#ffffff'
const DARK = '#1c2620'

export interface PrintAreaStrokeStyle {
  stroke: string
  strokeWidth: number
  /** Soft halo behind the dashes, in the opposite tone, so they read on any texture */
  halo: string
  fill: string
}

/**
 * Picks a dashed-outline style that stays visible on the selected product color:
 * keeps the brand accent when it contrasts enough, otherwise switches to white or
 * dark ink (whichever contrasts more) and thickens the line slightly.
 */
export function printAreaStrokeFor(product?: RgbColor): PrintAreaStrokeStyle {
  const accent = hexToRgb(PRINT_AREA_STROKE)
  if (!product || contrastRatio(accent, product) >= MIN_CONTRAST) {
    const productIsDark = product ? luminance(product) < 0.18 : false
    return {
      stroke: PRINT_AREA_STROKE,
      strokeWidth: 1.5,
      halo: productIsDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)',
      fill: 'rgba(35,160,107,0.04)',
    }
  }
  const useLight = contrastRatio(hexToRgb(LIGHT), product) >= contrastRatio(hexToRgb(DARK), product)
  return useLight
    ? { stroke: LIGHT, strokeWidth: 2, halo: 'rgba(0,0,0,0.5)', fill: 'rgba(255,255,255,0.06)' }
    : { stroke: DARK, strokeWidth: 2, halo: 'rgba(255,255,255,0.9)', fill: 'rgba(28,38,32,0.04)' }
}
