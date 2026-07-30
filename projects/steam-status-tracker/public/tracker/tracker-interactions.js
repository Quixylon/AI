const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const SELECTOR = [
  '.back-link',
  '.avatar',
  '.status-pill',
  '.detail-card',
  '.csrep-button',
  '.game-summary-card',
  '.game-session-icon',
  '.game-badge',
  '.history-marker',
  '.history-badge'
].join(', ');

const motion = {
  impulseX: 0,
  impulseY: 0,
  sensorX: 0,
  sensorY: 0,
  orientationX: 0,
  orientationY: 0,
  lastPointerX: null,
  lastPointerY: null,
  lastTouchX: null,
  lastTouchY: null,
  lastScrollY: window.scrollY,
  permissionRequested: false
};

let items = [];
const itemStates = new WeakMap();
const boundItems = new WeakSet();

function addImpulse(deltaX, deltaY, strength = 1) {
  motion.impulseX = clamp(motion.impulseX - deltaX * strength, -8, 8);
  motion.impulseY = clamp(motion.impulseY - deltaY * strength, -8, 8);
}

function screenAdjustedVector(x, y) {
  const angle = Number(screen.orientation?.angle ?? window.orientation ?? 0);

  if (angle === 90) return { x: -y, y: x };
  if (angle === 270 || angle === -90) return { x: y, y: -x };
  if (Math.abs(angle) === 180) return { x: -x, y: -y };
  return { x, y };
}

async function requestMotionAccess() {
  if (motion.permissionRequested) return;
  motion.permissionRequested = true;

  const requests = [];

  if (typeof window.DeviceMotionEvent?.requestPermission === 'function') {
    requests.push(window.DeviceMotionEvent.requestPermission());
  }

  if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
    requests.push(window.DeviceOrientationEvent.requestPermission());
  }

  if (requests.length) await Promise.allSettled(requests);
}

function stateFor(item, index) {
  if (!itemStates.has(item)) {
    itemStates.set(item, {
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      localX: 0,
      localY: 0,
      targetLocalX: 0,
      targetLocalY: 0,
      depth: 0.56 + (index % 6) * 0.075,
      phase: Math.random() * Math.PI * 2
    });
  }

  return itemStates.get(item);
}

function bindLocalInteraction(item, index) {
  if (boundItems.has(item)) return;
  boundItems.add(item);

  const state = stateFor(item, index);

  item.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;

    const bounds = item.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const normalizedX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const normalizedY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);

    state.targetLocalX = (normalizedX - 0.5) * 2.8;
    state.targetLocalY = (normalizedY - 0.5) * 2.2;
    item.style.setProperty('--interaction-x', `${(normalizedX * 100).toFixed(1)}%`);
    item.style.setProperty('--interaction-y', `${(normalizedY * 100).toFixed(1)}%`);
  }, { passive: true });

  item.addEventListener('pointerleave', () => {
    state.targetLocalX = 0;
    state.targetLocalY = 0;
    item.style.setProperty('--interaction-x', '50%');
    item.style.setProperty('--interaction-y', '50%');
  }, { passive: true });

  item.addEventListener('pointerdown', () => {
    item.classList.add('is-pressed');
  }, { passive: true });

  item.addEventListener('pointerup', () => {
    item.classList.remove('is-pressed');
  }, { passive: true });

  item.addEventListener('pointercancel', () => {
    item.classList.remove('is-pressed');
  }, { passive: true });
}

function refreshItems() {
  items = [...document.querySelectorAll(SELECTOR)];

  items.forEach((item, index) => {
    item.classList.add('tracker-motion-item');
    item.style.setProperty('--interaction-x', '50%');
    item.style.setProperty('--interaction-y', '50%');
    stateFor(item, index);
    bindLocalInteraction(item, index);
  });
}

function handleDeviceMotion(event) {
  const acceleration = event.accelerationIncludingGravity;
  if (!acceleration) return;

  const rawX = Number(acceleration.x);
  const rawY = Number(acceleration.y);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;

  const adjusted = screenAdjustedVector(rawX, rawY);
  const targetX = clamp(-adjusted.x * 0.58, -5, 5);
  const targetY = clamp(adjusted.y * 0.4, -4, 4);

  motion.sensorX += (targetX - motion.sensorX) * 0.11;
  motion.sensorY += (targetY - motion.sensorY) * 0.11;
}

function handleDeviceOrientation(event) {
  if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;

  const horizontal = clamp(-event.gamma / 45, -1, 1) * 3.2;
  const vertical = clamp((event.beta - 45) / 55, -1, 1) * 2.35;

  motion.orientationX += (horizontal - motion.orientationX) * 0.08;
  motion.orientationY += (vertical - motion.orientationY) * 0.08;
}

