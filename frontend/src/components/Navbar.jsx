import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context'
import { BellIcon, CloseIcon, MenuIcon, MoonIcon, SearchIcon, SparklesIcon, SunIcon } from './Icons'
import Logo from './Logo'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/browse', label: 'Browse' },
  { to: '/for-you', label: 'For You' },
  { to: '/under-the-hood', label: 'Under the hood' },
]

/** Closes a popover on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, ref }
}

export default function Navbar() {
  const { user, theme, toggleTheme, signOut, motionOn, toggleMotion } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const bell = usePopover()
  const account = usePopover()

  useEffect(() => setDrawer(false), [location.pathname])

  const submit = (e) => {
    e.preventDefault()
    navigate(`/browse?q=${encodeURIComponent(q.trim())}`)
    setSearching(false)
  }

  const linkClass = ({ isActive }) =>
    `text-sm transition hover:text-ink ${isActive ? 'font-semibold text-ink' : 'text-muted'}`
  const initials = user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-40 px-2 pt-2 sm:px-4 sm:pt-3">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      {/* Floating glass pill */}
      <nav
        className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 rounded-full border border-line/70 bg-bg/70 px-3 shadow-card backdrop-blur-xl sm:h-16 sm:px-6"
        aria-label="Main"
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="rounded p-1 md:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <Logo />
        </div>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center sm:gap-2">
          {searching ? (
            <form onSubmit={submit} className="flex items-center" role="search">
              <label htmlFor="nav-search" className="sr-only">Search movies</label>
              <input
                id="nav-search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onBlur={() => !q && setSearching(false)}
                placeholder="Search movies..."
                className="w-36 rounded-full border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent sm:w-56"
              />
            </form>
          ) : (
            <button type="button" onClick={() => setSearching(true)} aria-label="Search" className="rounded-full p-2 text-muted hover:text-ink">
              <SearchIcon />
            </button>
          )}

          <button
            type="button"
            onClick={toggleMotion}
            aria-pressed={motionOn}
            aria-label={motionOn ? 'Turn animations off' : 'Turn animations on'}
            title={motionOn ? 'Animations on' : 'Animations off'}
            className={`hidden rounded-full p-2 sm:block ${motionOn ? 'text-accent' : 'text-muted hover:text-ink'}`}
          >
            <SparklesIcon />
          </button>

          <div className="relative hidden sm:block" ref={bell.ref}>
            <button
              type="button"
              onClick={() => bell.setOpen((o) => !o)}
              aria-label="Notifications"
              aria-expanded={bell.open}
              className="relative rounded-full p-2 text-muted hover:text-ink"
            >
              <BellIcon />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            </button>
            {bell.open && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-line bg-surface p-4 text-sm shadow-card">
                <p className="font-semibold">Fresh picks</p>
                <p className="mt-1 text-muted">
                  Your recommendations refresh every time you rate a movie. Rate a few more to sharpen them.
                </p>
                <Link to="/for-you" className="mt-3 inline-block font-semibold text-accent" onClick={() => bell.setOpen(false)}>
                  See your picks
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="hidden rounded-full p-2 text-muted hover:text-ink sm:block"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <div className="relative" ref={account.ref}>
            {user ? (
              <button
                type="button"
                onClick={() => account.setOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={account.open}
                className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-accent font-display text-xs font-bold text-white ring-2 ring-accent/30"
              >
                {initials}
              </button>
            ) : (
              <Link to="/welcome" className="ml-1 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-dark sm:px-4 sm:py-2 sm:text-xs">
                Get started
              </Link>
            )}
            {account.open && user && (
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-surface p-2 text-sm shadow-card">
                <p className="px-3 py-2">
                  <span className="block font-semibold">{user.name}</span>
                  <span className="text-xs text-muted">{user.rating_count} ratings</span>
                </p>
                <Link to="/for-you" className="block rounded-lg px-3 py-2 hover:bg-surface-2" onClick={() => account.setOpen(false)}>
                  My recommendations
                </Link>
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
                  onClick={() => {
                    signOut()
                    account.setOpen(false)
                    navigate('/welcome')
                  }}
                >
                  Switch user
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {drawer && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setDrawer(false)}>
          <div
            className="h-full w-72 bg-bg p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Menu"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu">
                <CloseIcon />
              </button>
            </div>
            <ul className="mt-8 space-y-5">
              {LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} end={l.end} className={linkClass}>
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={toggleMotion}
              aria-pressed={motionOn}
              className="mt-10 flex items-center gap-2 text-sm text-muted hover:text-ink"
            >
              <SparklesIcon className={motionOn ? 'text-accent' : ''} />
              Animations: {motionOn ? 'on' : 'off'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-5 flex items-center gap-2 text-sm text-muted hover:text-ink"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              {theme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
