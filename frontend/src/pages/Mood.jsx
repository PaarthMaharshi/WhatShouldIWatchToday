import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { RevealText, Spotlight, StarButton } from '../components/Motion'
import PosterCard from '../components/PosterCard'
import { ErrorNote, PosterSkeleton } from '../components/Skeletons'
import { useApp } from '../context'
import { useAsync } from '../hooks'

// One colour per mood for the tiles (decorative only).
const MOOD_COLORS = {
  happy: '#f59e0b', cry: '#3b82f6', thrill: '#E8403A', scared: '#7c3aed', think: '#14b8a6',
  romantic: '#ec4899', adventure: '#f97316', nostalgic: '#a16207', chill: '#22c55e',
}

const DEFAULTS = { mood: 'happy', company: 'solo', era: 'any', runtime: 'any', discovery: 'balanced', text: '' }

/** Accessible single-choice pill group. */
function Segmented({ label, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-2">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={value === o.key}
            onClick={() => onChange(o.key)}
            className={`chip ${value === o.key ? 'chip-on' : ''}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Mood match: pick a mood and a few situational factors; the API turns them
 * into a content query and returns matching movies with a reason for each.
 */
export default function Mood() {
  const { userId } = useApp()
  const [params, setParams] = useSearchParams()
  const options = useAsync(() => api.moodOptions(), [])
  const genres = useAsync(() => api.genres(), [])

  const read = () => ({
    ...DEFAULTS,
    ...Object.fromEntries([...params.entries()].filter(([k]) => k in DEFAULTS)),
    genres: params.get('genres') ? params.get('genres').split(',') : [],
  })
  const [form, setForm] = useState(read)
  const [result, setResult] = useState({ data: null, loading: false, error: null })

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const toggleGenre = (g) =>
    setForm((f) => ({ ...f, genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g] }))

  const run = async (values = form) => {
    setResult({ data: null, loading: true, error: null })
    const next = new URLSearchParams()
    Object.entries(values).forEach(([k, v]) => {
      const s = Array.isArray(v) ? v.join(',') : v
      if (s && s !== DEFAULTS[k]) next.set(k, s)
    })
    next.set('go', '1')
    setParams(next, { replace: true })
    try {
      const data = await api.mood({ ...values, user_id: userId, k: 12 })
      setResult({ data, loading: false, error: null })
    } catch (error) {
      setResult({ data: null, loading: false, error })
    }
  }

  // Shared links (?mood=...&go=1) run straight away.
  useEffect(() => {
    if (params.get('go')) run(read())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const opts = options.data
  const moodGenres = opts?.moods.find((m) => m.key === form.mood)?.genres ?? []

  return (
    <div className="container-x py-12">
      <p className="eyebrow">Mood match</p>
      <RevealText as="h1" text="What are you in the mood for?" className="mt-2 text-4xl font-bold sm:text-5xl" />
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Pick a mood and a few details. We turn them into a query in the same TF-IDF space as the
        content model and find the nearest movies, then blend in quality, popularity
        {userId ? ' and your own taste profile' : ''}.
      </p>

      {options.error && <div className="mt-8"><ErrorNote error={options.error} onRetry={options.reload} /></div>}

      <form
        className="mt-10 space-y-10"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        {/* 1. Mood tiles */}
        <fieldset>
          <legend className="font-display text-sm font-bold uppercase tracking-[0.2em]">1. Your mood</legend>
          <div role="radiogroup" aria-label="Mood" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(opts?.moods ?? Array.from({ length: 9 }, (_, i) => ({ key: `s${i}` }))).map((m) =>
              m.label ? (
                <Spotlight key={m.key} className={`!rounded-2xl !p-0 ${form.mood === m.key ? 'ring-2 ring-accent' : ''}`}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.mood === m.key}
                    onClick={() => set('mood')(m.key)}
                    className="relative block h-full w-full overflow-hidden p-4 text-left"
                  >
                    <span
                      className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40 blur-2xl"
                      style={{ background: MOOD_COLORS[m.key] }}
                      aria-hidden="true"
                    />
                    <span className="mb-3 block h-2 w-8 rounded-full" style={{ background: MOOD_COLORS[m.key] }} aria-hidden="true" />
                    <span className="block font-display text-base font-bold leading-tight">{m.label}</span>
                    <span className="mt-1 block text-xs text-muted">{m.blurb}</span>
                  </button>
                </Spotlight>
              ) : (
                <div key={m.key} className="skeleton h-24 rounded-2xl" />
              ),
            )}
          </div>
        </fieldset>

        {/* 2. Fine-tune */}
        {opts && (
          <div className="grid gap-8 rounded-2xl border border-line bg-surface/70 p-6 backdrop-blur lg:grid-cols-2">
            <fieldset className="lg:col-span-2">
              <legend className="eyebrow mb-2">Genres (optional; {moodGenres.slice(0, 3).join(', ')} already suit this mood)</legend>
              <div className="flex flex-wrap gap-2">
                {genres.data?.filter((g) => g.name !== 'IMAX').map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    aria-pressed={form.genres.includes(g.name)}
                    onClick={() => toggleGenre(g.name)}
                    className={`chip ${form.genres.includes(g.name) ? 'chip-on' : ''}`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <Segmented label="Watching with" options={opts.company} value={form.company} onChange={set('company')} />
            <Segmented label="Time you have" options={opts.runtimes} value={form.runtime} onChange={set('runtime')} />
            <Segmented label="Era" options={opts.eras} value={form.era} onChange={set('era')} />
            <Segmented label="Popular or hidden?" options={opts.discovery} value={form.discovery} onChange={set('discovery')} />
            <div className="lg:col-span-2">
              <label htmlFor="mood-text" className="eyebrow mb-2 block">Anything specific? (optional)</label>
              <input
                id="mood-text"
                value={form.text}
                maxLength={120}
                onChange={(e) => set('text')(e.target.value)}
                placeholder="e.g. space, heist, time travel, small town"
                className="w-full max-w-xl rounded-full border border-line bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        <StarButton type="submit" disabled={result.loading || !opts}
          className="font-display text-sm font-bold uppercase tracking-[0.2em] disabled:opacity-40">
          {result.loading ? 'Finding films…' : 'Find my movies'}
        </StarButton>
      </form>

      {/* Results */}
      <section className="mt-14" aria-live="polite" aria-busy={result.loading}>
        {result.error && <ErrorNote error={result.error} onRetry={() => run()} />}
        {(result.loading || result.data) && (
          <h2 className="text-2xl font-bold">
            {result.data ? `${result.data.label}: ${result.data.items.length} picks` : 'Finding films…'}
          </h2>
        )}
        {result.data?.personalised && (
          <p className="mt-1 text-xs text-muted">Blended with your taste profile; movies you have rated are left out.</p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {result.loading && Array.from({ length: 12 }).map((_, i) => <PosterSkeleton key={i} />)}
          {result.data?.items.map((m) => (
            <div key={m.id}>
              <PosterCard movie={m} showMatch />
              <p className="mt-2 line-clamp-2 text-xs text-muted">{m.reason?.text}</p>
            </div>
          ))}
        </div>
        {result.data && result.data.items.length === 0 && (
          <div className="mt-6 rounded-xl border border-line bg-surface p-8 text-center">
            <p className="font-display font-bold">No movies fit all of those</p>
            <p className="mt-1 text-sm text-muted">Try a longer runtime, another era or fewer genres.</p>
          </div>
        )}
      </section>
    </div>
  )
}
