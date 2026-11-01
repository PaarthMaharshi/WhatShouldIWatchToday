import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, synopsis, toTen } from '../../format'
import Artwork from '../Artwork'
import { BookIcon, CameraIcon, ExpandIcon, InfoIcon, PlayIcon, QuoteIcon, UsersIcon } from '../Icons'

// Reference A's red circular icon tabs. "Awards" and "Quotes" have no free
// data source, so they became "Tags" (MovieLens user tags) and "Facts".
const TABS = [
  { key: 'trailer', label: 'Trailer', Icon: PlayIcon },
  { key: 'cast', label: 'Cast & Crew', Icon: UsersIcon },
  { key: 'plot', label: 'Plot', Icon: BookIcon },
  { key: 'gallery', label: 'Gallery', Icon: CameraIcon },
  { key: 'tags', label: 'Tags', Icon: QuoteIcon },
  { key: 'facts', label: 'Facts', Icon: InfoIcon },
]

const NoTmdb = ({ what }) => (
  <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">
    {what} come from TMDB. Add a <code className="rounded bg-surface-2 px-1">TMDB_API_KEY</code> to
    <code className="mx-1 rounded bg-surface-2 px-1">.env</code> to fill this in.
  </p>
)

function Trailer({ movie, onPlay }) {
  return (
    <button type="button" onClick={onPlay} className="group relative block w-full overflow-hidden rounded-sm text-left" aria-label={`Play ${movie.title} trailer`}>
      <Artwork movie={movie} variant="backdrop" label={false} className="aspect-video" />
      <span className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/35">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg transition group-hover:scale-110">
          <PlayIcon width={22} height={22} />
        </span>
      </span>
      <ExpandIcon className="absolute bottom-3 right-3 text-white" width={18} height={18} />
    </button>
  )
}

function Cast({ movie }) {
  if (!movie.cast.length && !movie.director.length) return <NoTmdb what="Cast and crew" />
  return (
    <div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {movie.cast.map((c) => (
          <li key={c.name} className="text-center">
            {c.photo ? (
              <img src={c.photo} alt="" loading="lazy" className="mx-auto h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-sm font-bold">
                {c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </span>
            )}
            <span className="mt-2 block text-xs">{c.name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted">
        Directed by <span className="text-ink">{movie.director.join(', ') || 'unknown'}</span>
        {movie.writer.length > 0 && <> · Written by <span className="text-ink">{movie.writer.join(', ')}</span></>}
      </p>
    </div>
  )
}

function Gallery({ movie }) {
  if (!movie.gallery.length) return <NoTmdb what="Gallery images" />
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {movie.gallery.map((src, i) => (
        <a key={src} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded">
          <img src={src} alt={`${movie.title} still ${i + 1}`} loading="lazy" className="aspect-video w-full object-cover transition hover:scale-105" />
        </a>
      ))}
    </div>
  )
}

function Tags({ movie }) {
  if (!movie.tags.length) {
    return <p className="text-sm text-muted">No MovieLens viewer has tagged this movie yet.</p>
  }
  return (
    <div>
      <p className="mb-3 text-xs text-muted">Words MovieLens viewers used for this film (they also feed the Content-kNN model).</p>
      <div className="flex flex-wrap gap-2">
        {movie.tags.map((t) => (
          <Link key={t} to={`/browse?tag=${encodeURIComponent(t)}`} className="chip">#{t}</Link>
        ))}
      </div>
    </div>
  )
}

function Facts({ movie }) {
  const hist = movie.rating_histogram
  const max = Math.max(1, ...Object.values(hist))
  const rows = [
    ['MovieLens rating', movie.rating != null ? `${toTen(movie.rating)}/10 from ${movie.rating_count} ratings` : 'Not rated yet'],
    ['TMDB rating', movie.tmdb_rating ? `${movie.tmdb_rating.toFixed(1)}/10` : null],
    ['Language', movie.language?.toUpperCase()],
    ['Budget', money(movie.budget)],
    ['Box office', money(movie.revenue)],
  ].filter(([, v]) => v)
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <figure>
        <figcaption className="eyebrow mb-2">Rating distribution</figcaption>
        {[5, 4, 3, 2, 1].map((s) => (
          <div key={s} className="mb-1 flex items-center gap-2 text-xs">
            <span className="w-6 text-muted">{s}★</span>
            <span className="h-2 flex-1 overflow-hidden rounded bg-surface-2">
              <span className="block h-full rounded bg-accent" style={{ width: `${((hist[s] || 0) / max) * 100}%` }} />
            </span>
            <span className="w-8 text-right text-muted">{hist[s] || 0}</span>
          </div>
        ))}
      </figure>
    </div>
  )
}

/** Accessible tablist (arrow keys move between tabs). */
export default function DetailTabs({ movie, onPlay }) {
  const [active, setActive] = useState('trailer')
  const refs = useRef({})

  const onKey = (e, i) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = TABS[(i + d + TABS.length) % TABS.length].key
    setActive(next)
    refs.current[next]?.focus()
  }

  const panel = {
    trailer: <Trailer movie={movie} onPlay={onPlay} />,
    cast: <Cast movie={movie} />,
    plot: (
      <div className="space-y-3 text-sm leading-relaxed">
        {movie.tagline && <p className="font-serif text-lg italic">“{movie.tagline}”</p>}
        <p className="text-muted">{synopsis(movie)}</p>
      </div>
    ),
    gallery: <Gallery movie={movie} />,
    tags: <Tags movie={movie} />,
    facts: <Facts movie={movie} />,
  }[active]

  return (
    <div>
      <div role="tablist" aria-label="Movie information" className="flex justify-between gap-2 border-b border-line pb-4">
        {TABS.map(({ key, label, Icon }, i) => (
          <button
            key={key}
            ref={(el) => (refs.current[key] = el)}
            role="tab"
            id={`tab-${key}`}
            aria-selected={active === key}
            aria-controls={`panel-${key}`}
            tabIndex={active === key ? 0 : -1}
            onClick={() => setActive(key)}
            onKeyDown={(e) => onKey(e, i)}
            className="group flex flex-col items-center gap-2"
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-full text-white transition sm:h-12 sm:w-12 ${
                active === key ? 'bg-accent ring-4 ring-accent/25' : 'bg-accent/85 group-hover:bg-accent'
              }`}
            >
              <Icon width={20} height={20} />
            </span>
            <span className={`text-[10px] sm:text-[11px] ${active === key ? 'font-semibold text-ink' : 'text-muted'}`}>{label}</span>
          </button>
        ))}
      </div>
      <p className="eyebrow mt-5 mb-3">{TABS.find((t) => t.key === active).label}</p>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {panel}
      </div>
    </div>
  )
}
