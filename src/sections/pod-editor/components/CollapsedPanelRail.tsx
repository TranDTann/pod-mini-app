import type { ReactNode } from 'react'
import { IcChevronLeft } from '@/components/icons'
import { Tooltip } from './ui'

export interface RailItem {
  /** PanelSection id to reveal */
  id: string
  label: string
  icon: ReactNode
  count?: number
  /** Draws attention, e.g. settings for the element that was just selected */
  highlight?: boolean
}

/**
 * Slim stand-in for the hidden side panel: a clear "open" handle plus one button
 * per section, so users still see where the settings went and can jump straight in.
 */
export default function CollapsedPanelRail({ items, onOpen }: { items: RailItem[]; onOpen: (sectionId?: string) => void }) {
  return (
    <div className="flex w-[52px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-line bg-surface py-2 shadow-soft animate-[fade-in_150ms_ease-out]">
      <Tooltip label="Show side panel" shortcut="Ctrl ." side="left">
        <button
          onClick={() => onOpen()}
          aria-label="Show side panel"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent transition-all hover:bg-accent hover:text-white active:scale-95"
        >
          <IcChevronLeft className="h-4 w-4" />
        </button>
      </Tooltip>
      <div className="my-1 h-px w-6 bg-line" />
      {items.map((item) => (
        <Tooltip key={item.id} label={item.label} description="Open in side panel" side="left">
          <button
            onClick={() => onOpen(item.id)}
            aria-label={item.label}
            className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95 ${
              item.highlight ? 'bg-accent-soft text-accent ring-1 ring-accent-line' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {item.icon}
            {!!item.count && (
              <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[9.5px] font-semibold leading-4 text-white tabular-nums">
                {item.count}
              </span>
            )}
            {item.highlight && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
          </button>
        </Tooltip>
      ))}
      {/* Vertical label so the rail reads as "settings live here" */}
      <button
        onClick={() => onOpen()}
        className="mt-auto py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle transition-colors [writing-mode:vertical-rl] hover:text-accent"
      >
        Settings
      </button>
    </div>
  )
}
