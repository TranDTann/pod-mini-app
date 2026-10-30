import { useLayoutEffect, useRef, useState } from 'react'
import type { PrintArea } from '../types'
import { Tooltip } from './ui'

interface PrintAreaTabsProps {
  printAreas: PrintArea[]
  activeIndex: number
  onAreaChange: (index: number) => void
}

// Tab: 32px tall, rows separated by 4px gap, plus 4px padding top & bottom → 2 rows = 76px
const TAB_HEIGHT = 32
const ROW_GAP = 4
const PADDING = 4
const MAX_ROWS = 2
const MAX_HEIGHT = TAB_HEIGHT * MAX_ROWS + ROW_GAP * (MAX_ROWS - 1) + PADDING * 2

function PrintAreaTab({ name, isActive, onClick }: { name: string; isActive: boolean; onClick: () => void }) {
  const labelRef = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  // Only show the tooltip when the name is actually cut off
  useLayoutEffect(() => {
    const el = labelRef.current
    if (!el) return
    const check = () => setIsTruncated(el.scrollWidth > el.clientWidth)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [name])

  const button = (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      className={`flex h-8 max-w-[120px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold transition-all ${
        isActive ? 'bg-accent text-white shadow-accent' : 'text-ink-muted hover:bg-hover hover:text-ink'
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? 'bg-white' : 'bg-line-strong'}`} />
      <span ref={labelRef} className="min-w-0 truncate">
        {name}
      </span>
    </button>
  )

  return isTruncated ? (
    <Tooltip label={name} side="top">
      {button}
    </Tooltip>
  ) : (
    button
  )
}

export default function PrintAreaTabs({
  printAreas,
  activeIndex,
  onAreaChange,
}: PrintAreaTabsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Keep the active tab in view — scroll only the tab list, never the stage
  useLayoutEffect(() => {
    const list = listRef.current
    const tab = activeRef.current
    if (!list || !tab) return
    const top = tab.offsetTop - PADDING
    const bottom = tab.offsetTop + tab.offsetHeight + PADDING
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
  }, [activeIndex])

  if (printAreas.length === 0) return null

  return (
    <div
      ref={listRef}
      className="relative flex max-w-[min(560px,calc(100vw-760px))] min-w-[140px] flex-wrap justify-center gap-1 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface/90 p-1 shadow-float backdrop-blur [scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent]"
      style={{ maxHeight: MAX_HEIGHT }}
    >
      {printAreas.map((area, index) => (
        <div key={`${area.name}-${index}`} ref={index === activeIndex ? activeRef : undefined} className="flex">
          <PrintAreaTab name={area.name} isActive={index === activeIndex} onClick={() => onAreaChange(index)} />
        </div>
      ))}
    </div>
  )
}
