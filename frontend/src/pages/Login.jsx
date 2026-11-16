import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { StarButton } from '../components/Motion'
import { useApp } from '../context'

const FIELD = 'mt-2 block w-full rounded-lg border border-line bg-surface px-4 py-2.5 outline-none focus:border-accent'
const LABEL = 'font-display text-xs font-bold uppercase tracking-[0.2em]'

/** Log in to an existing profile with the username and password chosen at sign-up. */
export default function Login() {
  const { signIn, profileLost } = useApp()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      signIn(await api.login(username.trim(), password))
      navigate('/for-you')
    } catch (ex) {
      setErr(ex)
      setBusy(false)
    }
  }

  return (
    <section className="container-x py-16">
      <div className="mx-auto max-w-sm">
        <p className="eyebrow">Log in</p>
        <h1 className="mt-2 text-4xl font-bold">Welcome back</h1>
        <p className="mt-3 text-sm text-muted">Your picks, ratings and watchlist are waiting.</p>

        {profileLost && (
          <p role="status" className="mt-6 border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">
            You were signed out because the server could not find your profile. Log in again, or create a new profile.
          </p>
        )}

        <form onSubmit={submit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="login-username" className={LABEL}>Username</label>
            <input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30} required className={FIELD} />
          </div>
          <div>
            <label htmlFor="login-password" className={LABEL}>Password</label>
            <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" maxLength={128} required className={FIELD} />
          </div>

          {err && <p role="alert" className="text-sm text-accent">{err.message}</p>}

          <StarButton type="submit" disabled={busy || !username.trim() || !password}
            className="font-display text-sm font-bold uppercase tracking-[0.2em] disabled:opacity-40">
            {busy ? 'Logging in...' : 'Log in'}
          </StarButton>
        </form>

        <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
          New here?{' '}
          <Link to="/welcome" className="font-semibold text-accent hover:underline">Create a profile</Link>
        </p>
      </div>
    </section>
  )
}
