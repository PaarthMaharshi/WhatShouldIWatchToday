import { Link } from 'react-router-dom'

/** Temporary page for routes that are built in the next frontend step. */
export default function ComingSoon({ title }) {
  return (
    <section className="container-x py-24 text-center">
      <p className="eyebrow">In progress</p>
      <h1 className="mt-3 text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-muted">This page is being built next.</p>
      <Link to="/" className="link-underline mt-8">Back home</Link>
    </section>
  )
}
