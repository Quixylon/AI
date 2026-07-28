const entryScreen = document.querySelector('#entry-screen');
const enterButton = document.querySelector('#enter-button');
const backgroundArt = document.querySelector('#background-art');
const bioCover = document.querySelector('#bio-cover');
const bioName = document.querySelector('#bio-name');
const bioHandle = document.querySelector('#bio-handle');
const bioDescription = document.querySelector('#bio-description');
const bioLinks = document.querySelector('#bio-links');
const profileAvatar = document.querySelector('#profile-avatar');
const profileSteamName = document.querySelector('#profile-steam-name');
const statusPill = document.querySelector('#status-pill');
const currentGame = document.querySelector('#current-game');
const lastLogoff = document.querySelector('#last-logoff');
const lastChecked = document.querySelector('#last-checked');
const messagePanel = document.querySelector('#message-panel');
const historyPanel = document.querySelector('#history-panel');
const historyList = document.querySelector('#history-list');
const csrepLink = document.querySelector('#csrep-link');
const csrepMessage = document.querySelector('#csrep-message');
const csrepMetrics = document.querySelector('#csrep-metrics');
const csrepUpdated = document.querySelector('#csrep-updated');
const musicCover = document.querySelector('#music-cover');
const musicTitle = document.querySelector('#music-title');
const musicArtist = document.querySelector('#music-artist');
const musicToggle = document.querySelector('#music-toggle');
const musicProgress = document.querySelector('#music-progress');
const musicTime = document.querySelector('#music-time');
const musicAudio = document.querySelector('#music-audio');

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

let typewriterTimer = null;
let descriptionsKey = '';
let linksKey = '';
let musicKey = '';
let latestBioConfig = null;

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

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = String(whole % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Неизвестно';
  const rounded = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes > 0) return `${minutes} мин ${secs} сек`;
  return `${secs} сек`;
}

function showMessage(message) {
  messagePanel.textContent = message;
  messagePanel.hidden = false;
}

