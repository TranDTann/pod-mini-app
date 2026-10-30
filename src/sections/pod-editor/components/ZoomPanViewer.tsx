'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IcFitScreen, IcMinus, IcPan, IcPlus } from '@/components/icons'
import { Tooltip } from './ui'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const STEP = 1.25

interface View {
  zoom: number
  x: number
  y: number
}

const FIT: View = { zoom: 1, x: 0, y: 0 }

/**
 * Image viewer with zoom & pan — same rules as the editor stage:
 * Ctrl/⌘ + wheel zooms at the cursor, drag / wheel pans only while the Hand tool is on.
 * `zoom = 1` is "fit to the viewer".
 */
export function useZoomPan(resetKey: string) {
  const [view, setView] = useState<View>(FIT)
  const [panMode, setPanMode] = useState(false)
  /** Panning while the mouse wheel (middle button) is held — a temporary Hand tool */
  const [wheelPanning, setWheelPanning] = useState(false)
  const [lastKey, setLastKey] = useState(resetKey)

  // New image → back to fit (state adjusted during render, no effect needed)
  if (lastKey !== resetKey) {
    setLastKey(resetKey)
    setView(FIT)
  }

  const zoomBy = useCallback((factor: number, at?: { x: number; y: number }) => {
    setView((v) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor))
      const k = zoom / v.zoom
      // Keep the point under the cursor fixed (coords relative to viewer center)
      const p = at ?? { x: 0, y: 0 }
      return { zoom, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k }
    })
  }, [])

  return {
    view,
    setView,
    panMode,
    setPanMode,
    wheelPanning,
    setWheelPanning,
    zoomIn: () => zoomBy(STEP),
    zoomOut: () => zoomBy(1 / STEP),
    zoomBy,
    fit: () => setView(FIT),
  }
}

export type ZoomPan = ReturnType<typeof useZoomPan>

export function ZoomPanStage({ zp, src, alt }: { zp: ZoomPan; src: string; alt: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { view, setView, panMode, zoomBy, wheelPanning, setWheelPanning } = zp

  // Native non-passive wheel listener so we can preventDefault
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = stage.getBoundingClientRect()
        zoomBy(Math.pow(0.998, e.deltaY * 2), {
          x: e.clientX - r.left - r.width / 2,
          y: e.clientY - r.top - r.height / 2,
        })
      } else if (panMode) {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [panMode, zoomBy, setView])

  return (
    <div
      ref={stageRef}
      className={`absolute inset-0 overflow-hidden ${
        isDragging ? 'cursor-grabbing' : panMode || wheelPanning ? 'cursor-grab' : ''
      }`}
      // Middle click would start the browser's auto-scroll
      onMouseDown={(e) => e.button === 1 && e.preventDefault()}
      onPointerDown={(e) => {
        // Holding the mouse wheel pans even when the Hand tool is off
        const isWheelButton = e.button === 1
        if (!panMode && !isWheelButton) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY }
        if (isWheelButton) setWheelPanning(true)
        setIsDragging(true)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        drag.current = { x: e.clientX, y: e.clientY }
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
      }}
      onPointerUp={(e) => {
        // While wheel-panning, only releasing the wheel ends it
        if (wheelPanning && e.button !== 1) return
        drag.current = null
        setIsDragging(false)
        setWheelPanning(false)
      }}
      onPointerCancel={() => {
        drag.current = null
        setIsDragging(false)
        setWheelPanning(false)
      }}
      onDoubleClick={() => setView(FIT)}
    >
      <div className="flex h-full w-full items-center justify-center p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={`max-h-full max-w-full select-none object-contain will-change-transform ${
            isDragging ? '' : 'transition-transform duration-150 ease-out'
          }`}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        />
      </div>
    </div>
  )
}

const BTN =
  'flex h-8 w-8 items-center justify-center rounded-[10px] text-ink-muted transition-all duration-150 hover:bg-hover hover:text-ink active:scale-90'

export function ZoomPanControls({ zp }: { zp: ZoomPan }) {
  const { view, panMode, setPanMode, wheelPanning, zoomIn, zoomOut, fit } = zp
  const handOn = panMode || wheelPanning
  return (
    <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-surface/90 p-1 shadow-float backdrop-blur">
      <Tooltip label={panMode ? 'Exit hand tool' : 'Hand tool — drag to pan'} shortcut="H" side="top">
        <button
          onClick={() => setPanMode(!panMode)}
          aria-label="Hand tool"
          aria-pressed={handOn}
          className={`${BTN} ${handOn ? '!bg-accent !text-white shadow-accent' : ''}`}
        >
          <IcPan className="h-4 w-4" />
        </button>
      </Tooltip>
      <div className="mx-0.5 h-4 w-px bg-line-strong" />
      <Tooltip label="Zoom out" shortcut="−" side="top">
        <button onClick={zoomOut} className={BTN} aria-label="Zoom out">
          <IcMinus className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip label="Fit to view" shortcut="0" side="top">
        <button
          onClick={fit}
          className="h-8 min-w-[56px] rounded-[10px] px-2 text-[12.5px] font-semibold tabular-nums text-ink transition-colors hover:bg-hover"
        >
          {Math.round(view.zoom * 100)}%
        </button>
      </Tooltip>
      <Tooltip label="Zoom in" shortcut="+" side="top">
        <button onClick={zoomIn} className={BTN} aria-label="Zoom in">
          <IcPlus className="h-4 w-4" />
        </button>
      </Tooltip>
      <div className="mx-0.5 h-4 w-px bg-line-strong" />
      <Tooltip label="Fit to view" description="Or double-click the image" shortcut="0" side="top">
        <button onClick={fit} className={BTN} aria-label="Fit to view">
          <IcFitScreen className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}
