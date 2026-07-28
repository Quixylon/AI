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
    showMessage('Данные давно не обновлялись. Проверьте последний запуск workflow в разделе Actions.');
  }
}

function renderHistory(history) {
  historyList.replaceChildren();

  if (!Array.isArray(history) || history.length === 0) {
    historyPanel.hidden = true;
    return;
  }

  const latestEntries = history.slice(-12).reverse();

  for (const entry of latestEntries) {
    const card = document.createElement('article');
    card.className = 'detail-card';

    const label = document.createElement('p');
    label.className = 'detail-label';
    label.textContent = formatDate(entry.startedAt);

    const value = document.createElement('p');
    value.className = 'detail-value';
    const status = statusNames[entry.status] || statusNames.unknown;
    value.textContent = entry.gameName ? `${status}: ${entry.gameName}` : status;

    card.append(label, value);
    historyList.append(card);
  }

  historyPanel.hidden = false;
}

async function loadData() {
  clearMessage();

  try {
    const cacheBreaker = Date.now();
    const [statusResponse, historyResponse] = await Promise.all([
      fetch(`./data/status.json?v=${cacheBreaker}`, { cache: 'no-store' }),
      fetch(`./data/history.json?v=${cacheBreaker}`, { cache: 'no-store' })
    ]);

    if (!statusResponse.ok) {
      throw new Error(`Не удалось загрузить статус: HTTP ${statusResponse.status}`);
    }

    const data = await statusResponse.json();
    const history = historyResponse.ok ? await historyResponse.json() : [];

    if (!data.configured || !data.player) {
      profileCard.hidden = true;
      historyPanel.hidden = true;
      showMessage(data.message || 'Мониторинг ещё не настроен в GitHub Actions.');
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
