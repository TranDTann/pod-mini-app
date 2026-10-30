'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ActiveSelection, Canvas, FabricImage, IText, FabricObject, Rect, Point, Shadow, filters, util, getFilterBackend } from 'fabric'
import type {
  PsdTemplate, MockupPsd, LayerInfo, SelectedObjectProps, EditorTool,
  ObjectStyleProps, TextStyleProps, ImageStyleProps, ShapeStyleProps,
} from './types'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, PX_PER_INCH, MOCKUP_FIT_RATIO, THUMBNAIL_SCALE,
  DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, STAGE_PADDING,
  NUDGE_PX, NUDGE_PX_LARGE, PRINT_AREA_STROKE,
} from './constants'
import { IcChevronRight, IcElements, IcLayers, IcMockup, IcPalette, IcSliders, IcText, IcTransform, IcUpload } from '@/components/icons'
import { fillColor, parsePsd } from './utils/psd-parser'
import { useEditorHistory } from './hooks/useEditorHistory'
import { useUploadProgress } from './hooks/useUploadProgress'
import EditorToolbar from './components/EditorToolbar'
import LeftSidebar from './components/LeftSidebar'
import LayerPanel from './components/LayerPanel'
import PositionPanel from './components/PositionPanel'
import ElementActions from './components/ElementActions'
import PrintAreaTabs from './components/PrintAreaTabs'
import PrintAreaColors from './components/PrintAreaColors'
import ZoomBar from './components/ZoomBar'
import UploadProgress from './components/UploadProgress'
import StylePanel from './components/StylePanel'
import ConfirmDialog, { type ConfirmOptions } from './components/ConfirmDialog'
import PreviewDialog, { type PreviewTarget } from './components/PreviewDialog'
import MockupPanel from './components/MockupPanel'
import ElementsPanel from './components/ElementsPanel'
import CollapsedPanelRail, { type RailItem } from './components/CollapsedPanelRail'
import { expandPanelSection, Tooltip } from './components/ui'
import { buildElement, EDITABLE_FILL_KEY } from './elements/build'
import type { ElementItem } from './elements/library'
import { parseMockupPsd } from './utils/mockup'
import { installSoftControls } from './utils/controls'
import { installSnapping } from './utils/snapping'
import { printAreaStrokeFor } from './utils/contrast'
import { clampIntoBox, installBoundsConstraint } from './utils/bounds'
import { rafThrottle, timeThrottle, downscaleDataUrl } from './utils/frame'
import { applyCurve, canCurve, CURVE_KEY, getCurve, installCurvedTextBox } from './utils/curve'

const LIVE_PROPS_INTERVAL = 80
/** Print-area render for mockups: × PSD resolution, capped in pixels */
const SIDE_RENDER_SCALE = 3
const SIDE_RENDER_MAX_PX = 3600

// ── Fabric object helpers ──

function getObjectId(obj: FabricObject): number {
  return (obj as unknown as { _editorId: number })._editorId
}

function setObjectId(obj: FabricObject, id: number) {
  ;(obj as unknown as { _editorId: number })._editorId = id
}

// ── Reference box for positioning: the print area when there is one, else the artboard ──

interface Box {
  left: number
  top: number
  w: number
  h: number
  cx: number
  cy: number
}

type OutlineStyle = ReturnType<typeof printAreaStrokeFor>
const OUTLINE_KEY = '_outline'

function setOutline(rect: Rect, outline: OutlineStyle) {
  ;(rect as Rect & { [OUTLINE_KEY]?: OutlineStyle })[OUTLINE_KEY] = outline
}

/**
 * Dashed print-area outline, drawn just outside the area and above the artwork, so a design
 * that fills the area is never covered by the line and the line never covers the design.
 * Width and dashes stay constant on screen at any zoom.
 */
function drawPrintAreaOutline(ctx: CanvasRenderingContext2D, area: Rect, zoom: number) {
  const outline = (area as Rect & { [OUTLINE_KEY]?: OutlineStyle })[OUTLINE_KEY]
  if (!outline) return
  const lineWidth = outline.strokeWidth / zoom
  const off = lineWidth / 2
  ctx.save()
  ctx.strokeStyle = outline.stroke
  ctx.lineWidth = lineWidth
  ctx.setLineDash([8 / zoom, 5 / zoom])
  ctx.shadowColor = outline.halo
  ctx.shadowBlur = 3
  ctx.strokeRect(area.left - off, area.top - off, area.width * area.scaleX + off * 2, area.height * area.scaleY + off * 2)
  ctx.restore()
}

function referenceBox(printArea: Rect | null): Box {
  if (printArea) {
    const w = printArea.width * printArea.scaleX
    const h = printArea.height * printArea.scaleY
    // print-area rect uses a top-left origin
    return { left: printArea.left, top: printArea.top, w, h, cx: printArea.left + w / 2, cy: printArea.top + h / 2 }
  }
  return { left: 0, top: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT, cx: CANVAS_WIDTH / 2, cy: CANVAS_HEIGHT / 2 }
}

const round2 = (v: number) => Math.round(v * 100) / 100

// ── Origin (state at the moment an element was added) ──

const TRANSFORM_KEYS = ['left', 'top', 'scaleX', 'scaleY', 'angle', 'flipX', 'flipY', 'skewX', 'skewY', 'opacity'] as const
const TEXT_STYLE_KEYS = [
  'fontFamily', 'fontSize', 'fill', 'fontWeight', 'fontStyle', 'underline', 'textAlign',
  'charSpacing', 'lineHeight', 'stroke', 'strokeWidth', CURVE_KEY,
] as const

type OriginState = Record<string, unknown>

// Persist editor metadata through toJSON/loadFromJSON (undo/redo) and clone()
installCurvedTextBox()
FabricObject.customProperties = ['_editorId', '_origin', '_hiResKey', EDITABLE_FILL_KEY, '_name', CURVE_KEY]

function isEditableShape(obj: FabricObject) {
  return !!(obj as FabricObject & Record<string, unknown>)[EDITABLE_FILL_KEY]
}

function captureOrigin(obj: FabricObject) {
  const origin: OriginState = {}
  const keys =
    obj instanceof IText ? [...TRANSFORM_KEYS, ...TEXT_STYLE_KEYS] : isEditableShape(obj) ? [...TRANSFORM_KEYS, 'fill'] : TRANSFORM_KEYS
  for (const key of keys) origin[key] = obj.get(key)
  ;(obj as unknown as { _origin: OriginState })._origin = origin
}

function getOrigin(obj: FabricObject): OriginState | undefined {
  return (obj as unknown as { _origin?: OriginState })._origin
}

/** Whether the object differs from how it was added (drives the Reset button state). */
function isModifiedFromOrigin(obj: FabricObject) {
  const origin = getOrigin(obj)
  if (!origin) return false
  if (obj instanceof FabricImage && obj.filters.length > 0) return true
  if (obj.shadow) return true
  return Object.entries(origin).some(([key, value]) => {
    const current = obj.get(key)
    return typeof value === 'number' ? Math.abs((current as number) - value) > 0.01 : current !== value
  })
}

function isLocked(obj: FabricObject) {
  return !!obj.lockMovementX
}

/**
 * Canvas cursors: anything clickable shows a pointer; only the selected, unlocked
 * object (which can actually be dragged) shows the move cursor.
 */
function updateObjectCursors(canvas: Canvas, isUser: (o: FabricObject) => boolean) {
  const active = canvas.getActiveObjects()
  for (const obj of canvas.getObjects()) {
    if (!isUser(obj)) continue
    // Selection frame hugs the element: no padding, no phantom stroke width
    // (also fixes objects created before this default or restored by undo)
    let changed = false
    if (obj.padding) {
      obj.padding = 0
      changed = true
    }
    if (!obj.stroke && obj.strokeWidth) {
      obj.set('strokeWidth', 0)
      changed = true
    }
    // Handles are positioned from cached coords — recompute so they sit on the border
    if (changed) obj.setCoords()
    obj.hoverCursor = active.includes(obj) && !isLocked(obj) ? 'move' : 'pointer'
  }
  const selection = canvas.getActiveObject()
  if (selection && !isUser(selection)) selection.hoverCursor = 'move' // multi-select group
}

function setLocked(obj: FabricObject, locked: boolean) {
  obj.set({
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
    hasControls: !locked,
    borderColor: locked ? '#7f8c83' : PRINT_AREA_STROKE,
  })
}

/** Template objects (mockup, print-area guide) are non-interactive; user objects never are. */
function isTemplateObject(obj: FabricObject) {
  return !obj.selectable && !obj.evented
}

/**
 * Runs an export render with object caching off. Fabric caches each object in a
 * bitmap capped at ~2MP (perfLimitSizeTotal); at export multipliers big images get
 * squeezed into that cache and come out blurry. Uncached, they're drawn straight
 * from their source pixels.
 */
function renderUncached<T>(canvas: Canvas, render: () => T): T {
  const objects = canvas.getObjects()
  const caching = objects.map((obj) => obj.objectCaching)
  objects.forEach((obj) => (obj.objectCaching = false))
  const restoreHiRes = objects.map(swapInHiResSource)
  try {
    return render()
  } finally {
    restoreHiRes.forEach((restore) => restore?.())
    objects.forEach((obj, i) => {
      obj.objectCaching = caching[i]
      obj.dirty = true
    })
  }
}

