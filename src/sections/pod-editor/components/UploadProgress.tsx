import { IcAlert, IcCheck, IcImage, IcPsd } from '@/components/icons'
import type { UploadTask } from '../hooks/useUploadProgress'

const STATUS_TEXT: Record<UploadTask['kind'], Record<UploadTask['status'], string>> = {
  image: { uploading: 'Uploading image…', processing: 'Preparing layer…', done: 'Added to canvas', error: 'Upload failed' },
  psd: { uploading: 'Uploading PSD…', processing: 'Parsing layers & print areas…', done: 'Template ready', error: 'Could not parse PSD' },
  mockup: { uploading: 'Uploading mockup…', processing: 'Reading colors & print area…', done: 'Mockup added', error: 'Could not read mockup' },
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** `inline` = flat card that sits inside a list (e.g. the preview's mockup list) instead of floating. */
export default function UploadProgress({ task, inline = false }: { task: UploadTask; inline?: boolean }) {
  const isDone = task.status === 'done'
  const isError = task.status === 'error'
  const percent = Math.round(task.progress)

  const barColor = isError
    ? 'bg-danger'
    : isDone
      ? 'bg-sage'
      : 'bg-[linear-gradient(90deg,#6cc99c,#23a06b,#6cc99c)] bg-[length:200px_100%] animate-[shimmer_1.2s_linear_infinite]'

  if (inline) {
    // Same box as a list item (border + p-1.5 + 48px thumb = 62px), so swapping in never shifts the list
    return (
      <div
        className="flex w-full items-center gap-2.5 rounded-xl border border-accent-line bg-accent-soft/40 p-1.5"
        role="status"
        aria-live="polite"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface">
          <IcPsd className="h-6 w-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[12px] font-semibold text-ink">{task.fileName}</span>
            <span
              className={`flex w-8 shrink-0 justify-end text-[11px] font-semibold tabular-nums ${
                isError ? 'text-danger' : isDone ? 'text-sage' : 'text-accent'
              }`}
            >
              {isDone ? <IcCheck className="h-3.5 w-3.5" /> : isError ? <IcAlert className="h-3.5 w-3.5" /> : `${percent}%`}
            </span>
          </span>
          <span className="h-1 overflow-hidden rounded-full bg-hover">
            <span
              className={`block h-full rounded-full transition-[width] duration-200 ease-out ${barColor}`}
              style={{ width: `${isError ? 100 : percent}%` }}
            />
          </span>
          <span className="truncate text-[10.5px] leading-tight text-ink-muted">{STATUS_TEXT[task.kind][task.status]}</span>
        </span>
      </div>
    )
  }

  return (
    <div
      className="w-[320px] rounded-2xl border border-line bg-surface/95 p-3.5 shadow-float backdrop-blur animate-[toast-in_200ms_ease-out]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 ring-1 ring-line">
          {task.kind !== 'image' ? <IcPsd className="h-6 w-6" /> : <IcImage className="h-5 w-5 text-accent" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] font-semibold text-ink">{task.fileName}</p>
            <span
              // Fixed width, right-aligned: "5%" → "100%" → ✓ never shifts the row
              className={`flex w-10 shrink-0 justify-end text-[12px] font-semibold tabular-nums ${
                isError ? 'text-danger' : isDone ? 'text-sage' : 'text-accent'
              }`}
            >
              {isDone ? <IcCheck className="h-4 w-4" /> : isError ? <IcAlert className="h-4 w-4" /> : `${percent}%`}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-ink-muted">
            <span className="min-w-0 truncate">{STATUS_TEXT[task.kind][task.status]}</span>
            <span className="shrink-0 text-right tabular-nums">{formatSize(task.fileSize)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-hover">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-out ${barColor}`}
          style={{ width: `${isError ? 100 : percent}%` }}
        />
      </div>
    </div>
  )
}
