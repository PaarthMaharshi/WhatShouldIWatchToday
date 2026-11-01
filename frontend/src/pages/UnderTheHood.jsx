import { Link } from 'react-router-dom'
import { api } from '../api'
import Artwork from '../components/Artwork'
import { MatchBadge } from '../components/Badges'
import { Counter, Reveal, Spotlight } from '../components/Motion'
import { ErrorNote } from '../components/Skeletons'
import { useApp } from '../context'
import { useAsync, useModels } from '../hooks'

const COMPARE = ['popularity', 'content', 'item_knn', 'hybrid']

// MovieLens ml-latest-small facts (fixed dataset, see notebooks/01_eda.ipynb).
const DATASET_STATS = [
  ['ratings learned from', 100836, '', 0],
  ['movies in the catalogue', 9742, '', 0],
  ['MovieLens users', 610, '', 0],
  ['of the rating matrix is empty', 98.3, '%', 1],
]

// Which direction is "better" for each metric (used to highlight the best value).
const METRICS = [
  ['RMSE', 'min'], ['MAE', 'min'], ['P@10', 'max'], ['R@10', 'max'], ['MAP@10', 'max'],
  ['NDCG@10', 'max'], ['Coverage', 'max'], ['Diversity', 'max'], ['Novelty', 'max'], ['fit_s', 'min'],
]

const PLOTS = {
  'accuracy.png': 'Rating prediction error (RMSE / MAE) on the test set',
  'ranking.png': 'Top-10 ranking quality: precision, recall, MAP, NDCG',
  'tradeoff.png': 'Accuracy vs diversity (bubble size = catalogue coverage)',
  'alpha_curve.png': 'Tuning the hybrid weight α on validation data',
  'cold_start.png': 'Cold start: new users and new items',
  'segments.png': 'K-means taste segments and the silhouette score used to pick k',
  'logreg_coefficients.png': 'What logistic regression learned (standardised coefficients)',
  'tree_importance.png': 'Decision tree feature importance',
  'logreg_scratch_loss.png': 'From-scratch logistic regression: loss falling with gradient descent',
}

const STEPS = [
  ['Data', 'MovieLens ratings, split per user by time: oldest 80% train, next 10% validation, newest 10% test.'],
  ['Similarity (kNN)', 'Item-kNN and User-kNN learn from ratings; Content-kNN uses TF-IDF of genres, tags and plot.'],
  ['Segments (K-means)', 'Users are clustered by genre taste; a new user is matched to the nearest segment.'],
  ['Blend & learn', 'The hybrid blends Item-kNN and content. Regression, tree and SVM models learn from 15 kNN/segment features.'],
  ['Serve', 'Models are trained offline and loaded by the API; a new rating changes the next list instantly.'],
]

const fmt = (v, k) => (v == null ? '—' : k === 'fit_s' ? `${v.toFixed(1)}s` : v.toFixed(k === 'Novelty' ? 2 : 3))

function ModelCards({ models, active, onPick }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((m) => {
        const on = m.key === active
        return (
          <Spotlight key={m.key} className={`!rounded-xl !p-0 ${on ? 'ring-2 ring-accent' : ''}`}>
          <button
            type="button"
            aria-pressed={on}
            onClick={() => onPick(m.key)}
            className="block h-full w-full p-5 text-left"
          >
            <span className="eyebrow">{m.family}</span>
            <span className="mt-1 block font-display text-lg font-bold">{m.label}</span>
            <span className="mt-2 block text-xs leading-relaxed text-muted">{m.description}</span>
            <span className="mt-4 flex gap-4 text-xs">
              <span>NDCG@10 <b className="text-ink">{fmt(m.metrics['NDCG@10'])}</b></span>
              <span>RMSE <b className="text-ink">{fmt(m.metrics.RMSE)}</b></span>
            </span>
            <span className={`mt-3 block text-[11px] font-semibold ${on ? 'text-accent' : 'text-muted'}`}>
              {on ? 'In use across the app' : 'Use this model'}
            </span>
          </button>
          </Spotlight>
        )
      })}
    </div>
  )
}

