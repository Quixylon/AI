/* =========================================================
   13. Рендер Steam
   ========================================================= */
function renderSteam(previous=null) {
  const data=state.steam.status; if (!data) { renderOverview(); return; }
  const p=data.player; const main=p.gameName?`В игре: ${p.gameName}`:statusLabel('steam',p.status);
  text('steamDetailName',p.name); text('steamDetailSteamId',p.steamId); text('steamIdValue',p.steamId); text('steamDetailMainStatus',main);
  text('steamDetailSubStatus',`PersonaState: ${statusLabel('steam',p.personaState)}`); text('steamPersonaState',statusLabel('steam',p.personaState));
  text('steamGameName',p.gameName||'Игра не запущена'); text('steamAppId',p.gameId||'—'); text('steamStatusSince',formatDateTime(p.statusStartedAt));
  text('steamLastLogoff',formatDateTime(p.lastLogoff)); text('steamDetailUpdated',formatDateTime(data.checkedAt));
  setLiveDuration(byId('steamSessionDuration'),p.gameStartedAt||p.statusStartedAt,null,'—');
  setTone(byId('steamDetailStatusOrb'),p.status); setLink('steamProfileButton',p.profileUrl); setLink('steamCsrepButton',profileLink(state.profile.data,'csrep')?.url);
  avatarManager.update('steam-detail','steamDetailAvatar','steamDetailAvatarPlaceholder',p.avatar,p.avatarVersion,'Steam-аватар');
  text('steamJson',JSON.stringify(data,null,2)); renderOverview(); renderProfile(); updateStaleStates(); renderSteamStats();
  notifySteamChanges(previous,data);
}
function notifySteamChanges(previous,current) {
  if (!state.initialized || !previous) return;
  const before=previous.player, after=current.player;
  if (before.gameName!==after.gameName) showToast(after.gameName?`Steam: запущена ${after.gameName}`:'Steam: игра закрыта','info');
  const beforeOnline=before.status!=='offline', afterOnline=after.status!=='offline';
  if (beforeOnline!==afterOnline) showToast(`Steam: ${afterOnline?'теперь в сети':'перешёл в офлайн'}`,'info');
}

/* =========================================================
   14. Рендер Discord
   ========================================================= */
function renderDiscord(previous=null) {
  const data=state.discord.status; if (!data) { renderOverview(); return; }
  const u=data.user,a=data.activity; const tracked=data.configured!==false; const hasActivity=tracked&&a.type!=='none'&&Boolean(a.name);
  text('discordDetailName',u.displayName); text('discordDetailUsername',`@${u.username}`); text('discordDetailMainStatus',tracked?statusLabel('discord',u.status):'Статус не отслеживается');
  text('discordCustomStatus',tracked?(u.customStatus||'Пользовательский статус не указан'):'Доступна только прямая ссылка на профиль'); text('discordIdValue',u.id); text('discordUsernameValue',u.username); text('discordStatusValue',tracked?statusLabel('discord',u.status):'Не отслеживается');
  text('discordActivityType',DISCORD_ACTIVITY[a.type]||DISCORD_ACTIVITY.none); text('discordActivityName',a.name||'Нет текущей активности');
  text('discordActivityDetails',[a.details,a.state].filter(Boolean).join(' · ')||'Нет текущей активности'); text('discordActivityStartedAt',formatDateTime(a.startedAt));
  text('discordDetailUpdated',tracked?formatDateTime(data.checkedAt):'Не используется'); text('discordSideStatus',tracked?statusLabel('discord',u.status):'Не отслеживается'); text('discordSideActivity',tracked?(a.name||'Нет активности'):'Открыть профиль');
  text('discordActivityTypeValue',DISCORD_ACTIVITY[a.type]||DISCORD_ACTIVITY.none); text('discordActivityNameValue',a.name||'—'); text('discordActivityDetailsValue',a.details||'—'); text('discordActivityStateValue',a.state||'—');
  setLiveDuration(byId('discordActivityElapsed'),a.startedAt,null,''); setLiveDuration(byId('discordSideElapsed'),a.startedAt,null,'—'); setLiveDuration(byId('discordActivityDurationValue'),a.startedAt,null,'—');
  const card=byId('discordActivityCard'),empty=byId('discordEmptyState'); if (card) card.hidden=!hasActivity; if (empty) empty.hidden=hasActivity;
  setTone(byId('discordDetailStatusOrb'),tracked?u.status:'unknown'); setLink('discordProfileButton',u.profileUrl);
  avatarManager.update('discord-detail','discordDetailAvatar','discordDetailAvatarPlaceholder',u.avatar,u.avatarVersion,'Discord-аватар');
  avatarManager.updateOptional('discord-activity','discordActivityImage',a.largeImageUrl,data.checkedAt,'Изображение активности Discord');
  text('discordJson',JSON.stringify(data,null,2)); renderOverview(); updateDiscordLinkIndicator(); renderDiscordStats(); updateStaleStates(); notifyDiscordChanges(previous,data);
}
function notifyDiscordChanges(previous,current) {
  if (!state.initialized || !previous) return;
  if (previous.user.status!==current.user.status) showToast(`Discord: ${statusLabel('discord',current.user.status)}`,'info');
  const before=`${previous.activity.type}|${previous.activity.name||''}`,after=`${current.activity.type}|${current.activity.name||''}`;
  if (before!==after) showToast(`Discord: ${current.activity.name||'активность завершена'}`,'info');
}

/* =========================================================
   15. Рендер Telegram
   ========================================================= */
function renderTelegram(previous=null) {
  const data=state.telegram.status; if (!data) { renderOverview(); return; }
  const u=data.user; const tracked=data.configured!==false; const approximate=tracked&&approximateTelegramStatuses.has(u.status);
  text('telegramDetailName',u.displayName); text('telegramDetailUsername',`@${u.username}`); text('telegramDetailMainStatus',tracked?statusLabel('telegram',u.status):'Статус не отслеживается');
  text('telegramLastSeenText',u.lastSeenAt&&!approximate?formatRelativeTime(u.lastSeenAt):approximate?'Точное время недоступно':'Нет данных');
  text('telegramIdValue',u.id); text('telegramUsernameValue',u.username); text('telegramStatusValue',tracked?statusLabel('telegram',u.status):'Не отслеживается');
  text('telegramLastActivity',u.lastSeenAt&&!approximate?`${formatDateTime(u.lastSeenAt)} · ${formatRelativeTime(u.lastSeenAt)}`:approximate?'Точное время недоступно':'Нет данных');
  text('telegramBio',u.bio); text('telegramDetailUpdated',tracked?formatDateTime(data.checkedAt):'Не используется'); setTone(byId('telegramDetailStatusOrb'),tracked?u.status:'unknown'); setLink('telegramProfileButton',u.profileUrl);
  avatarManager.update('telegram-detail','telegramDetailAvatar','telegramDetailAvatarPlaceholder',u.avatar,u.avatarVersion,'Telegram-аватар');
  text('telegramJson',JSON.stringify(data,null,2)); renderOverview(); renderTelegramStats(); updateStaleStates(); notifyTelegramChanges(previous,data);
}
function notifyTelegramChanges(previous,current) {
  if (!state.initialized || !previous) return;
  const before=previous.user.status==='online',after=current.user.status==='online';
  if (before!==after) showToast(`Telegram: ${after?'теперь в сети':'вышел из сети'}`,'info');
}

