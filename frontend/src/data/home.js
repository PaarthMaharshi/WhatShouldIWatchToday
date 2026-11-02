import snapshot from './home.json'

/**
 * Home page data for signed-out visitors, saved at build time by
 * scripts/snapshot_home.py so the page shows movies without waiting for the API.
 * Signed-in users get live, personalised data instead (returns undefined).
 */
export const homeSnapshot = (userId, pick) => (userId ? undefined : pick(snapshot))
