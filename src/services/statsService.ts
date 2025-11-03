// Service for calculating podcast statistics

import { type SpotifyEpisode } from './spotifyService';
import { categoryService } from './categoryService';

export interface CategoryStats {
  categoryId: string;
  categoryName: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

export interface TimePeriodStats {
  day: CategoryStats[];
  week: CategoryStats[];
  month: CategoryStats[];
  allTime: CategoryStats[];
}

export class StatsService {
  private calculateStatsForPeriod(
    episodes: SpotifyEpisode[],
    periodStart: Date
  ): CategoryStats[] {
    const filteredEpisodes = episodes.filter((episode) => {
      if (!episode.played_at) return false;
      const playedDate = new Date(episode.played_at);
      return playedDate >= periodStart;
    });

    return this.calculateStatsForEpisodes(filteredEpisodes);
  }

  private calculateStatsForEpisodes(episodes: SpotifyEpisode[]): CategoryStats[] {
    const categoryMinutes: Record<string, number> = {};
    const categoryNames: Record<string, string> = {};

    // Get all categories
    const categories = categoryService.getCategories();
    categories.forEach((cat) => {
      categoryMinutes[cat.id] = 0;
      categoryNames[cat.id] = cat.name;
    });

    // Calculate listening time per category
    episodes.forEach((episode) => {
      const categoryId = categoryService.getCategoryForPodcast(episode.show.id);

      if (categoryId) {
        const durationMinutes = Math.floor(episode.duration_ms / 60000);
        categoryMinutes[categoryId] =
          (categoryMinutes[categoryId] || 0) + durationMinutes;
      }
    });

    // Convert to CategoryStats array
    return Object.entries(categoryMinutes)
      .map(([categoryId, totalMinutes]) => ({
        categoryId,
        categoryName: categoryNames[categoryId] || 'Unknown',
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
        totalMinutes,
      }))
      .filter((stat) => stat.totalMinutes > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  calculateStats(episodes: SpotifyEpisode[]): TimePeriodStats {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      day: this.calculateStatsForPeriod(episodes, oneDayAgo),
      week: this.calculateStatsForPeriod(episodes, oneWeekAgo),
      month: this.calculateStatsForPeriod(episodes, oneMonthAgo),
      allTime: this.calculateStatsForEpisodes(episodes),
    };
  }

  getTotalListeningTime(episodes: SpotifyEpisode[]): {
    hours: number;
    minutes: number;
  } {
    const totalMinutes = episodes.reduce((sum, episode) => {
      const categoryId = categoryService.getCategoryForPodcast(episode.show.id);
      if (categoryId) {
        return sum + Math.floor(episode.duration_ms / 60000);
      }
      return sum;
    }, 0);

    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }
}

export const statsService = new StatsService();
