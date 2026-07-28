const $ = (selector) => document.querySelector(selector);

const canvas = $('#interactive-background');
const context = canvas.getContext('2d', { alpha: true });
const card = $('#profile-card');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let viewportWidth = 0;
let viewportHeight = 0;
let pixelRatio = 1;
let particles = [];
let ripples = [];
let animationFrame = 0;

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  pressed: false
};

const tilt = {
  rotateX: 0,
  rotateY: 0,
  translateX: 0,
  translateY: 0,
  targetRotateX: 0,
  targetRotateY: 0,
  targetTranslateX: 0,
  targetTranslateY: 0
};

const iconMarkup = {
  telegram: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 3.2 18.4 20c-.2 1.2-.9 1.5-1.9.9l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.7 8.7-7.9c.4-.3-.1-.5-.6-.2L6 14.1l-4.6-1.5c-1-.3-1-1 .2-1.4L19.7 4c.8-.3 1.6.2 1.9-.8Z"></path>
    </svg>`,
  roblox: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill-rule="evenodd" d="m6.4 2 15.6 4.4L17.6 22 2 17.6 6.4 2Zm4.1 7.3-1.2 4.2 4.2 1.2 1.2-4.2-4.2-1.2Z" clip-rule="evenodd"></path>
    </svg>`,
  tiktok: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.3 3v11.1a4.7 4.7 0 1 1-4-4.6v2.8a1.9 1.9 0 1 0 1.2 1.8V3h2.8Zm0 0c.4 2.3 1.8 3.8 4.1 4.2V10a7.7 7.7 0 0 1-4.1-1.4V3Z"></path>
    </svg>`,
  steam: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-9.7 7.6l5.3 2.2a3.6 3.6 0 0 1 2.2-1.1l2.4-3.5a4.7 4.7 0 1 1 4.1 7 4.7 4.7 0 0 1-3.5-1.6l-3.4.1a3.6 3.6 0 0 1-6.2 2.5l-1.5-.6A10 10 0 1 0 12 2Zm-5 15.8a2.2 2.2 0 0 0 1.2-4.2L5.7 12.5 7 17.8Zm9.3-5.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm0-1.4a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z"></path>
    </svg>`
};

let spotifyController = null;
let spotifyUrl = '';
let spotifyDuration = 0;
let spotifyPosition = 0;
let spotifyPaused = true;
let spotifyApiRequested = false;

function resizeCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;

  canvas.width = Math.round(viewportWidth * pixelRatio);
  canvas.height = Math.round(viewportHeight * pixelRatio);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const particleCount = reducedMotion
    ? 34
    : Math.min(150, Math.max(58, Math.round((viewportWidth * viewportHeight) / 10500)));

  particles = Array.from({ length: particleCount }, () => createParticle());
}

function createParticle(x = Math.random() * viewportWidth, y = Math.random() * viewportHeight) {
  const depth = Math.random() * 0.85 + 0.15;
  return {
    x,
    y,
    depth,
    radius: 0.45 + depth * 1.75,
    velocityX: (Math.random() - 0.5) * (0.15 + depth * 0.34),
    velocityY: (Math.random() - 0.5) * (0.15 + depth * 0.34),
    alpha: 0.12 + depth * 0.48,
    phase: Math.random() * Math.PI * 2
  };
}

function createBurst(x, y) {
  ripples.push({ x, y, radius: 7, alpha: 0.72, speed: 2.8 });
  ripples.push({ x, y, radius: 3, alpha: 0.38, speed: 1.7 });

  if (reducedMotion) return;

  for (let index = 0; index < 16; index += 1) {
    const particle = particles[Math.floor(Math.random() * particles.length)];
    if (!particle) break;

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 0.5;
    particle.x = x;
    particle.y = y;
    particle.velocityX = Math.cos(angle) * speed;
    particle.velocityY = Math.sin(angle) * speed;
  }
}

function updatePointer(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
}

function updateCardTarget(event) {
  if (reducedMotion) return;

  const bounds = card.getBoundingClientRect();
  const normalizedX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  const normalizedY = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));

  tilt.targetRotateX = (normalizedY - 0.5) * -11;
  tilt.targetRotateY = (normalizedX - 0.5) * 14;
  tilt.targetTranslateX = (normalizedX - 0.5) * 7;
  tilt.targetTranslateY = (normalizedY - 0.5) * 5;

  card.style.setProperty('--shine-x', `${normalizedX * 100}%`);
  card.style.setProperty('--shine-y', `${normalizedY * 100}%`);
}

