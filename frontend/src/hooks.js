import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

/** Run an async loader whenever `deps` change; ignores stale responses. */
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const run = useRef(0)

  const reload = useCallback(() => {
    const id = ++run.current
    setState((s) => ({ ...s, loading: true, error: null }))
    loader()
      .then((data) => id === run.current && setState({ data, loading: false, error: null }))
      .catch((error) => id === run.current && setState({ data: null, loading: false, error }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}

/**
 * Dominant "mood" colour of an image, used to tint the movie page.
 * Samples a tiny copy on a canvas and weights saturated pixels more, so the
 * colour reflects the artwork rather than its greys. Returns null until ready
 * or if the image cannot be read (TMDB images allow cross-origin reads).
 */
export function useDominantColor(src) {
  const [color, setColor] = useState(null)
  useEffect(() => {
    setColor(null)
    if (!src) return undefined
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    // Sample a small TMDB size: faster, and a different URL from the <img> on
    // the page, whose cached non-CORS response would otherwise block reading.
    src = src.replace(/\/t\/p\/w\d+\//, '/t/p/w300/')
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 24
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, 24, 24)
        const d = ctx.getImageData(0, 0, 24, 24).data
        let r = 0, g = 0, b = 0, w = 0
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2])
          const min = Math.min(d[i], d[i + 1], d[i + 2])
          const weight = (max - min) / 255 + 0.05      // favour saturated pixels
          r += d[i] * weight; g += d[i + 1] * weight; b += d[i + 2] * weight; w += weight
        }
        if (alive && w > 0) setColor([r / w, g / w, b / w].map(Math.round))
      } catch {
        /* tainted canvas or decode error: keep the fallback tint */
      }
    }
    img.src = src
    return () => {
      alive = false
    }
  }, [src])
  return color
}

let modelsPromise = null

/** Model registry + offline results from GET /models (fetched once per page load). */
export function useModels() {
  return useAsync(() => {
    modelsPromise ??= api.models()
    return modelsPromise.catch((e) => {
      modelsPromise = null
      throw e
    })
  }, [])
}

/** localStorage-backed state; storage failures (private mode) fall back to memory. */
export function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : JSON.parse(raw)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  }, [key, value])
  return [value, setValue]
}
