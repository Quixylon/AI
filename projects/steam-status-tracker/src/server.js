import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const publicDirectory = path.resolve(currentDirectory, '../public');
const port = Number(process.env.PORT || 3000);

const personaStates = {
  0: 'offline',
  1: 'online',
  2: 'busy',
  3: 'away',
  4: 'snooze',
  5: 'looking-to-trade',
  6: 'looking-to-play'
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

async function getSteamStatus(steamId) {
  const apiKey = process.env.STEAM_API_KEY;

  if (!apiKey) {
    const error = new Error('STEAM_API_KEY is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  const endpoint = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/');
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('steamids', steamId);

  const apiResponse = await fetch(endpoint, {
    signal: AbortSignal.timeout(8000),
    headers: {
      'User-Agent': 'Quixylon-Steam-Status-Tracker/0.1'
    }
  });

  if (!apiResponse.ok) {
    const error = new Error(`Steam API returned HTTP ${apiResponse.status}.`);
    error.statusCode = 502;
    throw error;
  }

  const payload = await apiResponse.json();
  const player = payload?.response?.players?.[0];

  if (!player) {
    const error = new Error('Steam profile was not found or is not publicly available.');
    error.statusCode = 404;
    throw error;
  }

  const status = player.gameextrainfo
    ? 'in-game'
    : personaStates[player.personastate] || 'unknown';

  return {
    steamId: player.steamid,
    name: player.personaname,
    profileUrl: player.profileurl,
    avatar: player.avatarfull,
    status,
    personaState: personaStates[player.personastate] || 'unknown',
    gameName: player.gameextrainfo || null,
    gameId: player.gameid || null,
    lastLogoff: player.lastlogoff
      ? new Date(player.lastlogoff * 1000).toISOString()
      : null,
    fetchedAt: new Date().toISOString()
  };
}

async function serveStaticFile(requestUrl, response) {
  const requestedPath = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname;
  const relativePath = decodeURIComponent(requestedPath).replace(/^\/+/, '');
  const filePath = path.resolve(publicDirectory, relativePath);

  if (filePath !== publicDirectory && !filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    sendJson(response, 403, { error: 'Forbidden.' });
    return;
  }

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(file);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }

    console.error(error);
    sendJson(response, 500, { error: 'Failed to read the requested file.' });
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  if (requestUrl.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(process.env.STEAM_API_KEY),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (requestUrl.pathname === '/api/status') {
    const steamId = requestUrl.searchParams.get('steamId')?.trim() || '';

    if (!/^\d{17}$/.test(steamId)) {
      sendJson(response, 400, {
        error: 'Enter a valid 17-digit SteamID64.'
      });
      return;
    }

    try {
      const player = await getSteamStatus(steamId);
      sendJson(response, 200, { player });
    } catch (error) {
      console.error(error);
      sendJson(response, error.statusCode || 500, {
        error: error.message || 'Unexpected server error.'
      });
    }
    return;
  }

  await serveStaticFile(requestUrl, response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Steam Status Tracker is running on port ${port}.`);
});
