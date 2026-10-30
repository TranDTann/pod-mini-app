import { IcDelete, IcDuplicate, IcReset } from '@/components/icons'
import { Tooltip } from './ui'

interface ElementActionsProps {
  kind: 'image' | 'text' | 'element'
  locked: boolean
  canReset: boolean
  onReset: () => void
  onDelete: () => void
  onDuplicate: () => void
}

/** Footer of the element settings: reset to how it was added, or remove it. Sticks to the sidebar bottom. */
export default function ElementActions({ kind, locked, canReset, onReset, onDelete, onDuplicate }: ElementActionsProps) {
  const noun = kind
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
      <div className="grid grid-cols-[36px_1fr_1fr] gap-2">
        <Tooltip label={`Duplicate ${kind}`} description="Or copy & paste it" shortcut="Ctrl D" side="top">
          <button
            onClick={onDuplicate}
            aria-label={`Duplicate ${kind}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-all hover:border-accent-line hover:bg-accent-soft hover:text-accent active:scale-95"
          >
            <IcDuplicate className="h-4 w-4" />
          </button>
        </Tooltip>
        <Tooltip
          label="Reset to origin"
          description={
            locked ? 'Unlock the element first' : canReset ? 'Position, size, rotation & style as when added' : 'No changes to reset'
          }
          shortcut="⇧ R"
          side="top"
        >
          <button
            onClick={onReset}
            disabled={locked || !canReset}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[12.5px] font-semibold text-ink transition-all enabled:hover:border-accent-line enabled:hover:bg-accent-soft enabled:hover:text-accent enabled:active:scale-[0.98] disabled:opacity-40"
          >
            <IcReset className="h-4 w-4" />
            Reset origin
          </button>
        </Tooltip>
        <Tooltip label={`Delete ${noun}`} description={locked ? 'Unlock the element first' : undefined} shortcut="Del" side="top">
          <button
            onClick={onDelete}
            disabled={locked}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft text-[12.5px] font-semibold text-danger transition-all enabled:hover:border-danger enabled:hover:bg-danger enabled:hover:text-white enabled:active:scale-[0.98] disabled:opacity-40"
          >
            <IcDelete className="h-4 w-4" />
            Delete {noun}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
