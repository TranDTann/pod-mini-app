import { useCallback, useEffect, useRef, useState } from 'react'
import { util } from 'fabric'
import type { Canvas, FabricObject } from 'fabric'

// Serializing the whole canvas (images are data URLs) is expensive, so snapshots
// are coalesced: bursts of changes (slider drags, nudges) produce a single entry,
// and the work runs after the interaction frame instead of during it.
const SNAPSHOT_DELAY = 220

export function useEditorHistory(
  fabricRef: React.RefObject<Canvas | null>,
  onRestore: () => void,
  /** Only these objects are recorded; template objects (mockup, guides) stay untouched. */
  isTracked: (obj: FabricObject) => boolean,
) {
  const snapshots = useRef<string[]>([])
  const currentIndex = useRef(-1)
  const isRestoring = useRef(false)
  const pendingTimer = useRef<number | undefined>(undefined)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const writeSnapshot = useCallback(() => {
    window.clearTimeout(pendingTimer.current)
    pendingTimer.current = undefined
    const canvas = fabricRef.current
    if (!canvas || isRestoring.current) return
    const json = JSON.stringify(canvas.getObjects().filter(isTracked).map((obj) => obj.toObject()))
    if (json === snapshots.current[currentIndex.current]) return
    snapshots.current = snapshots.current.slice(0, currentIndex.current + 1)
    snapshots.current.push(json)
    currentIndex.current = snapshots.current.length - 1
    setCanUndo(currentIndex.current > 0)
    setCanRedo(false)
  }, [fabricRef, isTracked])

  /** Schedule a (debounced) snapshot. */
  const saveSnapshot = useCallback(() => {
    if (isRestoring.current) return
    window.clearTimeout(pendingTimer.current)
    pendingTimer.current = window.setTimeout(writeSnapshot, SNAPSHOT_DELAY)
    setCanUndo(true)
  }, [writeSnapshot])

  /** Write any pending snapshot right away. */
  const flush = useCallback(() => {
    if (pendingTimer.current !== undefined) writeSnapshot()
  }, [writeSnapshot])

  useEffect(() => () => window.clearTimeout(pendingTimer.current), [])

  const restoreSnapshot = useCallback(
    async (index: number) => {
      const canvas = fabricRef.current
      if (!canvas) return
      isRestoring.current = true
      const restored = await util.enlivenObjects<FabricObject>(JSON.parse(snapshots.current[index]))
      canvas.discardActiveObject()
      canvas.remove(...canvas.getObjects().filter(isTracked))
      canvas.add(...restored)
      canvas.requestRenderAll()
      currentIndex.current = index
      setCanUndo(index > 0)
      setCanRedo(index < snapshots.current.length - 1)
      onRestore()
      isRestoring.current = false
    },
    [fabricRef, onRestore, isTracked],
  )

  const undo = useCallback(() => {
    flush()
    if (currentIndex.current > 0) restoreSnapshot(currentIndex.current - 1)
  }, [flush, restoreSnapshot])

  const redo = useCallback(() => {
    flush()
    if (currentIndex.current < snapshots.current.length - 1)
      restoreSnapshot(currentIndex.current + 1)
  }, [flush, restoreSnapshot])

  return { saveSnapshot, flushSnapshot: flush, undo, redo, canUndo, canRedo, isRestoring }
}
