/* =========================================================
   11. Рендер главного профиля
   ========================================================= */
function text(id, value, fallback='—') { const el=byId(id); if (el) el.textContent=value === null || value === undefined || value === '' ? fallback : String(value); }
function setLink(id, url) { const el=byId(id); if (!el) return; const safe=normalizeExternalUrl(url); if (safe) { el.href=safe; el.removeAttribute('aria-disabled'); el.hidden=false; } else { el.removeAttribute('href'); el.setAttribute('aria-disabled','true'); el.hidden=true; } }
function platformLabel(platform) { return ({steam:'Steam',discord:'Discord',telegram:'Telegram',profile:'профиль',visitors:'счётчик посетителей'})[platform] || platform; }
function statusLabel(platform, status) { return platform==='steam' ? (STEAM_STATUS[status]||STEAM_STATUS.unknown) : platform==='discord' ? (DISCORD_STATUS[status]||DISCORD_STATUS.unknown) : (TELEGRAM_STATUS[status]||TELEGRAM_STATUS.unknown); }
function setTone(element, status) { if (element) element.dataset.state=STATE_TONE[status] || 'warning'; }
function isStale(platform, checkedAt) { const date=validDate(checkedAt); return !date || Date.now()-date.getTime()>CONFIG.staleAfter[platform]; }
function mainSteamStatus() {
  const player=state.steam.status?.player;
  if (!player) return { text:'Steam: данные недоступны', status:'unknown' };
  if (player.gameName) return { text:`Steam: ${player.gameName}`, status:'in-game' };
  return { text:`Steam: ${(STEAM_STATUS[player.status]||'неизвестно').toLowerCase()}`, status:player.status };
}
function renderProfile() {
  const profile=state.profile.data; if (!profile) return;
  text('profileName',profile.displayName); text('profileHandle',profile.handle);
  renderDescription(profile.description);
  renderProfileLinks(profile.links);
  const steam=state.steam.status?.player;
  const avatarUrl=profile.avatarUrl || (profile.useSteamAvatar ? steam?.avatar : null);
  const avatarVersion=profile.avatarUrl ? 'profile-avatar' : steam?.avatarVersion;
  avatarManager.update('profile','profileAvatar','profileAvatarPlaceholder',avatarUrl,avatarVersion,`Аватар ${profile.displayName}`);
  const summary=mainSteamStatus(); text('profileStatusText',summary.text.replace(/^Steam:\s*/,'') || 'Данные недоступны');
  setTone(byId('profileStatusPill'),summary.status); setTone(byId('profilePresenceDot'),summary.status);
  text('profileFooterStatus',summary.text); text('profileUpdatedAt',state.steam.status?.checkedAt ? formatRelativeTime(state.steam.status.checkedAt) : state.profile.updatedAt ? formatRelativeTime(state.profile.updatedAt) : '—');
  setLink('gunsProfileButton','https://guns.lol/quixylon');
  updateDiscordLinkIndicator();
}
function renderDescription(value) {
  const element=byId('profileDescription'); if (!element) return;
  if (!state.firstProfileRender || REDUCED_MOTION.matches) { element.textContent=value; state.firstProfileRender=false; return; }
  element.textContent='';
  value.split(/(\s+)/).forEach((word,index)=>{ const span=document.createElement('span'); span.textContent=word; if (word.trim()) { span.className='description-word'; span.style.animationDelay=`${Math.min(index*36,850)}ms`; } element.append(span); });
  state.firstProfileRender=false;
}
function renderProfileLinks(links) {
  if (!dom.profileLinks) return;
  const existing=new Map($$('.social-link',dom.profileLinks).map(node=>[node.dataset.key,node]));
  for (const item of links) {
    let link=existing.get(item.id);
    if (!link) {
      link=document.createElement('a'); link.className='social-link'; link.dataset.key=item.id; link.target='_blank'; link.rel='noopener noreferrer';
      const icon=document.createElement('span'); icon.className='social-link__icon'; icon.innerHTML=ICONS[item.icon] || ICONS.external;
      const label=document.createElement('span'); label.className='social-link__label';
      const indicator=document.createElement('span'); indicator.className='discord-link-indicator'; indicator.hidden=item.id!=='discord';
      const arrow=document.createElement('span'); arrow.className='social-link__arrow'; arrow.innerHTML=ICONS.external;
      link.append(icon,label,indicator,arrow); dom.profileLinks.append(link);
    }
    link.href=item.url; const label=$('.social-link__label',link); if (label) label.textContent=item.label;
    existing.delete(item.id);
  }
  for (const orphan of existing.values()) orphan.remove();
}
function updateDiscordLinkIndicator() {
  const link=$('.social-link[data-key="discord"]'); const indicator=link?.querySelector('.discord-link-indicator'); if (!indicator) return;
  const configured=state.discord.status?.configured !== false; const status=state.discord.status?.user?.status || 'unknown'; indicator.hidden=!configured; if (!configured) return; indicator.dataset.state=STATE_TONE[status]||'warning'; indicator.title=DISCORD_STATUS[status]||DISCORD_STATUS.unknown; indicator.setAttribute('aria-label',indicator.title);
}
function renderVisitors() { text('visitorCount',state.visitors.count==null?'—':new Intl.NumberFormat('ru-RU').format(state.visitors.count)); }