function LiveComparison({ userId, keys, labels }) {
  const { recsVersion } = useApp()
  const lists = useAsync(
    () => Promise.all(keys.map((k) => api.recommendations(userId, k, 6))),
    [userId, keys.join(), recsVersion],
  )
  if (lists.error) return <ErrorNote error={lists.error} onRetry={lists.reload} />
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {keys.map((k, col) => (
        <div key={k} className="rounded-xl border border-line bg-surface p-4">
          <h3 className="font-display text-sm font-bold">{labels[k]}</h3>
          {lists.data?.[col]?.model_used === 'cold_start' && (
            <p className="mt-1 text-[11px] text-accent">Cold start (rate 5 movies to personalise)</p>
          )}
          <ol className="mt-3 space-y-3">
            {(lists.data?.[col]?.items ?? Array.from({ length: 6 }, (_, i) => ({ id: `s${i}` }))).map((m, i) =>
              m.title ? (
                <li key={m.id}>
                  <Link to={`/movie/${m.id}`} className="group flex items-center gap-3">
                    <span className="w-4 text-xs text-muted">{i + 1}</span>
                    <Artwork movie={m} label={false} className="h-12 w-8 shrink-0 rounded" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm group-hover:text-accent">{m.title}</span>
                      <span className="text-[11px] text-muted">{m.year}</span>
                    </span>
                    <MatchBadge match={m.match} />
                  </Link>
                </li>
              ) : (
                <li key={m.id} className="skeleton h-12" />
              ),
            )}
          </ol>
        </div>
      ))}
    </div>
  )
}

