import { Link } from 'react-router-dom'
import Artwork from '../Artwork'
import { Stars } from '../Badges'
import Carousel from '../Carousel'

/** Reference A's bold red "Related Movies" band, powered by Content-kNN. */
export default function RelatedMovies({ movies }) {
  if (!movies?.length) return null
  return (
    <section className="bg-accent py-14 text-white" aria-labelledby="related-title">
      <div className="container-x">
        <div className="flex items-center gap-6">
          <span className="h-0.5 flex-1 bg-white/80" aria-hidden="true" />
          <h2 id="related-title" className="text-center text-2xl font-extrabold uppercase tracking-[0.2em] sm:text-3xl">
            Related Movies
          </h2>
          <span className="h-0.5 flex-1 bg-white/80" aria-hidden="true" />
        </div>
        <p className="mt-3 text-center text-xs text-white/80">
          Content-kNN: cosine similarity of TF-IDF vectors built from genres, tags and plot.
        </p>
        <div className="mt-10 lg:px-6">
          <Carousel
            label="Related movies"
            arrowClass="border-white/80 text-white hover:bg-white/15"
            dotOn="bg-white"
            dotOff="bg-white/40"
          >
            {movies.map((m) => (
              <article key={m.id} className="w-36 shrink-0 snap-start text-center sm:w-44">
                <Link to={`/movie/${m.id}`} className="group block">
                  <Artwork movie={m} className="aspect-[2/3] shadow-card transition group-hover:-translate-y-1" />
                  <Stars rating={m.rating} className="mt-3 justify-center" size={12} />
                  <h3 className="mt-2 line-clamp-2 text-[11px] font-bold uppercase tracking-wider">{m.title}</h3>
                </Link>
                <p className="text-[11px] text-white/75">
                  {m.year}
                  {m.similarity != null && <span> · {Math.round(m.similarity * 100)}% similar</span>}
                </p>
              </article>
            ))}
          </Carousel>
        </div>
      </div>
    </section>
  )
}