function resetCardTarget() {
  tilt.targetRotateX = 0;
  tilt.targetRotateY = 0;
  tilt.targetTranslateX = 0;
  tilt.targetTranslateY = 0;
}

function animateCard() {
  const easing = 0.105;
  tilt.rotateX += (tilt.targetRotateX - tilt.rotateX) * easing;
  tilt.rotateY += (tilt.targetRotateY - tilt.rotateY) * easing;
  tilt.translateX += (tilt.targetTranslateX - tilt.translateX) * easing;
  tilt.translateY += (tilt.targetTranslateY - tilt.translateY) * easing;

  if (!reducedMotion) {
    card.style.transform = [
      'perspective(1150px)',
      `translate3d(${tilt.translateX}px, ${tilt.translateY}px, 0)`,
      `rotateX(${tilt.rotateX}deg)`,
      `rotateY(${tilt.rotateY}deg)`
    ].join(' ');
  }

  window.requestAnimationFrame(animateCard);
}

function drawBackground(timestamp = 0) {
  context.clearRect(0, 0, viewportWidth, viewportHeight);

  const focusX = pointer.active ? pointer.x : viewportWidth * 0.5;
  const focusY = pointer.active ? pointer.y : viewportHeight * 0.42;
  const glow = context.createRadialGradient(
    focusX,
    focusY,
    0,
    focusX,
    focusY,
    Math.max(viewportWidth, viewportHeight) * 0.62
  );
  glow.addColorStop(0, 'rgba(122, 98, 255, 0.2)');
  glow.addColorStop(0.34, 'rgba(44, 124, 205, 0.085)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, viewportWidth, viewportHeight);

  for (const particle of particles) {
    particle.phase += 0.008 + particle.depth * 0.008;

    if (pointer.active && !reducedMotion) {
      const deltaX = particle.x - pointer.x;
      const deltaY = particle.y - pointer.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const influenceRadius = 115 + particle.depth * 90;

      if (distance < influenceRadius) {
        const direction = pointer.pressed ? -1 : 1;
        const force = ((influenceRadius - distance) / influenceRadius) * 0.065 * particle.depth * direction;
        particle.velocityX += (deltaX / distance) * force;
        particle.velocityY += (deltaY / distance) * force;
      }
    }

    particle.velocityX *= 0.991;
    particle.velocityY *= 0.991;
    particle.x += particle.velocityX + Math.cos(particle.phase) * 0.035 * particle.depth;
    particle.y += particle.velocityY + Math.sin(particle.phase * 0.8) * 0.03 * particle.depth;

    if (particle.x < -18) particle.x = viewportWidth + 18;
    if (particle.x > viewportWidth + 18) particle.x = -18;
    if (particle.y < -18) particle.y = viewportHeight + 18;
    if (particle.y > viewportHeight + 18) particle.y = -18;

    const parallaxX = pointer.active
      ? ((pointer.x / viewportWidth) - 0.5) * particle.depth * 14
      : 0;
    const parallaxY = pointer.active
      ? ((pointer.y / viewportHeight) - 0.5) * particle.depth * 10
      : 0;

    context.beginPath();
    context.fillStyle = `rgba(207, 213, 255, ${particle.alpha})`;
    context.arc(
      particle.x + parallaxX,
      particle.y + parallaxY,
      particle.radius * (1 + Math.sin(timestamp * 0.001 + particle.phase) * 0.08),
      0,
      Math.PI * 2
    );
    context.fill();
  }

  const connectionLimit = Math.min(particles.length, 112);
  for (let firstIndex = 0; firstIndex < connectionLimit; firstIndex += 1) {
    const first = particles[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < connectionLimit; secondIndex += 1) {
      const second = particles[secondIndex];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const threshold = 74 + Math.min(first.depth, second.depth) * 52;

      if (distance >= threshold) continue;

      const alpha = (1 - distance / threshold) * 0.105 * Math.min(first.depth, second.depth);
      context.strokeStyle = `rgba(147, 139, 255, ${alpha})`;
      context.lineWidth = 0.55 + Math.min(first.depth, second.depth) * 0.35;
      context.beginPath();
      context.moveTo(first.x, first.y);
      context.lineTo(second.x, second.y);
      context.stroke();
    }
  }

  ripples = ripples.filter((ripple) => ripple.alpha > 0.012);
  for (const ripple of ripples) {
    ripple.radius += ripple.speed;
    ripple.alpha *= 0.954;
    context.strokeStyle = `rgba(175, 164, 255, ${ripple.alpha})`;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    context.stroke();
  }

  animationFrame = window.requestAnimationFrame(drawBackground);
}

function formatTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '0:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateSpotifyControls() {
  const progress = spotifyDuration > 0 ? (spotifyPosition / spotifyDuration) * 100 : 0;
  $('#spotify-progress').value = String(Math.max(0, Math.min(100, progress)));
  $('#spotify-time').textContent = `${formatTime(spotifyPosition)} / ${formatTime(spotifyDuration)}`;
  $('#spotify-toggle').classList.toggle('is-playing', !spotifyPaused);
  $('#spotify-toggle').setAttribute('aria-label', spotifyPaused ? 'Воспроизвести' : 'Пауза');
  $('#spotify-section').classList.toggle('is-playing', !spotifyPaused);
}