// ── Full-resolution sources ──
// Uploads are edited through a light proxy (smooth dragging), while the original
// pixels are kept here for Preview / Export. Keyed by a small id stored on the
// object (_hiResKey) so it survives undo/redo and duplicate without bloating history.

/** WebGL filter texture limit and a sane memory cap per image */
const HI_RES_MAX_SIDE = 4096
const hiResSources = new Map<string, HTMLCanvasElement | HTMLImageElement>()
let hiResCounter = 0

async function registerHiResSource(dataUrl: string, proxyLongest: number): Promise<string | undefined> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  if (longest <= proxyLongest) return undefined
  let source: HTMLCanvasElement | HTMLImageElement = img
  if (longest > HI_RES_MAX_SIDE) {
    const scale = HI_RES_MAX_SIDE / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    source = canvas
  }
  const key = `hires-${++hiResCounter}`
  hiResSources.set(key, source)
  return key
}

type HiResImage = FabricImage & {
  _hiResKey?: string
  _filterScalingX: number
  _filterScalingY: number
}

/** Temporarily draws an image from its full-res source; returns the undo. */
function swapInHiResSource(obj: FabricObject): (() => void) | undefined {
  if (!(obj instanceof FabricImage)) return
  const image = obj as HiResImage
  const source = image._hiResKey ? hiResSources.get(image._hiResKey) : undefined
  if (!source) return
  const proxy = image.getOriginalSize()
  const saved = { element: image.getElement(), sx: image._filterScalingX, sy: image._filterScalingY }
  let element: HTMLCanvasElement | HTMLImageElement = source
  const active = image.filters.filter((f) => f && !f.isNeutralState())
  if (active.length) {
    // No cacheKey: keeps the proxy's cached WebGL textures intact
    const out = document.createElement('canvas')
    out.width = source.width
    out.height = source.height
    getFilterBackend().applyFilters(active, source, source.width, source.height, out)
    element = out
  }
  // Fabric maps width/height (proxy px) onto the element through _filterScaling
  image._element = element
  image._filterScalingX = source.width / proxy.width
  image._filterScalingY = source.height / proxy.height
  return () => {
    image._element = saved.element
    image._filterScalingX = saved.sx
    image._filterScalingY = saved.sy
  }
}

