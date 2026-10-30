'use client'

import { useState } from 'react'
import PodEditor from '@/sections/pod-editor'
import PsdUploader from '@/components/PsdUploader'
import { IcBlank, IcLogo } from '@/components/icons'
import type { PsdTemplate } from '@/sections/pod-editor/types'

const BLANK_TEMPLATE: PsdTemplate = {
  name: 'Blank',
  width: 1200,
  height: 900,
  mockupDataUrl: '',
  printAreas: [],
  layerImages: [],
}

export default function Home() {
  const [template, setTemplate] = useState<PsdTemplate | null>(null)

  if (template) return <PodEditor template={template} onTemplateChange={setTemplate} onRemoveTemplate={() => setTemplate(null)} />

  return (
    <div className="stage-dots relative flex h-screen w-full items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex w-[480px] flex-col items-center rounded-3xl border border-line bg-surface px-10 py-12 text-center shadow-float">
        <IcLogo className="h-12 w-12" />
        <h1 className="mt-5 text-[28px] font-bold tracking-tight text-ink">POD Design Editor</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">
          Upload a PSD template with mockup & print areas,
          <br />
          or start from a blank canvas.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3">
          <PsdUploader onTemplate={setTemplate} />
          <div className="flex w-full items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            onClick={() => setTemplate(BLANK_TEMPLATE)}
            className="flex w-[240px] items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-6 py-2.5 text-sm font-semibold text-ink transition-all hover:border-accent-line hover:bg-accent-soft hover:text-accent active:scale-95"
          >
            <IcBlank className="h-4 w-4" />
            Open Blank Editor
          </button>
        </div>
      </div>
    </div>
  )
}
