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

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  pressed: false
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
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-9.7 7.6l5.3 2.2a3.6 3.6 0 0 1 2.2-1.1l2.4-3.5a4.7 4.7 0 1 1 4.1 7 4.7 4.7 0 0 1-3.5-1.6l-3.4.1a3.6 3.6 0 0 1-6.2 2.5l-1.5-.6A10 10 0 1 0 12 2Zm-5 15.8a2.2 2.2 0 0 0 1.2-4.2L5.7 12.5 7 17.8Zm9.3-5.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm0-1.4a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z"></path>
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

function createParticle(x = Math.random() * width, y = Math.random() * height) {
  const depth = Math.random() * 0.9 + 0.1;
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.12 + depth * 0.38;

  return {
    x,
    y,
    depth,
    radius: 0.8 + depth * 2.1,
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
    alpha: 0.3 + depth * 0.58,
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

  const baseCount = Math.round((width * height) / 7200);
  const particleCount = Math.min(190, Math.max(reducedMotion ? 72 : 105, baseCount));
  particles = Array.from({ length: particleCount }, () => createParticle());
}

function burst(x, y) {
  ripples.push({ x, y, radius: 5, alpha: 0.92, speed: 3.4 });
  ripples.push({ x, y, radius: 12, alpha: 0.5, speed: 2.1 });

  for (let index = 0; index < 24; index += 1) {
    const particle = particles[Math.floor(Math.random() * particles.length)];
    if (!particle) break;

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.8 + 0.7;
    particle.x = x;
    particle.y = y;
    particle.velocityX = Math.cos(angle) * speed;
    particle.velocityY = Math.sin(angle) * speed;
  }
}

function setPointer(clientX, clientY, active = true) {
  pointer.x = clientX;
  pointer.y = clientY;
  pointer.active = active;

  const normalizedX = Math.min(1, Math.max(0, clientX / Math.max(width, 1)));
  const normalizedY = Math.min(1, Math.max(0, clientY / Math.max(height, 1)));

  tilt.targetX = (normalizedY - 0.5) * -18;
  tilt.targetY = (normalizedX - 0.5) * 22;
  tilt.targetShiftX = (normalizedX - 0.5) * 13;
  tilt.targetShiftY = (normalizedY - 0.5) * 10;

  card.style.setProperty('--shine-x', `${normalizedX * 100}%`);
  card.style.setProperty('--shine-y', `${normalizedY * 100}%`);
}

function resetTiltSoon() {
  window.setTimeout(() => {
    pointer.active = false;
    pointer.pressed = false;
    tilt.targetX = 0;
    tilt.targetY = 0;
    tilt.targetShiftX = 0;
    tilt.targetShiftY = 0;
  }, 180);
}

function animateCard(timestamp = 0) {
  const easing = 0.115;

  if (!pointer.active) {
    tilt.targetX = Math.sin(timestamp * 0.00038) * 1.5;
    tilt.targetY = Math.cos(timestamp * 0.00031) * 2.1;
    tilt.targetShiftY = Math.sin(timestamp * 0.00045) * -2.2;
  }

  tilt.x += (tilt.targetX - tilt.x) * easing;
  tilt.y += (tilt.targetY - tilt.y) * easing;
  tilt.shiftX += (tilt.targetShiftX - tilt.shiftX) * easing;
  tilt.shiftY += (tilt.targetShiftY - tilt.shiftY) * easing;

  card.style.transform = [
    'perspective(1050px)',
    `translate3d(${tilt.shiftX}px, ${tilt.shiftY}px, 0)`,
    `rotateX(${tilt.x}deg)`,
    `rotateY(${tilt.y}deg)`
  ].join(' ');

  window.requestAnimationFrame(animateCard);
}

function drawBackground(timestamp = 0) {
  const delta = Math.min(2.2, Math.max(0.35, (timestamp - lastFrame) / 16.67));
  lastFrame = timestamp;
  context.clearRect(0, 0, width, height);

  const focusX = pointer.active ? pointer.x : width * (0.5 + Math.sin(timestamp * 0.00018) * 0.12);
  const focusY = pointer.active ? pointer.y : height * (0.42 + Math.cos(timestamp * 0.00015) * 0.09);
  const glow = context.createRadialGradient(focusX, focusY, 0, focusX, focusY, Math.max(width, height) * 0.62);
  glow.addColorStop(0, 'rgba(139, 112, 255, 0.28)');
  glow.addColorStop(0.34, 'rgba(43, 139, 220, 0.13)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  for (const particle of particles) {
    particle.phase += (0.01 + particle.depth * 0.008) * delta;

    if (pointer.active) {
      const deltaX = particle.x - pointer.x;
      const deltaY = particle.y - pointer.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const influence = 145 + particle.depth * 120;

      if (distance < influence) {
        const direction = pointer.pressed ? -1 : 1;
        const force = ((influence - distance) / influence) * 0.12 * particle.depth * direction;
        particle.velocityX += (deltaX / distance) * force;
        particle.velocityY += (deltaY / distance) * force;
      }
    }

    particle.velocityX *= 0.988;
    particle.velocityY *= 0.988;
    particle.x += (particle.velocityX + Math.cos(particle.phase) * 0.055 * particle.depth) * delta;
    particle.y += (particle.velocityY + Math.sin(particle.phase * 0.82) * 0.05 * particle.depth) * delta;

    if (particle.x < -24) particle.x = width + 24;
    if (particle.x > width + 24) particle.x = -24;
    if (particle.y < -24) particle.y = height + 24;
    if (particle.y > height + 24) particle.y = -24;

    const parallaxX = ((focusX / Math.max(width, 1)) - 0.5) * particle.depth * 22;
    const parallaxY = ((focusY / Math.max(height, 1)) - 0.5) * particle.depth * 17;
    const drawX = particle.x + parallaxX;
    const drawY = particle.y + parallaxY;
    const pulse = 1 + Math.sin(timestamp * 0.0018 + particle.phase) * 0.14;

    context.beginPath();
    context.fillStyle = `rgba(222, 226, 255, ${particle.alpha})`;
    context.shadowColor = `rgba(155, 145, 255, ${particle.alpha * 0.72})`;
    context.shadowBlur = 7 + particle.depth * 8;
    context.arc(drawX, drawY, particle.radius * pulse, 0, Math.PI * 2);
    context.fill();
  }

  context.shadowBlur = 0;
  const connectionLimit = Math.min(particles.length, 135);
  for (let firstIndex = 0; firstIndex < connectionLimit; firstIndex += 1) {
    const first = particles[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < connectionLimit; secondIndex += 1) {
      const second = particles[secondIndex];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const threshold = 82 + Math.min(first.depth, second.depth) * 68;
      if (distance >= threshold) continue;

      const alpha = (1 - distance / threshold) * 0.18 * Math.min(first.depth, second.depth);
      context.strokeStyle = `rgba(155, 148, 255, ${alpha})`;
      context.lineWidth = 0.55 + Math.min(first.depth, second.depth) * 0.65;
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
    context.strokeStyle = `rgba(188, 178, 255, ${ripple.alpha})`;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    context.stroke();
  }

  window.requestAnimationFrame(drawBackground);
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

function setDiscordPresence(status, label) {
  const dot = $('#guns-dot');
  const text = $('#guns-presence');
  dot.className = `presence-dot ${status}`;
  text.textContent = label;
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
      const response = await fetch(source, {
        cache: 'no-store',
        signal: AbortSignal.timeout(9000)
      });
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

  setDiscordPresence('unknown', 'Открыть статус');
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
    // В приватном режиме счётчик всё равно попробует загрузиться.
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

  const descriptions = Array.isArray(bio.descriptions)
    ? bio.descriptions.filter(Boolean)
    : [];
  $('#profile-description').textContent = descriptions.length
    ? descriptions.join(' · ')
    : bio.description || 'Steam, CS2, соцсети и всё важное — в одном месте.';

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
  pointer.pressed = true;
  burst(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerup', resetTiltSoon, { passive: true });
window.addEventListener('pointercancel', resetTiltSoon, { passive: true });
window.addEventListener('resize', resizeCanvas, { passive: true });

window.addEventListener('touchstart', (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;
  setPointer(touch.clientX, touch.clientY);
  pointer.pressed = true;
  burst(touch.clientX, touch.clientY);
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;
  setPointer(touch.clientX, touch.clientY);
}, { passive: true });

window.addEventListener('touchend', resetTiltSoon, { passive: true });

resizeCanvas();
drawBackground();
animateCard();
loadProfile();
updateDiscordPresence();
updateViewCounter();
window.setInterval(updateDiscordPresence, 60_000);
