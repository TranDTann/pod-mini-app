import { useEffect, useRef, useState } from 'react'
import { IcPsd, IcBlank, IcChevronDown, IcUpload, IcDelete } from '@/components/icons'

interface TemplateMenuProps {
  templateName: string
  isBlank: boolean
  onSwitchToBlank: () => void
  onUploadPsd: () => void
  onRemoveTemplate: () => void
}

const ITEM =
  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent-soft group'

export default function TemplateMenu({
  templateName,
  isBlank,
  onSwitchToBlank,
  onUploadPsd,
  onRemoveTemplate,
}: TemplateMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-[13px] font-semibold text-ink transition-colors ${
          isOpen ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface shadow-soft hover:bg-surface-2'
        }`}
      >
        {isBlank ? <IcBlank className="h-5 w-5 shrink-0 text-ink-muted" /> : <IcPsd className="h-5 w-5 shrink-0" />}
        <span className="max-w-[180px] truncate">{templateName}</span>
        <IcChevronDown className={`h-3.5 w-3.5 shrink-0 text-ink-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[260px] rounded-2xl border border-line bg-surface p-1.5 shadow-float animate-[toast-in_150ms_ease-out]">
          <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">Template</p>
          <button onClick={() => { setIsOpen(false); onSwitchToBlank() }} className={ITEM}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-muted ring-1 ring-line group-hover:text-accent">
              <IcBlank className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-ink">Blank canvas</span>
              <span className="block text-[11px] text-ink-subtle">1200 × 900 px</span>
            </span>
          </button>
          <button onClick={() => { setIsOpen(false); onUploadPsd() }} className={ITEM}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-muted ring-1 ring-line group-hover:text-accent">
              <IcUpload className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-ink">Upload PSD template…</span>
              <span className="block text-[11px] text-ink-subtle">Mockup & print areas</span>
            </span>
          </button>
          <div className="mx-2 my-1.5 h-px bg-line" />
          <button
            onClick={() => { setIsOpen(false); onRemoveTemplate() }}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-danger-soft"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-muted ring-1 ring-line group-hover:text-danger">
              <IcDelete className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-ink group-hover:text-danger">Remove template</span>
              <span className="block text-[11px] text-ink-subtle">Close and return to start</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
