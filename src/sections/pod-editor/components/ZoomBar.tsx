import { IcMinus, IcPlus, IcFitScreen, IcPan } from '@/components/icons'
import { Tooltip } from './ui'

interface ZoomBarProps {
  zoomPercent: number
  isPanActive: boolean
  onTogglePan: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitScreen: () => void
  onResetZoom: () => void
}

const BTN =
  'flex h-8 w-8 items-center justify-center rounded-[10px] text-ink-muted transition-all duration-150 hover:bg-hover hover:text-ink active:scale-90'

export default function ZoomBar({
  zoomPercent,
  isPanActive,
  onTogglePan,
  onZoomIn,
  onZoomOut,
  onFitScreen,
  onResetZoom,
}: ZoomBarProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-surface/90 p-1 shadow-float backdrop-blur">
      <Tooltip label={isPanActive ? 'Exit hand tool' : 'Hand tool — drag to pan'} shortcut="H" side="top">
        <button
          onClick={onTogglePan}
          aria-label="Hand tool"
          aria-pressed={isPanActive}
          className={`${BTN} ${isPanActive ? '!bg-accent !text-white shadow-accent' : ''}`}
        >
          <IcPan className="h-4 w-4" />
        </button>
      </Tooltip>
      <div className="mx-0.5 h-4 w-px bg-line-strong" />
      <Tooltip label="Zoom out" shortcut="Ctrl −" side="top">
        <button onClick={onZoomOut} className={BTN} aria-label="Zoom out">
          <IcMinus className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip label="Reset to 100%" shortcut="Ctrl 0" side="top">
        <button
          onClick={onResetZoom}
          className="h-8 min-w-[56px] rounded-[10px] px-2 text-[12.5px] font-semibold tabular-nums text-ink transition-colors hover:bg-hover"
        >
          {zoomPercent}%
        </button>
      </Tooltip>
      <Tooltip label="Zoom in" shortcut="Ctrl +" side="top">
        <button onClick={onZoomIn} className={BTN} aria-label="Zoom in">
          <IcPlus className="h-4 w-4" />
        </button>
      </Tooltip>
      <div className="mx-0.5 h-4 w-px bg-line-strong" />
      <Tooltip label="Fit to screen" shortcut="⇧ 1" side="top">
        <button onClick={onFitScreen} className={BTN} aria-label="Fit to screen">
          <IcFitScreen className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}
