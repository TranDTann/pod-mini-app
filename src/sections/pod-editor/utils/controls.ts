import { Control, FabricObject, controlsUtils, util } from 'fabric'
import { PRINT_AREA_STROKE } from '../constants'

// Soft, rounded transform handles:
// corners = white dots, sides = pills, rotate = floating round button.

const HANDLE_FILL = '#ffffff'
const HANDLE_SHADOW = 'rgba(28, 48, 36, 0.28)'

function withShadow(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save()
  ctx.shadowColor = HANDLE_SHADOW
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 1
  draw()
  ctx.restore()
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function renderCorner(ctx: CanvasRenderingContext2D, left: number, top: number) {
  withShadow(ctx, () => {
    ctx.beginPath()
    ctx.arc(left, top, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = HANDLE_FILL
    ctx.fill()
  })
  ctx.beginPath()
  ctx.arc(left, top, 4.5, 0, Math.PI * 2)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = PRINT_AREA_STROKE
  ctx.stroke()
}

function makePillRenderer(vertical: boolean) {
  return function renderPill(
    this: Control,
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    _style: unknown,
    obj: FabricObject,
  ) {
    const w = vertical ? 4.5 : 14.5
    const h = vertical ? 14.5 : 4.5
    ctx.save()
    ctx.translate(left, top)
    ctx.rotate(util.degreesToRadians(obj.getTotalAngle()))
    withShadow(ctx, () => {
      roundRectPath(ctx, -w / 2, -h / 2, w, h, 3)
      ctx.fillStyle = HANDLE_FILL
      ctx.fill()
    })
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 3)
    ctx.lineWidth = 1.5
    ctx.strokeStyle = PRINT_AREA_STROKE
    ctx.stroke()
    ctx.restore()
  }
}

// Rotate glyph: an open clockwise arc covering ~78% of a circle (280°), with a
// chevron arrowhead — reads clearly as "rotate" without looking like a closed ring.
const ARC_SWEEP = (280 / 360) * Math.PI * 2
const ARC_END = (310 / 180) * Math.PI // gap sits at the top-right
const ARC_START = ARC_END - ARC_SWEEP

// Rotate handle: white disc with a soft ring and the arc arrow in the accent color
function renderRotate(ctx: CanvasRenderingContext2D, left: number, top: number) {
  const R = 11
  withShadow(ctx, () => {
    ctx.beginPath()
    ctx.arc(left, top, R, 0, Math.PI * 2)
    ctx.fillStyle = HANDLE_FILL
    ctx.fill()
  })
  ctx.beginPath()
  ctx.arc(left, top, R, 0, Math.PI * 2)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(28, 48, 36, 0.18)'
  ctx.stroke()

  const r = 5 // arc radius → glyph ≈ 10px inside the 22px disc
  ctx.save()
  ctx.translate(left, top)
  ctx.strokeStyle = PRINT_AREA_STROKE
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.arc(0, 0, r, ARC_START, ARC_END)
  ctx.stroke()

  // filled arrowhead continuing the arc: base across the arc end, tip ahead along the clockwise tangent
  const ex = r * Math.cos(ARC_END)
  const ey = r * Math.sin(ARC_END)
  const tx = -Math.sin(ARC_END)
  const ty = Math.cos(ARC_END)
  const nx = Math.cos(ARC_END)
  const ny = Math.sin(ARC_END)
  const half = 2.6
  const len = 3.2
  ctx.fillStyle = PRINT_AREA_STROKE
  ctx.beginPath()
  ctx.moveTo(ex + nx * half, ey + ny * half)
  ctx.lineTo(ex + tx * len, ey + ty * len)
  ctx.lineTo(ex - nx * half, ey - ny * half)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function installSoftControls() {
  const createControls = () => {
    const controls = controlsUtils.createObjectDefaultControls()
    for (const key of ['tl', 'tr', 'bl', 'br'] as const) {
      controls[key].render = renderCorner
      controls[key].sizeX = controls[key].sizeY = 16
    }
    for (const key of ['ml', 'mr'] as const) {
      controls[key].render = makePillRenderer(true)
      controls[key].sizeX = 12
      controls[key].sizeY = 24
    }
    for (const key of ['mt', 'mb'] as const) {
      controls[key].render = makePillRenderer(false)
      controls[key].sizeX = 24
      controls[key].sizeY = 12
    }
    controls.mtr.render = renderRotate
    controls.mtr.offsetY = -34
    controls.mtr.withConnection = false
    controls.mtr.sizeX = controls.mtr.sizeY = 26
    controls.mtr.cursorStyle = 'grab'
    return { controls }
  }
  ;(FabricObject as unknown as { createControls: typeof createControls }).createControls = createControls

  // Fabric grows the border box by borderScaleFactor, pushing the line half a stroke
  // outside the element. Draw it on the exact edge so handles sit centered on the line.
  FabricObject.prototype.strokeBorders = function (this: FabricObject, ctx: CanvasRenderingContext2D, size) {
    const w = size.x - this.borderScaleFactor
    const h = size.y - this.borderScaleFactor
    ctx.strokeRect(-w / 2, -h / 2, w, h)
  }

  Object.assign(FabricObject.ownDefaults, {
    borderColor: PRINT_AREA_STROKE,
    // Border hugs the element's edge; handles sit centered on it (slightly over the image)
    borderScaleFactor: 1.25,
    borderOpacityWhenMoving: 0.6,
    padding: 0,
    transparentCorners: false,
  })
}
