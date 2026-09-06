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
async function fixture(t, { rawHistory = JSON.stringify(history), fail = false, apiKey = 'test-only' } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'steam-updater-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'public/data'), { recursive: true });
  await copyFile(new URL('../scripts/update-steam-status.mjs', import.meta.url), path.join(root, 'scripts/update.mjs'));
  await writeFile(path.join(root, 'public/data/status.json'), JSON.stringify(status));
  await writeFile(path.join(root, 'public/data/history.json'), rawHistory);
  await writeFile(path.join(root, 'mock.mjs'), `globalThis.fetch = async () => (${JSON.stringify({ ok: !fail, status: fail ? 503 : 200 })} && { ok: ${!fail}, status: ${fail ? 503 : 200}, json: async () => (${JSON.stringify({ response: { players: [{ steamid: steamId, personaname: 'Test', profileurl: player.profileUrl, avatarfull: player.avatar, personastate: 1, gameextrainfo: 'Test Game', gameid: '123' }] } })}) });`);
  const result = spawnSync(process.execPath, ['--import', path.join(root, 'mock.mjs'), path.join(root, 'scripts/update.mjs')], { env: { STEAM_API_KEY: apiKey, STEAM_ID64: steamId }, encoding: 'utf8' });
  return { result, root, status: await readFile(path.join(root, 'public/data/status.json'), 'utf8'), history: await readFile(path.join(root, 'public/data/history.json'), 'utf8') };
}
test('API failure and missing key preserve the last successful files byte for byte', async t => {
  for (const options of [{ fail: true }, { apiKey: '' }]) {
    const actual = await fixture(t, options);
    assert.equal(actual.result.status, 0);
    assert.equal(actual.status, JSON.stringify(status));
    assert.equal(actual.history, JSON.stringify(history));
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
