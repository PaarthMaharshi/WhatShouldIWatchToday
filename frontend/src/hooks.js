import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

/**
 * Run an async loader whenever `deps` change; ignores stale responses.
 * `saved`: data to use instead of calling the loader (e.g. the bundled home
 * page snapshot). Pass undefined to load from the API as usual.
 */
export function useAsync(loader, deps, saved) {
  const [state, setState] = useState(() =>
    saved !== undefined ? { data: saved, loading: false, error: null } : { data: null, loading: true, error: null })
  const run = useRef(0)

  const reload = useCallback(() => {
    const id = ++run.current
    if (saved !== undefined) {
      setState({ data: saved, loading: false, error: null })
      return
    }
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
