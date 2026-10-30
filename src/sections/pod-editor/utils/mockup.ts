import { compileInWorker, releaseInWorker, renderImageInWorker } from '@/lib/mockup-engine/browser'
import type { MockupSpec, SpecNode } from '@/lib/mockup-engine/types'
import { GroupLayersEnum } from '../types'
import type { MockupPsd, MockupVariant, PrintAreaColor } from '../types'
import { toHex } from './psd-parser'

// A mockup PSD is compiled once by lib/mockup-engine (docs/ALGORITHM.md) in its worker;
// each preview re-renders it there with the design placed into the Smart Object's
// content frame, exactly like Replace Contents in Photoshop. Mockups that only open a
// small print window onto a heavily warped Smart Object get the design upright in it.

const THUMBNAIL_SIDE = 320

let nextMockupId = 1

/** Solid fills that recolor the product: siblings in the Colors group, or next to a hidden fill. */
function collectVariants(nodes: SpecNode[], parents: SpecNode[], out: { node: Extract<SpecNode, { type: 'solid' }>; parents: SpecNode[] }[]) {
  const group = parents[parents.length - 1]
  const solids = nodes.filter((n) => n.type === 'solid')
  if (group?.name === GroupLayersEnum.COLORS || solids.some((n) => n.hidden)) {
    for (const node of solids) out.push({ node, parents })
  }
  for (const n of nodes) if (n.type === 'group') collectVariants(n.children, [...parents, n], out)
}

function readColors(spec: MockupSpec) {
  const found: Parameters<typeof collectVariants>[2] = []
  collectVariants(spec.layers, [], found)

  const colors: PrintAreaColor[] = []
  const variants: MockupVariant[] = []
  let visibleColor = ''
  for (const { node, parents } of found) {
    if (!variants.some((v) => v.name === node.name)) {
      const [r, g, b] = node.color
      const rgb = { r, g, b }
      colors.push({ name: node.name, hex: toHex(rgb), rgb, blendMode: node.blendMode, opacity: node.opacity })
      variants.push({ name: node.name, paths: [], parents: [] })
    }
    const variant = variants.find((v) => v.name === node.name)!
    variant.paths.push(node.path)
    variant.parents.push(...parents.map((p) => p.path))
    if (!visibleColor && !node.hidden && parents.every((p) => !p.hidden)) visibleColor = node.name
  }
  // Nothing on: White (a Multiply fill that changes nothing) matches the PSD as saved
  const white = colors.find((c) => c.name.toLowerCase() === 'white')
  return { colors, variants, defaultColor: visibleColor || white?.name || '' }
}

const quadArea = (q: number[]) => {
  let sum = 0
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    sum += q[i * 2] * q[j * 2 + 1] - q[j * 2] * q[i * 2 + 1]
  }
  return Math.abs(sum) / 2
}

/** The biggest visible Smart Object takes the design (others, e.g. a neck tag, may stay as saved). */
function findMainSlot(nodes: SpecNode[], best = { slot: '', area: 0 }) {
  for (const n of nodes) {
    if (n.hidden) continue
    if (n.type === 'group') findMainSlot(n.children, best)
    else if (n.type === 'smart' && quadArea(n.geometry.quad) > best.area) {
      best.slot = n.slot
      best.area = quadArea(n.geometry.quad)
    }
  }
  return best
}

export async function parseMockupPsd(buffer: ArrayBuffer, name: string): Promise<MockupPsd> {
  const id = nextMockupId++
  const engineKey = `upload-${id}`
  const { spec, thumbnail } = await compileInWorker({ key: engineKey, buffer, source: name, thumbnailSide: THUMBNAIL_SIDE })
  const mainSlot = findMainSlot(spec.layers).slot || spec.slots[0]?.key
  if (!mainSlot) {
    releaseInWorker(engineKey)
    throw new Error('This mockup has no Smart Object to place the design in')
  }
  if (spec.warnings.length) console.warn(`[mockup] ${name}:`, spec.warnings)
  return {
    id,
    name,
    width: spec.width,
    height: spec.height,
    thumbnailUrl: thumbnail,
    engineKey,
    slots: spec.slots.map((s) => s.key),
    mainSlot,
    warnings: spec.warnings,
    ...readColors(spec),
  }
}

export function disposeMockup(mockup: MockupPsd) {
  releaseInWorker(mockup.engineKey)
}

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3)

/** Which print side fills which Smart Object: by name (Design_Front ↔ Front), else the edited side → main slot. */
function assignSides(mockup: MockupPsd, side: number, sideNames: string[]) {
  const assigned = new Map<string, number>()
  for (const slot of mockup.slots) {
    const key = words(slot)
    const index = sideNames.findIndex((name) => words(name).some((w) => key.includes(w)))
    if (index >= 0) assigned.set(slot, index)
  }
  if (!assigned.has(mockup.mainSlot) && !assigned.size) assigned.set(mockup.mainSlot, side)
  return assigned
}

/** All color fills off: the product as photographed, what the print is composited over. */
function untintedVisibility(mockup: MockupPsd) {
  const visibility: Record<string, boolean> = {}
  for (const v of mockup.variants) for (const path of v.paths) visibility[path] = false
  return visibility
}

function colorVisibility(mockup: MockupPsd, colorName: string) {
  const visibility: Record<string, boolean> = {}
  if (!mockup.variants.some((v) => v.name === colorName)) return visibility
  for (const v of mockup.variants) for (const path of v.paths) visibility[path] = v.name === colorName
  for (const v of mockup.variants) {
    if (v.name === colorName) for (const path of v.parents) visibility[path] = true
  }
  return visibility
}

/**
 * Renders the mockup with the sides' designs (transparent PNGs of the print areas) and the chosen
 * product color. `artKey(index)` identifies a side's design: while it stays the same, the worker
 * reuses the warped design and only recomposites the product color. JPEG (on white) is for showing
 * on screen: far quicker to encode. PNG is the exported file.
 */
export async function renderMockup(
  mockup: MockupPsd,
  getArt: (index: number) => Promise<Blob | null>,
  artKey: (index: number) => string,
  side: number,
  sideNames: string[],
  colorName: string,
  format: 'png' | 'jpeg',
): Promise<Blob> {
  const assigned = await Promise.all(
    [...assignSides(mockup, side, sideNames)].map(async ([slot, index]) => {
      const art = await getArt(index)
      return art && { slot, art, artKey: artKey(index), placement: { fit: 'contain' as const, align: 'center' as const } }
    }),
  )
  return renderImageInWorker({
    base: mockup.engineKey,
    arts: assigned.filter((a) => !!a),
    // The product color only shows where the print is empty, whatever the print's blend mode
    options: { printWindow: true, visibility: colorVisibility(mockup, colorName), printBase: untintedVisibility(mockup) },
  }, format)
}
