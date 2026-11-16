import { useState } from 'react'
import { hueFor } from '../format'

/** Gradient placeholder shown when there is no TMDB image (or it fails). */
function Placeholder({ movie, variant, label }) {
  const h = hueFor(movie.id)
  if (!label) {
    return (
      <div
        className="h-full w-full"
        style={{ background: `linear-gradient(135deg, hsl(${h} 45% 30%), hsl(${(h + 40) % 360} 40% 12%) 75%)` }}
        aria-hidden="true"
      />
    )
  }
  return (
    <div
      className="flex h-full w-full flex-col justify-end p-4 text-left"
      style={{
        background: `radial-gradient(120% 90% at 20% 10%, hsl(${h} 55% 38%), hsl(${(h + 40) % 360} 45% 14%) 70%, #0d0d10)`,
      }}
      aria-hidden="true"
    >
      <span
        className={`font-display font-extrabold uppercase leading-tight tracking-[0.12em] text-white/90 ${
          variant === 'backdrop' ? 'text-2xl sm:text-4xl' : 'text-sm sm:text-base'
        }`}
      >
        {movie.title}
      </span>
      {movie.year && <span className="mt-1 text-xs text-white/60">{movie.year}</span>}
    </div>
  )
}

/**
 * Lazy-loaded movie image with graceful fallback.
 * variant="poster" uses the poster, "backdrop" prefers the backdrop.
 * label=false hides the title on the placeholder (when the page shows it anyway).
 */
export default function Artwork({ movie, variant = 'poster', className = '', eager = false, label = true }) {
  const src = variant === 'backdrop' ? movie.backdrop || movie.poster : movie.poster
  const [failed, setFailed] = useState(false)
  return (
    <div className={`overflow-hidden bg-surface-2 ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={`${movie.title} ${variant}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Placeholder movie={movie} variant={variant} label={label} />
      )}
    </div>
  )
}
