const form = document.querySelector('#lookup-form');
const steamIdInput = document.querySelector('#steam-id');
const submitButton = document.querySelector('#submit-button');
const messagePanel = document.querySelector('#message-panel');
const profileCard = document.querySelector('#profile-card');
const profileAvatar = document.querySelector('#profile-avatar');
const profileName = document.querySelector('#profile-name');
const profileLink = document.querySelector('#profile-link');
const statusPill = document.querySelector('#status-pill');
const currentGame = document.querySelector('#current-game');
const lastLogoff = document.querySelector('#last-logoff');
const lastChecked = document.querySelector('#last-checked');

let refreshTimer = null;

function formatStatus(status) {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(value, fallback = 'Unavailable') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
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

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? 'Checking…' : 'Check status';
  steamIdInput.setAttribute('aria-busy', String(isLoading));
}

function renderPlayer(player) {
  profileAvatar.src = player.avatar;
  profileAvatar.alt = `${player.name} profile picture`;
  profileName.textContent = player.name;
  profileLink.href = player.profileUrl;
  statusPill.className = `status-pill ${player.status}`;
  statusPill.textContent = formatStatus(player.status);
  currentGame.textContent = player.gameName || 'Not playing a game';
  lastLogoff.textContent = formatDate(player.lastLogoff);
  lastChecked.textContent = formatDate(player.fetchedAt, 'Just now');
  profileCard.hidden = false;
}

function startAutoRefresh(steamId) {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }

  refreshTimer = window.setInterval(() => {
    lookupProfile(steamId, { silent: true });
  }, 60_000);
}

async function lookupProfile(steamId, { silent = false } = {}) {
  if (!/^\d{17}$/.test(steamId)) {
    showMessage('Enter a valid 17-digit SteamID64.');
    steamIdInput.focus();
    return;
  }

  if (!silent) {
    setLoading(true);
  }
  clearMessage();

  try {
    const response = await fetch(`/api/status?steamId=${encodeURIComponent(steamId)}`, {
      headers: {
        Accept: 'application/json'
      }
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || `Request failed with HTTP ${response.status}.`);
    }

    renderPlayer(payload.player);
    localStorage.setItem('steam-status-tracker:last-id', steamId);
    startAutoRefresh(steamId);
  } catch (error) {
    if (!silent) {
      profileCard.hidden = true;
    }
    showMessage(error.message || 'Unable to check the Steam profile.');
  } finally {
    if (!silent) {
      setLoading(false);
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  lookupProfile(steamIdInput.value.trim());
});

steamIdInput.addEventListener('input', () => {
  steamIdInput.value = steamIdInput.value.replace(/\D/g, '').slice(0, 17);
});

const savedSteamId = localStorage.getItem('steam-status-tracker:last-id');
if (savedSteamId && /^\d{17}$/.test(savedSteamId)) {
  steamIdInput.value = savedSteamId;
}
