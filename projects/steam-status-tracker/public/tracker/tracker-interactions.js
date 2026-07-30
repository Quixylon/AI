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
const HOVER_EXIT_MARGIN = 14;

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  down: false,
  hoveredCards: [],
  pressedCard: null
};

const states = new WeakMap();
const layoutRects = new WeakMap();
let cards = [];
let motionEnabled = false;
let refreshFrame = 0;
let measureFrame = 0;

function stateFor(card) {
  if (!states.has(card)) {
    states.set(card, {
      rotateX: 0,
      rotateY: 0,
      shiftX: 0,
      shiftY: 0,
      lightX: 50,
      lightY: 50,
      lightOpacity: 0
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

function layoutRectFor(element) {
  let left = 0;
  let top = 0;
  let current = element;

  while (current instanceof HTMLElement) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent;
  }

  left -= window.scrollX;
  top -= window.scrollY;

  let ancestor = element.parentElement;
  while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
    left -= ancestor.scrollLeft;
    top -= ancestor.scrollTop;
    ancestor = ancestor.parentElement;
  }

  const width = element.offsetWidth;
  const height = element.offsetHeight;

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

function measureCards() {
  measureFrame = 0;

  for (const card of cards) {
    if (card.hidden || card.closest('[hidden]')) continue;
    const rect = layoutRectFor(card);
    if (rect.width && rect.height) layoutRects.set(card, rect);
  }

  if (motionEnabled && pointer.active) {
    setHoveredCards(cardsAtPoint(pointer.x, pointer.y));
  }
}

function scheduleMeasure() {
  if (measureFrame) return;
  measureFrame = requestAnimationFrame(measureCards);
}

function pointInside(rect, x, y, margin = 0) {
  return (
    x >= rect.left - margin &&
    x <= rect.right + margin &&
    y >= rect.top - margin &&
    y <= rect.bottom + margin
  );
}

function cardsAtPoint(x, y) {
  if (!motionEnabled) return [];

  const previous = new Set(pointer.hoveredCards);
  const matching = cards.filter((card) => {
    if (card.hidden || card.closest('[hidden]')) return false;
    const rect = layoutRects.get(card) || layoutRectFor(card);
    layoutRects.set(card, rect);
    return pointInside(rect, x, y, previous.has(card) ? HOVER_EXIT_MARGIN : 0);
  });

  matching.sort((first, second) => {
    if (first.contains(second)) return 1;
    if (second.contains(first)) return -1;

    const firstRect = layoutRects.get(first);
    const secondRect = layoutRects.get(second);
    const firstArea = (firstRect?.width || 0) * (firstRect?.height || 0);
    const secondArea = (secondRect?.width || 0) * (secondRect?.height || 0);
    return firstArea - secondArea;
  });

  return matching;
}

function setHoveredCards(nextCards) {
  const nextSet = new Set(nextCards);

  for (const card of pointer.hoveredCards) {
    if (!nextSet.has(card)) card.classList.remove('is-pointer-over');
  }

  for (const card of nextCards) {
    card.classList.add('is-pointer-over');
  }

  pointer.hoveredCards = nextCards;
}

function resetCard(card, immediate = false) {
  const state = stateFor(card);

  if (immediate) {
    state.rotateX = 0;
    state.rotateY = 0;
    state.shiftX = 0;
    state.shiftY = 0;
    state.lightX = 50;
    state.lightY = 50;
    state.lightOpacity = 0;
  }

  card.style.setProperty('--tilt-rx', '0deg');
  card.style.setProperty('--tilt-ry', '0deg');
  card.style.setProperty('--tilt-x', '0px');
  card.style.setProperty('--tilt-y', '0px');
  card.style.setProperty('--panel-shine-x', '50%');
  card.style.setProperty('--panel-shine-y', '50%');
  card.style.setProperty('--pointer-light-opacity', '0');
  card.classList.remove('is-tilt-pressed', 'is-pointer-over');
}

function registerCards() {
  const nextCards = [...document.querySelectorAll(CARD_SELECTOR)];

  for (const card of cards) {
    if (!nextCards.includes(card)) {
      card.classList.remove('tracker-tilt-card', 'is-tilt-pressed', 'is-pointer-over');
      resetCard(card, true);
      layoutRects.delete(card);
    }
  }

  cards = nextCards;

  for (const card of cards) {
    stateFor(card);
    card.classList.toggle('tracker-tilt-card', motionEnabled);
    if (!motionEnabled) resetCard(card, true);
  }

  measureCards();
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
  setHoveredCards([]);
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

  const rect = layoutRects.get(card) || layoutRectFor(card);
  if (!rect.width || !rect.height) return;

  const state = stateFor(card);
  const pressed = pointer.down && pointer.pressedCard === card;
  const active = pointer.active;
  const hovered = pointer.hoveredCards.includes(card);

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
    const targetLightX = clamp((pointer.x - rect.left) / rect.width, 0, 1) * 100;
    const targetLightY = clamp((pointer.y - rect.top) / rect.height, 0, 1) * 100;
    state.lightX += (targetLightX - state.lightX) * 0.58;
    state.lightY += (targetLightY - state.lightY) * 0.58;
  }

  const targetLightOpacity = hovered ? 1 : 0;
  state.lightOpacity += (targetLightOpacity - state.lightOpacity) * (hovered ? 0.46 : 0.14);

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

  if (!hovered && state.lightOpacity < 0.002) state.lightOpacity = 0;

  card.style.setProperty('--tilt-rx', `${state.rotateX.toFixed(3)}deg`);
  card.style.setProperty('--tilt-ry', `${state.rotateY.toFixed(3)}deg`);
  card.style.setProperty('--tilt-x', `${state.shiftX.toFixed(2)}px`);
  card.style.setProperty('--tilt-y', `${state.shiftY.toFixed(2)}px`);
  card.style.setProperty('--panel-shine-x', `${state.lightX.toFixed(2)}%`);
  card.style.setProperty('--panel-shine-y', `${state.lightY.toFixed(2)}%`);
  card.style.setProperty('--pointer-light-opacity', state.lightOpacity.toFixed(3));
}

function animate() {
  if (motionEnabled) {
    for (const card of cards) updateCard(card);
  }

  requestAnimationFrame(animate);
}

function updatePointer(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  setHoveredCards(cardsAtPoint(pointer.x, pointer.y));
}

window.addEventListener('pointermove', (event) => {
  if (!motionEnabled || event.pointerType === 'touch') return;
  updatePointer(event);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (!motionEnabled || event.pointerType === 'touch' || !(event.target instanceof Element)) return;

  updatePointer(event);
  pointer.down = true;
  pointer.pressedCard = pointer.hoveredCards[0] || null;
  pointer.pressedCard?.classList.add('is-tilt-pressed');
}, { passive: true });

window.addEventListener('pointerup', releasePress, { passive: true });
window.addEventListener('pointercancel', clearPointer, { passive: true });
window.addEventListener('pointerleave', clearPointer, { passive: true });
window.addEventListener('blur', clearPointer, { passive: true });

document.addEventListener('scroll', () => {
  if (!motionEnabled) return;
  measureCards();
}, { passive: true, capture: true });

window.addEventListener('resize', () => {
  configureMotion();
  scheduleMeasure();
}, { passive: true });

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
