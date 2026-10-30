'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IcAlert, IcCheck, IcDelete } from '@/components/icons'

export interface ConfirmOptions {
  title: string
  description: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'accent'
  /** Optional checkbox shown above the actions; its value is passed to onConfirm */
  option?: { label: string; hint?: string; defaultChecked?: boolean }
  onConfirm: (optionChecked: boolean) => void
}

export default function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const isDanger = options.tone === 'danger'
  const [checked, setChecked] = useState(!!options.option?.defaultChecked)

  const confirm = () => {
    onClose()
    options.onConfirm(checked)
  }

  // Capture-phase listener so editor shortcuts (Delete, V, H…) don't fire behind the dialog
  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-ink/25 p-4 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-[440px] rounded-3xl border border-line bg-surface p-6 shadow-float animate-[dialog-in_180ms_cubic-bezier(0.2,0.9,0.3,1.2)]"
      >
        {/* Header: icon + title/description */}
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-4 ${
              isDanger ? 'bg-danger-soft text-danger ring-danger-soft/50' : 'bg-accent-soft text-accent ring-accent-soft/50'
            }`}
          >
            {isDanger ? <IcDelete className="h-5 w-5" /> : <IcAlert className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="confirm-title" className="text-[16px] font-semibold leading-snug text-ink">
              {options.title}
            </h2>
            <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{options.description}</div>
          </div>
        </div>

        {options.option && (
          <label
            className={`mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors ${
              checked ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface-2 hover:border-line-strong'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-all peer-focus-visible:ring-[3px] peer-focus-visible:ring-accent-soft ${
                checked ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface'
              }`}
            >
              {checked && <IcCheck className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{options.option.label}</span>
              {options.option.hint && <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{options.option.hint}</span>}
            </span>
          </label>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={confirm}
            className={`rounded-xl px-4 py-2 text-[13px] font-semibold text-white outline-none transition-all hover:-translate-y-px focus-visible:ring-[3px] active:scale-95 ${
              isDanger
                ? 'bg-danger shadow-[0_6px_16px_rgba(217,83,79,0.28)] hover:bg-[#c2443f] focus-visible:ring-danger-soft'
                : 'bg-accent shadow-accent hover:bg-accent-hover focus-visible:ring-accent-soft'
            }`}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
