import { Link, useNavigate } from 'react-router-dom'
import EditProfile from '../components/EditProfile'
import { useApp } from '../context'

/** Dedicated edit-profile page (reached from the account menu). */
export default function Profile() {
  const { user, userId } = useApp()
  const navigate = useNavigate()

  if (!userId) {
    return (
      <section className="container-x py-24 text-center">
        <p className="eyebrow">Profile</p>
        <h1 className="mt-3 text-4xl font-bold">Log in to edit your profile</h1>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/login" className="inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark">Log in</Link>
          <Link to="/welcome" className="inline-block rounded-full border border-ink px-6 py-3 text-sm font-semibold hover:bg-ink hover:text-bg">Sign up</Link>
        </div>
      </section>
    )
  }

  return (
    <div className="container-x py-12">
      <p className="eyebrow">Your account</p>
      <h1 className="mt-2 text-4xl font-bold">Edit profile</h1>
      <p className="mt-2 text-sm text-muted">Change your name, favourite genres and favourite movies. Your recommendations refresh when you save.</p>
      {user
        ? <EditProfile key={user.id} onClose={() => navigate('/for-you')} />
        : <div className="skeleton mt-6 h-64" aria-hidden="true" />}
    </div>
  )
}
