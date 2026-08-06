'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');

function safeState() {
  try {
    return typeof state !== 'undefined' ? state : null;
  } catch {
    return null;
  }
}

function disableOldBackgroundPhysics() {
  try {
    if (typeof interactionHub !== 'undefined') interactionHub.destroy();
  } catch {}
  try {
    if (typeof canvasController !== 'undefined') {
      canvasController.stop();
      canvasController.destroy();
      canvasController.start = () => {};
      canvasController.resume = () => {};
      canvasController.setPointer = () => {};
      canvasController.setDown = () => {};
    }
  } catch {}
  try {
    if (typeof motionController !== 'undefined') motionController.reset();
  } catch {}
}

class InfiniteLegacyBackground {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.points = [];
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.raf = 0;
    this.lastTime = 0;
    this.pointer = {
      x: innerWidth / 2,
      y: innerHeight / 2,
      tx: innerWidth / 2,
      ty: innerHeight / 2,
      active: false,
      down: false
    };
  }

  init() {
    document.getElementById('legacy-calm-background')?.remove();

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'legacy-calm-background';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!this.ctx) return;

    const original = document.getElementById('particleCanvas');
    (original?.parentNode || document.body).insertBefore(this.canvas, original || document.body.firstChild);
    this.resize();

    addEventListener('resize', () => this.resize(), { passive: true });
    addEventListener('pointermove', (event) => {
      this.pointer.tx = event.clientX;
      this.pointer.ty = event.clientY;
      this.pointer.active = true;
    }, { passive: true });
    addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      this.pointer.tx = event.clientX;
      this.pointer.ty = event.clientY;
      this.pointer.active = true;
      this.pointer.down = true;
    }, { passive: true });
    addEventListener('pointerup', () => { this.pointer.down = false; }, { passive: true });
    addEventListener('pointercancel', () => { this.pointer.down = false; }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
      this.pointer.active = false;
      this.pointer.down = false;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => document.hidden ? this.stop() : this.start());
    reduceMotion.addEventListener?.('change', () => {
      this.stop();
      this.resize();
      this.start();
    });

    this.start();
  }

  makePoint(index, count) {
    const depth = 0.35 + Math.random() * 0.65;
    const lane = (index + Math.random() * 0.8) / Math.max(count, 1);
    return {
      x: Math.random() * this.width,
      y: lane * (this.height + 120) - 60,
      depth,
      size: 0.75 + depth * 1.45,
      alpha: 0.24 + depth * 0.48,
      phase: Math.random() * Math.PI * 2,
      drift: 1.4 + Math.random() * 2.8,
      speed: 7 + depth * 12 + Math.random() * 5
    };
  }

  resize() {
    if (!this.ctx || !this.canvas) return;
    this.width = Math.max(1, innerWidth);
    this.height = Math.max(1, innerHeight);
    this.dpr = Math.min(devicePixelRatio || 1, coarsePointer.matches ? 1.25 : 1.75);

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const estimate = Math.round((this.width * this.height) / (coarsePointer.matches ? 17000 : 12500));
    const count = coarsePointer.matches
      ? Math.min(54, Math.max(32, estimate))
      : Math.min(96, Math.max(58, estimate));

    this.points = Array.from({ length: count }, (_, index) => this.makePoint(index, count));
    this.lastTime = performance.now();
    this.draw(this.lastTime, 0);
  }

  update(deltaSeconds, time) {
    if (reduceMotion.matches) return;

    for (const point of this.points) {
      point.y -= point.speed * deltaSeconds;
      point.phase += deltaSeconds * (0.08 + point.depth * 0.05);

      if (point.y < -48) {
        point.y = this.height + 48 + Math.random() * 70;
        point.x = Math.random() * this.width;
        point.phase = Math.random() * Math.PI * 2;
      }

      point.x += Math.sin(time * 0.00016 + point.phase) * point.drift * deltaSeconds;
      if (point.x < -28) point.x = this.width + 28;
      if (point.x > this.width + 28) point.x = -28;
    }
  }

  getPosition(point, time) {
    let x = point.x + Math.cos(time * 0.00022 + point.phase) * (0.8 + point.depth * 1.4);
    let y = point.y + Math.sin(time * 0.00018 + point.phase) * (0.55 + point.depth);

    if (this.pointer.active && this.pointer.down && !reduceMotion.matches) {
      const dx = this.pointer.x - x;
      const dy = this.pointer.y - y;
      const distance = Math.hypot(dx, dy) || 1;
      const radius = coarsePointer.matches ? 170 : 235;
      if (distance < radius) {
        const pull = (1 - distance / radius) * (0.055 + point.depth * 0.045);
        x += dx * pull;
        y += dy * pull;
      }
    }

    return { x, y };
  }

  drawPointerConnections(positions) {
    if (!this.pointer.active) return;

    const radius = coarsePointer.matches ? 180 : 275;
    const limit = this.pointer.down ? 15 : 10;
    const nearest = positions
      .map((position, index) => ({
        position,
        index,
        distance: Math.hypot(position.x - this.pointer.x, position.y - this.pointer.y)
      }))
      .filter((item) => item.distance < radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    for (const item of nearest) {
      const strength = 1 - item.distance / radius;
      const gradient = this.ctx.createLinearGradient(
        this.pointer.x,
        this.pointer.y,
        item.position.x,
        item.position.y
      );
      gradient.addColorStop(0, `rgba(220,218,255,${(this.pointer.down ? 0.34 : 0.22) * strength})`);
      gradient.addColorStop(1, 'rgba(148,139,255,0.025)');
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = this.pointer.down ? 0.95 : 0.7;
      this.ctx.beginPath();
      this.ctx.moveTo(this.pointer.x, this.pointer.y);
      this.ctx.lineTo(item.position.x, item.position.y);
      this.ctx.stroke();
    }

    const glow = this.ctx.createRadialGradient(
      this.pointer.x,
      this.pointer.y,
      0,
      this.pointer.x,
      this.pointer.y,
      this.pointer.down ? 125 : 95
    );
    glow.addColorStop(0, this.pointer.down ? 'rgba(176,164,255,0.14)' : 'rgba(176,164,255,0.085)');
    glow.addColorStop(1, 'rgba(176,164,255,0)');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(this.pointer.x, this.pointer.y, this.pointer.down ? 125 : 95, 0, Math.PI * 2);
    this.ctx.fill();
  }

  draw(time, deltaSeconds) {
    if (!this.ctx) return;

    this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.1;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.1;
    this.update(deltaSeconds, time);

    this.ctx.clearRect(0, 0, this.width, this.height);
    const positions = this.points.map((point) => this.getPosition(point, time));
    const threshold = Math.min(148, Math.max(108, Math.min(this.width, this.height) * 0.145));

    this.ctx.lineWidth = 0.62;
    for (let first = 0; first < positions.length; first += 1) {
      for (let second = first + 1; second < positions.length; second += 1) {
        const distance = Math.hypot(
          positions[first].x - positions[second].x,
          positions[first].y - positions[second].y
        );
        if (distance >= threshold) continue;

        const depth = Math.min(this.points[first].depth, this.points[second].depth);
        const alpha = (1 - distance / threshold) * 0.18 * depth;
        const rgb = (first + second) % 4 === 0 ? '103,207,255' : '166,157,255';
        this.ctx.strokeStyle = `rgba(${rgb},${alpha})`;
        this.ctx.beginPath();
        this.ctx.moveTo(positions[first].x, positions[first].y);
        this.ctx.lineTo(positions[second].x, positions[second].y);
        this.ctx.stroke();
      }
    }

    this.drawPointerConnections(positions);

    positions.forEach((position, index) => {
      const point = this.points[index];
      const pulse = reduceMotion.matches
        ? 1
        : 1 + Math.sin(time * 0.00125 + point.phase) * 0.055;
      const rgb = index % 5 === 0 ? '118,211,255' : '225,229,255';
      this.ctx.fillStyle = `rgba(${rgb},${point.alpha})`;
      this.ctx.shadowColor = `rgba(157,147,255,${point.alpha * 0.42})`;
      this.ctx.shadowBlur = 3 + point.depth * 4;
      this.ctx.beginPath();
      this.ctx.arc(position.x, position.y, point.size * pulse, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.shadowBlur = 0;
  }

  loop(time) {
    this.raf = 0;
    const deltaSeconds = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    this.draw(time, deltaSeconds);
    if (!document.hidden && !reduceMotion.matches) {
      this.raf = requestAnimationFrame((next) => this.loop(next));
    }
  }

  start() {
    if (!this.ctx || document.hidden || this.raf) return;
    this.lastTime = performance.now();
    if (reduceMotion.matches) this.draw(this.lastTime, 0);
    else this.raf = requestAnimationFrame((time) => this.loop(time));
  }

  stop() {
    if (!this.raf) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

disableOldBackgroundPhysics();
const infiniteBackground = new InfiniteLegacyBackground();
infiniteBackground.init();

let avatarRequest;
function requestAvatar() {
  if (avatarRequest) return avatarRequest;
  const read = (path) => fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .catch(() => null);

  avatarRequest = Promise.all([read('./data/status.json'), read('./data/bio.json')])
    .then(([status, bio]) => status?.player?.avatar || bio?.avatarUrl || null);
  return avatarRequest;
}

function exposeAvatar() {
  const image = document.getElementById('profileAvatar');
  const placeholder = document.getElementById('profileAvatarPlaceholder');
  if (!image) return;

  const show = () => {
    image.hidden = false;
    image.removeAttribute('hidden');
    image.style.display = 'block';
    image.style.visibility = 'visible';
    image.style.opacity = '1';
    if (placeholder) placeholder.hidden = true;
  };

  if (image.complete && image.naturalWidth > 0) show();
  else image.addEventListener('load', show, { once: true });

  requestAvatar().then((url) => {
    if (!url) return;
    if (image.src !== url) image.src = url;
    if (image.complete && image.naturalWidth > 0) show();
    else image.addEventListener('load', show, { once: true });
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element && element.textContent !== value) element.textContent = value;
  return element;
}

function setState(element, value) {
  if (element && element.dataset.state !== value) element.dataset.state = value;
}

function removeManualSynchronization() {
  [
    'refreshAllButton',
    'retrySteamButton',
    'retryDiscordButton',
    'retryTelegramButton'
  ].forEach((id) => document.getElementById(id)?.remove());

  document.querySelectorAll('.retry-button').forEach((button) => button.remove());
  document.querySelector('.tracker-statusbar')?.remove();
}

function cleanLabels() {
  const trackerButton = document.querySelector('.profile-tracker-cta span:first-child');
  if (trackerButton && trackerButton.textContent !== 'Трекер') trackerButton.textContent = 'Трекер';

  setText('trackerTitle', 'Трекер');
  setText('trackerEyebrow', 'QUIXYLON');

  if (document.body.dataset.route === 'tracker' || location.hash.startsWith('#tracker')) {
    document.title = 'Qu’lon — трекер';
  }

  const labels = document.querySelectorAll('#steamView .data-item__label');
  for (const label of labels) {
    const replacements = {
      SteamID64: 'Steam ID',
      personaState: 'Состояние профиля',
      'App ID': 'ID игры',
      'Последнее обновление': 'Синхронизация'
    };
    const next = replacements[label.textContent.trim()];
    if (next) label.textContent = next;
  }

  document.querySelectorAll('.tech-details, .global-tech-details').forEach((details) => details.remove());

  const steamOverviewActivity = document.getElementById('steamOverviewActivity');
  const appState = safeState();
  if (steamOverviewActivity && appState?.steam?.status?.player && !appState.steam.status.player.gameName) {
    steamOverviewActivity.hidden = true;
  }
}

let fallbackSyncTimestamp = null;
let syncFetchPromise = null;

function loadSyncTimestamp() {
  if (syncFetchPromise) return syncFetchPromise;
  syncFetchPromise = fetch(`./data/status.json?v=${Date.now()}`, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      fallbackSyncTimestamp = data?.checkedAt || null;
      return fallbackSyncTimestamp;
    })
    .catch(() => null)
    .finally(() => {
      window.setTimeout(() => { syncFetchPromise = null; }, 30_000);
    });
  return syncFetchPromise;
}

function formatSyncTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date).replace(' г.', '');
}

function updateLastSynchronization() {
  const appState = safeState();
  const timestamp = appState?.steam?.status?.checkedAt || fallbackSyncTimestamp;
  const formatted = formatSyncTimestamp(timestamp);
  const element = document.getElementById('trackerLastUpdate');
  if (element) {
    const value = formatted ? `Синхронизация: ${formatted}` : 'Синхронизация: ожидается';
    if (element.textContent !== value) element.textContent = value;
  }

  if (!timestamp) loadSyncTimestamp().then(() => updateLastSynchronization());
}

function markProgress(prefix) {
  const title = prefix === 'discord' ? 'Discord' : 'Telegram';
  const badge = document.getElementById(`${prefix}OverviewBadge`);
  if (badge) {
    if (badge.textContent !== 'В процессе') badge.textContent = 'В процессе';
    setState(badge, 'progress');
  }

  setText(`${prefix}OverviewStatus`, 'В процессе');
  setText(`${prefix}OverviewActivity`, 'Интеграция разрабатывается');
  const updated = document.getElementById(`${prefix}OverviewUpdated`);
  if (updated) updated.hidden = true;
  const stateNote = document.getElementById(`${prefix}OverviewState`);
  if (stateNote) stateNote.hidden = true;

  setText(`${prefix}DetailMainStatus`, 'В процессе');
  setText(
    prefix === 'discord' ? 'discordCustomStatus' : 'telegramLastSeenText',
    `Интеграция ${title} разрабатывается`
  )?.classList.add('progress-note');

  setState(document.getElementById(`${prefix}DetailStatusOrb`), 'progress');

  const tab = document.querySelector(`.tab-link[data-tab="${prefix}"]`);
  if (tab && tab.dataset.progressLabel !== 'В процессе') tab.dataset.progressLabel = 'В процессе';

  const view = document.getElementById(`${prefix}View`);
  if (!view) return;

  view.querySelectorAll(
    '.data-grid, .stats-card, .activity-card, .empty-state, .history-panel, .tech-details, .retry-button, .stale-banner, .error-banner'
  ).forEach((element) => {
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
  });

  const detailActions = view.querySelector('.detail-actions');
  if (detailActions) detailActions.querySelectorAll('button').forEach((button) => button.remove());
}

function restoreWordIndexes() {
  document.querySelectorAll('#profileDescription .description-word').forEach((word, index) => {
    word.style.setProperty('--word-index', String(index));
    word.style.setProperty('--word-flow-delay', `${index * -180}ms`);
  });
}

function historyEntries(key) {
  const appState = safeState();
  if (!appState) return [];

  if (key === 'steamGames' || key === 'steamPresence') {
    const filter = appState.historyView.steam.filter;
    const history = Array.isArray(appState.steam.history) ? appState.steam.history : [];
    if (key === 'steamGames') {
      if (filter === 'online' || filter === 'offline') return [];
      return history.filter((entry) => entry.type === 'game');
    }

    if (filter === 'games') return [];
    return history
      .filter((entry) => entry.type === 'presence')
      .filter((entry) => {
        if (filter === 'all') return true;
        if (filter === 'online') return entry.status !== 'offline' && entry.status !== 'unknown';
        if (filter === 'offline') return entry.status === 'offline';
        return true;
      });
  }

  if (key === 'discord') {
    const filter = appState.historyView.discord.filter;
    return (appState.discord.history || []).filter((entry) => (
      filter === 'all'
      || (filter === 'activities' ? entry.activityType !== 'none' : entry.status === filter)
    ));
  }

  const filter = appState.historyView.telegram.filter;
  const approximate = new Set(['recently', 'last-week', 'last-month', 'hidden']);
  return (appState.telegram.history || []).filter((entry) => (
    filter === 'all'
    || (filter === 'approximate' ? approximate.has(entry.status) : entry.status === filter)
  ));
}

function rerenderHistory(key) {
  try {
    if (key.startsWith('steam') && typeof renderSteamHistory === 'function') renderSteamHistory();
    else if (key === 'discord' && typeof renderDiscordHistory === 'function') renderDiscordHistory();
    else if (key === 'telegram' && typeof renderTelegramHistory === 'function') renderTelegramHistory();
  } catch {}
}

const historyControlMap = {
  steamGames: 'steamGameMore',
  steamPresence: 'steamPresenceMore',
  discord: 'discordMore',
  telegram: 'telegramMore'
};

function createHistorySlider(key, controls) {
  const wrapper = document.createElement('div');
  wrapper.className = 'history-range liquid-glass-surface';
  wrapper.dataset.historyRange = key;

  const top = document.createElement('div');
  top.className = 'history-range__top';

  const label = document.createElement('span');
  label.textContent = 'Записи';

  const output = document.createElement('output');
  output.className = 'history-range__value';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'history-range__input';
  input.dataset.historyRangeInput = key;
  input.setAttribute('aria-label', 'Количество видимых записей');

  top.append(label, output);
  wrapper.append(top, input);
  controls.replaceChildren(wrapper);

  input.addEventListener('input', () => {
    const appState = safeState();
    const view = appState?.historyView?.[key];
    if (!view) return;
    view.visible = Number(input.value);
    rerenderHistory(key);
    updateHistorySlider(key);
  });
}

function updateHistorySlider(key) {
  const appState = safeState();
  const view = appState?.historyView?.[key];
  const wrapper = document.querySelector(`[data-history-range="${key}"]`);
  if (!view || !wrapper) return;

  const total = historyEntries(key).length;
  const input = wrapper.querySelector('input');
  const output = wrapper.querySelector('output');

  if (total <= 1) {
    wrapper.hidden = true;
    return;
  }

  wrapper.hidden = false;
  const value = Math.max(1, Math.min(total, Number(view.visible) || 1));
  if (view.visible !== value) view.visible = value;

  input.min = '1';
  input.max = String(total);
  input.step = '1';
  input.value = String(value);
  output.textContent = `${value} из ${total}`;
  input.style.setProperty('--range-progress', `${((value - 1) / Math.max(1, total - 1)) * 100}%`);
}

function installHistorySliders() {
  for (const [key, moreId] of Object.entries(historyControlMap)) {
    let wrapper = document.querySelector(`[data-history-range="${key}"]`);
    if (!wrapper) {
      const button = document.getElementById(moreId);
      const controls = button?.closest('.history-controls');
      if (!controls) continue;
      createHistorySlider(key, controls);
      wrapper = document.querySelector(`[data-history-range="${key}"]`);
    }
    if (wrapper) updateHistorySlider(key);
  }
}

const glassSelectors = [
  '.profile-card',
  '.tracker-topbar',
  '.tracker-tabs',
  '.platform-card',
  '.detail-card',
  '.stats-card',
  '.history-panel',
  '.data-item',
  '.timeline-entry',
  '.activity-card',
  '.empty-state',
  '.status-pill',
  '.mini-badge',
  '.action-button',
  '.ghost-button',
  '.filter-button',
  '.copy-button',
  '.history-range'
].join(',');

function applyLiquidGlass() {
  document.querySelectorAll(glassSelectors).forEach((element) => {
    element.classList.add('liquid-glass-surface');
  });
}

class LiquidGlassInteraction {
  constructor() {
    this.frame = 0;
    this.x = innerWidth / 2;
    this.y = innerHeight / 2;
  }

  init() {
    addEventListener('pointermove', (event) => {
      this.x = event.clientX;
      this.y = event.clientY;
      this.schedule();
    }, { passive: true });

    addEventListener('pointerdown', () => {
      document.documentElement.classList.add('is-glass-pressed');
      this.schedule();
    }, { passive: true });

    addEventListener('pointerup', () => {
      document.documentElement.classList.remove('is-glass-pressed');
    }, { passive: true });

    addEventListener('pointercancel', () => {
      document.documentElement.classList.remove('is-glass-pressed');
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => {
      document.documentElement.classList.remove('is-glass-pressed');
      this.resetSharedTilt();
    }, { passive: true });
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.updateGlassLight();
      this.updateSharedTilt();
    });
  }

  updateGlassLight() {
    const surface = document.elementsFromPoint(this.x, this.y)
      .find((element) => element.classList?.contains('liquid-glass-surface'));
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    surface.style.setProperty('--glass-x', `${((this.x - rect.left) / rect.width) * 100}%`);
    surface.style.setProperty('--glass-y', `${((this.y - rect.top) / rect.height) * 100}%`);
  }

  updateSharedTilt() {
    if (reduceMotion.matches || coarsePointer.matches) return;
    const nx = Math.max(-1, Math.min(1, (this.x / Math.max(innerWidth, 1) - 0.5) * 2));
    const ny = Math.max(-1, Math.min(1, (this.y / Math.max(innerHeight, 1) - 0.5) * 2));
    const route = document.body.dataset.route;
    const target = route === 'tracker'
      ? document.querySelector('.tracker-layout')
      : document.getElementById('profileCard');
    if (!target) return;

    target.style.setProperty('--shared-rx', `${(-ny * 0.42).toFixed(3)}deg`);
    target.style.setProperty('--shared-ry', `${(nx * 0.52).toFixed(3)}deg`);
  }

  resetSharedTilt() {
    document.querySelectorAll('.tracker-layout, #profileCard').forEach((element) => {
      element.style.setProperty('--shared-rx', '0deg');
      element.style.setProperty('--shared-ry', '0deg');
    });
  }
}

new LiquidGlassInteraction().init();

let scheduled = 0;
function applyCorrections() {
  if (scheduled) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    exposeAvatar();
    removeManualSynchronization();
    cleanLabels();
    updateLastSynchronization();
    restoreWordIndexes();
    markProgress('discord');
    markProgress('telegram');
    installHistorySliders();
    applyLiquidGlass();
  });
}

new MutationObserver(applyCorrections).observe(document.body, {
  childList: true,
  subtree: true
});

applyCorrections();
loadSyncTimestamp().then(applyCorrections);
addEventListener('hashchange', applyCorrections);
addEventListener('pageshow', applyCorrections);
setInterval(applyCorrections, 1500);
setInterval(() => {
  loadSyncTimestamp().then(applyCorrections);
}, 60_000);
