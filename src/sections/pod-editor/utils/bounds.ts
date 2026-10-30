import type { Canvas, FabricObject } from 'fabric'

/** Color of a print-area edge the selected element touches or crosses */
export const OUT_OF_BOUNDS_COLOR = '#e5484d'

export interface BoundsBox {
  left: number
  top: number
  w: number
  h: number
}

/**
 * Keeps an object touching `box` (the print area): it may hang partly outside
 * (that part is clipped away), but stops once its far edge reaches the box edge —
 * dragging left stops when its right edge meets the box's left edge, and so on.
 * Returns true when the object was moved.
 */
export function clampIntoBox(obj: FabricObject, box: BoundsBox) {
  // During a drag Fabric updates left/top but not the cached corner coords —
  // refresh them, otherwise the bounds are those of the drag's start position.
  obj.setCoords()
  const b = obj.getBoundingRect()
  const clampAxis = (start: number, size: number, boxStart: number, boxSize: number) =>
    Math.min(boxStart + boxSize, Math.max(boxStart - size, start)) - start
  const dx = clampAxis(b.left, b.width, box.left, box.w)
  const dy = clampAxis(b.top, b.height, box.top, box.h)
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return false
  obj.set({ left: obj.left + dx, top: obj.top + dy })
  obj.setCoords()
  return true
}

type Edge = 'left' | 'top' | 'right' | 'bottom'

/** Print-area edges the object touches or crosses (it gets cut off there). */
function touchedEdges(obj: FabricObject, box: BoundsBox): Edge[] {
  const b = obj.getBoundingRect()
  const eps = 0.5
  const edges: Edge[] = []
  if (b.left <= box.left + eps) edges.push('left')
  if (b.top <= box.top + eps) edges.push('top')
  if (b.left + b.width >= box.left + box.w - eps) edges.push('right')
  if (b.top + b.height >= box.top + box.h - eps) edges.push('bottom')
  return edges
}

/**
 * Constrains dragging to the print area, and pulls an object back inside after a
 * scale / rotate gesture. While the selected element touches a print-area edge,
 * that edge is drawn in red. Install before other `object:modified` listeners so
 * they see the final position.
 */
export function installBoundsConstraint(
  canvas: Canvas,
  opts: { getBox: () => BoundsBox | null; isConstrained: (obj: FabricObject) => boolean },
) {
  let edges: Edge[] = []

  const mark = (obj: FabricObject | undefined) => {
    const box = opts.getBox()
    edges = obj && box && opts.isConstrained(obj) ? touchedEdges(obj, box) : []
  }
  const clamp = (obj: FabricObject | undefined) => {
    const box = opts.getBox()
    if (!obj || !box || !opts.isConstrained(obj)) return
    clampIntoBox(obj, box)
    mark(obj)
  }
  canvas.on('object:moving', ({ target }) => clamp(target))
  canvas.on('object:modified', ({ target }) => clamp(target))
  // Scaling / rotating aren't clamped mid-gesture, but the warning follows live
  const markLive = ({ target }: { target: FabricObject }) => {
    target.setCoords()
    mark(target)
  }
  canvas.on('object:scaling', markLive)
  canvas.on('object:rotating', markLive)
  const markActive = () => mark(canvas.getActiveObject())
  canvas.on('selection:created', markActive)
  canvas.on('selection:updated', markActive)
  canvas.on('selection:cleared', markActive)
  canvas.on('object:removed', markActive)

  // Red segments over the touched print-area edges, crisp in screen space
  canvas.on('after:render', ({ ctx }) => {
    const box = opts.getBox()
    if (!edges.length || !box || !ctx) return
    const [a, , , d, tx, ty] = canvas.viewportTransform
    const x1 = box.left * a + tx
    const y1 = box.top * d + ty
    const x2 = (box.left + box.w) * a + tx
    const y2 = (box.top + box.h) * d + ty
    const retina = canvas.getRetinaScaling()
    ctx.save()
    ctx.setTransform(retina, 0, 0, retina, 0, 0)
    ctx.strokeStyle = OUT_OF_BOUNDS_COLOR
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    const lines: Record<Edge, [number, number, number, number]> = {
      left: [x1, y1, x1, y2],
      right: [x2, y1, x2, y2],
      top: [x1, y1, x2, y1],
      bottom: [x1, y2, x2, y2],
    }
    for (const edge of edges) {
      const [ax, ay, bx, by] = lines[edge]
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    ctx.stroke()
    ctx.restore()
  })
}