/* =========================================================
   12. Рендер обзора
   ========================================================= */
function renderOverviewCard(platform, model) {
  text(`${platform}OverviewName`,model.name); text(`${platform}OverviewId`,model.id); text(`${platform}OverviewStatus`,model.status); text(`${platform}OverviewActivity`,model.activity);
  text(`${platform}OverviewUpdated`,`Обновлено: ${model.checkedAt ? formatRelativeTime(model.checkedAt) : '—'}`);
  const badge=byId(`${platform}OverviewBadge`); if (badge) { badge.textContent=model.badge; setTone(badge,model.tone); }
  const card=$(`.platform-card[data-platform="${platform}"]`); if (card) { card.setAttribute('aria-busy',String(Boolean(model.loading))); if (model.configured !== undefined) card.dataset.configured=String(model.configured); }
  const note=byId(`${platform}OverviewState`); if (note) note.textContent=model.error ? `Ошибка: ${model.error}. Показаны последние данные.` : model.configured===false ? 'Онлайн-статус не запрашивается' : model.checkedAt&&isStale(platform,model.checkedAt) ? 'Данные могут быть устаревшими' : '';
  setLink(`${platform}OverviewProfileLink`,model.profileUrl);
  avatarManager.update(`${platform}-overview`,`${platform}OverviewAvatar`,`${platform}OverviewAvatarPlaceholder`,model.avatar,model.avatarVersion,`${platformLabel(platform)}-аватар`);
}
function renderOverview() {
  const steam=state.steam.status;
  renderOverviewCard('steam', steam ? {
    name:steam.player.name,id:steam.player.steamId,status:steam.player.gameName?`В игре: ${steam.player.gameName}`:statusLabel('steam',steam.player.status),
    activity:steam.player.gameName?`App ID: ${steam.player.gameId||'не указан'}`:'Игра не запущена',
    checkedAt:steam.checkedAt,badge:steam.configured===false?'Не настроено':statusLabel('steam',steam.player.status),tone:steam.player.status,
    avatar:steam.player.avatar,avatarVersion:steam.player.avatarVersion,profileUrl:steam.player.profileUrl,error:state.steam.error,loading:state.steam.loading
  } : emptyOverviewModel('steam'));
  const discord=state.discord.status;
  renderOverviewCard('discord', discord ? {
    name:discord.user.displayName,id:`@${discord.user.username}`,status:discord.configured===false?'Статус не отслеживается':statusLabel('discord',discord.user.status),
    activity:discord.configured===false?'Прямая ссылка на Discord-профиль':discord.activity.type!=='none'&&discord.activity.name?`${DISCORD_ACTIVITY[discord.activity.type]}: ${discord.activity.name}`:'Нет текущей активности',
    checkedAt:discord.checkedAt,badge:discord.configured===false?'Профиль':statusLabel('discord',discord.user.status),tone:discord.configured===false?'unknown':discord.user.status,
    avatar:discord.user.avatar||state.steam.status?.player?.avatar,avatarVersion:discord.user.avatarVersion||state.steam.status?.checkedAt,profileUrl:discord.user.profileUrl,error:state.discord.error,loading:state.discord.loading,configured:discord.configured
  } : emptyOverviewModel('discord'));
  const telegram=state.telegram.status;
  renderOverviewCard('telegram', telegram ? {
    name:telegram.user.displayName,id:`@${telegram.user.username}`,status:telegram.configured===false?'Статус не отслеживается':statusLabel('telegram',telegram.user.status),activity:telegram.configured===false?'Прямая ссылка на Telegram-профиль':telegram.user.bio,
    checkedAt:telegram.checkedAt,badge:telegram.configured===false?'Профиль':statusLabel('telegram',telegram.user.status),tone:telegram.configured===false?'unknown':telegram.user.status,
    avatar:telegram.user.avatar||state.steam.status?.player?.avatar,avatarVersion:telegram.user.avatarVersion||state.steam.status?.checkedAt,profileUrl:telegram.user.profileUrl,error:state.telegram.error,loading:state.telegram.loading,configured:telegram.configured
  } : emptyOverviewModel('telegram'));
}
function emptyOverviewModel(platform) { return { name:'—',id:'—',status:'Получение данных…',activity:`${platformLabel(platform)} ещё не ответил.`,checkedAt:null,badge:'Загрузка',tone:'unknown',avatar:null,avatarVersion:null,profileUrl:null,error:null,loading:true }; }

