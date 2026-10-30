'use client'

import {
  useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { IcChevronDown } from '@/components/icons'

// ── Tooltip ──

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

const TOOLTIP_DELAY = 300
const GAP = 8
const VIEWPORT_MARGIN = 8
const ARROW_INSET = 12

const OPPOSITE: Record<TooltipSide, TooltipSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

// Small slide toward the anchor on enter
const ENTER_OFFSET: Record<TooltipSide, string> = {
  top: 'translateY(4px)',
  bottom: 'translateY(-4px)',
  left: 'translateX(4px)',
  right: 'translateX(-4px)',
}

interface Placement {
  left: number
  top: number
  side: TooltipSide
  arrow: number
}

function computePlacement(anchor: DOMRect, w: number, h: number, preferred: TooltipSide): Placement {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cx = anchor.left + anchor.width / 2
  const cy = anchor.top + anchor.height / 2

  const place = (side: TooltipSide) => {
    if (side === 'top') return { left: cx - w / 2, top: anchor.top - GAP - h }
    if (side === 'bottom') return { left: cx - w / 2, top: anchor.bottom + GAP }
    if (side === 'left') return { left: anchor.left - GAP - w, top: cy - h / 2 }
    return { left: anchor.right + GAP, top: cy - h / 2 }
  }
  const fits = (side: TooltipSide, p: { left: number; top: number }) =>
    side === 'top' ? p.top >= VIEWPORT_MARGIN
      : side === 'bottom' ? p.top + h <= vh - VIEWPORT_MARGIN
        : side === 'left' ? p.left >= VIEWPORT_MARGIN
          : p.left + w <= vw - VIEWPORT_MARGIN

  // Flip to the opposite side when there is no room
  let side = preferred
  let p = place(side)
  if (!fits(side, p) && fits(OPPOSITE[side], place(OPPOSITE[side]))) {
    side = OPPOSITE[side]
    p = place(side)
  }

  const left = Math.min(Math.max(p.left, VIEWPORT_MARGIN), vw - w - VIEWPORT_MARGIN)
  const top = Math.min(Math.max(p.top, VIEWPORT_MARGIN), vh - h - VIEWPORT_MARGIN)
  const horizontal = side === 'top' || side === 'bottom'
  const arrow = horizontal
    ? Math.min(Math.max(cx - left, ARROW_INSET), w - ARROW_INSET)
    : Math.min(Math.max(cy - top, ARROW_INSET), h - ARROW_INSET)
  return { left, top, side, arrow }
}

export function Tooltip({
  label,
  description,
  shortcut,
  side = 'bottom',
  block = false,
  children,
}: {
  label: string
  /** Optional secondary line (muted) */
  description?: string
  shortcut?: string
  side?: TooltipSide
  /** Stretch the trigger to its container's width (for full-width controls) */
  block?: boolean
  children: ReactNode
}) {
  const id = useId()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<Placement | null>(null)

  const hide = () => {
    window.clearTimeout(timerRef.current)
    setOpen(false)
    setPlacement(null)
  }

  const show = () => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setOpen(true), TOOLTIP_DELAY)
  }

  // Measure the rendered tooltip, then place it (flip + clamp inside the viewport)
  useLayoutEffect(() => {
    if (!open || !tipRef.current || !anchorRef.current) return
    const { width, height } = tipRef.current.getBoundingClientRect()
    setPlacement(computePlacement(anchorRef.current.getBoundingClientRect(), width, height, side))
  }, [open, side, label, description, shortcut])

  // Any scroll / resize / key press / window blur dismisses the tooltip
  useEffect(() => {
    if (!open) return
    const close = () => hide()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', close, true)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', close, true)
      window.removeEventListener('blur', close)
    }
  }, [open])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const finalSide = placement?.side ?? side
  const horizontal = finalSide === 'top' || finalSide === 'bottom'
  const arrowStyle: CSSProperties = horizontal
    ? { left: placement?.arrow, [finalSide === 'top' ? 'bottom' : 'top']: -4, marginLeft: -4 }
    : { top: placement?.arrow, [finalSide === 'left' ? 'right' : 'left']: -4, marginTop: -4 }

  return (
    <span
      ref={anchorRef}
      className={block ? 'flex w-full' : 'inline-flex'}
      aria-describedby={open ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className={`pointer-events-none fixed z-[1000] max-w-[260px] rounded-[10px] bg-ink px-2.5 py-1.5 text-white shadow-float ${
              placement ? 'animate-[tooltip-in_140ms_ease-out]' : 'invisible'
            }`}
            style={
              {
                left: placement?.left ?? 0,
                top: placement?.top ?? 0,
                '--tt-from': ENTER_OFFSET[finalSide],
                '--tt-to': 'none',
              } as CSSProperties
            }
          >
            <span className="absolute h-2 w-2 rotate-45 rounded-[1px] bg-ink" style={arrowStyle} />
            <span className="relative flex items-center gap-2">
              <span className="truncate text-[12px] font-medium leading-snug">{label}</span>
              {shortcut && (
                <kbd className="shrink-0 rounded-[5px] bg-white/15 px-1.5 py-px font-sans text-[10.5px] font-semibold tracking-wide text-white/75">
                  {shortcut}
                </kbd>
              )}
            </span>
            {description && (
              <span className="relative mt-0.5 block text-[11px] leading-snug text-white/60">{description}</span>
            )}
          </div>,
          document.body,
        )}
    </span>
  )
}

