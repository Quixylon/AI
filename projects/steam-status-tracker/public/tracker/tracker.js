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

let loading = false;
let resizeTimer = 0;

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

function formatHistoryPoint(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'неизвестно';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date).replace(' г.', '');
}

function formatHistoryRange(entry) {
  const start = new Date(entry.startedAt);
  const end = entry.endedAt ? new Date(entry.endedAt) : null;
  if (Number.isNaN(start.getTime())) return 'Время неизвестно';

  const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const startDate = dateFormatter.format(start).replace(' г.', '');
  const startTime = timeFormatter.format(start);

  if (!end || Number.isNaN(end.getTime())) {
    return `${startDate}, ${startTime} — сейчас`;
  }

  const sameDay = start.getFullYear() === end.getFullYear()
    && start.getMonth() === end.getMonth()
    && start.getDate() === end.getDate();

  if (sameDay) return `${startDate}, ${startTime} — ${timeFormatter.format(end)}`;
  return `${formatHistoryPoint(start)} — ${formatHistoryPoint(end)}`;
}

function showMessage(text) {
  const panel = $('#message-panel');
  if (!panel) return;
  panel.textContent = text;
  panel.hidden = false;
}

function hideMessage() {
  const panel = $('#message-panel');
  if (panel) panel.hidden = true;
}

function createFact(label, value, emphasized = false) {
  const item = document.createElement('div');
  item.className = `session-fact${emphasized ? ' emphasized' : ''}`;

  const term = document.createElement('dt');
  term.textContent = label;

  const description = document.createElement('dd');
  description.textContent = value;

  item.append(term, description);
  return item;
}

function limitScrollableList(list) {
  if (!list) return;

  requestAnimationFrame(() => {
    const items = [...list.children];
    const shouldScroll = items.length > 3;
    list.classList.toggle('is-scrollable', shouldScroll);

    if (!shouldScroll) {
      list.style.maxHeight = '';
      return;
    }

    const styles = getComputedStyle(list);
    const gap = Number.parseFloat(styles.rowGap || styles.gap) || 0;
    const visibleHeight = items
      .slice(0, 3)
      .reduce((total, item) => total + item.getBoundingClientRect().height, 0) + gap * 2 + 2;

    list.style.maxHeight = `${Math.ceil(visibleHeight)}px`;
  });
}

function renderPlayer(data) {
  const player = data.player;
  const avatar = $('#profile-avatar');
  const name = $('#profile-name');
  const link = $('#profile-link');
  const statusPill = $('#status-pill');

  if (avatar) {
    avatar.src = player.avatar;
    avatar.alt = `Аватар ${player.name}`;
  }
  if (name) name.textContent = player.name;
  if (link) link.href = player.profileUrl;
  if (statusPill) {
    statusPill.className = `status-pill ${player.status}`;
    statusPill.textContent = statusNames[player.status] || statusNames.unknown;
  }

  const currentGame = $('#current-game');
  const lastLogoff = $('#last-logoff');
  const lastChecked = $('#last-checked');
  if (currentGame) currentGame.textContent = player.gameName || 'Нет запущенной игры';
  if (lastLogoff) lastLogoff.textContent = formatDate(player.lastLogoff);
  if (lastChecked) lastChecked.textContent = formatDate(data.checkedAt, 'Ещё не проверялось');

  const profileCard = $('#profile-card');
  if (profileCard) profileCard.hidden = false;
}

function renderGames(history) {
  const panel = $('#games-panel');
  const summary = $('#games-summary');
  const list = $('#games-list');
  if (!panel || !summary || !list) return;

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
      const item = document.createElement('article');
      item.className = 'game-summary-card';

      const title = document.createElement('h3');
      title.textContent = game.name;

      const total = document.createElement('p');
      total.className = 'game-total';
      total.textContent = formatDuration(game.duration);

      const count = document.createElement('p');
      count.className = 'game-sessions-count';
      const plural = game.sessions === 1 ? 'запуск' : game.sessions < 5 ? 'запуска' : 'запусков';
      count.textContent = `${game.sessions} ${plural}`;

      item.append(title, total, count);
      summary.append(item);
    });

  sessions.slice(0, 24).forEach((session) => {
    const current = !session.endedAt;
    const item = document.createElement('article');
    item.className = 'game-session';

    const icon = document.createElement('span');
    icon.className = 'game-session-icon';
    icon.textContent = '▶';
    icon.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'game-session-copy';

    const title = document.createElement('h3');
    title.textContent = session.gameName;

    const facts = document.createElement('dl');
    facts.className = 'session-facts';
    facts.append(
      createFact('Начало', formatDate(session.startedAt)),
      createFact('Окончание', session.endedAt ? formatDate(session.endedAt) : 'Игра идёт сейчас'),
      createFact(current ? 'Прошло' : 'Время в игре', formatDuration(session.calculatedDuration), true)
    );

    const badge = document.createElement('span');
    badge.className = `game-badge${current ? ' current' : ''}`;
    badge.textContent = current ? 'Сейчас' : 'Завершено';

    copy.append(title, facts);
    item.append(icon, copy, badge);
    list.append(item);
  });

  panel.hidden = false;
  limitScrollableList(list);
}

