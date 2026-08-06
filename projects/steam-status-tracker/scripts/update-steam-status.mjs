import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(currentFile), '..');
const dataDirectory = path.join(projectDirectory, 'public', 'data');
const statusPath = path.join(dataDirectory, 'status.json');
const historyPath = path.join(dataDirectory, 'history.json');

const personaStates = {
  0: 'offline',
  1: 'online',
  2: 'busy',
  3: 'away',
  4: 'snooze',
  5: 'looking-to-trade',
  6: 'looking-to-play'
};

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError || error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

function comparablePlayer(player) {
  if (!player) return null;

  return {
    steamId: player.steamId,
    name: player.name,
    profileUrl: player.profileUrl,
    avatar: player.avatar,
    status: player.status,
    personaState: player.personaState,
    gameName: player.gameName,
    gameId: player.gameId,
    lastLogoff: player.lastLogoff
  };
}

function closeActiveHistoryEntry(history, endedAt) {
  const activeEntry = history.at(-1);
  if (!activeEntry || activeEntry.endedAt) return;

  activeEntry.endedAt = endedAt;
  const startedAtMs = new Date(activeEntry.startedAt).getTime();
  const endedAtMs = new Date(endedAt).getTime();

  if (Number.isFinite(startedAtMs) && Number.isFinite(endedAtMs)) {
    activeEntry.durationSeconds = Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000));
  }
}

async function fetchSteamJson(endpoint, description) {
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      'User-Agent': 'Quixylon-GitHub-Steam-Status-Tracker/1.6'
    }
  });

  if (!response.ok) {
    throw new Error(`${description} returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function resolveSteamId(apiKey) {
  const directId = process.env.STEAM_ID64?.trim();
  if (/^\d{17}$/.test(directId || '')) return directId;

  const vanity = process.env.STEAM_VANITY?.trim() || 'quixylon';
  const endpoint = new URL('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/');
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('vanityurl', vanity);

  const payload = await fetchSteamJson(endpoint, 'Steam vanity resolver');
  const resolvedId = payload?.response?.steamid;

  if (!/^\d{17}$/.test(resolvedId || '')) {
    throw new Error(`Steam vanity URL "${vanity}" could not be resolved.`);
  }

  return resolvedId;
}

async function keepLastSuccessfulData(message, previousStatus, history) {
  console.error(message);
  await setOutput('persist', 'false');
  await setOutput('notify', 'false');

  if (previousStatus?.configured && previousStatus?.player) {
    console.log('Keeping the last successful Steam data.');
    return;
  }

  await writeJson(statusPath, {
    configured: false,
    message: 'Steam-мониторинг временно недоступен. Следующая проверка выполнится автоматически.',
    checkedAt: null,
    player: null
  });
  await writeJson(historyPath, Array.isArray(history) ? history : []);
}

await mkdir(dataDirectory, { recursive: true });

const apiKey = process.env.STEAM_API_KEY?.trim();
const previousStatus = await readJson(statusPath, null);
const history = await readJson(historyPath, []);

if (!apiKey) {
  await keepLastSuccessfulData('STEAM_API_KEY is not configured.', previousStatus, history);
} else {
  try {
    const steamId = await resolveSteamId(apiKey);
    const endpoint = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/');
    endpoint.searchParams.set('key', apiKey);
    endpoint.searchParams.set('steamids', steamId);

    const payload = await fetchSteamJson(endpoint, 'Steam Web API');
    const steamPlayer = payload?.response?.players?.[0];

    if (!steamPlayer) {
      throw new Error('Steam profile was not found. Check profile visibility and identifier settings.');
    }

    const checkedAt = new Date().toISOString();
    const personaState = personaStates[steamPlayer.personastate] || 'unknown';
    const status = steamPlayer.gameextrainfo ? 'in-game' : personaState;

    const player = {
      steamId: steamPlayer.steamid,
      name: steamPlayer.personaname,
      profileUrl: steamPlayer.profileurl,
      avatar: steamPlayer.avatarfull,
      status,
      personaState,
      gameName: steamPlayer.gameextrainfo || null,
      gameId: steamPlayer.gameid || null,
      lastLogoff: steamPlayer.lastlogoff
        ? new Date(steamPlayer.lastlogoff * 1000).toISOString()
        : null
    };

    const previousPlayer = previousStatus?.player || null;
    const presenceChanged =
      !previousStatus?.configured ||
      previousPlayer?.status !== player.status ||
      previousPlayer?.gameId !== player.gameId;

    const profileChanged =
      JSON.stringify(comparablePlayer(previousPlayer)) !== JSON.stringify(comparablePlayer(player));

    const nextHistory = Array.isArray(history)
      ? history
        .filter((entry) => entry && entry.startedAt)
        .map((entry) => ({ ...entry }))
      : [];

    const activeEntry = nextHistory.at(-1);
    const historyNeedsRepair =
      !activeEntry ||
      Boolean(activeEntry.endedAt) ||
      activeEntry.status !== player.status ||
      activeEntry.gameId !== player.gameId;

    if (presenceChanged || historyNeedsRepair) {
      closeActiveHistoryEntry(nextHistory, checkedAt);
      nextHistory.push({
        status: player.status,
        personaState: player.personaState,
        gameName: player.gameName,
        gameId: player.gameId,
        startedAt: checkedAt,
        endedAt: null,
        durationSeconds: null
      });
    }

    await writeJson(statusPath, {
      configured: true,
      checkedAt,
      player
    });
    await writeJson(historyPath, nextHistory.slice(-500));
    await setOutput('persist', String(profileChanged || presenceChanged || historyNeedsRepair));
    await setOutput('notify', String(presenceChanged));

    console.log(`Updated ${player.name}: ${player.status}${player.gameName ? ` — ${player.gameName}` : ''}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await keepLastSuccessfulData(message, previousStatus, history);
  }
}
