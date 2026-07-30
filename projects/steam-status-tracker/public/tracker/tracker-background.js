const canvas = document.querySelector('#tracker-background');
const context = canvas.getContext('2d', { alpha: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let width = 0;
let height = 0;
let ratio = 1;
let particles = [];
let lastFrame = performance.now();

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false
};

function createParticle() {
  const depth = Math.random() * 0.8 + 0.2;
  const angle = Math.random() * Math.PI * 2;
  const speed = reducedMotion ? 0 : 0.045 + depth * 0.1;

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    depth,
    radius: 0.7 + depth * 1.45,
    alpha: 0.22 + depth * 0.4,
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
    phase: Math.random() * Math.PI * 2
  };
}

function resize() {
  ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = Math.min(145, Math.max(82, Math.round((width * height) / 10_500)));
  particles = Array.from({ length: count }, createParticle);
}

function update(delta, timestamp) {
  for (const particle of particles) {
    particle.phase += 0.004 * delta;

    if (pointer.active) {
      const deltaX = pointer.x - particle.x;
      const deltaY = pointer.y - particle.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const influence = 225 + particle.depth * 80;

      if (distance < influence) {
        const proximity = 1 - distance / influence;
        const force = proximity * proximity * 0.019 * particle.depth;
        particle.velocityX += (deltaX / distance) * force * delta;
        particle.velocityY += (deltaY / distance) * force * delta;
      }
    }

    particle.velocityX *= Math.pow(pointer.active ? 0.986 : 0.993, delta);
    particle.velocityY *= Math.pow(pointer.active ? 0.986 : 0.993, delta);
    particle.x += (particle.velocityX + Math.cos(timestamp * 0.00035 + particle.phase) * 0.018) * delta;
    particle.y += (particle.velocityY + Math.sin(timestamp * 0.0003 + particle.phase) * 0.016) * delta;

    if (particle.x < -15) particle.x = width + 15;
    if (particle.x > width + 15) particle.x = -15;
    if (particle.y < -15) particle.y = height + 15;
    if (particle.y > height + 15) particle.y = -15;
  }
}

function drawLines() {
  const threshold = 148;

  for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
    const first = particles[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
      const second = particles[secondIndex];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (distance >= threshold) continue;

      const alpha = (1 - distance / threshold) * 0.16 * Math.min(first.depth, second.depth);
      context.strokeStyle = `rgba(166, 158, 255, ${alpha})`;
      context.lineWidth = 0.62;
      context.beginPath();
      context.moveTo(first.x, first.y);
      context.lineTo(second.x, second.y);
      context.stroke();
    }
  }
}

function drawPointerWeb() {
  if (!pointer.active) return;

  const radius = 285;
  const nearest = particles
    .map((particle) => ({
      particle,
      distance: Math.hypot(particle.x - pointer.x, particle.y - pointer.y)
    }))
    .filter(({ distance }) => distance < radius)
    .sort((first, second) => first.distance - second.distance)
    .slice(0, 14);

  for (const { particle, distance } of nearest) {
    const alpha = (1 - distance / radius) * 0.34 * particle.depth;
    context.strokeStyle = `rgba(197, 191, 255, ${alpha})`;
    context.lineWidth = 0.78 + particle.depth * 0.24;
    context.beginPath();
    context.moveTo(particle.x, particle.y);
    context.lineTo(pointer.x, pointer.y);
    context.stroke();
  }

  const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 34);
  glow.addColorStop(0, 'rgba(207, 201, 255, 0.18)');
  glow.addColorStop(1, 'rgba(207, 201, 255, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(pointer.x, pointer.y, 34, 0, Math.PI * 2);
  context.fill();
}

function drawParticles(timestamp) {
  for (const particle of particles) {
    const pulse = 1 + Math.sin(timestamp * 0.0012 + particle.phase) * 0.1;
    context.beginPath();
    context.fillStyle = `rgba(226, 230, 255, ${particle.alpha})`;
    context.shadowColor = `rgba(153, 142, 255, ${particle.alpha * 0.62})`;
    context.shadowBlur = 5 + particle.depth * 6;
    context.arc(particle.x, particle.y, particle.radius * pulse, 0, Math.PI * 2);
    context.fill();
  }

  context.shadowBlur = 0;
}

function animate(timestamp = 0) {
  const delta = Math.min(2, Math.max(0.4, (timestamp - lastFrame) / 16.67));
  lastFrame = timestamp;
  context.clearRect(0, 0, width, height);

  update(delta, timestamp);
  drawLines();
  drawPointerWeb();
  drawParticles(timestamp);
  requestAnimationFrame(animate);
}

function activatePointer(clientX, clientY) {
  pointer.x = clientX;
  pointer.y = clientY;
  pointer.active = true;
}

window.addEventListener('pointermove', (event) => {
  activatePointer(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  activatePointer(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerleave', () => {
  pointer.active = false;
}, { passive: true });

window.addEventListener('touchstart', (event) => {
  const touch = event.touches?.[0];
  if (touch) activatePointer(touch.clientX, touch.clientY);
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  const touch = event.touches?.[0];
  if (touch) activatePointer(touch.clientX, touch.clientY);
}, { passive: true });

window.addEventListener('touchend', () => {
  pointer.active = false;
}, { passive: true });

window.addEventListener('resize', resize, { passive: true });

resize();
requestAnimationFrame(animate);
