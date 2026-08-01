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

let pointerX = window.innerWidth / 2;
let pointerY = window.innerHeight / 2;
let activeCard = null;
let updateFrame = 0;

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

function resetCard(card) {
  if (!card) return;

  card.style.setProperty('--tilt-rx', '0deg');
  card.style.setProperty('--tilt-ry', '0deg');
  card.style.setProperty('--tilt-x', '0px');
  card.style.setProperty('--tilt-y', '0px');
  card.classList.remove('is-local-tilt', 'is-tilt-pressed');
}

function cardAtPoint() {
  const target = document.elementFromPoint(pointerX, pointerY);
  if (!(target instanceof Element)) return null;

  const card = target.closest(SMALL_CARD_SELECTOR);
  if (!card || card.hidden || card.closest('[hidden]')) return null;
  return card;
}

function strengthFor(card) {
  if (card.matches('.detail-card')) return { x: 3.1, y: 3.7 };
  if (card.matches('.game-summary-card')) return { x: 3.3, y: 3.9 };
  if (card.matches('.csrep-button')) return { x: 2.4, y: 2.8 };
  return { x: 2.8, y: 3.4 };
}

function applyLocalTilt() {
  updateFrame = 0;

  if (!motionMedia.matches || reducedMotionMedia.matches) {
    resetCard(activeCard);
    activeCard = null;
    return;
  }

  const nextCard = cardAtPoint();

  if (nextCard !== activeCard) {
    resetCard(activeCard);
    activeCard = nextCard;
  }

  if (!activeCard) return;

  const rect = layoutRectFor(activeCard);
  if (!rect.width || !rect.height) {
    resetCard(activeCard);
    activeCard = null;
    return;
  }

  const normalizedX = clamp(((pointerX - rect.left) / rect.width - 0.5) * 2, -1, 1);
  const normalizedY = clamp(((pointerY - rect.top) / rect.height - 0.5) * 2, -1, 1);
  const strength = strengthFor(activeCard);

  activeCard.classList.add('is-local-tilt');
  activeCard.classList.remove('is-tilt-pressed');
  activeCard.style.setProperty('--tilt-rx', `${(-normalizedY * strength.x).toFixed(3)}deg`);
  activeCard.style.setProperty('--tilt-ry', `${(normalizedX * strength.y).toFixed(3)}deg`);

  /* Маленькие карточки только вращаются — никакого сдвига или прожатия. */
  activeCard.style.setProperty('--tilt-x', '0px');
  activeCard.style.setProperty('--tilt-y', '0px');
}

function scheduleUpdate() {
  if (updateFrame) return;
  updateFrame = requestAnimationFrame(applyLocalTilt);
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  pointerX = event.clientX;
  pointerY = event.clientY;
  scheduleUpdate();
}, { passive: true });

/* Клик намеренно не влияет на угол, позицию, масштаб или тень. */
window.addEventListener('pointerdown', () => {
  activeCard?.classList.remove('is-tilt-pressed');
}, { passive: true });

window.addEventListener('pointerup', () => {
  activeCard?.classList.remove('is-tilt-pressed');
}, { passive: true });

window.addEventListener('pointercancel', () => {
  resetCard(activeCard);
  activeCard = null;
}, { passive: true });

window.addEventListener('pointerleave', () => {
  resetCard(activeCard);
  activeCard = null;
}, { passive: true });

window.addEventListener('blur', () => {
  resetCard(activeCard);
  activeCard = null;
}, { passive: true });

document.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
window.addEventListener('resize', scheduleUpdate, { passive: true });
motionMedia.addEventListener?.('change', scheduleUpdate);
reducedMotionMedia.addEventListener?.('change', scheduleUpdate);

new MutationObserver(() => {
  if (activeCard && !activeCard.isConnected) {
    activeCard = null;
  }
}).observe(document.body, { childList: true, subtree: true });
