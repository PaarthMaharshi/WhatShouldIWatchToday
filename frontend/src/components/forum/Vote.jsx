import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useApp } from '../../context'

const Arrow = ({ up, active }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
    fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d={up ? 'M12 4 4 14h5v6h6v-6h5L12 4Z' : 'M12 20l8-10h-5V4H9v6H4l8 10Z'} />
  </svg>
)

/**
 * Up/down vote control for a post or comment. Clicking the active arrow again
 * removes the vote. Updates optimistically and rolls back if the API fails.
 */
export default function Vote({ type, id, score, myVote = 0, vertical = true }) {
  const { userId } = useApp()
  const navigate = useNavigate()
  const [state, setState] = useState({ score, mine: myVote })
  useEffect(() => setState({ score, mine: myVote }), [score, myVote])

  const cast = async (dir) => {
    if (!userId) {
      navigate('/welcome')
      return
    }
    const value = state.mine === dir ? 0 : dir
    const before = state
    setState({ score: state.score - state.mine + value, mine: value })
    try {
      const res = await api.vote({ user_id: userId, target_type: type, target_id: id, value })
      setState({ score: res.score, mine: value })
    } catch {
      setState(before)
    }
  }

  return (
    <div className={`flex items-center gap-1 ${vertical ? 'flex-col' : 'flex-row'}`}>
      <button type="button" onClick={() => cast(1)} aria-pressed={state.mine === 1} aria-label="Upvote"
        className={`p-1 transition hover:text-accent ${state.mine === 1 ? 'text-accent' : 'text-muted'}`}>
        <Arrow up active={state.mine === 1} />
      </button>
      <span className={`min-w-[1.5rem] text-center font-display text-sm font-bold tabular-nums ${state.mine ? 'text-accent' : ''}`}
        aria-label={`Score ${state.score}`}>
        {state.score}
      </span>
      <button type="button" onClick={() => cast(-1)} aria-pressed={state.mine === -1} aria-label="Downvote"
        className={`p-1 transition hover:text-accent ${state.mine === -1 ? 'text-accent' : 'text-muted'}`}>
        <Arrow active={state.mine === -1} />
      </button>
    </div>
  )
}
