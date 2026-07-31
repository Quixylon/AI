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
let lastFrame = performance.now();
let resizeFrame = 0;

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false,
  type: 'mouse'
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
    radius: 0.85 + depth * 1.85,
    alpha: 0.38 + depth * 0.52,
    phase: Math.random() * Math.PI * 2,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitRadius: 15 + Math.random() * 42,
    maxOffset: 78 + depth * 72
  };
}

function resizeCanvas() {
  resizeFrame = 0;
  const bounds = canvas.getBoundingClientRect();
  const mobile = coarsePointerMedia.matches || (bounds.width || window.innerWidth) < 700;

  pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
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

  const areaCount = Math.round((width * height) / (mobile ? 11_500 : 7_600));
  const count = mobile
    ? Math.min(88, Math.max(56, areaCount))
    : Math.min(170, Math.max(105, areaCount));

  particles = Array.from({ length: count }, (_, index) => createParticle(index, count));
  lastFrame = performance.now();
}

function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(resizeCanvas);
}

function updateParticles(delta, timestamp) {
  const active = pointer.active && !mobileMode();
  const spring = active ? 0.025 : 0.075;
  const damping = active ? 0.905 : 0.82;

  for (const particle of particles) {
    particle.phase += (0.006 + particle.depth * 0.004) * delta;
    particle.velocityX += (particle.homeX - particle.x) * spring * delta;
    particle.velocityY += (particle.homeY - particle.y) * spring * delta;

    if (active) {
      const originDistance = Math.hypot(pointer.x - particle.homeX, pointer.y - particle.homeY);
      const influence = (pointer.down ? 330 : 285) + particle.depth * 85;

      if (originDistance < influence) {
        const orbitScale = pointer.down ? 0.88 : 1.08;
        const orbit = particle.orbitRadius * orbitScale;
        const drift = timestamp * 0.00014 * (0.65 + particle.depth);
        const targetX = pointer.x + Math.cos(particle.orbitAngle + drift) * orbit;
        const targetY = pointer.y + Math.sin(particle.orbitAngle + drift) * orbit;
        const deltaX = targetX - particle.x;
        const deltaY = targetY - particle.y;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const proximity = 1 - originDistance / influence;
        const strength = proximity * (pointer.down ? 0.19 : 0.135) * (0.72 + particle.depth * 0.55);

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

    const motionScale = reducedMotionMedia.matches ? 0.2 : 1;
    particle.renderX = particle.x + Math.cos(timestamp * 0.0005 + particle.phase) * particle.depth * 1.7 * motionScale;
    particle.renderY = particle.y + Math.sin(timestamp * 0.00042 + particle.phase) * particle.depth * 1.45 * motionScale;
  }
}

function drawParticleWeb() {
  const mobile = mobileMode();
  const threshold = mobile
    ? Math.min(135, Math.max(102, Math.min(width, height) * 0.15))
    : Math.min(165, Math.max(120, Math.min(width, height) * 0.16));

  for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
    const first = particles[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
      const second = particles[secondIndex];
      const distance = Math.hypot(first.renderX - second.renderX, first.renderY - second.renderY);
      if (distance >= threshold) continue;

      const depth = Math.min(first.depth, second.depth);
      const alpha = (1 - distance / threshold) * (mobile ? 0.16 : 0.27) * depth;
      context.strokeStyle = `rgba(178, 169, 255, ${alpha})`;
      context.lineWidth = mobile ? 0.62 : 0.62 + depth * 0.48;
      context.beginPath();
      context.moveTo(first.renderX, first.renderY);
      context.lineTo(second.renderX, second.renderY);
      context.stroke();
    }
  }
}

function drawPointerLines() {
  if (!pointer.active || mobileMode()) return;

  const reach = pointer.down ? 315 : 285;
  const maximumLines = pointer.down ? 17 : 13;
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
    const alpha = proximity * (pointer.down ? 0.58 : 0.43);
    const gradient = context.createLinearGradient(
      particle.renderX,
      particle.renderY,
      pointer.x,
      pointer.y
    );
    gradient.addColorStop(0, `rgba(178, 168, 255, ${alpha * 0.55})`);
    gradient.addColorStop(1, `rgba(225, 219, 255, ${alpha})`);

    context.strokeStyle = gradient;
    context.lineWidth = pointer.down ? 1.18 : 0.92;
    context.beginPath();
    context.moveTo(particle.renderX, particle.renderY);
    context.lineTo(pointer.x, pointer.y);
    context.stroke();
  }

  const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, pointer.down ? 34 : 25);
  glow.addColorStop(0, pointer.down ? 'rgba(230, 224, 255, 0.68)' : 'rgba(218, 211, 255, 0.52)');
  glow.addColorStop(1, 'rgba(154, 137, 255, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(pointer.x, pointer.y, pointer.down ? 34 : 25, 0, Math.PI * 2);
  context.fill();
}

function drawParticles(timestamp) {
  const mobile = mobileMode();

  for (const particle of particles) {
    const pulse = 1 + Math.sin(timestamp * 0.0014 + particle.phase) * (reducedMotionMedia.matches ? 0.02 : 0.1);
    context.beginPath();
    context.fillStyle = `rgba(230, 233, 255, ${particle.alpha * (mobile ? 0.82 : 1)})`;
    context.shadowColor = `rgba(167, 155, 255, ${particle.alpha * (mobile ? 0.42 : 0.68)})`;
    context.shadowBlur = mobile ? 4 : 5 + particle.depth * 7;
    context.arc(particle.renderX, particle.renderY, particle.radius * pulse, 0, Math.PI * 2);
    context.fill();
  }

  context.shadowBlur = 0;
}

function animate(timestamp = 0) {
  const delta = Math.min(2.1, Math.max(0.4, (timestamp - lastFrame) / 16.67));
  lastFrame = timestamp;

  if (!document.hidden) {
    context.clearRect(0, 0, width, height);
    updateParticles(delta, timestamp);
    drawParticleWeb();
    drawPointerLines();
    drawParticles(timestamp);
  }

  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' || coarsePointerMedia.matches) return;
  setPointerFromClient(event.clientX, event.clientY);
  pointer.active = true;
  pointer.type = event.pointerType || 'mouse';
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' || coarsePointerMedia.matches) return;
  setPointerFromClient(event.clientX, event.clientY);
  pointer.active = true;
  pointer.down = true;
  pointer.type = event.pointerType || 'mouse';
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

resizeCanvas();
requestAnimationFrame(animate);
