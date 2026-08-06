const $ = (selector) => document.querySelector(selector);

const canvas = $('#interactive-background');
const context = canvas?.getContext('2d', { alpha: true, desynchronized: true });
const card = $('#profile-card');
const coarsePointerMedia = window.matchMedia('(hover: none), (pointer: coarse)');
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

let width = 0;
let height = 0;
let pixelRatio = 1;
let particles = [];
let ripples = [];
let motionStages = [];
let animationFrame = 0;
let lastFrame = performance.now();
let lastProfileStatusVersion = '';

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false,
  lastX: null,
  lastY: null
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

const motion = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  lastScrollY: window.scrollY,
  lastTouchX: null,
  lastTouchY: null
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
      <circle cx="16.3" cy="7.8" r="3.55"></circle>
      <circle cx="16.3" cy="7.8" r="1.55"></circle>
      <circle cx="7.2" cy="16.5" r="2.65"></circle>
      <path d="M9.45 15.08 13.28 12.2M4.93 15.55 2.3 14.45"></path>
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

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function lowPowerMode() {
  return coarsePointerMedia.matches || reducedMotionMedia.matches || width < 700;
}

function addMotionImpulse(deltaX, deltaY, strength = 1) {
  if (reducedMotionMedia.matches) return;
  motion.targetX = clamp(motion.targetX + deltaX * strength, -7, 7);
  motion.targetY = clamp(motion.targetY + deltaY * strength, -7, 7);
}

function refreshMotionStages() {
  motionStages = [...document.querySelectorAll('.link-stage, .action-stage')];
}

function createParticle(index, count) {
  const aspect = Math.max(0.5, width / Math.max(height, 1));
  const columns = Math.max(6, Math.ceil(Math.sqrt(count * aspect)));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const depth = Math.random() * 0.8 + 0.2;
  const homeX = (column + 0.5) * cellWidth + (Math.random() - 0.5) * cellWidth * 0.48;
  const homeY = (row + 0.5) * cellHeight + (Math.random() - 0.5) * cellHeight * 0.48;

  return {
    index,
    x: homeX,
    y: homeY,
    homeX,
    homeY,
    velocityX: 0,
    velocityY: 0,
    renderX: homeX,
    renderY: homeY,
    depth,
    radius: 0.8 + depth * 1.55,
    alpha: 0.28 + depth * 0.5,
    phase: Math.random() * Math.PI * 2,
    attractAngle: Math.random() * Math.PI * 2,
    attractRadius: 13 + Math.random() * 28,
    maxOffset: 42 + depth * 46
  };
}

function resizeCanvas() {
  if (!canvas || !context) return;

  width = Math.max(1, window.innerWidth);
  height = Math.max(1, window.innerHeight);
  pixelRatio = Math.min(window.devicePixelRatio || 1, lowPowerMode() ? 1.25 : 1.75);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const areaCount = Math.round((width * height) / (lowPowerMode() ? 16_000 : 12_500));
  const count = lowPowerMode()
    ? Math.min(52, Math.max(30, areaCount))
    : Math.min(96, Math.max(54, areaCount));

  particles = Array.from({ length: count }, (_, index) => createParticle(index, count));
  ripples = [];
  lastFrame = performance.now();

  if (reducedMotionMedia.matches) drawBackground(performance.now(), false);
}

function addRipple(x, y) {
  if (reducedMotionMedia.matches) return;
  ripples.push({ x, y, radius: 8, alpha: 0.58, speed: 1.9 });
  ripples.push({ x, y, radius: 19, alpha: 0.24, speed: 1.2 });
}

