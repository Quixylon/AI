const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const CARD_SELECTOR = [
  '#message-panel',
  '#profile-card',
  '#games-panel',
  '#history-panel',
  '.detail-card',
  '.game-summary-card',
  '.game-session',
  '.history-content',
  '.csrep-button'
].join(', ');

const motionMedia = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false,
  hoveredCard: null,
  pressedCard: null
};

const states = new WeakMap();
let cards = [];
let motionEnabled = false;
let refreshFrame = 0;

function stateFor(card) {
  if (!states.has(card)) {
    states.set(card, {
      rotateX: 0,
      rotateY: 0,
      shiftX: 0,
      shiftY: 0
    });
  }

  return states.get(card);
}

function isLargeCard(card) {
  return card.matches('#message-panel, #profile-card, #games-panel, #history-panel');
}

function isActionCard(card) {
  return card.matches('.csrep-button');
}

function cardAtPoint(x, y) {
  if (!motionEnabled) return null;
  const target = document.elementFromPoint(x, y);
  if (!(target instanceof Element)) return null;

  const card = target.closest(CARD_SELECTOR);
  if (!card || card.hidden || card.closest('[hidden]')) return null;
  return card;
}

function setHoveredCard(card) {
  if (pointer.hoveredCard === card) return;
  pointer.hoveredCard?.classList.remove('is-pointer-over');
  pointer.hoveredCard = card;
  pointer.hoveredCard?.classList.add('is-pointer-over');
}

function resetCard(card, immediate = false) {
  const state = stateFor(card);

  if (immediate) {
    state.rotateX = 0;
    state.rotateY = 0;
    state.shiftX = 0;
    state.shiftY = 0;
  }

  card.style.setProperty('--tilt-rx', '0deg');
  card.style.setProperty('--tilt-ry', '0deg');
  card.style.setProperty('--tilt-x', '0px');
  card.style.setProperty('--tilt-y', '0px');
  card.style.setProperty('--panel-shine-x', '50%');
  card.style.setProperty('--panel-shine-y', '50%');
  card.classList.remove('is-tilt-pressed', 'is-pointer-over');
}

function registerCards() {
  const nextCards = [...document.querySelectorAll(CARD_SELECTOR)];

  for (const card of cards) {
    if (!nextCards.includes(card)) {
      card.classList.remove('tracker-tilt-card', 'is-tilt-pressed', 'is-pointer-over');
      resetCard(card, true);
    }
  }

  cards = nextCards;

  for (const card of cards) {
    stateFor(card);
    card.classList.toggle('tracker-tilt-card', motionEnabled);
    if (!motionEnabled) resetCard(card, true);
  }

  if (motionEnabled && pointer.active) {
    setHoveredCard(cardAtPoint(pointer.x, pointer.y));
  }
}

function scheduleRefresh() {
  if (refreshFrame) return;
  refreshFrame = requestAnimationFrame(() => {
    refreshFrame = 0;
    registerCards();
  });
}

function releasePress() {
  pointer.down = false;
  pointer.pressedCard?.classList.remove('is-tilt-pressed');
  pointer.pressedCard = null;
}

function clearPointer() {
  releasePress();
  pointer.active = false;
  setHoveredCard(null);
}

function configureMotion() {
  const nextEnabled = motionMedia.matches && !reducedMotionMedia.matches;

  if (nextEnabled !== motionEnabled) {
    clearPointer();
    motionEnabled = nextEnabled;
    document.documentElement.classList.toggle('tracker-motion-enabled', motionEnabled);
  }

  registerCards();
}