function ResultsTable({ rows }) {
  const best = Object.fromEntries(
    METRICS.map(([k, dir]) => {
      const vals = rows.map((r) => r[k]).filter((v) => v != null)
      return [k, dir === 'min' ? Math.min(...vals) : Math.max(...vals)]
    }),
  )
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[820px] text-left text-xs">
        <caption className="sr-only">Test-set results for every model</caption>
        <thead className="bg-surface text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Model</th>
            {METRICS.map(([k, dir]) => (
              <th key={k} scope="col" className="px-3 py-3 text-right font-semibold" title={dir === 'min' ? 'Lower is better' : 'Higher is better'}>
                {k === 'fit_s' ? 'Fit time' : k} {dir === 'min' ? '↓' : '↑'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model} className="border-t border-line">
              <th scope="row" className="px-4 py-2.5 font-medium">{r.model}</th>
              {METRICS.map(([k]) => (
                <td key={k} className={`px-3 py-2.5 text-right tabular-nums ${r[k] != null && r[k] === best[k] ? 'font-bold text-accent' : 'text-muted'}`}>
                  {fmt(r[k], k)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ColdTable({ title, data }) {
  const rows = Object.entries(data ?? {}).filter(([k]) => !k.startsWith('_'))
  const best = Math.max(...rows.map(([, v]) => v['NDCG@10']))
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className="font-display font-bold">{title}</h3>
      <table className="mt-3 w-full text-xs">
        <thead className="text-muted">
          <tr><th className="py-1 text-left font-medium">Model</th><th className="text-right font-medium">NDCG@10</th><th className="text-right font-medium">P@10</th><th className="text-right font-medium">Coverage</th></tr>
        </thead>
        <tbody>
          {rows.map(([name, v]) => (
            <tr key={name} className="border-t border-line">
              <th scope="row" className="py-1.5 text-left font-normal">{name}</th>
              <td className={`text-right tabular-nums ${v['NDCG@10'] === best ? 'font-bold text-accent' : ''}`}>{v['NDCG@10'].toFixed(3)}</td>
              <td className="text-right tabular-nums">{v['P@10'].toFixed(3)}</td>
              <td className="text-right tabular-nums">{v.Coverage.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ id, title, intro, children }) {
  return (
    <Reveal>
      <section className="mt-20" aria-labelledby={id}>
        <h2 id={id} className="font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="mt-2 max-w-3xl text-sm text-muted">{intro}</p>}
        <div className="mt-6">{children}</div>
      </section>
    </Reveal>
  )
}

/** "Under the hood": model switcher, live side-by-side comparison and offline results. */
export default function UnderTheHood() {
  const { userId, model, setModel } = useApp()
  const info = useModels()

  if (info.error) return <div className="container-x py-16"><ErrorNote error={info.error} onRetry={info.reload} /></div>
  if (!info.data) {
    return (
      <div className="container-x space-y-4 py-16" aria-hidden="true">
        <div className="skeleton h-10 w-1/3" /><div className="skeleton h-40" /><div className="skeleton h-64" />
      </div>
    )
  }

  const { models, results_table: rows, cold_start: cold, alphas, n_segments: k, plots, min_ratings_for_personal: minR } = info.data
  const labels = Object.fromEntries(models.map((m) => [m.key, m.label]))
  const compare = COMPARE.includes(model) ? COMPARE : [...COMPARE.slice(0, 3), model]

  return (
    <div className="container-x py-12">
      <p className="eyebrow">Under the hood</p>
      <h1 className="mt-2 text-4xl font-bold">How the recommendations are made</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Every list in the app comes from one of the models below. Pick one and the whole site switches to it.
        All numbers are measured on held-out test ratings the models never saw.
      </p>

      <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-line py-6 sm:grid-cols-4">
        {DATASET_STATS.map(([label, value, suffix, decimals]) => (
          <div key={label}>
            <dd className="font-display text-3xl font-extrabold sm:text-4xl">
              <Counter to={value} suffix={suffix} decimals={decimals} />
            </dd>
            <dt className="mt-1 text-xs text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <ol className="mt-10 grid gap-4 md:grid-cols-5">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="rounded-xl border border-line bg-surface p-4">
            <span className="font-display text-2xl font-extrabold text-accent">{i + 1}</span>
            <span className="mt-1 block font-display text-sm font-bold">{t}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{d}</span>
          </li>
        ))}
      </ol>

      <Section id="switch" title="Model switcher" intro={`Users with fewer than ${minR} ratings always get the cold-start model (K-means segment + Content-kNN). Hybrid weight α = ${alphas.alpha_rank} for ranking (tuned on validation data); K-means uses k = ${k} segments.`}>
        <ModelCards models={models} active={model} onPick={setModel} />
      </Section>

      <Section id="compare" title="Same user, different models" intro="The top 6 for the current user from four models side by side. Popularity gives everyone the same list; the others react to your ratings.">
        {userId ? (
          <LiveComparison userId={userId} keys={compare} labels={labels} />
        ) : (
          <p className="text-sm text-muted">
            <Link to="/welcome" className="font-semibold text-accent hover:underline">Create a profile</Link> or load a MovieLens demo user to compare models live.
          </p>
        )}
      </Section>

      <Section id="results" title="Offline evaluation (test set)" intro="Best value per column in red. RMSE/MAE measure rating prediction; P/R/MAP/NDCG@10 measure the top-10 list; coverage, diversity and novelty measure variety. Classifier-only models do not predict ratings, so RMSE is blank.">
        <ResultsTable rows={rows} />
      </Section>

      <Section id="cold" title="Cold start" intro="New users: only 5 liked movies are known. New items: movies whose ratings were hidden from training entirely, so only content features can place them.">
        <div className="grid gap-6 md:grid-cols-2">
          <ColdTable title="New users" data={cold.new_user} />
          <ColdTable title="New items" data={cold.new_item} />
        </div>
      </Section>

      <Section id="plots" title="Plots">
        <div className="grid gap-6 md:grid-cols-2">
          {plots.map((p) => (
            <figure key={p} className="overflow-hidden rounded-xl border border-line bg-white">
              <a href={api.plotUrl(p)} target="_blank" rel="noreferrer">
                <img src={api.plotUrl(p)} alt={PLOTS[p] || p} loading="lazy" className="w-full" />
              </a>
              <figcaption className="border-t border-line bg-surface px-4 py-3 text-xs text-muted">{PLOTS[p] || p}</figcaption>
            </figure>
          ))}
        </div>
      </Section>
    </div>
  )
}
