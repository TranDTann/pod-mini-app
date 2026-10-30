import { useEffect, useState } from 'react'

/**
 * Keeps closing content mounted until its exit transition has played.
 * Returns true while `open`, and for `exitMs` after it turns false.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open) return
    const timer = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(timer)
  }, [open, exitMs])

  return open || mounted
}