function clearMessage() {
  messagePanel.hidden = true;
  messagePanel.textContent = '';
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

function startTypewriter(descriptions) {
  const lines = Array.isArray(descriptions) && descriptions.length > 0
    ? descriptions.map(String).filter(Boolean)
    : ['Steam & CS2 activity tracker'];
  const key = JSON.stringify(lines);
  if (key === descriptionsKey) return;

  descriptionsKey = key;
  if (typewriterTimer) window.clearTimeout(typewriterTimer);

  let lineIndex = 0;
  let characterIndex = 0;
  let deleting = false;

  const tick = () => {
    const line = lines[lineIndex];
    bioDescription.textContent = line.slice(0, characterIndex);

    if (!deleting && characterIndex < line.length) {
      characterIndex += 1;
      typewriterTimer = window.setTimeout(tick, 48);
      return;
    }

    if (!deleting) {
      deleting = true;
      typewriterTimer = window.setTimeout(tick, 1700);
      return;
    }

    if (characterIndex > 0) {
      characterIndex -= 1;
      typewriterTimer = window.setTimeout(tick, 24);
      return;
    }

    deleting = false;
    lineIndex = (lineIndex + 1) % lines.length;
    typewriterTimer = window.setTimeout(tick, 280);
  };

  tick();
}

function renderLinks(links) {
  const safeLinks = Array.isArray(links) ? links.filter((item) => item?.url && item?.label) : [];
  const key = JSON.stringify(safeLinks);
  if (key === linksKey) return;
  linksKey = key;
  bioLinks.replaceChildren();

  for (const link of safeLinks) {
    const anchor = document.createElement('a');
    anchor.className = 'bio-link';
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';

    const icon = document.createElement('span');
    icon.className = 'bio-link-icon';
    icon.textContent = String(link.icon || link.label).slice(0, 2).toUpperCase();

    const label = document.createElement('span');
    label.textContent = link.label;

    const arrow = document.createElement('span');
    arrow.className = 'bio-link-arrow';
    arrow.textContent = '↗';

    anchor.append(icon, label, arrow);
    bioLinks.append(anchor);
  }
}

function setMusicButtonState() {
  musicToggle.textContent = musicAudio.paused ? '▶' : '❚❚';
  musicToggle.setAttribute('aria-label', musicAudio.paused ? 'Воспроизвести' : 'Пауза');
}

function configureMusic(music = {}) {
  const key = JSON.stringify(music || {});
  if (key === musicKey) return;
  musicKey = key;

  const audioUrl = typeof music.audioUrl === 'string' ? music.audioUrl.trim() : '';
  musicTitle.textContent = music.title || 'Трек не выбран';
  musicArtist.textContent = music.artist || 'Музыка будет здесь';

  if (music.coverUrl) {
    musicCover.style.backgroundImage = `linear-gradient(135deg, rgba(8, 9, 13, 0.08), rgba(8, 9, 13, 0.72)), url("${music.coverUrl}")`;
    musicCover.classList.add('has-image');
  } else {
    musicCover.style.backgroundImage = '';
    musicCover.classList.remove('has-image');
  }

  musicAudio.pause();
  musicAudio.removeAttribute('src');
  musicAudio.load();
  musicProgress.value = '0';
  musicTime.textContent = '0:00 / 0:00';

  const enabled = Boolean(audioUrl);
  musicToggle.disabled = !enabled;
  musicProgress.disabled = !enabled;

  if (enabled) {
    musicAudio.src = audioUrl;
    musicAudio.load();
  }

  setMusicButtonState();
}

function renderBio(config, player) {
  latestBioConfig = config || {};
  bioName.textContent = config?.displayName || 'Quixylon';
  bioHandle.textContent = config?.handle || '@quixylon';
  startTypewriter(config?.descriptions);
  renderLinks(config?.links);
  configureMusic(config?.music);

  if (!player) return;
  profileAvatar.src = player.avatar;
  profileAvatar.alt = `Аватар Steam-профиля ${player.name}`;
  profileSteamName.textContent = player.name;

  const layeredBackground = `linear-gradient(180deg, rgba(8, 9, 13, 0.08), rgba(8, 9, 13, 0.75)), url("${player.avatar}")`;
  backgroundArt.style.backgroundImage = layeredBackground;
  bioCover.style.backgroundImage = layeredBackground;
}

function renderPlayer(data) {
  const player = data.player;
  const statusText = statusNames[player.status] || statusNames.unknown;

  statusPill.className = `status-pill ${player.status}`;
  statusPill.textContent = player.gameName ? `В игре · ${player.gameName}` : statusText;
  currentGame.textContent = player.gameName || statusText;
  lastLogoff.textContent = formatDate(player.lastLogoff);
  lastChecked.textContent = formatDate(data.checkedAt, 'Ещё не проверялось');

  const checkedAt = new Date(data.checkedAt).getTime();
  if (Number.isFinite(checkedAt) && Date.now() - checkedAt > 20 * 60 * 1000) {
    showMessage('Данные Steam давно не обновлялись. Проверьте последний запуск workflow в разделе Actions.');
  }
}

function renderCsrep(data) {
  csrepLink.href = data?.profileUrl || 'https://csrep.gg/player/76561199524001992';
  csrepMetrics.replaceChildren();

  if (!data?.available || !data?.stats) {
    csrepMetrics.hidden = true;
    csrepMessage.textContent = data?.error
      ? data.error
      : 'Автоматическая статистика CSRep сейчас недоступна. Профиль открывается кнопкой выше.';
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
    ['Возраст аккаунта', account.age || null, ''],
    ['Часы в CS2', account.cs2Hours || null, ''],
    ['Уровень Steam', account.steamLevel || null, '']
  ];

  for (const [label, value, suffix] of items) {
    if (value === null || value === undefined || value === '') continue;
    csrepMetrics.append(createMetricCard(label, `${value}${suffix}`));
  }

  csrepMetrics.hidden = csrepMetrics.childElementCount === 0;
  csrepMessage.textContent = data.fresh
    ? 'Показатели получены с публичной страницы CSRep.'
    : 'Показаны последние успешно полученные показатели.';
  csrepUpdated.textContent = data.checkedAt ? `Данные: ${formatDate(data.checkedAt)}` : '';
}

function createHistoryEntry(entry, isCurrent) {
  const card = document.createElement('article');
  card.className = `history-entry ${entry.status || 'unknown'}`;

  const marker = document.createElement('span');
  marker.className = 'history-marker';

  const content = document.createElement('div');
  content.className = 'history-content';

  const top = document.createElement('div');
  top.className = 'history-top';

  const title = document.createElement('h3');
  const status = statusNames[entry.status] || statusNames.unknown;
  title.textContent = entry.gameName ? entry.gameName : status;

  const badge = document.createElement('span');
  badge.className = 'history-badge';
  badge.textContent = entry.gameName ? 'Игра' : status;
  top.append(title, badge);

  const timing = document.createElement('p');
  timing.className = 'history-timing';
  const endLabel = entry.endedAt ? formatDate(entry.endedAt) : 'сейчас';
  timing.textContent = `${formatDate(entry.startedAt)} → ${endLabel}`;

  const duration = document.createElement('p');
  duration.className = 'history-duration';
  const computedSeconds = entry.durationSeconds ?? (
    isCurrent ? Math.max(0, (Date.now() - new Date(entry.startedAt).getTime()) / 1000) : null
  );
  duration.textContent = isCurrent
    ? `Сессия идёт · ${formatDuration(computedSeconds)}`
    : `Длительность · ${formatDuration(computedSeconds)}`;

  content.append(top, timing, duration);
  card.append(marker, content);
  return card;
}

function renderHistory(history) {
  historyList.replaceChildren();

  if (!Array.isArray(history) || history.length === 0) {
    historyPanel.hidden = true;
    return;
  }

  const latestEntries = history.slice(-24).reverse();
  latestEntries.forEach((entry, index) => {
    const isCurrent = index === 0 && !entry.endedAt;
    historyList.append(createHistoryEntry(entry, isCurrent));
  });

  historyPanel.hidden = false;
}

async function fetchJson(path, fallback = null) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return fallback;
  return response.json();
}

