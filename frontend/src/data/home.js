import snapshot from './home.json'

/**
 * Data saved at build time by scripts/snapshot_home.py so pages show content
 * without waiting for the API (which may be waking up on Vercel).
 */
export const saved = snapshot

/** Home page data for signed-out visitors; signed-in users get live, personalised data (undefined). */
export const homeSnapshot = (userId, pick) => (userId ? undefined : pick(snapshot))
