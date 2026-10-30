import { IcDelete, IcDuplicate, IcReset } from '@/components/icons'
import { Tooltip } from './ui'

interface ElementActionsProps {
  kind: 'image' | 'text' | 'element'
  locked: boolean
  canReset: boolean
  onReset: () => void
  onDelete: () => void
  onDuplicate: () => void
  /** Print side names; with 2+ sides the element can be sent to another one */
  sides?: string[]
  currentSide?: number
  onSendToSide?: (side: number, copy?: boolean) => void
}

/** Footer of the element settings: reset to how it was added, or remove it. Sticks to the sidebar bottom. */
export default function ElementActions({
  kind, locked, canReset, onReset, onDelete, onDuplicate, sides = [], currentSide = 0, onSendToSide,
}: ElementActionsProps) {
  const noun = kind
  const others = sides.map((name, i) => ({ name, i })).filter((s) => s.i !== currentSide)
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
      {onSendToSide && others.length > 0 && (
        <div className="mb-2.5 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Send to side</span>
          {others.map(({ name, i }) => (
            <div key={i} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{name}</span>
              <Tooltip label={`Move to ${name}`} description="Removed from this side" side="top">
                <button
                  onClick={() => onSendToSide(i)}
                  disabled={locked}
                  className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-3 text-[12px] font-semibold text-ink transition-all enabled:hover:border-accent-line enabled:hover:bg-accent-soft enabled:hover:text-accent enabled:active:scale-[0.97] disabled:cursor-default disabled:opacity-40"
                >
                  Move
                </button>
              </Tooltip>
              <Tooltip label={`Copy to ${name}`} description="Kept on this side too" side="top">
                <button
                  onClick={() => onSendToSide(i, true)}
                  className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-3 text-[12px] font-semibold text-ink transition-all hover:border-accent-line hover:bg-accent-soft hover:text-accent active:scale-[0.97]"
                >
                  Copy
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[40px_1fr_auto] gap-2">
        <Tooltip label={`Duplicate ${kind}`} description="Or copy & paste it" shortcut="Ctrl D" side="top">
          <button
            onClick={onDuplicate}
            aria-label={`Duplicate ${kind}`}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-all hover:border-accent-line hover:bg-accent-soft hover:text-accent active:scale-95"
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
            className="flex h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 border border-line bg-surface text-[12.5px] font-semibold text-ink transition-all enabled:hover:border-accent-line enabled:hover:bg-accent-soft enabled:hover:text-accent enabled:active:scale-[0.98] disabled:opacity-40"
          >
            <IcReset className="h-4 w-4" />
            Reset origin
          </button>
        </Tooltip>
        <Tooltip label={`Delete ${noun}`} description={locked ? 'Unlock the element first' : undefined} shortcut="Del" side="top">
          <button
            onClick={onDelete}
            disabled={locked}
            className="flex h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 border border-danger/25 bg-danger-soft text-[12.5px] font-semibold text-danger transition-all enabled:hover:border-danger enabled:hover:bg-danger enabled:hover:text-white enabled:active:scale-[0.98] disabled:opacity-40"
          >
            <IcDelete className="h-4 w-4" />
            Delete
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
