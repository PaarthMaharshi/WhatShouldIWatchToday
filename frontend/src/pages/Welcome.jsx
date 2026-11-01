import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import Artwork from '../components/Artwork'
import { StarButton } from '../components/Motion'
import { ErrorNote, PosterSkeleton } from '../components/Skeletons'
import { useApp } from '../context'
import { useAsync } from '../hooks'

const TARGET_PICKS = 5

/**
 * Onboarding = cold-start data collection. Chosen genres and favourite movies
 * feed the K-means + Content-kNN cold-start model until the user has rated 5.
 */
export default function Welcome() {
  const { signIn } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [genres, setGenres] = useState([])
  const [picks, setPicks] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [demoId, setDemoId] = useState(414)

  const genreList = useAsync(() => api.genres(), [])
  const movies = useAsync(() => api.movies({ q, sort: 'popular', page_size: 18 }), [q])

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const start = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const user = await api.createUser({ name: name.trim(), genres, favorite_movie_ids: picks })
      signIn(user.id)
      navigate('/for-you?welcome=1')
    } catch (ex) {
      setErr(ex)
      setBusy(false)
    }
  }

  const startDemo = async () => {
    setBusy(true)
    setErr(null)
    try {
      const user = await api.demoUser(Number(demoId))
      signIn(user.id)
      navigate('/for-you?welcome=1')
    } catch (ex) {
      setErr(ex)
      setBusy(false)
    }
  }

  const ready = name.trim() && (genres.length > 0 || picks.length > 0)

  return (
    <section className="container-x py-12">
      <p className="eyebrow">Welcome</p>
      <h1 className="mt-2 text-4xl font-bold">Tell us what you love</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        New here? The recommender knows nothing about you yet (the "cold start" problem). Pick a few
        genres and up to {TARGET_PICKS} favourite movies and we will find your taste segment.
      </p>

      <form onSubmit={start} className="mt-10 space-y-10">
        <div>
          <label htmlFor="name" className="font-display text-sm font-bold uppercase tracking-[0.2em]">1. Your name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            placeholder="e.g. Asha"
            className="mt-3 block w-full max-w-sm rounded-lg border border-line bg-surface px-4 py-2.5 outline-none focus:border-accent"
          />
        </div>

        <fieldset>
          <legend className="font-display text-sm font-bold uppercase tracking-[0.2em]">2. Favourite genres</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {genreList.data?.map((g) => (
              <button
                key={g.name}
                type="button"
                aria-pressed={genres.includes(g.name)}
                onClick={() => toggle(genres, setGenres, g.name)}
                className={`chip ${genres.includes(g.name) ? 'chip-on' : ''}`}
              >
                {g.name}
              </button>
            ))}
            {genreList.loading && <div className="skeleton h-8 w-80" />}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-sm font-bold uppercase tracking-[0.2em]">
            3. Favourite movies <span className="ml-2 font-sans text-xs normal-case tracking-normal text-muted">{picks.length}/{TARGET_PICKS} chosen</span>
          </legend>
          <label htmlFor="pick-search" className="sr-only">Search movies to pick</label>
          <input
            id="pick-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a title..."
            className="mt-3 block w-full max-w-sm rounded-lg border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <div className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {movies.error && <div className="col-span-full"><ErrorNote error={movies.error} onRetry={movies.reload} /></div>}
            {movies.loading
              ? Array.from({ length: 12 }).map((_, i) => <PosterSkeleton key={i} />)
              : movies.data?.items.map((m) => {
                  const on = picks.includes(m.id)
                  const full = !on && picks.length >= TARGET_PICKS
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      disabled={full}
                      onClick={() => toggle(picks, setPicks, m.id)}
                      className={`group relative overflow-hidden rounded-lg text-left transition disabled:opacity-40 ${on ? 'ring-4 ring-accent' : ''}`}
                    >
                      <Artwork movie={m} className="aspect-[2/3]" />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[11px] font-semibold text-white">
                        {m.title}
                      </span>
                      {on && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-bold text-white">✓</span>}
                    </button>
                  )
                })}
          </div>
        </fieldset>

        {err && <p role="alert" className="text-sm text-accent">{err.message}</p>}

        <StarButton
          type="submit"
          disabled={!ready || busy}
          className="font-display text-sm font-bold uppercase tracking-[0.2em] disabled:opacity-40"
        >
          {busy ? 'Creating...' : 'Show my recommendations'}
        </StarButton>
      </form>

      <div className="mt-16 rounded-xl border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-bold">Viva demo: load a MovieLens user</h2>
        <p className="mt-1 text-sm text-muted">
          Copies the full rating history of one of the 610 MovieLens users, so you can show recommendations for a user with lots of data.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="demo-id" className="text-sm">MovieLens user id</label>
          <input
            id="demo-id"
            type="number"
            min={1}
            max={610}
            value={demoId}
            onChange={(e) => setDemoId(e.target.value)}
            className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="button" onClick={startDemo} disabled={busy} className="rounded-full border border-accent px-5 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-white disabled:opacity-40">
            Load user
          </button>
        </div>
      </div>
    </section>
  )
}