function networkStatus(entry) {
  if (entry?.status === 'offline' || entry?.personaState === 'offline') return 'offline';
  if (entry?.gameName || entry?.status === 'in-game') return entry?.personaState || 'online';
  return entry?.status || entry?.personaState || 'unknown';
}

function normalizeNetworkEntries(history) {
  const source = (Array.isArray(history) ? history : [])
    .filter((entry) => entry?.startedAt)
    .map((entry) => ({
      ...entry,
      status: networkStatus(entry),
      gameName: null,
      gameId: null
    }))
    .sort((first, second) => new Date(first.startedAt) - new Date(second.startedAt));

  const merged = [];

  for (const entry of source) {
    const previous = merged.at(-1);
    const previousEnd = previous?.endedAt ? new Date(previous.endedAt).getTime() : Number.POSITIVE_INFINITY;
    const currentStart = new Date(entry.startedAt).getTime();
    const sameStatus = previous && previous.status === entry.status;
    const overlapsOrTouches = sameStatus && currentStart <= previousEnd + 15 * 60 * 1000;

    if (!overlapsOrTouches) {
      merged.push(entry);
      continue;
    }

    if (!previous.endedAt || !entry.endedAt) previous.endedAt = null;
    else if (new Date(entry.endedAt) > new Date(previous.endedAt)) previous.endedAt = entry.endedAt;

    delete previous.durationSeconds;
  }

  return merged.slice(-30).reverse();
}

function renderNetworkHistory(history) {
  const panel = $('#history-panel');
  const list = $('#history-list');
  if (!panel || !list) return;

  list.replaceChildren();
  const entries = normalizeNetworkEntries(history);

  if (!entries.length) {
    panel.hidden = true;
    return;
  }

  entries.forEach((entry) => {
    const current = !entry.endedAt;
    const item = document.createElement('article');
    item.className = `history-entry ${entry.status || 'unknown'}`;

    const markerWrap = document.createElement('span');
    markerWrap.className = 'history-marker-wrap';
    markerWrap.setAttribute('aria-hidden', 'true');

    const marker = document.createElement('span');
    marker.className = 'history-marker';
    markerWrap.append(marker);

    const content = document.createElement('div');
    content.className = 'history-content';

    const top = document.createElement('div');
    top.className = 'history-top';

    const title = document.createElement('h3');
    title.textContent = statusNames[entry.status] || statusNames.unknown;

    const badge = document.createElement('span');
    badge.className = `history-badge${current ? ' current' : ''}`;
    badge.textContent = current ? 'Сейчас' : 'Завершено';

    const period = document.createElement('p');
    period.className = 'history-period';
    period.textContent = formatHistoryRange(entry);

    const duration = document.createElement('div');
    duration.className = 'history-duration-row';

    const durationLabel = document.createElement('span');
    durationLabel.textContent = current
      ? entry.status === 'offline' ? 'Уже не в сети' : 'Уже в сети'
      : 'Длительность';

    const durationValue = document.createElement('strong');
    durationValue.textContent = formatDuration(entryDuration(entry));

    duration.append(durationLabel, durationValue);
    top.append(title, badge);
    content.append(top, period, duration);
    item.append(markerWrap, content);
    list.append(item);
  });

  panel.hidden = false;
  limitScrollableList(list);
}

async function fetchJson(path, fallback = null) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return fallback;
  return response.json();
}

function hideDataPanels() {
  for (const selector of ['#profile-card', '#games-panel', '#history-panel']) {
    const panel = $(selector);
    if (panel) panel.hidden = true;
  }
}

async function load() {
  if (loading || document.hidden) return;
  loading = true;

  try {
    const [status, history] = await Promise.all([
      fetchJson('../data/status.json'),
      fetchJson('../data/history.json', [])
    ]);

    if (!status?.configured || !status?.player) {
      hideDataPanels();
      showMessage(status?.message || 'Мониторинг Steam не настроен.');
      return;
    }

    hideMessage();
    renderPlayer(status);
    renderGames(history);
    renderNetworkHistory(history);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Не удалось загрузить данные мониторинга.');
  } finally {
    loading = false;
  }
}

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    limitScrollableList($('#games-list'));
    limitScrollableList($('#history-list'));
  }, 120);
}, { passive: true });

window.addEventListener('focus', load);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load();
});

load();
window.setInterval(load, 60_000);
