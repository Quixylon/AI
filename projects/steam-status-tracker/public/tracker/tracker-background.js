const canvas = document.querySelector('#tracker-background');
const context = canvas?.getContext('2d', { alpha: true, desynchronized: true });

if (!canvas || !context) {
  throw new Error('Tracker background canvas is unavailable');
}

const coarsePointerMedia = window.matchMedia('(hover: none), (pointer: coarse)');
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

let width = 0;
let height = 0;
let pixelRatio = 1;
let particles = [];
let animationFrame = 0;
let resizeFrame = 0;
let lastFrame = performance.now();
let lastRenderedAt = 0;

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false
};

function clampCoordinate(value, limit) {
  return Math.min(Math.max(value, 0), Math.max(limit, 0));
}

function mobileMode() {
  return coarsePointerMedia.matches || width < 700;
}

function setPointerFromClient(clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = width / Math.max(bounds.width, 1);
  const scaleY = height / Math.max(bounds.height, 1);

  pointer.x = clampCoordinate((clientX - bounds.left) * scaleX, width);
  pointer.y = clampCoordinate((clientY - bounds.top) * scaleY, height);
}

function createParticle(index, count) {
  const aspect = Math.max(0.55, width / Math.max(height, 1));
  const columns = Math.max(6, Math.ceil(Math.sqrt(count * aspect)));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const depth = Math.random() * 0.82 + 0.18;
  const homeX = (column + 0.5) * cellWidth + (Math.random() - 0.5) * cellWidth * 0.58;
  const homeY = (row + 0.5) * cellHeight + (Math.random() - 0.5) * cellHeight * 0.58;

  return {
    index,
    x: homeX,
    y: homeY,
    homeX,
    homeY,
    renderX: homeX,
    renderY: homeY,
    velocityX: 0,
    velocityY: 0,
    depth,
    radius: 0.8 + depth * 1.65,
    alpha: 0.34 + depth * 0.48,
    phase: Math.random() * Math.PI * 2,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitRadius: 15 + Math.random() * 38,
    maxOffset: 65 + depth * 60
  };
}

function resizeCanvas() {
  resizeFrame = 0;
  const bounds = canvas.getBoundingClientRect();
  const mobile = coarsePointerMedia.matches || (bounds.width || window.innerWidth) < 700;

  pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
  width = Math.max(1, Math.round(bounds.width || window.innerWidth));
  height = Math.max(1, Math.round(bounds.height || window.innerHeight));

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  pointer.x = width / 2;
  pointer.y = height / 2;
  pointer.active = false;
  pointer.down = false;

  const areaCount = Math.round((width * height) / (mobile ? 17_000 : 12_000));
  const count = mobile
    ? Math.min(50, Math.max(30, areaCount))
    : Math.min(100, Math.max(58, areaCount));

  particles = Array.from({ length: count }, (_, index) => createParticle(index, count));
  lastFrame = performance.now();
  lastRenderedAt = 0;

  if (reducedMotionMedia.matches) renderFrame(performance.now());
}

function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(resizeCanvas);
}

function updateParticles(delta, timestamp) {
  const active = pointer.active && !mobileMode() && !reducedMotionMedia.matches;
  const spring = active ? 0.025 : 0.075;
  const damping = active ? 0.905 : 0.82;
  const motionScale = reducedMotionMedia.matches ? 0 : 1;

  for (const particle of particles) {
    particle.phase += (0.006 + particle.depth * 0.004) * delta;
    particle.velocityX += (particle.homeX - particle.x) * spring * delta;
    particle.velocityY += (particle.homeY - particle.y) * spring * delta;

    if (active) {
      const originDistance = Math.hypot(pointer.x - particle.homeX, pointer.y - particle.homeY);
      const influence = (pointer.down ? 310 : 270) + particle.depth * 80;

      if (originDistance < influence) {
        const orbit = particle.orbitRadius * (pointer.down ? 0.88 : 1.08);
        const drift = timestamp * 0.00014 * (0.65 + particle.depth);
        const targetX = pointer.x + Math.cos(particle.orbitAngle + drift) * orbit;
        const targetY = pointer.y + Math.sin(particle.orbitAngle + drift) * orbit;
        const deltaX = targetX - particle.x;
        const deltaY = targetY - particle.y;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const proximity = 1 - originDistance / influence;
        const strength = proximity * (pointer.down ? 0.17 : 0.12) * (0.72 + particle.depth * 0.55);

        particle.velocityX += (deltaX / distance) * strength * delta;
        particle.velocityY += (deltaY / distance) * strength * delta;
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
      particle.velocityX *= 0.4;
      particle.velocityY *= 0.4;
    }

    particle.renderX = particle.x + Math.cos(timestamp * 0.0005 + particle.phase) * particle.depth * 1.7 * motionScale;
    particle.renderY = particle.y + Math.sin(timestamp * 0.00042 + particle.phase) * particle.depth * 1.45 * motionScale;
  }
}

function drawParticleWeb() {
  const mobile = mobileMode();
  const threshold = mobile
    ? Math.min(128, Math.max(98, Math.min(width, height) * 0.145))
    : Math.min(155, Math.max(112, Math.min(width, height) * 0.15));
  const buckets = new Map();

  for (const particle of particles) {
    const column = Math.floor(particle.renderX / threshold);
    const row = Math.floor(particle.renderY / threshold);
    const key = `${column}:${row}`;
    const bucket = buckets.get(key) || [];
    bucket.push(particle);
    buckets.set(key, bucket);
  }

  for (const first of particles) {
    const column = Math.floor(first.renderX / threshold);
    const row = Math.floor(first.renderY / threshold);

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const nearby = buckets.get(`${column + offsetX}:${row + offsetY}`) || [];

        for (const second of nearby) {
          if (second.index <= first.index) continue;
          const distance = Math.hypot(first.renderX - second.renderX, first.renderY - second.renderY);
          if (distance >= threshold) continue;

          const depth = Math.min(first.depth, second.depth);
          const alpha = (1 - distance / threshold) * (mobile ? 0.14 : 0.22) * depth;
          context.strokeStyle = `rgba(178, 169, 255, ${alpha})`;
          context.lineWidth = mobile ? 0.58 : 0.58 + depth * 0.42;
          context.beginPath();
          context.moveTo(first.renderX, first.renderY);
          context.lineTo(second.renderX, second.renderY);
          context.stroke();
        }
      }
    }
  }
}

