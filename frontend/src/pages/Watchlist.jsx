import { Link } from 'react-router-dom'
import { api } from '../api'
import PosterCard from '../components/PosterCard'
import { ErrorNote, PosterSkeleton } from '../components/Skeletons'
import { useApp } from '../context'
import { useAsync } from '../hooks'

/** Every movie the user has bookmarked. Removing one (ribbon) updates the list live. */
export default function Watchlist() {
  const { userId, watchlist } = useApp()
  const list = useAsync(() => (userId ? api.watchlist(userId) : Promise.resolve(null)), [userId, watchlist.size])

  if (!userId) {
    return (
      <section className="container-x py-24 text-center">
        <p className="eyebrow">Watchlist</p>
        <h1 className="mt-3 text-4xl font-bold">Log in to see your watchlist</h1>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/login" className="inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark">Log in</Link>
          <Link to="/welcome" className="inline-block rounded-full border border-ink px-6 py-3 text-sm font-semibold hover:bg-ink hover:text-bg">Sign up</Link>
        </div>
      </section>
    )
  }

  const items = list.data ?? []

  return (
    <div className="container-x py-12">
      <p className="eyebrow">Your account</p>
      <h1 className="mt-2 text-4xl font-bold">My watchlist</h1>
      <p className="mt-2 text-sm text-muted">
        {list.data ? `${items.length} movie${items.length === 1 ? '' : 's'} saved for later.` : 'Loading your watchlist…'}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        {list.error ? (
          <div className="col-span-full"><ErrorNote error={list.error} onRetry={list.reload} /></div>
        ) : list.loading && !list.data ? (
          Array.from({ length: 12 }).map((_, i) => <PosterSkeleton key={i} />)
        ) : (
          items.map((m) => <PosterCard key={m.id} movie={m} />)
        )}
      </div>

      {list.data && items.length === 0 && (
        <div className="mt-6 border border-line bg-surface p-8 text-center">
          <p className="font-semibold">Your watchlist is empty</p>
          <p className="mt-1 text-sm text-muted">Tap the bookmark on any poster to save it here.</p>
          <Link to="/browse" className="label-caps mt-5 inline-block border border-ink px-6 py-3 text-[11px] transition hover:bg-ink hover:text-bg">Browse movies</Link>
        </div>
      )}
    </div>
  )
}
