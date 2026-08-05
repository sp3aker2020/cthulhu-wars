/**
 * Frontend API client for the Cthulhu Wars profile/stats backend.
 * Falls back to localStorage if the API is unreachable.
 */

const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://cthulhu-wars-api.onrender.com' : 'http://localhost:3001');

/**
 * Fetch with timeout and error handling.
 */
async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`API request failed: ${path}`, err.message);
    return null; // caller handles fallback
  }
}

/**
 * Get a player profile from the API.
 * @param {string} walletAddress
 * @returns {Promise<object|null>}
 */
export async function getProfile(walletAddress) {
  return apiFetch(`/api/profile/${encodeURIComponent(walletAddress)}`);
}

/**
 * Update a player's display name.
 * @param {string} walletAddress
 * @param {string} displayName
 * @returns {Promise<object|null>}
 */
export async function updateDisplayName(walletAddress, displayName) {
  return apiFetch(`/api/profile/${encodeURIComponent(walletAddress)}`, {
    method: 'PUT',
    body: JSON.stringify({ displayName })
  });
}

/**
 * Record a game result to the API.
 * @param {string} walletAddress
 * @param {object} result
 * @returns {Promise<object|null>}
 */
export async function recordGame(walletAddress, result) {
  return apiFetch(`/api/profile/${encodeURIComponent(walletAddress)}/game`, {
    method: 'POST',
    body: JSON.stringify(result)
  });
}

/**
 * Get match history for a player.
 * @param {string} walletAddress
 * @param {number} [limit=20]
 * @returns {Promise<Array|null>}
 */
export async function getMatchHistory(walletAddress, limit = 20) {
  return apiFetch(`/api/profile/${encodeURIComponent(walletAddress)}/history?limit=${limit}`);
}

/**
 * Get the public leaderboard.
 * @param {number} [limit=25]
 * @returns {Promise<Array|null>}
 */
export async function getLeaderboard(limit = 25) {
  return apiFetch(`/api/leaderboard?limit=${limit}`);
}
