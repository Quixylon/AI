const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const shell = document.querySelector('.shell');
const PANEL_SELECTOR = '#message-panel, #profile-card, #games-panel, #history-panel';
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

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  hoveredPanel: null,
  pressedPanel: null
};

let panels = [];
const states = new WeakMap();

function stateFor(panel, index) {
  if (!states.has(panel)) {
    states.set(panel, {
      rotateX: 0,
      rotateY: 0,
      shiftX: 0,
      shiftY: 0,
      scale: 1,
      velocityRotateX: 0,
      velocityRotateY: 0,
      velocityShiftX: 0,
      velocityShiftY: 0,
      velocityScale: 0,
      phase: index * 1.7 + Math.random() * 0.5
    });
  }

  return states.get(panel);
}

function refreshPanels() {
  panels = [...document.querySelectorAll(PANEL_SELECTOR)];

  panels.forEach((panel, index) => {
    panel.classList.add('tracker-tilt-panel');
    panel.style.setProperty('--panel-rx', '0deg');
    panel.style.setProperty('--panel-ry', '0deg');
    panel.style.setProperty('--panel-x', '0px');
    panel.style.setProperty('--panel-y', '0px');
    panel.style.setProperty('--panel-scale', '1');
    panel.style.setProperty('--panel-shine-x', '50%');
    panel.style.setProperty('--panel-shine-y', '50%');
    stateFor(panel, index);
  });
}

function panelAtPoint(x, y) {
  const target = document.elementFromPoint(x, y);
  return target instanceof Element ? target.closest(PANEL_SELECTOR) : null;
}

function releasePress() {
  pointer.down = false;
  pointer.pointerId = null;

  if (pointer.pressedPanel) {
    pointer.pressedPanel.classList.remove('is-pressed');
  }

  pointer.pressedPanel = null;

  if (!finePointer) {
    pointer.active = false;
    pointer.hoveredPanel = null;
  }
}

function updatePanel(panel, index, timestamp) {
  const state = stateFor(panel, index);
  const bounds = panel.getBoundingClientRect();
  if (!bounds.width || !bounds.height || panel.hidden) return;

  const pressed = pointer.down && pointer.pressedPanel === panel;
  const hovered = finePointer && pointer.active && pointer.hoveredPanel === panel;
  const engaged = pressed || hovered;

  let targetRotateX = 0;
  let targetRotateY = 0;
  let targetShiftX = 0;
  let targetShiftY = 0;
  let targetScale = 1;

  if (engaged) {
    const normalizedX = clamp(
      (pointer.x - (bounds.left + bounds.width / 2)) / Math.max(bounds.width / 2, 1),
      -1,
      1
    );
    const normalizedY = clamp(
      (pointer.y - (bounds.top + bounds.height / 2)) / Math.max(bounds.height / 2, 1),
      -1,
      1
    );

    const tiltX = pressed ? 2.05 : 1.45;
    const tiltY = pressed ? 2.45 : 1.8;

    targetRotateX = -normalizedY * tiltX;
    targetRotateY = normalizedX * tiltY;
    targetShiftX = normalizedX * (pressed ? 1.5 : 0.9);
    targetShiftY = normalizedY * (pressed ? 1 : 0.6) + (pressed ? 1.05 : 0);
    targetScale = pressed ? 0.995 : 1;

    panel.style.setProperty('--panel-shine-x', `${((normalizedX + 1) * 50).toFixed(1)}%`);
    panel.style.setProperty('--panel-shine-y', `${((normalizedY + 1) * 50).toFixed(1)}%`);
  } else if (finePointer) {
    targetRotateX = Math.sin(timestamp * 0.00025 + state.phase) * 0.055;
    targetRotateY = Math.cos(timestamp * 0.00022 + state.phase) * 0.075;
    targetShiftY = Math.sin(timestamp * 0.00029 + state.phase) * -0.08;
    panel.style.setProperty('--panel-shine-x', '50%');
    panel.style.setProperty('--panel-shine-y', '50%');
  }

  const spring = pressed ? 0.095 : 0.055;
  const damping = pressed ? 0.72 : 0.78;

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

  panel.style.setProperty('--panel-rx', `${state.rotateX.toFixed(3)}deg`);
  panel.style.setProperty('--panel-ry', `${state.rotateY.toFixed(3)}deg`);
  panel.style.setProperty('--panel-x', `${state.shiftX.toFixed(2)}px`);
  panel.style.setProperty('--panel-y', `${state.shiftY.toFixed(2)}px`);
  panel.style.setProperty('--panel-scale', state.scale.toFixed(4));
}

function animate(timestamp = 0) {
  panels.forEach((panel, index) => updatePanel(panel, index, timestamp));
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

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;

  if (pointer.down) {
    pointer.hoveredPanel = pointer.pressedPanel;
  } else if (finePointer) {
    pointer.hoveredPanel = panelAtPoint(event.clientX, event.clientY);
  }
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (!(event.target instanceof Element)) return;

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  pointer.hoveredPanel = event.target.closest(PANEL_SELECTOR);

  if (!pointer.hoveredPanel || event.target.closest(INTERACTIVE_SELECTOR)) return;

  pointer.down = true;
  pointer.pointerId = event.pointerId;
  pointer.startX = event.clientX;
  pointer.startY = event.clientY;
  pointer.pressedPanel = pointer.hoveredPanel;
  pointer.pressedPanel.classList.add('is-pressed');
}, { passive: true });

window.addEventListener('pointerup', releasePress, { passive: true });
window.addEventListener('pointercancel', releasePress, { passive: true });

window.addEventListener('pointerleave', () => {
  releasePress();
  pointer.active = false;
  pointer.hoveredPanel = null;
}, { passive: true });

window.addEventListener('blur', () => {
  releasePress();
  pointer.active = false;
  pointer.hoveredPanel = null;
}, { passive: true });

window.addEventListener('resize', () => {
  pointer.x = window.innerWidth / 2;
  pointer.y = window.innerHeight / 2;
}, { passive: true });

const observer = new MutationObserver(refreshPanels);
observer.observe(document.body, { childList: true, subtree: true });

if (shell) {
  shell.classList.remove('tracker-shell-motion');
  shell.style.removeProperty('--shell-rx');
  shell.style.removeProperty('--shell-ry');
  shell.style.removeProperty('--shell-x');
  shell.style.removeProperty('--shell-y');
  shell.style.removeProperty('--shell-scale');
}

refreshPanels();
requestAnimationFrame(animate);
