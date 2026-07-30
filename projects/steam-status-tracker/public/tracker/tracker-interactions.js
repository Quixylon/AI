const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const shell = document.querySelector('.shell');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]'
].join(', ');

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false,
  pointerType: 'mouse',
  startX: 0,
  startY: 0
};

const state = {
  rotateX: 0,
  rotateY: 0,
  shiftX: 0,
  shiftY: 0,
  scale: 1,
  velocityRotateX: 0,
  velocityRotateY: 0,
  velocityShiftX: 0,
  velocityShiftY: 0,
  velocityScale: 0
};

function setPointer(clientX, clientY) {
  pointer.x = clientX;
  pointer.y = clientY;
  pointer.active = true;
}

function releasePress() {
  pointer.down = false;
  shell?.classList.remove('is-pressed');

  if (!finePointer) {
    pointer.active = false;
  }
}

function animate(timestamp = 0) {
  if (!shell) return;

  let targetRotateX = 0;
  let targetRotateY = 0;
  let targetShiftX = 0;
  let targetShiftY = 0;
  let targetScale = 1;

  if (pointer.active && (finePointer || pointer.down)) {
    const normalizedX = clamp((pointer.x / Math.max(window.innerWidth, 1) - 0.5) * 2, -1, 1);
    const normalizedY = clamp((pointer.y / Math.max(window.innerHeight, 1) - 0.5) * 2, -1, 1);
    const strengthX = pointer.down ? 2.05 : 1.45;
    const strengthY = pointer.down ? 2.45 : 1.8;

    targetRotateX = -normalizedY * strengthX;
    targetRotateY = normalizedX * strengthY;
    targetShiftX = normalizedX * (pointer.down ? 1.7 : 1.2);
    targetShiftY = normalizedY * (pointer.down ? 1.2 : 0.8) + (pointer.down ? 1.15 : 0);
    targetScale = pointer.down ? 0.995 : 1;

    shell.style.setProperty('--shell-shine-x', `${((normalizedX + 1) * 50).toFixed(1)}%`);
    shell.style.setProperty('--shell-shine-y', `${((normalizedY + 1) * 50).toFixed(1)}%`);
  } else if (finePointer) {
    targetRotateX = Math.sin(timestamp * 0.00028) * 0.1;
    targetRotateY = Math.cos(timestamp * 0.00024) * 0.14;
    targetShiftY = Math.sin(timestamp * 0.00032) * -0.14;
    shell.style.setProperty('--shell-shine-x', '50%');
    shell.style.setProperty('--shell-shine-y', '50%');
  }

  const spring = pointer.down ? 0.095 : 0.055;
  const damping = pointer.down ? 0.72 : 0.78;

  state.velocityRotateX += (targetRotateX - state.rotateX) * spring;
  state.velocityRotateY += (targetRotateY - state.rotateY) * spring;
  state.velocityShiftX += (targetShiftX - state.shiftX) * spring;
  state.velocityShiftY += (targetShiftY - state.shiftY) * spring;
  state.velocityScale += (targetScale - state.scale) * spring;

  state.velocityRotateX *= damping;
  state.velocityRotateY *= damping;
  state.velocityShiftX *= damping;
  state.velocityShiftY *= damping;
  state.velocityScale *= damping;

  state.rotateX += state.velocityRotateX;
  state.rotateY += state.velocityRotateY;
  state.shiftX += state.velocityShiftX;
  state.shiftY += state.velocityShiftY;
  state.scale += state.velocityScale;

  shell.style.setProperty('--shell-rx', `${state.rotateX.toFixed(3)}deg`);
  shell.style.setProperty('--shell-ry', `${state.rotateY.toFixed(3)}deg`);
  shell.style.setProperty('--shell-x', `${state.shiftX.toFixed(2)}px`);
  shell.style.setProperty('--shell-y', `${state.shiftY.toFixed(2)}px`);
  shell.style.setProperty('--shell-scale', state.scale.toFixed(4));

  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', (event) => {
  if (!finePointer && !pointer.down) return;

  if (pointer.down && event.pointerType === 'touch') {
    const movement = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    if (movement > 13) {
      releasePress();
      return;
    }
  }

  setPointer(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (!shell || !(event.target instanceof Element) || !shell.contains(event.target)) return;

  pointer.pointerType = event.pointerType;
  setPointer(event.clientX, event.clientY);

  // Real links and controls keep their normal click behaviour. The whole tracker
  // still follows the cursor, but no pointer capture is used anywhere.
  if (event.target.closest(INTERACTIVE_SELECTOR)) return;

  pointer.down = true;
  pointer.startX = event.clientX;
  pointer.startY = event.clientY;
  shell.classList.add('is-pressed');
}, { passive: true });

window.addEventListener('pointerup', releasePress, { passive: true });
window.addEventListener('pointercancel', releasePress, { passive: true });

window.addEventListener('pointerleave', () => {
  releasePress();
  pointer.active = false;
}, { passive: true });

window.addEventListener('blur', () => {
  releasePress();
  pointer.active = false;
}, { passive: true });

window.addEventListener('resize', () => {
  pointer.x = window.innerWidth / 2;
  pointer.y = window.innerHeight / 2;
}, { passive: true });

if (shell) {
  shell.classList.add('tracker-shell-motion');
  shell.style.setProperty('--shell-shine-x', '50%');
  shell.style.setProperty('--shell-shine-y', '50%');
  requestAnimationFrame(animate);
}