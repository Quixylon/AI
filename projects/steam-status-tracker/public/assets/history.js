/* =========================================================
   16. Рендер историй
   ========================================================= */
function createElement(tag, className, content) {
  const el=document.createElement(tag); if (className) el.className=className; if (content!==undefined) el.textContent=content; return el;
}
function historyTitle(platform, entry) {
  if (platform==='steam') return entry.type==='game' ? (entry.gameName||'Неизвестная игра') : statusLabel('steam',entry.status);
  if (platform==='discord') return entry.activityType!=='none'&&entry.activityName ? `${statusLabel('discord',entry.status)} · ${entry.activityName}` : statusLabel('discord',entry.status);
  return statusLabel('telegram',entry.status);
}
function historyDetails(platform, entry) {
  if (platform==='steam') return '';
  if (platform==='discord') return [entry.activityType!=='none' ? (DISCORD_ACTIVITY[entry.activityType]||'Активность') : null, entry.customStatus?`Статус: ${entry.customStatus}`:null].filter(Boolean).join(' · ') || 'Без активности';
  return approximateTelegramStatuses.has(entry.status) ? 'Точное время недоступно' : entry.status==='online' ? 'Точный онлайн-период' : 'Известный период статуса';
}
function buildTimelineEntry(platform, entry) {
  const item=createElement('article','timeline-entry'); item.dataset.kind=entry.status; item.dataset.type=entry.type || 'presence';
  const head=createElement('div','timeline-entry__head'); const title=createElement('strong',entry.type==='game'?'':'timeline-entry__status',historyTitle(platform,entry)); head.append(title);
  if(!entry.endedAt) head.append(createElement('span','timeline-entry__current','Сейчас'));
  const meta=createElement('div','timeline-entry__meta');
  const range=createElement('span','',historyTimeRange(entry));
  const duration=createElement('span','timeline-entry__duration');
  if (platform==='telegram'&&approximateTelegramStatuses.has(entry.status)) duration.textContent='Точное время недоступно';
  else if (!entry.endedAt) { duration.dataset.liveDuration=entry.startedAt; duration.textContent=formatDuration(getElapsedSeconds(entry.startedAt)); }
  else duration.textContent=formatDuration(getElapsedSeconds(entry.startedAt,entry.endedAt));
  head.append(duration); meta.append(range);
  const details=createElement('p','timeline-entry__details',historyDetails(platform,entry));
  const badges=createElement('div','timeline-entry__meta');
  if (!entry.endedAt) item.dataset.current='true';
  if (platform==='telegram'&&approximateTelegramStatuses.has(entry.status)) badges.append(createElement('span','timeline-entry__badge is-approximate','Приблизительно'));
  item.append(head,meta); if (details.textContent) item.append(details); if (badges.childNodes.length) item.append(badges); return item;
}
function historyDateKey(value) {
  const date=new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
function historyDayLabel(value) {
  const date=new Date(value), today=new Date(), yesterday=new Date(today);
  yesterday.setDate(today.getDate()-1);
  if(historyDateKey(date)===historyDateKey(today)) return 'Сегодня';
  if(historyDateKey(date)===historyDateKey(yesterday)) return 'Вчера';
  return new Intl.DateTimeFormat(CONFIG.interface.locale,{day:'numeric',month:'long',...(date.getFullYear()!==today.getFullYear()?{year:'numeric'}:{})}).format(date);
}
function historyTimeRange(entry) {
  const start=timeFormatter.format(new Date(entry.startedAt));
  if(!entry.endedAt) return `${start} — сейчас`;
  const end=historyDateKey(entry.startedAt)===historyDateKey(entry.endedAt)
    ? timeFormatter.format(new Date(entry.endedAt)) : formatDateTime(entry.endedAt);
  return `${start} — ${end}`;
}
function renderTimeline(containerId, entries, platform, viewKey) {
  const container=byId(containerId); if (!container) return;
  const view=state.historyView[viewKey]; const visibleEntries=entries.slice(0,view.visible);
  const scrollTop = container.scrollTop;
  container.replaceChildren();
  if (!visibleEntries.length) container.append(createElement('div','timeline-empty',viewKey==='steamGames'?'Игровых сессий пока нет.':'Для выбранного статуса записей нет.'));
  else {
    const fragment=document.createDocumentFragment(); let previousDay=null;
    for (const entry of visibleEntries) {
      const day=historyDateKey(entry.startedAt);
      if(day!==previousDay) fragment.append(createElement('h4','timeline-day',historyDayLabel(entry.startedAt)));
      fragment.append(buildTimelineEntry(platform,entry)); previousDay=day;
    }
    container.append(fragment);
  }
  container.scrollTop = scrollTop;
  const more=byId(viewKey==='steamGames'?'steamGameMore':viewKey==='steamPresence'?'steamPresenceMore':viewKey==='discord'?'discordMore':'telegramMore');
  const collapse=byId(viewKey==='steamGames'?'steamGameCollapse':viewKey==='steamPresence'?'steamPresenceCollapse':viewKey==='discord'?'discordCollapse':'telegramCollapse');
  if (more) more.hidden=view.visible>=entries.length; if (collapse) collapse.hidden=view.visible<=CONFIG.history.initialVisibleEntries;
  motionController.measureSoon();
}
function filteredSteamHistory() {
  const filter=state.historyView.steamPresence.filter; const history=state.steam.history;
  const presence=[];
  // Game launches belong to the game stream. Preserve actual persona changes,
  // but coalesce continuous network states across game launches and exits.
  for(const raw of history.filter(e=>e.type==='presence').sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt))) {
    const persona=raw.personaState && raw.personaState!=='unknown' ? raw.personaState : raw.status;
    const entry={...raw,status:persona==='in-game'?'online':persona};
    const previous=presence.at(-1);
    const gap=previous?.endedAt ? new Date(entry.startedAt)-new Date(previous.endedAt) : Infinity;
    if(previous && previous.status===entry.status && gap>=0 && gap<=10000) {
      previous.endedAt=entry.endedAt;
    } else presence.push(entry);
  }
  return {
    games:history.filter(e=>e.type==='game'),
    presence:presence.reverse().filter(e=>filter==='all'||(filter==='online'?e.status!=='offline'&&e.status!=='unknown':e.status==='offline'))
  };
}
function renderSteamHistory() {
  const filtered=filteredSteamHistory(); renderTimeline('steamGameTimeline',filtered.games,'steam','steamGames'); renderTimeline('steamPresenceTimeline',filtered.presence,'steam','steamPresence');
  renderSteamGames(); updateTechnicalJson();
}
function renderDiscordHistory() {
  const filter=state.historyView.discord.filter;
  const entries=state.discord.history.filter(e=>filter==='all'||(filter==='activities'?e.activityType!=='none':e.status===filter));
  renderTimeline('discordTimeline',entries,'discord','discord'); updateTechnicalJson();
}
function renderTelegramHistory() {
  const filter=state.historyView.telegram.filter;
  const entries=state.telegram.history.filter(e=>filter==='all'||(filter==='approximate'?approximateTelegramStatuses.has(e.status):e.status===filter));
  renderTimeline('telegramTimeline',entries,'telegram','telegram'); updateTechnicalJson();
}
function changeHistoryVisible(key, direction) {
  const view=state.historyView[key]; if (!view) return;
  view.visible=direction==='more' ? view.visible+CONFIG.history.loadMoreStep : CONFIG.history.initialVisibleEntries;
  if (key.startsWith('steam')) renderSteamHistory(); else if (key==='discord') renderDiscordHistory(); else renderTelegramHistory();
}

