import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { genreLine, runtime, synopsis } from '../../format'
import Artwork from '../Artwork'
import { BigRating, MatchBadge, ReasonLine } from '../Badges'
import { ArrowLeft, ArrowRight, PlayIcon } from '../Icons'
import { HeroSkeleton } from '../Skeletons'
import { RevealText } from '../Motion'
import TrailerModal from '../TrailerModal'

/** Reference B hero: featured movie inside a faint circle, arrows either side. */
export default function Hero({ items, eyebrow, loading }) {
  const [i, setI] = useState(0)
  const [trailer, setTrailer] = useState(false)

  const firstId = items?.[0]?.id
  useEffect(() => setI(0), [firstId])

  if (loading || !items?.length) {
    return (
      <section className="container-x py-10">
        <HeroSkeleton />
      </section>
    )
  }
  const m = items[i]
  const go = (d) => setI((i + d + items.length) % items.length)

  return (
    <section className="relative overflow-hidden" aria-roledescription="carousel" aria-label="Featured movies">
      <div className="container-x relative py-10 md:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/70 md:block"
        />
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous featured movie"
          className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 p-2 text-ink/80 hover:text-accent lg:block"
        >
          <ArrowLeft />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next featured movie"
          className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 p-2 text-ink/80 hover:text-accent lg:block"
        >
          <ArrowRight />
        </button>

        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_1.35fr] lg:px-12" aria-live="polite">
          <div className="relative z-10 md:-mr-28">
            <p className="eyebrow normal-case tracking-normal">
              <span className="uppercase tracking-[0.2em] text-accent">{eyebrow}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              {genreLine(m)}
            </p>
            <RevealText as="h1" text={m.title} className="mt-3 text-4xl font-bold leading-[1.1] drop-shadow-lg sm:text-5xl" />
            <div className="mt-4 flex items-center gap-4">
              <BigRating rating={m.rating} />
              <MatchBadge match={m.match} />
            </div>
            <Link to={`/movie/${m.id}`} className="link-underline mt-5">Watch Now</Link>
            <ReasonLine reason={m.reason} className="mt-4" />
          </div>

          <Link to={`/movie/${m.id}`} className="relative block" aria-label={`Open ${m.title}`}>
            <Artwork movie={m} variant="backdrop" eager className="aspect-[16/10] w-full rounded-sm shadow-card" />
          </Link>
        </div>

        <div className="relative mt-8 grid items-center gap-6 md:grid-cols-[1fr_1fr] lg:px-12">
          <p className="max-w-md text-sm leading-relaxed text-muted md:ml-12">{synopsis(m)}</p>
          <button type="button" onClick={() => setTrailer(true)} className="group flex items-center gap-4 justify-self-start md:justify-self-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition group-hover:scale-105">
              <PlayIcon width={22} height={22} />
            </span>
            <span className="text-left">
              <span className="block font-display text-sm font-semibold">Watch Trailer</span>
              <span className="text-[11px] text-muted">{runtime(m.runtime) || 'Trailer via TMDB'}</span>
            </span>
          </button>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {items.map((it, k) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setI(k)}
              aria-label={`Show ${it.title}`}
              aria-current={k === i}
              className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-accent' : 'w-1.5 bg-muted/40 hover:bg-muted'}`}
            />
          ))}
        </div>
      </div>
      {trailer && <TrailerModal youtubeKey={m.trailer_youtube} title={m.title} onClose={() => setTrailer(false)} />}
    </section>
  )
}
