'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { IcChevronLeft, IcChevronRight, IcElements, IcSearch, IcX } from '@/components/icons'
import { ELEMENT_CATEGORIES, arcPath, type ElementCategory, type ElementItem, type TextPart } from '../elements/library'
import { Tooltip } from './ui'

/** Items shown per category in the overview (besides its scenes); the rest sit behind "Show more". */
const PREVIEW_COUNT = 6

/** Combined width / height of a row of scenes: a wide + a tall one, or three tall ones. */
const SCENE_ROW_ASPECT = 2.25

type Filter = 'all' | 'landscapes' | 'people' | 'art' | 'icons' | 'shapes' | 'text'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'landscapes', label: 'Landscapes' },
  { id: 'people', label: 'People' },
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
    case 'landscapes':
      return category.items.filter((i) => i.kind === 'svg' && i.scene === 'landscape')
    case 'people':
      return category.items.filter((i) => i.kind === 'svg' && i.scene === 'people')
    case 'art':
      return isTheme ? category.items.filter((i) => i.kind === 'svg' && i.art) : []
    case 'icons':
      return isTheme ? category.items.filter((i) => !(i.kind === 'svg' && (i.art || i.scene))) : []
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
        className={`h-full w-full object-contain ${item.scene ? '' : item.art ? 'p-[7%]' : 'p-[14%]'}`}
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

const sceneAspect = (item: ElementItem) => (item.kind === 'svg' && item.scene ? (item.aspect ?? 1) : 0)

function ItemTile({ item, onAdd }: { item: ElementItem; onAdd: (item: ElementItem) => void }) {
  const aspect = sceneAspect(item)
  return (
    <Tooltip label={item.name} description="Click to add" side="top" block={!!aspect}>
      <button
        onClick={() => onAdd(item)}
        aria-label={`Add ${item.name}`}
        style={aspect ? { aspectRatio: aspect } : undefined}
        className="block aspect-square w-full overflow-hidden rounded-xl border border-line bg-[conic-gradient(var(--color-checker)_25%,#ffffff_0_50%,var(--color-checker)_0_75%,#ffffff_0)] bg-[length:14px_14px] transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-line hover:shadow-soft active:scale-95"
      >
        <ItemPreview item={item} />
      </button>
    </Tooltip>
  )
}

/** Greedily packs scenes into rows whose aspects add up to about SCENE_ROW_ASPECT. */
function sceneRows(scenes: ElementItem[]) {
  const rows: ElementItem[][] = []
  let sum = Infinity
  for (const item of scenes) {
    const a = sceneAspect(item)
    if (sum + a > SCENE_ROW_ASPECT + 0.01) {
      rows.push([])
      sum = 0
    }
    rows[rows.length - 1].push(item)
    sum += a
  }
  return rows
}

/**
 * Scenes as justified rows (each tile grows by its aspect, so a row shares one
 * height; short rows are padded), then everything else in a 3-column grid.
 */
function ItemGrid({ items, onAdd }: { items: ElementItem[]; onAdd: (item: ElementItem) => void }) {
  const scenes = items.filter(sceneAspect)
  const tiles = items.filter((i) => !sceneAspect(i))
  return (
    <div className="flex flex-col gap-2">
      {sceneRows(scenes).map((row) => {
        const rest = SCENE_ROW_ASPECT - row.reduce((sum, i) => sum + sceneAspect(i), 0)
        return (
          <div key={row[0].id} className="flex gap-2">
            {row.map((item) => (
              <div key={item.id} className="min-w-0" style={{ flex: `${sceneAspect(item)} 1 0%` }}>
                <ItemTile item={item} onAdd={onAdd} />
              </div>
            ))}
            {rest > 0.01 && <div style={{ flex: `${rest} 1 0%` }} />}
          </div>
        )
      })}
      {tiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((item) => (
            <ItemTile key={item.id} item={item} onAdd={onAdd} />
          ))}
        </div>
      )}
    </div>
  )
}

/** A category's items split into labelled groups (scenes, artworks, icons…). */
function itemGroups(items: ElementItem[]) {
  const groups = [
    { label: 'Scenes', items: items.filter(sceneAspect) },
    { label: 'Artwork', items: items.filter((i) => i.kind === 'svg' && i.art) },
    { label: 'Icons', items: items.filter((i) => !sceneAspect(i) && !(i.kind === 'svg' && i.art)) },
  ].filter((g) => g.items.length > 0)
  // A single kind of item (shapes, text…) needs no group labels
  return groups.length > 1 ? groups : [{ label: '', items }]
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
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Overview scroll position, restored when coming back from a category */
  const overviewScroll = useRef(0)

  const openCategoryView = (id: string) => {
    overviewScroll.current = scrollRef.current?.scrollTop ?? 0
    setOpenCategory(id)
  }

  // Esc steps back out of a category before it closes the panel
  useEffect(() => {
    if (!openCategory) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as HTMLElement | null)?.closest('input, textarea')) return
      e.stopPropagation()
      setOpenCategory(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openCategory])

  // A category opens at its top; going back returns to where "Show more" was clicked
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = openCategory ? 0 : overviewScroll.current
  }, [openCategory])

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
      className="flex h-full w-[300px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
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
        {!q && category && (
          <button
            onClick={() => setOpenCategory(null)}
            aria-label="Back to all categories"
            className="group mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2 py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-accent-line hover:bg-accent-soft"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink shadow-soft ring-1 ring-line transition-colors group-hover:text-accent">
              <IcChevronLeft className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-medium leading-tight text-ink-muted group-hover:text-accent">All categories</span>
              <span className="truncate text-[14px] font-semibold leading-snug text-ink">{category.title}</span>
            </span>
            <span className="shrink-0 text-[11.5px] font-medium text-ink-muted">
              {categoryItems.length} {filter === 'all' ? 'items' : FILTERS.find((f) => f.id === filter)?.label.toLowerCase()}
            </span>
          </button>
        )}
        {!q && !category && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFilter(f.id)
                  setOpenCategory(null)
                  overviewScroll.current = 0
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

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {q ? (
          results.length ? (
            <ItemGrid items={results} onAdd={onAdd} />
          ) : (
            <p className="py-10 text-center text-[12.5px] text-ink-muted">No elements match “{query}”</p>
          )
        ) : category ? (
          <div className="flex flex-col gap-4 pt-1">
            {itemGroups(categoryItems).map((g) => (
              <section key={g.label}>
                {g.label && (
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{g.label}</h4>
                )}
                <ItemGrid items={g.items} onAdd={onAdd} />
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {sections.map(({ category: c, items }) => {
              const scenes = items.filter(sceneAspect)
              const others = items.filter((i) => !sceneAspect(i))
              return (
                <section key={c.id} className="py-3.5 first:pt-1">
                  <CategoryHeader
                    category={c}
                    action={
                      others.length > PREVIEW_COUNT && (
                        <button
                          onClick={() => openCategoryView(c.id)}
                          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-0.5 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent"
                        >
                          See all
                          <IcChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )
                    }
                  />
                  <ItemGrid items={[...scenes, ...others.slice(0, PREVIEW_COUNT)]} onAdd={onAdd} />
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