/** Where the template sits on the artboard (PSD px → canvas px). */
function templateLayout(template: PsdTemplate) {
  const fitScale = Math.min(CANVAS_WIDTH / template.width, CANVAS_HEIGHT / template.height) * MOCKUP_FIT_RATIO
  return {
    fitScale,
    offsetX: (CANVAS_WIDTH - template.width * fitScale) / 2,
    offsetY: (CANVAS_HEIGHT - template.height * fitScale) / 2,
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

installSoftControls()
// Unselected objects are click targets → pointer; selected ones get 'move' (see updateObjectCursors)
FabricObject.ownDefaults.hoverCursor = 'pointer'

const SOFT_SHADOW = { color: 'rgba(60,40,20,0.35)', blur: 18, offsetX: 4, offsetY: 8 }

// ── Style read / write ──

function readTextStyle(t: IText): TextStyleProps {
  return {
    kind: 'text',
    fontFamily: t.fontFamily || DEFAULT_FONT_FAMILY,
    fontSize: Math.round(t.fontSize || DEFAULT_FONT_SIZE),
    fill: typeof t.fill === 'string' ? t.fill : '#3b342d',
    bold: t.fontWeight === 'bold' || Number(t.fontWeight) >= 600,
    italic: t.fontStyle === 'italic',
    underline: !!t.underline,
    textAlign: (['left', 'center', 'right'].includes(t.textAlign) ? t.textAlign : 'left') as TextStyleProps['textAlign'],
    charSpacing: t.charSpacing || 0,
    lineHeight: t.lineHeight || 1.16,
    stroke: typeof t.stroke === 'string' ? t.stroke : '#ffffff',
    strokeWidth: t.stroke ? t.strokeWidth || 0 : 0,
    shadow: !!t.shadow,
    curve: getCurve(t),
    canCurve: canCurve(t),
  }
}

function findFilter<T>(img: FabricImage, ctor: new (...args: never[]) => T): T | undefined {
  return img.filters.find((f) => f instanceof ctor) as T | undefined
}

function readImageStyle(img: FabricImage): ImageStyleProps {
  const pct = (v: number | undefined) => Math.round((v ?? 0) * 100)
  return {
    kind: 'image',
    brightness: pct(findFilter(img, filters.Brightness)?.brightness),
    contrast: pct(findFilter(img, filters.Contrast)?.contrast),
    saturation: pct(findFilter(img, filters.Saturation)?.saturation),
    blur: pct(findFilter(img, filters.Blur)?.blur),
    grayscale: !!findFilter(img, filters.Grayscale),
    sepia: !!findFilter(img, filters.Sepia),
    invert: !!findFilter(img, filters.Invert),
    shadow: !!img.shadow,
  }
}

function applyImageFilters(img: FabricImage, style: ImageStyleProps) {
  const list: FabricImage['filters'] = []
  if (style.brightness) list.push(new filters.Brightness({ brightness: style.brightness / 100 }))
  if (style.contrast) list.push(new filters.Contrast({ contrast: style.contrast / 100 }))
  if (style.saturation) list.push(new filters.Saturation({ saturation: style.saturation / 100 }))
  if (style.blur) list.push(new filters.Blur({ blur: style.blur / 100 }))
  if (style.grayscale) list.push(new filters.Grayscale())
  if (style.sepia) list.push(new filters.Sepia())
  if (style.invert) list.push(new filters.Invert())
  img.filters = list
  img.applyFilters()
  img.set('shadow', style.shadow ? new Shadow(SOFT_SHADOW) : null)
}

function readObjectStyle(obj: FabricObject): ObjectStyleProps | null {
  if (obj instanceof IText) return readTextStyle(obj)
  if (obj instanceof FabricImage) return readImageStyle(obj)
  if (isEditableShape(obj)) {
    return { kind: 'shape', fill: typeof obj.fill === 'string' ? obj.fill : '#5f5b45', shadow: !!obj.shadow }
  }
  return null
}

/**
 * Stable throttled wrapper that always calls the latest `fn`: once per frame, or
 * at most once per `interval` ms when given.
 */
function useRafCallback<A extends unknown[]>(fn: (...args: A) => void, interval?: number) {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  // ref is only read inside the throttled callback, never during render
  // eslint-disable-next-line react-hooks/refs
  const throttled = useMemo(() => (interval ? timeThrottle : rafThrottle)((...args: A) => ref.current(...args), interval!), [interval])
  useEffect(() => () => throttled.cancel(), [throttled])
  return throttled
}

// ── Props ──

interface PodEditorProps {
  template?: PsdTemplate | null
  onTemplateChange?: (template: PsdTemplate) => void
  onRemoveTemplate?: () => void
}

interface ViewState {
  x: number
  y: number
  zoom: number
}

// ── Component ──

export default function PodEditor({ template, onTemplateChange, onRemoveTemplate }: PodEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const psdInputRef = useRef<HTMLInputElement>(null)
  const idCounter = useRef(0)
  const mockupRef = useRef<FabricImage | null>(null)
  const printAreaRectRef = useRef<Rect | null>(null)
  /** Set while rendering another side's print area, which the active die-cut would hide */
  const clipSuspendedRef = useRef(false)
  const mockupInputRef = useRef<HTMLInputElement>(null)

  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null)
  const [selectedObjectProps, setSelectedObjectProps] = useState<SelectedObjectProps | null>(null)
  const [styleProps, setStyleProps] = useState<ObjectStyleProps | null>(null)
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, zoom: 1 })
  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [activeAreaIndex, setActiveAreaIndex] = useState(0)
  /** Selected color per print side (index → color name) */
  const [colorByArea, setColorByArea] = useState<Record<number, string>>({})
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null)

  const { task: uploadTask, run: runUpload } = useUploadProgress()

  const printAreas = useMemo(() => template?.printAreas ?? [], [template])
  const activePrintArea = printAreas[activeAreaIndex] ?? null
  const activeColors = activePrintArea?.colors ?? []
  const activeColorName = colorByArea[activeAreaIndex] ?? activePrintArea?.defaultColor ?? ''
  const hasSelection = selectedLayerId !== null
  const templateName = template?.name || 'Blank'
  const isBlank = templateName === 'Blank'
  const zoomPercent = Math.round(view.zoom * 100)

  // Pan refs
  const [isPanning, setIsPanning] = useState(false)
  /** Panning while the mouse wheel (middle button) is held — a temporary Hand tool */
  const [isWheelPanning, setIsWheelPanning] = useState(false)
  const panModeRef = useRef(false)
  const lastPanPosition = useRef({ x: 0, y: 0 })

  // ── Helpers ──

  const isUserObject = useCallback((obj: FabricObject) => {
    return obj !== mockupRef.current && obj !== printAreaRectRef.current && !isTemplateObject(obj)
  }, [])

  /** Index of the lowest slot a user object may occupy (above mockup / print-area guide). */
  const baseLayerIndex = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return 0
    return canvas.getObjects().filter((o) => !isUserObject(o)).length
  }, [isUserObject])

  const generateThumbnail = useCallback((obj: FabricObject): string => {
    try {
      return obj.toDataURL({ format: 'png', multiplier: THUMBNAIL_SCALE })
    } catch {
      return ''
    }
  }, [])

  // Thumbnails are costly (toDataURL), so they are cached per object and only
  // regenerated for objects whose look actually changed.
  const thumbCache = useRef(new WeakMap<FabricObject, string>())
  const thumbnailFor = useCallback(
    (obj: FabricObject) => {
      let url = thumbCache.current.get(obj)
      if (url === undefined) {
        url = generateThumbnail(obj)
        thumbCache.current.set(obj, url)
      }
      return url
    },
    [generateThumbnail],
  )

  const refreshLayers = useCallback((invalidate?: FabricObject[]) => {
    const canvas = fabricRef.current
    if (!canvas) return
    invalidate?.forEach((obj) => thumbCache.current.delete(obj))
    setLayers(
      canvas
        .getObjects()
        .filter(isUserObject)
        .map((obj) => ({
          id: getObjectId(obj),
          name:
            obj.type === 'i-text'
              ? `${(obj as IText).text?.slice(0, 20) || 'Text'}`
              : ((obj as FabricObject & { _name?: string })._name ?? `Layer ${getObjectId(obj)}`),
          type: obj.type || 'object',
          thumbnail: obj.type === 'i-text' ? '' : thumbnailFor(obj),
          visible: obj.visible !== false,
          locked: isLocked(obj),
        })),
    )
  }, [thumbnailFor, isUserObject])

  const refreshSelectedProps = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const activeObj = canvas.getActiveObject()
    if (!activeObj) {
      setSelectedObjectProps(null)
      setStyleProps(null)
      setSelectedLayerId(null)
      return
    }
    // Measure in artboard units, independent of the current viewport zoom.
    // Position is the element's top-left edge relative to the print area (or artboard).
    activeObj.setCoords() // live updates run mid-drag, when cached coords are stale
    const bounds = activeObj.getBoundingRect()
    const box = referenceBox(printAreaRectRef.current)
    setSelectedObjectProps({
      widthInch: round2(bounds.width / PX_PER_INCH),
      heightInch: round2(bounds.height / PX_PER_INCH),
      leftPercent: round2(((bounds.left - box.left) / box.w) * 100),
      topPercent: round2(((bounds.top - box.top) / box.h) * 100),
      angle: Math.round(activeObj.angle! * 100) / 100,
      scalePercent: Math.round(activeObj.scaleX! * 10000) / 100,
      opacity: Math.round((activeObj.opacity ?? 1) * 100),
      locked: isLocked(activeObj),
      modified: isModifiedFromOrigin(activeObj),
    })
    setStyleProps(readObjectStyle(activeObj))
    setSelectedLayerId(getObjectId(activeObj))
  }, [])

  // ── History ──

  const { saveSnapshot, flushSnapshot, undo, redo, canUndo, canRedo } = useEditorHistory(
    fabricRef,
    () => {
      thumbCache.current = new WeakMap()
      refreshLayers()
      refreshSelectedProps()
    },
    isUserObject,
  )

  /** Common tail for every mutating action. */
  const commit = useCallback(
    (opts: { layers?: boolean } = {}) => {
      const canvas = fabricRef.current
      canvas?.requestRenderAll()
      if (opts.layers) refreshLayers(canvas?.getActiveObjects())
      refreshSelectedProps()
      saveSnapshot()
    },
    [refreshLayers, refreshSelectedProps, saveSnapshot],
  )

  // Frame-throttled versions for high-frequency events (drag, pan, wheel, typing, sliders)
  // Panel numbers during a drag: ~12fps is plenty, object:modified gives the exact final value
  const livePropsUpdate = useRafCallback(refreshSelectedProps, LIVE_PROPS_INTERVAL)
  const liveLayersUpdate = useRafCallback(() => refreshLayers(fabricRef.current?.getActiveObjects()))

  // ── Viewport (zoom / pan, no scrollbars) ──

  const syncViewNow = useCallback(() => {
    const vpt = fabricRef.current?.viewportTransform
    if (vpt) setView({ x: vpt[4], y: vpt[5], zoom: vpt[0] })
  }, [])
  // The artboard backdrop only needs to follow the viewport once per frame
  const syncView = useRafCallback(syncViewNow)

  const fitToScreen = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const w = canvas.getWidth()
    const h = canvas.getHeight()
    const zoom = Math.max(
      MIN_ZOOM,
      Math.min((w - STAGE_PADDING * 2) / CANVAS_WIDTH, (h - STAGE_PADDING * 2) / CANVAS_HEIGHT),
    )
    canvas.setViewportTransform([
      zoom, 0, 0, zoom,
      (w - CANVAS_WIDTH * zoom) / 2,
      (h - CANVAS_HEIGHT * zoom) / 2,
    ])
    syncView()
  }, [syncView])

  const zoomTo = useCallback(
    (zoom: number, point?: Point) => {
      const canvas = fabricRef.current
      if (!canvas) return
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      canvas.zoomToPoint(point ?? new Point(canvas.getWidth() / 2, canvas.getHeight() / 2), clamped)
      syncView()
    },
    [syncView],
  )

  const handleZoomIn = useCallback(() => zoomTo(view.zoom * ZOOM_STEP), [zoomTo, view.zoom])
  const handleZoomOut = useCallback(() => zoomTo(view.zoom / ZOOM_STEP), [zoomTo, view.zoom])
  const handleResetZoom = useCallback(() => zoomTo(1), [zoomTo])

  // ── Pan (Hand tool / hold Space / middle mouse) ──
  // Handled on the stage, above Fabric, so objects never swallow the drag.

  const panActive = activeTool === 'pan' || isWheelPanning

  const handleStagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Holding the mouse wheel pans from any tool; releasing it goes back
      const isWheelButton = e.button === 1
      if (!panActive && !isWheelButton) return
      if ((e.target as HTMLElement).closest('[data-stage-ui]')) return
      e.preventDefault() // no browser auto-scroll
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      lastPanPosition.current = { x: e.clientX, y: e.clientY }
      if (isWheelButton) setIsWheelPanning(true)
      setIsPanning(true)
    },
    [panActive],
  )

  const handleStagePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const canvas = fabricRef.current
      if (!isPanning || !canvas) return
      e.stopPropagation()
      canvas.relativePan(new Point(e.clientX - lastPanPosition.current.x, e.clientY - lastPanPosition.current.y))
      lastPanPosition.current = { x: e.clientX, y: e.clientY }
      syncView()
    },
    [isPanning, syncView],
  )

  const handleStagePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning) return
      // While wheel-panning, only releasing the wheel ends it
      if (isWheelPanning && e.type === 'pointerup' && e.button !== 1) return
      e.currentTarget.releasePointerCapture(e.pointerId)
      setIsPanning(false)
      setIsWheelPanning(false)
    },
    [isPanning, isWheelPanning],
  )

  // ── Canvas initialization ──

  useEffect(() => {
    const stage = stageRef.current
    if (!canvasRef.current || !stage) return
    const canvas = new Canvas(canvasRef.current, {
      width: stage.clientWidth,
      height: stage.clientHeight,
      selectionColor: 'rgba(35,160,107,0.08)',
      selectionBorderColor: PRINT_AREA_STROKE,
      selectionLineWidth: 1,
      preserveObjectStacking: true,
      // Interaction tuning
      enablePointerEvents: true,
      targetFindTolerance: 4,
      skipOffscreen: true,
    })
    fabricRef.current = canvas

    // Elements can't leave the print area (registered first so later listeners see the clamped position)
    installBoundsConstraint(canvas, {
      getBox: () => (printAreaRectRef.current ? referenceBox(printAreaRectRef.current) : null),
      isConstrained: (obj) => isUserObject(obj) || canvas.getActiveObjects().length > 1,
    })

    const handleSelectionChange = () => {
      updateObjectCursors(canvas, isUserObject)
      refreshSelectedProps()
      refreshLayers()
    }
    canvas.on('selection:created', handleSelectionChange)
    canvas.on('selection:updated', handleSelectionChange)
    canvas.on('selection:cleared', handleSelectionChange)
    canvas.on('object:modified', ({ target }) => {
      refreshSelectedProps()
      // Moving doesn't change a thumbnail; scaling/rotating/flipping might
      refreshLayers(target ? [target] : undefined)
      saveSnapshot()
    })
    // The print area is a die-cut: user objects are clipped to it at render time so
    // whatever is dragged outside looks cut off. Clipping the whole user layer once
    // (instead of a per-object absolute clipPath) keeps each object's render cache
    // valid while dragging. Selection controls are drawn afterwards, so they stay visible.
    const renderObjects = canvas._renderObjects.bind(canvas)
    canvas._renderObjects = (ctx, objects) => {
      const area = printAreaRectRef.current
      if (!area || clipSuspendedRef.current) return renderObjects(ctx, objects)
      renderObjects(ctx, objects.filter((o) => !isUserObject(o)))
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.left, area.top, area.width, area.height)
      ctx.clip()
      renderObjects(ctx, objects.filter(isUserObject))
      ctx.restore()
      if (area.visible !== false) drawPrintAreaOutline(ctx, area, canvas.getZoom())
    }
    canvas.on('text:changed', ({ target }) => {
      // Keep a curved text's arc sized to what's being typed (a new line straightens it)
      if (target instanceof IText && getCurve(target) !== 0) {
        const center = target.getCenterPoint()
        applyCurve(target, getCurve(target))
        target.setPositionByOrigin(center, 'center', 'center')
      }
      liveLayersUpdate()
    })
    canvas.on('object:moving', livePropsUpdate)
    canvas.on('object:scaling', livePropsUpdate)
    canvas.on('object:rotating', livePropsUpdate)

    installSnapping(canvas, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      getReferences: () => [
        ...(printAreaRectRef.current ? [printAreaRectRef.current] : []),
        ...canvas.getObjects().filter((o) => isUserObject(o) && !canvas.getActiveObjects().includes(o)),
      ],
      afterSnap: (obj) => {
        if (printAreaRectRef.current) clampIntoBox(obj, referenceBox(printAreaRectRef.current))
      },
    })

    // Wheel: Ctrl/⌘ (or trackpad pinch) zooms; plain wheel pans only while the Hand tool is on
    const handleWheel = (e: WheelEvent) => {
      // Let floating UI (e.g. the print-area tab list) scroll natively
      if ((e.target as HTMLElement).closest('[data-stage-ui]') && !(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const rect = stage.getBoundingClientRect()
        const next = canvas.getZoom() * Math.pow(0.999, e.deltaY * 2)
        canvas.zoomToPoint(
          new Point(e.clientX - rect.left, e.clientY - rect.top),
          Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)),
        )
      } else if (panModeRef.current) {
        canvas.relativePan(new Point(-e.deltaX, -e.deltaY))
      } else {
        return
      }
      syncView()
    }
    stage.addEventListener('wheel', handleWheel, { passive: false })

    // Keep the canvas element sized to the stage — the stage itself never scrolls
    const observer = new ResizeObserver(() => {
      canvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight })
      fitToScreen()
    })
    observer.observe(stage)

    saveSnapshot()
    flushSnapshot()
    return () => {
      observer.disconnect()
      stage.removeEventListener('wheel', handleWheel)
      canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Template loading ──

  // Which template / side the canvas currently shows: a color-only change recolors in place
  const loadedSideRef = useRef<{ template: PsdTemplate | null; index: number } | null>(null)

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const loaded = loadedSideRef.current
    if (template && loaded?.template === template && loaded.index === activeAreaIndex) {
      // Only the color changed: swap pixels / outline, keep everything else (zoom, selection, objects)
      let cancelled = false
      const recolor = async () => {
        const color = activeColors.find((c) => c.name === activeColorName)
        const mockup = mockupRef.current
        if (mockup && activePrintArea?.imageUrl && activePrintArea.imageBounds) {
          const url = color ? await fillColor(activePrintArea.imageUrl, color.rgb) : activePrintArea.imageUrl
          if (cancelled) return
          const { scaleX, scaleY } = mockup
          const { width, height } = mockup
          await mockup.setSrc(url)
          if (cancelled) return
          // setSrc resets the size; same base layer → same pixels, keep the placement
          mockup.set({ width, height, scaleX, scaleY })
        }
        const rect = printAreaRectRef.current
        if (rect) {
          const outline = printAreaStrokeFor(color?.rgb)
          rect.set({ fill: outline.fill })
          setOutline(rect, outline)
        }
        canvas.requestRenderAll()
      }
      recolor()
      return () => {
        cancelled = true
      }
    }
    // Marked as loaded only once the load finishes: a cancelled load (e.g. Strict Mode's
    // double effect run) must not make the next run take the recolor-only path.
    loadedSideRef.current = null

    if (mockupRef.current) {
      canvas.remove(mockupRef.current)
      mockupRef.current = null
    }
    if (printAreaRectRef.current) {
      canvas.remove(printAreaRectRef.current)
      printAreaRectRef.current = null
    }

    if (!template) {
      canvas.renderAll()
      return
    }

    const loadTemplate = async () => {
      const { fitScale, offsetX, offsetY } = templateLayout(template)

      // Like site-admin: show the active print area's base layer, fall back to the PSD composite
      const areaImage = activePrintArea?.imageUrl && activePrintArea.imageBounds
      const color = activeColors.find((c) => c.name === activeColorName)
      const mockupUrl = areaImage
        ? color
          ? await fillColor(activePrintArea.imageUrl, color.rgb)
          : activePrintArea.imageUrl
        : template.mockupDataUrl
      const bounds = areaImage
        ? activePrintArea.imageBounds!
        : { left: 0, top: 0, width: template.width, height: template.height }

      if (mockupUrl) {
        const mockupImage = await FabricImage.fromURL(mockupUrl)
        if (cancelled) return
        mockupImage.set({
          scaleX: (bounds.width * fitScale) / mockupImage.width!,
          scaleY: (bounds.height * fitScale) / mockupImage.height!,
          left: offsetX + bounds.left * fitScale,
          top: offsetY + bounds.top * fitScale,
          // Fabric 7 defaults to center origin; PSD coordinates are top-left
          originX: 'left',
          originY: 'top',
          selectable: false,
          evented: false,
          excludeFromExport: false,
        })
        mockupRef.current = mockupImage
        canvas.insertAt(0, mockupImage)
      }

      if (cancelled) return
      if (activePrintArea) {
        // Dashes adapt to the product color so they never vanish into it
        const productColor = activeColors.find((c) => c.name === activeColorName)?.rgb
        const outline = printAreaStrokeFor(productColor)
        const printAreaRect = new Rect({
          left: offsetX + activePrintArea.left * fitScale,
          top: offsetY + activePrintArea.top * fitScale,
          originX: 'left',
          originY: 'top',
          width: activePrintArea.width * fitScale,
          height: activePrintArea.height * fitScale,
          // No stroke on the rect itself: its box is exactly the print area, and the dashed
          // outline is drawn around it (outside, above the artwork) — see drawPrintAreaOutline
          fill: outline.fill,
          strokeWidth: 0,
          // Rendered twice per frame (fill below, outline above the artwork): no cache to go stale
          objectCaching: false,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        })
        setOutline(printAreaRect, outline)
        printAreaRectRef.current = printAreaRect
        canvas.insertAt(mockupRef.current ? 1 : 0, printAreaRect)
      }

      loadedSideRef.current = { template, index: activeAreaIndex }
      canvas.renderAll()
    }
    let cancelled = false
    loadTemplate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, activeAreaIndex, activeColorName])

  // ── Object actions ──

  /** Runs `fn` on the active object (if any) and commits the change. */
  const withActive = useCallback(
    (fn: (obj: FabricObject, canvas: Canvas) => void, opts?: { layers?: boolean; allowLocked?: boolean }) => {
      const canvas = fabricRef.current
      const obj = canvas?.getActiveObject()
      if (!canvas || !obj) return
      if (isLocked(obj) && !opts?.allowLocked) return
      fn(obj, canvas)
      obj.setCoords()
      if (printAreaRectRef.current) clampIntoBox(obj, referenceBox(printAreaRectRef.current))
      commit(opts)
    },
    [commit],
  )

  /** Center of the active print area (if any), otherwise the artboard center — in artboard coords. */
  const getPlacementBox = useCallback(() => referenceBox(printAreaRectRef.current), [])

  const placeCentered = useCallback(
    (obj: FabricObject) => {
      const { cx, cy } = getPlacementBox()
      obj.setPositionByOrigin(new Point(cx, cy), 'center', 'center')
      obj.setCoords()
    },
    [getPlacementBox],
  )

  const handleImportImage = useCallback(() => fileInputRef.current?.click(), [])

  /** Adds an image file; `at` (artboard coords) is used for drag-and-drop, otherwise it's centered. */
  const addImageFile = useCallback(
    async (file: File, at?: Point) => {
      if (!fabricRef.current) return
      try {
        await runUpload(file, 'image', async () => {
          const original = await readFileAsDataUrl(file)
          const dataUrl = await downscaleDataUrl(original)
          const image = await FabricImage.fromURL(dataUrl)
          ;(image as HiResImage)._hiResKey = await registerHiResSource(
            original,
            Math.max(image.width, image.height),
          )
          const canvas = fabricRef.current!
          const box = getPlacementBox()
          const ratio = printAreaRectRef.current ? 0.8 : 0.5
          image.scale(Math.min((box.w * ratio) / image.width!, (box.h * ratio) / image.height!, 1))
          if (at) {
            image.setPositionByOrigin(at, 'center', 'center')
            image.setCoords()
            if (printAreaRectRef.current) clampIntoBox(image, referenceBox(printAreaRectRef.current))
          } else {
            placeCentered(image)
          }
          setObjectId(image, ++idCounter.current)
          captureOrigin(image)
          canvas.add(image)
          canvas.setActiveObject(image)
          commit({ layers: true })
        })
      } catch (err) {
        console.error('Failed to load image:', err)
      }
    },
    [commit, runUpload, getPlacementBox, placeCentered],
  )

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) addImageFile(file)
    },
    [addImageFile],
  )

  const handleAddText = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const text = new IText('Double-click to edit', {
      fontSize: DEFAULT_FONT_SIZE,
      fontFamily: DEFAULT_FONT_FAMILY,
      fill: '#3b342d',
      textAlign: 'center',
      strokeWidth: 0,
    })
    placeCentered(text)
    setObjectId(text, ++idCounter.current)
    captureOrigin(text)
    canvas.add(text)
    canvas.setActiveObject(text)
    commit({ layers: true })
  }, [commit, placeCentered])

  const [elementsOpen, setElementsOpen] = useState(false)
  // Right-hand panel can be hidden for the largest possible stage; remembered per browser
  const [panelOpen, setPanelOpen] = useState(() => {
    try {
      return localStorage.getItem('pod-editor:panel') !== 'closed'
    } catch {
      return true
    }
  })
  /** Reopen the side panel, optionally scrolled to (and expanding) one section. */
  const openPanel = useCallback((sectionId?: string) => {
    if (sectionId) expandPanelSection(sectionId)
    try {
      localStorage.setItem('pod-editor:panel', 'open')
    } catch {}
    setPanelOpen(true)
    if (sectionId) {
      requestAnimationFrame(() =>
        document.querySelector(`[data-panel-section="${sectionId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
    }
  }, [])
  const togglePanel = useCallback(() => {
    setPanelOpen((open) => {
      try {
        localStorage.setItem('pod-editor:panel', open ? 'closed' : 'open')
      } catch {}
      return !open
    })
  }, [])

  /** Adds a library element, sized to ~60% of the print area and centered in it. */
  const handleAddElement = useCallback(
    async (item: ElementItem) => {
      const canvas = fabricRef.current
      if (!canvas) return
      const parts = await buildElement(item)
      if (!fabricRef.current || parts.length === 0) return
      const box = getPlacementBox()
      // Union of the parts in their shared local space
      parts.forEach((o) => o.setCoords())
      const rects = parts.map((o) => o.getBoundingRect())
      const minX = Math.min(...rects.map((r) => r.left))
      const minY = Math.min(...rects.map((r) => r.top))
      const maxX = Math.max(...rects.map((r) => r.left + r.width))
      const maxY = Math.max(...rects.map((r) => r.top + r.height))
      const k = Math.min((box.w * 0.6) / (maxX - minX), (box.h * 0.6) / (maxY - minY))
      const mid = new Point((minX + maxX) / 2, (minY + maxY) / 2)

      for (const obj of parts) {
        const c = obj.getCenterPoint()
        obj.scale(obj.scaleX * k)
        obj.setPositionByOrigin(new Point(box.cx + (c.x - mid.x) * k, box.cy + (c.y - mid.y) * k), 'center', 'center')
        obj.setCoords()
        if (item.kind === 'svg') (obj as FabricObject & { _name?: string })._name = item.name
        setObjectId(obj, ++idCounter.current)
        captureOrigin(obj)
        canvas.add(obj)
      }
      // A multi-line preset is selected as a set, so it moves together but each line stays editable
      canvas.setActiveObject(parts.length > 1 ? new ActiveSelection(parts, { canvas }) : parts[0])
      canvas.requestRenderAll()
      commit({ layers: true })
    },
    [commit, getPlacementBox],
  )

  // ── Style actions ──

  const applyTextStyle = useCallback(
    (patch: Partial<TextStyleProps>) =>
      withActive((obj) => {
        if (!(obj instanceof IText)) return
        const next = { ...readTextStyle(obj), ...patch }
        const center = obj.getCenterPoint()
        obj.set({
          fontFamily: next.fontFamily,
          fontSize: next.fontSize,
          fill: next.fill,
          fontWeight: next.bold ? 'bold' : 'normal',
          fontStyle: next.italic ? 'italic' : 'normal',
          underline: next.underline,
          textAlign: next.textAlign,
          charSpacing: next.charSpacing,
          lineHeight: next.lineHeight,
          stroke: next.strokeWidth > 0 ? next.stroke : null,
          strokeWidth: next.strokeWidth,
          paintFirst: 'stroke',
          shadow: next.shadow ? new Shadow(SOFT_SHADOW) : null,
        })
        // Re-fits the arc to the new size / font (or just re-measures straight text)
        applyCurve(obj, next.curve)
        // keep the text anchored on its center while it grows / shrinks
        obj.setPositionByOrigin(center, 'center', 'center')
      }, { layers: true }),
    [withActive],
  )

  const applyImageStyle = useCallback(
    (patch: Partial<ImageStyleProps>) =>
      withActive((obj) => {
        if (!(obj instanceof FabricImage)) return
        applyImageFilters(obj, { ...readImageStyle(obj), ...patch })
      }, { layers: true }),
    [withActive],
  )

  const handleShapeStyle = useCallback(
    (patch: Partial<ShapeStyleProps>) =>
      withActive((obj) => {
        if (!isEditableShape(obj)) return
        if (patch.fill !== undefined) obj.set('fill', patch.fill)
        if (patch.shadow !== undefined) obj.set('shadow', patch.shadow ? new Shadow(SOFT_SHADOW) : null)
      }, { layers: true }),
    [withActive],
  )

  // Sliders fire on every pixel; filters + re-render are applied at most once per frame
  const handleTextStyle = useRafCallback(applyTextStyle)
  const handleImageStyle = useRafCallback(applyImageStyle)

  const handleDelete = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const targets = canvas.getActiveObjects().filter((obj) => !isLocked(obj))
    if (targets.length === 0) return
    targets.forEach((obj) => canvas.remove(obj))
    canvas.discardActiveObject()
    commit({ layers: true })
  }, [commit])

  /** Adds copies of `sources` shifted by `offset`, as new unlocked layers, and selects them. */
  const addCopies = useCallback(
    async (sources: FabricObject[], offset: number) => {
      const canvas = fabricRef.current
      if (!canvas || sources.length === 0) return
      const copies = await Promise.all(sources.map((obj) => obj.clone()))
      for (const copy of copies) {
        copy.set({ left: copy.left + offset, top: copy.top + offset })
        setLocked(copy, false)
        copy.setCoords()
        if (printAreaRectRef.current) clampIntoBox(copy, referenceBox(printAreaRectRef.current))
        setObjectId(copy, ++idCounter.current)
        captureOrigin(copy)
        canvas.add(copy)
      }
      canvas.setActiveObject(copies.length > 1 ? new ActiveSelection(copies, { canvas }) : copies[0])
      canvas.requestRenderAll()
      commit({ layers: true })
    },
    [commit],
  )

  /** Clones of the selection with absolute (canvas) transforms; a multi-selection is split up. */
  const cloneSelection = useCallback(async () => {
    const active = fabricRef.current?.getActiveObject()
    if (!active) return []
    if (!(active instanceof ActiveSelection)) return [await active.clone()]
    // Members are stored relative to the selection: bake its transform into each clone
    const groupMatrix = active.calcTransformMatrix()
    return Promise.all(
      active.getObjects().map(async (obj) => {
        const copy = await obj.clone()
        util.addTransformToObject(copy, groupMatrix)
        return copy
      }),
    )
  }, [])

  const handleDuplicate = useCallback(async () => addCopies(await cloneSelection(), 20), [addCopies, cloneSelection])

  // ── Clipboard: copy / paste elements, paste images from other apps ──

  const CLIPBOARD_MARK = 'pod-editor:elements'
  const clipboardRef = useRef<{ objects: FabricObject[]; pasted: number } | null>(null)

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      return (
        !!el?.closest?.('input, textarea, [contenteditable="true"]') ||
        !!(fabricRef.current?.getActiveObject() as IText | undefined)?.isEditing
      )
    }
    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !fabricRef.current?.getActiveObject()) return
      // Clone now so later edits to the originals don't change what gets pasted
      cloneSelection().then((objects) => (clipboardRef.current = { objects, pasted: 0 }))
      // Mark the system clipboard so a stale image there doesn't win over these elements
      e.clipboardData?.setData('text/plain', CLIPBOARD_MARK)
      e.preventDefault()
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !fabricRef.current) return
      const data = e.clipboardData
      const image = data && [...data.files].find((f) => f.type.startsWith('image/'))
      if (image && data.getData('text/plain') !== CLIPBOARD_MARK) {
        e.preventDefault()
        addImageFile(image)
        return
      }
      const clip = clipboardRef.current
      if (clip) {
        e.preventDefault()
        clip.pasted += 1
        addCopies(clip.objects, 20 * clip.pasted)
      }
    }
    window.addEventListener('copy', onCopy)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('copy', onCopy)
      window.removeEventListener('paste', onPaste)
    }
  }, [addCopies, addImageFile, cloneSelection])

  /** Restore position, size, rotation, flips, opacity and style to how the element was added. */
  const handleResetElement = useCallback(
    () =>
      withActive((obj) => {
        const origin = getOrigin(obj)
        if (!origin) return
        obj.set({ ...origin, shadow: null })
        if (obj instanceof FabricImage) {
          obj.filters = []
          obj.applyFilters()
        }
        if (obj instanceof IText) applyCurve(obj, getCurve(obj))
      }, { layers: true }),
    [withActive],
  )

  const handleFlipH = useCallback(() => withActive((obj) => obj.set('flipX', !obj.flipX), { layers: true }), [withActive])
  const handleFlipV = useCallback(() => withActive((obj) => obj.set('flipY', !obj.flipY), { layers: true }), [withActive])
  const handleRotate = useCallback(
    () => withActive((obj) => obj.rotate(((obj.angle || 0) + 90) % 360)),
    [withActive],
  )

  /** Fit / fill the element into the print area (or the artboard when there is none), centered. */
  const scaleToBox = useCallback(
    (mode: 'fit' | 'fill') =>
      withActive((obj) => {
        if (!obj.width || !obj.height) return
        const box = referenceBox(printAreaRectRef.current)
        const pick = mode === 'fit' ? Math.min : Math.max
        obj.set({ angle: 0 })
        obj.scale(pick(box.w / obj.width, box.h / obj.height))
        obj.setPositionByOrigin(new Point(box.cx, box.cy), 'center', 'center')
      }),
    [withActive],
  )
  const handleFit = useCallback(() => scaleToBox('fit'), [scaleToBox])
  const handleFill = useCallback(() => scaleToBox('fill'), [scaleToBox])

  const handleBringForward = useCallback(
    () => withActive((obj, canvas) => canvas.bringObjectForward(obj), { layers: true, allowLocked: true }),
    [withActive],
  )
  const handleBringToFront = useCallback(
    () => withActive((obj, canvas) => canvas.bringObjectToFront(obj), { layers: true, allowLocked: true }),
    [withActive],
  )
  const handleSendBackward = useCallback(
    () =>
      withActive(
        (obj, canvas) => {
          // Never slide under the mockup or the print-area guide
          if (canvas.getObjects().indexOf(obj) > baseLayerIndex()) canvas.sendObjectBackwards(obj)
        },
        { layers: true, allowLocked: true },
      ),
    [withActive, baseLayerIndex],
  )
  const handleSendToBack = useCallback(
    () => withActive((obj, canvas) => canvas.moveObjectTo(obj, baseLayerIndex()), { layers: true, allowLocked: true }),
    [withActive, baseLayerIndex],
  )

  const toggleLockFor = useCallback(
    (obj: FabricObject) => {
      setLocked(obj, !isLocked(obj))
      obj.setCoords()
      if (fabricRef.current) updateObjectCursors(fabricRef.current, isUserObject)
      commit({ layers: true })
    },
    [commit, isUserObject],
  )

  const handleToggleLock = useCallback(() => {
    const obj = fabricRef.current?.getActiveObject()
    if (obj) toggleLockFor(obj)
  }, [toggleLockFor])

  const handlePropChange = useCallback(
    (prop: string, value: number) =>
      withActive((obj) => {
        const box = referenceBox(printAreaRectRef.current)
        const bounds = obj.getBoundingRect()
        if (prop === 'leftPercent') obj.set('left', obj.left + box.left + (value / 100) * box.w - bounds.left)
        else if (prop === 'topPercent') obj.set('top', obj.top + box.top + (value / 100) * box.h - bounds.top)
        else if (prop === 'scalePercent') obj.scale(value / 100)
        else if (prop === 'angle') obj.rotate(value)
        else if (prop === 'opacity') obj.set('opacity', Math.max(0, Math.min(100, value)) / 100)
      }),
    [withActive],
  )

  const handleAlign = useCallback(
    (alignment: string) =>
      withActive((obj) => {
        // Align the element's visual bounds to the print area (or artboard when there is none)
        const box = referenceBox(printAreaRectRef.current)
        const b = obj.getBoundingRect()
        let dx = 0
        let dy = 0
        if (alignment === 'left') dx = box.left - b.left
        else if (alignment === 'center-h') dx = box.cx - (b.left + b.width / 2)
        else if (alignment === 'right') dx = box.left + box.w - (b.left + b.width)
        else if (alignment === 'top') dy = box.top - b.top
        else if (alignment === 'center-v') dy = box.cy - (b.top + b.height / 2)
        else if (alignment === 'bottom') dy = box.top + box.h - (b.top + b.height)
        obj.set({ left: obj.left + dx, top: obj.top + dy })
      }),
    [withActive],
  )

  const handleNudge = useCallback(
    (dx: number, dy: number) =>
      withActive((obj) => obj.set({ left: (obj.left || 0) + dx, top: (obj.top || 0) + dy })),
    [withActive],
  )

  /** Renders the artboard as the final design: no selection, no print-area guide. */
  const renderDesign = useCallback((multiplier = 2) => {
    const canvas = fabricRef.current
    if (!canvas) return ''
    canvas.discardActiveObject()
    const guide = printAreaRectRef.current
    guide?.set('visible', false)
    const vpt = canvas.viewportTransform
    const zoom = vpt[0]
    const prevBackground = canvas.backgroundColor
    canvas.backgroundColor = '#ffffff'
    // Crop exactly the artboard region regardless of current zoom/pan
    const url = renderUncached(canvas, () =>
      canvas.toDataURL({
        format: 'png',
        left: vpt[4],
        top: vpt[5],
        width: CANVAS_WIDTH * zoom,
        height: CANVAS_HEIGHT * zoom,
        multiplier: multiplier / zoom,
      }),
    )
    canvas.backgroundColor = prevBackground
    guide?.set('visible', true)
    canvas.renderAll()
    return url
  }, [])

  const handleExport = useCallback(() => {
    const url = renderDesign()
    if (!url) return
    const anchor = document.createElement('a')
    anchor.download = `${templateName}-design.png`
    anchor.href = url
    anchor.click()
  }, [renderDesign, templateName])

  // ── Mockups & preview ──

  // Mockups belong to the template they were uploaded for
  const [mockupState, setMockupState] = useState<{ template: typeof template; list: MockupPsd[] }>({
    template,
    list: [],
  })
  const mockups = useMemo(
    () => (mockupState.template === template ? mockupState.list : []),
    [mockupState, template],
  )

  const [preview, setPreview] = useState<{ designUrl: string; target: PreviewTarget } | null>(null)
  const openPreview = useCallback(
    (target: PreviewTarget = 'design') => {
      // Open right away; the 2× artboard render (synchronous, heavy) follows once the dialog has painted
      setPreview({ designUrl: '', target })
      window.setTimeout(() => {
        const designUrl = renderDesign()
        setPreview((prev) => (prev ? { ...prev, designUrl } : prev))
      }, 60)
    },
    [renderDesign],
  )
  // Previewing needs a mockup: without one, the Preview button asks for a mockup PSD
  // first and opens the preview on it as soon as it's added
  const previewAfterUpload = useRef(false)
  const handlePreview = useCallback(() => {
    if (mockups.length > 0) return openPreview(mockups[0].id)
    previewAfterUpload.current = true
    mockupInputRef.current?.click()
  }, [openPreview, mockups])
  const closePreview = useCallback(() => setPreview(null), [])

  /** Transparent render of the user's design inside one side's print area, at PSD resolution. */
  const renderSide = useCallback(
    (index: number) => {
      const canvas = fabricRef.current
      if (!canvas || !template) return ''
      const { fitScale, offsetX, offsetY } = templateLayout(template)
      const area = template.printAreas[index]
      const box = area
        ? {
            left: offsetX + area.left * fitScale,
            top: offsetY + area.top * fitScale,
            width: area.width * fitScale,
            height: area.height * fitScale,
          }
        : { left: 0, top: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
      const vpt = canvas.viewportTransform
      const zoom = vpt[0]
      clipSuspendedRef.current = true
      const url = renderUncached(canvas, () =>
        canvas.toDataURL({
          format: 'png',
          left: vpt[4] + box.left * zoom,
          top: vpt[5] + box.top * zoom,
          width: box.width * zoom,
          height: box.height * zoom,
          // Well above PSD resolution so the print stays sharp once placed into a mockup
          multiplier: Math.min(SIDE_RENDER_SCALE / fitScale, SIDE_RENDER_MAX_PX / box.width) / zoom,
          filter: (obj) => isUserObject(obj as FabricObject),
        }),
      )
      clipSuspendedRef.current = false
      canvas.renderAll()
      return url
    },
    [template, isUserObject],
  )

  /** What's inside each chosen side's print area, cropped, on transparent — the files sent to print. */
  const handleExportPrintArea = useCallback(
    (indexes: number[]) => {
      fabricRef.current?.discardActiveObject()
      indexes.forEach((i, n) => {
        const url = renderSide(i)
        if (!url) return
        // Browsers drop rapid back-to-back downloads; space them out a little
        window.setTimeout(() => {
          const anchor = document.createElement('a')
          anchor.download = `${templateName}-${printAreas[i].name}-print-area.png`
          anchor.href = url
          anchor.click()
        }, n * 250)
      })
    },
    [printAreas, renderSide, templateName],
  )

  const handleUploadMockupClick = useCallback(() => {
    previewAfterUpload.current = false
    mockupInputRef.current?.click()
  }, [])

  const handleUploadMockup = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      try {
        const mockup = await runUpload(file, 'mockup', () =>
          file.arrayBuffer().then((buffer) => parseMockupPsd(buffer, file.name.replace(/\.psd$/i, ''))),
        )
        setMockupState((prev) => ({
          template,
          list: [...(prev.template === template ? prev.list : []), mockup],
        }))
        if (previewAfterUpload.current) openPreview(mockup.id)
      } catch (err) {
        console.error('Failed to parse mockup PSD:', err)
      } finally {
        previewAfterUpload.current = false
      }
    },
    [runUpload, template, openPreview],
  )

  const handleRemoveMockup = useCallback(
    (id: number) => setMockupState((prev) => ({ ...prev, list: prev.list.filter((m) => m.id !== id) })),
    [],
  )

  // ── Layer panel actions ──

  const findObject = useCallback((id: number) => {
    return fabricRef.current?.getObjects().find((o) => getObjectId(o) === id)
  }, [])

  /** Stacking order from the Layers panel: `index` counts user layers from the bottom. */
  const handleReorderLayer = useCallback(
    (id: number, index: number) => {
      const canvas = fabricRef.current
      const obj = findObject(id)
      if (!canvas || !obj) return
      // User layers sit above the mockup / print-area guide
      canvas.moveObjectTo(obj, baseLayerIndex() + index)
      canvas.requestRenderAll()
      commit({ layers: true })
    },
    [findObject, baseLayerIndex, commit],
  )

  const handleSelectLayer = useCallback(
    (id: number) => {
      const canvas = fabricRef.current
      const obj = findObject(id)
      if (!canvas || !obj || obj.visible === false) return
      canvas.setActiveObject(obj)
      canvas.renderAll()
      refreshSelectedProps()
    },
    [findObject, refreshSelectedProps],
  )

  const handleDeleteLayer = useCallback(
    (id: number) => {
      const canvas = fabricRef.current
      const obj = findObject(id)
      if (!canvas || !obj) return
      canvas.remove(obj)
      canvas.discardActiveObject()
      commit({ layers: true })
    },
    [findObject, commit],
  )

  const handleToggleVisible = useCallback(
    (id: number) => {
      const canvas = fabricRef.current
      const obj = findObject(id)
      if (!canvas || !obj) return
      const visible = obj.visible === false
      obj.set({ visible, evented: visible })
      if (!visible && canvas.getActiveObject() === obj) canvas.discardActiveObject()
      commit({ layers: true })
    },
    [findObject, commit],
  )

  const handleToggleLayerLock = useCallback(
    (id: number) => {
      const obj = findObject(id)
      if (obj) toggleLockFor(obj)
    },
    [findObject, toggleLockFor],
  )

  // ── Tool switching ──

  const handleToolChange = useCallback(
    (tool: EditorTool) => {
      setActiveTool(tool)
      const canvas = fabricRef.current
      panModeRef.current = tool === 'pan'
      if (!canvas) return
      // In pan mode Fabric must not select or drag objects
      canvas.selection = tool !== 'pan'
      canvas.skipTargetFind = tool === 'pan'
      if (tool === 'pan') canvas.discardActiveObject()
      canvas.requestRenderAll()
    },
    [],
  )

  // ── Template switching ──

  // Work in progress = any layer on the canvas, or a PSD template loaded
  const hasWork = layers.length > 0 || !isBlank
  const closeConfirm = useCallback(() => setConfirmOptions(null), [])

  const replaceDescription = (target: string) => (
    <>
      You&apos;re editing <b className="font-semibold text-ink">{templateName}</b>
      {layers.length > 0 && <> with {layers.length} layer{layers.length > 1 ? 's' : ''}</>}. Switching to {target} will
      replace the current mockup and print areas.
    </>
  )

  // Shown only when there is something to keep
  const keepLayersOption = () => ({
    label: 'Keep current layers',
    hint:
      layers.length > 0
        ? `Unchecked: ${layers.length} layer${layers.length > 1 ? 's' : ''} (images & text) will be removed.`
        : 'Unchecked: images & text on the canvas will be removed.',
  })

  /** Whether the pending PSD upload (chosen after the confirm) should keep layers. */
  const keepLayersOnUploadRef = useRef(true)

  const clearUserLayers = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.discardActiveObject()
    canvas.getObjects().filter(isUserObject).forEach((obj) => canvas.remove(obj))
    commit({ layers: true })
  }, [isUserObject, commit])

  const handleSwitchToBlank = useCallback(() => {
    const apply = () =>
      onTemplateChange?.({
        name: 'Blank',
        width: 1200,
        height: 900,
        mockupDataUrl: '',
        printAreas: [],
        layerImages: [],
      })
    if (isBlank) return
    if (!hasWork) return apply()
    setConfirmOptions({
      title: 'Switch to blank canvas?',
      description: replaceDescription('a blank canvas'),
      confirmLabel: 'Switch template',
      option: keepLayersOption(),
      onConfirm: (keepLayers) => {
        if (!keepLayers) clearUserLayers()
        apply()
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTemplateChange, isBlank, hasWork, templateName, layers.length])

  const handleRequestUploadPsd = useCallback(() => {
    const pick = (keepLayers: boolean) => {
      keepLayersOnUploadRef.current = keepLayers
      psdInputRef.current?.click()
    }
    if (!hasWork) return pick(true)
    setConfirmOptions({
      title: 'Replace current template?',
      description: replaceDescription('a new PSD'),
      confirmLabel: 'Choose PSD…',
      option: keepLayersOption(),
      // Layers are only cleared once the new PSD has actually loaded
      onConfirm: pick,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWork, templateName, layers.length])

  const handleRemoveTemplate = useCallback(() => {
    setConfirmOptions({
      title: 'Remove this template?',
      description: (
        <>
          <b className="font-semibold text-ink">{templateName}</b> and all {layers.length || ''} layer
          {layers.length === 1 ? '' : 's'} on the canvas will be removed. This can&apos;t be undone.
        </>
      ),
      confirmLabel: 'Remove template',
      tone: 'danger',
      onConfirm: () => onRemoveTemplate?.(),
    })
  }, [templateName, layers.length, onRemoveTemplate])

  const loadPsdFile = useCallback(
    async (file: File) => {
      try {
        const newTemplate = await runUpload(file, 'psd', async () => {
          const parsed = await parsePsd(await file.arrayBuffer())
          parsed.name = file.name.replace(/\.psd$/i, '')
          return parsed
        })
        if (!keepLayersOnUploadRef.current) clearUserLayers()
        keepLayersOnUploadRef.current = true
        setActiveAreaIndex(0)
        setColorByArea({})
        onTemplateChange?.(newTemplate)
      } catch (err) {
        console.error('Failed to parse PSD:', err)
      }
    },
    [onTemplateChange, runUpload, clearUserLayers],
  )

  const handleUploadPsd = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) loadPsdFile(file)
    },
    [loadPsdFile],
  )

  // ── Drag & drop files onto the stage ──

  const [isDragOver, setIsDragOver] = useState(false)
  const dragDepth = useRef(0)

  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setIsDragOver(false)
      const canvas = fabricRef.current
      const files = Array.from(e.dataTransfer.files)
      const psd = files.find((f) => /\.psd$/i.test(f.name))
      if (psd) {
        const run = (keepLayers: boolean) => {
          keepLayersOnUploadRef.current = keepLayers
          loadPsdFile(psd)
        }
        if (!hasWork) return run(true)
        setConfirmOptions({
          title: 'Replace current template?',
          description: replaceDescription(`“${psd.name}”`),
          confirmLabel: 'Replace template',
          option: keepLayersOption(),
          onConfirm: run,
        })
        return
      }
      // Images land where they were dropped (scene coordinates)
      const rect = e.currentTarget.getBoundingClientRect()
      const images = files.filter((f) => f.type.startsWith('image/'))
      images.forEach((file, i) => {
        const screen = new Point(e.clientX - rect.left + i * 24, e.clientY - rect.top + i * 24)
        const scene = canvas ? screen.transform(util.invertTransform(canvas.viewportTransform)) : undefined
        addImageFile(file, scene)
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addImageFile, loadPsdFile, hasWork, templateName, layers.length],
  )

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable="true"]')) return
      const active = fabricRef.current?.getActiveObject() as (FabricObject & { isEditing?: boolean }) | undefined
      if (active?.isEditing) return

      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const run = (fn: () => void) => {
        e.preventDefault()
        fn()
      }

      if (mod) {
        if (key === '.') return run(togglePanel)
        if (key === 'z') return run(e.shiftKey ? redo : undo)
        if (key === 'y') return run(redo)
        if (key === 'd') return run(handleDuplicate)
        if (key === 'l') return run(handleToggleLock)
        if (key === 'e') return run(handleExport)
        if (key === 'p') return run(handlePreview)
        if (key === '0') return run(handleResetZoom)
        if (key === '=' || key === '+') return run(handleZoomIn)
        if (key === '-') return run(handleZoomOut)
        if (e.code === 'BracketRight') return run(e.shiftKey ? handleBringToFront : handleBringForward)
        if (e.code === 'BracketLeft') return run(e.shiftKey ? handleSendToBack : handleSendBackward)
        return
      }

      if (key === 'delete' || key === 'backspace') return run(handleDelete)
      if (e.shiftKey && key === 'h') return run(handleFlipH)
      if (e.shiftKey && key === 'v') return run(handleFlipV)
      if (e.shiftKey && e.code === 'Digit1') return run(fitToScreen)
      if (key === 'v') return run(() => handleToolChange('select'))
      if (key === 'h') return run(() => handleToolChange('pan'))
      if (e.shiftKey && key === 'r') return run(handleResetElement)
      if (key === 'r') return run(handleRotate)
      if (key === 't') return run(handleAddText)
      if (key === 'e') return run(() => setElementsOpen((v) => !v))
      if (key === 'i') return run(handleImportImage)
      if (key === 'escape' && elementsOpen && !fabricRef.current?.getActiveObject()) return run(() => setElementsOpen(false))
      if (key === 'escape') {
        return run(() => {
          fabricRef.current?.discardActiveObject()
          fabricRef.current?.requestRenderAll()
        })
      }

      const step = e.shiftKey ? NUDGE_PX_LARGE : NUDGE_PX
      if (key === 'arrowleft') return run(() => handleNudge(-step, 0))
      if (key === 'arrowright') return run(() => handleNudge(step, 0))
      if (key === 'arrowup') return run(() => handleNudge(0, -step))
      if (key === 'arrowdown') return run(() => handleNudge(0, step))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    undo, redo, handleDuplicate, handleToggleLock, handleExport, handlePreview, handleResetZoom, handleZoomIn,
    handleZoomOut, handleBringToFront, handleBringForward, handleSendToBack, handleSendBackward,
    handleDelete, handleFlipH, handleFlipV, fitToScreen, handleToolChange, handleRotate,
    handleAddText, handleImportImage, handleNudge, handleResetElement, elementsOpen, togglePanel,
  ])

  const railItems: RailItem[] = [
    ...(printAreas.length > 0 ? [{ id: 'mockups', label: 'Mockups', icon: <IcMockup className="h-4 w-4" />, count: mockups.length }] : []),
    ...(activeColors.length > 0 ? [{ id: 'colors', label: 'Colors', icon: <IcPalette className="h-4 w-4" /> }] : []),
    { id: 'layers', label: 'Layers', icon: <IcLayers className="h-4 w-4" />, count: layers.length },
    ...(styleProps
      ? [{
          id: 'style',
          label: styleProps.kind === 'text' ? 'Text style' : styleProps.kind === 'shape' ? 'Shape style' : 'Image adjustments',
          icon: styleProps.kind === 'text' ? <IcText className="h-4 w-4" /> : styleProps.kind === 'shape' ? <IcElements className="h-4 w-4" /> : <IcSliders className="h-4 w-4" />,
          highlight: true,
        }]
      : []),
    ...(selectedObjectProps ? [{ id: 'position', label: 'Position & size', icon: <IcTransform className="h-4 w-4" />, highlight: true }] : []),
  ]

  // ── Render ──

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-app">
      <EditorToolbar
        templateName={templateName}
        isBlank={isBlank}
        onSwitchToBlank={handleSwitchToBlank}
        onUploadPsd={handleRequestUploadPsd}
        onRemoveTemplate={handleRemoveTemplate}
        activeTool={isWheelPanning ? 'pan' : activeTool}
        onToolChange={handleToolChange}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        hasSelection={hasSelection}
        isLocked={!!selectedObjectProps?.locked}
        onFlipH={handleFlipH}
        onFlipV={handleFlipV}
        onRotate={handleRotate}
        canReset={!!selectedObjectProps?.modified}
        onReset={handleResetElement}
        onFit={handleFit}
        onFill={handleFill}
        onDuplicate={handleDuplicate}
        onBringToFront={handleBringToFront}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onSendToBack={handleSendToBack}
        onToggleLock={handleToggleLock}
        onDelete={handleDelete}
        onExport={handleExport}
        onExportPrintArea={handleExportPrintArea}
        printAreaNames={printAreas.map((area) => area.name)}
        activeAreaIndex={activeAreaIndex}
        onPreview={handlePreview}
        panelOpen={panelOpen}
        onTogglePanel={togglePanel}
        previewNeedsMockup={mockups.length === 0}
      />

      <div className="flex min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5">
        <LeftSidebar
          onImportImage={handleImportImage}
          onAddText={handleAddText}
          elementsOpen={elementsOpen}
          onToggleElements={() => setElementsOpen((v) => !v)}
        />
        {elementsOpen && (
          <ElementsPanel onAdd={handleAddElement} onClose={() => setElementsOpen(false)} />
        )}

        {/* Stage — fixed size, never scrolls; zoom & pan happen in the Fabric viewport */}
        <div
          ref={stageRef}
          className={`stage-dots relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-line shadow-soft ${
            // Pointer capture sits on the stage, so the drag cursor must live here too
            isPanning ? 'cursor-grabbing' : ''
          }`}
          onPointerDownCapture={handleStagePointerDown}
          onPointerMoveCapture={handleStagePointerMove}
          onPointerUpCapture={handleStagePointerUp}
          onPointerCancelCapture={handleStagePointerUp}
          // Middle click would start the browser's auto-scroll
          onMouseDownCapture={(e) => e.button === 1 && e.preventDefault()}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Artboard backdrop, follows the viewport transform */}
          <div
            className="pointer-events-none absolute rounded-md bg-white shadow-[0_1px_3px_rgba(28,48,36,0.05),0_18px_50px_rgba(28,48,36,0.10)]"
            style={{
              left: view.x,
              top: view.y,
              width: CANVAS_WIDTH * view.zoom,
              height: CANVAS_HEIGHT * view.zoom,
            }}
          />
          <div className="absolute inset-0">
            <canvas ref={canvasRef} />
          </div>
          {/* Pan overlay — blocks Fabric hover/selection and shows the hand cursor */}
          {(panActive || isPanning) && (
            <div className={`absolute inset-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`} />
          )}

          {isDragOver && (
            <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft/60 backdrop-blur-[1px] animate-[fade-in_120ms_ease-out]">
              <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface px-6 py-4 shadow-float">
                <IcUpload className="h-6 w-6 text-accent" />
                <p className="text-[13.5px] font-semibold text-ink">Drop to add</p>
                <p className="text-[11.5px] text-ink-muted">Images are placed where you drop · PSD replaces the template</p>
              </div>
            </div>
          )}

          {uploadTask && (
            <div data-stage-ui className="absolute bottom-[72px] right-4 z-20">
              <UploadProgress task={uploadTask} />
            </div>
          )}

          <div data-stage-ui className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-end justify-between px-4">
            <div className="pointer-events-auto rounded-full border border-line bg-surface/85 px-3 py-1 text-[11px] font-medium text-ink-muted shadow-soft backdrop-blur">
              {CANVAS_WIDTH} × {CANVAS_HEIGHT} px
            </div>
            <div className="pointer-events-auto">
              <PrintAreaTabs printAreas={printAreas} activeIndex={activeAreaIndex} onAreaChange={setActiveAreaIndex} />
            </div>
            <div className="pointer-events-auto">
              <ZoomBar
                zoomPercent={zoomPercent}
                isPanActive={activeTool === 'pan' || isWheelPanning}
                onTogglePan={() => handleToolChange(activeTool === 'pan' ? 'select' : 'pan')}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onFitScreen={fitToScreen}
                onResetZoom={handleResetZoom}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar — hidden, it leaves a rail so the settings stay discoverable */}
        {!panelOpen && <CollapsedPanelRail items={railItems} onOpen={openPanel} />}
        {panelOpen && (
          <div className="flex w-[300px] shrink-0 flex-col overflow-y-auto rounded-2xl border border-line bg-surface shadow-soft animate-[fade-in_150ms_ease-out]">
            {/* Header with an obvious way to fold the panel away */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line/70 bg-surface/95 py-2 pl-4 pr-2 backdrop-blur">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Settings</span>
              <Tooltip label="Hide side panel" description="More room for the editor" shortcut="Ctrl ." side="left">
                <button
                  onClick={togglePanel}
                  aria-label="Collapse side panel"
                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent"
                >
                  Hide
                  <IcChevronRight className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
            {/* Template-level: mockups, colors, layers */}
            {printAreas.length > 0 && (
              <MockupPanel
                mockups={mockups}
                onUpload={handleUploadMockupClick}
                onOpen={openPreview}
                onRemove={handleRemoveMockup}
              />
            )}
            <PrintAreaColors
              colors={activeColors}
              selected={activeColorName}
              onSelect={(name) => setColorByArea((prev) => ({ ...prev, [activeAreaIndex]: name }))}
            />
            <LayerPanel
              layers={layers}
              selectedLayerId={selectedLayerId}
              onSelectLayer={handleSelectLayer}
              onDeleteLayer={handleDeleteLayer}
              onToggleVisible={handleToggleVisible}
              onToggleLock={handleToggleLayerLock}
              onReorder={handleReorderLayer}
            />

            {/* Selected element settings */}
            {styleProps && (
              <StylePanel
                style={styleProps}
                onTextChange={handleTextStyle}
                onImageChange={handleImageStyle}
                onShapeChange={handleShapeStyle}
              />
            )}
            {selectedObjectProps && (
              <PositionPanel
                objectProps={selectedObjectProps}
                relativeToPrintArea={!!activePrintArea}
                onPropChange={handlePropChange}
                onAlign={handleAlign}
              />
            )}
            {selectedObjectProps && (
              <ElementActions
                kind={styleProps?.kind === 'text' ? 'text' : styleProps?.kind === 'shape' || !styleProps ? 'element' : 'image'}
                locked={selectedObjectProps.locked}
                canReset={selectedObjectProps.modified}
                onReset={handleResetElement}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            )}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
      <input ref={psdInputRef} type="file" accept=".psd" onChange={handleUploadPsd} className="hidden" />
      <input ref={mockupInputRef} type="file" accept=".psd" onChange={handleUploadMockup} className="hidden" />

      {confirmOptions && <ConfirmDialog options={confirmOptions} onClose={closeConfirm} />}
      {preview && (
        <PreviewDialog
          templateName={templateName}
          designUrl={preview.designUrl}
          designLabel={[activePrintArea?.name, activeColorName].filter(Boolean).join(' · ') || 'Current view'}
          mockups={mockups}
          initialTarget={preview.target}
          side={activeAreaIndex}
          renderSide={renderSide}
          onUploadMockup={handleUploadMockupClick}
          mockupUpload={uploadTask?.kind === 'mockup' ? uploadTask : null}
          onClose={closePreview}
        />
      )}
    </div>
  )
}
