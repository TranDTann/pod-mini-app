/**
 * Coalesces calls into at most one per animation frame, always running with the
 * latest arguments. Keeps React state updates in sync with the display refresh
 * instead of firing on every pointer event.
 */
export function rafThrottle<A extends unknown[]>(fn: (...args: A) => void) {
  let frame = 0
  let lastArgs: A
  const throttled = (...args: A) => {
    lastArgs = args
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      fn(...lastArgs)
    })
  }
  throttled.cancel = () => {
    cancelAnimationFrame(frame)
    frame = 0
  }
  return throttled
}

/**
 * Like rafThrottle but at most once per `interval` ms (trailing call guaranteed).
 * Used for React panel updates during drags: the canvas repaints every frame, the
 * side panels don't need to, and re-rendering the editor at 60fps steals frames.
 */
export function timeThrottle<A extends unknown[]>(fn: (...args: A) => void, interval: number) {
  let timer = 0
  let last = 0
  let lastArgs: A
  const throttled = (...args: A) => {
    lastArgs = args
    if (timer) return
    const wait = Math.max(0, last + interval - performance.now())
    timer = window.setTimeout(() => {
      timer = 0
      last = performance.now()
      fn(...lastArgs)
    }, wait)
  }
  throttled.cancel = () => {
    window.clearTimeout(timer)
    timer = 0
  }
  return throttled
}

const MAX_IMAGE_SIDE = 2400

/**
 * Downscales very large images before they reach Fabric. Huge bitmaps make every
 * drag / scale frame expensive (and filters even more so).
 */
export async function downscaleDataUrl(dataUrl: string, maxSide = MAX_IMAGE_SIDE): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  if (longest <= maxSide) return dataUrl
  const scale = maxSide / longest
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png', 0.92)
}
