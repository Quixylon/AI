const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const SMALL_CARD_SELECTOR = [
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
  y: window.innerHeight / 2
};

const states = new WeakMap();
let activeCard = null;
let animationFrame = 0;

function stateFor(card) {
  if (!states.has(card)) {
    states.set(card, {
      rotateX: 0,
      rotateY: 0,
      shiftX: 0,
      shiftY: 0,
      targetRotateX: 0,
      targetRotateY: 0,
      targetShiftX: 0,
      targetShiftY: 0
    });
  }

  return states.get(card);
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

  return {
    left,
    top,
    width: element.offsetWidth,
    height: element.offsetHeight
  };
}

function cardAtPoint(x, y, eventTarget = null) {
  const target = eventTarget instanceof Element
    ? eventTarget
    : document.elementFromPoint(x, y);

  if (!(target instanceof Element)) return null;

  const card = target.closest(SMALL_CARD_SELECTOR);
  if (!card || card.hidden || card.closest('[hidden]')) return null;
  return card;
}

function tiltStrength(card) {
  if (card.matches('.game-summary-card')) return { x: 5.2, y: 6.2 };
  if (card.matches('.detail-card')) return { x: 4.8, y: 5.8 };
  if (card.matches('.csrep-button')) return { x: 3.4, y: 4.2 };
  return { x: 4.2, y: 5.1 };
}

function removePressEffect(card) {
  card?.classList.remove('is-tilt-pressed');
}

function setActiveCard(card) {
  if (activeCard === card) return;

  removePressEffect(activeCard);
  activeCard?.classList.remove('is-local-tilt');
  activeCard = card;
  activeCard?.classList.add('is-local-tilt');
  removePressEffect(activeCard);
}

function updateTargets(card) {
  const rect = layoutRectFor(card);
  if (!rect.width || !rect.height) return;

  const normalizedX = clamp(((pointer.x - rect.left) / rect.width - 0.5) * 2, -1, 1);
  const normalizedY = clamp(((pointer.y - rect.top) / rect.height - 0.5) * 2, -1, 1);
  const strength = tiltStrength(card);
  const state = stateFor(card);

  state.targetRotateX = -normalizedY * strength.x;
  state.targetRotateY = normalizedX * strength.y;
  state.targetShiftX = normalizedX * 0.75;
  state.targetShiftY = normalizedY * 0.52;
}

function needsAnotherFrame(state) {
  return (
    Math.abs(state.targetRotateX - state.rotateX) > 0.006 ||
    Math.abs(state.targetRotateY - state.rotateY) > 0.006 ||
    Math.abs(state.targetShiftX - state.shiftX) > 0.006 ||
    Math.abs(state.targetShiftY - state.shiftY) > 0.006
  );
}

function animateLocalTilt() {
  animationFrame = 0;

  if (!activeCard || !activeCard.isConnected || !motionMedia.matches || reducedMotionMedia.matches) {
    setActiveCard(null);
    return;
  }

  removePressEffect(activeCard);

  const state = stateFor(activeCard);
  const response = 0.42;

  state.rotateX += (state.targetRotateX - state.rotateX) * response;
  state.rotateY += (state.targetRotateY - state.rotateY) * response;
  state.shiftX += (state.targetShiftX - state.shiftX) * response;
  state.shiftY += (state.targetShiftY - state.shiftY) * response;

  activeCard.style.setProperty('--tilt-rx', `${state.rotateX.toFixed(3)}deg`);
  activeCard.style.setProperty('--tilt-ry', `${state.rotateY.toFixed(3)}deg`);
  activeCard.style.setProperty('--tilt-x', `${state.shiftX.toFixed(2)}px`);
  activeCard.style.setProperty('--tilt-y', `${state.shiftY.toFixed(2)}px`);

  if (needsAnotherFrame(state)) scheduleAnimation();
}

function scheduleAnimation() {
  if (animationFrame) return;
  animationFrame = requestAnimationFrame(animateLocalTilt);
}

function updateFromPointer(eventTarget = null) {
  if (!motionMedia.matches || reducedMotionMedia.matches) {
    setActiveCard(null);
    return;
  }

  const card = cardAtPoint(pointer.x, pointer.y, eventTarget);
  setActiveCard(card);

  if (!card) return;
  removePressEffect(card);
  updateTargets(card);
  scheduleAnimation();
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  updateFromPointer(event.target);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  updateFromPointer(event.target);
  removePressEffect(activeCard);
}, { passive: true });

window.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  requestAnimationFrame(() => updateFromPointer());
}, { passive: true });

window.addEventListener('pointercancel', () => {
  removePressEffect(activeCard);
  setActiveCard(null);
}, { passive: true });

window.addEventListener('pointerleave', () => {
  removePressEffect(activeCard);
  setActiveCard(null);
}, { passive: true });

window.addEventListener('blur', () => {
  removePressEffect(activeCard);
  setActiveCard(null);
}, { passive: true });

document.addEventListener('scroll', () => {
  if (!activeCard) return;
  requestAnimationFrame(() => updateFromPointer());
}, { passive: true, capture: true });

window.addEventListener('resize', () => {
  requestAnimationFrame(() => updateFromPointer());
}, { passive: true });

motionMedia.addEventListener?.('change', () => setActiveCard(null));
reducedMotionMedia.addEventListener?.('change', () => setActiveCard(null));

new MutationObserver(() => {
  if (activeCard && !activeCard.isConnected) setActiveCard(null);
}).observe(document.body, { childList: true, subtree: true });
