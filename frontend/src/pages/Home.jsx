import { Link } from 'react-router-dom'
import { api } from '../api'
import Explore from '../components/Explore'
import Favorites from '../components/home/Favorites'
import Greats from '../components/home/Greats'
import Hero from '../components/home/Hero'
import PicksRow from '../components/home/PicksRow'
import { Marquee, Reveal, StarButton } from '../components/Motion'
import { useApp } from '../context'
import { homeSnapshot } from '../data/home'
import { useAsync } from '../hooks'

const MOOD_SHORTCUTS = [
  ['happy', 'Happy & light'],
  ['thrill', 'Edge of my seat'],
  ['cry', 'Need a good cry'],
  ['scared', 'Scare me'],
]

const MARQUEE = ['Drama', 'Comedy', 'Thriller', 'Romance', 'Sci-Fi', 'Animation', 'Crime', 'Horror', 'Adventure', 'Mystery']

/** "More <genre> for you": the user's own ranking inside one of their top genres. */
function TasteRow({ genre, skip = [] }) {
  const { userId, model, recsVersion } = useApp()
  const res = useAsync(() => api.recommendations(userId, model, 30, 0, { genre }), [userId, model, recsVersion, genre])
  // Leave out movies the rows above already show, so every row brings something new.
  const data = res.data && { ...res.data, items: res.data.items.filter((m) => !skip.includes(m.id)).slice(0, 12) }
  if (!res.loading && !res.error && !data?.items.length) return null
  return (
    <PicksRow
      title={`More ${genre} for you`}
      subtitle={`${genre} is one of your top genres, so here is the best of it for your taste.`}
      data={data}
      loading={res.loading}
      error={res.error}
      onRetry={res.reload}
    />
  )
}

/**
 * Home: editorial hero (the selected model's top picks for signed-in users,
 * trending films otherwise), a scroll-speed genre marquee, then sections that
 * reveal on scroll.
 */
export default function Home() {
  const { userId, model, recsVersion } = useApp()
  const recs = useAsync(
    () =>
      userId
        ? api.recommendations(userId, model, 12)
        : api.trending(12).then((items) => ({ items, label: 'Trending', model_used: 'trending' })),
    [userId, model, recsVersion],
    homeSnapshot(userId, (s) => ({ items: s.trending, label: 'Trending', model_used: 'trending' })),
  )

  const label = recs.data?.label
  const taste = recs.data?.taste ?? []
  return (
    <>
      <Hero items={recs.data?.items.slice(0, 5)} loading={recs.loading} eyebrow={userId ? 'Top pick for you' : 'Trending this week'} />

      <div className="relative z-20 overflow-hidden bg-ink py-5 text-bg" aria-hidden="true">
        <Marquee items={MARQUEE} className="font-display text-3xl font-black uppercase tracking-tight sm:text-5xl" />
      </div>

      <Reveal>
        <section className="container-x relative z-20 mt-16 grid gap-6 lg:grid-cols-2" aria-label="Get started">
          {!userId && (
            <div className="flex flex-col justify-between gap-6 border border-ink bg-bg p-8">
              <div>
                <p className="label-caps text-accent">New here?</p>
                <p className="mt-3 font-display text-2xl font-black uppercase leading-tight">Get recommendations made for you</p>
                <p className="mt-2 text-sm text-muted">Pick a few genres and favourite films. It takes 30 seconds.</p>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <StarButton as={Link} to="/welcome" className="text-sm font-semibold">Get started</StarButton>
                <Link to="/login" className="text-sm font-semibold text-accent hover:underline">I already have a profile</Link>
              </div>
            </div>
          )}
          <div className={`flex flex-col justify-between gap-6 bg-accent p-8 text-bg ${userId ? 'lg:col-span-2' : ''}`}>
            <div>
              <p className="label-caps opacity-80">Mood match</p>
              <p className="mt-3 font-display text-2xl font-black uppercase leading-tight">Not sure what you feel like?</p>
              <p className="mt-2 text-sm opacity-80">Pick a mood and we will match the movie.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {MOOD_SHORTCUTS.map(([key, text]) => (
                <Link key={key} to={`/mood?mood=${key}&go=1`}
                  className="label-caps border border-bg/60 px-3 py-2 text-[10px] transition hover:bg-bg hover:text-accent">
                  {text}
                </Link>
              ))}
              <Link to="/mood" className="label-caps bg-bg px-3 py-2 text-[10px] text-accent">More moods →</Link>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <PicksRow
          title={userId ? 'Top picks for you' : 'Trending with MovieLens viewers'}
          subtitle={
            userId
              ? `Built from your saved favourites and ratings${taste.length ? ` (you like ${taste.join(', ')})` : ''} by the ${label ?? '...'} model. Rate movies and this row updates instantly.`
              : 'The movies MovieLens viewers rated highest most recently, whatever year they came out.'
          }
          data={recs.data}
          loading={recs.loading}
          error={recs.error}
          onRetry={recs.reload}
        />
      </Reveal>
      {userId && taste.slice(0, 2).map((g) => (
        <Reveal key={g}><TasteRow genre={g} skip={(recs.data?.items ?? []).map((m) => m.id)} /></Reveal>
      ))}
      <Reveal>{userId ? <Explore /> : <Favorites />}</Reveal>
      <Reveal><Greats /></Reveal>
    </>
  )
}
