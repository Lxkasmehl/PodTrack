# PodTrack

A web app for tracking and analyzing your podcast listening habits with Spotify integration.

## Features

- 🔐 Spotify OAuth Authentication
- 📱 Display recently played podcasts
- 🏷️ Categorize podcasts (Education, Entertainment, News, etc.)
- 📊 Statistics on listening time per category
- ⏱️ Time periods: Day, Week, Month, All Time

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Create a Spotify App:

   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Copy `Client ID` and `Client Secret`
   - **Note**: Spotify requires HTTPS for Redirect URIs. See step 5 for local development setup.

4. Add your Spotify credentials to the `.env` file:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id
VITE_SPOTIFY_CLIENT_SECRET=your_client_secret
```

5. For local development, you need an HTTPS tunnel:

   **Option A: Using localtunnel (Recommended - Free, no signup required)**

   ```bash
   # Install localtunnel globally (if not already installed)
   npm install -g localtunnel

   # Start your dev server
   npm run dev

   # In another terminal, create a tunnel (adjust port if needed)
   lt --port 5173
   ```

   Copy the HTTPS URL (e.g., `https://your-subdomain.loca.lt`) and:

   - Add it to your Spotify app's Redirect URIs
   - Add it to your `.env` file as `VITE_SPOTIFY_REDIRECT_URI=https://your-subdomain.loca.lt`

   **Option B: Using ngrok (Requires signup)**

   ```bash
   # Install ngrok: https://ngrok.com/download
   # Start your dev server
   npm run dev

   # In another terminal
   ngrok http 5173
   ```

   Use the HTTPS URL provided by ngrok in Spotify and your `.env` file.

## Important

**For Production**: Client secret authentication should be done server-side. For a production app, a backend should be implemented that handles the OAuth flow and calls the Spotify API.

The current implementation works for development, but for production, the PKCE flow or a backend should be used.

## Tech Stack

- React 19
- TypeScript
- Vite
- Mantine UI
- Spotify Web API
