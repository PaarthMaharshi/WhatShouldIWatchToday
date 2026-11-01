import { Link } from 'react-router-dom'
import { api } from '../api'
import Favorites from '../components/home/Favorites'
import Greats from '../components/home/Greats'
import Hero from '../components/home/Hero'
import PicksRow from '../components/home/PicksRow'
import { StarButton } from '../components/Motion'
import { useApp } from '../context'
import { useAsync } from '../hooks'

const MOOD_SHORTCUTS = [
  ['happy', 'Happy & light'],
  ['thrill', 'Edge of my seat'],
  ['cry', 'Need a good cry'],
  ['scared', 'Scare me'],
]

/**
 * Home (Reference B). Signed-in users get the selected model's top picks as
 * the hero and the "Top picks" row; visitors see trending movies instead.
 */
export default function Home() {
  const { userId, model, recsVersion } = useApp()
  const recs = useAsync(
    () =>
      userId
        ? api.recommendations(userId, model, 12)
        : api.trending(12).then((items) => ({ items, label: 'Trending', model_used: 'trending' })),
    [userId, model, recsVersion],
  )

  const label = recs.data?.label
  return (
    <>
      <Hero items={recs.data?.items.slice(0, 5)} loading={recs.loading} eyebrow={userId ? 'Top pick for you' : 'Trending now'} />

      {!userId && (
        <div className="container-x">
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-lg font-bold">Get recommendations made for you</p>
              <p className="text-sm text-muted">Pick a few genres and favourite films. It takes 30 seconds.</p>
            </div>
            <StarButton as={Link} to="/welcome" className="text-sm font-semibold">
              Get started
            </StarButton>
          </div>
        </div>
      )}

      <section className="container-x mt-10" aria-labelledby="mood-cta">
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface/70 p-6 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="mood-cta" className="font-display text-lg font-bold">Not sure what you feel like?</h2>
            <p className="text-sm text-muted">Pick a mood and we will match the movie.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {MOOD_SHORTCUTS.map(([key, label]) => (
              <Link key={key} to={`/mood?mood=${key}&go=1`} className="chip">{label}</Link>
            ))}
            <Link to="/mood" className="chip chip-on">More moods →</Link>
          </div>
        </div>
      </section>

      <PicksRow
        title={userId ? 'Top picks for you' : 'Trending this season'}
        subtitle={
          userId
            ? `Chosen by the ${label ?? '...'} model. Rate movies and this row updates instantly.`
            : 'Most-liked movies in the last three years of MovieLens ratings.'
        }
        data={recs.data}
        loading={recs.loading}
        error={recs.error}
        onRetry={recs.reload}
      />
      <Favorites />
      <Greats />
    </>
  )
}