function drawPointerLines() {
  if (!pointer.active || mobileMode() || reducedMotionMedia.matches) return;

  const reach = pointer.down ? 300 : 270;
  const maximumLines = pointer.down ? 13 : 10;
  const nearby = particles
    .map((particle) => ({
      particle,
      distance: Math.hypot(particle.renderX - pointer.x, particle.renderY - pointer.y)
    }))
    .filter((item) => item.distance < reach)
    .sort((first, second) => first.distance - second.distance)
    .slice(0, maximumLines);

  for (const { particle, distance } of nearby) {
    const proximity = 1 - distance / reach;
    const alpha = proximity * (pointer.down ? 0.5 : 0.36);
    const gradient = context.createLinearGradient(
      particle.renderX,
      particle.renderY,
      pointer.x,
      pointer.y
    );
    gradient.addColorStop(0, `rgba(178, 168, 255, ${alpha * 0.55})`);
    gradient.addColorStop(1, `rgba(225, 219, 255, ${alpha})`);

    context.strokeStyle = gradient;
    context.lineWidth = pointer.down ? 1.05 : 0.85;
    context.beginPath();
    context.moveTo(particle.renderX, particle.renderY);
    context.lineTo(pointer.x, pointer.y);
    context.stroke();
  }
}

function drawParticles(timestamp) {
  const mobile = mobileMode();

  for (const particle of particles) {
    const pulse = 1 + Math.sin(timestamp * 0.0014 + particle.phase) * (reducedMotionMedia.matches ? 0 : 0.08);
    context.beginPath();
    context.fillStyle = `rgba(230, 233, 255, ${particle.alpha * (mobile ? 0.8 : 1)})`;
    context.shadowColor = `rgba(167, 155, 255, ${particle.alpha * (mobile ? 0.36 : 0.58)})`;
    context.shadowBlur = mobile ? 3 : 4 + particle.depth * 5;
    context.arc(particle.renderX, particle.renderY, particle.radius * pulse, 0, Math.PI * 2);
    context.fill();
  }

  context.shadowBlur = 0;
}

function renderFrame(timestamp) {
  const delta = Math.min(2.1, Math.max(0.4, (timestamp - lastFrame) / 16.67));
  lastFrame = timestamp;

  context.clearRect(0, 0, width, height);
  updateParticles(delta, timestamp);
  drawParticleWeb();
  drawPointerLines();
  drawParticles(timestamp);
}

function animate(timestamp = 0) {
  animationFrame = 0;
  if (document.hidden || reducedMotionMedia.matches) return;

  const minimumFrameTime = mobileMode() ? 1000 / 30 : 0;
  if (!minimumFrameTime || timestamp - lastRenderedAt >= minimumFrameTime) {
    lastRenderedAt = timestamp;
    renderFrame(timestamp);
  }

  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (animationFrame || document.hidden || reducedMotionMedia.matches) return;
  lastFrame = performance.now();
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (!animationFrame) return;
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' || coarsePointerMedia.matches) return;
  setPointerFromClient(event.clientX, event.clientY);
  pointer.active = true;
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' || coarsePointerMedia.matches) return;
  setPointerFromClient(event.clientX, event.clientY);
  pointer.active = true;
  pointer.down = true;
}, { passive: true });

window.addEventListener('pointerup', () => {
  pointer.down = false;
}, { passive: true });

window.addEventListener('pointercancel', () => {
  pointer.down = false;
  pointer.active = false;
}, { passive: true });

window.addEventListener('pointerleave', (event) => {
  if (event.pointerType !== 'touch') pointer.active = false;
}, { passive: true });

window.addEventListener('blur', () => {
  pointer.down = false;
  pointer.active = false;
}, { passive: true });

window.addEventListener('resize', scheduleResize, { passive: true });
window.addEventListener('orientationchange', scheduleResize, { passive: true });
window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAnimation();
  else startAnimation();
});

coarsePointerMedia.addEventListener?.('change', scheduleResize);
reducedMotionMedia.addEventListener?.('change', () => {
  stopAnimation();
  resizeCanvas();
  startAnimation();
});

resizeCanvas();
startAnimation();
