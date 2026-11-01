import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

/** Footer modelled on Reference A: about, newsletter, quote, menu, red bar. */
export default function Footer() {
  const [sent, setSent] = useState(false)
  return (
    <footer className="mt-24 border-t border-line bg-bg">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 text-xs leading-relaxed text-muted">
            A machine-learning movie recommender built as a B.E. Computer Science project. kNN,
            regression, decision trees, SVM and K-means, compared side by side.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Ratings: <a className="underline hover:text-ink" href="https://grouplens.org/datasets/movielens/" target="_blank" rel="noreferrer">MovieLens</a> (GroupLens Research).
          </p>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.25em]">Newsletter</h2>
          <p className="mt-3 text-xs text-muted">Keep in the loop with new picks each month.</p>
          {sent ? (
            <p className="mt-4 text-sm text-ink" role="status">Thanks! (Demo only: nothing was sent.)</p>
          ) : (
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                setSent(true)
              }}
            >
              <label className="sr-only" htmlFor="nl-name">Name</label>
              <input id="nl-name" placeholder="Name" className="w-full rounded border border-line bg-surface px-3 py-2 text-xs outline-none focus:border-accent" />
              <label className="sr-only" htmlFor="nl-email">Email</label>
              <input id="nl-email" type="email" placeholder="Email" className="w-full rounded border border-line bg-surface px-3 py-2 text-xs outline-none focus:border-accent" />
              <button type="submit" className="w-full rounded bg-accent py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white hover:bg-accent-dark">
                Subscribe
              </button>
            </form>
          )}
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.25em]">Quote</h2>
          <blockquote className="mt-3 font-serif text-lg italic leading-snug text-muted">
            "Tell me what you watched, and I will tell you what to watch next."
          </blockquote>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-widest">The WhatShouldIWatchToday hybrid model</p>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.25em]">Menu</h2>
          <ul className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-muted">
            <li><Link className="hover:text-ink" to="/">Home</Link></li>
            <li><Link className="hover:text-ink" to="/browse">Browse</Link></li>
            <li><Link className="hover:text-ink" to="/for-you">For You</Link></li>
            <li><Link className="hover:text-ink" to="/under-the-hood">Under the hood</Link></li>
            <li><Link className="hover:text-ink" to="/welcome">Onboarding</Link></li>
            <li><a className="hover:text-ink" href={import.meta.env.DEV ? 'http://localhost:8000/docs' : '/api/docs'} target="_blank" rel="noreferrer">API docs</a></li>
          </ul>
        </div>
      </div>

      <div className="container-x flex flex-col items-start gap-3 border-t border-line py-5 text-[11px] text-muted sm:flex-row sm:items-center">
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noreferrer"
          className="rounded bg-gradient-to-r from-[#90cea1] to-[#01b4e4] px-2 py-0.5 font-display text-[10px] font-extrabold tracking-widest text-[#0d253f]"
        >
          TMDB
        </a>
        <span>This product uses the TMDB API but is not endorsed or certified by TMDB. Posters, backdrops and cast photos are provided by TMDB.</span>
      </div>
      <div className="bg-accent">
        <p className="container-x py-2 text-right text-[11px] text-white">
          Copyright © {new Date().getFullYear()} WhatShouldIWatchToday - academic project
        </p>
      </div>
    </footer>
  )
}
