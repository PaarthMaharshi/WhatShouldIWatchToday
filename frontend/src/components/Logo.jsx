import { Link } from 'react-router-dom'

/** Script wordmark (like the reference's hand-lettered logo), "Today" in velvet red. */
export default function Logo({ className = '' }) {
  return (
    <Link
      to="/"
      aria-label="WhatShouldIWatchToday home"
      className={`inline-flex items-baseline whitespace-nowrap font-script text-[16px] leading-none text-ink sm:text-[24px] ${className}`}
    >
      WhatShouldIWatch<span className="text-accent">Today</span>
    </Link>
  )
}
