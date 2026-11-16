import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from './Icons'

/**
 * Horizontal scroll-snap carousel with arrow buttons and pagination dots.
 * Children are the slides; native scrolling keeps touch and keyboard working.
 */
export default function Carousel({
  children,
  label,
  arrowClass = '',
  dots = true,
  dotOn = 'bg-accent',
  dotOff = 'bg-muted/40',
}) {
  const track = useRef(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)

  const measure = () => {
    const el = track.current
    // A hidden or not-yet-laid-out carousel measures 0px wide; dividing by it
    // gives Infinity/NaN, which would crash the dots below.
    if (!el || el.clientWidth <= 0) return
    const n = Math.ceil(el.scrollWidth / el.clientWidth - 0.05)
    setPages(Number.isFinite(n) ? Math.min(Math.max(1, n), 50) : 1)
    setPage(Math.round(el.scrollLeft / el.clientWidth) || 0)
  }

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [children])

  const go = (dir) => {
    const el = track.current
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={page === 0}
        aria-label="Previous"
        className={`absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 place-items-center rounded-full border p-2 transition disabled:opacity-30 sm:grid lg:-left-14 ${arrowClass}`}
      >
        <ChevronLeft />
      </button>
      <div
        ref={track}
        onScroll={measure}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={page >= pages - 1}
        aria-label="Next"
        className={`absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 place-items-center rounded-full border p-2 transition disabled:opacity-30 sm:grid lg:-right-14 ${arrowClass}`}
      >
        <ChevronRight />
      </button>
      {dots && pages > 1 && (
        <div className="mt-6 flex justify-center gap-2" aria-hidden="true">
          {Array.from({ length: pages }).map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === page ? `w-5 ${dotOn}` : `w-1.5 ${dotOff}`}`} />
          ))}
        </div>
      )}
    </div>
  )
}
