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
  total_played_ms?: number; // Total time actually listened to
}

interface StoredEpisode extends SpotifyEpisode {
  total_played_ms: number; // Total time played across all sessions
  last_played_at: string; // Last time this episode was played
  first_played_at: string; // First time this episode was played
  sessions: Array<{
    started_at: string;
    ended_at?: string;
    progress_ms: number;
  }>;
}

class SpotifyService {
  private pollingInterval: number | null = null;
  private readonly POLLING_INTERVAL_MS = 10000; // Poll every 10 seconds (as requested)
  private readonly STORAGE_KEY = 'podtrack_episodes';
  private lastPollTime: number = 0;
  private lastEpisodeId: string | null = null;

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

    if (!clientSecret) {
      throw new Error('VITE_SPOTIFY_CLIENT_SECRET is not set in environment variables');
    }

    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not set in environment variables');
    }

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
      const errorText = await response.text();
      let errorMessage = 'Failed to exchange code for token';

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error_description || errorData.error || errorMessage;
        console.error('Spotify token exchange error:', errorData);
      } catch {
        console.error('Spotify token exchange error (raw):', errorText);
      }

      console.error('Request details:', {
        redirect_uri: REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        has_client_secret: !!clientSecret,
      });

      throw new Error(`${errorMessage} (Status: ${response.status})`);
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

  // Get currently playing track/episode
  async getCurrentlyPlaying(): Promise<any | null> {
    try {
      const url = `${SPOTIFY_API_BASE_URL}/me/player?additional_types=episode,track`;
      const response = await this.fetchWithAuth(url);

      if (response.status === 204) {
        // No content - nothing is currently playing
        return null;
      }

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching currently playing:', error);
      return null;
    }
  }

  // Store episode in localStorage
  private storeEpisode(
    episodeData: any,
    progress_ms: number,
    timePlayedMs: number
  ): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const episodes: Record<string, StoredEpisode> = stored ? JSON.parse(stored) : {};

      const episodeId = episodeData.id;
      const now = new Date().toISOString();

      if (episodes[episodeId]) {
        // Update existing episode
        const existing = episodes[episodeId];
        existing.last_played_at = now;
        existing.progress_ms = Math.min(
          progress_ms,
          episodeData.duration_ms || existing.duration_ms
        );

        // Update or add session
        const currentSession = existing.sessions[existing.sessions.length - 1];
        if (currentSession && !currentSession.ended_at) {
          // Update ongoing session - add the time played since last poll
          // Don't exceed episode duration
          const maxProgress = episodeData.duration_ms || existing.duration_ms;
          currentSession.progress_ms = Math.min(progress_ms, maxProgress);

          // Add time listened (but don't exceed episode duration)
          existing.total_played_ms = Math.min(
            (existing.total_played_ms || 0) + timePlayedMs,
            maxProgress
          );
        } else {
          // Start new session
          existing.sessions.push({
            started_at: now,
            progress_ms: progress_ms,
          });

          // Add initial time
          const maxProgress = episodeData.duration_ms || existing.duration_ms;
          existing.total_played_ms = Math.min(
            (existing.total_played_ms || 0) + timePlayedMs,
            maxProgress
          );
        }
      } else {
        // Create new episode entry
        episodes[episodeId] = {
          id: episodeData.id,
          name: episodeData.name,
          description: episodeData.description || '',
          duration_ms: episodeData.duration_ms,
          release_date: episodeData.release_date || '',
          images: episodeData.images || [],
          type: episodeData.type || 'episode',
          show: {
            id: episodeData.show?.id || '',
            name: episodeData.show?.name || '',
            publisher: episodeData.show?.publisher || '',
            images: episodeData.show?.images || [],
          },
          played_at: now,
          progress_ms: Math.min(progress_ms, episodeData.duration_ms || 0),
          total_played_ms: Math.min(timePlayedMs, episodeData.duration_ms || 0),
          last_played_at: now,
          first_played_at: now,
          sessions: [
            {
              started_at: now,
              progress_ms: progress_ms,
            },
          ],
        };
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(episodes));
    } catch (error) {
      console.error('Error storing episode:', error);
    }
  }

  // Update session when playback stops
  private updateSessionEnd(episodeId: string, finalTimeMs: number): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const episodes: Record<string, StoredEpisode> = JSON.parse(stored);
      const episode = episodes[episodeId];

      if (episode) {
        const lastSession = episode.sessions[episode.sessions.length - 1];
        if (lastSession && !lastSession.ended_at) {
          const now = new Date().toISOString();
          lastSession.ended_at = now;

          // Add final time to total
          const maxProgress = episode.duration_ms || 0;
          episode.total_played_ms = Math.min(
            (episode.total_played_ms || 0) + finalTimeMs,
            maxProgress
          );

          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(episodes));
        }
      }
    } catch (error) {
      console.error('Error updating session end:', error);
    }
  }

  // Get stored episodes
  private getStoredEpisodes(): StoredEpisode[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const episodes: Record<string, StoredEpisode> = JSON.parse(stored);
      return Object.values(episodes).sort(
        (a, b) =>
          new Date(b.last_played_at).getTime() - new Date(a.last_played_at).getTime()
      );
    } catch (error) {
      console.error('Error getting stored episodes:', error);
      return [];
    }
  }

  // Start polling for currently playing content
  startPlaybackTracking(): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

    this.lastPollTime = Date.now();
    this.lastEpisodeId = null;

    this.pollingInterval = window.setInterval(async () => {
      try {
        const now = Date.now();
        const timeSinceLastPoll = now - this.lastPollTime;
        this.lastPollTime = now;

        const playback = await this.getCurrentlyPlaying();

        if (!playback || !playback.item) {
          // Nothing playing - end session if there was one
          if (this.lastEpisodeId) {
            this.updateSessionEnd(this.lastEpisodeId, timeSinceLastPoll);
            this.lastEpisodeId = null;
          }
          return;
        }

        const item = playback.item;
        const isEpisode = item.type === 'episode';
        const isPlaying = playback.is_playing === true;

        if (isEpisode && isPlaying) {
          const progress_ms = playback.progress_ms || 0;

          // Track if episode changed
          if (this.lastEpisodeId && this.lastEpisodeId !== item.id) {
            // Previous episode ended
            this.updateSessionEnd(this.lastEpisodeId, timeSinceLastPoll);
          }

          // Update current episode with time listened
          this.storeEpisode(item, progress_ms, timeSinceLastPoll);
          this.lastEpisodeId = item.id;
        } else if (isEpisode && !isPlaying) {
          // Episode is paused - don't accumulate time
          if (this.lastEpisodeId === item.id) {
            // Same episode, just paused - don't update
            return;
          }
        } else {
          // If playing a track or not an episode, end any ongoing episode session
          if (this.lastEpisodeId) {
            this.updateSessionEnd(this.lastEpisodeId, timeSinceLastPoll);
            this.lastEpisodeId = null;
          }
        }
      } catch (error) {
        console.error('Error in playback tracking:', error);
      }
    }, this.POLLING_INTERVAL_MS);
  }

  // Stop polling
  stopPlaybackTracking(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Replace the old getRecentlyPlayedEpisodes to use stored data
  async getRecentlyPlayedEpisodes(limit = 50): Promise<SpotifyEpisode[]> {
    // Get episodes from local storage
    const storedEpisodes = this.getStoredEpisodes();

    // Convert StoredEpisode to SpotifyEpisode format
    return storedEpisodes.slice(0, limit).map((stored) => ({
      id: stored.id,
      name: stored.name,
      description: stored.description,
      duration_ms: stored.duration_ms,
      release_date: stored.release_date,
      images: stored.images,
      type: stored.type,
      show: stored.show,
      played_at: stored.last_played_at,
      progress_ms: stored.progress_ms,
      total_played_ms: stored.total_played_ms,
    }));
  }

  // Clear stored episodes (useful for testing or cleanup)
  clearStoredEpisodes(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const spotifyService = new SpotifyService();
export type { SpotifyEpisode };
