import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { CloseIcon, SearchIcon } from '../components/Icons'
import PosterCard from '../components/PosterCard'
import { ErrorNote, PosterSkeleton } from '../components/Skeletons'
import { useAsync } from '../hooks'

const PAGE_SIZE = 24
const SORTS = [
  ['popular', 'Most rated'],
  ['rating', 'Top rated'],
  ['trending', 'Trending'],
  ['year', 'Newest'],
  ['title', 'Title A-Z'],
]
const DECADES = [
  ['', 'Any year'],
  ['2010', '2010s'], ['2000', '2000s'], ['1990', '1990s'], ['1980', '1980s'],
  ['1970', '1970s'], ['1960', '1960s'], ['old', 'Before 1960'],
]
// Ratings are MovieLens averages out of 5, shown out of 10.
const MIN_RATINGS = [['', 'Any rating'], ['3.5', '7.0+'], ['4', '8.0+'], ['4.25', '8.5+']]

const decadeToYears = (d) =>
  !d ? {} : d === 'old' ? { year_to: 1959 } : { year_from: +d, year_to: +d + 9 }

function Select({ id, label, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-accent"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

/** Browse / search the full catalogue. All filters live in the URL so they can be shared. */
export default function Browse() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const genre = params.get('genre') ?? ''
  const tag = params.get('tag') ?? ''
  const decade = params.get('decade') ?? ''
  const minRating = params.get('min_rating') ?? ''
  const sort = params.get('sort') ?? 'popular'
  const page = Math.max(1, Number(params.get('page')) || 1)

  // Debounce typing so we query once the user pauses.
  const [text, setText] = useState(q)
  useEffect(() => setText(q), [q])
  useEffect(() => {
    if (text === q) return undefined
    const t = setTimeout(() => update({ q: text }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function update(changes, keepPage = false) {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!keepPage) next.delete('page')
    setParams(next, { replace: 'q' in changes })
  }

  const genres = useAsync(() => api.genres(), [])
  const results = useAsync(
    () => api.movies({ q, genre, tag, sort, page, page_size: PAGE_SIZE, min_rating: minRating, ...decadeToYears(decade) }),
    [q, genre, tag, sort, page, minRating, decade],
  )

  const goPage = (p) => {
    update({ page: p > 1 ? String(p) : '' }, true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const active = [
    q && ['q', `"${q}"`],
    genre && ['genre', genre],
    tag && ['tag', `#${tag}`],
    decade && ['decade', DECADES.find(([v]) => v === decade)?.[1]],
    minRating && ['min_rating', `${MIN_RATINGS.find(([v]) => v === minRating)?.[1]} rated`],
  ].filter(Boolean)

  const data = results.data
  return (
    <div className="container-x py-12">
      <p className="eyebrow">Browse</p>
      <h1 className="mt-2 text-4xl font-bold">Explore the catalogue</h1>
      <p className="mt-2 text-sm text-muted">9,700+ movies from MovieLens. Search, filter, and open any title to rate it.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]" role="search">
        <div className="relative col-span-2 md:col-span-1">
          <label htmlFor="browse-q" className="sr-only">Search titles</label>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" width={16} height={16} />
          <input
            id="browse-q"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search titles..."
            className="w-full rounded-full border border-line bg-surface py-2 pl-10 pr-4 text-sm outline-none focus:border-accent"
          />
        </div>
        <Select
          id="browse-genre"
          label="Genre"
          value={genre}
          onChange={(v) => update({ genre: v })}
          options={[['', 'All genres'], ...(genres.data ?? []).map((g) => [g.name, `${g.name} (${g.count})`])]}
        />
        <Select id="browse-decade" label="Decade" value={decade} onChange={(v) => update({ decade: v })} options={DECADES} />
        <Select id="browse-rating" label="Minimum rating" value={minRating} onChange={(v) => update({ min_rating: v })} options={MIN_RATINGS} />
        <Select id="browse-sort" label="Sort by" value={sort} onChange={(v) => update({ sort: v === 'popular' ? '' : v })} options={SORTS} />
      </div>

      <div className="mt-5 flex min-h-[32px] flex-wrap items-center gap-2" aria-live="polite">
        <span className="mr-2 text-sm text-muted">
          {data ? `${data.total.toLocaleString()} movie${data.total === 1 ? '' : 's'}` : 'Searching…'}
        </span>
        {active.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => update({ [key]: '' })}
            className="chip chip-on inline-flex items-center gap-1"
            aria-label={`Remove filter ${label}`}
          >
            {label} <CloseIcon width={12} height={12} />
          </button>
        ))}
        {active.length > 1 && (
          <button type="button" onClick={() => setParams({})} className="text-xs font-semibold text-accent hover:underline">
            Clear all
          </button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {results.error ? (
          <div className="col-span-full"><ErrorNote error={results.error} onRetry={results.reload} /></div>
        ) : results.loading ? (
          Array.from({ length: 12 }).map((_, i) => <PosterSkeleton key={i} />)
        ) : data.items.length === 0 ? (
          <div className="col-span-full rounded-xl border border-line bg-surface p-10 text-center">
            <p className="font-display text-lg font-bold">No movies match these filters</p>
            <p className="mt-1 text-sm text-muted">Try removing a filter or searching a shorter title.</p>
          </div>
        ) : (
          data.items.map((m) => <PosterCard key={m.id} movie={m} />)
        )}
      </div>

      {data && data.pages > 1 && <Pagination page={page} pages={data.pages} onGo={goPage} />}
    </div>
  )
}

function Pagination({ page, pages, onGo }) {
  // Show first, last, and a window of two either side of the current page.
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b)
  const btn = 'grid h-9 min-w-9 place-items-center rounded-full px-3 text-sm transition'
  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
      <button type="button" disabled={page === 1} onClick={() => onGo(page - 1)} className={`${btn} text-muted hover:text-ink disabled:opacity-30`}>
        Prev
      </button>
      {nums.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - nums[i - 1] > 1 && <span className="px-1 text-muted" aria-hidden="true">…</span>}
          <button
            type="button"
            onClick={() => onGo(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            className={`${btn} ${p === page ? 'bg-accent font-semibold text-white' : 'text-muted hover:bg-surface hover:text-ink'}`}
          >
            {p}
          </button>
        </span>
      ))}
      <button type="button" disabled={page === pages} onClick={() => onGo(page + 1)} className={`${btn} text-muted hover:text-ink disabled:opacity-30`}>
        Next
      </button>
    </nav>
  )
}
