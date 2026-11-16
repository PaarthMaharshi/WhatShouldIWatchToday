import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../context'
import { synopsis } from '../../format'
import Artwork from '../Artwork'
import { GlobeIcon, PlayIcon, ShareIcon } from '../Icons'
import { Counter, RevealText } from '../Motion'

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null

const SECTIONS = [
  ['#about', 'About'],
  ['#cast', 'Cast & crew'],
  ['#related', 'Related'],
]

function ShareLink({ title }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url: location.href })
      else {
        await navigator.clipboard.writeText(location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <button type="button" onClick={share} aria-label={copied ? 'Link copied' : 'Share this movie'}
      className="text-white/70 transition hover:text-white">
      <ShareIcon width={17} height={17} />
      <span className="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
    </button>
  )
}

/** Vertical rail on the left whose dots step through the lead cast. */
function CastRail({ cast, active, onPick }) {
  return (
    <div className="absolute bottom-0 left-6 top-24 hidden w-px bg-white/25 sm:block lg:left-10" aria-hidden={!cast.length}>
      <div className="absolute bottom-28 left-1/2 flex -translate-x-1/2 flex-col gap-4">
        {cast.map((c, i) => (
          <button
            key={c.name}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Show ${c.name}`}
            aria-current={i === active}
            className={`h-2 w-2 rounded-full transition ${i === active ? 'scale-150 bg-white' : 'bg-white/40 hover:bg-white/80'}`}
          />
        ))}
      </div>
    </div>
  )
}

function InfoItem({ label, children }) {
  if (!children) return null
  return (
    <div>
      <dt className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">{label}</dt>
      <dd className="mt-1.5 text-sm text-white">{children}</dd>
    </div>
  )
}

/**
 * Full-bleed movie hero inspired by the "Joker" reference: a framed, tinted
 * backdrop with the title and synopsis on the left and a glass info column
 * with a trailer card on the right.
 */
export default function MovieHero({ movie: m, onPlay }) {
  const { motionOn } = useApp()
  const cast = m.cast.slice(0, 4)
  const [castIdx, setCastIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => setCastIdx(0), [m.id])
  useEffect(() => {
    if (!motionOn || paused || cast.length < 2) return undefined
    const t = setInterval(() => setCastIdx((i) => (i + 1) % cast.length), 4000)
    return () => clearInterval(t)
  }, [motionOn, paused, cast.length])

  const lead = cast[castIdx]
  const facts = [m.year, m.certification, m.runtime && `${m.runtime} min`].filter(Boolean)

  return (
    <section className="relative py-6 sm:py-10" aria-label={`${m.title} overview`}>
      <div className="container-x relative">
        {/* Velvet block offset behind the frame (echoes the home hero) */}
        <div aria-hidden="true" className="absolute -bottom-10 left-[22%] right-4 top-[45%] bg-accent sm:right-10" />
        <div
          className="relative isolate grid overflow-hidden shadow-card lg:min-h-[620px] lg:grid-cols-[1fr_300px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {/* Velvet duotone: black-and-white backdrop washed in red velvet */}
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            <Artwork movie={m} variant="backdrop" eager label={false} className="ink-art h-full w-full" />
            <div className="absolute inset-0 opacity-60 mix-blend-multiply" style={{ background: 'rgb(var(--accent))' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1a0609]/85 via-[#1a0609]/40 to-transparent" />
          </div>

          {/* Left: nav, title, synopsis, cast */}
          <div className="relative flex min-h-[440px] flex-col px-6 pb-10 pt-6 text-white sm:pl-16 sm:pr-10 lg:pl-24">
            <nav aria-label="Movie sections" className="hidden items-center gap-8 md:flex">
              <span className="flex flex-col gap-1.5" aria-hidden="true">
                <span className="h-0.5 w-6 bg-white" />
                <span className="h-0.5 w-4 bg-white" />
              </span>
              {SECTIONS.map(([href, label]) => (
                <a key={href} href={href} className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75 hover:text-white">
                  {label}
                </a>
              ))}
            </nav>

            <CastRail cast={cast} active={castIdx} onPick={setCastIdx} />

            <div className="mt-auto max-w-xl pt-16 lg:pt-24">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                {facts.join('  ·  ')}
              </p>
              <RevealText
                as="h1"
                text={m.title}
                className="mt-3 font-display text-4xl font-extrabold leading-[1.02] tracking-tight drop-shadow-lg sm:text-6xl"
              />
              <p className="mt-5 line-clamp-5 max-w-md text-sm leading-relaxed text-white/80">{synopsis(m)}</p>
              <a href="#about" className="group mt-6 inline-flex items-center gap-4 font-display text-[11px] font-bold uppercase tracking-[0.2em]">
                Learn more
                <span className="relative h-px w-12 bg-white transition-all group-hover:w-20" aria-hidden="true">
                  <span className="absolute -right-0.5 -top-[3px] h-[7px] w-[7px] rotate-45 border-r border-t border-white" />
                </span>
              </a>
            </div>

            {lead && (
              <div className="mt-12" aria-live={motionOn ? 'off' : 'polite'}>
                <p className="font-display text-sm font-bold text-white/60">{String(castIdx + 1).padStart(2, '0')}</p>
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Starring</p>
                <p key={lead.name} className="mt-1 text-sm text-white motion-safe:animate-[fadeIn_0.5s_ease]">{lead.name}</p>
              </div>
            )}
          </div>

          {/* Right: glass info column + trailer card */}
          <aside className="relative flex flex-col border-t border-white/10 bg-[#1a0609]/70 text-white lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between border-b border-white/10 px-7 py-5">
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Find it on</span>
              <div className="flex items-center gap-4">
                {m.tmdb_id && (
                  <a href={`https://www.themoviedb.org/movie/${m.tmdb_id}`} target="_blank" rel="noreferrer"
                    className="text-[11px] font-bold text-white/70 hover:text-white" aria-label="Open on TMDB">TMDB</a>
                )}
                {m.imdb_id && (
                  <a href={`https://www.imdb.com/title/${m.imdb_id}/`} target="_blank" rel="noreferrer"
                    className="text-white/70 hover:text-white" aria-label="Open on IMDb"><GlobeIcon width={17} height={17} /></a>
                )}
                <ShareLink title={m.title} />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-6 px-7 py-7 lg:grid-cols-1 lg:gap-7">
              <InfoItem label="Premiere">{longDate(m.release_date) || m.year}</InfoItem>
              <InfoItem label="Director">{m.director.join(', ')}</InfoItem>
              <InfoItem label="Music by">{m.composer?.join(', ')}</InfoItem>
              <InfoItem label="Genre">
                {m.genres.map((g, i) => (
                  <span key={g}>
                    {i > 0 && ', '}
                    <Link to={`/browse?genre=${encodeURIComponent(g)}`} className="hover:underline">{g}</Link>
                  </span>
                ))}
              </InfoItem>
              {m.rating != null && (
                <InfoItem label="Viewer score">
                  <span className="font-display text-2xl font-extrabold text-accent">
                    <Counter to={m.rating * 2} decimals={1} />
                  </span>
                  <span className="text-white/60"> /10 · {m.rating_count} ratings</span>
                </InfoItem>
              )}
            </dl>

            <button
              type="button"
              onClick={onPlay}
              className="group relative mt-auto block aspect-[16/9] w-full overflow-hidden text-left lg:aspect-auto lg:h-44"
              aria-label={`Watch ${m.title} trailer`}
            >
              <img
                src={m.gallery?.[0] || m.backdrop || m.poster || ''}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span className="absolute inset-0 bg-black/45 transition group-hover:bg-black/30" />
              <span className="absolute inset-0 flex items-center justify-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-lg transition group-hover:scale-110">
                  <PlayIcon width={16} height={16} />
                </span>
                <span className="font-display text-xs font-extrabold uppercase tracking-[0.2em]">Watch trailer</span>
              </span>
            </button>
          </aside>
        </div>
      </div>
    </section>
  )
}
