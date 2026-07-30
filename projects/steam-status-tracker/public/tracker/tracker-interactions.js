const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const CARD_SELECTOR = [
  '#message-panel',
  '#profile-card',
  '#games-panel',
  '#history-panel',
  '.detail-card',
  '.game-summary-card',
  '.game-session',
  '.history-content'
].join(', ');

const CONTROL_SELECTOR = [
  '.back-link',
  '.avatar',
  '.status-pill',
  '.csrep-button',
  '.game-session-icon',
  '.game-badge',
  '.history-marker',
  '.history-badge'
].join(', ');

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  lastX: null,
  lastY: null
};

const motion = {
  impulseX: 0,
  impulseY: 0,
  sensorX: 0,
  sensorY: 0,
  orientationX: 0,
  orientationY: 0,
  lastTouchX: null,
  lastTouchY: null,
  lastScrollY: window.scrollY,
  permissionRequested: false
};

let cards = [];
let controls = [];
const cardStates = new WeakMap();
const controlStates = new WeakMap();
const boundControls = new WeakSet();

function addImpulse(deltaX, deltaY, strength = 1) {
  motion.impulseX = clamp(motion.impulseX - deltaX * strength, -9, 9);
  motion.impulseY = clamp(motion.impulseY - deltaY * strength, -9, 9);
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

function cardStrength(card) {
  if (card.matches('#profile-card, #games-panel, #history-panel, #message-panel')) {
    return { tilt: 2.5, shift: 2.2, depth: 0.72 };
  }
  if (card.matches('.game-session, .history-content')) {
    return { tilt: 3.4, shift: 2.8, depth: 0.88 };
  }
  return { tilt: 3.1, shift: 2.5, depth: 0.82 };
}

function cardStateFor(card) {
  if (!cardStates.has(card)) {
    cardStates.set(card, {
      x: 0,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      velocityX: 0,
      velocityY: 0,
      velocityRotateX: 0,
      velocityRotateY: 0,
      phase: Math.random() * Math.PI * 2,
      ...cardStrength(card)
    });
  }
  return cardStates.get(card);
}

function controlStateFor(control, index) {
  if (!controlStates.has(control)) {
    controlStates.set(control, {
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      localX: 0,
      localY: 0,
      targetLocalX: 0,
      targetLocalY: 0,
      depth: 0.62 + (index % 6) * 0.065,
      phase: Math.random() * Math.PI * 2
    });
  }
  return controlStates.get(control);
}

function bindControl(control, index) {
  if (boundControls.has(control)) return;
  boundControls.add(control);
  const state = controlStateFor(control, index);

  control.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const bounds = control.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const normalizedX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const normalizedY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    state.targetLocalX = (normalizedX - 0.5) * 3.4;
    state.targetLocalY = (normalizedY - 0.5) * 2.8;
    control.style.setProperty('--interaction-x', `${(normalizedX * 100).toFixed(1)}%`);
    control.style.setProperty('--interaction-y', `${(normalizedY * 100).toFixed(1)}%`);
  }, { passive: true });

  control.addEventListener('pointerleave', () => {
    state.targetLocalX = 0;
    state.targetLocalY = 0;
    control.style.setProperty('--interaction-x', '50%');
    control.style.setProperty('--interaction-y', '50%');
  }, { passive: true });

  control.addEventListener('pointerdown', () => control.classList.add('is-pressed'), { passive: true });
  control.addEventListener('pointerup', () => control.classList.remove('is-pressed'), { passive: true });
  control.addEventListener('pointercancel', () => control.classList.remove('is-pressed'), { passive: true });
}

function refreshItems() {
  cards = [...new Set(document.querySelectorAll(CARD_SELECTOR))];
  controls = [...new Set(document.querySelectorAll(CONTROL_SELECTOR))];

  cards.forEach((card) => {
    card.classList.add('tracker-tilt-card');
    card.style.setProperty('--card-shine-x', '50%');
    card.style.setProperty('--card-shine-y', '50%');
    cardStateFor(card);
  });

  controls.forEach((control, index) => {
    control.classList.add('tracker-motion-control');
    control.style.setProperty('--interaction-x', '50%');
    control.style.setProperty('--interaction-y', '50%');
    controlStateFor(control, index);
    bindControl(control, index);
  });
}

function handleDeviceMotion(event) {
  const acceleration = event.accelerationIncludingGravity;
  if (!acceleration) return;

  const rawX = Number(acceleration.x);
  const rawY = Number(acceleration.y);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;

  const adjusted = screenAdjustedVector(rawX, rawY);
  const targetX = clamp(-adjusted.x * 0.62, -5.4, 5.4);
  const targetY = clamp(adjusted.y * 0.44, -4.4, 4.4);
  motion.sensorX += (targetX - motion.sensorX) * 0.12;
  motion.sensorY += (targetY - motion.sensorY) * 0.12;
}

function handleDeviceOrientation(event) {
  if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
  const horizontal = clamp(-event.gamma / 45, -1, 1) * 3.6;
  const vertical = clamp((event.beta - 45) / 55, -1, 1) * 2.7;
  motion.orientationX += (horizontal - motion.orientationX) * 0.09;
  motion.orientationY += (vertical - motion.orientationY) * 0.09;
}

