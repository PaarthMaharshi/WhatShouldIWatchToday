import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context'
import { StarIcon } from './Icons'

/**
 * Interactive 1-5 star rating, saved through the API.
 * Keyboard: it is a radio group, so Tab focuses it and arrow keys change the value.
 */
export default function StarRating({ movieId, value, onRated, size = 22, label = 'Your rating', compact = false }) {
  const { userId, rate } = useApp()
  const navigate = useNavigate()
  const [hover, setHover] = useState(null)
  const [current, setCurrent] = useState(value ?? null)
  const [status, setStatus] = useState('idle') // idle | saving | saved | error

  const save = async (n) => {
    if (!userId) {
      navigate('/welcome')
      return
    }
    setCurrent(n)
    setStatus('saving')
    try {
      const out = await rate(movieId, n)
      setStatus('saved')
      onRated?.(n, out)
    } catch {
      setStatus('error')
    }
  }

  const onKey = (e) => {
    const v = current ?? 0
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      save(Math.min(5, v + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      save(Math.max(1, v - 1))
    }
  }

  const shown = hover ?? current ?? 0
  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
        className="flex rounded-md"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            tabIndex={-1}
            onMouseEnter={() => setHover(n)}
            onClick={() => save(n)}
            className={`p-0.5 transition-transform hover:scale-110 ${n <= shown ? 'text-accent' : 'text-muted/50'}`}
          >
            <StarIcon filled={n <= shown} width={size} height={size} />
          </button>
        ))}
      </div>
      <span className={`text-xs text-muted ${compact ? 'sr-only' : ''}`} aria-live="polite">
        {status === 'saving' && 'Saving...'}
        {status === 'saved' && 'Saved - recommendations updated'}
        {status === 'error' && 'Could not save'}
        {status === 'idle' && !userId && 'Sign up to rate'}
      </span>
    </div>
  )
}
