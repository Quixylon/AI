'use strict';

/* =========================================================
   1. Конфигурация
   ========================================================= */
const CONFIG = {
  mode: 'static',
  endpoints: {
    profile: './data/bio.json',
    steamStatus: './data/status.json',
    steamHistory: './data/history.json',
    visitors: 'https://quixylon-counter.naks56toq.workers.dev/'
  },
  refreshIntervals: {
    profile: 5 * 60 * 1000,
    steam: 60 * 1000,
    discord: 10 * 60 * 1000,
    telegram: 10 * 60 * 1000
  },
  staleAfter: {
    steam: 15 * 60 * 1000,
    discord: 24 * 60 * 60 * 1000,
    telegram: 24 * 60 * 60 * 1000
  },
  history: {
    initialVisibleEntries: 8,
    loadMoreStep: 8,
    maximumClientEntries: 200
  },
  interface: {
    locale: 'ru-RU',
    timeZone: null,
    desktopParticleMaximum: 105,
    mobileParticleMaximum: 55
  },
  requestTimeout: 12000
};

/* =========================================================
   2. Константы и словари
   ========================================================= */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const COARSE_POINTER = window.matchMedia('(hover: none), (pointer: coarse)');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const approximateTelegramStatuses = new Set(['recently', 'last-week', 'last-month', 'hidden']);
const statusSets = {
  steam: new Set(['offline', 'online', 'busy', 'away', 'snooze', 'looking-to-trade', 'looking-to-play', 'in-game', 'unknown']),
  discord: new Set(['online', 'idle', 'dnd', 'offline', 'unknown']),
  telegram: new Set(['online', 'recently', 'last-week', 'last-month', 'offline', 'hidden', 'unknown'])
};
const activityTypes = new Set(['playing', 'streaming', 'listening', 'watching', 'custom', 'none']);
const STEAM_STATUS = {
  offline: 'Не в сети', online: 'В сети', busy: 'Занят', away: 'Отошёл', snooze: 'Спит',
  'looking-to-trade': 'Ищет обмен', 'looking-to-play': 'Ищет игру', 'in-game': 'В игре', unknown: 'Неизвестно'
};
const DISCORD_STATUS = { online: 'В сети', idle: 'Неактивен', dnd: 'Не беспокоить', offline: 'Не в сети', unknown: 'Неизвестно' };
const DISCORD_ACTIVITY = { playing: 'Играет', streaming: 'Стримит', listening: 'Слушает', watching: 'Смотрит', custom: 'Пользовательская активность', none: 'Нет активности' };
const TELEGRAM_STATUS = {
  online: 'В сети', recently: 'Был(а) недавно', 'last-week': 'Был(а) на этой неделе',
  'last-month': 'Был(а) в этом месяце', offline: 'Не в сети', hidden: 'Время посещения скрыто', unknown: 'Неизвестно'
};
const STATE_TONE = {
  online: 'online', 'in-game': 'online', idle: 'idle', away: 'idle', busy: 'danger', dnd: 'danger',
  offline: 'offline', recently: 'idle', 'last-week': 'idle', 'last-month': 'idle', hidden: 'offline', unknown: 'warning'
};
const ICONS = {
  telegram: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 4-3 16-6-4-3 3v-5l8-7-10 6-4-2 18-7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7c3-2 7-2 10 0l2 8c-2 2-4 3-6 3l-1-2-1 2c-2 0-4-1-6-3l2-8Z" stroke="currentColor" stroke-width="1.7"/><path d="M9 12h.01M15 12h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  roblox: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 3 14 4-4 14L3 17 7 3Zm4 7-1 4 4 1 1-4-4-1Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4v11a5 5 0 1 1-4-5M14 4c1 3 3 4 6 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  steam: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="16.5" cy="7.5" r="3.5" stroke="currentColor" stroke-width="1.7"/><circle cx="7" cy="16" r="2.5" stroke="currentColor" stroke-width="1.7"/><path d="m9 15 4.8-5M4.8 14.5 2 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  csrep: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3a9 9 0 0 0-3 17.5v-2.2c-2 .4-2.5-.9-2.5-.9-.4-1-1-1.3-1-1.3-.8-.6.1-.6.1-.6.9.1 1.4 1 1.4 1 .8 1.4 2.1 1 2.6.8.1-.6.3-1 .6-1.2-1.6-.2-3.3-.8-3.3-3.6 0-.8.3-1.5.8-2-.1-.2-.4-1 .1-2 0 0 .7-.2 2.1.8a7 7 0 0 1 3.8 0c1.4-1 2.1-.8 2.1-.8.5 1 .2 1.8.1 2 .5.5.8 1.2.8 2 0 2.8-1.7 3.4-3.3 3.6.3.2.6.7.6 1.4v3A9 9 0 0 0 12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 13v6H5V6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 8h10v11H9zM5 5h10v3M5 5v11h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4 3 20h18L12 4Z" stroke="currentColor" stroke-width="1.7"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};

