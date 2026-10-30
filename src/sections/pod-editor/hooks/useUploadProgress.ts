import { useCallback, useEffect, useRef, useState } from 'react'

export type UploadKind = 'image' | 'psd' | 'mockup'
export type UploadStatus = 'uploading' | 'processing' | 'done' | 'error'

export interface UploadTask {
  id: number
  fileName: string
  fileSize: number
  kind: UploadKind
  progress: number
  status: UploadStatus
}

// Mocked timings — progress eases toward PROGRESS_CAP while the real work runs,
// then jumps to 100% once it resolves.
const PROGRESS_CAP = 92
const TICK_MS = 60
const MIN_DURATION: Record<UploadKind, number> = { image: 900, psd: 1600, mockup: 1400 }
const PRE_WORK_DELAY = 350
const DONE_HIDE_MS = 1100
const ERROR_HIDE_MS = 3000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useUploadProgress() {
  const [task, setTask] = useState<UploadTask | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  const update = (id: number, patch: Partial<UploadTask>) =>
    setTask((t) => (t && t.id === id ? { ...t, ...patch } : t))

  const scheduleHide = (id: number, ms: number) => {
    timers.current.push(window.setTimeout(() => setTask((t) => (t?.id === id ? null : t)), ms))
  }

  const run = useCallback(async <T,>(file: File, kind: UploadKind, work: () => Promise<T>): Promise<T> => {
    const id = Date.now()
    let progress = 0
    setTask({ id, fileName: file.name, fileSize: file.size, kind, progress: 0, status: 'uploading' })

    const interval = window.setInterval(() => {
      progress = Math.min(PROGRESS_CAP, progress + (PROGRESS_CAP - progress) * 0.07 + 0.25)
      update(id, { progress, status: progress > 55 ? 'processing' : 'uploading' })
    }, TICK_MS)

    try {
      const minDuration = wait(MIN_DURATION[kind])
      // Let the bar paint before heavy (main-thread) work like PSD parsing starts
      await wait(PRE_WORK_DELAY)
      const [result] = await Promise.all([work(), minDuration])
      window.clearInterval(interval)
      update(id, { progress: 100, status: 'done' })
      scheduleHide(id, DONE_HIDE_MS)
      return result
    } catch (err) {
      window.clearInterval(interval)
      update(id, { status: 'error' })
      scheduleHide(id, ERROR_HIDE_MS)
      throw err
    }
  }, [])

  const dismiss = useCallback(() => setTask(null), [])

  return { task, run, dismiss }
}
