const $ = (selector) => document.querySelector(selector);

const canvas = $('#interactive-background');
const context = canvas.getContext('2d', { alpha: true });
const card = $('#profile-card');
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let width = 0;
let height = 0;
let pixelRatio = 1;
let particles = [];
let ripples = [];
let lastFrame = performance.now();

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false
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
      <circle cx="15.8" cy="8.2" r="3.8"></circle>
      <circle cx="15.8" cy="8.2" r="1.65"></circle>
      <circle cx="7.1" cy="16.4" r="2.75"></circle>
      <path d="m9.55 15.05 3.45-2.58-1.35-1.48M4.72 15.35 2.2 14.3"></path>
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

function createParticle(index, count) {
  const aspect = Math.max(0.5, width / Math.max(height, 1));
  const columns = Math.max(6, Math.ceil(Math.sqrt(count * aspect)));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const depth = Math.random() * 0.86 + 0.14;
  const homeX = (column + 0.5) * cellWidth + (Math.random() - 0.5) * cellWidth * 0.58;
  const homeY = (row + 0.5) * cellHeight + (Math.random() - 0.5) * cellHeight * 0.58;

  return {
    x: homeX,
    y: homeY,
    homeX,
    homeY,
    velocityX: 0,
    velocityY: 0,
    depth,
    radius: 0.7 + depth * 1.7,
    alpha: 0.25 + depth * 0.5,
    phase: Math.random() * Math.PI * 2,
    maxOffset: 38 + depth * 42
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

  const count = Math.min(155, Math.max(reducedMotion ? 62 : 94, Math.round((width * height) / 8400)));
  particles = Array.from({ length: count }, (_, index) => createParticle(index, count));
}

function addRipple(x, y) {
  ripples.push({ x, y, radius: 8, alpha: 0.62, speed: 2.1 });
  ripples.push({ x, y, radius: 18, alpha: 0.26, speed: 1.35 });
}

function setPointer(clientX, clientY) {
  pointer.x = clientX;
  pointer.y = clientY;
  pointer.active = true;

  const bounds = card.getBoundingClientRect();
  const normalizedX = Math.min(1, Math.max(0, (clientX - bounds.left) / Math.max(bounds.width, 1)));
  const normalizedY = Math.min(1, Math.max(0, (clientY - bounds.top) / Math.max(bounds.height, 1)));
  const maxX = coarsePointer ? 0.65 : 1.45;
  const maxY = coarsePointer ? 0.85 : 1.9;

  tilt.targetX = (normalizedY - 0.5) * -maxX * 2;
  tilt.targetY = (normalizedX - 0.5) * maxY * 2;
  tilt.targetShiftX = (normalizedX - 0.5) * (coarsePointer ? 1 : 2.4);
  tilt.targetShiftY = (normalizedY - 0.5) * (coarsePointer ? 0.7 : 1.8);
  card.style.setProperty('--shine-x', `${normalizedX * 100}%`);
  card.style.setProperty('--shine-y', `${normalizedY * 100}%`);
}

function releasePointer() {
  pointer.down = false;
  pointer.active = false;
  tilt.targetX = 0;
  tilt.targetY = 0;
  tilt.targetShiftX = 0;
  tilt.targetShiftY = 0;
}

function animateCard(timestamp = 0) {
  const easing = 0.085;
  if (!pointer.active) {
    tilt.targetX = Math.sin(timestamp * 0.0003) * 0.18;
    tilt.targetY = Math.cos(timestamp * 0.00026) * 0.26;
    tilt.targetShiftY = Math.sin(timestamp * 0.00035) * -0.28;
  }

  tilt.x += (tilt.targetX - tilt.x) * easing;
  tilt.y += (tilt.targetY - tilt.y) * easing;
  tilt.shiftX += (tilt.targetShiftX - tilt.shiftX) * easing;
  tilt.shiftY += (tilt.targetShiftY - tilt.shiftY) * easing;
  card.style.transform = `perspective(1300px) translate3d(${tilt.shiftX}px, ${tilt.shiftY}px, 0) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;
  window.requestAnimationFrame(animateCard);
}

function updateParticles(delta, timestamp) {
  const springStrength = pointer.down ? 0.018 : 0.045;
  const damping = pointer.down ? 0.91 : 0.86;

  for (const particle of particles) {
    particle.phase += (0.006 + particle.depth * 0.004) * delta;

    particle.velocityX += (particle.homeX - particle.x) * springStrength * delta;
    particle.velocityY += (particle.homeY - particle.y) * springStrength * delta;

    if (pointer.down) {
      const deltaX = pointer.x - particle.x;
      const deltaY = pointer.y - particle.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const influence = 185 + particle.depth * 85;

      if (distance < influence) {
        const pull = (1 - distance / influence) * 0.095 * particle.depth;
        const swirl = (1 - distance / influence) * 0.009 * particle.depth;
        particle.velocityX += ((deltaX / distance) * pull - (deltaY / distance) * swirl) * delta;
        particle.velocityY += ((deltaY / distance) * pull + (deltaX / distance) * swirl) * delta;
      }
    } else if (pointer.active && !coarsePointer) {
      const deltaX = particle.x - pointer.x;
      const deltaY = particle.y - pointer.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const influence = 95 + particle.depth * 55;
      if (distance < influence) {
        const force = (1 - distance / influence) * 0.014 * particle.depth;
        particle.velocityX += (deltaX / distance) * force * delta;
        particle.velocityY += (deltaY / distance) * force * delta;
      }
    }

    particle.velocityX *= Math.pow(damping, delta);
    particle.velocityY *= Math.pow(damping, delta);
    particle.x += particle.velocityX * delta;
    particle.y += particle.velocityY * delta;

    const offsetX = particle.x - particle.homeX;
    const offsetY = particle.y - particle.homeY;
    const offset = Math.hypot(offsetX, offsetY) || 1;
    if (offset > particle.maxOffset) {
      const scale = particle.maxOffset / offset;
      particle.x = particle.homeX + offsetX * scale;
      particle.y = particle.homeY + offsetY * scale;
      particle.velocityX *= 0.48;
      particle.velocityY *= 0.48;
    }

    particle.renderX = particle.x + Math.cos(timestamp * 0.00045 + particle.phase) * particle.depth * 1.8;
    particle.renderY = particle.y + Math.sin(timestamp * 0.00039 + particle.phase) * particle.depth * 1.5;
  }
}

function drawWeb() {
  context.shadowBlur = 0;
  const threshold = Math.min(138, Math.max(92, Math.min(width, height) * 0.13));

  for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
    const first = particles[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
      const second = particles[secondIndex];
      const distance = Math.hypot(first.renderX - second.renderX, first.renderY - second.renderY);
      if (distance >= threshold) continue;

      const depth = Math.min(first.depth, second.depth);
      const alpha = (1 - distance / threshold) * 0.16 * depth;
      context.strokeStyle = `rgba(157, 149, 255, ${alpha})`;
      context.lineWidth = 0.45 + depth * 0.4;
      context.beginPath();
      context.moveTo(first.renderX, first.renderY);
      context.lineTo(second.renderX, second.renderY);
      context.stroke();
    }
  }

  if (pointer.down) {
    const nearby = particles
      .map((particle) => ({ particle, distance: Math.hypot(particle.renderX - pointer.x, particle.renderY - pointer.y) }))
      .filter((item) => item.distance < 230)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);

    for (const { particle, distance } of nearby) {
      context.strokeStyle = `rgba(190, 181, 255, ${(1 - distance / 230) * 0.22})`;
      context.lineWidth = 0.75;
      context.beginPath();
      context.moveTo(particle.renderX, particle.renderY);
      context.lineTo(pointer.x, pointer.y);
      context.stroke();
    }
  }
}

function drawBackground(timestamp = 0) {
  const delta = Math.min(2, Math.max(0.4, (timestamp - lastFrame) / 16.67));
  lastFrame = timestamp;
  context.clearRect(0, 0, width, height);

  const focusX = pointer.active ? pointer.x : width * (0.5 + Math.sin(timestamp * 0.00015) * 0.1);
  const focusY = pointer.active ? pointer.y : height * (0.42 + Math.cos(timestamp * 0.00012) * 0.07);
  const glow = context.createRadialGradient(focusX, focusY, 0, focusX, focusY, Math.max(width, height) * 0.6);
  glow.addColorStop(0, pointer.down ? 'rgba(151, 126, 255, 0.24)' : 'rgba(135, 109, 255, 0.19)');
  glow.addColorStop(0.36, 'rgba(44, 132, 213, 0.08)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  updateParticles(delta, timestamp);
  drawWeb();

  for (const particle of particles) {
    const pulse = 1 + Math.sin(timestamp * 0.0014 + particle.phase) * 0.08;
    context.beginPath();
    context.fillStyle = `rgba(222, 226, 255, ${particle.alpha})`;
    context.shadowColor = `rgba(151, 141, 255, ${particle.alpha * 0.52})`;
    context.shadowBlur = 4 + particle.depth * 5;
    context.arc(particle.renderX, particle.renderY, particle.radius * pulse, 0, Math.PI * 2);
    context.fill();
  }

  context.shadowBlur = 0;
  ripples = ripples.filter((ripple) => ripple.alpha > 0.012);
  for (const ripple of ripples) {
    ripple.radius += ripple.speed * delta;
    ripple.alpha *= Math.pow(0.95, delta);
    context.strokeStyle = `rgba(187, 178, 255, ${ripple.alpha})`;
    context.lineWidth = 1.1;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    context.stroke();
  }

  window.requestAnimationFrame(drawBackground);
}

function renderDescription(text) {
  const description = $('#profile-description');
  const fullText = String(text || 'Здесь собраны мои некоторые цифровые следы — места, где я иногда появляюсь.').trim();
  description.replaceChildren();
  description.setAttribute('aria-label', fullText);
  fullText.split(/\s+/).forEach((word, index) => {
    const span = document.createElement('span');
    span.className = 'description-word';
    span.style.setProperty('--word-index', String(index));
    span.textContent = word;
    description.append(span, document.createTextNode(' '));
  });
}

function renderLinks(links) {
  const container = $('#profile-links');
  container.replaceChildren();

  for (const [index, item] of (Array.isArray(links) ? links : []).entries()) {
    if (!item?.url || !item?.label) continue;

    const stage = document.createElement('div');
    stage.className = 'link-stage';
    stage.style.setProperty('--float-delay', `${index * -0.47}s`);

    const platform = document.createElement('span');
    platform.className = 'button-platform';
    platform.setAttribute('aria-hidden', 'true');

    const anchor = document.createElement('a');
    anchor.className = `profile-link link-${item.kind || 'generic'}`;
    anchor.href = item.url;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.style.setProperty('--float-delay', `${index * -0.47}s`);

    const icon = document.createElement('span');
    icon.className = 'link-icon';
    icon.innerHTML = iconMarkup[item.kind] || `<span>${String(item.icon || item.label).slice(0, 2).toUpperCase()}</span>`;

    const label = document.createElement('strong');
    label.className = 'link-label';
    label.textContent = item.label;

    const arrow = document.createElement('span');
    arrow.className = 'link-arrow';
    arrow.textContent = '↗';

    anchor.append(icon, label, arrow);
    stage.append(platform, anchor);
    container.append(stage);
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
  const link = $('#guns-card');
  dot.className = `presence-dot ${status}`;
  link.setAttribute('aria-label', `guns.lol — Discord: ${label}`);
  link.title = `Discord: ${label}`;
}

function parseDiscordPresence(text) {
  const normalized = String(text || '').toLowerCase();
  return [
    { status: 'dnd', label: 'не беспокоить', expression: /\b(do not disturb|dnd)\b/ },
    { status: 'idle', label: 'неактивен', expression: /\bidle\b/ },
    { status: 'offline', label: 'не в сети', expression: /\boffline\b/ },
    { status: 'online', label: 'в сети', expression: /\bonline\b/ }
  ].find((item) => item.expression.test(normalized)) || null;
}

async function updateDiscordPresence() {
  for (const source of ['https://r.jina.ai/http://guns.lol/quixylon', 'https://guns.lol/quixylon']) {
    try {
      const response = await fetch(source, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      const result = parseDiscordPresence(await response.text());
      if (result) {
        setDiscordPresence(result.status, result.label);
        return;
      }
    } catch {
      // Пробуем следующий источник.
    }
  }
  setDiscordPresence('unknown', 'статус недоступен');
}

function readCounterValue(payload) {
  return [payload?.value, payload?.count, payload?.data?.value, payload?.data?.count, payload?.result?.value, payload?.result?.count]
    .find((value) => Number.isFinite(Number(value)));
}

async function updateViewCounter() {
  const display = $('#view-count');
  const baseEndpoint = 'https://api.counterapi.dev/v1/quixylon-ai/profile-card-views';
  const today = new Date().toISOString().slice(0, 10);
  let previousDay = '';

  try {
    previousDay = localStorage.getItem('quixylon-profile-view-day') || '';
  } catch {
    // localStorage может быть отключён.
  }

  const increment = previousDay !== today;
  try {
    const response = await fetch(increment ? `${baseEndpoint}/up` : baseEndpoint, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = readCounterValue(await response.json());
    if (value === undefined) throw new Error('Counter value missing');
    display.textContent = `Просмотры: ${new Intl.NumberFormat('ru-RU').format(Number(value))}`;
    if (increment) localStorage.setItem('quixylon-profile-view-day', today);
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
  renderDescription(bio.description);
  renderLinks(bio.links);

  const player = status?.player;
  if (player?.avatar) {
    $('#profile-avatar').src = bio.avatarUrl || player.avatar;
    $('#profile-avatar').alt = 'Аватар Qu’lon';
  }
  if (player?.gameName) $('#profile-status').textContent = `Steam: ${player.gameName}`;
  else if (player?.status === 'offline') $('#profile-status').textContent = 'Steam: не в сети';
  else if (player) $('#profile-status').textContent = 'Steam: в сети';
}

window.addEventListener('pointermove', (event) => setPointer(event.clientX, event.clientY), { passive: true });
window.addEventListener('pointerdown', (event) => {
  pointer.down = true;
  setPointer(event.clientX, event.clientY);
  addRipple(event.clientX, event.clientY);
}, { passive: true });
window.addEventListener('pointerup', releasePointer, { passive: true });
window.addEventListener('pointercancel', releasePointer, { passive: true });
window.addEventListener('pointerleave', releasePointer, { passive: true });
window.addEventListener('resize', resizeCanvas, { passive: true });

resizeCanvas();
drawBackground();
animateCard();
loadProfile();
updateDiscordPresence();
updateViewCounter();
window.setInterval(updateDiscordPresence, 60_000);
