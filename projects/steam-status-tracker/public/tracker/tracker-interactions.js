const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const shell = document.querySelector('.shell');
const PANEL_SELECTOR = '#profile-card, #games-panel, #history-panel';
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

const motionMedia = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false,
  startX: 0,
  startY: 0,
  hoveredPanel: null,
  pressedPanel: null
};

const panelStates = new WeakMap();
let panels = [];
let motionEnabled = false;

function stateFor(panel) {
  if (!panelStates.has(panel)) {
    panelStates.set(panel, {
      rotateX: 0,
      rotateY: 0,
      shiftX: 0,
      shiftY: 0,
      scale: 1
    });
  }

  return panelStates.get(panel);
}

function resetState(panel) {
  const state = stateFor(panel);
  state.rotateX = 0;
  state.rotateY = 0;
  state.shiftX = 0;
  state.shiftY = 0;
  state.scale = 1;

  const stage = panel.parentElement?.classList.contains('tracker-panel-stage')
    ? panel.parentElement
    : null;

  if (stage) {
    stage.style.setProperty('--stage-rx', '0deg');
    stage.style.setProperty('--stage-ry', '0deg');
    stage.style.setProperty('--stage-x', '0px');
    stage.style.setProperty('--stage-y', '0px');
    stage.style.setProperty('--stage-scale', '1');
    stage.classList.remove('is-pressed');
  }

  panel.style.setProperty('--panel-shine-x', '50%');
  panel.style.setProperty('--panel-shine-y', '50%');
}

function ensureStage(panel) {
  const existing = panel.parentElement?.classList.contains('tracker-panel-stage')
    ? panel.parentElement
    : null;

  if (existing) return existing;

  const stage = document.createElement('div');
  stage.className = 'tracker-panel-stage';
  if (panel.matches('.section-panel')) stage.classList.add('tracker-panel-stage-spaced');

  panel.before(stage);
  stage.append(panel);
  return stage;
}

function unwrapPanel(panel) {
  const stage = panel.parentElement?.classList.contains('tracker-panel-stage')
    ? panel.parentElement
    : null;

  resetState(panel);
  panel.classList.remove('tracker-motion-panel');

  if (!stage) return;
  stage.before(panel);
  stage.remove();
}

function syncStage(panel) {
  const stage = ensureStage(panel);
  stage.hidden = panel.hidden;
  panel.classList.add('tracker-motion-panel');

  if (stage.dataset.motionReady !== 'true') {
    stage.dataset.motionReady = 'true';
    resetState(panel);
  }
}

function refreshPanels() {
  panels = [...document.querySelectorAll(PANEL_SELECTOR)];

  if (motionEnabled) {
    panels.forEach(syncStage);
  } else {
    panels.forEach(unwrapPanel);
  }
}

function panelAtPoint(x, y) {
  if (!motionEnabled) return null;
  const target = document.elementFromPoint(x, y);
  return target instanceof Element ? target.closest(PANEL_SELECTOR) : null;
}

function layoutBounds(panel) {
  const stage = panel.parentElement?.classList.contains('tracker-panel-stage')
    ? panel.parentElement
    : null;

  if (!shell || !stage) return null;

  const shellBounds = shell.getBoundingClientRect();
  return {
    left: shellBounds.left + stage.offsetLeft,
    top: shellBounds.top + stage.offsetTop,
    width: stage.offsetWidth,
    height: stage.offsetHeight
  };
}

function releasePress() {
  pointer.down = false;

  if (pointer.pressedPanel) {
    pointer.pressedPanel.parentElement?.classList.remove('is-pressed');
  }

  pointer.pressedPanel = null;
}

function configureMotion() {
  const nextEnabled = motionMedia.matches && !reducedMotionMedia.matches;

  if (nextEnabled === motionEnabled && panels.length) {
    refreshPanels();
    return;
  }

  releasePress();
  pointer.active = false;
  pointer.hoveredPanel = null;
  motionEnabled = nextEnabled;
  document.documentElement.classList.toggle('tracker-motion-enabled', motionEnabled);
  refreshPanels();
}

