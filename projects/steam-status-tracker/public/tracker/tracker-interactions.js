const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const LARGE_CARD_SELECTOR = [
  '#message-panel',
  '#profile-card',
  '#games-panel',
  '#history-panel'
].join(', ');

const SMALL_CARD_SELECTOR = [
  '.detail-card',
  '.game-summary-card',
  '.game-session',
  '.history-content',
  '.csrep-button'
].join(', ');

const CARD_SELECTOR = `${LARGE_CARD_SELECTOR}, ${SMALL_CARD_SELECTOR}`;
const motionMedia = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false
};

let cards = [];
let motionEnabled = false;
let pointerFrame = 0;
let measureFrame = 0;
let refreshFrame = 0;

const visibleCards = new Set();
const litCards = new Set();
const layoutRects = new WeakMap();

const visibilityObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle('is-tilt-visible', entry.isIntersecting);

        if (entry.isIntersecting) {
          visibleCards.add(entry.target);
          layoutRects.set(entry.target, layoutRectFor(entry.target));
        } else {
          visibleCards.delete(entry.target);
        }
      }
    }, { rootMargin: '140px 0px' })
  : null;

function isLargeCard(card) {
  return card.matches(LARGE_CARD_SELECTOR);
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

function measureVisibleCards() {
  measureFrame = 0;

  const targets = visibilityObserver ? [...visibleCards] : cards;
  for (const card of targets) {
    if (card.hidden || card.closest('[hidden]')) continue;
    const rect = layoutRectFor(card);
    if (rect.width && rect.height) layoutRects.set(card, rect);
  }

  scheduleTilt();
}

function scheduleMeasure() {
  if (measureFrame) return;
  measureFrame = requestAnimationFrame(measureVisibleCards);
}

function resetTilt(card) {
  card.style.setProperty('--tilt-rx', '0deg');
  card.style.setProperty('--tilt-ry', '0deg');
  card.style.setProperty('--tilt-x', '0px');
  card.style.setProperty('--tilt-y', '0px');
  card.classList.remove('is-tilt-pressed');
}

function updateLight(card, clientX, clientY) {
  const rect = layoutRects.get(card) || layoutRectFor(card);
  if (!rect.width || !rect.height) return;

  layoutRects.set(card, rect);

  const localX = clamp((clientX - rect.left) / rect.width, 0, 1) * 100;
  const localY = clamp((clientY - rect.top) / rect.height, 0, 1) * 100;

  card.style.setProperty('--panel-shine-x', `${localX.toFixed(2)}%`);
  card.style.setProperty('--panel-shine-y', `${localY.toFixed(2)}%`);
  card.style.setProperty('--pointer-light-opacity', '1');
}

function lightOn(event) {
  if (!motionEnabled || event.pointerType === 'touch') return;

  const card = event.currentTarget;
  litCards.add(card);
  card.classList.add('is-pointer-over');
  updateLight(card, event.clientX, event.clientY);
}

function lightMove(event) {
  if (!motionEnabled || event.pointerType === 'touch') return;
  updateLight(event.currentTarget, event.clientX, event.clientY);
}

function lightOff(event) {
  const card = event.currentTarget;
  litCards.delete(card);
  card.classList.remove('is-pointer-over');
  card.style.setProperty('--pointer-light-opacity', '0');
}

function attachCard(card) {
  if (card.dataset.trackerMotionReady === 'true') return;
  card.dataset.trackerMotionReady = 'true';

  card.addEventListener('pointerenter', lightOn, { passive: true });
  card.addEventListener('pointermove', lightMove, { passive: true });
  card.addEventListener('pointerleave', lightOff, { passive: true });

  if (visibilityObserver) {
    visibilityObserver.observe(card);
  } else {
    visibleCards.add(card);
    card.classList.add('is-tilt-visible');
  }
}

function registerCards() {
  const nextCards = [...document.querySelectorAll(CARD_SELECTOR)];
  const nextSet = new Set(nextCards);

  for (const card of cards) {
    if (nextSet.has(card)) continue;

    visibilityObserver?.unobserve(card);
    visibleCards.delete(card);
    litCards.delete(card);
    layoutRects.delete(card);
    card.classList.remove(
      'tracker-tilt-card',
      'is-tilt-visible',
      'is-pointer-over',
      'is-tilt-pressed',
      'is-local-tilt'
    );
  }

  cards = nextCards;

  for (const card of cards) {
    attachCard(card);
    card.classList.toggle('tracker-tilt-card', motionEnabled);
    card.classList.remove('is-tilt-pressed');

    if (!motionEnabled) {
      resetTilt(card);
      card.style.setProperty('--pointer-light-opacity', '0');
      card.classList.remove('is-pointer-over', 'is-local-tilt');
    }
  }

  scheduleMeasure();
}

function scheduleRefresh() {
  if (refreshFrame) return;

  refreshFrame = requestAnimationFrame(() => {
    refreshFrame = 0;
    registerCards();
  });
}

function applyTilt() {
  pointerFrame = 0;

  const targets = visibilityObserver ? [...visibleCards] : cards;

  for (const card of targets) {
    if (!motionEnabled || !isLargeCard(card) || card.hidden || card.closest('[hidden]')) continue;

    if (!pointer.active) {
      resetTilt(card);
      continue;
    }

    const rect = layoutRects.get(card) || layoutRectFor(card);
    if (!rect.width || !rect.height) continue;
    layoutRects.set(card, rect);

    const horizontalRange = Math.max(rect.width * 1.2, window.innerWidth * 0.48, 360);
    const verticalRange = Math.max(rect.height * 1.2, window.innerHeight * 0.48, 300);
    const normalizedX = clamp(
      (pointer.x - (rect.left + rect.width / 2)) / horizontalRange,
      -1,
      1
    );
    const normalizedY = clamp(
      (pointer.y - (rect.top + rect.height / 2)) / verticalRange,
      -1,
      1
    );

    const rotateX = -normalizedY * 1.35;
    const rotateY = normalizedX * 1.55;
    const shiftX = normalizedX * 0.72;
    const shiftY = normalizedY * 0.48;

    card.style.setProperty('--tilt-rx', `${rotateX.toFixed(3)}deg`);
    card.style.setProperty('--tilt-ry', `${rotateY.toFixed(3)}deg`);
    card.style.setProperty('--tilt-x', `${shiftX.toFixed(2)}px`);
    card.style.setProperty('--tilt-y', `${shiftY.toFixed(2)}px`);
  }
}

function scheduleTilt() {
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(applyTilt);
}

function clearPointer() {
  pointer.active = false;

  for (const card of litCards) {
    card.classList.remove('is-pointer-over');
    card.style.setProperty('--pointer-light-opacity', '0');
  }

  for (const card of cards) {
    card.classList.remove('is-tilt-pressed');
  }

  litCards.clear();
  scheduleTilt();
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

window.addEventListener('pointermove', (event) => {
  if (!motionEnabled || event.pointerType === 'touch') return;

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  scheduleTilt();
}, { passive: true });

/* Нажатие не меняет геометрию карточек. */
window.addEventListener('pointerdown', () => {
  for (const card of cards) card.classList.remove('is-tilt-pressed');
}, { passive: true });

window.addEventListener('pointerup', () => {
  for (const card of cards) card.classList.remove('is-tilt-pressed');
}, { passive: true });
window.addEventListener('pointercancel', clearPointer, { passive: true });
window.addEventListener('pointerleave', clearPointer, { passive: true });
window.addEventListener('blur', clearPointer, { passive: true });

document.addEventListener('scroll', () => {
  if (!motionEnabled) return;
  scheduleMeasure();
}, { passive: true, capture: true });

window.addEventListener('resize', () => {
  configureMotion();
  scheduleMeasure();
}, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearPointer();
  } else {
    scheduleMeasure();
  }
});

motionMedia.addEventListener?.('change', configureMotion);
reducedMotionMedia.addEventListener?.('change', configureMotion);

const mutationObserver = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.type === 'childList' || mutation.attributeName === 'hidden')) {
    scheduleRefresh();
  }
});

mutationObserver.observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['hidden']
});

configureMotion();
