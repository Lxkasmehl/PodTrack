import { Button, Container, Title, Text, Stack } from '@mantine/core';
import { getSpotifyAuthUrl } from '../config/spotify';

export function Login() {
  const handleLogin = () => {
    window.location.href = getSpotifyAuthUrl();
  };

  return (
    <Container
      size='sm'
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack align='center' gap='xl'>
        <Title order={1}>PodTrack</Title>
        <Text size='lg' c='dimmed' ta='center'>
          Track your podcast listening habits and analyze your listening behavior
        </Text>
        <Button size='lg' onClick={handleLogin} color='green'>
          Sign in with Spotify
        </Button>
      </Stack>
    </Container>
  );
}
