const $ = (selector) => document.querySelector(selector);

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

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Неизвестно';

  const total = Math.floor(seconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const remainingSeconds = total % 60;

  if (days) return `${days} д ${hours} ч ${minutes} мин`;
  if (hours) return `${hours} ч ${minutes} мин`;
  if (minutes) return `${minutes} мин ${remainingSeconds} сек`;
  return `${remainingSeconds} сек`;
}

function entryDuration(entry) {
  if (Number.isFinite(entry?.durationSeconds)) return Math.max(0, entry.durationSeconds);
  if (!entry?.startedAt) return 0;

  const startedAt = new Date(entry.startedAt).getTime();
  const endedAt = entry.endedAt ? new Date(entry.endedAt).getTime() : Date.now();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
  return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}

function showMessage(text) {
  $('#message-panel').textContent = text;
  $('#message-panel').hidden = false;
}

function createMetric(label, value) {
  const card = document.createElement('article');
  card.className = 'detail-card liquid-tile';

  const labelElement = document.createElement('p');
  labelElement.className = 'detail-label';
  labelElement.textContent = label;

  const valueElement = document.createElement('p');
  valueElement.className = 'detail-value';
  valueElement.textContent = value;

  card.append(labelElement, valueElement);
  return card;
}

function renderPlayer(data) {
  const player = data.player;
  $('#profile-avatar').src = player.avatar;
  $('#profile-avatar').alt = `Аватар ${player.name}`;
  $('#profile-name').textContent = player.name;
  $('#profile-link').href = player.profileUrl;
  $('#status-pill').className = `status-pill ${player.status}`;
  $('#status-pill').textContent = statusNames[player.status] || statusNames.unknown;
  $('#current-game').textContent = player.gameName || statusNames[player.status] || 'Не играет';
  $('#last-logoff').textContent = formatDate(player.lastLogoff);
  $('#last-checked').textContent = formatDate(data.checkedAt, 'Ещё не проверялось');
  $('#profile-card').hidden = false;
}

function renderCsrep(data) {
  const metrics = $('#csrep-metrics');
  metrics.replaceChildren();
  $('#csrep-link').href = data?.profileUrl || 'https://csrep.gg/player/76561199524001992';

  if (!data?.available || !data?.stats) {
    metrics.hidden = true;
    $('#csrep-message').textContent = data?.error || 'Автоматическая статистика CSRep сейчас недоступна.';
    $('#csrep-updated').textContent = data?.lastAttemptAt
      ? `Последняя попытка: ${formatDate(data.lastAttemptAt)}`
      : '';
    return;
  }

  const source = data.stats.metrics || {};
  const values = [
    ['Trust Rating', data.stats.trustRating == null ? null : `${data.stats.trustRating}%`],
    ['K/D', source.kd],
    ['ADR', source.adr],
    ['HLTV Rating 2.0', source.hltvRating],
    ['Reaction Time', source.reactionMs == null ? null : `${source.reactionMs} мс`],
    ['Проанализировано игр', data.stats.gamesAnalyzed]
  ];

  for (const [label, value] of values) {
    if (value !== null && value !== undefined && value !== '') {
      metrics.append(createMetric(label, String(value)));
    }
  }

  metrics.hidden = !metrics.childElementCount;
  $('#csrep-message').textContent = 'Показаны последние доступные показатели.';
  $('#csrep-updated').textContent = data.checkedAt ? `Данные: ${formatDate(data.checkedAt)}` : '';
}

