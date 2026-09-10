import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(currentFile), '..');
const dataDirectory = path.join(projectDirectory, 'public', 'data');
const statusPath = path.join(dataDirectory, 'status.json');
const historyPath = path.join(dataDirectory, 'history.json');
const gamesPath = path.join(dataDirectory, 'games.json');

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
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, filePath);
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
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
      'User-Agent': 'Quixylon-GitHub-Steam-Status-Tracker/2.0'
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

// The live summary can miss a whole session between delayed scheduled runs.
// These account-level counters recover the game list, never invented sessions.
async function collectGames(apiKey, steamId, checkedAt, previous) {
  const request = async (method, input) => {
    const url = new URL(`https://api.steampowered.com/IPlayerService/${method}/v0001/`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('input_json', JSON.stringify({ steamid: steamId, ...input }));
    const data = (await fetchSteamJson(url, method))?.response;
    if (!data || (!Array.isArray(data.games) && data.game_count !== 0 && data.total_count !== 0)) {
      return { available: false, reason: 'not_returned', games: [] };
    }
    return { available: true, games: Array.isArray(data.games) ? data.games : [] };
  };
  const results = await Promise.allSettled([
    request('GetOwnedGames', { include_appinfo: true, include_played_free_games: true }),
    request('GetRecentlyPlayedGames', { count: 0 })
  ]);
  const [owned, recent] = results.map(result => result.status === 'fulfilled' ? result.value : { available: false, reason: 'request_failed', games: [] });
  const games = new Map((Array.isArray(previous?.games) ? previous.games : []).filter(g=>g && /^\d+$/.test(String(g.appId))).map(g=>[String(g.appId),{...g,appId:String(g.appId)}]));
  // A successful recent response is a fresh 14-day window; retain old data on errors.
  if (recent.available) for (const game of games.values()) game.recentMinutes = 0;
  const minutes = value => value != null && Number.isFinite(Number(value)) && Number(value)>=0 ? Math.floor(Number(value)) : null;
  for (const [source, rows] of [['owned', owned.games], ['recent', recent.games]]) {
    for (const row of rows) {
      const appId = String(row.appid || '');
      if (!/^\d+$/.test(appId) || appId==='0') continue;
      const totalMinutes = minutes(row.playtime_forever), recentMinutes = minutes(row.playtime_2weeks);
      const timestamp = Number(row.rtime_last_played);
      const lastPlayedAt = timestamp>0 && timestamp*1000<=Date.parse(checkedAt)+600000 ? new Date(timestamp*1000).toISOString() : null;
      if (!(totalMinutes>0 || recentMinutes>0 || lastPlayedAt || games.has(appId))) continue;
      const old = games.get(appId) || { appId, firstSeenAt: checkedAt };
      games.set(appId, {...old,
        name: typeof row.name==='string' && row.name.trim() ? row.name.trim() : old.name || `Игра ${appId}`,
        totalMinutes: totalMinutes ?? old.totalMinutes ?? null,
        recentMinutes: source==='recent' ? recentMinutes ?? 0 : old.recentMinutes ?? null,
        lastPlayedAt: lastPlayedAt || old.lastPlayedAt || null,
        checkedAt
      });
    }
  }
  return { checkedAt: owned.available || recent.available ? checkedAt : previous?.checkedAt || null,
    attemptedAt: checkedAt, sources: { owned: owned.available ? 'ok' : owned.reason, recent: recent.available ? 'ok' : recent.reason },
    games: [...games.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru')) };
}

await mkdir(dataDirectory, { recursive: true });

const apiKey = process.env.STEAM_API_KEY?.trim();
const previousStatus = await readJson(statusPath, null);
const history = await readJson(historyPath, []);
const previousGames = await readJson(gamesPath, { checkedAt: null, games: [] });
if (!Array.isArray(history)) throw new Error('Steam history must be an array; existing files were preserved.');

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
    const catalog = await collectGames(apiKey, steamId, checkedAt, previousGames);
    const gameId = steamPlayer.gameid ? String(steamPlayer.gameid) : null;
    const gameName = steamPlayer.gameextrainfo || (gameId ? catalog.games.find(g=>g.appId===gameId)?.name || `Игра ${gameId}` : null);
    const status = gameId || gameName ? 'in-game' : personaState;

    const player = {
      steamId: steamPlayer.steamid,
      name: steamPlayer.personaname,
      profileUrl: steamPlayer.profileurl,
      avatar: steamPlayer.avatarfull,
      status,
      personaState,
      gameName,
      gameId,
      lastLogoff: steamPlayer.lastlogoff
        ? new Date(steamPlayer.lastlogoff * 1000).toISOString()
        : null
    };

    const previousPlayer = previousStatus?.player || null;
    const presenceChanged =
      !previousStatus?.configured ||
      previousPlayer?.status !== player.status ||
      previousPlayer?.personaState !== player.personaState ||
      previousPlayer?.gameId !== player.gameId;

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
      activeEntry.personaState !== player.personaState ||
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
      monitoring: { previousCheckedAt: previousStatus?.checkedAt || null,
        intervalSeconds: previousStatus?.checkedAt ? Math.max(0, Math.round((Date.parse(checkedAt)-Date.parse(previousStatus.checkedAt))/1000)) : null },
      player
    });
    await writeJson(historyPath, nextHistory.slice(-500));
    await writeJson(gamesPath, catalog);
    // Persist the successful collection heartbeat even when presence did not change.
    await setOutput('persist', 'true');
    await setOutput('notify', String(presenceChanged));

    console.log(`Games catalog: ${catalog.games.length}; owned=${catalog.sources.owned}; recent=${catalog.sources.recent}`);
    console.log(`Updated ${player.name}: ${player.status}${player.gameName ? ` — ${player.gameName}` : ''}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await keepLastSuccessfulData(message, previousStatus, history);
  }
}