async function loadData() {
  clearMessage();

  try {
    const [statusData, history, csrep, bio] = await Promise.all([
      fetchJson('./data/status.json'),
      fetchJson('./data/history.json', []),
      fetchJson('./data/csrep.json'),
      fetchJson('./data/bio.json', {})
    ]);

    renderBio(bio || {}, statusData?.player || null);
    renderCsrep(csrep);

    if (!statusData?.configured || !statusData?.player) {
      statusPill.className = 'status-pill unknown';
      statusPill.textContent = 'Нет данных';
      currentGame.textContent = 'Мониторинг не настроен';
      historyPanel.hidden = true;
      showMessage(statusData?.message || 'Мониторинг Steam ещё не настроен в GitHub Actions.');
      return;
    }

    renderPlayer(statusData);
    renderHistory(history);
  } catch (error) {
    statusPill.className = 'status-pill unknown';
    statusPill.textContent = 'Ошибка';
    showMessage(error.message || 'Не удалось загрузить данные мониторинга.');
  }
}

enterButton.addEventListener('click', async () => {
  entryScreen.classList.add('is-hidden');
  document.body.classList.add('profile-entered');

  if (latestBioConfig?.music?.autoplay && musicAudio.src) {
    try {
      await musicAudio.play();
    } catch {
      // Воспроизведение останется доступно по кнопке плеера.
    }
  }
});

musicToggle.addEventListener('click', async () => {
  if (!musicAudio.src) return;

  if (musicAudio.paused) {
    try {
      await musicAudio.play();
    } catch {
      return;
    }
  } else {
    musicAudio.pause();
  }
  setMusicButtonState();
});

musicAudio.addEventListener('play', setMusicButtonState);
musicAudio.addEventListener('pause', setMusicButtonState);
musicAudio.addEventListener('loadedmetadata', () => {
  musicTime.textContent = `0:00 / ${formatClock(musicAudio.duration)}`;
});
musicAudio.addEventListener('timeupdate', () => {
  const duration = musicAudio.duration;
  const current = musicAudio.currentTime;
  musicProgress.value = Number.isFinite(duration) && duration > 0
    ? String((current / duration) * 100)
    : '0';
  musicTime.textContent = `${formatClock(current)} / ${formatClock(duration)}`;
});
musicAudio.addEventListener('ended', setMusicButtonState);
musicProgress.addEventListener('input', () => {
  if (!Number.isFinite(musicAudio.duration) || musicAudio.duration <= 0) return;
  musicAudio.currentTime = (Number(musicProgress.value) / 100) * musicAudio.duration;
});

loadData();
window.setInterval(loadData, 15_000);
