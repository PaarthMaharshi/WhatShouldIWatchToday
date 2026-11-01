import { useApp } from '../context'
import { useModels } from '../hooks'

// The four headline models get chips; everything else sits in a dropdown.
const MAIN = ['popularity', 'content', 'item_knn', 'hybrid']
const SHORT = { popularity: 'Popularity', content: 'Content', item_knn: 'Collaborative', hybrid: 'Hybrid' }

/** Switch the recommendation model used across the app (saved per browser). */
export default function ModelSwitcher({ className = '' }) {
  const { model, setModel } = useApp()
  const { data } = useModels()
  const others = data?.models.filter((m) => !MAIN.includes(m.key)) ?? []

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="group" aria-label="Recommendation model">
      {MAIN.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={model === key}
          onClick={() => setModel(key)}
          className={`chip ${model === key ? 'chip-on' : ''}`}
        >
          {SHORT[key]}
        </button>
      ))}
      <label className="sr-only" htmlFor="model-more">Other models</label>
      <select
        id="model-more"
        value={MAIN.includes(model) ? '' : model}
        onChange={(e) => e.target.value && setModel(e.target.value)}
        className={`chip cursor-pointer appearance-none pr-6 outline-none ${MAIN.includes(model) ? '' : 'chip-on'}`}
      >
        <option value="">More models…</option>
        {['K-means', 'Supervised', 'kNN'].map((fam) => {
          const list = others.filter((m) => m.family === fam)
          return list.length ? (
            <optgroup key={fam} label={fam}>
              {list.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </optgroup>
          ) : null
        })}
      </select>
    </div>
  )
}
