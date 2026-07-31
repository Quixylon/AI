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
let resizeFrame = 0;
let lastPaint = 0;

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
  const columns = Math.max(7, Math.ceil(Math.sqrt(count * aspect)));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const depth = Math.random() * 0.82 + 0.18;
  const homeX = (column + 0.5) * cellWidth + (Math.random() - 0.5) * cellWidth * 0.58;
  const homeY = (row + 0.5) * cellHeight + (Math.random() - 0.5) * cellHeight * 0.58;

  return {
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
    maxOffset: 72 + depth * 64
  };
}

function resizeCanvas() {
  resizeFrame = 0;
  const bounds = canvas.getBoundingClientRect();
  const mobile = coarsePointerMedia.matches || (bounds.width || window.innerWidth) < 700;

  pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.3);
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

  const areaCount = Math.round((width * height) / (mobile ? 18_000 : 14_000));
  const count = mobile
    ? Math.min(58, Math.max(38, areaCount))
    : Math.min(96, Math.max(64, areaCount));

  particles = Array.from({ length: count }, (_, index) => createParticle(index, count));
  lastPaint = performance.now();
}

function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(resizeCanvas);
}

function updateParticles(delta, timestamp) {
  const active = pointer.active && !mobileMode();
  const spring = active ? 0.025 : 0.075;
  const damping = active ? 0.905 : 0.82;
  const motionScale = reducedMotionMedia.matches ? 0.2 : 1;

  for (const particle of particles) {
    particle.phase += (0.006 + particle.depth * 0.004) * delta;
    particle.velocityX += (particle.homeX - particle.x) * spring * delta;
    particle.velocityY += (particle.homeY - particle.y) * spring * delta;

    if (active) {
      const originX = pointer.x - particle.homeX;
      const originY = pointer.y - particle.homeY;
      const originDistance = Math.hypot(originX, originY);
      const influence = (pointer.down ? 310 : 270) + particle.depth * 72;

      if (originDistance < influence) {
        const orbit = particle.orbitRadius * (pointer.down ? 0.88 : 1.05);
        const drift = timestamp * 0.00014 * (0.65 + particle.depth);
        const targetX = pointer.x + Math.cos(particle.orbitAngle + drift) * orbit;
        const targetY = pointer.y + Math.sin(particle.orbitAngle + drift) * orbit;
        const deltaX = targetX - particle.x;
        const deltaY = targetY - particle.y;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const proximity = 1 - originDistance / influence;
        const strength = proximity * (pointer.down ? 0.18 : 0.125) * (0.72 + particle.depth * 0.5);

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

    particle.renderX = particle.x
      + Math.cos(timestamp * 0.0005 + particle.phase) * particle.depth * 1.5 * motionScale;
    particle.renderY = particle.y
      + Math.sin(timestamp * 0.00042 + particle.phase) * particle.depth * 1.3 * motionScale;
  }
}

function drawParticleWeb() {
  const mobile = mobileMode();
  const threshold = mobile
    ? Math.min(132, Math.max(100, Math.min(width, height) * 0.145))
    : Math.min(158, Math.max(116, Math.min(width, height) * 0.155));
  const thresholdSquared = threshold * threshold;

  for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
    const first = particles[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
      const second = particles[secondIndex];
      const deltaX = first.renderX - second.renderX;
      const deltaY = first.renderY - second.renderY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared >= thresholdSquared) continue;

      const distance = Math.sqrt(distanceSquared);
      const depth = Math.min(first.depth, second.depth);
      const alpha = (1 - distance / threshold) * (mobile ? 0.14 : 0.23) * depth;

      context.strokeStyle = `rgba(178, 169, 255, ${alpha})`;
      context.lineWidth = mobile ? 0.58 : 0.58 + depth * 0.42;
      context.beginPath();
      context.moveTo(first.renderX, first.renderY);
      context.lineTo(second.renderX, second.renderY);
      context.stroke();
    }
  }
}

function drawPointerLines() {
  if (!pointer.active || mobileMode()) return;

  const reach = pointer.down ? 300 : 270;
  const reachSquared = reach * reach;
  const maximumLines = pointer.down ? 14 : 10;
  const nearby = [];

  for (const particle of particles) {
    const deltaX = particle.renderX - pointer.x;
    const deltaY = particle.renderY - pointer.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared >= reachSquared) continue;

    nearby.push({ particle, distance: Math.sqrt(distanceSquared) });
  }

  nearby.sort((first, second) => first.distance - second.distance);
  nearby.length = Math.min(nearby.length, maximumLines);

  for (const { particle, distance } of nearby) {
    const proximity = 1 - distance / reach;
    const alpha = proximity * (pointer.down ? 0.52 : 0.38);

    context.strokeStyle = `rgba(211, 204, 255, ${alpha})`;
    context.lineWidth = pointer.down ? 1.08 : 0.86;
    context.beginPath();
    context.moveTo(particle.renderX, particle.renderY);
    context.lineTo(pointer.x, pointer.y);
    context.stroke();
  }

  const radius = pointer.down ? 31 : 23;
  const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
  glow.addColorStop(0, pointer.down ? 'rgba(230, 224, 255, 0.62)' : 'rgba(218, 211, 255, 0.46)');
  glow.addColorStop(1, 'rgba(154, 137, 255, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawParticles(timestamp) {
  const mobile = mobileMode();

  context.shadowColor = mobile
    ? 'rgba(167, 155, 255, 0.32)'
    : 'rgba(167, 155, 255, 0.5)';
  context.shadowBlur = mobile ? 3 : 6;

  for (const particle of particles) {
    const pulse = 1 + Math.sin(timestamp * 0.0014 + particle.phase)
      * (reducedMotionMedia.matches ? 0.02 : 0.08);

    context.beginPath();
    context.fillStyle = `rgba(230, 233, 255, ${particle.alpha * (mobile ? 0.78 : 0.94)})`;
    context.arc(particle.renderX, particle.renderY, particle.radius * pulse, 0, Math.PI * 2);
    context.fill();
  }

  context.shadowBlur = 0;
}

function frameInterval() {
  if (reducedMotionMedia.matches) return 1000 / 18;
  if (mobileMode()) return 1000 / 24;
  return pointer.active ? 1000 / 40 : 1000 / 30;
}

function animate(timestamp = 0) {
  const interval = frameInterval();
  const elapsed = timestamp - lastPaint;

  if (!document.hidden && elapsed >= interval) {
    const delta = Math.min(2.1, Math.max(0.4, elapsed / 16.67));
    lastPaint = timestamp;

    context.clearRect(0, 0, width, height);
    updateParticles(delta, timestamp);
    drawParticleWeb();
    drawPointerLines();
    drawParticles(timestamp);
  } else if (document.hidden) {
    lastPaint = timestamp;
  }

  requestAnimationFrame(animate);
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
coarsePointerMedia.addEventListener?.('change', scheduleResize);
reducedMotionMedia.addEventListener?.('change', scheduleResize);

document.addEventListener('visibilitychange', () => {
  lastPaint = performance.now();
});

resizeCanvas();
requestAnimationFrame(animate);
