import { Link } from 'react-router-dom'

/** Wordmark: "WhatShouldIWatch" with "Today" in the accent red. */
export default function Logo({ className = '' }) {
  return (
    <Link
      to="/"
      aria-label="WhatShouldIWatchToday home"
      className={`inline-flex items-baseline whitespace-nowrap font-display text-[12px] font-extrabold tracking-tight sm:text-lg ${className}`}
    >
      WhatShouldIWatch
      <span className="text-accent">Today</span>
      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent sm:h-2 sm:w-2" aria-hidden="true" />
    </Link>
  )
}