function extractSpotifyEntity(url) {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)spotify\.com$/.test(parsed.hostname)) return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const offset = parts[0]?.startsWith('intl-') ? 1 : 0;
    const type = parts[offset];
    const id = parts[offset + 1];
    if (!['track', 'album', 'playlist', 'artist', 'episode', 'show'].includes(type) || !id) return null;
    return { type, id, cleanUrl: `https://open.spotify.com/${type}/${id}` };
  } catch {
    return null;
  }
}

async function loadSpotifyMetadata(url) {
  try {
    const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { cache: 'force-cache' });
    if (!response.ok) return;
    const data = await response.json();

    if (data.title) $('#spotify-title').textContent = data.title;
    if (data.provider_name) $('#spotify-subtitle').textContent = data.provider_name;
    if (data.thumbnail_url) {
      $('#spotify-art').style.backgroundImage = `linear-gradient(135deg, rgba(8,9,13,.05), rgba(8,9,13,.5)), url("${data.thumbnail_url}")`;
      $('#spotify-art').classList.add('has-cover');
    }
  } catch {
    // Официальный Spotify Embed всё равно останется доступен.
  }
}

function requestSpotifyApi(entity) {
  if (spotifyApiRequested) return;
  spotifyApiRequested = true;

  window.onSpotifyIframeApiReady = (IFrameAPI) => {
    const host = $('#spotify-embed');
    const options = {
      uri: `spotify:${entity.type}:${entity.id}`,
      width: '100%',
      height: 80,
      theme: 'dark'
    };

    IFrameAPI.createController(host, options, (controller) => {
      spotifyController = controller;
      $('#spotify-toggle').disabled = false;
      $('#spotify-progress').disabled = false;

      controller.addListener('ready', () => {
        $('#spotify-subtitle').textContent = 'Готово к воспроизведению';
      });

      controller.addListener('playback_started', () => {
        spotifyPaused = false;
        updateSpotifyControls();
      });

      controller.addListener('playback_update', (event) => {
        spotifyDuration = Number(event?.data?.duration) || spotifyDuration;
        spotifyPosition = Number(event?.data?.position) || 0;
        spotifyPaused = Boolean(event?.data?.isPaused);
        updateSpotifyControls();
      });
    });
  };

  const script = document.createElement('script');
  script.src = 'https://open.spotify.com/embed/iframe-api/v1';
  script.async = true;
  script.onerror = () => {
    $('#spotify-subtitle').textContent = 'Не удалось загрузить Spotify-плеер';
  };
  document.body.append(script);
}

function initialiseSpotify(url) {
  const entity = extractSpotifyEntity(url);
  if (!entity) return;

  spotifyUrl = entity.cleanUrl;
  $('#spotify-section').hidden = false;
  $('#spotify-open').href = spotifyUrl;
  $('#spotify-title').textContent = 'Spotify Track';
  $('#spotify-subtitle').textContent = 'Загрузка официального плеера…';

  loadSpotifyMetadata(spotifyUrl);
  requestSpotifyApi(entity);
}

function renderLinks(links) {
  const container = $('#profile-links');
  container.replaceChildren();

  for (const item of Array.isArray(links) ? links : []) {
    if (!item?.url || !item?.label) continue;

    const anchor = document.createElement('a');
    anchor.className = `profile-link link-${item.kind || 'generic'}`;
    anchor.href = item.url;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';

    const icon = document.createElement('span');
    icon.className = 'link-icon';
    icon.innerHTML = iconMarkup[item.kind] || `<span>${String(item.icon || item.label).slice(0, 2).toUpperCase()}</span>`;

    const copy = document.createElement('span');
    copy.className = 'link-copy';

    const label = document.createElement('strong');
    label.textContent = item.label;

    const hint = document.createElement('small');
    hint.textContent = item.hint || item.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const arrow = document.createElement('span');
    arrow.className = 'link-arrow';
    arrow.textContent = '↗';

    copy.append(label, hint);
    anchor.append(icon, copy, arrow);
    container.append(anchor);
  }
}

