const messagePanel = document.querySelector('#message-panel');
const profileCard = document.querySelector('#profile-card');
const profileAvatar = document.querySelector('#profile-avatar');
const profileName = document.querySelector('#profile-name');
const profileLink = document.querySelector('#profile-link');
const statusPill = document.querySelector('#status-pill');
const currentGame = document.querySelector('#current-game');
const lastLogoff = document.querySelector('#last-logoff');
const lastChecked = document.querySelector('#last-checked');
const historyPanel = document.querySelector('#history-panel');
const historyList = document.querySelector('#history-list');
const csrepLink = document.querySelector('#csrep-link');
const csrepMessage = document.querySelector('#csrep-message');
const csrepMetrics = document.querySelector('#csrep-metrics');
const csrepUpdated = document.querySelector('#csrep-updated');

const statusNames = {
  offline: 'Не в сети',
  online: 'В сети',
  busy: 'Занят',
  away: 'Отошёл',
  snooze: 'Спит',
  'looking-to-trade': 'Ищет обмен',
  'looking-to-play': 'Ищет игру',
  'in-game': 'В игре',
  unknown: 'Неизвестно'
};

function formatDate(value, fallback = 'Нет данных') {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatNumber(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number') return String(value);

  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits
  }).format(value);
}

function formatDuration(startedAt, endedAt, savedDurationSeconds) {
  let totalSeconds = Number(savedDurationSeconds);

  if (!Number.isFinite(totalSeconds)) {
    const start = new Date(startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Неизвестно';
    totalSeconds = Math.max(0, Math.round((end - start) / 1000));
  }

  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 1) return 'меньше минуты';

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  const parts = [];

  if (days > 0) parts.push(`${days} д`);
  if (hours > 0) parts.push(`${hours} ч`);
  if (remainingMinutes > 0 || parts.length === 0) parts.push(`${remainingMinutes} мин`);

  return parts.slice(0, 2).join(' ');
}

function showMessage(message) {
  messagePanel.textContent = message;
  messagePanel.hidden = false;
}

function clearMessage() {
  messagePanel.hidden = true;
  messagePanel.textContent = '';
}

function renderPlayer(data) {
  const player = data.player;

  profileAvatar.src = player.avatar;
  profileAvatar.alt = `Аватар профиля ${player.name}`;
  profileName.textContent = player.name;
  profileLink.href = player.profileUrl;
  statusPill.className = `status-pill ${player.status}`;
  statusPill.textContent = statusNames[player.status] || statusNames.unknown;
  currentGame.textContent = player.gameName || 'Не играет';
  lastLogoff.textContent = formatDate(player.lastLogoff);
  lastChecked.textContent = formatDate(data.checkedAt, 'Ещё не проверялось');
  profileCard.hidden = false;

  const checkedAt = new Date(data.checkedAt).getTime();
  if (Number.isFinite(checkedAt) && Date.now() - checkedAt > 20 * 60 * 1000) {
    showMessage('Данные Steam давно не обновлялись. Проверьте последний запуск workflow в разделе Actions.');
  }
}

function createMetricCard(labelText, valueText) {
  const card = document.createElement('article');
  card.className = 'detail-card';

  const label = document.createElement('p');
  label.className = 'detail-label';
  label.textContent = labelText;

  const value = document.createElement('p');
  value.className = 'detail-value';
  value.textContent = valueText;

  card.append(label, value);
  return card;
}

function createHistoryCard(entry) {
  const card = document.createElement('article');
  card.className = `detail-card history-card ${entry.status || 'unknown'}`;
  if (!entry.endedAt) card.classList.add('active');

  const type = document.createElement('p');
  type.className = 'detail-label';
  type.textContent = entry.gameName
    ? 'ИГРОВАЯ СЕССИЯ'
    : entry.status === 'offline'
      ? 'НЕ В СЕТИ'
      : 'СТАТУС STEAM';

  const value = document.createElement('p');
  value.className = 'detail-value history-value';
  value.textContent = entry.gameName
    ? entry.gameName
    : statusNames[entry.status] || statusNames.unknown;

  const interval = document.createElement('p');
  interval.className = 'history-meta';
  interval.textContent = `${formatDate(entry.startedAt)} → ${entry.endedAt ? formatDate(entry.endedAt) : 'сейчас'}`;

  const duration = document.createElement('p');
  duration.className = 'history-duration';
  duration.textContent = `${entry.endedAt ? 'Длительность' : 'Идёт'}: ${formatDuration(
    entry.startedAt,
    entry.endedAt,
    entry.durationSeconds
  )}`;

  card.append(type, value, interval, duration);
  return card;
}

