'use client'

import { useCallback, useRef } from 'react'
import { parseTemplateFile } from '@/sections/pod-editor/utils/template'
import { useUploadProgress } from '@/sections/pod-editor/hooks/useUploadProgress'
import UploadProgress from '@/sections/pod-editor/components/UploadProgress'
import { IcPsd } from '@/components/icons'
import type { PsdTemplate } from '@/sections/pod-editor/types'

interface PsdUploaderProps {
  onTemplate: (template: PsdTemplate) => void
}

export default function PsdUploader({ onTemplate }: PsdUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { task, run } = useUploadProgress()
  const isLoading = !!task && task.status !== 'error'

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || isLoading) return
      try {
        const template = await run(file, 'psd', async () => {
          return parseTemplateFile(await file.arrayBuffer(), file.name)
        })
        // Let the "done" state show briefly before entering the editor
        setTimeout(() => onTemplate(template), 450)
      } catch (err) {
        console.error('Failed to parse PSD:', err)
      }
    },
    [onTemplate, isLoading, run],
  )

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
        className="flex w-[240px] items-center justify-center gap-2.5 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-accent transition-all enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:active:scale-95 disabled:cursor-wait disabled:opacity-60"
      >
        <IcPsd className="h-5 w-5" />
        {isLoading ? 'Processing PSD…' : 'Upload PSD Template'}
      </button>
      {task && <UploadProgress task={task} />}
      <input ref={inputRef} type="file" accept=".psd" onChange={handleFileChange} className="hidden" />
    </div>
  )
}