function createAvatarDataUri(letter, from, to) {
  const safeLetter = String(letter || 'Q').slice(0, 1).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs><rect width="256" height="256" rx="58" fill="url(#g)"/><circle cx="205" cy="48" r="74" fill="white" opacity=".13" filter="url(#b)"/><path d="M45 218c20-42 49-64 83-64 35 0 64 22 84 64" fill="white" opacity=".12"/><circle cx="128" cy="103" r="45" fill="white" opacity=".13"/><text x="128" y="150" text-anchor="middle" font-family="Arial,sans-serif" font-size="112" font-weight="700" fill="white" opacity=".93">${safeLetter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* =========================================================
   3. Источники данных
   ========================================================= */
/* Production uses the repository JSON files and the existing visitor counter.
   No synthetic profile or activity data is embedded in the page. */

/* =========================================================
   4. Состояние приложения
   ========================================================= */
const state = {
  route: { screen: 'profile', trackerTab: 'overview' },
  profile: { data:null, loading:false, refreshing:false, error:null, updatedAt:null },
  steam: { status:null, history:[], loading:false, refreshing:false, error:null, updatedAt:null },
  discord: { status:null, history:[], loading:false, refreshing:false, error:null, updatedAt:null },
  telegram: { status:null, history:[], loading:false, refreshing:false, error:null, updatedAt:null },
  visitors: { count:null, loading:false, error:null },
  historyView: {
    steam: { filter:'all', visible:CONFIG.history.initialVisibleEntries },
    steamGames: { filter:'games', visible:CONFIG.history.initialVisibleEntries },
    steamPresence: { filter:'all', visible:CONFIG.history.initialVisibleEntries },
    discord: { filter:'all', visible:CONFIG.history.initialVisibleEntries },
    telegram: { filter:'all', visible:CONFIG.history.initialVisibleEntries }
  },
  initialized:false,
  firstProfileRender:true,
  lastFullSyncAt:null
};

/* =========================================================
   5. DOM-ссылки
   ========================================================= */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const byId = id => document.getElementById(id);
const dom = {
  profileScreen:byId('profileScreen'), trackerScreen:byId('trackerScreen'), profileCard:byId('profileCard'),
  trackerTitle:byId('trackerTitle'), refreshAllButton:byId('refreshAllButton'), trackerLastUpdate:byId('trackerLastUpdate'),
  overallFetchState:byId('overallFetchState'), overallFetchStateText:byId('overallFetchStateText'), syncText:byId('syncText'),
  profileLinks:byId('profileLinks'), toastRegion:byId('toastRegion'), technicalJson:byId('technicalJson'),
  appStatusLive:byId('appStatusLive'), catButton:byId('catButton'), catHint:byId('catHint')
};

/* =========================================================
   6. Валидация и нормализация данных
   ========================================================= */
const deepClone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const cleanString = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const cleanNullableString = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const validDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
function normalizeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''), window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}
function normalizeProfile(raw = {}) {
  const links = Array.isArray(raw.links) ? raw.links.slice(0, 20).map(item => ({
    id:cleanString(item?.id || item?.kind, 'link'), label:cleanString(item?.label, 'Ссылка'),
    url:normalizeExternalUrl(item?.url), icon:cleanString(item?.icon || item?.kind, 'external')
  })).filter(item => item.url) : [];
  return {
    displayName:cleanString(raw.displayName, 'Qu’lon'), handle:cleanString(raw.handle, '@quixylon'),
    description:cleanString(raw.description, 'Здесь собраны мои некоторые цифровые следы — места, где я иногда появляюсь.'),
    avatarUrl:normalizeExternalUrl(raw.avatarUrl) || (typeof raw.avatarUrl === 'string' && raw.avatarUrl.startsWith('data:image/') ? raw.avatarUrl : null),
    useSteamAvatar:raw.useSteamAvatar !== false, links
  };
}
function normalizeSteamStatus(raw = {}) {
  const player = raw && typeof raw.player === 'object' ? raw.player : {};
  const status = statusSets.steam.has(player.status) ? player.status : 'unknown';
  const personaState = statusSets.steam.has(player.personaState) ? player.personaState : 'unknown';
  return { configured:raw.configured !== false, checkedAt:validDate(raw.checkedAt)?.toISOString() || null, player:{
    steamId:cleanString(player.steamId, '—'), name:cleanString(player.name, 'Неизвестный профиль'),
    profileUrl:normalizeExternalUrl(player.profileUrl), avatar:normalizeImageUrl(player.avatar), avatarVersion:cleanString(player.avatarVersion, cleanString(raw.checkedAt, 'steam')),
    status, personaState, gameName:cleanNullableString(player.gameName), gameId:cleanNullableString(player.gameId),
    lastLogoff:validDate(player.lastLogoff)?.toISOString() || null, statusStartedAt:validDate(player.statusStartedAt)?.toISOString() || null,
    gameStartedAt:validDate(player.gameStartedAt)?.toISOString() || null
  }};
}
function normalizeDiscordStatus(raw = {}) {
  const user = raw && typeof raw.user === 'object' ? raw.user : {};
  const activity = raw && typeof raw.activity === 'object' ? raw.activity : {};
  const status = statusSets.discord.has(user.status) ? user.status : 'unknown';
  const type = activityTypes.has(activity.type) ? activity.type : 'none';
  return { configured:raw.configured !== false, checkedAt:validDate(raw.checkedAt)?.toISOString() || null, user:{
    id:cleanString(user.id, '—'), displayName:cleanString(user.displayName, 'Qu’lon'), username:cleanString(user.username, 'quixylon'),
    avatar:normalizeImageUrl(user.avatar), avatarVersion:cleanString(user.avatarVersion, cleanString(raw.checkedAt, 'discord')), status,
    customStatus:cleanNullableString(user.customStatus), profileUrl:normalizeExternalUrl(user.profileUrl)
  }, activity:{
    type, name:cleanNullableString(activity.name), details:cleanNullableString(activity.details), state:cleanNullableString(activity.state),
    startedAt:validDate(activity.startedAt)?.toISOString() || null, largeImageUrl:normalizeImageUrl(activity.largeImageUrl), smallImageUrl:normalizeImageUrl(activity.smallImageUrl)
  }};
}
function normalizeTelegramStatus(raw = {}) {
  const user = raw && typeof raw.user === 'object' ? raw.user : {};
  const status = statusSets.telegram.has(user.status) ? user.status : 'unknown';
  return { configured:raw.configured !== false, checkedAt:validDate(raw.checkedAt)?.toISOString() || null, user:{
    id:cleanString(user.id, '—'), displayName:cleanString(user.displayName, 'Qu’lon'), username:cleanString(user.username, 'quixylon'),
    avatar:normalizeImageUrl(user.avatar), avatarVersion:cleanString(user.avatarVersion, cleanString(raw.checkedAt, 'telegram')), bio:cleanString(user.bio, 'Описание не указано'),
    profileUrl:normalizeExternalUrl(user.profileUrl), status, lastSeenAt:validDate(user.lastSeenAt)?.toISOString() || null
  }};
}
function normalizeImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.startsWith('data:image/')) return value;
  return normalizeExternalUrl(value);
}
function historySignature(platform, entry) {
  if (platform === 'steam') return [entry.type, entry.status, entry.personaState, entry.gameName || '', entry.gameId || ''].join('|');
  if (platform === 'discord') return [entry.status, entry.activityType, entry.activityName || '', entry.customStatus || ''].join('|');
  return entry.status;
}
function normalizeHistory(platform, rawRows) {
  const rows = Array.isArray(rawRows) ? rawRows.slice(0, CONFIG.history.maximumClientEntries) : [];
  const seen = new Set();
  const futureLimit = Date.now() + 10 * MINUTE;
  const normalized = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const id = cleanString(raw.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const start = validDate(raw.startedAt);
    const end = raw.endedAt == null ? null : validDate(raw.endedAt);
    if (!start || start.getTime() > futureLimit || (end && end < start)) continue;
    const status = statusSets[platform].has(raw.status) ? raw.status : null;
    if (!status) continue;
    if (Number(raw.durationSeconds) < 0) continue;
    const base = { id, status, startedAt:start.toISOString(), endedAt:end?.toISOString() || null, durationSeconds:end ? Math.max(0, Math.round((end - start) / 1000)) : null };
    if (platform === 'steam') normalized.push({ ...base, type:raw.type === 'game' ? 'game' : 'presence', personaState:statusSets.steam.has(raw.personaState) ? raw.personaState : status, gameName:cleanNullableString(raw.gameName), gameId:cleanNullableString(raw.gameId) });
    else if (platform === 'discord') normalized.push({ ...base, activityType:activityTypes.has(raw.activityType) ? raw.activityType : 'none', activityName:cleanNullableString(raw.activityName), customStatus:cleanNullableString(raw.customStatus) });
    else normalized.push(base);
  }
  normalized.sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt));
  const openLatest = new Map();
  for (const entry of normalized) {
    if (!entry.endedAt) {
      const key = platform === 'steam' ? entry.type : 'all';
      const previous = openLatest.get(key);
      if (!previous || new Date(entry.startedAt) > new Date(previous.startedAt)) openLatest.set(key, entry);
    }
  }
  const safe = normalized.filter(entry => entry.endedAt || openLatest.get(platform === 'steam' ? entry.type : 'all') === entry);
  const merged = [];
  for (const entry of safe) {
    const previous = merged.at(-1);
    if (previous && previous.endedAt && historySignature(platform, previous) === historySignature(platform, entry)) {
      const gap = new Date(entry.startedAt) - new Date(previous.endedAt);
      if (gap >= -10000 && gap <= 10000) {
        previous.endedAt = entry.endedAt;
        previous.durationSeconds = previous.endedAt ? Math.max(0, Math.round((new Date(previous.endedAt) - new Date(previous.startedAt)) / 1000)) : null;
        continue;
      }
    }
    merged.push({ ...entry });
  }
  return merged.sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt));
}

