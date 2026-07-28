# Steam Status Tracker

A lightweight web application that checks a public Steam profile and displays its current status, current game, avatar, and last logoff time.

## Current features

- Looks up a profile by 17-digit SteamID64
- Keeps the Steam Web API key on the server
- Displays online, offline, away, busy, snooze, and in-game states
- Shows the current game when Steam provides it
- Refreshes the active profile every 60 seconds
- Remembers the last SteamID64 in the browser
- Works without third-party application dependencies
- Includes a responsive mobile interface

## Requirements

- Node.js 20 or newer
- A Steam Web API key
- A public Steam profile

## Local setup

1. Open this project directory:

   ```bash
   cd projects/steam-status-tracker
   ```

2. Create your private environment file from `.env.example`.

3. Replace the placeholder with your real Steam Web API key:

   ```env
   STEAM_API_KEY=your_real_key_here
   PORT=3000
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000` in a browser.

## API endpoints

### Health check

```text
GET /api/health
```

Reports whether the server is running and whether a Steam API key is configured. It never returns the key itself.

### Profile status

```text
GET /api/status?steamId=7656119XXXXXXXXXX
```

Returns normalized public profile information from Steam.

## Security

Never commit your real `.env` file or API key. Use environment variables in local development and in the hosting provider's settings.

## Current limitations

- No persistent database yet
- No status history yet
- No push notifications yet
- Only SteamID64 input is supported
- Private profile data cannot be retrieved

## Next steps

1. Add a PostgreSQL database for status history.
2. Save changes only when the player's state changes.
3. Add activity charts.
4. Add browser push notifications.
5. Deploy the service and connect a domain.
