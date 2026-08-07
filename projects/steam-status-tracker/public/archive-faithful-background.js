(() => {
  'use strict';

  const Q = window.QPolish = window.QPolish || {};
  const canvas = document.getElementById('particleCanvas');
  const context = canvas?.getContext('2d', { alpha: true, desynchronized: true });
  const coarse = matchMedia('(hover:none),(pointer:coarse)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');

  function installArchiveLayers() {
    const layers = [
      ['archive-fallback-stars archive-fallback-stars-one'],
      ['archive-fallback-stars archive-fallback-stars-two'],
      ['archive-aurora archive-aurora-one'],
      ['archive-aurora archive-aurora-two'],
      ['archive-noise'],
      ['archive-vignette']
    ];

    for (const [className] of layers) {
      const primary = className.split(' ')[0];
      const qualifier = className.split(' ')[1];
      const selector = qualifier ? `.${primary}.${qualifier}` : `.${primary}`;
      if (document.querySelector(selector)) continue;
      const layer = document.createElement('div');
      layer.className = className;
      layer.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(layer, document.querySelector('.app-shell') || document.body.firstChild);
    }
  }

  installArchiveLayers();

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let particles = [];
  let animationFrame = 0;
  let lastFrame = performance.now();

  const pointer = {
    x: innerWidth / 2,
    y: innerHeight / 2,
    active: false,
    down: false
  };

  const lowPowerMode = () => coarse.matches || reduced.matches || width < 700;

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

    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    pixelRatio = Math.min(devicePixelRatio || 1, lowPowerMode() ? 1.25 : 1.75);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const areaCount = Math.round((width * height) / (lowPowerMode() ? 13000 : 9000));
    const count = lowPowerMode()
      ? Math.min(68, Math.max(36, areaCount))
      : Math.min(142, Math.max(72, areaCount));

    particles = Array.from({ length: count }, (_, index) => createParticle(index, count));
    lastFrame = performance.now();
    if (reduced.matches) drawBackground(performance.now(), false);
  }

  function updateParticles(delta, timestamp) {
    const spring = pointer.down ? 0.018 : 0.058;
    const damping = pointer.down ? 0.92 : 0.82;
    const motionScale = reduced.matches ? 0 : 1;

    for (const particle of particles) {
      particle.phase += (0.005 + particle.depth * 0.003) * delta;
      particle.velocityX += (particle.homeX - particle.x) * spring * delta;
      particle.velocityY += (particle.homeY - particle.y) * spring * delta;

      if (pointer.down) {
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
      } else if (pointer.active && !coarse.matches) {
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

  // User-requested deviation: unlike the archived drawWeb(), particles never link to other particles.
  // During a press, only the nearest particles link to the pointer itself.
  function drawPointerLines() {
    if (!context || !pointer.active || !pointer.down) return;

    const nearby = particles
      .map((particle) => ({ particle, distance: Math.hypot(particle.renderX - pointer.x, particle.renderY - pointer.y) }))
      .filter((item) => item.distance < 225)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 7);

    for (const { particle, distance } of nearby) {
      context.strokeStyle = `rgba(207, 199, 255, ${(1 - distance / 225) * 0.3})`;
      context.lineWidth = 1.15;
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

    drawPointerLines();

    for (const particle of particles) {
      const pulse = 1 + Math.sin(timestamp * 0.0013 + particle.phase) * (reduced.matches ? 0 : 0.07);
      context.beginPath();
      context.fillStyle = `rgba(225, 229, 255, ${particle.alpha})`;
      context.shadowColor = `rgba(157, 147, 255, ${particle.alpha * 0.45})`;
      context.shadowBlur = lowPowerMode() ? 3 : 4 + particle.depth * 4;
      context.arc(particle.renderX, particle.renderY, particle.radius * pulse, 0, Math.PI * 2);
      context.fill();
    }

    context.shadowBlur = 0;

    if (scheduleNext && !document.hidden && !reduced.matches) {
      animationFrame = requestAnimationFrame(drawBackground);
    }
  }

  function start() {
    if (!canvas || !context || reduced.matches || animationFrame || document.hidden) return;
    lastFrame = performance.now();
    animationFrame = requestAnimationFrame((timestamp) => {
      animationFrame = 0;
      drawBackground(timestamp);
    });
  }

  function stop() {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  }, { passive: true });

  addEventListener('pointerdown', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    pointer.down = true;
  }, { passive: true });

  addEventListener('pointerup', () => { pointer.down = false; }, { passive: true });
  addEventListener('pointercancel', () => { pointer.down = false; pointer.active = false; }, { passive: true });
  addEventListener('pointerleave', () => { pointer.down = false; pointer.active = false; }, { passive: true });

  addEventListener('touchstart', (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    pointer.x = touch.clientX;
    pointer.y = touch.clientY;
    pointer.active = true;
    pointer.down = true;
  }, { passive: true });

  addEventListener('touchmove', (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    pointer.x = touch.clientX;
    pointer.y = touch.clientY;
    pointer.active = true;
    pointer.down = true;
  }, { passive: true });

  addEventListener('touchend', () => { pointer.down = false; pointer.active = false; }, { passive: true });
  addEventListener('touchcancel', () => { pointer.down = false; pointer.active = false; }, { passive: true });
  addEventListener('resize', resizeCanvas, { passive: true });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

  resizeCanvas();
  start();

  if (Q.refraction) Q.refraction.source = canvas;
  Q.archiveBackground = { canvas, start, stop, resize: resizeCanvas };
})();