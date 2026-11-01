import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAsync } from '../../hooks'
import { genreLine, runtime, synopsis, toTen } from '../../format'
import Artwork from '../Artwork'
import { PlayBadge } from '../Badges'
import { ErrorNote } from '../Skeletons'

function CastAvatars({ cast = [] }) {
  if (!cast.length) return null
  const shown = cast.slice(0, 3)
  return (
    <div className="mt-4 flex items-center -space-x-2" aria-label={`Cast: ${cast.map((c) => c.name).join(', ')}`}>
      {shown.map((c) =>
        c.photo ? (
          <img key={c.name} src={c.photo} alt="" loading="lazy" className="h-9 w-9 rounded-full border-2 border-bg object-cover" />
        ) : (
          <span key={c.name} className="grid h-9 w-9 place-items-center rounded-full border-2 border-bg bg-surface-2 text-[10px] font-bold">
            {c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </span>
        ),
      )}
      {cast.length > 3 && (
        <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-bg bg-accent text-[10px] font-bold text-white">
          +{cast.length - 3}
        </span>
      )}
    </div>
  )
}

/** Big vertical title list; hovering or focusing a title updates the preview card. */
export default function Greats() {
  const list = useAsync(() => api.movies({ sort: 'popular', page_size: 7 }), [])
  const [active, setActive] = useState(0)
  const movie = list.data?.items[active]
  const detail = useAsync(() => (movie ? api.movie(movie.id) : Promise.resolve(null)), [movie?.id])

  if (list.error) return <div className="container-x mt-24"><ErrorNote error={list.error} onRetry={list.reload} /></div>

  return (
    <section className="container-x mt-24" aria-labelledby="greats-title">
      <h2 id="greats-title" className="text-3xl font-bold">Most watched</h2>
      <p className="mt-3 text-sm text-muted">The films MovieLens viewers rated most often. Hover a title to preview it.</p>
      <div className="mt-8 grid gap-10 md:grid-cols-[1.3fr_1fr]">
        <ol className="space-y-3">
          {(list.data?.items ?? Array.from({ length: 7 }, (_, i) => ({ id: i }))).map((m, i) => (
            <li key={m.id}>
              {m.title ? (
                <Link
                  to={`/movie/${m.id}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={`block font-display text-2xl font-bold leading-tight transition-colors sm:text-4xl ${
                    i === active ? 'text-ink' : 'text-muted/40 hover:text-muted'
                  }`}
                >
                  {m.title}
                </Link>
              ) : (
                <div className="skeleton h-9 w-3/4" />
              )}
            </li>
          ))}
        </ol>

        {movie && (
          <article className="self-start md:sticky md:top-24" aria-live="polite">
            <Link to={`/movie/${movie.id}`} className="relative block overflow-hidden rounded-md shadow-card">
              <Artwork movie={movie} variant="backdrop" className="aspect-[16/10]" />
              <PlayBadge label={runtime(movie.runtime) || movie.genres[0]} className="absolute bottom-3 left-3" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted">{synopsis(movie)}</p>
            <CastAvatars cast={detail.data?.cast} />
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
              <span className="font-display font-semibold">{genreLine(movie, 1)}</span>
              <span className="font-display font-bold">{toTen(movie.rating)}</span>
            </div>
            <Link to={`/movie/${movie.id}`} className="link-underline mt-6">Watch Now</Link>
          </article>
        )}
      </div>
    </section>
  )
}
