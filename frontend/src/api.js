// Thin wrapper around the FastAPI backend. In dev, /api is proxied by Vite.
const BASE = import.meta.env.VITE_API_URL || '/api'

function qs(params = {}) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail
    try {
      detail = (await res.json()).detail
    } catch {
      /* body was not JSON */
    }
    const err = new Error(typeof detail === 'string' ? detail : res.statusText)
    err.status = res.status
    throw err
  }
  return res.json()
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  // Wakes a sleeping serverless API (and loads its models) in the background.
  warmUp: () => fetch(BASE + '/health').catch(() => {}),
  genres: () => request('/genres'),
  movies: (params) => request('/movies' + qs(params)),
  movie: (id, userId) => request(`/movies/${id}` + qs({ user_id: userId })),
  trending: (k = 20, userId) => request('/trending' + qs({ k, user_id: userId })),
  recommendations: (userId, model = 'hybrid', k = 12) =>
    request(`/recommendations/${userId}` + qs({ model, k })),
  rate: (userId, movieId, rating, model = 'hybrid') =>
    post('/ratings', { user_id: userId, movie_id: movieId, rating, model }),
  unrate: (userId, movieId) => request(`/ratings/${userId}/${movieId}`, { method: 'DELETE' }),
  createUser: (body) => post('/users', body),
  demoUser: (movielensUserId) => post('/users/demo', { movielens_user_id: movielensUserId }),
  user: (id) => request(`/users/${id}`),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  favorites: (id) => request(`/users/${id}/favorites`),
  userRatings: (id) => request(`/users/${id}/ratings`),
  watchlist: (id) => request(`/users/${id}/watchlist`),
  setWatchlist: (id, movieId, on) => post(`/users/${id}/watchlist`, { movie_id: movieId, on }),
  models: () => request('/models'),
  forumPosts: (params) => request('/forum/posts' + qs(params)),
  forumPost: (id, userId) => request(`/forum/posts/${id}` + qs({ user_id: userId })),
  createPost: (body) => post('/forum/posts', body),
  deletePost: (id, userId) => request(`/forum/posts/${id}` + qs({ user_id: userId }), { method: 'DELETE' }),
  addComment: (postId, body) => post(`/forum/posts/${postId}/comments`, body),
  deleteComment: (id, userId) => request(`/forum/comments/${id}` + qs({ user_id: userId }), { method: 'DELETE' }),
  vote: (body) => post('/forum/vote', body),
  moodOptions: () => request('/mood/options'),
  mood: (body) => post('/mood', body),
  plotUrl: (name) => `${BASE}/plots/${name}`,
}
