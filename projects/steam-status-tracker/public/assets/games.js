'use strict';

function normalizeSteamGames(raw) {
  const number = value => value != null && Number.isFinite(Number(value)) && Number(value)>=0 ? Math.floor(Number(value)) : null;
  const sources = Object.fromEntries(['owned','recent'].map(key=>[key, ['ok','not_returned','request_failed','pending'].includes(raw?.sources?.[key]) ? raw.sources[key] : 'pending']));
  return { checkedAt: validDate(raw?.checkedAt)?.toISOString() || null, sources,
    games: (Array.isArray(raw?.games) ? raw.games : []).filter(g=>g && /^\d+$/.test(String(g.appId))).map(g=>({
      appId:String(g.appId), name:cleanString(g.name,`Игра ${g.appId}`), totalMinutes:number(g.totalMinutes), recentMinutes:number(g.recentMinutes),
      lastPlayedAt:validDate(g.lastPlayedAt)?.toISOString() || null
    })) };
}

function buildGameCatalog(history, catalog, current) {
  const games = new Map((catalog?.games || []).map(g=>[g.appId,{...g,observedSeconds:0,observedAt:null}]));
  for(const entry of history.filter(e=>e.type==='game')) {
    const appId=String(entry.gameId || '');
    const name=(entry.gameName || '').trim().toLowerCase();
    const matching=appId ? null : [...games.values()].find(g=>g.name.toLowerCase()===name);
    const key=appId || matching?.appId || `name:${name}`;
    const game=games.get(key) || {appId, name:entry.gameName || 'Неизвестная игра',totalMinutes:null,recentMinutes:null,lastPlayedAt:null,observedSeconds:0,observedAt:null};
    game.observedSeconds+=getElapsedSeconds(entry.startedAt,entry.endedAt || Date.now()) || 0;
    if(!game.observedAt || Date.parse(entry.startedAt)>Date.parse(game.observedAt)) game.observedAt=entry.startedAt;
    games.set(key,game);
  }
  const currentId=current?.gameId ? String(current.gameId) : null;
  if(currentId && !games.has(currentId)) games.set(currentId, {appId:currentId,name:current.gameName || `Игра ${currentId}`,totalMinutes:null,recentMinutes:null,lastPlayedAt:null,observedSeconds:0,observedAt:null});
  return [...games.values()].map(g=>({...g,current:Boolean(currentId && g.appId===currentId)})).sort((a,b)=>
    Number(b.current)-Number(a.current) || Number(b.recentMinutes>0)-Number(a.recentMinutes>0) ||
    (Date.parse(b.lastPlayedAt || b.observedAt)||0)-(Date.parse(a.lastPlayedAt || a.observedAt)||0) ||
    (b.totalMinutes||0)-(a.totalMinutes||0) || a.name.localeCompare(b.name,'ru'));
}

function renderSteamGames() {
  const container=byId('steamPlayedGames'); if(!container) return;
  const games=buildGameCatalog(state.steam.history,state.steam.games,state.steam.status?.player);
  const query=(byId('steamGameSearch')?.value || '').trim().toLocaleLowerCase('ru');
  const visible=games.filter(game=>game.name.toLocaleLowerCase('ru').includes(query));
  text('steamPlayedCount',query ? `${visible.length} из ${games.length}` : `Всего: ${games.length}`);
  const fragment=document.createDocumentFragment();
  for(const game of visible) {
    const item=createElement('article','played-game');
    const title=createElement('div','played-game__title');
    title.append(createElement('strong','',game.name));
    if(game.current) title.append(createElement('span','played-game__current','Сейчас'));
    const meta=createElement('div','played-game__meta');
    if(game.totalMinutes!=null) meta.append(createElement('span','',`${formatDuration(game.totalMinutes*60)} всего в Steam`));
    else if(game.observedSeconds) meta.append(createElement('span','',`Около ${formatDuration(game.observedSeconds)} в истории`));
    if(game.recentMinutes>0) meta.append(createElement('span','played-game__recent',`${formatDuration(game.recentMinutes*60)} за 14 дней`));
    if(game.lastPlayedAt) meta.append(createElement('span','',`Последний запуск: ${formatDateTime(game.lastPlayedAt)}`));
    else if(game.observedAt) meta.append(createElement('span','',`Замечена: ${formatDateTime(game.observedAt)}`));
    item.append(title,meta); fragment.append(item);
  }
  if(!visible.length) fragment.append(createElement('p','timeline-empty',query?'Таких игр в списке нет.':'Игры появятся после получения данных Steam.'));
  const scroll=container.scrollTop; container.replaceChildren(fragment); container.scrollTop=scroll;
  const sources=Object.values(state.steam.games?.sources || {});
  const note=byId('steamGamesNote');
  if(note) {
    note.textContent=sources.includes('not_returned') ? 'Steam не вернул часть игровых данных. Возможно, в профиле закрыты «Данные об играх».' : sources.includes('request_failed') ? 'Steam временно не ответил. Сохранённые игры остаются в списке.' : '';
    note.hidden=!note.textContent;
  }
  const collection=byId('steamCollectionNote');
  if(collection) {
    const interval=state.steam.status?.monitoring?.intervalSeconds;
    collection.textContent=interval>900 ? `Между последними проверками прошло ${formatDuration(interval)}. История могла пропустить короткие сессии.` : '';
    collection.hidden=!collection.textContent;
  }
  motionController.measureSoon();
}