function renderGames(history) {
  const panel = $('#games-panel');
  const summary = $('#games-summary');
  const list = $('#games-list');
  summary.replaceChildren();
  list.replaceChildren();

  const sessions = (Array.isArray(history) ? history : [])
    .filter((entry) => entry?.gameName && entry?.startedAt)
    .map((entry) => ({ ...entry, calculatedDuration: entryDuration(entry) }))
    .sort((first, second) => new Date(second.startedAt) - new Date(first.startedAt));

  if (!sessions.length) {
    panel.hidden = true;
    return;
  }

  const grouped = new Map();
  for (const session of sessions) {
    const key = session.gameId || session.gameName;
    const current = grouped.get(key) || {
      name: session.gameName,
      duration: 0,
      sessions: 0,
      latestAt: session.startedAt
    };

    current.duration += session.calculatedDuration;
    current.sessions += 1;
    if (new Date(session.startedAt) > new Date(current.latestAt)) current.latestAt = session.startedAt;
    grouped.set(key, current);
  }

  [...grouped.values()]
    .sort((first, second) => new Date(second.latestAt) - new Date(first.latestAt))
    .slice(0, 6)
    .forEach((game) => {
      const card = document.createElement('article');
      card.className = 'game-summary-card';

      const title = document.createElement('h3');
      title.textContent = game.name;

      const total = document.createElement('p');
      total.className = 'game-total';
      total.textContent = formatDuration(game.duration);

      const count = document.createElement('p');
      count.className = 'game-sessions-count';
      count.textContent = `${game.sessions} ${game.sessions === 1 ? 'запуск' : game.sessions < 5 ? 'запуска' : 'запусков'}`;

      card.append(title, total, count);
      summary.append(card);
    });

  sessions.slice(0, 24).forEach((session) => {
    const current = !session.endedAt;
    const card = document.createElement('article');
    card.className = 'game-session';

    const icon = document.createElement('span');
    icon.className = 'game-session-icon';
    icon.textContent = '▶';
    icon.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'game-session-copy';

    const title = document.createElement('h3');
    title.textContent = session.gameName;

    const timing = document.createElement('p');
    timing.className = 'game-session-time';
    timing.textContent = `${formatDate(session.startedAt)} → ${session.endedAt ? formatDate(session.endedAt) : 'сейчас'}`;

    const duration = document.createElement('p');
    duration.className = 'game-session-duration';
    duration.textContent = `${current ? 'Игра запущена' : 'Время в игре'} · ${formatDuration(session.calculatedDuration)}`;

    const badge = document.createElement('span');
    badge.className = `game-badge${current ? ' current' : ''}`;
    badge.textContent = current ? 'Сейчас' : 'Завершено';

    copy.append(title, timing, duration);
    card.append(icon, copy, badge);
    list.append(card);
  });

  panel.hidden = false;
}

function renderNetworkHistory(history) {
  const panel = $('#history-panel');
  const list = $('#history-list');
  list.replaceChildren();

  const entries = (Array.isArray(history) ? history : [])
    .filter((entry) => entry?.startedAt && !entry.gameName)
    .slice(-30)
    .reverse();

  if (!entries.length) {
    panel.hidden = true;
    return;
  }

  entries.forEach((entry, index) => {
    const current = index === 0 && !entry.endedAt;
    const card = document.createElement('article');
    card.className = `history-entry ${entry.status || 'unknown'}`;

    const marker = document.createElement('span');
    marker.className = 'history-marker';
    marker.setAttribute('aria-hidden', 'true');

    const content = document.createElement('div');
    content.className = 'history-content';

    const top = document.createElement('div');
    top.className = 'history-top';

    const title = document.createElement('h3');
    title.textContent = statusNames[entry.status] || statusNames.unknown;

    const badge = document.createElement('span');
    badge.className = 'history-badge';
    badge.textContent = 'Статус';

    const timing = document.createElement('p');
    timing.className = 'history-timing';
    timing.textContent = `${formatDate(entry.startedAt)} → ${entry.endedAt ? formatDate(entry.endedAt) : 'сейчас'}`;

    const duration = document.createElement('p');
    duration.className = 'history-duration';
    duration.textContent = `${current ? 'Сессия идёт' : 'Длительность'} · ${formatDuration(entryDuration(entry))}`;

    top.append(title, badge);
    content.append(top, timing, duration);
    card.append(marker, content);
    list.append(card);
  });

  panel.hidden = false;
}

async function fetchJson(path, fallback = null) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
  return response.ok ? response.json() : fallback;
}

async function load() {
  $('#message-panel').hidden = true;

  try {
    const [status, history, csrep] = await Promise.all([
      fetchJson('../data/status.json'),
      fetchJson('../data/history.json', []),
      fetchJson('../data/csrep.json')
    ]);

    renderCsrep(csrep);

    if (!status?.configured || !status?.player) {
      $('#profile-card').hidden = true;
      $('#games-panel').hidden = true;
      $('#history-panel').hidden = true;
      showMessage(status?.message || 'Мониторинг Steam не настроен.');
      return;
    }

    renderPlayer(status);
    renderGames(history);
    renderNetworkHistory(history);
  } catch (error) {
    showMessage(error.message || 'Не удалось загрузить данные мониторинга.');
  }
}

load();
window.setInterval(load, 15_000);
