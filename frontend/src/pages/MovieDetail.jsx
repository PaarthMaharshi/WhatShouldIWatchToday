import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import Artwork from '../components/Artwork'
import { Stars } from '../components/Badges'
import DetailTabs from '../components/detail/DetailTabs'
import RelatedMovies from '../components/detail/RelatedMovies'
import { ChevronRight, GlobeIcon, ShareIcon } from '../components/Icons'
import { BookmarkButton } from '../components/PosterCard'
import { ErrorNote } from '../components/Skeletons'
import StarRating from '../components/StarRating'
import TrailerModal from '../components/TrailerModal'
import { useApp } from '../context'
import { useAsync } from '../hooks'
import { money, synopsis, toTen } from '../format'

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null

function DetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton h-[260px] rounded-none sm:h-[380px]" />
      <div className="container-x mt-10 space-y-4">
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-4 w-1/3" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr_1.2fr]">
          <div className="skeleton aspect-[2/3]" />
          <div className="space-y-3"><div className="skeleton h-4" /><div className="skeleton h-4 w-4/5" /><div className="skeleton h-24" /></div>
          <div className="skeleton h-64" />
        </div>
      </div>
    </div>
  )
}

function ShareButton({ title }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url: location.href })
      else {
        await navigator.clipboard.writeText(location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* user cancelled */
    }
  }
  return (
    <button type="button" onClick={share} className="flex items-center gap-2 text-xs text-muted hover:text-ink">
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span> <ShareIcon width={16} height={16} />
    </button>
  )
}

/** Movie Detail (Reference A): banner, title block, poster + credits + tabs, quote, related. */
export default function MovieDetail() {
  const { id } = useParams()
  const { userId } = useApp()
  const { data: m, loading, error, reload } = useAsync(() => api.movie(id, userId), [id, userId])
  const [trailer, setTrailer] = useState(false)
  const [expanded, setExpanded] = useState(false)

  if (loading) return <DetailSkeleton />
  if (error) {
    return (
      <div className="container-x py-20">
        <ErrorNote error={error} onRetry={error.message === 'Movie not found' ? undefined : reload} />
        <Link to="/browse" className="link-underline mt-6">Browse movies</Link>
      </div>
    )
  }

  const meta = [
    ['Rating', m.certification || 'NR'],
    ['Running time', m.runtime ? `${m.runtime} mins` : '—'],
    ['Budget', money(m.budget) || '—'],
    ['Release date', longDate(m.release_date) || m.year || '—'],
  ]
  const plot = synopsis(m)
  const quote = m.tagline
    ? { text: m.tagline, by: 'Tagline' }
    : m.tags.length
      ? { text: m.tags.slice(0, 4).join(' · '), by: 'What MovieLens viewers say' }
      : null

  return (
    <article>
      {/* Cinematic backdrop banner */}
      <div className="relative">
        <Artwork movie={m} variant="backdrop" eager label={false} className="h-[240px] w-full sm:h-[380px] lg:h-[440px]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-transparent to-black/30" />
      </div>

      {/* Title block */}
      <header className="container-x relative -mt-6 sm:-mt-10">
        <div className="flex flex-col gap-6 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold uppercase leading-tight tracking-[0.12em] sm:text-5xl">
              {m.title}
              {m.year && <span className="ml-3 align-middle font-sans text-base font-normal tracking-normal text-muted">({m.year})</span>}
            </h1>
            <p className="mt-2 text-sm">
              {m.genres.map((g, i) => (
                <Fragment key={g}>
                  {i > 0 && <span className="mx-2 text-muted" aria-hidden="true">|</span>}
                  <Link to={`/browse?genre=${encodeURIComponent(g)}`} className="hover:text-accent">{g}</Link>
                </Fragment>
              ))}
            </p>
            <div className="mt-3 flex items-center gap-3 text-ink">
              <Stars rating={m.rating} size={16} />
              <span className="text-xs text-muted">{m.rating != null ? `${toTen(m.rating)}/10 · ${m.rating_count} ratings` : 'Not rated yet'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex gap-5">
              <ShareButton title={m.title} />
              {m.tmdb_id && (
                <a href={`https://www.themoviedb.org/movie/${m.tmdb_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-muted hover:text-ink">
                  TMDB page <GlobeIcon width={16} height={16} />
                </a>
              )}
              {m.imdb_id && (
                <a href={`https://www.imdb.com/title/${m.imdb_id}/`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-muted hover:text-ink">
                  IMDb <GlobeIcon width={16} height={16} />
                </a>
              )}
            </div>
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {meta.map(([k, v], i) => (
                <Fragment key={k}>
                  {i > 0 && <ChevronRight width={14} height={14} className="hidden text-muted sm:block" />}
                  <div>
                    <dt className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted">{k}</dt>
                    <dd className="text-sm">{v}</dd>
                  </div>
                </Fragment>
              ))}
            </dl>
          </div>
        </div>
      </header>

      {/* Poster | credits + plot | icon tabs */}
      <section className="container-x mt-10 grid gap-10 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr_1.25fr]">
        <Artwork movie={m} className="mx-auto aspect-[2/3] w-48 shadow-card md:w-full" />

        <div className="space-y-5 text-sm">
          <Credit label="Director" value={m.director.join(', ')} />
          <Credit label="Writer" value={m.writer.join(', ')} />
          <Credit label="Cast" value={m.cast.slice(0, 4).map((c) => c.name).join(', ')} />
          <div className="border-t border-line pt-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.15em]">Plot</h2>
            <p className={`mt-2 leading-relaxed text-muted ${expanded ? '' : 'line-clamp-5'}`}>{plot}</p>
            {plot.length > 260 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="mt-4 bg-ink px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-bg hover:bg-accent hover:text-white"
              >
                {expanded ? 'Read less' : 'Read more'}
              </button>
            )}
          </div>
          <div className="space-y-3 border-t border-line pt-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.15em]">Your rating</h2>
            <StarRating key={m.id} movieId={m.id} value={m.user_rating} />
            <div className="flex items-center gap-2 text-xs text-muted">
              <BookmarkButton movie={m} className="!text-accent" /> Watchlist
            </div>
          </div>
        </div>

        <div className="md:col-span-2 lg:col-span-1">
          <DetailTabs movie={m} onPlay={() => setTrailer(true)} />
        </div>
      </section>

      {/* Memorable quote strip */}
      {quote && (
        <figure className="mt-16 bg-surface py-10 text-center">
          <blockquote className="container-x font-serif text-xl italic text-muted sm:text-2xl">“{quote.text}”</blockquote>
          <figcaption className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em]">{quote.by}</figcaption>
        </figure>
      )}

      <div className={quote ? '' : 'mt-16'}>
        <RelatedMovies movies={m.similar} />
      </div>

      {trailer && <TrailerModal youtubeKey={m.trailer_youtube} title={m.title} onClose={() => setTrailer(false)} />}
    </article>
  )
}

function Credit({ label, value }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.15em]">{label}</h2>
      <p className="mt-0.5 text-muted">{value || <span className="italic">Available with TMDB data</span>}</p>
    </div>
  )
}
