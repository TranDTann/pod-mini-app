import type { Canvas, FabricObject, TPointerEvent } from 'fabric'
import { PRINT_AREA_STROKE } from '../constants'

// Smart guides: while dragging, an object's edges / center snap to the artboard,
// the print area and other layers. Hold Alt to move freely.
// While rotating, hold Shift to snap the angle to 15° steps.

/** Pull radius in screen px — small, so an edge only "clicks" when it's really close. */
const SNAP_SCREEN_PX = 3
/** Pointer speed (screen px per move event) above which snapping is skipped: fast drags glide through. */
const FAST_DRAG_PX = 10
/** Guides are drawn only when aligned within this (screen px) after snapping. */
const ALIGNED_SCREEN_PX = 0.5
const ROTATE_STEP = 15
const MARK_SIZE = 3

interface SnapTargets {
  xs: number[]
  ys: number[]
}

interface Guide {
  axis: 'x' | 'y'
  pos: number
  /** Extent of the line along the other axis: spans the object and what it aligns to */
  from: number
  to: number
}

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export function installSnapping(
  canvas: Canvas,
  opts: {
    width: number
    height: number
    /** Extra reference rects (e.g. print area) and objects to align with */
    getReferences: (active: FabricObject) => FabricObject[]
    /** Re-apply constraints (e.g. keep inside the print area) after a snap moved the object */
    afterSnap?: (obj: FabricObject) => void
  },
) {
  let guides: Guide[] = []
  // Snap marks don't change during a drag; computing them once per gesture keeps
  // every move event cheap (no getBoundingRect over all layers per pixel).
  let cached: { targets: SnapTargets; rects: Rect[] } | null = null
  let lastPointer: { x: number; y: number } | null = null

  const collect = (active: FabricObject) => {
    const rects: Rect[] = [{ left: 0, top: 0, width: opts.width, height: opts.height }]
    for (const ref of opts.getReferences(active)) {
      if (ref === active || ref.visible === false) continue
      rects.push(ref.getBoundingRect())
    }
    const xs: number[] = []
    const ys: number[] = []
    for (const r of rects) {
      xs.push(r.left, r.left + r.width / 2, r.left + r.width)
      ys.push(r.top, r.top + r.height / 2, r.top + r.height)
    }
    return { targets: { xs, ys }, rects }
  }

  const nearest = (values: number[], targets: number[], threshold: number) => {
    let best: { delta: number; pos: number } | null = null
    for (const v of values) {
      for (const t of targets) {
        const d = t - v
        if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, pos: t }
      }
    }
    return best
  }

  /** Line extent: from the object to every reference rect touching that line. */
  const extent = (axis: 'x' | 'y', pos: number, obj: Rect, rects: Rect[], eps: number) => {
    let from = axis === 'x' ? obj.top : obj.left
    let to = axis === 'x' ? obj.top + obj.height : obj.left + obj.width
    for (const r of rects) {
      const marks = axis === 'x' ? [r.left, r.left + r.width / 2, r.left + r.width] : [r.top, r.top + r.height / 2, r.top + r.height]
      if (!marks.some((m) => Math.abs(m - pos) <= eps)) continue
      from = Math.min(from, axis === 'x' ? r.top : r.left)
      to = Math.max(to, axis === 'x' ? r.top + r.height : r.left + r.width)
    }
    return { from, to }
  }

  canvas.on('object:moving', ({ target, e }) => {
    guides = []
    const ev = e as TPointerEvent & { altKey?: boolean; clientX?: number; clientY?: number }
    if (ev.altKey) return
    const zoom = canvas.getZoom()
    cached ??= collect(target)
    const { targets, rects } = cached

    // Skip the pull while the pointer moves fast so the object never feels "held"
    const px = ev.clientX ?? 0
    const py = ev.clientY ?? 0
    const speed = lastPointer ? Math.hypot(px - lastPointer.x, py - lastPointer.y) : 0
    lastPointer = { x: px, y: py }
    const threshold = speed > FAST_DRAG_PX ? 0 : SNAP_SCREEN_PX / zoom

    target.setCoords() // cached coords are stale mid-drag
    let b = target.getBoundingRect()
    const snapX = nearest([b.left, b.left + b.width / 2, b.left + b.width], targets.xs, threshold)
    const snapY = nearest([b.top, b.top + b.height / 2, b.top + b.height], targets.ys, threshold)
    if (snapX || snapY) {
      target.set({
        left: target.left + (snapX?.delta ?? 0),
        top: target.top + (snapY?.delta ?? 0),
      })
      target.setCoords()
      opts.afterSnap?.(target)
      b = target.getBoundingRect()
    }

    // Draw guides only for lines the object is truly on (also catches exact alignment without a pull)
    const eps = ALIGNED_SCREEN_PX / zoom
    const xLine = nearest([b.left, b.left + b.width / 2, b.left + b.width], targets.xs, eps)
    const yLine = nearest([b.top, b.top + b.height / 2, b.top + b.height], targets.ys, eps)
    if (xLine) guides.push({ axis: 'x', pos: xLine.pos, ...extent('x', xLine.pos, b, rects, eps) })
    if (yLine) guides.push({ axis: 'y', pos: yLine.pos, ...extent('y', yLine.pos, b, rects, eps) })
  })

  canvas.on('object:rotating', ({ target, e }) => {
    if (!(e as TPointerEvent & { shiftKey?: boolean }).shiftKey) return
    target.rotate(Math.round(target.angle / ROTATE_STEP) * ROTATE_STEP)
    target.setCoords()
  })

  const clear = () => {
    cached = null
    lastPointer = null
    if (!guides.length) return
    guides = []
    canvas.requestRenderAll()
  }
  canvas.on('mouse:up', clear)
  canvas.on('object:modified', clear)
  canvas.on('selection:cleared', clear)

  // Drawn in screen space, snapped to the pixel grid, so lines are crisp 1px at any zoom
  canvas.on('after:render', ({ ctx }) => {
    if (!guides.length || !ctx) return
    const [a, , , d, tx, ty] = canvas.viewportTransform
    const sx = (x: number) => Math.round(x * a + tx) + 0.5
    const sy = (y: number) => Math.round(y * d + ty) + 0.5
    ctx.save()
    ctx.setTransform(canvas.getRetinaScaling(), 0, 0, canvas.getRetinaScaling(), 0, 0)
    ctx.strokeStyle = PRINT_AREA_STROKE
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const g of guides) {
      if (g.axis === 'x') {
        const x = sx(g.pos)
        ctx.moveTo(x, sy(g.from))
        ctx.lineTo(x, sy(g.to))
        // end marks
        for (const y of [sy(g.from), sy(g.to)]) {
          ctx.moveTo(x - MARK_SIZE, y)
          ctx.lineTo(x + MARK_SIZE, y)
        }
      } else {
        const y = sy(g.pos)
        ctx.moveTo(sx(g.from), y)
        ctx.lineTo(sx(g.to), y)
        for (const x of [sx(g.from), sx(g.to)]) {
          ctx.moveTo(x, y - MARK_SIZE)
          ctx.lineTo(x, y + MARK_SIZE)
        }
      }
    }
    ctx.stroke()
    ctx.restore()
  })
}
