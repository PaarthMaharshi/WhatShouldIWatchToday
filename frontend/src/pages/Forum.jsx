import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import Vote from '../components/forum/Vote'
import { CloseIcon, SearchIcon } from '../components/Icons'
import { Reveal, StarButton } from '../components/Motion'
import { ErrorNote } from '../components/Skeletons'
import { useApp } from '../context'
import { useAsync } from '../hooks'
import { timeAgo } from '../format'

const SORTS = [['hot', 'Hot'], ['new', 'New'], ['top', 'Top']]
const FLAIRS = ['question', 'discussion', 'recommendation', 'review']

export function Flair({ flair }) {
  return <span className="label-caps bg-accent/10 px-2 py-1 text-[9px] text-accent">{flair}</span>
}

/** Pick an optional movie to attach to a post (search-as-you-type). */
function MoviePicker({ value, onChange }) {
  const [q, setQ] = useState('')
  const results = useAsync(() => (q.trim().length >= 2 ? api.movies({ q, page_size: 6 }) : Promise.resolve(null)), [q])
  if (value) {
    return (
      <span className="inline-flex items-center gap-2 border border-line bg-bg px-3 py-2 text-sm">
        {value.title} {value.year && <span className="text-muted">({value.year})</span>}
        <button type="button" onClick={() => onChange(null)} aria-label="Remove movie" className="text-muted hover:text-accent">
          <CloseIcon width={14} height={14} />
        </button>
      </span>
    )
  }
  return (
    <div className="relative max-w-sm">
      <label htmlFor="post-movie" className="sr-only">About a movie (optional)</label>
      <input id="post-movie" value={q} onChange={(e) => setQ(e.target.value)} placeholder="About a movie? (optional)"
        autoComplete="off" className="w-full border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
      {results.data?.items.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full border border-line bg-bg shadow-card" role="listbox">
          {results.data.items.map((m) => (
            <li key={m.id}>
              <button type="button" role="option" aria-selected="false"
                onClick={() => { onChange({ id: m.id, title: m.title, year: m.year }); setQ('') }}
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

function Composer({ initialMovie, onCreated, onCancel }) {
  const { userId } = useApp()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [flair, setFlair] = useState('question')
  const [movie, setMovie] = useState(initialMovie)
  const [state, setState] = useState({ busy: false, error: null })

  const submit = async (e) => {
    e.preventDefault()
    setState({ busy: true, error: null })
    try {
      const post = await api.createPost({ user_id: userId, title: title.trim(), body: body.trim(), flair, movie_id: movie?.id ?? null })
      onCreated(post)
    } catch (error) {
      setState({ busy: false, error })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border border-ink bg-surface p-6" aria-label="New post">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Post type">
        {FLAIRS.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={flair === f} onClick={() => setFlair(f)}
            className={`chip capitalize ${flair === f ? 'chip-on' : ''}`}>{f}</button>
        ))}
      </div>
      <label htmlFor="post-title" className="sr-only">Title</label>
      <input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={150}
        placeholder="Title, e.g. Movies like Interstellar but less sad?"
        className="w-full border border-line bg-bg px-3 py-2.5 font-display text-lg font-bold outline-none focus:border-accent" />
      <label htmlFor="post-body" className="sr-only">Details</label>
      <textarea id="post-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={5}
        placeholder="Add some details (optional)"
        className="w-full resize-y border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
      <MoviePicker value={movie} onChange={setMovie} />
      {state.error && <p role="alert" className="text-sm text-accent">{state.error.message}</p>}
      <div className="flex items-center gap-4">
        <StarButton type="submit" disabled={state.busy || title.trim().length < 3}
          className="label-caps text-[11px] disabled:opacity-40">{state.busy ? 'Posting…' : 'Post'}</StarButton>
        <button type="button" onClick={onCancel} className="label-caps text-[11px] text-muted hover:text-ink">Cancel</button>
      </div>
    </form>
  )
}

function PostRow({ post }) {
  return (
    <li className="flex gap-4 border-b border-line py-5">
      <Vote type="post" id={post.id} score={post.score} myVote={post.my_vote} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Flair flair={post.flair} />
          {post.movie && (
            <Link to={`/movie/${post.movie.id}`} className="label-caps text-[9px] text-muted hover:text-accent">
              🎬 {post.movie.title}
            </Link>
          )}
        </div>
        <h2 className="mt-2 font-display text-lg font-bold leading-snug">
          <Link to={`/forum/${post.id}`} className="hover:text-accent">{post.title}</Link>
        </h2>
        {post.body && <p className="mt-1 line-clamp-2 text-sm text-muted">{post.body}</p>}
        <p className="mt-2 text-xs text-muted">
          {post.author} · {timeAgo(post.created_at)} ·{' '}
          <Link to={`/forum/${post.id}`} className="hover:text-accent">
            {post.comment_count} comment{post.comment_count === 1 ? '' : 's'}
          </Link>
        </p>
      </div>
    </li>
  )
}

/** Reddit-style forum: sort, filter by flair / movie / search, and post. */
export default function Forum() {
  const { userId } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') || 'hot'
  const flair = params.get('flair') || ''
  const movieId = params.get('movie') || ''
  const q = params.get('q') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [composing, setComposing] = useState(params.get('new') === '1')
  const [text, setText] = useState(q)

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    next.delete('new')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (text === q) return undefined
    const t = setTimeout(() => update({ q: text.trim() }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const posts = useAsync(
    () => api.forumPosts({ sort, flair, movie_id: movieId, q, page, user_id: userId }),
    [sort, flair, movieId, q, page, userId],
  )
  const movie = useAsync(() => (movieId ? api.movie(movieId) : Promise.resolve(null)), [movieId])

  return (
    <div className="container-x py-12">
      <p className="eyebrow">Community</p>
      <h1 className="mt-2 font-display text-5xl font-black uppercase tracking-tight sm:text-6xl">The forum</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Ask for recommendations, start a discussion or review something you watched.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {userId ? (
          !composing && (
            <StarButton onClick={() => setComposing(true)} className="label-caps text-[11px]">+ New post</StarButton>
          )
        ) : (
          <Link to="/welcome" className="label-caps bg-ink px-5 py-3 text-[11px] text-bg hover:bg-accent">Create a profile to post</Link>
        )}
        <div className="relative ml-auto w-full max-w-xs">
          <label htmlFor="forum-q" className="sr-only">Search posts</label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
          <input id="forum-q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search posts…"
            className="w-full border border-line bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-accent" />
        </div>
      </div>

      {composing && userId && (
        <div className="mt-6">
          <Composer
            initialMovie={movie.data ? { id: movie.data.id, title: movie.data.title, year: movie.data.year } : null}
            onCancel={() => setComposing(false)}
            onCreated={(p) => navigate(`/forum/${p.id}`)}
          />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-ink pb-3">
        <div role="tablist" aria-label="Sort posts" className="flex gap-5">
          {SORTS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={sort === key} onClick={() => update({ sort: key === 'hot' ? '' : key })}
              className={`label-caps text-[11px] ${sort === key ? 'text-accent' : 'text-muted hover:text-ink'}`}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {['', ...FLAIRS].map((f) => (
            <button key={f || 'all'} type="button" aria-pressed={flair === f} onClick={() => update({ flair: f })}
              className={`chip capitalize ${flair === f ? 'chip-on' : ''}`}>{f || 'All'}</button>
          ))}
        </div>
        {movieId && movie.data && (
          <button type="button" onClick={() => update({ movie: '' })} className="chip chip-on inline-flex items-center gap-1">
            🎬 {movie.data.title} <CloseIcon width={12} height={12} />
          </button>
        )}
      </div>

      <Reveal distance={30}>
        {posts.error ? (
          <div className="mt-6"><ErrorNote error={posts.error} onRetry={posts.reload} /></div>
        ) : posts.loading && !posts.data ? (
          <div className="mt-6 space-y-4" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
          </div>
        ) : posts.data?.items.length ? (
          <ul aria-label="Posts">{posts.data.items.map((p) => <PostRow key={p.id} post={p} />)}</ul>
        ) : (
          <div className="mt-10 border border-line p-10 text-center">
            <p className="font-display text-lg font-bold">No posts yet</p>
            <p className="mt-1 text-sm text-muted">
              {movieId ? 'Be the first to start a discussion about this movie.' : 'Start the conversation.'}
            </p>
          </div>
        )}
      </Reveal>

      {posts.data?.pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-6" aria-label="Pagination">
          <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}
            className="label-caps text-[11px] disabled:opacity-30">← Newer</button>
          <span className="text-xs text-muted">Page {page} of {posts.data.pages}</span>
          <button type="button" disabled={page >= posts.data.pages} onClick={() => update({ page: String(page + 1) })}
            className="label-caps text-[11px] disabled:opacity-30">Older →</button>
        </nav>
      )}
    </div>
  )
}