async function fetchJson(path, fallback = null) {
  try {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    return response.ok ? response.json() : fallback;
  } catch {
    return fallback;
  }
}

function readCounterValue(payload) {
  const candidates = [
    payload?.value,
    payload?.count,
    payload?.data?.value,
    payload?.data?.count,
    payload?.result?.value,
    payload?.result?.count
  ];
  return candidates.find((value) => Number.isFinite(Number(value)));
}

async function updateViewCounter() {
  const display = $('#view-count');
  const baseEndpoint = 'https://api.counterapi.dev/v1/quixylon-ai/profile-card-views';
  const today = new Date().toISOString().slice(0, 10);
  let lastCountedDay = '';

  try {
    lastCountedDay = window.localStorage.getItem('quixylon-profile-view-day') || '';
  } catch {
    // В приватном режиме просто используем обычный счётчик просмотров.
  }

  const shouldIncrement = lastCountedDay !== today;
  const endpoint = shouldIncrement ? `${baseEndpoint}/up` : baseEndpoint;

  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const value = readCounterValue(payload);
    if (value === undefined) throw new Error('Counter value missing');

    display.textContent = `Просмотры: ${new Intl.NumberFormat('ru-RU').format(Number(value))}`;

    if (shouldIncrement) {
      try {
        window.localStorage.setItem('quixylon-profile-view-day', today);
      } catch {
        // Счётчик продолжит работать и без localStorage.
      }
    }
  } catch {
    display.textContent = 'Просмотры: недоступны';
  }
}

async function loadProfile() {
  const [bio, status] = await Promise.all([
    fetchJson('./data/bio.json', {}),
    fetchJson('./data/status.json')
  ]);

  $('#profile-name').textContent = bio.displayName || 'Quixylon';
  $('#profile-handle').textContent = bio.handle || '@quixylon';

  const descriptions = Array.isArray(bio.descriptions)
    ? bio.descriptions.filter(Boolean)
    : [];
  $('#profile-description').textContent = descriptions.length
    ? descriptions.join(' · ')
    : bio.description || 'Steam, CS2 и всё важное — в одном месте.';

  renderLinks(bio.links);

  const player = status?.player;
  if (player) {
    $('#profile-avatar').src = bio.avatarUrl || player.avatar;
    $('#profile-avatar').alt = `Аватар ${player.name}`;
    $('#steam-name').textContent = player.name;
    $('#profile-status').textContent = player.gameName
      ? `Сейчас играет: ${player.gameName}`
      : player.status === 'offline'
        ? 'Steam: не в сети'
        : 'Steam: в сети';
  } else {
    $('#steam-name').textContent = 'Quixylon';
  }

  if (bio.spotifyUrl) initialiseSpotify(bio.spotifyUrl);
}

window.addEventListener('pointermove', updatePointer, { passive: true });
window.addEventListener('pointerdown', (event) => {
  updatePointer(event);
  pointer.pressed = true;
  createBurst(event.clientX, event.clientY);
}, { passive: true });
window.addEventListener('pointerup', () => {
  pointer.pressed = false;
}, { passive: true });
window.addEventListener('pointercancel', () => {
  pointer.pressed = false;
}, { passive: true });
window.addEventListener('resize', resizeCanvas, { passive: true });

card.addEventListener('pointermove', updateCardTarget, { passive: true });
card.addEventListener('pointerleave', resetCardTarget, { passive: true });
card.addEventListener('pointercancel', resetCardTarget, { passive: true });

$('#spotify-toggle').addEventListener('click', () => {
  if (!spotifyController) return;
  spotifyController.togglePlay();
});

$('#spotify-progress').addEventListener('input', (event) => {
  if (!spotifyDuration) return;
  const previewPosition = (Number(event.target.value) / 100) * spotifyDuration;
  $('#spotify-time').textContent = `${formatTime(previewPosition)} / ${formatTime(spotifyDuration)}`;
});

$('#spotify-progress').addEventListener('change', (event) => {
  if (!spotifyController || !spotifyDuration) return;
  const seconds = Math.round(((Number(event.target.value) / 100) * spotifyDuration) / 1000);
  spotifyController.seek(seconds);
});

resizeCanvas();
window.cancelAnimationFrame(animationFrame);
drawBackground();
animateCard();
loadProfile();
updateViewCounter();
