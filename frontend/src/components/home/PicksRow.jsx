import { Link } from 'react-router-dom'
import { genreLine, runtime } from '../../format'
import Artwork from '../Artwork'
import { MatchBadge, PlayBadge, RatingPill, ReasonLine } from '../Badges'
import Carousel from '../Carousel'
import { CardSkeleton, ErrorNote } from '../Skeletons'

// Vertical offsets that give Reference B's staggered "Editors choice" look.
const STAGGER = ['md:mt-14', 'md:mt-0', 'md:mt-8', 'md:mt-2']

function PickCard({ movie, index }) {
  return (
    <article className={`w-64 shrink-0 snap-start sm:w-72 ${STAGGER[index % STAGGER.length]}`}>
      <Link to={`/movie/${movie.id}`} className="group relative block overflow-hidden rounded-md shadow-card">
        <Artwork movie={movie} variant="backdrop" className="aspect-[4/3] transition-transform duration-500 group-hover:scale-105" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <PlayBadge label={runtime(movie.runtime) || `${movie.genres[0] ?? 'Film'}`} className="absolute bottom-3 left-3" />
        <RatingPill rating={movie.rating} className="absolute bottom-3 right-3" />
      </Link>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold leading-snug">
          <Link to={`/movie/${movie.id}`} className="hover:text-accent">{movie.title}</Link>
        </h3>
        <MatchBadge match={movie.match} className="shrink-0" />
      </div>
      <p className="mt-0.5 text-xs text-muted">{genreLine(movie)}</p>
      <ReasonLine reason={movie.reason} className="mt-1" />
    </article>
  )
}

/** "Top picks for you" row, filled by the selected model (hybrid by default). */
export default function PicksRow({ title, subtitle, data, loading, error, onRetry }) {
  return (
    <section className="container-x mt-16" aria-labelledby="picks-title">
      <div className="flex items-end justify-between gap-6">
        <div className="max-w-md">
          <h2 id="picks-title" className="text-3xl font-bold">{title}</h2>
          <p className="mt-3 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="hidden h-px flex-1 bg-line md:block" aria-hidden="true" />
        <Link to="/for-you" className="link-underline shrink-0">Explore</Link>
      </div>
      {data?.note && (
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-ink">{data.note}</p>
      )}
      <div className="mt-8">
        {error ? (
          <ErrorNote error={error} onRetry={onRetry} />
        ) : loading ? (
          <div className="flex gap-5 overflow-hidden">
            {STAGGER.map((s, i) => (
              <CardSkeleton key={i} className={`w-64 shrink-0 sm:w-72 ${s}`} />
            ))}
          </div>
        ) : (
          <Carousel label={title} arrowClass="border-line bg-bg text-ink hover:border-accent">
            {data.items.map((m, i) => (
              <PickCard key={m.id} movie={m} index={i} />
            ))}
          </Carousel>
        )}
      </div>
    </section>
  )
}
