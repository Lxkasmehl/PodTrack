import { useState, useEffect } from 'react';
import {
  Stack,
  Card,
  Image,
  Text,
  Badge,
  Select,
  Group,
  Title,
  Container,
  Loader,
  Alert,
} from '@mantine/core';
import { type SpotifyEpisode } from '../services/spotifyService';
import { categoryService, type Category } from '../services/categoryService';
import { spotifyService } from '../services/spotifyService';
import { IconInfoCircle } from '@tabler/icons-react';

interface PodcastListProps {
  onEpisodesLoaded: (episodes: SpotifyEpisode[]) => void;
}

export function PodcastList({ onEpisodesLoaded }: PodcastListProps) {
  const [episodes, setEpisodes] = useState<SpotifyEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadEpisodes();
    loadCategories();
  }, []);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const data = await spotifyService.getRecentlyPlayedEpisodes(50);
      setEpisodes(data);
      onEpisodesLoaded(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load podcasts');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = () => {
    setCategories(categoryService.getCategories());
  };

  const handleCategoryChange = (
    showId: string,
    showName: string,
    categoryId: string | null
  ) => {
    if (categoryId) {
      categoryService.assignCategory(showId, showName, categoryId);
      // Trigger re-render by updating episodes
      setEpisodes([...episodes]);
    } else {
      categoryService.removeCategoryAssignment(showId);
      // Trigger re-render by updating episodes
      setEpisodes([...episodes]);
    }
  };

  // Group episodes by show
  const groupedEpisodes = episodes.reduce((acc, episode) => {
    const showId = episode.show.id;
    if (!acc[showId]) {
      acc[showId] = {
        show: episode.show,
        episodes: [],
      };
    }
    acc[showId].episodes.push(episode);
    return acc;
  }, {} as Record<string, { show: SpotifyEpisode['show']; episodes: SpotifyEpisode[] }>);

  if (loading) {
    return (
      <Container size='lg'>
        <Stack align='center' gap='md' mt='xl'>
          <Loader size='lg' />
          <Text>Loading your podcasts...</Text>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size='lg' mt='xl'>
        <Alert icon={<IconInfoCircle />} title='Error' color='red'>
          {error}
        </Alert>
      </Container>
    );
  }

  const categoryOptions = [
    { value: '', label: 'No Category' },
    ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
  ];

  return (
    <Container size='lg' py='xl'>
      <Title order={2} mb='xl'>
        Recently Played Podcasts
      </Title>
      <Stack gap='md'>
        {Object.values(groupedEpisodes).map((group) => {
          const currentCategoryId =
            categoryService.getCategoryForPodcast(group.show.id) || '';

          return (
            <Card key={group.show.id} shadow='sm' padding='lg' radius='md'>
              <Group align='flex-start' gap='md'>
                <Image
                  src={group.show.images[0]?.url}
                  alt={group.show.name}
                  width={80}
                  height={80}
                  radius='md'
                />
                <div style={{ flex: 1 }}>
                  <Group justify='space-between' mb='xs'>
                    <div>
                      <Text fw={600} size='lg'>
                        {group.show.name}
                      </Text>
                      <Text size='sm' c='dimmed'>
                        {group.show.publisher}
                      </Text>
                    </div>
                    {currentCategoryId && (
                      <Badge
                        color={
                          categories.find((c) => c.id === currentCategoryId)?.color ||
                          'blue'
                        }
                      >
                        {categories.find((c) => c.id === currentCategoryId)?.name}
                      </Badge>
                    )}
                  </Group>
                  <Select
                    label='Category'
                    placeholder='Select a category'
                    data={categoryOptions}
                    value={currentCategoryId}
                    onChange={(value) =>
                      handleCategoryChange(group.show.id, group.show.name, value)
                    }
                    mt='md'
                  />
                  <Text size='xs' c='dimmed' mt='xs'>
                    {group.episodes.length} Episode
                    {group.episodes.length !== 1 ? 's' : ''}
                  </Text>
                </div>
              </Group>
            </Card>
          );
        })}
      </Stack>
    </Container>
  );
}
