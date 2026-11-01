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
