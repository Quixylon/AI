/* =========================================================
   7. Транспортный слой GitHub Pages
   ========================================================= */
function combineSignals(signals) {
  const valid = signals.filter(Boolean);
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(valid);
  const controller = new AbortController();
  for (const signal of valid) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once:true });
  }
  return controller.signal;
}
async function fetchJson(url, { signal, method='GET', body } = {}) {
  const timeoutController = new AbortController();
  const timeout = window.setTimeout(() => timeoutController.abort(new DOMException('Request timeout', 'TimeoutError')), CONFIG.requestTimeout);
  const combined = combineSignals([signal, timeoutController.signal]);
  try {
    const response = await fetch(url, {
      method,
      signal:combined,
      cache:'no-store',
      credentials:'omit',
      headers:body ? { 'Content-Type':'application/json', 'Accept':'application/json' } : { 'Accept':'application/json' },
      body:body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error(`Сервер вернул HTTP ${response.status}`);
    const text = await response.text();
    if (!text.trim()) throw new Error('Сервер вернул пустой JSON');
    try { return JSON.parse(text); } catch { throw new Error('Сервер вернул некорректный JSON'); }
  } finally { clearTimeout(timeout); }
}
let profileSnapshot = null;
function profileLink(profile, kind) {
  return profile?.links?.find(link => (link.kind || link.id || link.icon) === kind) || null;
}
async function fetchProfileData({ signal } = {}) {
  const raw = await fetchJson(CONFIG.endpoints.profile, { signal });
  profileSnapshot = {
    ...raw,
    useSteamAvatar:true,
    links:Array.isArray(raw?.links) ? raw.links.map(item => ({
      ...item,
      id:item?.id || item?.kind,
      icon:item?.icon || item?.kind
    })) : []
  };
  return profileSnapshot;
}
async function ensureProfileSnapshot(signal) {
  if (!profileSnapshot) await fetchProfileData({ signal });
  return profileSnapshot;
}
async function fetchSteamStatus({ signal } = {}) {
  return fetchJson(CONFIG.endpoints.steamStatus, { signal });
}
async function fetchSteamHistory({ signal } = {}) {
  const rows = await fetchJson(CONFIG.endpoints.steamHistory, { signal });
  if (!Array.isArray(rows)) return [];
  const adapted = [];
  rows.forEach((entry, index) => {
    const stamp = String(entry?.startedAt || index).replace(/[^0-9A-Za-z]/g, '');
    adapted.push({ ...entry, id:`presence-${stamp}-${index}`, type:'presence' });
    if (entry?.gameName) {
      adapted.push({ ...entry, id:`game-${stamp}-${index}`, type:'game', status:'in-game' });
    }
  });
  return adapted;
}
async function fetchDiscordStatus({ signal } = {}) {
  const profile = await ensureProfileSnapshot(signal);
  const link = profileLink(profile, 'discord');
  const id = link?.url?.match(/\/users\/(\d+)/)?.[1] || '358528415558795265';
  return {
    configured:false,
    checkedAt:null,
    user:{
      id,
      displayName:profile.displayName || 'Qu’lon',
      username:'quixylon',
      avatar:null,
      avatarVersion:'profile',
      profileUrl:link?.url || null,
      status:'unknown',
      customStatus:'Статус Discord не отслеживается на этой странице'
    },
    activity:{ type:'none', name:null, details:null, state:null, startedAt:null, largeImageUrl:null, smallImageUrl:null }
  };
}
async function fetchDiscordHistory() { return []; }
async function fetchTelegramStatus({ signal } = {}) {
  const profile = await ensureProfileSnapshot(signal);
  const link = profileLink(profile, 'telegram');
  const username = link?.url?.match(/t\.me\/([^/?#]+)/i)?.[1] || 'quixylon';
  return {
    configured:false,
    checkedAt:null,
    user:{
      id:username,
      displayName:profile.displayName || 'Qu’lon',
      username,
      avatar:null,
      avatarVersion:'profile',
      bio:profile.description || '',
      profileUrl:link?.url || null,
      status:'unknown',
      lastSeenAt:null
    }
  };
}
async function fetchTelegramHistory() { return []; }
async function fetchVisitorCount({ signal } = {}) {
  const raw = await fetchJson(CONFIG.endpoints.visitors, {
    signal,
    method:'POST',
    body:{ visitorId:getVisitorId() }
  });
  return { count:Number(raw?.visitors ?? raw?.count) };
}
function enrichSteamTimingFromHistory() {
  const player = state.steam.status?.player;
  if (!player || !Array.isArray(state.steam.history)) return;
  const currentPresence = state.steam.history.find(entry => entry.type === 'presence' && !entry.endedAt);
  const currentGame = state.steam.history.find(entry => entry.type === 'game' && !entry.endedAt && (!player.gameName || entry.gameName === player.gameName));
  player.statusStartedAt = currentPresence?.startedAt || player.statusStartedAt || null;
  player.gameStartedAt = player.gameName ? (currentGame?.startedAt || currentPresence?.startedAt || player.gameStartedAt || null) : null;
}

/* =========================================================
   8. Менеджер обновлений
   ========================================================= */
class RefreshManager {
  constructor() {
    this.resources = new Map();
    this.pollingStarted = false;
    this.register('profile', fetchProfileData, normalizeProfile, data => { state.profile.data=data; state.profile.updatedAt=new Date().toISOString(); renderProfile(); });
    this.register('steamStatus', fetchSteamStatus, normalizeSteamStatus, data => { const previous=state.steam.status; state.steam.status=data; state.steam.updatedAt=data.checkedAt; enrichSteamTimingFromHistory(); renderSteam(previous); });
    this.register('steamHistory', fetchSteamHistory, rows => normalizeHistory('steam', rows), data => { state.steam.history=data; enrichSteamTimingFromHistory(); renderSteam(); renderSteamHistory(); renderSteamStats(); });
    this.register('discordStatus', fetchDiscordStatus, normalizeDiscordStatus, data => { const previous=state.discord.status; state.discord.status=data; state.discord.updatedAt=data.checkedAt; renderDiscord(previous); });
    this.register('discordHistory', fetchDiscordHistory, rows => normalizeHistory('discord', rows), data => { state.discord.history=data; renderDiscordHistory(); renderDiscordStats(); });
    this.register('telegramStatus', fetchTelegramStatus, normalizeTelegramStatus, data => { const previous=state.telegram.status; state.telegram.status=data; state.telegram.updatedAt=data.checkedAt; renderTelegram(previous); });
    this.register('telegramHistory', fetchTelegramHistory, rows => normalizeHistory('telegram', rows), data => { state.telegram.history=data; renderTelegramHistory(); renderTelegramStats(); });
    this.register('visitors', fetchVisitorCount, raw => ({ count:Number.isFinite(Number(raw?.count)) ? Math.max(0, Math.floor(Number(raw.count))) : null }), data => { state.visitors.count=data.count; renderVisitors(); });
  }
  register(name, fetcher, normalizer, apply) { this.resources.set(name, { name, fetcher, normalizer, apply, promise:null, controller:null, lastRun:null, lastSuccess:null, error:null, interval:null }); }
  get(name) { return this.resources.get(name); }
  async refresh(name, { force=false, manual=false } = {}) {
    const resource = this.get(name);
    if (!resource) return null;
    if (resource.promise && !force) return resource.promise;
    if (resource.promise && force) resource.controller?.abort();
    resource.controller = new AbortController();
    resource.lastRun = Date.now();
    const platform = name.startsWith('steam') ? 'steam' : name.startsWith('discord') ? 'discord' : name.startsWith('telegram') ? 'telegram' : name;
    setResourceBusy(platform, true, Boolean(resource.lastSuccess));
    resource.promise = (async () => {
      try {
        const raw = await resource.fetcher({ signal:resource.controller.signal });
        const data = resource.normalizer(raw);
        resource.apply(data);
        resource.lastSuccess = Date.now();
        resource.error = null;
        clearResourceError(platform);
        if (manual && name.endsWith('Status')) showToast(`${platformLabel(platform)} обновлён`, 'success');
        return data;
      } catch (error) {
        if (error?.name === 'AbortError') return null;
        resource.error = error instanceof Error ? error.message : 'Неизвестная ошибка';
        showResourceError(platform, resource.error);
        if (manual) showToast(`Не удалось обновить ${platformLabel(platform)}`, 'error');
        return null;
      } finally {
        resource.promise = null;
        setResourceBusy(platform, false, true);
        updateOverallState();
        updateStaleStates();
        updateTechnicalJson();
      }
    })();
    updateOverallState();
    return resource.promise;
  }
  refreshPlatform(platform, options={}) {
    if (platform === 'steam') return Promise.all([this.refresh('steamStatus', options), this.refresh('steamHistory', options)]);
    if (platform === 'discord') return Promise.all([this.refresh('discordStatus', options), this.refresh('discordHistory', options)]);
    if (platform === 'telegram') return Promise.all([this.refresh('telegramStatus', options), this.refresh('telegramHistory', options)]);
    return Promise.resolve([]);
  }
  async refreshAll(options={}) {
    const results = await Promise.allSettled([
      this.refresh('profile', options), this.refreshPlatform('steam', options), this.refreshPlatform('discord', options),
      this.refreshPlatform('telegram', options), this.refresh('visitors', options)
    ]);
    state.lastFullSyncAt = new Date().toISOString();
    renderSyncTime();
    if (options.manual) showToast(results.some(r => r.status === 'rejected') ? 'Обновление завершилось с ошибками' : 'Все данные обновлены', results.some(r => r.status === 'rejected') ? 'error' : 'success');
  }
  isResourceStale(name, maxAge) { const r=this.get(name); return !r?.lastSuccess || Date.now()-r.lastSuccess>maxAge; }
  refreshStale() {
    if (document.hidden) return;
    if (this.isResourceStale('profile', CONFIG.refreshIntervals.profile)) this.refresh('profile');
    if (this.isResourceStale('steamStatus', CONFIG.refreshIntervals.steam)) this.refreshPlatform('steam');
    if (this.isResourceStale('discordStatus', CONFIG.refreshIntervals.discord)) this.refreshPlatform('discord');
    if (this.isResourceStale('telegramStatus', CONFIG.refreshIntervals.telegram)) this.refreshPlatform('telegram');
  }
  startPolling() {
    if (this.pollingStarted) return;
    this.pollingStarted = true;
    const schedule = (name, ms, task) => { const r=this.get(name); if (!r || r.interval) return; r.interval=window.setInterval(() => { if (!document.hidden) task(); }, ms); };
    schedule('profile', CONFIG.refreshIntervals.profile, () => this.refresh('profile'));
    schedule('steamStatus', CONFIG.refreshIntervals.steam, () => this.refreshPlatform('steam'));
    schedule('discordStatus', CONFIG.refreshIntervals.discord, () => this.refreshPlatform('discord'));
    schedule('telegramStatus', CONFIG.refreshIntervals.telegram, () => this.refreshPlatform('telegram'));
  }
  destroy() { for (const r of this.resources.values()) { if (r.interval) clearInterval(r.interval); r.controller?.abort(); r.interval=null; } this.pollingStarted=false; }
}
const refreshManager = new RefreshManager();

/* =========================================================
   9. Форматирование времени
   ========================================================= */
const dateTimeFormatter = new Intl.DateTimeFormat(CONFIG.interface.locale, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', ...(CONFIG.interface.timeZone ? { timeZone:CONFIG.interface.timeZone } : {}) });
const timeFormatter = new Intl.DateTimeFormat(CONFIG.interface.locale, { hour:'2-digit', minute:'2-digit', ...(CONFIG.interface.timeZone ? { timeZone:CONFIG.interface.timeZone } : {}) });
function formatDateTime(value, fallback='Нет данных') {
  const date=validDate(value); if (!date) return fallback;
  const now=new Date(); const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()); const target=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  const delta=Math.round((today-target)/DAY);
  if (delta===0) return `сегодня в ${timeFormatter.format(date)}`;
  if (delta===1) return `вчера в ${timeFormatter.format(date)}`;
  return dateTimeFormatter.format(date).replace(' г.', '');
}
function formatRelativeTime(value, fallback='Нет данных') {
  const date=validDate(value); if (!date) return fallback;
  const seconds=Math.round((Date.now()-date.getTime())/1000); const abs=Math.abs(seconds);
  if (abs<10) return 'только что';
  const rtf=new Intl.RelativeTimeFormat(CONFIG.interface.locale,{numeric:'auto'});
  if (abs<60) return rtf.format(-Math.round(seconds), 'second');
  if (abs<3600) return rtf.format(-Math.round(seconds/60), 'minute');
  if (abs<86400) return rtf.format(-Math.round(seconds/3600), 'hour');
  return rtf.format(-Math.round(seconds/86400), 'day');
}
function formatDuration(seconds, fallback='Нет данных') {
  if (!Number.isFinite(Number(seconds)) || Number(seconds)<0) return fallback;
  let value=Math.floor(Number(seconds)); const days=Math.floor(value/86400); value%=86400; const hours=Math.floor(value/3600); value%=3600; const mins=Math.floor(value/60); const secs=value%60;
  if (days) return `${days} д ${hours} ч`;
  if (hours) return `${hours} ч ${mins} мин`;
  if (mins) return `${mins} мин${mins<10 && secs ? ` ${secs} сек` : ''}`;
  return `${secs} сек`;
}
function formatDateRange(start, end) { return `${formatDateTime(start)} — ${end ? formatDateTime(end) : 'Сейчас'}`; }
function getElapsedSeconds(start, end=Date.now()) { const s=validDate(start); const e=validDate(end); return s&&e ? Math.max(0,Math.floor((e-s)/1000)) : null; }
function overlapSeconds(start, end, rangeStart, rangeEnd) {
  const s=Math.max(new Date(start).getTime(), rangeStart); const e=Math.min(end ? new Date(end).getTime() : Date.now(), rangeEnd);
  return Math.max(0,Math.floor((e-s)/1000));
}
function setLiveDuration(element, start, end=null, fallback='Нет данных') {
  if (!element) return;
  if (!validDate(start)) { element.textContent=fallback; delete element.dataset.liveDuration; return; }
  element.dataset.liveDuration=start; if (end) element.dataset.liveEnd=end; else delete element.dataset.liveEnd;
  element.textContent=formatDuration(getElapsedSeconds(start, end || Date.now()), fallback);
}

/* =========================================================
   10. Менеджер изображений
   ========================================================= */
function buildVersionedImageUrl(url, version) {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;
  try { const result=new URL(url,window.location.href); if (version) result.searchParams.set('v',String(version)); return result.toString(); } catch { return null; }
}
class AvatarManager {
  constructor() { this.records=new Map(); }
  async update(key, imageId, placeholderId, sourceUrl, version, alt) {
    const image=byId(imageId), placeholder=byId(placeholderId); if (!image || !placeholder) return;
    const record=this.records.get(key) || { source:null, version:null, loaded:null, loading:false, failed:null };
    const url=buildVersionedImageUrl(sourceUrl, version);
    if (!url) { if (!record.loaded) { image.hidden=true; placeholder.hidden=false; } return; }
    if (record.source===sourceUrl && record.version===version && (record.loaded || record.loading || record.failed===url)) return;
    record.source=sourceUrl; record.version=version; record.loading=true; this.records.set(key,record);
    const loader=new Image(); loader.decoding='async'; loader.src=url;
    try {
      if (typeof loader.decode==='function') await loader.decode(); else await new Promise((resolve,reject)=>{ loader.onload=resolve; loader.onerror=reject; });
      image.style.opacity='0'; image.alt=alt || 'Аватар'; image.src=url; image.hidden=false; placeholder.hidden=true;
      requestAnimationFrame(()=>{ image.style.opacity='1'; });
      record.loaded=url; record.failed=null;
    } catch { record.failed=url; if (!record.loaded) { image.hidden=true; placeholder.hidden=false; } }
    finally { record.loading=false; }
  }
}
const avatarManager = new AvatarManager();

AvatarManager.prototype.updateOptional = async function(key, imageId, sourceUrl, version, alt) {
  const image=byId(imageId); if (!image) return;
  const record=this.records.get(key) || { source:null, version:null, loaded:null, loading:false, failed:null };
  const url=buildVersionedImageUrl(sourceUrl,version);
  if (!url) { image.hidden=true; return; }
  if (record.source===sourceUrl && record.version===version && (record.loaded || record.loading || record.failed===url)) return;
  record.source=sourceUrl; record.version=version; record.loading=true; this.records.set(key,record);
  const loader=new Image(); loader.decoding='async'; loader.src=url;
  try { if (loader.decode) await loader.decode(); else await new Promise((r,j)=>{loader.onload=r;loader.onerror=j;}); image.style.opacity='0'; image.src=url; image.alt=alt||''; image.hidden=false; requestAnimationFrame(()=>image.style.opacity='1'); record.loaded=url; record.failed=null; }
  catch { record.failed=url; if (!record.loaded) image.hidden=true; }
  finally { record.loading=false; }
};