// ── Buttons ──

export function Divider() {
  return <div className="mx-1.5 h-4 w-px bg-line-strong" />
}

export function ToolbarButton({
  onClick,
  disabled,
  active,
  danger,
  title,
  shortcut,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  danger?: boolean
  title: string
  shortcut?: string
  children: ReactNode
}) {
  const tone = active
    ? 'bg-surface text-accent shadow-soft ring-1 ring-accent-line'
    : danger
      ? 'text-ink-muted enabled:hover:bg-danger-soft enabled:hover:text-danger'
      : 'text-ink-muted enabled:hover:bg-hover enabled:hover:text-ink'
  return (
    <Tooltip label={title} shortcut={shortcut}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className={`flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-150 enabled:active:scale-90 disabled:opacity-30 ${tone}`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export function SidebarButton({
  onClick,
  label,
  hint,
  shortcut,
  active = false,
  children,
}: {
  onClick: () => void
  label: string
  hint: string
  shortcut?: string
  /** Pressed state, e.g. while its panel is open */
  active?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip label={hint} shortcut={shortcut} side="right">
      <button
        onClick={onClick}
        aria-pressed={active}
        className={`group flex w-[54px] flex-col items-center gap-1 rounded-xl py-2 transition-colors duration-150 hover:text-accent ${
          active ? 'text-accent' : 'text-ink-muted'
        }`}
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 group-hover:shadow-soft group-active:scale-95 ${
            active ? 'bg-accent text-white shadow-accent group-hover:bg-accent-hover' : 'bg-surface-2 group-hover:bg-accent-soft'
          }`}
        >
          {children}
        </span>
        <span className="text-[10.5px] font-medium leading-tight">{label}</span>
      </button>
    </Tooltip>
  )
}

export function AlignButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <Tooltip label={title} side="top">
      <button
        onClick={onClick}
        aria-label={title}
        className="flex h-8 w-8 items-center justify-center rounded-[10px] text-ink-muted transition-all duration-150 hover:bg-surface hover:text-accent hover:shadow-soft"
      >
        {children}
      </button>
    </Tooltip>
  )
}

// ── Collapsible sidebar section ──

const COLLAPSE_KEY = 'pod-editor:collapsed:'

/** Make a section start expanded next time it mounts (e.g. when the panel reopens on it). */
export function expandPanelSection(id: string) {
  try {
    localStorage.setItem(COLLAPSE_KEY + id, '0')
  } catch {}
  // Sections already on screen unfold too
  window.dispatchEvent(new CustomEvent(EXPAND_EVENT, { detail: id }))
}

const EXPAND_EVENT = 'pod-editor:expand-section'

function readCollapsed(id: string) {
  try {
    return localStorage.getItem(COLLAPSE_KEY + id) === '1'
  } catch {
    return false
  }
}

/** Sidebar block with a clickable header that folds its content; the choice is remembered per section. */
export function PanelSection({
  id,
  icon,
  title,
  count,
  right,
  children,
}: {
  id: string
  icon: ReactNode
  title: string
  count?: number
  right?: ReactNode
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id))
  useEffect(() => {
    const onExpand = (e: Event) => (e as CustomEvent<string>).detail === id && setCollapsed(false)
    window.addEventListener(EXPAND_EVENT, onExpand)
    return () => window.removeEventListener(EXPAND_EVENT, onExpand)
  }, [id])
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY + id, c ? '0' : '1')
      } catch {}
      return !c
    })
  }

  return (
    <div data-panel-section={id} className="border-b border-line/70 px-4 py-3">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <button
          onClick={toggle}
          aria-expanded={!collapsed}
          className="group/sec -mx-1.5 flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle transition-colors hover:text-ink-muted"
        >
          <span>{icon}</span>
          <span className="truncate">{title}</span>
          {!!count && (
            <span className="ml-0.5 rounded-full bg-accent-soft px-1.5 py-px text-[10.5px] font-semibold leading-4 tracking-normal text-accent tabular-nums">
              {count}
            </span>
          )}
          <IcChevronDown
            className={`ml-0.5 h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 group-hover/sec:opacity-100 ${
              collapsed ? '-rotate-90' : ''
            }`}
          />
        </button>
        {right}
      </div>
      {/* grid-rows 0fr ↔ 1fr animates to the content's natural height */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        }`}
        inert={collapsed}
      >
        {/* clip only while folded, so drop indicators / focus rings aren't cut when open */}
        <div className={`min-h-0 min-w-0 ${collapsed ? 'overflow-hidden' : ''}`}>
          <div className="pt-2.5 pb-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ── Slider + editable value ──

export function Slider({
  value,
  min,
  max,
  step = 1,
  centered = false,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  /** Fill from the middle (0) toward the value, for ranges like -100…100 */
  centered?: boolean
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  const from = centered ? Math.min(50, pct) : 0
  const to = centered ? Math.max(50, pct) : pct
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer rounded-full"
      style={{
        background: `linear-gradient(to right, var(--color-hover) ${from}%, var(--color-accent) ${from}%, var(--color-accent) ${to}%, var(--color-hover) ${to}%)`,
      }}
    />
  )
}

/** Compact number box: shows a setting's value and lets you type an exact one. */
export function ValueInput({
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  id,
}: {
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  id?: string
}) {
  // What's being typed ("-", "1.", "") stays as text until it's a number worth applying
  const [draft, setDraft] = useState<string | null>(null)
  const decimals = step < 1 ? String(step).split('.')[1]?.length ?? 2 : 0
  const shown = draft ?? (decimals ? value.toFixed(decimals) : String(value))
  const commit = (text: string) => {
    const n = Number(text)
    if (text === '' || text === '-' || !Number.isFinite(n)) return
    onChange(Math.max(min, Math.min(max, n)))
  }
  return (
    <span className="flex h-6 items-center overflow-hidden rounded-md border border-line bg-surface transition-colors focus-within:border-accent">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value)
          commit(e.target.value)
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-full w-12 bg-transparent px-1.5 text-right text-[11.5px] font-semibold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {unit && <span className="pr-1.5 text-[10.5px] font-medium text-ink-subtle">{unit}</span>}
    </span>
  )
}

/** Label + exact value box on one line, slider below — the standard numeric setting. */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  centered,
  onChange,
  children,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  centered?: boolean
  onChange: (v: number) => void
  /** Extra content under the slider */
  children?: ReactNode
}) {
  const id = useId()
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-medium text-ink-muted">
          {label}
        </label>
        <ValueInput id={id} value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} />
      </div>
      <Slider value={value} min={min} max={max} step={step} centered={centered} onChange={onChange} />
      {children}
    </div>
  )
}
