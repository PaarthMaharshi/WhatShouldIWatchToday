import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import Artwork from '../components/Artwork'
import DetailTabs from '../components/detail/DetailTabs'
import MovieHero from '../components/detail/MovieHero'
import RelatedMovies from '../components/detail/RelatedMovies'
import { Reveal } from '../components/Motion'
import { BookmarkButton } from '../components/PosterCard'
import { ErrorNote } from '../components/Skeletons'
import StarRating from '../components/StarRating'
import TrailerModal from '../components/TrailerModal'
import { useApp } from '../context'
import { useAsync } from '../hooks'
import { money, synopsis } from '../format'

function DetailSkeleton() {
  return (
    <div className="container-x py-8" aria-hidden="true">
      <div className="skeleton h-[560px] rounded-2xl" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr_1.2fr]">
        <div className="skeleton aspect-[2/3]" />
        <div className="space-y-3"><div className="skeleton h-4" /><div className="skeleton h-4 w-4/5" /><div className="skeleton h-24" /></div>
        <div className="skeleton h-64" />
      </div>
    </div>
  )
}

function Credit({ label, value }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em]">{label}</h3>
      <p className="mt-0.5 text-muted">{value || <span className="italic">Available with TMDB data</span>}</p>
    </div>
  )
}

/**
 * Movie page: a "Joker"-style cinematic hero (MovieHero), then the details
 * (poster, credits, your rating, info tabs), a quote strip and the red
 * Related Movies band powered by Content-kNN.
 */
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

  const plot = synopsis(m)
  const quote = m.tagline
    ? { text: m.tagline, by: 'Tagline' }
    : m.tags.length
      ? { text: m.tags.slice(0, 4).join(' · '), by: 'What MovieLens viewers say' }
      : null

  return (
    <article>
      <MovieHero movie={m} onPlay={() => setTrailer(true)} />

      {/* Poster | credits + plot + your rating | info tabs */}
      <Reveal>
      <section id="about" className="container-x mt-20 grid scroll-mt-24 gap-10 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr_1.25fr]">
        <h2 className="sr-only">About {m.title}</h2>
        <Artwork movie={m} className="mx-auto aspect-[2/3] w-48 rounded-lg shadow-card md:w-full" />

        <div className="space-y-5 text-sm">
          <Credit label="Writer" value={m.writer.join(', ')} />
          <Credit label="Cast" value={m.cast.slice(0, 5).map((c) => c.name).join(', ')} />
          {(m.budget || m.revenue) && (
            <Credit label="Budget / box office" value={[money(m.budget), money(m.revenue)].filter(Boolean).join(' / ')} />
          )}
          <div className="border-t border-line pt-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em]">Plot</h3>
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
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em]">Your rating</h3>
            <StarRating key={m.id} movieId={m.id} value={m.user_rating} />
            <div className="flex items-center gap-2 text-xs text-muted">
              <BookmarkButton movie={m} className="!text-accent" /> Watchlist
            </div>
            <Link to={`/forum?movie=${m.id}`} className="label-caps inline-block border border-ink px-3 py-2 text-[10px] transition hover:bg-ink hover:text-bg">
              Discuss on the forum →
            </Link>
          </div>
        </div>

        <div id="cast" className="scroll-mt-24 md:col-span-2 lg:col-span-1">
          <DetailTabs movie={m} onPlay={() => setTrailer(true)} />
        </div>
      </section>
      </Reveal>

      {quote && (
        <figure className="mt-16 bg-surface py-10 text-center">
          <blockquote className="container-x font-serif text-xl italic text-muted sm:text-2xl">“{quote.text}”</blockquote>
          <figcaption className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em]">{quote.by}</figcaption>
        </figure>
      )}

      <Reveal distance={40}>
        <div id="related" className={`scroll-mt-24 ${quote ? '' : 'mt-16'}`}>
          <RelatedMovies movies={m.similar} />
        </div>
      </Reveal>

      {trailer && <TrailerModal youtubeKey={m.trailer_youtube} title={m.title} onClose={() => setTrailer(false)} />}
    </article>
  )
}
