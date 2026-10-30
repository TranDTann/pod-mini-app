import { useCallback, useEffect, useRef, useState } from 'react'
import type { MockupPsd } from '../types'
import { renderMockup } from '../utils/mockup'

let nextSession = 1

export const mockupRenderKey = (mockupId: number, side: number, color: string) => `${mockupId}|${side}|${color}`

/**
 * Mockup renders of one preview session (the design can't change while the dialog is open).
 * One render runs at a time and the color last asked for goes first, so quick clicks never
 * pile up. Once it's idle the mockup's other colors render in the background, which makes
 * switching to them instant.
 */
export function useMockupRenders(
  mockup: MockupPsd | null,
  colorName: string,
  side: number,
  sideNames: string[],
  renderSide: (index: number) => string,
) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const session = useRef(0)
  const arts = useRef(new Map<number, Promise<Blob | null>>())
  const done = useRef(new Map<string, string>())
  const failed = useRef(new Set<string>())
  const wanted = useRef<{ mockup: MockupPsd; color: string; side: number } | null>(null)
  const busy = useRef(false)
  const exporting = useRef(false)
  const alive = useRef(false)

  // The design as PNG, once per side: rendering it from the canvas blocks the UI
  const getArt = useCallback(
    (index: number) => {
      let art = arts.current.get(index)
      if (!art) {
        const url = renderSide(index)
        art = url ? fetch(url).then((res) => res.blob()) : Promise.resolve(null)
        arts.current.set(index, art)
      }
      return art
    },
    [renderSide],
  )

  // Same design → same key, so the worker reuses its warped copy for every color and for the export
  const artKey = useCallback((index: number) => `preview-${session.current}-${index}`, [])

  const pumpRef = useRef(() => {})
  const pump = useCallback(() => {
    const job = wanted.current
    if (busy.current || exporting.current || !alive.current || !job) return
    const key = (color: string) => mockupRenderKey(job.mockup.id, job.side, color)
    const open = (color: string) => !done.current.has(key(color)) && !failed.current.has(key(color))
    const color = open(job.color) ? job.color : job.mockup.colors.map((c) => c.name).find(open)
    if (color === undefined) return

    busy.current = true
    const id = key(color)
    renderMockup(job.mockup, getArt, artKey, job.side, sideNames, color, 'jpeg')
      .then((blob) => {
        if (!alive.current) return
        const url = URL.createObjectURL(blob)
        done.current.set(id, url)
        setUrls((prev) => ({ ...prev, [id]: url }))
      })
      .catch((error) => {
        failed.current.add(id)
        if (alive.current) setErrors((prev) => ({ ...prev, [id]: String(error) }))
      })
      .finally(() => {
        busy.current = false
        pumpRef.current()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sideNames only matter per session
  }, [getArt, artKey])

  /** The file to download: a PNG of the chosen color, ahead of any background render still to start. */
  const exportPng = useCallback(
    async (target: MockupPsd, color: string, targetSide: number) => {
      exporting.current = true
      try {
        const blob = await renderMockup(target, getArt, artKey, targetSide, sideNames, color, 'png')
        return alive.current ? blob : null
      } finally {
        exporting.current = false
        pumpRef.current()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sideNames only matter per session
    [getArt, artKey],
  )

  useEffect(() => {
    pumpRef.current = pump
  }, [pump])

  useEffect(() => {
    const blobUrls = done.current
    alive.current = true
    session.current = nextSession++
    return () => {
      alive.current = false
      blobUrls.forEach((url) => URL.revokeObjectURL(url))
      blobUrls.clear()
    }
  }, [])

  const mockupId = mockup?.id
  useEffect(() => {
    wanted.current = mockup ? { mockup, color: colorName, side } : null
    // The first render of a session draws the design: start after the dialog has painted
    const timer = window.setTimeout(pump, 60)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ids capture mockup / color
  }, [mockupId, colorName, side, pump])

  return { urls, errors, exportPng }
}
