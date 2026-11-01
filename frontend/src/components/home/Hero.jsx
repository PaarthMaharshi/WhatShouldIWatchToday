import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '../../context'
import Artwork from '../Artwork'
import { ReasonLine } from '../Badges'
import { ChevronRight } from '../Icons'
import { HeroSkeleton } from '../Skeletons'
import TrailerModal from '../TrailerModal'

const SLIDE_MS = 7000
const EASE = [0.22, 1, 0.36, 1]

/** Title size steps down for long titles so they stay on 2-3 lines. */
const titleSize = (t) =>
  t.length <= 12 ? 'text-[clamp(3rem,7.5vw,6.5rem)]'
    : t.length <= 24 ? 'text-[clamp(2.4rem,5.2vw,4.75rem)]'
      : 'text-[clamp(2rem,4vw,3.5rem)]'

/**
 * Editorial home hero after the reference design: huge uppercase title, accent
 * subtitle, stacked tagline, small links and a big score number on the left;
 * the film's image in black-and-white "ink" over a velvet colour block on the
 * right; numbered pagination with an autoplay progress line and a square next
 * button underneath.
 */
export default function Hero({ items, eyebrow, loading }) {
  const { motionOn } = useApp()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [trailer, setTrailer] = useState(false)

  const firstId = items?.[0]?.id
  useEffect(() => setI(0), [firstId])
  const count = items?.length ?? 0
  useEffect(() => {
    if (!motionOn || paused || count < 2) return undefined
    const t = setTimeout(() => setI((x) => (x + 1) % count), SLIDE_MS)
    return () => clearTimeout(t)
  }, [i, motionOn, paused, count])

  if (loading || !count) {
    return (
      <section className="container-x py-10">
        <HeroSkeleton />
      </section>
    )
  }
  const m = items[i]
  const next = () => setI((i + 1) % count)
  const score = m.rating != null ? String(Math.round(m.rating * 20)).padStart(3, '0') : '—'
  const tagline = [...eyebrow.split(' '), m.year].filter(Boolean)
  const anim = (props) => (motionOn ? props : {})

  return (
    <section
      className="relative"
      aria-roledescription="carousel"
      aria-label="Featured movies"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="container-x grid min-h-[calc(100svh-5rem)] grid-rows-[1fr_auto]">
        <div className="grid items-center gap-12 pt-6 lg:grid-cols-[0.9fr_1.35fr] lg:gap-6">
          {/* Left: words */}
          <div className="relative z-10 lg:pl-12">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={m.id}
                {...anim({
                  initial: { opacity: 0, y: 36 },
                  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
                  exit: { opacity: 0, y: -20, transition: { duration: 0.25 } },
                })}
              >
                <h1 className={`text-balance font-display font-black uppercase leading-[0.92] tracking-tight ${titleSize(m.title)}`}>
                  <Link to={`/movie/${m.id}`} className="hover:text-accent">{m.title}</Link>
                </h1>
                <p className="label-caps mt-7 text-sm text-accent">
                  {m.genres.slice(0, 3).join(' · ') || 'Feature film'}
                </p>
                <p className="mt-8 font-display text-[13px] font-extrabold uppercase leading-[1.15]">
                  {tagline.map((w) => <span key={w} className="block">{w}</span>)}
                </p>
                <ReasonLine reason={m.reason} className="mt-4 max-w-xs" />
              </motion.div>
            </AnimatePresence>

            <div className="label-caps mt-12 flex gap-7 text-[10px] text-muted">
              <Link to={`/movie/${m.id}`} className="hover:text-accent">Details</Link>
              <button type="button" onClick={() => setTrailer(true)} className="uppercase tracking-[inherit] hover:text-accent">Trailer</button>
              <Link to="/mood" className="hover:text-accent">Mood match</Link>
            </div>
            <p className="mt-10 flex items-baseline gap-2 font-display text-2xl font-bold tabular-nums">
              {score}
              <span className="label-caps text-[9px] text-muted">/100 viewer score</span>
            </p>
          </div>

          {/* Right: ink art over a velvet block */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -bottom-10 left-[12%] right-[18%] top-[58%] bg-accent sm:-bottom-[24vh] lg:-bottom-[34vh]"
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={m.id}
                className="relative z-10"
                {...anim({
                  initial: { opacity: 0, x: 60 },
                  animate: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
                  exit: { opacity: 0, x: -40, transition: { duration: 0.25 } },
                })}
              >
                <Link to={`/movie/${m.id}`} aria-label={`Open ${m.title}`} className="block">
                  <Artwork movie={m} variant="backdrop" eager label={false} className="ink-art aspect-[16/10] w-full shadow-card" />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Pagination row: 01 ——— 02 03 04 05   [>] */}
        <div className="relative z-10 flex items-center justify-between gap-6 py-8 lg:pl-12">
          <ol className="flex items-center gap-4 font-display text-xs font-semibold tabular-nums">
            {items.map((it, k) => (
              <li key={it.id} className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setI(k)}
                  aria-label={`Show ${it.title}`}
                  aria-current={k === i}
                  className={k === i ? 'text-ink' : 'text-muted hover:text-ink'}
                >
                  {String(k + 1).padStart(2, '0')}
                </button>
                {k === i && (
                  <span className="relative block h-px w-16 bg-line sm:w-32" aria-hidden="true">
                    <span
                      key={`${it.id}-${paused}`}
                      className="absolute inset-0 origin-left bg-accent"
                      style={motionOn && !paused ? { animation: `progress ${SLIDE_MS}ms linear both` } : undefined}
                    />
                  </span>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={next}
            aria-label="Next featured movie"
            className="grid h-10 w-10 place-items-center bg-ink text-bg transition hover:bg-accent"
          >
            <ChevronRight width={18} height={18} />
          </button>
        </div>
      </div>
      {trailer && <TrailerModal youtubeKey={m.trailer_youtube} title={m.title} onClose={() => setTrailer(false)} />}
    </section>
  )
}