/* =========================================================
   17. Статистические вычисления
   ========================================================= */
function dayBounds(offsetDays=0) {
  const now=new Date(); const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offsetDays).getTime(); const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offsetDays+1).getTime(); return { start,end };
}
function renderSteamStats() {
  const history=state.steam.history; const today=dayBounds(); const weekStart=dayBounds(-6).start;
  const presence=history.filter(e=>e.type==='presence'&&e.status!=='offline'&&e.status!=='unknown');
  const games=history.filter(e=>e.type==='game');
  const onlineToday=presence.reduce((sum,e)=>sum+overlapSeconds(e.startedAt,e.endedAt,today.start,today.end),0);
  const gamesToday=games.reduce((sum,e)=>sum+overlapSeconds(e.startedAt,e.endedAt,today.start,today.end),0);
  const games7d=games.reduce((sum,e)=>sum+overlapSeconds(e.startedAt,e.endedAt,weekStart,today.end),0);
  const unique=new Set(games.map(e=>e.gameName).filter(Boolean));
  const counts=new Map(),durations=new Map();
  for (const game of games) { const name=game.gameName||'Неизвестная игра'; counts.set(name,(counts.get(name)||0)+1); durations.set(name,(durations.get(name)||0)+(getElapsedSeconds(game.startedAt,game.endedAt||Date.now())||0)); }
  const mostLaunched=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'; const longest=[...durations].sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
  text('steamStatOnline',formatDuration(onlineToday)); text('steamStatGames',formatDuration(gamesToday)); text('steamStatGames7d',formatDuration(games7d));
  text('steamStatLaunches',games.filter(e=>new Date(e.startedAt).getTime()>=today.start&&new Date(e.startedAt).getTime()<today.end).length); text('steamStatUniqueGames',unique.size); text('steamStatLastGame',games[0]?.gameName||'—'); text('steamStatMostLaunched',mostLaunched); text('steamStatLongestGame',longest);
}
function renderDiscordStats() {
  if (state.discord.status?.configured===false) { ['discordStatOnlineToday','discordStatIdleToday','discordStatDndToday','discordStatActivityChanges','discordStatLastActivity','discordStatLongestOnline'].forEach(id=>text(id,'—')); return; }
  const history=state.discord.history; const today=dayBounds();
  const sumStatus=status=>history.filter(e=>e.status===status).reduce((sum,e)=>sum+overlapSeconds(e.startedAt,e.endedAt,today.start,today.end),0);
  const activities=history.filter(e=>e.activityType!=='none'); const longest=history.filter(e=>e.status==='online').reduce((max,e)=>Math.max(max,getElapsedSeconds(e.startedAt,e.endedAt||Date.now())||0),0);
  text('discordStatOnlineToday',formatDuration(sumStatus('online'))); text('discordStatIdleToday',formatDuration(sumStatus('idle'))); text('discordStatDndToday',formatDuration(sumStatus('dnd')));
  text('discordStatActivityChanges',activities.length); text('discordStatLastActivity',activities[0]?.activityName||'—'); text('discordStatLongestOnline',formatDuration(longest));
}
function renderTelegramStats() {
  if (state.telegram.status?.configured===false) { ['telegramStatOnlineToday','telegramStatEntriesToday','telegramStatLastEntry','telegramStatLastExit'].forEach(id=>text(id,'—')); text('telegramStatCategory','Не отслеживается'); return; }
  const history=state.telegram.history; const today=dayBounds(); const online=history.filter(e=>e.status==='online');
  const onlineToday=online.reduce((sum,e)=>sum+overlapSeconds(e.startedAt,e.endedAt,today.start,today.end),0); const entriesToday=online.filter(e=>new Date(e.startedAt).getTime()>=today.start).length;
  const lastEntry=online[0]; const lastExit=online.find(e=>e.endedAt);
  text('telegramStatOnlineToday',formatDuration(onlineToday)); text('telegramStatEntriesToday',entriesToday); text('telegramStatLastEntry',lastEntry?formatDateTime(lastEntry.startedAt):'—');
  text('telegramStatLastExit',lastExit?formatDateTime(lastExit.endedAt):'—'); text('telegramStatCategory',state.telegram.status?statusLabel('telegram',state.telegram.status.user.status):'—');
}
