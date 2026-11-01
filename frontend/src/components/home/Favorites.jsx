import { useState } from 'react'
import { api } from '../../api'
import { useAsync } from '../../hooks'
import PosterCard from '../PosterCard'
import { ErrorNote, PosterSkeleton } from '../Skeletons'

// Filter chips -> /movies query parameters. Ratings are MovieLens averages
// (out of 5), shown in the UI out of 10, so "8.0+" means an average >= 4.0.
export const CHIPS = [
  { key: 'top10', label: 'Top 10', params: { sort: 'rating', page_size: 10 } },
  { key: 'eight', label: '8.0+ rated', params: { min_rating: 4.0, sort: 'popular' } },
  { key: 'trending', label: 'Trending', params: { sort: 'trending' } },
  { key: 'animation', label: 'Animation', params: { genre: 'Animation', sort: 'popular' } },
  { key: 'thriller', label: 'Thriller', params: { genre: 'Thriller', sort: 'popular' } },
  { key: 'scifi', label: 'Sci-Fi', params: { genre: 'Sci-Fi', sort: 'popular' } },
  { key: 'superheroes', label: 'Superheroes', params: { tag: 'superhero', sort: 'popular' } },
  { key: 'crime', label: 'Crime', params: { genre: 'Crime', sort: 'popular' } },
  { key: 'romance', label: 'Romance', params: { genre: 'Romance', sort: 'popular' } },
  { key: 'classics', label: 'Classics', params: { year_to: 1979, sort: 'rating' } },
  { key: 'docs', label: 'Documentary', params: { genre: 'Documentary', sort: 'popular' } },
]

export function ChipBar({ active, onChange, chips = CHIPS }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="toolbar" aria-label="Filters">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={active === c.key}
          onClick={() => onChange(c.key)}
          className={`chip shrink-0 ${active === c.key ? 'chip-on' : ''}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

/** Reference B "Favorites": filter chips above a poster grid. */
export default function Favorites() {
  const [active, setActive] = useState('top10')
  const chip = CHIPS.find((c) => c.key === active)
  const { data, loading, error, reload } = useAsync(
    () => api.movies({ page_size: 10, ...chip.params }),
    [active],
  )

  return (
    <section className="container-x mt-24" aria-labelledby="fav-title">
      <h2 id="fav-title" className="text-3xl font-bold">Favorites</h2>
      <p className="mt-3 max-w-md text-sm text-muted">The best films of the catalogue according to MovieLens viewers.</p>
      <div className="mt-6">
        <ChipBar active={active} onChange={setActive} />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {error ? (
          <div className="col-span-full"><ErrorNote error={error} onRetry={reload} /></div>
        ) : loading ? (
          Array.from({ length: 10 }).map((_, i) => <PosterSkeleton key={i} />)
        ) : (
          data.items.map((m) => <PosterCard key={m.id} movie={m} />)
        )}
      </div>
    </section>
  )
}
