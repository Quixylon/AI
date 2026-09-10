import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const steamId = '76561199524001992';
const player = { steamId, name: 'Test', profileUrl: 'https://steamcommunity.com/id/example/', avatar: 'https://avatars.steamstatic.com/test.jpg', status: 'offline', personaState: 'offline', gameName: null, gameId: null, lastLogoff: null };
const status = { configured: true, checkedAt: '2025-01-01T00:00:00Z', player };
const history = [{ status: 'offline', personaState: 'offline', gameName: null, gameId: null, startedAt: status.checkedAt, endedAt: null, durationSeconds: null }];
const summary = { steamid: steamId, personaname: 'Test', profileurl: player.profileUrl, avatarfull: player.avatar, personastate: 1, gameextrainfo: 'Test Game', gameid: '123' };
const emptyGames = { checkedAt: null, games: [] };
async function fixture(t, { rawHistory = JSON.stringify(history), fail = false, apiKey = 'test-only', live = summary, owned = {game_count:0}, recent = {total_count:0}, previousGames = emptyGames } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'steam-updater-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'public/data'), { recursive: true });
  await copyFile(new URL('../scripts/update-steam-status.mjs', import.meta.url), path.join(root, 'scripts/update.mjs'));
  await writeFile(path.join(root, 'public/data/status.json'), JSON.stringify(status));
  await writeFile(path.join(root, 'public/data/history.json'), rawHistory);
  await writeFile(path.join(root, 'public/data/games.json'), JSON.stringify(previousGames));
  await writeFile(path.join(root, 'mock.mjs'), `
    import assert from 'node:assert/strict';
    const responses = ${JSON.stringify({GetPlayerSummaries:{players:[live]},GetOwnedGames:owned,GetRecentlyPlayedGames:recent})};
    globalThis.fetch = async endpoint => {
      const url = new URL(endpoint);
      const method = url.pathname.split('/')[2];
      if (method !== 'GetPlayerSummaries') {
        const input = JSON.parse(url.searchParams.get('input_json'));
        assert.equal(input.steamid, '${steamId}');
        if(method==='GetOwnedGames') assert.equal(input.include_played_free_games,true);
      }
      const fail = ${fail} || responses[method] === 'http-error';
      return {ok:!fail,status:fail?503:200,json:async()=>({response:responses[method]})};
    };`);
  const result = spawnSync(process.execPath, ['--import', path.join(root, 'mock.mjs'), path.join(root, 'scripts/update.mjs')], { env: { STEAM_API_KEY: apiKey, STEAM_ID64: steamId }, encoding: 'utf8' });
  return { result, root, status: await readFile(path.join(root, 'public/data/status.json'), 'utf8'), history: await readFile(path.join(root, 'public/data/history.json'), 'utf8'), games: await readFile(path.join(root, 'public/data/games.json'), 'utf8') };
}
test('API failure and missing key preserve the last successful files byte for byte', async t => {
  for (const options of [{ fail: true }, { apiKey: '' }]) {
    const actual = await fixture(t, options);
    assert.equal(actual.result.status, 0);
    assert.equal(actual.status, JSON.stringify(status));
    assert.equal(actual.history, JSON.stringify(history));
    assert.equal(actual.games, JSON.stringify(emptyGames));
  }
});
test('corrupt or non-array history is rejected before any status is overwritten', async t => {
  for (const rawHistory of ['{ broken JSON', '{}']) {
    const actual = await fixture(t, { rawHistory });
    assert.notEqual(actual.result.status, 0);
    assert.equal(actual.status, JSON.stringify(status));
    assert.equal(actual.history, rawHistory);
  }
});
test('a presence change closes the previous interval and appends one current interval', async t => {
  const actual = await fixture(t);
  assert.equal(actual.result.status, 0, actual.result.stderr);
  const updated = JSON.parse(actual.status), entries = JSON.parse(actual.history);
  assert.equal(updated.player.status, 'in-game');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].endedAt, entries[1].startedAt);
  assert.equal(entries[1].startedAt, updated.checkedAt);
  assert.equal(entries[1].endedAt, null);
  assert.equal(entries[1].gameId, updated.player.gameId);
  assert.ok(entries[0].durationSeconds > 0);
});

test('Steam counters recover a missed title without inventing a game session', async t => {
  const actual = await fixture(t, {
    live:{...summary,gameid:undefined,gameextrainfo:undefined},
    owned:{game_count:2,games:[{appid:40,name:'Missed Game',playtime_forever:180},{appid:50,name:'Never Played',playtime_forever:0}]},
    recent:{total_count:1,games:[{appid:40,name:'Missed Game',playtime_forever:180,playtime_2weeks:65}]}
  });
  assert.equal(actual.result.status,0,actual.result.stderr);
  const catalog=JSON.parse(actual.games), updated=JSON.parse(actual.status);
  assert.deepEqual(catalog.sources,{owned:'ok',recent:'ok'});
  assert.equal(catalog.games.length,1);
  assert.equal(catalog.games[0].name,'Missed Game');
  assert.equal(catalog.games[0].totalMinutes,180);
  assert.equal(catalog.games[0].recentMinutes,65);
  assert.equal(updated.player.status,'online');
  assert.ok(updated.monitoring.intervalSeconds>900);
  assert.ok(JSON.parse(actual.history).every(entry=>!entry.gameId && !entry.gameName));
});
test('an active game ID is enough to detect play and the catalog supplies its missing name', async t => {
  const actual=await fixture(t,{live:{...summary,gameextrainfo:undefined},owned:{game_count:1,games:[{appid:123,name:'Catalog Name',playtime_forever:20}]}});
  const updated=JSON.parse(actual.status);
  assert.equal(updated.player.status,'in-game');
  assert.equal(updated.player.gameName,'Catalog Name');
  assert.equal(JSON.parse(actual.history).at(-1).gameName,'Catalog Name');
});
test('catalog errors retain previous games; a successful empty recent window clears stale counters', async t => {
  const previousGames={checkedAt:'2025-01-01T00:00:00Z',games:[{appId:'123',name:'Saved Game',totalMinutes:500,recentMinutes:20,lastPlayedAt:null}]};
  const failed=await fixture(t,{previousGames,owned:'http-error',recent:{}});
  assert.deepEqual(JSON.parse(failed.games).games,previousGames.games);
  assert.deepEqual(JSON.parse(failed.games).sources,{owned:'request_failed',recent:'not_returned'});
  assert.equal(JSON.parse(failed.status).player.status,'in-game');
  const recovered=await fixture(t,{previousGames,owned:'http-error',recent:{total_count:0}});
  const saved=JSON.parse(recovered.games).games[0];
  assert.equal(saved.totalMinutes,500);
  assert.equal(saved.recentMinutes,0);
});
