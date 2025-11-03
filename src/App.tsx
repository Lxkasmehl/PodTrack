import { useState, useEffect } from 'react';
import {
  MantineProvider,
  AppShell,
  Button,
  Group,
  Text,
  Tabs,
  Loader,
  Container,
  Stack,
} from '@mantine/core';
import { spotifyService, type SpotifyEpisode } from './services/spotifyService';
import { Login } from './components/Login';
import { PodcastList } from './components/PodcastList';
import { StatsDashboard } from './components/StatsDashboard';
import '@mantine/core/styles.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [episodes, setEpisodes] = useState<SpotifyEpisode[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>('podcasts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        await handleAuthCallback();
        checkAuth();
      } catch (error) {
        console.error('App: Error during initialization:', error);
        setLoading(false);
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Start tracking playback when authenticated
      spotifyService.startPlaybackTracking();
      console.log('Started playback tracking');
    }

    // Cleanup on unmount or when authentication changes
    return () => {
      spotifyService.stopPlaybackTracking();
    };
  }, [isAuthenticated]);

  const checkAuth = () => {
    const authenticated = spotifyService.isAuthenticated();
    setIsAuthenticated(authenticated);
    setLoading(false);
  };

  const handleAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    // Always clear URL parameters after reading them
    window.history.replaceState({}, document.title, window.location.pathname);

    if (error) {
      console.error('Spotify auth error:', error);
      return;
    }

    if (code) {
      try {
        await spotifyService.exchangeCodeForToken(code);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Failed to exchange token:', err);
        // Clear any stored tokens if exchange fails
        spotifyService.logout();
      }
    }
  };

  const handleLogout = () => {
    spotifyService.stopPlaybackTracking();
    spotifyService.logout();
    setIsAuthenticated(false);
    setEpisodes([]);
    setActiveTab('podcasts');
  };

  const handleEpisodesLoaded = (loadedEpisodes: SpotifyEpisode[]) => {
    setEpisodes(loadedEpisodes);
  };

  if (loading) {
    return (
      <MantineProvider>
        <Container
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Stack align='center' gap='md'>
            <Loader size='lg' />
            <Text>Loading...</Text>
          </Stack>
        </Container>
      </MantineProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <MantineProvider>
        <Login />
      </MantineProvider>
    );
  }

  return (
    <MantineProvider>
      <AppShell
        header={{
          height: 60,
        }}
        padding='md'
      >
        <AppShell.Header>
          <Group h='100%' px='md' justify='space-between'>
            <Text size='xl' fw={700}>
              PodTrack
            </Text>
            <Button onClick={handleLogout} variant='light' color='red'>
              Logout
            </Button>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List mb='xl'>
              <Tabs.Tab value='podcasts'>Podcasts</Tabs.Tab>
              <Tabs.Tab value='stats'>Statistics</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value='podcasts'>
              <PodcastList onEpisodesLoaded={handleEpisodesLoaded} />
            </Tabs.Panel>

            <Tabs.Panel value='stats'>
              <StatsDashboard episodes={episodes} />
            </Tabs.Panel>
          </Tabs>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

export default App;
