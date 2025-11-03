// Spotify API Configuration
export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';

export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Scopes needed for the app
export const SPOTIFY_SCOPES = [
  'user-read-recently-played',
  'user-read-private',
  'user-read-email',
  'user-top-read',
].join(' ');

// Allow override via environment variable (useful for tunnels like ngrok)
// If not set, use current origin
export const REDIRECT_URI =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI ||
  `${window.location.origin}${window.location.pathname}`;

export function getSpotifyAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    show_dialog: 'true',
  });

  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}
