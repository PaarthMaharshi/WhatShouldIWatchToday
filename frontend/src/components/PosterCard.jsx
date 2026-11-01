import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context'
import { genreLine } from '../format'
import Artwork from './Artwork'
import { MatchBadge, RatingPill } from './Badges'
import { BookmarkIcon } from './Icons'

/** Bookmark ribbon that toggles the watchlist (Reference B, top-right). */
export function BookmarkButton({ movie, className = '' }) {
  const { userId, watchlist, toggleWatch } = useApp()
  const navigate = useNavigate()
  const on = watchlist.has(movie.id)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`}
      onClick={() => (userId ? toggleWatch(movie.id) : navigate('/welcome'))}
      className={`transition hover:scale-110 ${on ? 'text-accent' : 'text-white/80'} ${className}`}
    >
      <BookmarkIcon filled={on} width={22} height={22} />
    </button>
  )
}

/** Poster tile: rating top-left, bookmark top-right, title over a gradient. */
export default function PosterCard({ movie, showMatch = false }) {
  return (
    <article className="group relative">
      <Link to={`/movie/${movie.id}`} className="block overflow-hidden rounded-lg shadow-card">
        <Artwork movie={movie} label={false} className="aspect-[2/3] transition-transform duration-500 group-hover:scale-105" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />
        <RatingPill rating={movie.rating} className="absolute left-3 top-3" />
        <div className="absolute inset-x-3 bottom-3">
          {showMatch && <MatchBadge match={movie.match} className="mb-1 bg-black/50" />}
          <h3 className="line-clamp-2 font-display text-sm font-semibold text-white">{movie.title}</h3>
          <p className="mt-0.5 truncate text-[11px] text-white/60">{genreLine(movie, 2)}</p>
        </div>
      </Link>
      <BookmarkButton movie={movie} className="absolute right-3 top-0 drop-shadow" />
    </article>
  )
}
