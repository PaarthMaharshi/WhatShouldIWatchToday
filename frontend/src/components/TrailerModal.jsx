import { useEffect, useRef } from 'react'
import { CloseIcon } from './Icons'

/** YouTube trailer in an accessible modal (Esc or backdrop click closes). */
export default function TrailerModal({ youtubeKey, title, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} trailer`}
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close trailer"
          className="absolute -top-11 right-0 rounded-full p-2 text-white hover:bg-white/10"
        >
          <CloseIcon />
        </button>
        <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-card">
          {youtubeKey ? (
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1`}
              title={`${title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center text-sm text-white/70">
              No trailer available yet. Trailers come from TMDB: add a TMDB_API_KEY to .env and
              run <code className="mx-1 rounded bg-white/10 px-1">python -m ml.tmdb</code>.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
