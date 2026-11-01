import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useStoredState } from './hooks'

const AppContext = createContext(null)

/** Global app state: current user, theme, chosen model, watchlist. */
export function AppProvider({ children }) {
  const [userId, setUserId] = useStoredState('wsiwt.userId', null)
  const [theme, setTheme] = useStoredState('wsiwt.theme', 'dark')
  const [model, setModel] = useStoredState('wsiwt.model', 'hybrid')
  // Animations default to off for people who ask their OS for reduced motion.
  const [motionOn, setMotionOn] = useStoredState(
    'wsiwt.motion',
    !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  )
  const [user, setUser] = useState(null)
  const [watchlist, setWatchlist] = useState(new Set())
  // Bumped after every rating so recommendation lists refetch.
  const [recsVersion, setRecsVersion] = useState(0)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('motion-off', !motionOn)
  }, [motionOn])

  const refreshUser = useCallback(() => {
    if (!userId) {
      setUser(null)
      setWatchlist(new Set())
      return
    }
    api.user(userId).then(setUser).catch(() => setUserId(null))
    api.watchlist(userId).then((w) => setWatchlist(new Set(w.map((m) => m.id)))).catch(() => {})
  }, [userId, setUserId])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const toggleWatch = useCallback(
    async (movieId) => {
      if (!userId) return false
      const on = !watchlist.has(movieId)
      setWatchlist((w) => {
        const next = new Set(w)
        on ? next.add(movieId) : next.delete(movieId)
        return next
      })
      await api.setWatchlist(userId, movieId, on)
      return true
    },
    [userId, watchlist],
  )

  const rate = useCallback(
    async (movieId, rating) => {
      const out = await api.rate(userId, movieId, rating, model)
      setRecsVersion((v) => v + 1)
      refreshUser()
      return out
    },
    [userId, model, refreshUser],
  )

  const value = useMemo(
    () => ({
      user,
      userId,
      signIn: setUserId,
      signOut: () => setUserId(null),
      theme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      model,
      setModel,
      motionOn,
      toggleMotion: () => setMotionOn((m) => !m),
      watchlist,
      toggleWatch,
      rate,
      recsVersion,
    }),
    [user, userId, setUserId, theme, setTheme, model, setModel, motionOn, setMotionOn,
      watchlist, toggleWatch, rate, recsVersion],
  )
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
