const $ = (selector) => document.querySelector(selector);

const canvas = $('#interactive-background');
const context = canvas.getContext('2d', { alpha: true });
const card = $('#profile-card');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let width = 0;
let height = 0;
let pixelRatio = 1;
let particles = [];
let ripples = [];
let lastFrame = performance.now();
let pointerResetTimer = 0;

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false
};

const tilt = {
  x: 0,
  y: 0,
  shiftX: 0,
  shiftY: 0,
  targetX: 0,
  targetY: 0,
  targetShiftX: 0,
  targetShiftY: 0
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
    <svg class="steam-logo" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="16.8" cy="7.2" r="3.5"></circle>
      <circle cx="7.2" cy="16.4" r="2.7"></circle>
      <path d="m9.6 15.1 4.7-4.6M4.7 15.4 2 14.3M9.4 17.5l3.2 1.3"></path>
    </svg>`,
  csrep: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 4 5.3v5.3c0 5.1 3.4 9.7 8 11.4 4.6-1.7 8-6.3 8-11.4V5.3L12 2Zm0 4.1 4.3 1.8v2.7c0 3.2-1.7 6.2-4.3 7.6-2.6-1.4-4.3-4.4-4.3-7.6V7.9L12 6.1Zm-1.2 3v2.1H8.7v1.7h2.1V15h1.7v-2.1h2.1v-1.7h-2.1V9.1h-1.7Z"></path>
    </svg>`,
  github: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1 1.6 1 .9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.7-1.3-2.2-.3-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.6 4.9.4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"></path>
    </svg>`
};

function createParticle() {
  const depth = Math.random() * 0.85 + 0.15;
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.08 + depth * 0.24;

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    depth,
    radius: 0.65 + depth * 1.7,
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
    alpha: 0.24 + depth * 0.48,
    phase: Math.random() * Math.PI * 2
  };
}

function resizeCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const requestedCount = Math.round((width * height) / 9200);
  const particleCount = Math.min(150, Math.max(reducedMotion ? 58 : 82, requestedCount));
  particles = Array.from({ length: particleCount }, createParticle);
}

function createTouchWave(x, y) {
  ripples.push({ x, y, radius: 8, alpha: 0.72, speed: 2.4 });

  for (const particle of particles) {
    const deltaX = particle.x - x;
    const deltaY = particle.y - y;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    if (distance > 170) continue;

    const force = ((170 - distance) / 170) * 0.55;
    particle.velocityX += (deltaX / distance) * force;
    particle.velocityY += (deltaY / distance) * force;
  }
}

function setPointer(clientX, clientY) {
  pointer.x = clientX;
  pointer.y = clientY;
  pointer.active = true;

  const cardBounds = card.getBoundingClientRect();
  const normalizedX = Math.min(1, Math.max(0, (clientX - cardBounds.left) / Math.max(cardBounds.width, 1)));
  const normalizedY = Math.min(1, Math.max(0, (clientY - cardBounds.top) / Math.max(cardBounds.height, 1)));

  tilt.targetX = (normalizedY - 0.5) * -5.5;
  tilt.targetY = (normalizedX - 0.5) * 7;
  tilt.targetShiftX = (normalizedX - 0.5) * 4;
  tilt.targetShiftY = (normalizedY - 0.5) * 3;

  card.style.setProperty('--shine-x', `${normalizedX * 100}%`);
  card.style.setProperty('--shine-y', `${normalizedY * 100}%`);

  window.clearTimeout(pointerResetTimer);
  pointerResetTimer = window.setTimeout(resetPointer, 1200);
}

function resetPointer() {
  pointer.active = false;
  tilt.targetX = 0;
  tilt.targetY = 0;
  tilt.targetShiftX = 0;
  tilt.targetShiftY = 0;
}

function animateCard(timestamp = 0) {
  const easing = 0.09;

  if (!pointer.active) {
    tilt.targetX = Math.sin(timestamp * 0.0003) * 0.45;
    tilt.targetY = Math.cos(timestamp * 0.00026) * 0.65;
    tilt.targetShiftY = Math.sin(timestamp * 0.00034) * -0.8;
  }

  tilt.x += (tilt.targetX - tilt.x) * easing;
  tilt.y += (tilt.targetY - tilt.y) * easing;
  tilt.shiftX += (tilt.targetShiftX - tilt.shiftX) * easing;
  tilt.shiftY += (tilt.targetShiftY - tilt.shiftY) * easing;

  card.style.transform = [
    'perspective(1250px)',
    `translate3d(${tilt.shiftX}px, ${tilt.shiftY}px, 0)`,
    `rotateX(${tilt.x}deg)`,
    `rotateY(${tilt.y}deg)`
  ].join(' ');

  window.requestAnimationFrame(animateCard);
}

function drawBackground(timestamp = 0) {
  const delta = Math.min(2, Math.max(0.4, (timestamp - lastFrame) / 16.67));
  lastFrame = timestamp;
  context.clearRect(0, 0, width, height);

  const focusX = pointer.active ? pointer.x : width * (0.5 + Math.sin(timestamp * 0.00015) * 0.1);
  const focusY = pointer.active ? pointer.y : height * (0.42 + Math.cos(timestamp * 0.00013) * 0.07);
  const glow = context.createRadialGradient(focusX, focusY, 0, focusX, focusY, Math.max(width, height) * 0.62);
  glow.addColorStop(0, 'rgba(139, 112, 255, 0.2)');
  glow.addColorStop(0.35, 'rgba(43, 139, 220, 0.09)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  for (const particle of particles) {
    particle.phase += (0.007 + particle.depth * 0.005) * delta;

    if (pointer.active) {
      const deltaX = particle.x - pointer.x;
      const deltaY = particle.y - pointer.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const influence = 110 + particle.depth * 85;

      if (distance < influence) {
        const force = ((influence - distance) / influence) * 0.035 * particle.depth;
        particle.velocityX += (deltaX / distance) * force;
        particle.velocityY += (deltaY / distance) * force;
      }
    }

    particle.velocityX *= 0.994;
    particle.velocityY *= 0.994;
    particle.x += (particle.velocityX + Math.cos(particle.phase) * 0.025 * particle.depth) * delta;
    particle.y += (particle.velocityY + Math.sin(particle.phase * 0.84) * 0.022 * particle.depth) * delta;

    if (particle.x < -18) particle.x = width + 18;
    if (particle.x > width + 18) particle.x = -18;
    if (particle.y < -18) particle.y = height + 18;
    if (particle.y > height + 18) particle.y = -18;

    const parallaxX = ((focusX / Math.max(width, 1)) - 0.5) * particle.depth * 12;
    const parallaxY = ((focusY / Math.max(height, 1)) - 0.5) * particle.depth * 9;
    const pulse = 1 + Math.sin(timestamp * 0.0014 + particle.phase) * 0.1;

    context.beginPath();
    context.fillStyle = `rgba(220, 225, 255, ${particle.alpha})`;
    context.shadowColor = `rgba(151, 140, 255, ${particle.alpha * 0.52})`;
    context.shadowBlur = 4 + particle.depth * 5;
    context.arc(
      particle.x + parallaxX,
      particle.y + parallaxY,
      particle.radius * pulse,
      0,
      Math.PI * 2
    );
    context.fill();
  }

  context.shadowBlur = 0;
  const connectionLimit = Math.min(particles.length, 105);
  for (let firstIndex = 0; firstIndex < connectionLimit; firstIndex += 1) {
    const first = particles[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < connectionLimit; secondIndex += 1) {
      const second = particles[secondIndex];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const threshold = 72 + Math.min(first.depth, second.depth) * 50;
      if (distance >= threshold) continue;

      const alpha = (1 - distance / threshold) * 0.1 * Math.min(first.depth, second.depth);
      context.strokeStyle = `rgba(151, 143, 255, ${alpha})`;
      context.lineWidth = 0.55;
      context.beginPath();
      context.moveTo(first.x, first.y);
      context.lineTo(second.x, second.y);
      context.stroke();
    }
  }

  ripples = ripples.filter((ripple) => ripple.alpha > 0.014);
  for (const ripple of ripples) {
    ripple.radius += ripple.speed * delta;
    ripple.alpha *= Math.pow(0.95, delta);
    context.strokeStyle = `rgba(187, 176, 255, ${ripple.alpha})`;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    context.stroke();
  }

  window.requestAnimationFrame(drawBackground);
}

function renderLinks(links) {
  const container = $('#profile-links');
  container.replaceChildren();

  for (const [index, item] of (Array.isArray(links) ? links : []).entries()) {
    if (!item?.url || !item?.label) continue;

    const anchor = document.createElement('a');
    anchor.className = `profile-link link-${item.kind || 'generic'}`;
    anchor.href = item.url;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.style.setProperty('--float-delay', `${index * -0.55}s`);

    const icon = document.createElement('span');
    icon.className = 'link-icon';
    icon.innerHTML = iconMarkup[item.kind] || `<span>${String(item.label).slice(0, 2).toUpperCase()}</span>`;

    const label = document.createElement('strong');
    label.className = 'link-label';
    label.textContent = item.label;

    const arrow = document.createElement('span');
    arrow.className = 'link-arrow';
    arrow.textContent = '↗';

    anchor.append(icon, label, arrow);
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

function setDiscordPresence(status, label) {
  const dot = $('#guns-dot');
  const gunsCard = $('#guns-card');
  dot.className = `presence-dot ${status}`;
  gunsCard.title = `Discord: ${label}`;
  gunsCard.setAttribute('aria-label', `guns.lol — Discord: ${label}`);
}

function parseDiscordPresence(text) {
  const normalized = String(text || '').toLowerCase();
  const patterns = [
    { status: 'dnd', label: 'Не беспокоить', expression: /\b(do not disturb|dnd)\b/ },
    { status: 'idle', label: 'Неактивен', expression: /\bidle\b/ },
    { status: 'offline', label: 'Не в сети', expression: /\boffline\b/ },
    { status: 'online', label: 'В сети', expression: /\bonline\b/ }
  ];

  return patterns.find((item) => item.expression.test(normalized)) || null;
}

async function updateDiscordPresence() {
  const sources = [
    'https://r.jina.ai/http://guns.lol/quixylon',
    'https://guns.lol/quixylon'
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source, { cache: 'no-store' });
      if (!response.ok) continue;

      const result = parseDiscordPresence(await response.text());
      if (result) {
        setDiscordPresence(result.status, result.label);
        return;
      }
    } catch {
      // Пробуем следующий публичный источник.
    }
  }

  setDiscordPresence('unknown', 'статус недоступен');
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
    // Счётчик всё равно попробует загрузиться.
  }

  const shouldIncrement = lastCountedDay !== today;
  const endpoint = shouldIncrement ? `${baseEndpoint}/up` : baseEndpoint;

  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = readCounterValue(await response.json());
    if (value === undefined) throw new Error('Counter value missing');

    display.textContent = `Просмотры: ${new Intl.NumberFormat('ru-RU').format(Number(value))}`;

    if (shouldIncrement) {
      try {
        window.localStorage.setItem('quixylon-profile-view-day', today);
      } catch {
        // localStorage может быть отключён.
      }
    }
  } catch {
    display.textContent = 'Просмотры: —';
  }
}

async function loadProfile() {
  const [bio, status] = await Promise.all([
    fetchJson('./data/bio.json', {}),
    fetchJson('./data/status.json')
  ]);

  $('#profile-name').textContent = bio.displayName || 'Qu’lon';
  $('#profile-handle').textContent = bio.handle || '@quixylon';
  $('#profile-description').textContent = bio.description || 'Здесь собраны мои некоторые цифровые следы — места, где я иногда появляюсь.';
  renderLinks(bio.links);

  const player = status?.player;
  if (player?.avatar) {
    $('#profile-avatar').src = bio.avatarUrl || player.avatar;
    $('#profile-avatar').alt = 'Аватар Qu’lon';
  }

  if (player?.gameName) {
    $('#profile-status').textContent = `Steam: ${player.gameName}`;
  } else if (player?.status === 'offline') {
    $('#profile-status').textContent = 'Steam: не в сети';
  } else if (player) {
    $('#profile-status').textContent = 'Steam: в сети';
  }
}

window.addEventListener('pointermove', (event) => {
  setPointer(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  setPointer(event.clientX, event.clientY);
  createTouchWave(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerleave', resetPointer, { passive: true });
window.addEventListener('pointercancel', resetPointer, { passive: true });
window.addEventListener('resize', resizeCanvas, { passive: true });

resizeCanvas();
drawBackground();
animateCard();
loadProfile();
updateDiscordPresence();
updateViewCounter();
window.setInterval(updateDiscordPresence, 60_000);