function renderCsrep(data) {
  csrepLink.href = data?.profileUrl || 'https://csrep.gg/player/76561199524001992';
  csrepMetrics.replaceChildren();

  if (!data?.available || !data?.stats) {
    csrepMetrics.hidden = true;
    csrepMessage.textContent = data?.error
      ? `CSRep пока не отдал статистику автоматически. Профиль можно открыть по кнопке выше. ${data.error}`
      : 'Статистика CSRep ещё не проверялась.';
    csrepUpdated.textContent = data?.lastAttemptAt
      ? `Последняя попытка: ${formatDate(data.lastAttemptAt)}`
      : '';
    return;
  }

  const stats = data.stats;
  const metrics = stats.metrics || {};
  const account = stats.account || {};
  const items = [
    ['Trust Rating', formatNumber(stats.trustRating, 1), '%'],
    ['Обнаруженные аномалии', formatNumber(stats.anomaliesDetected, 1), '%'],
    ['Stats Based Analysis', formatNumber(stats.statsBasedAnalysis, 1), '%'],
    ['Проанализировано игр', formatNumber(stats.gamesAnalyzed, 0), ''],
    ['K/D', formatNumber(metrics.kd), ''],
    ['ADR', formatNumber(metrics.adr), ''],
    ['HLTV Rating 2.0', formatNumber(metrics.hltvRating), ''],
    ['Reaction Time', formatNumber(metrics.reactionMs, 0), ' мс'],
    ['Time to Damage', formatNumber(metrics.timeToDamageMs, 0), ' мс'],
    ['Точность прицеливания', formatNumber(metrics.aimAccuracy, 1), '%'],
    ['Точность в голову', formatNumber(metrics.headAccuracy, 1), '%'],
    ['KAST', formatNumber(metrics.kast, 1), '%'],
    ['Положение прицела', formatNumber(metrics.crosshairPlacementDeg), '°'],
    ['Preaim', formatNumber(metrics.preaimDeg), '°'],
    ['Убийства прострелом', formatNumber(metrics.wallbangKillPercent, 1), '%'],
    ['Убийства через дым', formatNumber(metrics.smokeKillPercent, 1), '%'],
    ['Возраст аккаунта', account.age || null, ''],
    ['Часы в CS2', account.cs2Hours || null, ''],
    ['Уровень Steam', account.steamLevel || null, ''],
    ['Стоимость инвентаря', account.inventoryValue || null, ''],
    ['Коллекционные предметы', account.collectibles || null, '']
  ];

  for (const [label, value, suffix] of items) {
    if (value === null || value === undefined || value === '') continue;
    csrepMetrics.append(createMetricCard(label, `${value}${suffix}`));
  }

  csrepMetrics.hidden = csrepMetrics.childElementCount === 0;
  csrepMessage.textContent = data.fresh
    ? 'Показатели получены непосредственно с публичной страницы CSRep.'
    : 'Показаны последние успешно полученные показатели. Новая проверка CSRep временно не удалась.';

  const checked = data.checkedAt ? `Данные: ${formatDate(data.checkedAt)}` : '';
  const attempted = data.lastAttemptAt && data.lastAttemptAt !== data.checkedAt
    ? ` · последняя попытка: ${formatDate(data.lastAttemptAt)}`
    : '';
  csrepUpdated.textContent = `${checked}${attempted}`;
}

function renderHistory(history) {
  historyList.replaceChildren();

  if (!Array.isArray(history) || history.length === 0) {
    historyPanel.hidden = true;
    return;
  }

  const latestEntries = history.slice(-30).reverse();
  for (const entry of latestEntries) {
    historyList.append(createHistoryCard(entry));
  }

  historyPanel.hidden = false;
}

async function loadData() {
  clearMessage();

  try {
    const cacheBreaker = Date.now();
    const [statusResponse, historyResponse, csrepResponse] = await Promise.all([
      fetch(`./data/status.json?v=${cacheBreaker}`, { cache: 'no-store' }),
      fetch(`./data/history.json?v=${cacheBreaker}`, { cache: 'no-store' }),
      fetch(`./data/csrep.json?v=${cacheBreaker}`, { cache: 'no-store' })
    ]);

    if (!statusResponse.ok) {
      throw new Error(`Не удалось загрузить статус Steam: HTTP ${statusResponse.status}`);
    }

    const data = await statusResponse.json();
    const history = historyResponse.ok ? await historyResponse.json() : [];
    const csrep = csrepResponse.ok ? await csrepResponse.json() : null;

    renderCsrep(csrep);

    if (!data.configured || !data.player) {
      profileCard.hidden = true;
      historyPanel.hidden = true;
      showMessage(data.message || 'Мониторинг Steam ещё не настроен в GitHub Actions.');
      return;
    }

    renderPlayer(data);
    renderHistory(history);
  } catch (error) {
    profileCard.hidden = true;
    historyPanel.hidden = true;
    showMessage(error.message || 'Не удалось загрузить данные мониторинга.');
  }
}

loadData();
window.setInterval(loadData, 60_000);