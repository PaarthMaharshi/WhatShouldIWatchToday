// Small inline SVG icon set (no icon library dependency). All are aria-hidden;
// the button or link that wraps an icon carries the accessible label.
const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}

export const SearchIcon = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const BellIcon = (p) => (
  <svg {...base} {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
)
export const MenuIcon = (p) => (
  <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
export const CloseIcon = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const ArrowLeft = (p) => (
  <svg {...base} viewBox="0 0 40 24" width={40} {...p}><path d="M38 12H3m8-8-8 8 8 8" /></svg>
)
export const ArrowRight = (p) => (
  <svg {...base} viewBox="0 0 40 24" width={40} {...p}><path d="M2 12h35m-8-8 8 8-8 8" /></svg>
)
export const ChevronLeft = (p) => (
  <svg {...base} {...p}><path d="m15 18-6-6 6-6" /></svg>
)
export const ChevronRight = (p) => (
  <svg {...base} {...p}><path d="m9 18 6-6-6-6" /></svg>
)
export const PlayIcon = (p) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
)
export const SunIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const MoonIcon = (p) => (
  <svg {...base} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
)
export const StarIcon = ({ filled, ...p }) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  </svg>
)
export const BookmarkIcon = ({ filled, ...p }) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...p}><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg>
)
export const ChipIcon = (p) => (
  <svg {...base} {...p}><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></svg>
)
export const ExpandIcon = (p) => (
  <svg {...base} {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
)
export const ShareIcon = (p) => (
  <svg {...base} {...p}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></svg>
)
export const UsersIcon = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg>
)
export const BookIcon = (p) => (
  <svg {...base} {...p}><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H11v17H5.5A2.5 2.5 0 0 0 3 22.5zM21 5.5A2.5 2.5 0 0 0 18.5 3H13v17h5.5a2.5 2.5 0 0 1 2.5 2.5z" /></svg>
)
export const CameraIcon = (p) => (
  <svg {...base} {...p}><path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></svg>
)
export const QuoteIcon = (p) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M4 18v-5.5C4 8.4 6.2 5.8 9.5 5l.6 1.8C8.3 7.6 7.3 9 7.2 11H10v7zm9 0v-5.5c0-4.1 2.2-6.7 5.5-7.5l.6 1.8c-1.8.8-2.8 2.2-2.9 4.2H19v7z" /></svg>
)
export const InfoIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
)
export const GlobeIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
)
