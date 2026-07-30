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
  id: null,
  startX: 0,
  startY: 0,
  hoverCard: null,
  activeCard: null
};

let cards = [];
const states = new WeakMap();

function stateFor(card) {
  if (!states.has(card)) {
    states.set(card, {
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      pressY: 0,
      velocityX: 0,
      velocityY: 0,
      velocityScale: 0,
      velocityPressY: 0
    });
  }

  return states.get(card);
}

function refreshCards() {
  cards = [...document.querySelectorAll(CARD_SELECTOR)];

  for (const card of cards) {
    card.classList.add('tracker-tilt-card');
    card.style.setProperty('--card-rx', '0deg');
    card.style.setProperty('--card-ry', '0deg');
    card.style.setProperty('--card-scale', '1');
    card.style.setProperty('--card-press-y', '0px');
    card.style.setProperty('--card-shine-x', '50%');
    card.style.setProperty('--card-shine-y', '50%');
    stateFor(card);
  }
}

function isLargeCard(card) {
  return card.matches('#message-panel, #profile-card, #games-panel, #history-panel');
}

function cardAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element instanceof Element ? element.closest(CARD_SELECTOR) : null;
}

function normalizedPoint(card, bounds) {
  return {
    x: clamp((pointer.x - (bounds.left + bounds.width / 2)) / Math.max(bounds.width / 2, 1), -1, 1),
    y: clamp((pointer.y - (bounds.top + bounds.height / 2)) / Math.max(bounds.height / 2, 1), -1, 1)
  };
}

function updateCard(card) {
  const state = stateFor(card);
  const bounds = card.getBoundingClientRect();
  if (!bounds.width || !bounds.height || card.hidden) return;

  const pressed = pointer.down && pointer.activeCard === card;
  const hovered = finePointer && pointer.active && pointer.hoverCard === card;
  const engaged = pressed || hovered;
  const large = isLargeCard(card);

  let targetRotateX = 0;
  let targetRotateY = 0;
  let targetScale = 1;
  let targetPressY = 0;

  if (engaged) {
    const normalized = normalizedPoint(card, bounds);
    const strength = pressed
      ? (large ? 3.05 : 3.55)
      : (large ? 1.8 : 2.2);

    targetRotateX = -normalized.y * strength;
    targetRotateY = normalized.x * strength;
    targetScale = pressed ? (large ? 0.992 : 0.987) : 1.003;
    targetPressY = pressed ? 1.25 : -0.25;

    card.style.setProperty('--card-shine-x', `${((normalized.x + 1) * 50).toFixed(1)}%`);
    card.style.setProperty('--card-shine-y', `${((normalized.y + 1) * 50).toFixed(1)}%`);
  } else {
    card.style.setProperty('--card-shine-x', '50%');
    card.style.setProperty('--card-shine-y', '50%');
  }

  const spring = pressed ? 0.105 : 0.065;
  const damping = pressed ? 0.7 : 0.76;

  state.velocityX += (targetRotateX - state.rotateX) * spring;
  state.velocityY += (targetRotateY - state.rotateY) * spring;
  state.velocityScale += (targetScale - state.scale) * spring;
  state.velocityPressY += (targetPressY - state.pressY) * spring;

  state.velocityX *= damping;
  state.velocityY *= damping;
  state.velocityScale *= damping;
  state.velocityPressY *= damping;

  state.rotateX += state.velocityX;
  state.rotateY += state.velocityY;
  state.scale += state.velocityScale;
  state.pressY += state.velocityPressY;

  card.style.setProperty('--card-rx', `${state.rotateX.toFixed(3)}deg`);
  card.style.setProperty('--card-ry', `${state.rotateY.toFixed(3)}deg`);
  card.style.setProperty('--card-scale', state.scale.toFixed(4));
  card.style.setProperty('--card-press-y', `${state.pressY.toFixed(2)}px`);
}

function animate() {
  for (const card of cards) updateCard(card);
  requestAnimationFrame(animate);
}

function beginPress(event) {
  if (!(event.target instanceof Element)) return;

  // Never capture clicks that belong to a real link or control. Pointer capture on
  // the surrounding card can cancel the browser's normal click/navigation event.
  if (event.target.closest(INTERACTIVE_SELECTOR)) {
    pointer.down = false;
    pointer.activeCard = null;
    return;
  }

  const card = event.target.closest(CARD_SELECTOR);
  if (!card) return;

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  pointer.down = true;
  pointer.id = event.pointerId;
  pointer.startX = event.clientX;
  pointer.startY = event.clientY;
  pointer.activeCard = card;
  pointer.hoverCard = card;
  card.classList.add('is-pressed');

  try {
    card.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture may be unavailable in some browsers.
  }
}

function endPress() {
  pointer.down = false;
  pointer.id = null;

  if (pointer.activeCard) {
    pointer.activeCard.classList.remove('is-pressed');
  }

  pointer.activeCard = null;

  if (!finePointer) {
    pointer.active = false;
    pointer.hoverCard = null;
  }
}

window.addEventListener('pointerdown', beginPress, { passive: true });

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' && !pointer.down) return;

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;

  if (pointer.down && event.pointerId === pointer.id) {
    const movement = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);

    if (event.pointerType === 'touch' && movement > 13) {
      endPress();
      return;
    }

    pointer.hoverCard = pointer.activeCard;
    return;
  }

  if (finePointer) {
    pointer.hoverCard = cardAtPoint(event.clientX, event.clientY);
  }
}, { passive: true });

window.addEventListener('pointerup', endPress, { passive: true });
window.addEventListener('pointercancel', endPress, { passive: true });

window.addEventListener('pointerleave', () => {
  endPress();
  pointer.active = false;
  pointer.hoverCard = null;
}, { passive: true });

window.addEventListener('blur', () => {
  endPress();
  pointer.active = false;
  pointer.hoverCard = null;
}, { passive: true });

const observer = new MutationObserver(refreshCards);
observer.observe(document.body, { childList: true, subtree: true });

refreshCards();
requestAnimationFrame(animate);