function updateCard(card) {
  if (!motionEnabled || card.hidden || card.closest('[hidden]')) return;

  const rect = card.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const state = stateFor(card);
  const pressed = pointer.down && pointer.pressedCard === card;
  const active = pointer.active;
  const hovered = pointer.hoveredCard === card;

  let targetRotateX = 0;
  let targetRotateY = 0;
  let targetShiftX = 0;
  let targetShiftY = 0;

  if (active) {
    const horizontalRange = Math.max(rect.width * 1.15, window.innerWidth * 0.42, 320);
    const verticalRange = Math.max(rect.height * 1.15, window.innerHeight * 0.42, 260);
    const normalizedX = clamp((pointer.x - (rect.left + rect.width / 2)) / horizontalRange, -1, 1);
    const normalizedY = clamp((pointer.y - (rect.top + rect.height / 2)) / verticalRange, -1, 1);

    const large = isLargeCard(card);
    const action = isActionCard(card);
    const strengthX = large ? 1.45 : action ? 1.05 : 0.82;
    const strengthY = large ? 1.7 : action ? 1.2 : 0.96;
    const pressBoost = pressed ? 1.22 : 1;

    targetRotateX = -normalizedY * strengthX * pressBoost;
    targetRotateY = normalizedX * strengthY * pressBoost;
    targetShiftX = normalizedX * (large ? 0.85 : 0.46);
    targetShiftY = normalizedY * (large ? 0.58 : 0.32) + (pressed ? 1.15 : 0);
  }

  if (hovered) {
    const localX = clamp((pointer.x - rect.left) / rect.width, 0, 1);
    const localY = clamp((pointer.y - rect.top) / rect.height, 0, 1);
    card.style.setProperty('--panel-shine-x', `${(localX * 100).toFixed(1)}%`);
    card.style.setProperty('--panel-shine-y', `${(localY * 100).toFixed(1)}%`);
  } else {
    card.style.setProperty('--panel-shine-x', '50%');
    card.style.setProperty('--panel-shine-y', '50%');
  }

  const response = pressed ? 0.58 : active ? 0.34 : 0.22;
  state.rotateX += (targetRotateX - state.rotateX) * response;
  state.rotateY += (targetRotateY - state.rotateY) * response;
  state.shiftX += (targetShiftX - state.shiftX) * response;
  state.shiftY += (targetShiftY - state.shiftY) * response;

  if (!active && Math.abs(state.rotateX) < 0.002 && Math.abs(state.rotateY) < 0.002) {
    state.rotateX = 0;
    state.rotateY = 0;
    state.shiftX = 0;
    state.shiftY = 0;
  }

  card.style.setProperty('--tilt-rx', `${state.rotateX.toFixed(3)}deg`);
  card.style.setProperty('--tilt-ry', `${state.rotateY.toFixed(3)}deg`);
  card.style.setProperty('--tilt-x', `${state.shiftX.toFixed(2)}px`);
  card.style.setProperty('--tilt-y', `${state.shiftY.toFixed(2)}px`);
}

function animate() {
  if (motionEnabled) {
    for (const card of cards) updateCard(card);
  }

  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', (event) => {
  if (!motionEnabled || event.pointerType === 'touch') return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  setHoveredCard(cardAtPoint(event.clientX, event.clientY));
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (!motionEnabled || event.pointerType === 'touch' || !(event.target instanceof Element)) return;

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  pointer.down = true;
  setHoveredCard(cardAtPoint(event.clientX, event.clientY));
  pointer.pressedCard = pointer.hoveredCard;
  pointer.pressedCard?.classList.add('is-tilt-pressed');
}, { passive: true });

window.addEventListener('pointerup', releasePress, { passive: true });
window.addEventListener('pointercancel', clearPointer, { passive: true });
window.addEventListener('pointerleave', clearPointer, { passive: true });
window.addEventListener('blur', clearPointer, { passive: true });

window.addEventListener('scroll', () => {
  if (motionEnabled && pointer.active && !pointer.down) {
    setHoveredCard(cardAtPoint(pointer.x, pointer.y));
  }
}, { passive: true });

window.addEventListener('resize', configureMotion, { passive: true });
motionMedia.addEventListener?.('change', configureMotion);
reducedMotionMedia.addEventListener?.('change', configureMotion);

const observer = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.type === 'childList' || mutation.attributeName === 'hidden')) {
    scheduleRefresh();
  }
});

observer.observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['hidden']
});

configureMotion();
requestAnimationFrame(animate);
