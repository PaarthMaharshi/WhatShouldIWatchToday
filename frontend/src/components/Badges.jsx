import { Link } from 'react-router-dom'
import { toTen } from '../format'
import { PlayIcon, StarIcon } from './Icons'

/** Read-only 5-star display of a MovieLens average (out of 5). */
export function Stars({ rating, size = 14, className = '' }) {
  if (rating == null) return null
  const full = Math.round(rating)
  return (
    <span className={`inline-flex gap-1 ${className}`} role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} filled={n <= full} width={size} height={size} className={n <= full ? '' : 'opacity-40'} />
      ))}
    </span>
  )
}

/** Big red "7.7 /10" rating used in the hero and previews. */
export function BigRating({ rating, className = '' }) {
  if (rating == null) return null
  return (
    <p className={`font-display font-bold text-accent ${className}`} aria-label={`Rated ${toTen(rating)} out of 10`}>
      <span className="text-5xl">{toTen(rating)}</span>
      <sup className="ml-1 align-super text-sm font-medium text-muted">10</sup>
    </p>
  )
}

/** Small numeric rating (e.g. on cards and posters). */
export function RatingPill({ rating, className = '' }) {
  if (rating == null) return null
  return (
    <span className={`font-display text-sm font-bold text-white drop-shadow ${className}`}>
      <span className="sr-only">Rating </span>
      {toTen(rating)}
    </span>
  )
}

/** "92% match" badge on recommendations. */
export function MatchBadge({ match, className = '' }) {
  if (match == null) return null
  return (
    <span
      className={`inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 font-display text-[11px] font-bold text-accent ${className}`}
      title="How strongly this movie ranks for you, relative to your top 50"
    >
      {match}% match
    </span>
  )
}

/** "Because you liked X" explanation line. */
export function ReasonLine({ reason, className = '' }) {
  if (!reason) return null
  if (reason.type === 'because_you_liked') {
    return (
      <p className={`truncate text-xs text-muted ${className}`}>
        Because you liked{' '}
        <Link to={`/movie/${reason.movie_id}`} className="font-medium text-ink hover:text-accent">
          {reason.title}
        </Link>
      </p>
    )
  }
  return <p className={`truncate text-xs text-muted ${className}`}>{reason.text}</p>
}

/** Red circular play badge with an optional label (runtime). */
export function PlayBadge({ label, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs text-white ${className}`}>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent">
        <PlayIcon width={12} height={12} />
      </span>
      {label}
    </span>
  )
}
