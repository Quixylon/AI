const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

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

let stages = [];
const stageStates = new WeakMap();

function refreshStages() {
  stages = [...document.querySelectorAll('.link-stage, .action-stage')];

  for (const stage of stages) {
    if (!stageStates.has(stage)) {
      stageStates.set(stage, {
        x: 0,
        y: 0,
        velocityX: 0,
        velocityY: 0
      });
    }
  }
}

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

  if (requests.length) {
    await Promise.allSettled(requests);
  }
}

function handleDeviceMotion(event) {
  const acceleration = event.accelerationIncludingGravity;
  if (!acceleration) return;

  const rawX = Number(acceleration.x);
  const rawY = Number(acceleration.y);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;

  const adjusted = screenAdjustedVector(rawX, rawY);
  const targetX = clamp(-adjusted.x * 0.62, -5.2, 5.2);
  const targetY = clamp(adjusted.y * 0.42, -4.2, 4.2);

  motion.sensorX += (targetX - motion.sensorX) * 0.12;
  motion.sensorY += (targetY - motion.sensorY) * 0.12;
}

function handleDeviceOrientation(event) {
  if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;

  const horizontal = clamp(-event.gamma / 45, -1, 1) * 3.4;
  const vertical = clamp((event.beta - 45) / 55, -1, 1) * 2.5;

  motion.orientationX += (horizontal - motion.orientationX) * 0.08;
  motion.orientationY += (vertical - motion.orientationY) * 0.08;
}

function animate(timestamp = 0) {
  motion.impulseX *= 0.9;
  motion.impulseY *= 0.9;

  const ambientX = Math.sin(timestamp * 0.00042) * 0.3;
  const ambientY = Math.cos(timestamp * 0.00036) * 0.24;
  const targetBaseX = clamp(motion.sensorX + motion.orientationX + motion.impulseX + ambientX, -7, 7);
  const targetBaseY = clamp(motion.sensorY + motion.orientationY + motion.impulseY + ambientY, -6, 6);

  stages.forEach((stage, index) => {
    const state = stageStates.get(stage);
    if (!state) return;

    const depth = 0.72 + (index % 5) * 0.055;
    const targetX = targetBaseX * depth;
    const targetY = targetBaseY * depth;
    const spring = 0.025 + (index % 4) * 0.0035;
    const damping = 0.86 - (index % 3) * 0.012;

    state.velocityX += (targetX - state.x) * spring;
    state.velocityY += (targetY - state.y) * spring;
    state.velocityX *= damping;
    state.velocityY *= damping;
    state.x += state.velocityX;
    state.y += state.velocityY;

    state.x = clamp(state.x, -7.2, 7.2);
    state.y = clamp(state.y, -6.2, 6.2);

    const rotateX = clamp(-state.y * 0.075, -0.48, 0.48);
    const rotateY = clamp(state.x * 0.075, -0.52, 0.52);

    stage.style.setProperty('--lag-x', `${state.x.toFixed(2)}px`);
    stage.style.setProperty('--lag-y', `${state.y.toFixed(2)}px`);
    stage.style.setProperty('--lag-rx', `${rotateX.toFixed(3)}deg`);
    stage.style.setProperty('--lag-ry', `${rotateY.toFixed(3)}deg`);
  });

  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;

  if (motion.lastPointerX !== null && motion.lastPointerY !== null) {
    addImpulse(
      event.clientX - motion.lastPointerX,
      event.clientY - motion.lastPointerY,
      0.07
    );
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
    addImpulse(
      touch.clientX - motion.lastTouchX,
      touch.clientY - motion.lastTouchY,
      0.11
    );
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

  motion.impulseY = clamp(motion.impulseY + delta * 0.12, -8, 8);
}, { passive: true });

window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });

window.addEventListener('resize', () => {
  motion.impulseY = clamp(motion.impulseY + 2.1, -8, 8);
}, { passive: true });

if (window.visualViewport) {
  let lastOffsetTop = window.visualViewport.offsetTop;
  let lastOffsetLeft = window.visualViewport.offsetLeft;

  const handleViewportMovement = () => {
    const deltaX = window.visualViewport.offsetLeft - lastOffsetLeft;
    const deltaY = window.visualViewport.offsetTop - lastOffsetTop;
    lastOffsetLeft = window.visualViewport.offsetLeft;
    lastOffsetTop = window.visualViewport.offsetTop;
    addImpulse(deltaX, deltaY, 0.9);
  };

  window.visualViewport.addEventListener('scroll', handleViewportMovement, { passive: true });
  window.visualViewport.addEventListener('resize', () => {
    handleViewportMovement();
    motion.impulseY = clamp(motion.impulseY + 1.6, -8, 8);
  }, { passive: true });
}

const observer = new MutationObserver(refreshStages);
observer.observe(document.body, { childList: true, subtree: true });

refreshStages();
requestAnimationFrame(animate);
