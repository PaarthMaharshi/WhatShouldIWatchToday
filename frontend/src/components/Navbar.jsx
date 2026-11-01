import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '../context'
import { CloseIcon, MenuIcon, SearchIcon } from './Icons'
import Logo from './Logo'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/browse', label: 'Browse' },
  { to: '/for-you', label: 'For you' },
  { to: '/mood', label: 'Mood' },
  { to: '/forum', label: 'Forum' },
  { to: '/under-the-hood', label: 'Under the hood' },
]

/** Closes a popover on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
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

/** Small uppercase text toggle, like the reference's "ENG". */
function TextToggle({ on, onClick, label, onText, offText }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className="label-caps text-[10px] text-muted transition hover:text-ink"
    >
      {on ? onText : offText}
    </button>
  )
}

/**
 * Flat editorial header (after the reference): script logo + menu icon on the
 * left, small uppercase links, and text toggles / search / account on the right.
 */
export default function Navbar() {
  const { user, theme, toggleTheme, signOut, motionOn, toggleMotion } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [searching, setSearching] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [q, setQ] = useState('')
  const account = usePopover()

  useEffect(() => setDrawer(false), [location.pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (!drawer) return undefined
    const onKey = (e) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  const submit = (e) => {
    e.preventDefault()
    navigate(`/browse?q=${encodeURIComponent(q.trim())}`)
    setSearching(false)
  }

  const linkClass = ({ isActive }) =>
    `label-caps relative whitespace-nowrap py-1 text-[11px] transition hover:text-ink after:absolute after:-bottom-0.5 after:left-0 after:h-[2px] after:bg-accent after:transition-all ${
      isActive ? 'text-ink after:w-full' : 'text-muted after:w-0 hover:after:w-full'
    }`
  const initials = user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className={`sticky top-0 z-40 bg-bg transition-shadow ${scrolled ? 'shadow-[0_1px_0_rgb(var(--line))]' : ''}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <nav className="container-x flex h-16 items-center justify-between gap-6 sm:h-20" aria-label="Main">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Logo />
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}
            className="p-1 text-ink hover:text-accent">
            <MenuIcon />
          </button>
        </div>

        <ul className="hidden items-center gap-8 xl:flex 2xl:gap-12">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <span className="hidden items-center gap-4 sm:flex">
            <TextToggle on={motionOn} onClick={toggleMotion} label="Toggle animations" onText="FX on" offText="FX off" />
            <TextToggle on={theme === 'dark'} onClick={toggleTheme}
              label={`Switch to ${theme === 'dark' ? 'cream' : 'night'} theme`} onText="Night" offText="Day" />
          </span>

          {searching ? (
            <form onSubmit={submit} className="flex items-center" role="search">
              <label htmlFor="nav-search" className="sr-only">Search movies</label>
              <input
                id="nav-search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onBlur={() => !q && setSearching(false)}
                placeholder="Search movies…"
                className="w-32 border-b border-ink bg-transparent px-1 py-1 text-sm outline-none focus:border-accent sm:w-52"
              />
            </form>
          ) : (
            <button type="button" onClick={() => setSearching(true)} aria-label="Search" className="p-1 text-ink hover:text-accent">
              <SearchIcon />
            </button>
          )}

          <div className="relative" ref={account.ref}>
            {user ? (
              <button
                type="button"
                onClick={() => account.setOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={account.open}
                className="grid h-9 w-9 place-items-center bg-ink font-display text-[11px] font-bold text-bg transition hover:bg-accent"
              >
                {initials}
              </button>
            ) : (
              <Link to="/welcome" className="label-caps whitespace-nowrap bg-ink px-3 py-2 text-[10px] text-bg transition hover:bg-accent sm:px-4">
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Get started</span>
              </Link>
            )}
            {account.open && user && (
              <div className="absolute right-0 mt-2 w-60 border border-line bg-bg p-2 text-sm shadow-card">
                <p className="px-3 py-2">
                  <span className="block font-semibold">{user.name}</span>
                  <span className="text-xs text-muted">{user.rating_count} ratings</span>
                </p>
                <Link to="/for-you" className="block px-3 py-2 hover:bg-surface" onClick={() => account.setOpen(false)}>
                  My recommendations
                </Link>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-surface"
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

      {/* Full-height editorial menu */}
      <AnimatePresence>
        {drawer && (
          <motion.div
            className="fixed inset-0 z-50 bg-ink/40"
            onClick={() => setDrawer(false)}
            initial={motionOn ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={motionOn ? { opacity: 0 } : undefined}
          >
            <motion.div
              className="flex h-full w-[min(26rem,88vw)] flex-col bg-bg p-8"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={motionOn ? { x: '-100%' } : false}
              animate={{ x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
              exit={motionOn ? { x: '-100%', transition: { duration: 0.3 } } : undefined}
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="hover:text-accent">
                  <CloseIcon />
                </button>
              </div>
              <ul className="mt-14 space-y-4">
                {LINKS.map((l, i) => (
                  <motion.li
                    key={l.to}
                    initial={motionOn ? { opacity: 0, x: -24 } : false}
                    animate={{ opacity: 1, x: 0, transition: { delay: 0.1 + i * 0.05 } }}
                  >
                    <NavLink
                      to={l.to}
                      end={l.end}
                      className={({ isActive }) =>
                        `font-display text-3xl font-black uppercase tracking-tight transition hover:text-accent ${isActive ? 'text-accent' : 'text-ink'}`
                      }
                    >
                      <span className="mr-3 align-top font-sans text-xs font-medium text-muted">0{i + 1}</span>
                      {l.label}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-auto flex gap-6 border-t border-line pt-6">
                <TextToggle on={motionOn} onClick={toggleMotion} label="Toggle animations" onText="FX on" offText="FX off" />
                <TextToggle on={theme === 'dark'} onClick={toggleTheme}
                  label={`Switch to ${theme === 'dark' ? 'cream' : 'night'} theme`} onText="Night" offText="Day" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
