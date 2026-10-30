'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IcDownload, IcPlus, IcMockup, IcX } from '@/components/icons'
import type { MockupPsd } from '../types'
import { renderMockup } from '../utils/mockup'
import { ColorSwatches } from './PrintAreaColors'
import { Tooltip } from './ui'
import { useZoomPan, ZoomPanControls, ZoomPanStage } from './ZoomPanViewer'
import UploadProgress from './UploadProgress'
import type { UploadTask } from '../hooks/useUploadProgress'

/** 'design' = the flat artboard, otherwise a mockup id */
export type PreviewTarget = 'design' | number

interface PreviewDialogProps {
  templateName: string
  /** Flat artboard render of the active side */
  designUrl: string
  designLabel: string
  mockups: MockupPsd[]
  initialTarget: PreviewTarget
  /** Print side whose design is placed into the mockups (the one being edited) */
  side: number
  /** Transparent render of one side's print area, placed into the mockup */
  renderSide: (index: number) => string
  onUploadMockup: () => void
  /** Mockup PSD being uploaded — shown in place of the "Add mockup" button */
  mockupUpload: UploadTask | null
  onClose: () => void
}

/** Labelled option group; the current value sits in the label row so the controls never shift. */
function FooterField({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
        {label}
        {value && <span className="max-w-[140px] truncate normal-case tracking-normal text-[11.5px] font-medium text-ink-muted">· {value}</span>}
      </span>
      <div className="flex h-8 items-center">{children}</div>
    </div>
  )
}

