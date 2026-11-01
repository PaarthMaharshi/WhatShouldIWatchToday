// Display helpers shared across pages.

/** MovieLens averages are out of 5; the UI shows them out of 10 (x2). */
export const toTen = (r) => (r == null ? null : (r * 2).toFixed(1))

export const runtime = (mins) => (mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : null)

export const genreLine = (m, n = 3) =>
  [m.year, ...m.genres.slice(0, n).map((g) => g.toLowerCase())].filter(Boolean).join(', ')

export const money = (n) =>
  n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : null

/** TMDB overview, or a generated one-liner when TMDB data is not cached. */
export const synopsis = (m) => {
  if (m.overview) return m.overview
  const kind = m.genres.slice(0, 2).join(' / ').toLowerCase() || 'feature'
  const article = /^[aeiou]/.test(kind) ? 'An' : 'A'
  return (
    `${article} ${kind} film from ${m.year ?? 'an unknown year'}, ` +
    `rated ${toTen(m.rating) ?? '-'}/10 by ${m.rating_count} MovieLens viewers.`
  )
}

/** Deterministic hue per movie, used for placeholder art when TMDB is absent. */
export const hueFor = (id) => (Number(id) * 47) % 360
