'use client'

import { useMemo, useState } from 'react'
import { IcChevronLeft, IcElements, IcPlus, IcSearch, IcX } from '@/components/icons'
import { ELEMENT_CATEGORIES, arcPath, type ElementCategory, type ElementItem, type TextPart } from '../elements/library'
import { Tooltip } from './ui'

/** Items shown per category in the overview; the rest sit behind "Show more". */
const PREVIEW_COUNT = 6

type Filter = 'all' | 'art' | 'icons' | 'shapes' | 'text'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'art', label: 'Artwork' },
  { id: 'icons', label: 'Icons' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'text', label: 'Text' },
]

const TEXT_CATEGORIES = ['curved', 'text']

/** The category's items that match the filter (empty = hide the category). */
function filterItems(category: ElementCategory, filter: Filter): ElementItem[] {
  const isTheme = category.id !== 'shapes' && !TEXT_CATEGORIES.includes(category.id)
  switch (filter) {
    case 'art':
      return isTheme ? category.items.filter((i) => i.kind === 'svg' && i.art) : []
    case 'icons':
      return isTheme ? category.items.filter((i) => !(i.kind === 'svg' && i.art)) : []
    case 'shapes':
      return category.id === 'shapes' ? category.items : []
    case 'text':
      return TEXT_CATEGORIES.includes(category.id) ? category.items : []
    default:
      return category.items
  }
}

interface ElementsPanelProps {
  onAdd: (item: ElementItem) => void
  onClose: () => void
}

// ── Previews ──

function TextPartPreview({ part, index, itemId }: { part: TextPart; index: number; itemId: string }) {
  const common = {
    fontFamily: `"${part.font}"`,
    fontSize: part.size,
    fill: part.fill,
    fontWeight: part.weight === 'bold' ? 700 : 400,
    fontStyle: part.italic ? 'italic' : 'normal',
    letterSpacing: `${(part.spacing ?? 0) / 1000}em`,
    stroke: part.stroke,
    strokeWidth: part.strokeWidth,
    paintOrder: 'stroke' as const,
  }
  if (!part.curve) {
    return (
      <text x={100} y={part.y} textAnchor="middle" {...common}>
        {part.text}
      </text>
    )
  }
  // Same arc as on the canvas; width guess ≈ 0.75 em per glyph + spacing
  const length = part.text.length * part.size * (0.75 + (part.spacing ?? 0) / 1000)
  const id = `arc-${itemId}-${index}`
  return (
    <>
      <path id={id} d={arcPath(part.curve, length)} transform={`translate(100 ${part.y})`} fill="none" />
      <text {...common} dominantBaseline={part.curve > 0 ? 'hanging' : 'text-after-edge'}>
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {part.text}
        </textPath>
      </text>
    </>
  )
}

function ItemPreview({ item }: { item: ElementItem }) {
  if (item.kind === 'svg') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}`}
        alt=""
        draggable={false}
        className={`h-full w-full object-contain ${item.art ? 'p-[7%]' : 'p-[14%]'}`}
      />
    )
  }
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      {item.parts.map((part, i) => (
        <TextPartPreview key={i} part={part} index={i} itemId={item.id} />
      ))}
    </svg>
  )
}

function ItemTile({ item, onAdd }: { item: ElementItem; onAdd: (item: ElementItem) => void }) {
  return (
    <Tooltip label={item.name} description="Click to add" side="top">
      <button
        onClick={() => onAdd(item)}
        aria-label={`Add ${item.name}`}
        className="block aspect-square w-full overflow-hidden rounded-xl border border-line bg-[conic-gradient(var(--color-checker)_25%,#ffffff_0_50%,var(--color-checker)_0_75%,#ffffff_0)] bg-[length:14px_14px] transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-line hover:shadow-soft active:scale-95"
      >
        <ItemPreview item={item} />
      </button>
    </Tooltip>
  )
}

function CategoryHeader({ category, action }: { category: ElementCategory; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[13.5px] font-semibold text-ink">
        {category.title}
        {category.badge && (
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-muted ring-1 ring-line">
            {category.badge}
          </span>
        )}
      </h3>
      {action}
    </div>
  )
}

// ── Panel ──

/** Built-in library: editable shapes, text presets and themed illustration sets. */
export default function ElementsPanel({ onAdd, onClose }: ElementsPanelProps) {
  const [query, setQuery] = useState('')
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const q = query.trim().toLowerCase()
  const results = useMemo(
    () =>
      q
        ? ELEMENT_CATEGORIES.flatMap((c) =>
            c.items.filter((i) => i.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)),
          )
        : [],
    [q],
  )
  const category = ELEMENT_CATEGORIES.find((c) => c.id === openCategory)
  const categoryItems = category ? filterItems(category, filter) : []
  const sections = ELEMENT_CATEGORIES.map((c) => ({ category: c, items: filterItems(c, filter) })).filter(
    (s) => s.items.length > 0,
  )

  return (
    <div
      data-stage-ui
      className="flex h-full w-[300px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float animate-[fade-in_150ms_ease-out]"
    >
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <IcElements className="h-4 w-4 text-accent" />
          Library
        </h2>
        <Tooltip label="Close" shortcut="Esc" side="left">
          <button
            onClick={onClose}
            aria-label="Close library"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <IcX className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>

      <div className="px-4 pb-3">
        <label className="flex h-9 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-ink-muted transition-colors focus-within:border-accent-line focus-within:bg-surface">
          <IcSearch className="h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shapes, text, themes…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="text-ink-subtle hover:text-ink">
              <IcX className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        {!q && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFilter(f.id)
                  setOpenCategory(null)
                }}
                aria-pressed={filter === f.id}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                  filter === f.id ? 'bg-accent text-white shadow-accent' : 'bg-surface-2 text-ink-muted hover:bg-accent-soft hover:text-accent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {q ? (
          results.length ? (
            <div className="grid grid-cols-3 gap-2">
              {results.map((item) => (
                <ItemTile key={item.id} item={item} onAdd={onAdd} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-[12.5px] text-ink-muted">No elements match “{query}”</p>
          )
        ) : category ? (
          <div>
            <button
              onClick={() => setOpenCategory(null)}
              className="-ml-1 mb-2 flex items-center gap-1 rounded-lg px-1 py-0.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-accent"
            >
              <IcChevronLeft className="h-3.5 w-3.5" />
              All
            </button>
            <CategoryHeader category={category} />
            <div className="grid grid-cols-3 gap-2">
              {categoryItems.map((item) => (
                <ItemTile key={item.id} item={item} onAdd={onAdd} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {sections.map(({ category: c, items }) => (
              <section key={c.id} className="py-3.5 first:pt-1">
                <CategoryHeader
                  category={c}
                  action={
                    items.length > PREVIEW_COUNT && (
                      <button
                        onClick={() => setOpenCategory(c.id)}
                        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-0.5 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent"
                      >
                        <IcPlus className="h-3.5 w-3.5" />
                        Show more
                      </button>
                    )
                  }
                />
                <div className="grid grid-cols-3 gap-2">
                  {items.slice(0, PREVIEW_COUNT).map((item) => (
                    <ItemTile key={item.id} item={item} onAdd={onAdd} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