function updatePanel(panel) {
  if (!motionEnabled) return;

  const stage = panel.parentElement;
  const bounds = layoutBounds(panel);
  if (!stage || !bounds || !bounds.width || !bounds.height || panel.hidden || stage.hidden) return;

  const state = stateFor(panel);
  const pressed = pointer.down && pointer.pressedPanel === panel;
  const hovered = pointer.active && pointer.hoveredPanel === panel;
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

    const tiltX = pressed ? 2.05 : 1.35;
    const tiltY = pressed ? 2.35 : 1.65;

    targetRotateX = -normalizedY * tiltX;
    targetRotateY = normalizedX * tiltY;
    targetShiftX = normalizedX * (pressed ? 1.15 : 0.65);
    targetShiftY = normalizedY * (pressed ? 0.75 : 0.42) + (pressed ? 0.9 : 0);
    targetScale = pressed ? 0.996 : 1;

    panel.style.setProperty('--panel-shine-x', `${((normalizedX + 1) * 50).toFixed(1)}%`);
    panel.style.setProperty('--panel-shine-y', `${((normalizedY + 1) * 50).toFixed(1)}%`);
  } else {
    panel.style.setProperty('--panel-shine-x', '50%');
    panel.style.setProperty('--panel-shine-y', '50%');
  }

  const response = pressed ? 0.52 : engaged ? 0.4 : 0.24;
  state.rotateX += (targetRotateX - state.rotateX) * response;
  state.rotateY += (targetRotateY - state.rotateY) * response;
  state.shiftX += (targetShiftX - state.shiftX) * response;
  state.shiftY += (targetShiftY - state.shiftY) * response;
  state.scale += (targetScale - state.scale) * response;

  if (!engaged && Math.abs(state.rotateX) < 0.002 && Math.abs(state.rotateY) < 0.002) {
    state.rotateX = 0;
    state.rotateY = 0;
    state.shiftX = 0;
    state.shiftY = 0;
    state.scale = 1;
  }

  stage.style.setProperty('--stage-rx', `${state.rotateX.toFixed(3)}deg`);
  stage.style.setProperty('--stage-ry', `${state.rotateY.toFixed(3)}deg`);
  stage.style.setProperty('--stage-x', `${state.shiftX.toFixed(2)}px`);
  stage.style.setProperty('--stage-y', `${state.shiftY.toFixed(2)}px`);
  stage.style.setProperty('--stage-scale', state.scale.toFixed(4));
}

function animate() {
  if (motionEnabled) panels.forEach(updatePanel);
  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', (event) => {
  if (!motionEnabled || event.pointerType === 'touch') return;

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  pointer.hoveredPanel = pointer.down
    ? pointer.pressedPanel
    : panelAtPoint(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (!motionEnabled || event.pointerType === 'touch' || !(event.target instanceof Element)) return;

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  pointer.hoveredPanel = event.target.closest(PANEL_SELECTOR);

  if (!pointer.hoveredPanel || event.target.closest(INTERACTIVE_SELECTOR)) return;

  pointer.down = true;
  pointer.startX = event.clientX;
  pointer.startY = event.clientY;
  pointer.pressedPanel = pointer.hoveredPanel;
  pointer.pressedPanel.parentElement?.classList.add('is-pressed');
}, { passive: true });

window.addEventListener('pointerup', releasePress, { passive: true });
window.addEventListener('pointercancel', releasePress, { passive: true });

window.addEventListener('scroll', () => {
  if (motionEnabled && pointer.active && !pointer.down) {
    pointer.hoveredPanel = panelAtPoint(pointer.x, pointer.y);
  }
}, { passive: true });

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

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (
      mutation.type === 'attributes' &&
      mutation.attributeName === 'hidden' &&
      mutation.target instanceof Element &&
      mutation.target.matches(PANEL_SELECTOR)
    ) {
      if (motionEnabled) syncStage(mutation.target);
    }
  }
});

observer.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ['hidden']
});

motionMedia.addEventListener?.('change', configureMotion);
reducedMotionMedia.addEventListener?.('change', configureMotion);
window.addEventListener('resize', configureMotion, { passive: true });

if (shell) {
  shell.classList.remove('tracker-shell-motion');
  shell.style.transform = 'none';
}

configureMotion();
requestAnimationFrame(animate);
