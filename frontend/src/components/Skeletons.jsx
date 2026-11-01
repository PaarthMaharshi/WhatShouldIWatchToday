// Loading placeholders that match the shape of the real content.

export function CardSkeleton({ className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="skeleton aspect-[4/3] w-full" />
      <div className="skeleton mt-3 h-4 w-3/4" />
      <div className="skeleton mt-2 h-3 w-1/2" />
    </div>
  )
}

export function PosterSkeleton({ className = '' }) {
  return <div className={`skeleton aspect-[2/3] w-full ${className}`} aria-hidden="true" />
}

export function HeroSkeleton() {
  return (
    <div className="grid min-h-[520px] items-center gap-10 md:grid-cols-[1fr_1.4fr]" aria-hidden="true">
      <div className="space-y-4">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-12 w-4/5" />
        <div className="skeleton h-10 w-24" />
        <div className="skeleton h-3 w-2/3" />
      </div>
      <div className="skeleton aspect-[16/10] w-full" />
    </div>
  )
}

export function ErrorNote({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
      <p className="font-medium text-ink">Could not load this section.</p>
      <p className="mt-1">{error?.message || 'Is the API running on port 8000?'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 font-semibold text-accent hover:underline">
          Try again
        </button>
      )}
    </div>
  )
}
