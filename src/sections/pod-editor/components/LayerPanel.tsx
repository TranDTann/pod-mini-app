import { useState } from 'react'
import { IcGrip, IcEye, IcEyeOff, IcLayers, IcLock, IcTrashSmall, IcUnlock } from '@/components/icons'
import type { LayerInfo } from '../types'
import { PanelSection, Tooltip } from './ui'

interface LayerPanelProps {
  layers: LayerInfo[]
  selectedLayerId: number | null
  onSelectLayer: (id: number) => void
  onDeleteLayer: (id: number) => void
  onToggleVisible: (id: number) => void
  onToggleLock: (id: number) => void
  /** Move a layer to `index` in `layers` order (0 = bottom-most) */
  onReorder: (id: number, index: number) => void
}

function LayerAction({
  title,
  onClick,
  pinned,
  danger,
  children,
}: {
  title: string
  onClick: () => void
  pinned?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip label={title} side="top">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        aria-label={title}
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-all hover:bg-surface ${
          pinned ? 'text-accent opacity-100' : 'text-ink-subtle opacity-0 group-hover:opacity-100'
        } ${danger ? 'hover:text-danger' : 'hover:text-ink'}`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export default function LayerPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onDeleteLayer,
  onToggleVisible,
  onToggleLock,
  onReorder,
}: LayerPanelProps) {
  // Rows are shown top-most first; `dropSlot` = row index the dragged layer would be inserted before
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropSlot, setDropSlot] = useState<number | null>(null)
  const rows = [...layers].reverse()

  const endDrag = () => {
    setDragId(null)
    setDropSlot(null)
  }
  const drop = () => {
    const from = rows.findIndex((l) => l.id === dragId)
    if (dragId === null || from < 0 || dropSlot === null) return endDrag()
    const to = dropSlot > from ? dropSlot - 1 : dropSlot
    if (to !== from) onReorder(dragId, rows.length - 1 - to)
    endDrag()
  }

  return (
    <PanelSection
      id="layers"
      icon={<IcLayers className="h-3.5 w-3.5" />}
      title="Layers"
      count={layers.length}
    >
      {layers.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-center">
          <IcLayers className="h-5 w-5 text-ink-subtle" />
          <p className="text-[12px] font-medium text-ink-muted">No layers yet</p>
          <p className="text-[11px] text-ink-subtle">Upload an image or add text to start</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropSlot(null)}>
          {rows.map((layer, i) => {
            const isSelected = selectedLayerId === layer.id
            const isDragging = dragId === layer.id
            return (
              <div
                key={layer.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(layer.id))
                  setDragId(layer.id)
                }}
                onDragOver={(e) => {
                  if (dragId === null) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  const r = e.currentTarget.getBoundingClientRect()
                  setDropSlot(e.clientY < r.top + r.height / 2 ? i : i + 1)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  drop()
                }}
                onDragEnd={endDrag}
                onClick={() => onSelectLayer(layer.id)}
                className={`group relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-2 py-1.5 transition-colors active:cursor-grabbing ${
                  isSelected ? 'border-accent-line/70 bg-accent-soft' : 'border-transparent hover:bg-surface-2'
                } ${isDragging ? 'opacity-40' : ''}`}
              >
                {/* Drop indicator: a line in the gap above / below this row */}
                {dragId !== null && (dropSlot === i || (dropSlot === rows.length && i === rows.length - 1)) && (
                  <span
                    className={`pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-accent ${
                      dropSlot === i ? '-top-[3px]' : '-bottom-[3px]'
                    }`}
                  />
                )}
                {/* Drag handle — the whole row is draggable, this just signals it */}
                <span
                  aria-hidden
                  className={`-ml-1 -mr-1.5 flex w-3.5 shrink-0 cursor-grab justify-center transition-colors active:cursor-grabbing ${
                    isSelected ? 'text-accent/60' : 'text-ink-subtle/60 group-hover:text-ink-muted'
                  }`}
                >
                  <IcGrip className="h-4 w-4" />
                </span>
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[conic-gradient(var(--color-checker)_25%,#ffffff_0_50%,var(--color-checker)_0_75%,#ffffff_0)] bg-[length:10px_10px] ${
                    isSelected ? 'border-accent-line' : 'border-line'
                  } ${layer.visible ? '' : 'opacity-40'}`}
                >
                  {layer.type === 'i-text' ? (
                    <span className="font-serif text-sm font-bold text-ink-muted">T</span>
                  ) : layer.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={layer.thumbnail} alt="" className="h-full w-full object-contain" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] font-medium ${layer.visible ? 'text-ink' : 'text-ink-subtle line-through'}`}>
                    {layer.name}
                  </p>
                  <p className="text-[10.5px] text-ink-subtle">{layer.type === 'i-text' ? 'Text' : layer.type === 'image' ? 'Image' : 'Element'}</p>
                </div>
                <div className="flex items-center">
                  <LayerAction title={layer.locked ? 'Unlock' : 'Lock'} pinned={layer.locked} onClick={() => onToggleLock(layer.id)}>
                    {layer.locked ? <IcLock className="h-3.5 w-3.5" /> : <IcUnlock className="h-3.5 w-3.5" />}
                  </LayerAction>
                  <LayerAction title={layer.visible ? 'Hide' : 'Show'} pinned={!layer.visible} onClick={() => onToggleVisible(layer.id)}>
                    {layer.visible ? <IcEye className="h-3.5 w-3.5" /> : <IcEyeOff className="h-3.5 w-3.5" />}
                  </LayerAction>
                  <LayerAction title="Delete layer" danger onClick={() => onDeleteLayer(layer.id)}>
                    <IcTrashSmall className="h-3.5 w-3.5" />
                  </LayerAction>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PanelSection>
  )
}
