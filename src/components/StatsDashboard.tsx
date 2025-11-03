import { useState, useMemo } from 'react';
import {
  Container,
  Title,
  Card,
  Stack,
  Text,
  Group,
  Badge,
  Tabs,
  Progress,
} from '@mantine/core';
import {
  type CategoryStats,
  type TimePeriodStats,
  statsService,
} from '../services/statsService';
import { type SpotifyEpisode } from '../services/spotifyService';
import { categoryService } from '../services/categoryService';

interface StatsDashboardProps {
  episodes: SpotifyEpisode[];
}

export function StatsDashboard({ episodes }: StatsDashboardProps) {
  const [activeTab, setActiveTab] = useState<string | null>('week');
  const stats = useMemo<TimePeriodStats>(() => {
    return statsService.calculateStats(episodes);
  }, [episodes]);

  const categories = categoryService.getCategories();
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const getStatsForPeriod = (period: keyof TimePeriodStats): CategoryStats[] => {
    return stats[period];
  };

  const getTotalForPeriod = (
    period: keyof TimePeriodStats
  ): { hours: number; minutes: number } => {
    const periodStats = stats[period];
    const totalMinutes = periodStats.reduce((sum, stat) => sum + stat.totalMinutes, 0);
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  };

  const getMaxMinutes = (periodStats: CategoryStats[]): number => {
    if (periodStats.length === 0) return 1;
    return Math.max(...periodStats.map((s) => s.totalMinutes));
  };

  const renderStatsCard = (period: keyof TimePeriodStats) => {
    const periodStats = getStatsForPeriod(period);
    const total = getTotalForPeriod(period);
    const maxMinutes = getMaxMinutes(periodStats);

    if (periodStats.length === 0) {
      return (
        <Card shadow='sm' padding='lg' radius='md'>
          <Text c='dimmed' ta='center'>
            No data available for this time period
          </Text>
        </Card>
      );
    }

    return (
      <Stack gap='md'>
        <Card shadow='sm' padding='lg' radius='md' withBorder>
          <Text size='lg' fw={600} mb='md'>
            Total: {total.hours}h {total.minutes}m
          </Text>
        </Card>
        {periodStats.map((stat) => {
          const category = categoryMap.get(stat.categoryId);
          const percentage = (stat.totalMinutes / maxMinutes) * 100;

          return (
            <Card key={stat.categoryId} shadow='sm' padding='lg' radius='md'>
              <Group justify='space-between' mb='xs'>
                <Group gap='xs'>
                  <Badge color={category?.color || 'blue'}>{stat.categoryName}</Badge>
                </Group>
                <Text fw={600} size='lg'>
                  {stat.hours}h {stat.minutes}m
                </Text>
              </Group>
              <Progress
                value={percentage}
                color={category?.color || 'blue'}
                size='sm'
                mt='md'
              />
            </Card>
          );
        })}
      </Stack>
    );
  };

  return (
    <Container size='lg' py='xl'>
      <Title order={2} mb='xl'>
        Statistics
      </Title>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value='day'>Day</Tabs.Tab>
          <Tabs.Tab value='week'>Week</Tabs.Tab>
          <Tabs.Tab value='month'>Month</Tabs.Tab>
          <Tabs.Tab value='allTime'>All Time</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value='day' pt='xl'>
          {renderStatsCard('day')}
        </Tabs.Panel>
        <Tabs.Panel value='week' pt='xl'>
          {renderStatsCard('week')}
        </Tabs.Panel>
        <Tabs.Panel value='month' pt='xl'>
          {renderStatsCard('month')}
        </Tabs.Panel>
        <Tabs.Panel value='allTime' pt='xl'>
          {renderStatsCard('allTime')}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
