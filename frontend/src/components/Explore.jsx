import { useEffect, useState } from 'react'
import { api } from '../api'
import { useApp } from '../context'
import { useAsync } from '../hooks'
import { FloatHeading } from './Motion'
import PosterCard from './PosterCard'
import { ErrorNote, PosterSkeleton } from './Skeletons'

export const ERAS = [
  { key: 'any', label: 'Any era' },
  { key: 'new', label: '2010s+', year_from: 2010 },
  { key: '00s', label: '2000s', year_from: 2000, year_to: 2009 },
  { key: '90s', label: '90s', year_from: 1990, year_to: 1999 },
  { key: '80s', label: '80s', year_from: 1980, year_to: 1989 },
  { key: 'classic', label: 'Classics (pre-1980)', year_to: 1979 },
]

/** Wait until typing pauses before searching. */
function useDebounced(value, ms = 450) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * "Explore with your taste": run the recommender inside a genre, an era or for
 * an actor / director, whenever the user feels like something different. The
 * results are still the user's own ranking, just narrowed.
 */
export default function Explore({ className = '', heading = 'Explore with your taste' }) {
  const { userId, model, recsVersion } = useApp()
  const [genre, setGenre] = useState('')
  const [era, setEra] = useState('any')
  const [personInput, setPersonInput] = useState('')
  const person = useDebounced(personInput.trim())
  const genres = useAsync(() => api.genres(), [])

  const e = ERAS.find((x) => x.key === era)
  const filters = {
    genre: genre || undefined,
    year_from: e.year_from,
    year_to: e.year_to,
    person: person.length >= 2 ? person : undefined,
  }
  const active = Boolean(filters.genre || filters.year_from || filters.year_to || filters.person)
  // With no filter, start after the top 12 picks the page already shows.
  const res = useAsync(
    () => (userId ? api.recommendations(userId, model, 12, active ? 0 : 12, filters) : Promise.resolve(null)),
    [userId, model, recsVersion, genre, era, filters.person],
  )
  const items = res.data?.items ?? []
  const genreList = (genres.data ?? []).map((g) => (typeof g === 'string' ? g : g.name ?? g.genre)).filter(Boolean)

  if (!userId) return null
  return (
    <section className={`container-x mt-24 ${className}`} aria-label={heading}>
      <FloatHeading className="!text-left !text-4xl !font-black uppercase sm:!text-6xl">{heading}</FloatHeading>
      <p className="mt-3 max-w-xl text-sm text-muted">
        In the mood for something different? Pick a genre, an era or an actor / director and the
        recommender searches your own ranking for it, so the picks still fit your taste.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Genre
          <select value={genre} onChange={(ev) => setGenre(ev.target.value)}
            className="min-w-40 border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
            <option value="">Any genre</option>
            {genreList.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Era
          <select value={era} onChange={(ev) => setEra(ev.target.value)}
            className="min-w-40 border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
            {ERAS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Actor, director or keyword
          <input value={personInput} onChange={(ev) => setPersonInput(ev.target.value)}
            placeholder="e.g. Tom Hanks, Nolan, heist"
            className="w-64 border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        </label>
        {active && (
          <button type="button"
            onClick={() => { setGenre(''); setEra('any'); setPersonInput('') }}
            className="label-caps pb-2 text-[10px] text-muted hover:text-accent">
            Clear
          </button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
        {res.error ? (
          <div className="col-span-full"><ErrorNote error={res.error} onRetry={res.reload} /></div>
        ) : res.loading && !res.data ? (
          Array.from({ length: 6 }).map((_, i) => <PosterSkeleton key={i} />)
        ) : items.length ? (
          items.map((m) => <PosterCard key={m.id} movie={m} showMatch />)
        ) : (
          <p className="col-span-full text-sm text-muted">
            Nothing in your ranking matches that yet. Try a broader era or another name.
          </p>
        )}
      </div>
    </section>
  )
}
