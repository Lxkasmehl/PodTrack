import {
  SPOTIFY_API_BASE_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_TOKEN_URL,
  REDIRECT_URI,
} from '../config/spotify';

interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface SpotifyToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface SpotifyEpisode {
  id: string;
  name: string;
  description: string;
  duration_ms: number;
  release_date: string;
  images: Array<{ url: string }>;
  type: string;
  show: {
    id: string;
    name: string;
    publisher: string;
    images: Array<{ url: string }>;
  };
  played_at?: string;
  progress_ms?: number;
}

interface RecentlyPlayedResponse {
  items: Array<{
    track: SpotifyEpisode & { type?: string };
    played_at: string;
  }>;
}

class SpotifyService {
  private getStoredToken(): SpotifyToken | null {
    const stored = localStorage.getItem('spotify_token');
    if (!stored) return null;

    try {
      const token = JSON.parse(stored) as SpotifyToken;
      // Check if token is expired
      if (Date.now() >= token.expiresAt) {
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  private setStoredToken(token: SpotifyToken): void {
    localStorage.setItem('spotify_token', JSON.stringify(token));
  }

  private clearStoredToken(): void {
    localStorage.removeItem('spotify_token');
  }

  async exchangeCodeForToken(code: string): Promise<SpotifyToken> {
    const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;

    // Note: In production, this should be done server-side for security
    // For client-side only, we need to use PKCE flow instead
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data: AccessTokenResponse = await response.json();
    const token: SpotifyToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000 - 60000, // 1 min buffer
    };

    this.setStoredToken(token);
    return token;
  }

  private async getValidToken(): Promise<string> {
    let token = this.getStoredToken();

    if (!token || Date.now() >= token.expiresAt) {
      // Try to refresh token
      if (token?.refreshToken) {
        token = await this.refreshAccessToken(token.refreshToken);
      } else {
        throw new Error('No valid token available. Please login again.');
      }
    }

    return token.accessToken;
  }

  private async refreshAccessToken(refreshToken: string): Promise<SpotifyToken> {
    const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      this.clearStoredToken();
      throw new Error('Failed to refresh token');
    }

    const data: AccessTokenResponse = await response.json();
    const token: SpotifyToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000 - 60000,
    };

    this.setStoredToken(token);
    return token;
  }

  async fetchWithAuth(url: string): Promise<Response> {
    const token = await this.getValidToken();

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      // Token expired, try to refresh and retry
      const storedToken = this.getStoredToken();
      if (storedToken?.refreshToken) {
        await this.refreshAccessToken(storedToken.refreshToken);
        const newToken = await this.getValidToken();
        return fetch(url, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
      }
      this.clearStoredToken();
      throw new Error('Authentication failed');
    }

    return response;
  }

  async getRecentlyPlayedEpisodes(limit = 50): Promise<SpotifyEpisode[]> {
    const url = `${SPOTIFY_API_BASE_URL}/me/player/recently-played?limit=${limit}`;
    const response = await this.fetchWithAuth(url);

    if (!response.ok) {
      throw new Error('Failed to fetch recently played episodes');
    }

    const data: RecentlyPlayedResponse = await response.json();
    // Filter for episodes only and map to our format
    return data.items
      .filter((item) => item.track.type === 'episode')
      .map((item) => ({
        ...item.track,
        played_at: item.played_at,
      }));
  }

  async getUserProfile() {
    const url = `${SPOTIFY_API_BASE_URL}/me`;
    const response = await this.fetchWithAuth(url);

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    return response.json();
  }

  logout(): void {
    this.clearStoredToken();
  }

  isAuthenticated(): boolean {
    return this.getStoredToken() !== null;
  }
}

export const spotifyService = new SpotifyService();
export type { SpotifyEpisode };