function animate(timestamp = 0) {
  motion.impulseX *= 0.9;
  motion.impulseY *= 0.9;

  const ambientX = Math.sin(timestamp * 0.00042) * 0.24;
  const ambientY = Math.cos(timestamp * 0.00036) * 0.2;
  const baseX = clamp(motion.sensorX + motion.orientationX + motion.impulseX + ambientX, -7, 7);
  const baseY = clamp(motion.sensorY + motion.orientationY + motion.impulseY + ambientY, -6, 6);

  items.forEach((item, index) => {
    const state = stateFor(item, index);
    const localEasing = 0.11;
    state.localX += (state.targetLocalX - state.localX) * localEasing;
    state.localY += (state.targetLocalY - state.localY) * localEasing;

    const idleX = Math.sin(timestamp * 0.0005 + state.phase) * 0.22;
    const idleY = Math.cos(timestamp * 0.00044 + state.phase) * 0.18;
    const targetX = baseX * state.depth + state.localX + idleX;
    const targetY = baseY * state.depth + state.localY + idleY;
    const spring = 0.025 + (index % 4) * 0.003;
    const damping = 0.86 - (index % 3) * 0.012;

    state.velocityX += (targetX - state.x) * spring;
    state.velocityY += (targetY - state.y) * spring;
    state.velocityX *= damping;
    state.velocityY *= damping;
    state.x += state.velocityX;
    state.y += state.velocityY;

    state.x = clamp(state.x, -7, 7);
    state.y = clamp(state.y, -6, 6);

    const rotateX = clamp(-state.y * 0.08, -0.55, 0.55);
    const rotateY = clamp(state.x * 0.08, -0.58, 0.58);

    item.style.setProperty('--tracker-lag-x', `${state.x.toFixed(2)}px`);
    item.style.setProperty('--tracker-lag-y', `${state.y.toFixed(2)}px`);
    item.style.setProperty('--tracker-lag-rx', `${rotateX.toFixed(3)}deg`);
    item.style.setProperty('--tracker-lag-ry', `${rotateY.toFixed(3)}deg`);
  });

  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;

  if (motion.lastPointerX !== null && motion.lastPointerY !== null) {
    addImpulse(event.clientX - motion.lastPointerX, event.clientY - motion.lastPointerY, 0.065);
  }

  motion.lastPointerX = event.clientX;
  motion.lastPointerY = event.clientY;
}, { passive: true });

window.addEventListener('pointerleave', () => {
  motion.lastPointerX = null;
  motion.lastPointerY = null;
}, { passive: true });

window.addEventListener('touchstart', (event) => {
  requestMotionAccess();

  const touch = event.touches?.[0];
  if (!touch) return;
  motion.lastTouchX = touch.clientX;
  motion.lastTouchY = touch.clientY;
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;

  if (motion.lastTouchX !== null && motion.lastTouchY !== null) {
    addImpulse(touch.clientX - motion.lastTouchX, touch.clientY - motion.lastTouchY, 0.1);
  }

  motion.lastTouchX = touch.clientX;
  motion.lastTouchY = touch.clientY;
}, { passive: true });

window.addEventListener('touchend', () => {
  motion.lastTouchX = null;
  motion.lastTouchY = null;
}, { passive: true });

window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;
  const delta = currentScrollY - motion.lastScrollY;
  motion.lastScrollY = currentScrollY;
  motion.impulseY = clamp(motion.impulseY + delta * 0.11, -8, 8);
}, { passive: true });

window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });

window.addEventListener('resize', () => {
  motion.impulseY = clamp(motion.impulseY + 1.8, -8, 8);
}, { passive: true });

if (window.visualViewport) {
  let lastOffsetTop = window.visualViewport.offsetTop;
  let lastOffsetLeft = window.visualViewport.offsetLeft;

  const handleViewportMovement = () => {
    const deltaX = window.visualViewport.offsetLeft - lastOffsetLeft;
    const deltaY = window.visualViewport.offsetTop - lastOffsetTop;
    lastOffsetLeft = window.visualViewport.offsetLeft;
    lastOffsetTop = window.visualViewport.offsetTop;
    addImpulse(deltaX, deltaY, 0.85);
  };

  window.visualViewport.addEventListener('scroll', handleViewportMovement, { passive: true });
  window.visualViewport.addEventListener('resize', handleViewportMovement, { passive: true });
}

const observer = new MutationObserver(refreshItems);
observer.observe(document.body, { childList: true, subtree: true });

refreshItems();
requestAnimationFrame(animate);
