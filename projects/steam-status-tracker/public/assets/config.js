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
    initialVisibleEntries: 1000,
    loadMoreStep: 8,
    maximumClientEntries: 1000
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
  snooze: 'idle', offline: 'offline', recently: 'idle', 'last-week': 'idle', 'last-month': 'idle', hidden: 'offline', unknown: 'warning'
};
const ICONS = Object.freeze({
  telegram: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.94 2.51c-.52-.43-1.36-.25-2.19.05L2.58 9.18c-1.17.46-1.16 1.12-.21 1.42l4.38 1.37 1.69 5.26c.21.57.11.8.7.8.46 0 .67-.21.93-.46l2.23-2.17 4.65 3.44c.86.47 1.47.23 1.69-.8L21.5 4.51c.29-1.28-.23-1.61.44-2Zm-3.67 3.1-8.6 7.76-.33 3.53-1.35-4.31 9.62-6.07c.42-.26.81-.12.66-.91Z"/></svg>',
  discord: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.43 2.85a.08.08 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.4 18.4 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04A19.74 19.74 0 0 0 3.68 4.37a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 12.9 12.9 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.34-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.77 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.9 19.9 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z"/></svg>',
  roblox: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M5.16 1 23 5.16 18.84 23 1 18.84 5.16 1Zm5.18 8.08-1.26 5.26 5.26 1.26 1.26-5.26-5.26-1.26Z" clip-rule="evenodd"/></svg>',
  tiktok: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03a10.5 10.5 0 0 1-4.2-.97c-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75a7.31 7.31 0 0 1-1.35 3.94 7.37 7.37 0 0 1-5.91 3.21 7.14 7.14 0 0 1-4.08-1.03 7.41 7.41 0 0 1-3.65-5.72c-.02-.5-.03-1-.01-1.49a7.44 7.44 0 0 1 2.58-4.96 7.18 7.18 0 0 1 6.15-1.72c.02 1.48-.04 2.96-.04 4.44a3.33 3.33 0 0 0-3.02.37 3.24 3.24 0 0 0-1.36 1.75c-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87a3.24 3.24 0 0 0 2.77-1.61c.19-.33.4-.68.41-1.07.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z"/></svg>',
  steam: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.98 0C5.68 0 .51 4.86.02 11.04l6.43 2.66a3.6 3.6 0 0 1 2.11-.68l3.6-5.21v-.08a4.83 4.83 0 1 1 4.82 4.83h-.11l-5.14 3.67v.21a3.6 3.6 0 0 1-7.12.72L.02 15.28C1.45 20.44 6.18 24 11.98 24a12 12 0 1 0 0-24ZM7.28 18.43l-1.47-.61a2.55 2.55 0 0 0 1.31 1.25 2.55 2.55 0 0 0 3.33-1.37 2.55 2.55 0 0 0-1.37-3.33 2.52 2.52 0 0 0-1.94-.01l1.52.63a1.88 1.88 0 1 1-1.38 3.44Zm9.71-7.48a3.22 3.22 0 1 1 0-6.43 3.22 3.22 0 0 1 0 6.43Zm0-5.63a2.42 2.42 0 1 0 0 4.83 2.42 2.42 0 0 0 0-4.83Z"/></svg>',
  csrep: '<svg class="brand-icon-svg brand-icon-outline" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 6v5.5c0 4.8-3.2 8.7-8 10-4.8-1.3-8-5.2-8-10V6l8-3.5Z"/><circle cx="12" cy="11.5" r="3.1"/><path d="M12 6.6v1.8M12 14.6v1.8M7.1 11.5h1.8M15.1 11.5h1.8"/></svg>',
  github: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.16 1.18a10.96 10.96 0 0 1 5.75 0C17.03 5.03 18 5.34 18 5.34c.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.41-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.25c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>',
  generic: '<svg class="brand-icon-svg brand-icon-outline" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4.5 4.5 0 0 0 6.36.14l2.78-2.78a4.5 4.5 0 0 0-6.36-6.36l-1.59 1.59"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.36-.14l-2.78 2.78a4.5 4.5 0 0 0 6.36 6.36l1.59-1.59"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 13v6H5V6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 8h10v11H9zM5 5h10v3M5 5v11h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4 3 20h18L12 4Z" stroke="currentColor" stroke-width="1.7"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
});

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
    steamGames: { visible:CONFIG.history.initialVisibleEntries },
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
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
function normalizeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}
function normalizeProfile(raw = {}) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const links = Array.isArray(raw.links) ? raw.links.slice(0, 20).map(item => ({
    id:cleanString(item?.id || item?.kind, 'link'), label:cleanString(item?.label, 'Ссылка'),
    url:normalizeExternalUrl(item?.url), icon:cleanString(item?.icon || item?.kind, 'external')
  })).filter(item => item.url) : [];
  return {
    displayName:cleanString(raw.displayName, 'Qu’lon'), handle:cleanString(raw.handle, '@quixylon'),
    description:cleanString(raw.description, 'Мои профили, любимые игры и места, где меня можно найти.'),
    avatarUrl:normalizeExternalUrl(raw.avatarUrl) || (typeof raw.avatarUrl === 'string' && raw.avatarUrl.startsWith('data:image/') ? raw.avatarUrl : null),
    useSteamAvatar:raw.useSteamAvatar !== false, links
  };
}
function normalizeSteamStatus(raw = {}) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const player = raw?.player && typeof raw.player === 'object' ? raw.player : {};
  const status = statusSets.steam.has(player.status) ? player.status : 'unknown';
  const personaState = statusSets.steam.has(player.personaState) ? player.personaState : 'unknown';
  return { configured:raw.configured !== false, checkedAt:validDate(raw.checkedAt)?.toISOString() || null, player:{
    steamId:cleanString(player.steamId, '—'), name:cleanString(player.name, 'Неизвестный профиль'),
    profileUrl:normalizeExternalUrl(player.profileUrl), avatar:normalizeImageUrl(player.avatar), avatarVersion:cleanString(player.avatarVersion, 'steam'),
    status, personaState, gameName:cleanNullableString(player.gameName), gameId:cleanNullableString(player.gameId),
    lastLogoff:validDate(player.lastLogoff)?.toISOString() || null, statusStartedAt:validDate(player.statusStartedAt)?.toISOString() || null,
    gameStartedAt:validDate(player.gameStartedAt)?.toISOString() || null
  }};
}
function normalizeDiscordStatus(raw = {}) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const user = raw?.user && typeof raw.user === 'object' ? raw.user : {};
  const activity = raw?.activity && typeof raw.activity === 'object' ? raw.activity : {};
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
  raw = raw && typeof raw === 'object' ? raw : {};
  const user = raw?.user && typeof raw.user === 'object' ? raw.user : {};
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
  const rows = Array.isArray(rawRows) ? [...rawRows].sort((a, b) => (validDate(b?.startedAt)?.getTime() || 0) - (validDate(a?.startedAt)?.getTime() || 0)).slice(0, CONFIG.history.maximumClientEntries) : [];
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
    if (!start || start.getTime() > futureLimit || (raw.endedAt != null && !end) || (end && end < start)) continue;
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
  const previousByType = new Map();
  for (const entry of safe) {
    const stream = platform === 'steam' ? entry.type : 'all';
    const previous = previousByType.get(stream);
    if (previous && previous.endedAt && historySignature(platform, previous) === historySignature(platform, entry)) {
      const gap = new Date(entry.startedAt) - new Date(previous.endedAt);
      if (gap >= -10000 && gap <= 10000) {
        previous.endedAt = entry.endedAt;
        previous.durationSeconds = previous.endedAt ? Math.max(0, Math.round((new Date(previous.endedAt) - new Date(previous.startedAt)) / 1000)) : null;
        continue;
      }
    }
    const copy = { ...entry };
    merged.push(copy);
    previousByType.set(stream, copy);
  }
  return merged.sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt));
}

