import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import EditProfile from '../components/EditProfile'
import { api } from '../api'
import { ReasonLine } from '../components/Badges'
import Carousel from '../components/Carousel'
import { Reveal } from '../components/Motion'
import ModelSwitcher from '../components/ModelSwitcher'
import PosterCard from '../components/PosterCard'
import { ErrorNote, PosterSkeleton } from '../components/Skeletons'
import StarRating from '../components/StarRating'
import { useApp } from '../context'
import { useAsync } from '../hooks'

const TOP = 12

/** A recommendation tile with its explanation and a quick 1-5 star rating. */
function RecTile({ movie }) {
  return (
    <div>
      <PosterCard movie={movie} showMatch />
      <ReasonLine reason={movie.reason} className="mt-2" />
      <div className="mt-1">
        <StarRating movieId={movie.id} size={15} compact label={`Rate ${movie.title}`} />
      </div>
    </div>
  )
}

/** Group recommendations by the liked movie that explains them. */
function becauseGroups(items, min = 2, max = 3) {
  const groups = new Map()
  items.forEach((m) => {
    if (m.reason?.type !== 'because_you_liked') return
    const g = groups.get(m.reason.movie_id) ?? { title: m.reason.title, id: m.reason.movie_id, items: [] }
    g.items.push(m)
    groups.set(m.reason.movie_id, g)
  })
  return [...groups.values()].filter((g) => g.items.length >= min).sort((a, b) => b.items.length - a.items.length).slice(0, max)
}

function Row({ title, children }) {
  return (
    <Reveal>
      <section className="mt-16">
        <h2 className="font-display text-2xl font-black uppercase tracking-tight">{title}</h2>
        <div className="mt-6">
          <Carousel label={typeof title === 'string' ? title : 'Movies'} arrowClass="border-line bg-bg text-ink hover:border-accent">
            {children}
          </Carousel>
        </div>
      </section>
    </Reveal>
  )
}

export default function ForYou() {
  const { user, userId, model, recsVersion, watchlist } = useApp()
  const [params] = useSearchParams()
  const welcome = params.get('welcome') === '1'
  const [editing, setEditing] = useState(params.get('edit') === '1')
  const none = () => Promise.resolve(null)
  const recs = useAsync(() => (userId ? api.recommendations(userId, model, 36) : none()), [userId, model, recsVersion])
  const rated = useAsync(() => (userId ? api.userRatings(userId) : none()), [userId, recsVersion])
  const watch = useAsync(() => (userId ? api.watchlist(userId) : none()), [userId, watchlist.size])

  if (!userId) {
    return (
      <section className="container-x py-24 text-center">
        <p className="eyebrow">For you</p>
        <h1 className="mt-3 text-4xl font-bold">Your personal picks live here</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">Tell us a few genres and favourite films and the recommender takes it from there.</p>
        <Link to="/welcome" className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark">
          Get started
        </Link>
      </section>
    )
  }

  const items = recs.data?.items ?? []
  const groups = becauseGroups(items.slice(TOP))

  return (
    <div className="container-x py-12">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">For you{user ? `, ${user.name}` : ''}</p>
          <h1 className="mt-2 text-4xl font-bold">Top picks for you</h1>
          <p className="mt-2 text-sm text-muted">
            {recs.data ? (
              <>Model: <span className="font-semibold text-ink">{recs.data.label}</span> · based on {recs.data.rated_count} rating{recs.data.rated_count === 1 ? '' : 's'}. Rate a movie and the list refreshes instantly.</>
            ) : 'Loading your recommendations…'}
          </p>
        </div>
        <div>
          <p className="eyebrow mb-2">Compare models live</p>
          <ModelSwitcher />
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-line py-4 text-sm">
        <span className="label-caps text-[10px] text-muted">Your taste</span>
        {user?.genres?.length
          ? user.genres.map((g) => <span key={g} className="chip chip-on !cursor-default">{g}</span>)
          : <span className="text-muted">No favourite genres set</span>}
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} aria-expanded={editing}
            className="label-caps ml-auto border border-ink px-4 py-2 text-[10px] transition hover:bg-ink hover:text-bg">
            Edit profile ✎
          </button>
        )}
      </div>
      {editing && (user
        ? <EditProfile key={user.id} onClose={() => setEditing(false)} />
        : <div className="skeleton mt-6 h-64" aria-hidden="true" />)}

      {welcome && (
        <div role="status" className="mt-6 flex flex-col gap-1 bg-accent px-6 py-5 text-bg">
          <p className="label-caps">Welcome{user ? `, ${user.name}` : ''}!</p>
          <p className="text-sm">
            {rated.data
              ? `We saved your ${rated.data.length} favourite${rated.data.length === 1 ? '' : 's'} (scroll down to "Your ratings"). Your picks below are built from them; rate a few more to sharpen them.`
              : 'Saving your favourites…'}
          </p>
        </div>
      )}

      {recs.data?.note && (
        <p className="mt-6 border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-ink">{recs.data.note}</p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        {recs.error ? (
          <div className="col-span-full"><ErrorNote error={recs.error} onRetry={recs.reload} /></div>
        ) : recs.loading && !recs.data ? (
          Array.from({ length: TOP }).map((_, i) => <PosterSkeleton key={i} />)
        ) : (
          items.slice(0, TOP).map((m) => <RecTile key={m.id} movie={m} />)
        )}
      </div>

      {groups.map((g) => (
        <Row
          key={g.id}
          title={<>Because you liked <Link to={`/movie/${g.id}`} className="text-accent hover:underline">{g.title}</Link></>}
        >
          {g.items.map((m) => (
            <div key={m.id} className="w-36 shrink-0 snap-start sm:w-44"><PosterCard movie={m} showMatch /></div>
          ))}
        </Row>
      ))}

      {watch.data?.length > 0 && (
        <Row title="Your watchlist">
          {watch.data.map((m) => (
            <div key={m.id} className="w-36 shrink-0 snap-start sm:w-44"><PosterCard movie={m} /></div>
          ))}
        </Row>
      )}

      {rated.data?.length > 0 && (
        <Row title={`Your ratings (${rated.data.length})`}>
          {rated.data.slice(0, 40).map((m) => (
            <div key={m.id} className="w-36 shrink-0 snap-start sm:w-44">
              <PosterCard movie={m} />
              <div className="mt-2">
                <StarRating movieId={m.id} value={Math.round(m.user_rating)} size={14} compact label={`Your rating for ${m.title}`} />
              </div>
            </div>
          ))}
        </Row>
      )}
    </div>
  )
}