function updateCard(card, index, timestamp, baseX, baseY) {
  const state = cardStateFor(card);
  const bounds = card.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const isVisible = bounds.bottom > -100 && bounds.top < window.innerHeight + 100;
  let normalizedX = 0;
  let normalizedY = 0;

  if (pointer.active && isVisible) {
    normalizedX = clamp((pointer.x - (bounds.left + bounds.width / 2)) / Math.max(bounds.width * 0.62, 1), -1, 1);
    normalizedY = clamp((pointer.y - (bounds.top + bounds.height / 2)) / Math.max(bounds.height * 0.62, 1), -1, 1);
    card.style.setProperty('--card-shine-x', `${clamp((normalizedX + 1) * 50, 0, 100).toFixed(1)}%`);
    card.style.setProperty('--card-shine-y', `${clamp((normalizedY + 1) * 50, 0, 100).toFixed(1)}%`);
  } else {
    normalizedX = clamp(baseX / 7, -1, 1);
    normalizedY = clamp(baseY / 6, -1, 1);
    card.style.setProperty('--card-shine-x', '50%');
    card.style.setProperty('--card-shine-y', '50%');
  }

  const idleX = Math.sin(timestamp * 0.00032 + state.phase) * 0.1;
  const idleY = Math.cos(timestamp * 0.00029 + state.phase) * 0.08;
  const targetRotateX = clamp(-normalizedY * state.tilt - baseY * 0.08 + idleY, -state.tilt, state.tilt);
  const targetRotateY = clamp(normalizedX * state.tilt + baseX * 0.08 + idleX, -state.tilt, state.tilt);
  const targetX = normalizedX * state.shift + baseX * 0.12 * state.depth;
  const targetY = normalizedY * state.shift + baseY * 0.12 * state.depth;

  const spring = 0.038 + (index % 3) * 0.003;
  const damping = 0.82;
  state.velocityX += (targetX - state.x) * spring;
  state.velocityY += (targetY - state.y) * spring;
  state.velocityRotateX += (targetRotateX - state.rotateX) * spring;
  state.velocityRotateY += (targetRotateY - state.rotateY) * spring;
  state.velocityX *= damping;
  state.velocityY *= damping;
  state.velocityRotateX *= damping;
  state.velocityRotateY *= damping;
  state.x += state.velocityX;
  state.y += state.velocityY;
  state.rotateX += state.velocityRotateX;
  state.rotateY += state.velocityRotateY;

  card.style.setProperty('--card-x', `${state.x.toFixed(2)}px`);
  card.style.setProperty('--card-y', `${state.y.toFixed(2)}px`);
  card.style.setProperty('--card-rx', `${state.rotateX.toFixed(3)}deg`);
  card.style.setProperty('--card-ry', `${state.rotateY.toFixed(3)}deg`);
}

function updateControl(control, index, timestamp, baseX, baseY) {
  const state = controlStateFor(control, index);
  state.localX += (state.targetLocalX - state.localX) * 0.12;
  state.localY += (state.targetLocalY - state.localY) * 0.12;

  const idleX = Math.sin(timestamp * 0.0005 + state.phase) * 0.2;
  const idleY = Math.cos(timestamp * 0.00044 + state.phase) * 0.16;
  const targetX = baseX * state.depth + state.localX + idleX;
  const targetY = baseY * state.depth + state.localY + idleY;
  const spring = 0.028 + (index % 4) * 0.003;
  const damping = 0.85;

  state.velocityX += (targetX - state.x) * spring;
  state.velocityY += (targetY - state.y) * spring;
  state.velocityX *= damping;
  state.velocityY *= damping;
  state.x += state.velocityX;
  state.y += state.velocityY;

  const rotateX = clamp(-state.y * 0.09, -0.65, 0.65);
  const rotateY = clamp(state.x * 0.09, -0.68, 0.68);
  control.style.setProperty('--control-x', `${clamp(state.x, -8, 8).toFixed(2)}px`);
  control.style.setProperty('--control-y', `${clamp(state.y, -7, 7).toFixed(2)}px`);
  control.style.setProperty('--control-rx', `${rotateX.toFixed(3)}deg`);
  control.style.setProperty('--control-ry', `${rotateY.toFixed(3)}deg`);
}

function animate(timestamp = 0) {
  motion.impulseX *= 0.9;
  motion.impulseY *= 0.9;

  const ambientX = Math.sin(timestamp * 0.00042) * 0.22;
  const ambientY = Math.cos(timestamp * 0.00036) * 0.18;
  const baseX = clamp(motion.sensorX + motion.orientationX + motion.impulseX + ambientX, -7, 7);
  const baseY = clamp(motion.sensorY + motion.orientationY + motion.impulseY + ambientY, -6, 6);

  cards.forEach((card, index) => updateCard(card, index, timestamp, baseX, baseY));
  controls.forEach((control, index) => updateControl(control, index, timestamp, baseX, baseY));
  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;

  if (pointer.lastX !== null && pointer.lastY !== null) {
    addImpulse(event.clientX - pointer.lastX, event.clientY - pointer.lastY, 0.045);
  }
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
}, { passive: true });

window.addEventListener('pointerleave', () => {
  pointer.active = false;
  pointer.lastX = null;
  pointer.lastY = null;
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') requestMotionAccess();
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
  motion.impulseY = clamp(motion.impulseY + delta * 0.1, -9, 9);
}, { passive: true });

window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
window.addEventListener('resize', refreshItems, { passive: true });

const observer = new MutationObserver(refreshItems);
observer.observe(document.body, { childList: true, subtree: true });

refreshItems();
requestAnimationFrame(animate);
