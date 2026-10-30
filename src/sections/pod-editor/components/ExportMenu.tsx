'use client'

import { useEffect, useRef, useState } from 'react'
import { IcCheck, IcChevronDown, IcDownload, IcImage, IcTransform } from '@/components/icons'

type ExportKind = 'print' | 'full'

interface ExportMenuProps {
  onExportDesign: () => void
  /** Export the print-area design of these sides (one file each) */
  onExportPrintArea: (indexes: number[]) => void
  /** Print side names (empty when the template has no print area) */
  printAreas: string[]
  activeIndex: number
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
        checked ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface'
      }`}
    >
      {checked && <IcCheck className="h-3 w-3" />}
    </span>
  )
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
        checked ? 'border-accent' : 'border-line-strong bg-surface'
      }`}
    >
      {checked && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
    </span>
  )
}

/**
 * Export popover. Two clearly separate outputs:
 * - Design only: the artwork inside the print area, cropped & transparent — the file for printing,
 *   with a checkbox per print side.
 * - Full design: the whole artboard as seen in the editor (mockup + design).
 */
export default function ExportMenu({ onExportDesign, onExportPrintArea, printAreas, activeIndex }: ExportMenuProps) {
  const hasPrintAreas = printAreas.length > 0
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ExportKind>(hasPrintAreas ? 'print' : 'full')
  const [sides, setSides] = useState<number[]>([activeIndex])
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleOpen = () => {
    if (!open) {
      // Start from the side being edited each time
      setKind(hasPrintAreas ? 'print' : 'full')
      setSides(hasPrintAreas ? [Math.min(activeIndex, printAreas.length - 1)] : [])
    }
    setOpen((v) => !v)
  }

  const toggleSide = (index: number) =>
    setSides((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)))
  const allChecked = sides.length === printAreas.length

  const canExport = kind === 'full' || sides.length > 0
  const exportLabel = kind === 'full' ? 'Download PNG' : sides.length > 1 ? `Download ${sides.length} PNGs` : 'Download PNG'

  const submit = () => {
    if (!canExport) return
    setOpen(false)
    if (kind === 'full') onExportDesign()
    else onExportPrintArea(sides)
  }

  const optionClass = (active: boolean) =>
    `flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
      active ? 'border-accent-line bg-accent-soft/60' : 'border-line hover:bg-surface-2'
    } disabled:cursor-not-allowed disabled:opacity-45`

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl bg-linear-to-b from-[#3cb47f] to-accent py-2 pl-4 pr-3 text-[13px] font-semibold text-white shadow-accent transition-all hover:-translate-y-px hover:bg-accent-hover active:scale-95"
      >
        <IcDownload className="h-4 w-4" />
        Export PNG
        <IcChevronDown className={`h-3.5 w-3.5 opacity-80 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Export"
          className="absolute right-0 top-full z-[700] mt-2 w-[320px] rounded-2xl border border-line bg-surface p-3 shadow-float animate-[fade-in_120ms_ease-out]"
        >
          <p className="px-1 pb-2 text-[13px] font-semibold text-ink">What do you want to export?</p>

          <div className="flex flex-col gap-2">
            {/* Design only (print file) */}
            <div>
              <button
                onClick={() => setKind('print')}
                disabled={!hasPrintAreas}
                aria-pressed={kind === 'print'}
                className={optionClass(kind === 'print')}
              >
                <Radio checked={kind === 'print'} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <IcTransform className="h-3.5 w-3.5 text-accent" />
                    Design only
                    <span className="rounded-full bg-accent px-1.5 text-[9.5px] font-semibold uppercase leading-4 tracking-wide text-white">
                      Print file
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
                    {hasPrintAreas
                      ? 'Only your artwork inside the print area — cropped, transparent background, print resolution.'
                      : 'This template has no print area.'}
                  </span>
                </span>
              </button>

              {kind === 'print' && hasPrintAreas && (
                <div className="mt-1.5 rounded-xl bg-surface-2/70 p-1.5">
                  <div className="flex items-center justify-between px-1.5 pb-1 pt-0.5">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">Print sides</span>
                    {printAreas.length > 1 && (
                      <button
                        onClick={() => setSides(allChecked ? [] : printAreas.map((_, i) => i))}
                        className="text-[11.5px] font-semibold text-accent hover:underline"
                      >
                        {allChecked ? 'Clear' : 'Select all'}
                      </button>
                    )}
                  </div>
                  {printAreas.map((name, index) => (
                    <button
                      key={name + index}
                      onClick={() => toggleSide(index)}
                      role="checkbox"
                      aria-checked={sides.includes(index)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface"
                    >
                      <Checkbox checked={sides.includes(index)} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{name}</span>
                      {index === activeIndex && (
                        <span className="shrink-0 rounded-full bg-surface px-1.5 text-[10px] font-medium text-ink-muted ring-1 ring-line">
                          Editing
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Full design (what you see) */}
            <button onClick={() => setKind('full')} aria-pressed={kind === 'full'} className={optionClass(kind === 'full')}>
              <Radio checked={kind === 'full'} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <IcImage className="h-3.5 w-3.5 text-ink-muted" />
                  Full design
                  <kbd className="rounded bg-surface-2 px-1 text-[10px] font-medium text-ink-subtle ring-1 ring-line">Ctrl E</kbd>
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
                  The whole artboard as you see it — product mockup and design together, 2×.
                </span>
              </span>
            </button>
          </div>

          <button
            onClick={submit}
            disabled={!canExport}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[13px] font-semibold text-white shadow-accent transition-all enabled:hover:bg-accent-hover enabled:active:scale-[0.98] disabled:opacity-50"
          >
            <IcDownload className="h-4 w-4" />
            {canExport ? exportLabel : 'Select at least one side'}
          </button>
        </div>
      )}
    </div>
  )
}