export default function PreviewDialog({
  templateName,
  designUrl,
  designLabel,
  mockups,
  initialTarget,
  side,
  renderSide,
  onUploadMockup,
  mockupUpload,
  onClose,
}: PreviewDialogProps) {
  const [target, setTarget] = useState<PreviewTarget>(initialTarget)
  const [colorByMockup, setColorByMockup] = useState<Record<number, string>>({})
  const [rendered, setRendered] = useState<{ key: string; url: string } | null>(null)

  // A removed mockup falls back to the flat design
  const mockup = target === 'design' ? null : mockups.find((m) => m.id === target) ?? null
  const colorName = mockup ? colorByMockup[mockup.id] ?? mockup.defaultColor : ''
  const renderKey = mockup ? `${mockup.id}|${side}|${colorName}` : 'design'
  // While a new color renders, keep showing the previous render of the same mockup
  const viewKey = mockup ? `${mockup.id}|${side}` : 'design'
  const sameView = rendered?.key.startsWith(`${viewKey}|`)
  const imageUrl = mockup ? (sameView ? rendered!.url : null) : designUrl || null
  // Switching mockup resets zoom to fit; a color change keeps zoom & pan
  const zp = useZoomPan(viewKey)
  const isUploading = !!mockupUpload && mockupUpload.status !== 'done' && mockupUpload.status !== 'error'

  useEffect(() => {
    if (!mockup) return
    let cancelled = false
    // renderSide is heavy synchronous canvas work: start it after the dialog has painted
    // and its open animation is under way, so the popup appears instantly
    const timer = window.setTimeout(() => {
      if (cancelled) return
      renderMockup(mockup, renderSide(side), colorName).then((url) => {
        if (!cancelled) setRendered({ key: renderKey, url })
      })
    }, 60)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // renderKey captures mockup / color
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey])

  // Capture-phase listener so editor shortcuts don't fire behind the dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.target instanceof HTMLInputElement) return
      const key = e.key.toLowerCase()
      const handled = () => e.preventDefault()
      if (key === 'escape') return handled(), onClose()
      if (key === '+' || key === '=') return handled(), zp.zoomIn()
      if (key === '-') return handled(), zp.zoomOut()
      if (key === '0') return handled(), zp.fit()
      if (key === 'h') return handled(), zp.setPanMode(!zp.panMode)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, zp])

  const download = () => {
    if (!imageUrl) return
    const anchor = document.createElement('a')
    anchor.download = `${templateName}-${mockup ? `${mockup.name}-${colorName}` : 'design'}.png`
    anchor.href = imageUrl
    anchor.click()
  }

  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-xl border p-1.5 text-left transition-all ${
      active ? 'border-accent-line bg-accent-soft' : 'border-transparent hover:bg-surface-2'
    }`

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-ink/25 p-4 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        className="relative flex h-[min(820px,100%)] w-full max-w-[1180px] overflow-hidden rounded-3xl border border-line bg-surface shadow-float animate-[dialog-in_180ms_cubic-bezier(0.2,0.9,0.3,1.2)]"
      >
        <div className="absolute right-6 top-6 z-20">
          <Tooltip label="Close" shortcut="Esc" side="left">
            <button
              onClick={onClose}
              aria-label="Close preview"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface/90 text-ink-muted shadow-soft backdrop-blur transition-all hover:bg-danger-soft hover:text-danger active:scale-90"
            >
              <IcX className="h-4.5 w-4.5" />
            </button>
          </Tooltip>
        </div>

        {/* Left: what to preview on */}
        <aside className="flex w-[230px] shrink-0 flex-col border-r border-line bg-surface-2/50">
          <div className="px-4 pb-3 pt-5">
            <h2 id="preview-title" className="truncate text-[17px] font-bold leading-tight tracking-tight text-ink">
              Preview
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-ink-muted">{templateName}</p>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
            <p className="px-1.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">Design</p>
            <button onClick={() => setTarget('design')} className={itemClass(!mockup)}>
              {designUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data URL
                <img src={designUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line bg-white object-contain" />
              ) : (
                <span className="h-12 w-12 shrink-0 animate-pulse rounded-lg border border-line bg-surface-2" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold text-ink">Artboard</span>
                <span className="block truncate text-[11px] text-ink-muted">{designLabel}</span>
              </span>
            </button>

            <p className="px-1.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">Mockups</p>
            {mockups.map((m) => (
              <button key={m.id} onClick={() => setTarget(m.id)} className={itemClass(mockup?.id === m.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                <img src={m.thumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-ink">{m.name}</span>
                  <span className="block truncate text-[11px] text-ink-muted">
                    {m.colors.length ? `${m.colors.length} colors` : 'No colors'}
                  </span>
                </span>
              </button>
            ))}
            {/* The upload shows as the next list item; once done the new mockup takes its place */}
            {mockupUpload && mockupUpload.status !== 'done' && <UploadProgress task={mockupUpload} inline />}
            <button
              onClick={onUploadMockup}
              disabled={isUploading}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-line-strong p-1.5 text-left text-ink-muted transition-colors enabled:hover:border-accent-line enabled:hover:bg-accent-soft enabled:hover:text-accent disabled:opacity-50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface">
                <IcPlus className="h-4 w-4" />
              </span>
              <span className="text-[12.5px] font-semibold">{isUploading ? 'Adding mockup…' : 'Add mockup PSD'}</span>
            </button>
          </div>
        </aside>

        {/* Right: image + options */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="relative m-4 mb-0 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white">
            {imageUrl ? (
              <>
                <ZoomPanStage zp={zp} src={imageUrl} alt="Preview" />
                <div className="absolute bottom-3 right-3 z-10">
                  <ZoomPanControls zp={zp} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-ink-muted">
                <IcMockup className="h-7 w-7 animate-pulse text-accent" />
                <span className="text-[12.5px] font-medium">{mockup ? 'Rendering mockup…' : 'Rendering design…'}</span>
              </div>
            )}
          </div>

          {/* Footer: preview options on the left, the one action on the right (closing lives on the X) */}
          <div className="mx-4 mb-4 mt-3 flex flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-3">
            {mockup && mockup.colors.length > 0 && (
              <FooterField label="Color" value={colorName}>
                <ColorSwatches
                  colors={mockup.colors}
                  selected={colorName}
                  onSelect={(name) => setColorByMockup((prev) => ({ ...prev, [mockup.id]: name }))}
                />
              </FooterField>
            )}

            <button
              onClick={download}
              disabled={!imageUrl}
              className="ml-auto flex h-10 items-center gap-2 self-center rounded-xl bg-accent px-5 text-[13px] font-semibold text-white shadow-accent transition-all enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:active:scale-95 disabled:opacity-50"
            >
              <IcDownload className="h-4 w-4" />
              Export PNG
            </button>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  )
}