function setPointer(clientX, clientY) {
  pointer.x = clientX;
  pointer.y = clientY;
  pointer.active = true;

  if (pointer.lastX !== null && pointer.lastY !== null) {
    addMotionImpulse(clientX - pointer.lastX, clientY - pointer.lastY, 0.045);
  }
  pointer.lastX = clientX;
  pointer.lastY = clientY;

  if (!card || coarsePointerMedia.matches || reducedMotionMedia.matches) return;

  const bounds = card.getBoundingClientRect();
  const normalizedX = clamp((clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1);
  const normalizedY = clamp((clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1);

  tilt.targetX = (normalizedY - 0.5) * -1.7;
  tilt.targetY = (normalizedX - 0.5) * 2.2;
  tilt.targetShiftX = (normalizedX - 0.5) * 1.8;
  tilt.targetShiftY = (normalizedY - 0.5) * 1.2;
  card.style.setProperty('--shine-x', `${normalizedX * 100}%`);
  card.style.setProperty('--shine-y', `${normalizedY * 100}%`);
}

function releasePointer() {
  pointer.down = false;
  pointer.active = false;
  pointer.lastX = null;
  pointer.lastY = null;
  motion.lastTouchX = null;
  motion.lastTouchY = null;
  tilt.targetX = 0;
  tilt.targetY = 0;
  tilt.targetShiftX = 0;
  tilt.targetShiftY = 0;
}

function updateCardMotion(timestamp) {
  if (!card || coarsePointerMedia.matches || reducedMotionMedia.matches) {
    if (card) card.style.transform = 'none';
    return;
  }

  if (!pointer.active) {
    tilt.targetX = Math.sin(timestamp * 0.00028) * 0.12;
    tilt.targetY = Math.cos(timestamp * 0.00024) * 0.18;
    tilt.targetShiftY = Math.sin(timestamp * 0.00032) * -0.18;
  }

  const easing = 0.08;
  tilt.x += (tilt.targetX - tilt.x) * easing;
  tilt.y += (tilt.targetY - tilt.y) * easing;
  tilt.shiftX += (tilt.targetShiftX - tilt.shiftX) * easing;
  tilt.shiftY += (tilt.targetShiftY - tilt.shiftY) * easing;
  card.style.transform = `perspective(1400px) translate3d(${tilt.shiftX}px, ${tilt.shiftY}px, 0) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;
}

function updateButtonMotion() {
  if (reducedMotionMedia.matches) {
    motionStages.forEach((stage) => {
      stage.style.transform = 'none';
    });
    return;
  }

  motion.targetX *= 0.9;
  motion.targetY *= 0.9;
  motion.x += (motion.targetX - motion.x) * 0.13;
  motion.y += (motion.targetY - motion.y) * 0.13;

  motionStages.forEach((stage, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    const depth = 0.48 + (index % 4) * 0.08;
    const x = motion.x * depth * direction;
    const y = motion.y * depth;
    const rotateX = clamp(-y * 0.12, -0.75, 0.75);
    const rotateY = clamp(x * 0.12, -0.75, 0.75);
    stage.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  });
}

function updateParticles(delta, timestamp) {
  const spring = pointer.down ? 0.018 : 0.058;
  const damping = pointer.down ? 0.92 : 0.82;
  const motionScale = reducedMotionMedia.matches ? 0 : 1;

  for (const particle of particles) {
    particle.phase += (0.005 + particle.depth * 0.003) * delta;
    particle.velocityX += (particle.homeX - particle.x) * spring * delta;
    particle.velocityY += (particle.homeY - particle.y) * spring * delta;

    if (pointer.down && !coarsePointerMedia.matches) {
      const originDistance = Math.hypot(pointer.x - particle.homeX, pointer.y - particle.homeY);
      const influence = 225 + particle.depth * 95;

      if (originDistance < influence) {
        const orbit = particle.attractRadius * (0.8 + particle.depth * 0.55);
        const driftAngle = particle.attractAngle + timestamp * 0.00018 * (particle.depth + 0.4);
        const targetX = pointer.x + Math.cos(driftAngle) * orbit;
        const targetY = pointer.y + Math.sin(driftAngle) * orbit;
        const deltaX = targetX - particle.x;
        const deltaY = targetY - particle.y;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const strength = (1 - originDistance / influence) * 0.115 * (0.65 + particle.depth * 0.55);

        particle.velocityX += (deltaX / distance) * strength * delta;
        particle.velocityY += (deltaY / distance) * strength * delta;
      }
    } else if (pointer.active && !coarsePointerMedia.matches) {
      const deltaX = particle.x - pointer.x;
      const deltaY = particle.y - pointer.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const influence = 105 + particle.depth * 55;

      if (distance < influence) {
        const push = (1 - distance / influence) * 0.012 * particle.depth;
        particle.velocityX += (deltaX / distance) * push * delta;
        particle.velocityY += (deltaY / distance) * push * delta;
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
      particle.velocityX *= 0.42;
      particle.velocityY *= 0.42;
    }

    particle.renderX = particle.x + Math.cos(timestamp * 0.00042 + particle.phase) * particle.depth * 1.6 * motionScale;
    particle.renderY = particle.y + Math.sin(timestamp * 0.00036 + particle.phase) * particle.depth * 1.35 * motionScale;
  }
}

function drawWeb() {
  if (!context) return;

  context.shadowBlur = 0;
  const threshold = Math.min(145, Math.max(102, Math.min(width, height) * 0.14));
  const cellSize = threshold;
  const buckets = new Map();

  for (const particle of particles) {
    const column = Math.floor(particle.renderX / cellSize);
    const row = Math.floor(particle.renderY / cellSize);
    const key = `${column}:${row}`;
    const bucket = buckets.get(key) || [];
    bucket.push(particle);
    buckets.set(key, bucket);
  }

  for (const first of particles) {
    const column = Math.floor(first.renderX / cellSize);
    const row = Math.floor(first.renderY / cellSize);

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const nearby = buckets.get(`${column + offsetX}:${row + offsetY}`) || [];

        for (const second of nearby) {
          if (second.index <= first.index) continue;
          const distance = Math.hypot(first.renderX - second.renderX, first.renderY - second.renderY);
          if (distance >= threshold) continue;

          const depth = Math.min(first.depth, second.depth);
          const alpha = (1 - distance / threshold) * 0.2 * depth;
          context.strokeStyle = `rgba(166, 157, 255, ${alpha})`;
          context.lineWidth = 0.5 + depth * 0.38;
          context.beginPath();
          context.moveTo(first.renderX, first.renderY);
          context.lineTo(second.renderX, second.renderY);
          context.stroke();
        }
      }
    }
  }

  if (!pointer.down || coarsePointerMedia.matches) return;

  const nearby = particles
    .map((particle) => ({ particle, distance: Math.hypot(particle.renderX - pointer.x, particle.renderY - pointer.y) }))
    .filter((item) => item.distance < 225)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 7);

  for (const { particle, distance } of nearby) {
    context.strokeStyle = `rgba(207, 199, 255, ${(1 - distance / 225) * 0.3})`;
    context.lineWidth = 0.75;
    context.beginPath();
    context.moveTo(particle.renderX, particle.renderY);
    context.lineTo(pointer.x, pointer.y);
    context.stroke();
  }
}

function drawBackground(timestamp = 0, scheduleNext = true) {
  if (!canvas || !context) return;

  const delta = Math.min(2, Math.max(0.4, (timestamp - lastFrame) / 16.67));
  lastFrame = timestamp;
  context.clearRect(0, 0, width, height);
  updateParticles(delta, timestamp);

  const focusX = pointer.active ? pointer.x : width * (0.5 + Math.sin(timestamp * 0.00014) * 0.08);
  const focusY = pointer.active ? pointer.y : height * (0.43 + Math.cos(timestamp * 0.00012) * 0.06);
  const glow = context.createRadialGradient(focusX, focusY, 0, focusX, focusY, Math.max(width, height) * 0.58);
  glow.addColorStop(0, pointer.down ? 'rgba(151, 126, 255, 0.22)' : 'rgba(135, 109, 255, 0.15)');
  glow.addColorStop(0.38, 'rgba(44, 132, 213, 0.065)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  drawWeb();

  for (const particle of particles) {
    const pulse = 1 + Math.sin(timestamp * 0.0013 + particle.phase) * (reducedMotionMedia.matches ? 0 : 0.07);
    context.beginPath();
    context.fillStyle = `rgba(225, 229, 255, ${particle.alpha})`;
    context.shadowColor = `rgba(157, 147, 255, ${particle.alpha * 0.45})`;
    context.shadowBlur = lowPowerMode() ? 3 : 4 + particle.depth * 4;
    context.arc(particle.renderX, particle.renderY, particle.radius * pulse, 0, Math.PI * 2);
    context.fill();
  }

  context.shadowBlur = 0;
  ripples = ripples.filter((ripple) => ripple.alpha > 0.01);
  for (const ripple of ripples) {
    ripple.radius += ripple.speed * delta;
    ripple.alpha *= Math.pow(0.95, delta);
    context.strokeStyle = `rgba(198, 188, 255, ${ripple.alpha})`;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    context.stroke();
  }

  updateCardMotion(timestamp);
  updateButtonMotion();

  if (scheduleNext && !document.hidden && !reducedMotionMedia.matches) {
    animationFrame = window.requestAnimationFrame(drawBackground);
  }
}

function startAnimation() {
  if (!canvas || !context || reducedMotionMedia.matches || animationFrame || document.hidden) return;
  lastFrame = performance.now();
  animationFrame = window.requestAnimationFrame((timestamp) => {
    animationFrame = 0;
    drawBackground(timestamp);
  });
}

function stopAnimation() {
  if (!animationFrame) return;
  window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

function renderDescription(text) {
  const description = $('#profile-description');
  if (!description) return;

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
  if (!container) return;

  container.replaceChildren();

  for (const [index, item] of (Array.isArray(links) ? links : []).entries()) {
    if (!item?.url || !item?.label) continue;

    const stage = document.createElement('div');
    stage.className = 'link-stage';
    stage.style.setProperty('--float-delay', `${index * -0.55}s`);

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
    stage.append(anchor);
    container.append(stage);
  }

  refreshMotionStages();
}

async function fetchJson(path, fallback = null) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    return response.ok ? response.json() : fallback;
  } catch {
    return fallback;
  }
}

function configureGunsLink() {
  const dot = $('#guns-dot');
  const link = $('#guns-card');
  if (dot) dot.className = 'presence-dot unknown';
  if (link) {
    link.setAttribute('aria-label', 'Открыть guns.lol');
    link.title = 'Discord-статус не проверяется на этой странице';
  }
}

function renderSteamStatus(status, avatarOverride = '') {
  const player = status?.player;
  const statusNode = $('#profile-status');
  const avatar = $('#profile-avatar');

  if (!player) {
    if (statusNode) statusNode.textContent = 'Steam Tracker';
    return;
  }

  if (avatar && (avatarOverride || player.avatar)) {
    const nextAvatar = avatarOverride || player.avatar;
    if (avatar.src !== nextAvatar) avatar.src = nextAvatar;
    avatar.alt = 'Аватар Qu’lon';
  }

  if (!statusNode) return;
  if (player.gameName) statusNode.textContent = `Steam: ${player.gameName}`;
  else if (player.status === 'offline') statusNode.textContent = 'Steam: не в сети';
  else statusNode.textContent = 'Steam: в сети';
}

async function refreshSteamStatus(force = false) {
  const status = await fetchJson(`./data/status.json?v=${Date.now()}`);
  const version = status?.checkedAt || '';
  if (!force && version && version === lastProfileStatusVersion) return;

  lastProfileStatusVersion = version;
  renderSteamStatus(status);
}

async function loadProfile() {
  const [bio, status] = await Promise.all([
    fetchJson('./data/bio.json', {}),
    fetchJson(`./data/status.json?v=${Date.now()}`)
  ]);

  const name = $('#profile-name');
  const handle = $('#profile-handle');
  if (name) name.textContent = bio.displayName || 'Qu’lon';
  if (handle) handle.textContent = bio.handle || '@quixylon';
  renderDescription(bio.description);
  renderLinks(bio.links);

  lastProfileStatusVersion = status?.checkedAt || '';
  renderSteamStatus(status, bio.avatarUrl || '');
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  setPointer(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') return;
  pointer.down = true;
  setPointer(event.clientX, event.clientY);
  addRipple(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'touch') releasePointer();
}, { passive: true });
window.addEventListener('pointercancel', releasePointer, { passive: true });
window.addEventListener('pointerleave', releasePointer, { passive: true });

window.addEventListener('touchstart', (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;
  pointer.down = true;
  pointer.active = true;
  pointer.x = touch.clientX;
  pointer.y = touch.clientY;
  motion.lastTouchX = touch.clientX;
  motion.lastTouchY = touch.clientY;
  addRipple(touch.clientX, touch.clientY);
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;

  if (motion.lastTouchX !== null && motion.lastTouchY !== null) {
    addMotionImpulse(touch.clientX - motion.lastTouchX, touch.clientY - motion.lastTouchY, 0.1);
  }

  motion.lastTouchX = touch.clientX;
  motion.lastTouchY = touch.clientY;
  pointer.down = true;
  pointer.active = true;
  pointer.x = touch.clientX;
  pointer.y = touch.clientY;
}, { passive: true });

window.addEventListener('touchend', (event) => {
  if (event.touches?.length) return;
  releasePointer();
}, { passive: true });
window.addEventListener('touchcancel', releasePointer, { passive: true });

window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;
  const delta = currentScrollY - motion.lastScrollY;
  motion.lastScrollY = currentScrollY;
  addMotionImpulse(0, clamp(-delta * 0.09, -4.5, 4.5), 1);
}, { passive: true });

window.addEventListener('resize', () => {
  resizeCanvas();
  addMotionImpulse(0, 1.5, 1);
}, { passive: true });

window.addEventListener('focus', () => refreshSteamStatus());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAnimation();
    return;
  }

  refreshSteamStatus();
  startAnimation();
});

coarsePointerMedia.addEventListener?.('change', resizeCanvas);
reducedMotionMedia.addEventListener?.('change', () => {
  stopAnimation();
  resizeCanvas();
  startAnimation();
});

resizeCanvas();
refreshMotionStages();
configureGunsLink();
loadProfile();
startAnimation();
window.setInterval(refreshSteamStatus, 60_000);
