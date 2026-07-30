const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const CARD_SELECTOR = [
  '#message-panel',
  '#profile-card',
  '#games-panel',
  '#history-panel'
].join(', ');

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false
};

let cards = [];
const states = new WeakMap();

function stateFor(card) {
  if (!states.has(card)) {
    states.set(card, {
      rotateX: 0,
      rotateY: 0,
      velocityX: 0,
      velocityY: 0
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
    card.style.setProperty('--card-shine-x', '50%');
    card.style.setProperty('--card-shine-y', '50%');
    stateFor(card);
  }
}

function cardTiltStrength(card) {
  if (card.matches('#profile-card')) return 2.15;
  if (card.matches('#games-panel, #history-panel')) return 1.85;
  return 1.7;
}

function updateCard(card) {
  const state = stateFor(card);
  const bounds = card.getBoundingClientRect();

  if (!bounds.width || !bounds.height || card.hidden) return;

  const visible = bounds.bottom > -120 && bounds.top < window.innerHeight + 120;
  let targetRotateX = 0;
  let targetRotateY = 0;

  if (pointer.active && visible) {
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
    const strength = cardTiltStrength(card);

    targetRotateX = -normalizedY * strength;
    targetRotateY = normalizedX * strength;

    card.style.setProperty('--card-shine-x', `${((normalizedX + 1) * 50).toFixed(1)}%`);
    card.style.setProperty('--card-shine-y', `${((normalizedY + 1) * 50).toFixed(1)}%`);
  } else {
    card.style.setProperty('--card-shine-x', '50%');
    card.style.setProperty('--card-shine-y', '50%');
  }

  const spring = 0.055;
  const damping = 0.76;

  state.velocityX += (targetRotateX - state.rotateX) * spring;
  state.velocityY += (targetRotateY - state.rotateY) * spring;
  state.velocityX *= damping;
  state.velocityY *= damping;
  state.rotateX += state.velocityX;
  state.rotateY += state.velocityY;

  if (!pointer.active && Math.abs(state.rotateX) < 0.001 && Math.abs(state.rotateY) < 0.001) {
    state.rotateX = 0;
    state.rotateY = 0;
    state.velocityX = 0;
    state.velocityY = 0;
  }

  card.style.setProperty('--card-rx', `${state.rotateX.toFixed(3)}deg`);
  card.style.setProperty('--card-ry', `${state.rotateY.toFixed(3)}deg`);
}

function animate() {
  for (const card of cards) updateCard(card);
  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
}, { passive: true });

window.addEventListener('pointerleave', () => {
  pointer.active = false;
}, { passive: true });

window.addEventListener('blur', () => {
  pointer.active = false;
}, { passive: true });

window.addEventListener('touchstart', (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;
  pointer.x = touch.clientX;
  pointer.y = touch.clientY;
  pointer.active = true;
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;
  pointer.x = touch.clientX;
  pointer.y = touch.clientY;
  pointer.active = true;
}, { passive: true });

window.addEventListener('touchend', () => {
  pointer.active = false;
}, { passive: true });

window.addEventListener('touchcancel', () => {
  pointer.active = false;
}, { passive: true });

const observer = new MutationObserver(refreshCards);
observer.observe(document.body, { childList: true, subtree: true });

refreshCards();
requestAnimationFrame(animate);
