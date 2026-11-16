import { useState } from 'react'
import { api } from '../api'
import { useApp } from '../context'
import { saved } from '../data/home'
import { useAsync } from '../hooks'
import Artwork from './Artwork'
import { CloseIcon } from './Icons'
import { StarButton } from './Motion'

const MAX_FAVS = 50

/** Search-as-you-type to add a favourite movie. */
function AddMovie({ exclude, onAdd, disabled }) {
  const [q, setQ] = useState('')
  const results = useAsync(() => (q.trim().length >= 2 ? api.movies({ q, page_size: 6 }) : Promise.resolve(null)), [q])
  const items = results.data?.items.filter((m) => !exclude.includes(m.id)) ?? []
  return (
    <div className="relative max-w-sm">
      <label htmlFor="fav-search" className="sr-only">Add a favourite movie</label>
      <input id="fav-search" value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled} autoComplete="off"
        placeholder={disabled ? `Up to ${MAX_FAVS} favourites` : 'Add a movie…'}
        className="w-full border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50" />
      {items.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full border border-line bg-bg shadow-card" role="listbox">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" role="option" aria-selected="false"
                onClick={() => { onAdd(m); setQ('') }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface">
                {m.title} <span className="text-muted">{m.year}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Edit what the recommender knows about you: name, favourite genres and
 * favourite movies (stored as 5-star ratings). Saving refreshes every list.
 */
export default function EditProfile({ onClose }) {
  const { user, userId, profileChanged } = useApp()
  const [name, setName] = useState(user?.name ?? '')
  const [genres, setGenres] = useState(user?.genres ?? [])
  const [favs, setFavs] = useState(null)        // null until loaded
  const [state, setState] = useState({ busy: false, error: null })
  const original = useAsync(() => api.favorites(userId).then((list) => {
    setFavs((current) => current ?? list)   // never overwrite edits with a late response
    return list
  }), [userId])

  const toggleGenre = (g) => setGenres((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]))

  const save = async (e) => {
    e.preventDefault()
    setState({ busy: true, error: null })
    try {
      await api.updateUser(userId, { name: name.trim(), genres, favorite_movie_ids: favs.map((m) => m.id) })
      profileChanged()
      onClose()
    } catch (error) {
      setState({ busy: false, error })
    }
  }

  return (
    <form onSubmit={save} aria-label="Edit profile" className="mt-6 space-y-8 border border-ink bg-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-caps text-accent">Edit profile</p>
          <p className="mt-1 text-sm text-muted">Change what the recommender knows about you. Your picks update when you save.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close editor" className="text-muted hover:text-accent"><CloseIcon /></button>
      </div>

      <div>
        <label htmlFor="edit-name" className="eyebrow mb-2 block">Name</label>
        <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40}
          className="w-full max-w-sm border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
      </div>

      <fieldset>
        <legend className="eyebrow mb-2">Favourite genres</legend>
        <div className="flex flex-wrap gap-2">
          {saved.genres.filter((g) => g.name !== 'IMAX').map((g) => (
            <button key={g.name} type="button" aria-pressed={genres.includes(g.name)} onClick={() => toggleGenre(g.name)}
              className={`chip ${genres.includes(g.name) ? 'chip-on' : ''}`}>{g.name}</button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-2">Favourite movies (your 5-star ratings) {favs && `· ${favs.length}`}</legend>
        {original.error ? (
          <p className="text-sm text-accent">{original.error.message}</p>
        ) : !favs ? (
          <div className="skeleton h-28 w-full" aria-hidden="true" />
        ) : (
          <>
            <AddMovie exclude={favs.map((m) => m.id)} disabled={favs.length >= MAX_FAVS}
              onAdd={(m) => setFavs((list) => [m, ...list])} />
            {favs.length === 0 && <p className="mt-3 text-sm text-muted">No favourites yet. Add a few to sharpen your picks.</p>}
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
              {favs.map((m) => (
                <li key={m.id} className="relative">
                  <Artwork movie={m} className="aspect-[2/3] rounded" />
                  <p className="mt-1 truncate text-[11px]" title={m.title}>{m.title}</p>
                  <button type="button" onClick={() => setFavs((list) => list.filter((x) => x.id !== m.id))}
                    aria-label={`Remove ${m.title}`}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-bg hover:bg-accent">
                    <CloseIcon width={12} height={12} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-accent">{state.error.message}</p>}
      <div className="flex items-center gap-5">
        <StarButton type="submit" disabled={state.busy || !favs || !name.trim()}
          className="label-caps text-[11px] disabled:opacity-40">{state.busy ? 'Saving…' : 'Save and refresh picks'}</StarButton>
        <button type="button" onClick={onClose} className="label-caps text-[11px] text-muted hover:text-ink">Cancel</button>
      </div>
    </form>
  )
}
