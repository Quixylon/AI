/* =========================================================
   18. Роутинг
   ========================================================= */
function parseRoute(hash) {
  const value=(hash||'').replace(/^#/,'').replace(/\/+$/,'');
  if (!value||value==='profile') return { screen:'profile',trackerTab:'overview',canonical:'#profile' };
  if (value==='tracker'||value==='tracker/overview') return { screen:'tracker',trackerTab:'overview',canonical:'#tracker/overview' };
  const match=value.match(/^tracker\/(steam|discord|telegram)$/); if (match) return { screen:'tracker',trackerTab:match[1],canonical:`#tracker/${match[1]}` };
  return { screen:'profile',trackerTab:'overview',canonical:'#profile' };
}
function navigate(route) { const parsed=typeof route==='string'?parseRoute(route):route; if (location.hash!==parsed.canonical) location.hash=parsed.canonical; else renderRoute(false); }
function renderRoute(moveFocus=true) {
  const parsed=parseRoute(location.hash); state.route={screen:parsed.screen,trackerTab:parsed.trackerTab};
  if (location.hash!==parsed.canonical) { history.replaceState(null,'',parsed.canonical); }
  const profileActive=parsed.screen==='profile'; document.body.dataset.route=profileActive?'profile':'tracker'; document.title=profileActive?'Qu’lon — цифровой профиль':'Qu’lon — цифровой трекер';
  if (dom.profileScreen) { dom.profileScreen.hidden=!profileActive; dom.profileScreen.classList.toggle('is-active',profileActive); dom.profileScreen.setAttribute('aria-hidden',String(!profileActive)); }
  if (dom.trackerScreen) { dom.trackerScreen.hidden=profileActive; dom.trackerScreen.classList.toggle('is-active',!profileActive); dom.trackerScreen.setAttribute('aria-hidden',String(profileActive)); }
  for (const tab of $$('.tracker-tabs [role="tab"]')) {
    const selected=tab.dataset.tab===parsed.trackerTab; tab.setAttribute('aria-selected',String(selected)); tab.tabIndex=selected?0:-1; tab.classList.toggle('is-active',selected); if (selected) tab.setAttribute('aria-current','page'); else tab.removeAttribute('aria-current');
  }
  const panels={overview:'trackerOverviewView',steam:'steamView',discord:'discordView',telegram:'telegramView'};
  for (const [name,id] of Object.entries(panels)) { const panel=byId(id); if (!panel) continue; const active=!profileActive&&name===parsed.trackerTab; panel.hidden=!active; panel.classList.toggle('is-active',active); panel.setAttribute('aria-hidden',String(!active)); }
  if (moveFocus) window.setTimeout(()=>{ const target=profileActive?byId('profileName'):byId('trackerTitle'); target?.focus({preventScroll:true}); },30);
  motionController.measureSoon();
}

/* =========================================================
   19. Управление вкладками
   ========================================================= */
function handleTabKeydown(event) {
  const tabs=$$('.tracker-tabs [role="tab"]'); const current=tabs.indexOf(event.target); if (current<0) return;
  let next=current;
  if (event.key==='ArrowRight') next=(current+1)%tabs.length;
  else if (event.key==='ArrowLeft') next=(current-1+tabs.length)%tabs.length;
  else if (event.key==='Home') next=0;
  else if (event.key==='End') next=tabs.length-1;
  else if (event.key==='Enter'||event.key===' ') { event.preventDefault(); navigate(event.target.getAttribute('href')); return; }
  else return;
  event.preventDefault(); tabs[next].focus(); navigate(tabs[next].getAttribute('href'));
}

/* =========================================================
   20. Уведомления
   ========================================================= */
function showToast(message, type='info') {
  if (!dom.toastRegion) return;
  const toast=createElement('div',`toast toast--${type}`); toast.setAttribute('role','status');
  const copy=createElement('span','',message); toast.append(copy); dom.toastRegion.append(toast);
  requestAnimationFrame(()=>toast.classList.add('is-visible'));
  window.setTimeout(()=>{ toast.classList.remove('is-visible'); window.setTimeout(()=>toast.remove(),260); },3200);
}
function announce(message) { if (dom.appStatusLive) dom.appStatusLive.textContent=message; }
function platformHasData(platform) {
  if (platform==='profile') return Boolean(state.profile.data); if (platform==='visitors') return state.visitors.count!==null;
  return Boolean(state[platform]?.status || state[platform]?.history?.length);
}
function platformBusy(platform) {
  if (platform==='profile'||platform==='visitors') return Boolean(refreshManager.get(platform)?.promise);
  return Boolean(refreshManager.get(`${platform}Status`)?.promise || refreshManager.get(`${platform}History`)?.promise);
}
function setResourceBusy(platform, busy, hadData) {
  const effective=busy || platformBusy(platform);
  if (platform==='profile') { state.profile.loading=effective&&!hadData; state.profile.refreshing=effective&&hadData; }
  else if (platform==='visitors') state.visitors.loading=effective;
  else if (state[platform]) { state[platform].loading=effective&&!platformHasData(platform); state[platform].refreshing=effective&&platformHasData(platform); }
  if (platform==='steam'||platform==='discord'||platform==='telegram') {
    const card=$(`.platform-card[data-platform="${platform}"]`); card?.setAttribute('aria-busy',String(effective));
  }
  if (dom.refreshAllButton) dom.refreshAllButton.setAttribute('aria-busy',String([...refreshManager.resources.values()].some(r=>r.promise)));
}
function showResourceError(platform, message) {
  if (state[platform]) state[platform].error=message;
  const banner=byId(`${platform}ErrorBanner`); if (banner) { banner.textContent=`Не удалось обновить данные: ${message}. Последние успешные данные сохранены.`; banner.classList.add('is-visible'); }
  const overview=byId(`${platform}OverviewState`); if (overview) overview.textContent=`Ошибка: ${message}. Показаны последние данные.`;
}
function clearResourceError(platform) {
  if (state[platform]) state[platform].error=null;
  const banner=byId(`${platform}ErrorBanner`); if (banner) { banner.textContent=''; banner.classList.remove('is-visible'); }
}
function updateOverallState() {
  const resources=[...refreshManager.resources.values()]; const busy=resources.some(r=>r.promise); const errors=resources.filter(r=>r.error).length;
  if (dom.overallFetchStateText) dom.overallFetchStateText.textContent=busy?'Получение данных':errors?`Есть ошибки: ${errors}`:'Доступные источники отвечают';
  if (dom.overallFetchState) dom.overallFetchState.dataset.state=busy?'warning':errors?'danger':'online';
  if (dom.refreshAllButton) dom.refreshAllButton.setAttribute('aria-busy',String(busy));
  if (dom.syncText) dom.syncText.textContent=busy?'Идёт синхронизация…':state.lastFullSyncAt?`Последняя синхронизация ${formatRelativeTime(state.lastFullSyncAt)}`:'Синхронизация ещё не выполнялась';
}
function updateStaleStates() {
  for (const platform of ['steam','discord','telegram']) {
    const checkedAt=state[platform].status?.checkedAt; const configured=state[platform].status?.configured!==false; const stale=configured&&isStale(platform,checkedAt); const banner=byId(`${platform}StaleBanner`);
    if (banner) banner.classList.toggle('is-visible',stale&&Boolean(checkedAt));
    const note=byId(`${platform}OverviewState`); if (note&&!state[platform].error) note.textContent=stale&&checkedAt?'Данные могут быть устаревшими':'';
  }
}
function renderSyncTime() {
  if (dom.trackerLastUpdate) dom.trackerLastUpdate.textContent=`Последняя общая синхронизация: ${state.lastFullSyncAt?formatDateTime(state.lastFullSyncAt):'—'}`;
  updateOverallState();
}
function updateTechnicalJson() {
  if (!dom.technicalJson) return;
  dom.technicalJson.textContent=JSON.stringify({
    mode:CONFIG.mode,
    steam:state.steam.status, steamHistory:state.steam.history,
    discord:state.discord.status, discordHistory:state.discord.history,
    telegram:state.telegram.status, telegramHistory:state.telegram.history,
    updatedAt:{ profile:state.profile.updatedAt,steam:state.steam.updatedAt,discord:state.discord.updatedAt,telegram:state.telegram.updatedAt,lastFullSyncAt:state.lastFullSyncAt }
  },null,2);
}

/* =========================================================
   21. Копирование
   ========================================================= */
async function copyText(value) {
  const content=String(value||'').trim(); if (!content||content==='—') throw new Error('empty');
  if (navigator.clipboard?.writeText && window.isSecureContext) return navigator.clipboard.writeText(content);
  const area=document.createElement('textarea'); area.value=content; area.style.position='fixed'; area.style.opacity='0'; area.style.pointerEvents='none'; document.body.append(area); area.select();
  const success=document.execCommand('copy'); area.remove(); if (!success) throw new Error('copy failed');
}
async function handleCopy(button) {
  const target=byId(button.dataset.copyTarget); try { await copyText(target?.textContent); showToast('Скопировано','success'); announce('Скопировано'); }
  catch { showToast('Не удалось скопировать','error'); announce('Не удалось скопировать'); }
}

