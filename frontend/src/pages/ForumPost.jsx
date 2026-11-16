import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import Vote from '../components/forum/Vote'
import { ErrorNote } from '../components/Skeletons'
import { useApp } from '../context'
import { useAsync } from '../hooks'
import { timeAgo } from '../format'
import { Flair } from './Forum'

const MAX_INDENT = 5

function ReplyForm({ postId, parentId, onDone, onCancel, autoFocus = false }) {
  const { userId } = useApp()
  const [body, setBody] = useState('')
  const [state, setState] = useState({ busy: false, error: null })

  if (!userId) {
    return (
      <p className="text-sm text-muted">
        <Link to="/welcome" className="font-semibold text-accent hover:underline">Create a profile</Link> to join the discussion.
      </p>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setState({ busy: true, error: null })
    try {
      await api.addComment(postId, { user_id: userId, body: body.trim(), parent_id: parentId ?? null })
      setBody('')
      setState({ busy: false, error: null })
      onDone()
    } catch (error) {
      setState({ busy: false, error })
    }
  }

  const id = `reply-${parentId ?? 'root'}`
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={id} className="sr-only">{parentId ? 'Write a reply' : 'Write a comment'}</label>
      <textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={3000} required
        autoFocus={autoFocus} placeholder={parentId ? 'Write a reply…' : 'What do you think?'}
        className="w-full resize-y border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
      {state.error && <p role="alert" className="text-sm text-accent">{state.error.message}</p>}
      <div className="flex gap-4">
        <button type="submit" disabled={state.busy || !body.trim()}
          className="label-caps bg-ink px-4 py-2 text-[10px] text-bg transition hover:bg-accent disabled:opacity-40">
          {state.busy ? 'Posting…' : parentId ? 'Reply' : 'Comment'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="label-caps text-[10px] text-muted hover:text-ink">Cancel</button>
        )}
      </div>
    </form>
  )
}

function Comment({ comment, children, depth, postId, onChange }) {
  const { userId } = useApp()
  const [replying, setReplying] = useState(false)
  const deleted = comment.body === '[deleted]'

  const remove = async () => {
    if (!window.confirm('Delete this comment?')) return
    await api.deleteComment(comment.id, userId)
    onChange()
  }

  return (
    <li className={depth > 0 ? 'border-l-2 border-line pl-4' : ''}>
      <div className="flex gap-3 py-3">
        <Vote type="comment" id={comment.id} score={comment.score} myVote={comment.my_vote} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            <span className="font-semibold text-ink">{comment.author}</span> · {timeAgo(comment.created_at)}
          </p>
          <p className={`mt-1 whitespace-pre-wrap break-words text-sm ${deleted ? 'italic text-muted' : ''}`}>{comment.body}</p>
          <div className="mt-2 flex gap-4">
            {!deleted && (
              <button type="button" onClick={() => setReplying((r) => !r)} aria-expanded={replying}
                className="label-caps text-[9px] text-muted hover:text-accent">Reply</button>
            )}
            {userId === comment.user_id && !deleted && (
              <button type="button" onClick={remove} className="label-caps text-[9px] text-muted hover:text-accent">Delete</button>
            )}
          </div>
          {replying && (
            <div className="mt-3">
              <ReplyForm postId={postId} parentId={comment.id} autoFocus
                onCancel={() => setReplying(false)} onDone={() => { setReplying(false); onChange() }} />
            </div>
          )}
        </div>
      </div>
      {children.length > 0 && (
        <ul className={depth + 1 >= MAX_INDENT ? '' : 'ml-4 sm:ml-8'}>{children}</ul>
      )}
    </li>
  )
}

/** One forum post with its threaded comments. */
export default function ForumPost() {
  const { id } = useParams()
  const { userId } = useApp()
  const navigate = useNavigate()
  const post = useAsync(() => api.forumPost(id, userId), [id, userId])

  // Build the comment tree from the flat list (parent_id links).
  const tree = useMemo(() => {
    const kids = new Map()
    for (const c of post.data?.comments ?? []) {
      const key = c.parent_id ?? 'root'
      kids.set(key, [...(kids.get(key) ?? []), c])
    }
    const render = (key, depth) =>
      (kids.get(key) ?? []).map((c) => (
        <Comment key={c.id} comment={c} depth={depth} postId={Number(id)} onChange={post.reload}>
          {render(c.id, depth + 1)}
        </Comment>
      ))
    return render('root', 0)
  }, [post.data, id, post.reload])

  if (post.error) {
    return (
      <div className="container-x py-16">
        <ErrorNote error={post.error} onRetry={post.error.status === 404 ? undefined : post.reload} />
        <Link to="/forum" className="link-underline mt-6">Back to the forum</Link>
      </div>
    )
  }
  if (!post.data) return <div className="container-x py-16"><div className="skeleton h-64" aria-hidden="true" /></div>

  const p = post.data
  const removePost = async () => {
    if (!window.confirm('Delete this post and all its comments?')) return
    await api.deletePost(p.id, userId)
    navigate('/forum')
  }

  return (
    <div className="container-x max-w-4xl py-12">
      <Link to="/forum" className="label-caps text-[10px] text-muted hover:text-accent">← The forum</Link>

      <article className="mt-6 flex gap-5 border-b border-ink pb-8">
        <Vote type="post" id={p.id} score={p.score} myVote={p.my_vote} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Flair flair={p.flair} />
            {p.movie && (
              <Link to={`/movie/${p.movie.id}`} className="label-caps text-[9px] text-muted hover:text-accent">
                🎬 {p.movie.title}{p.movie.year ? ` (${p.movie.year})` : ''}
              </Link>
            )}
          </div>
          <h1 className="mt-3 font-display text-3xl font-black leading-tight sm:text-4xl">{p.title}</h1>
          <p className="mt-2 text-xs text-muted">
            Posted by <span className="font-semibold text-ink">{p.author}</span> · {timeAgo(p.created_at)}
          </p>
          {p.body && <p className="mt-5 whitespace-pre-wrap break-words leading-relaxed">{p.body}</p>}
          {userId === p.user_id && (
            <button type="button" onClick={removePost} className="label-caps mt-5 text-[10px] text-muted hover:text-accent">
              Delete post
            </button>
          )}
        </div>
      </article>

      <section className="mt-8" aria-label="Comments">
        <h2 className="label-caps text-sm">{p.comment_count} comment{p.comment_count === 1 ? '' : 's'}</h2>
        <div className="mt-4">
          <ReplyForm postId={p.id} onDone={post.reload} />
        </div>
        <ul className="mt-6 divide-y divide-line">{tree}</ul>
      </section>
    </div>
  )
}
