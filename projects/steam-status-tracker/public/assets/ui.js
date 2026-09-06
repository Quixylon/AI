'use strict';

// Rendering hooks replace the previous whole-page MutationObserver patch layers.
function updateProfilePresentation() {
  const description = byId('profileDescription');
  if (description && !description.querySelector('.description-char')) {
    description.setAttribute('aria-label', description.textContent);
    const fragment = document.createDocumentFragment();
    let order = 0;
    description.textContent.split(' ').forEach((text, index) => {
      if (index) fragment.append(' ');
      const word = document.createElement('span');
      word.className = 'description-word';
      word.setAttribute('aria-hidden', 'true');
      for (const letter of Array.from(text)) {
        const character = document.createElement('span');
        character.className = 'description-char';
        character.textContent = letter;
        character.style.setProperty('--char-order', order++);
        word.append(character);
      }
      fragment.append(word);
    });
    description.replaceChildren(fragment);
  }
  window.renderBrandIcons?.();
  motionController.registerAll();
}

function updateIntegrationPresentation() {
  for (const platform of ['discord', 'telegram']) {
    const configured = state[platform].status?.configured !== false;
    const view = byId(`${platform}View`);
    if (view) {
      view.dataset.configured = String(configured);
      for (const element of view.querySelectorAll('.stats-card, .history-panel')) element.hidden = !configured;
      for (const item of view.querySelectorAll('.data-item')) {
        const id = item.querySelector('.data-item__value')?.id;
        const publicFields = platform === 'discord' ? ['discordIdValue', 'discordUsernameValue'] : ['telegramIdValue'];
        item.hidden = !configured && !publicFields.includes(id);
      }
    }
    if (!configured && platform === 'discord') {
      byId('discordActivityCard').hidden = true;
      byId('discordEmptyState').hidden = true;
    }
    if (configured) continue;
    text(`${platform}OverviewBadge`, 'В процессе');
    byId(`${platform}OverviewBadge`)?.setAttribute('data-state', 'progress');
    text(`${platform}OverviewStatus`, 'В процессе');
    text(`${platform}OverviewActivity`, 'Интеграция разрабатывается');
    text(`${platform}DetailMainStatus`, 'В процессе');
    text(platform === 'discord' ? 'discordCustomStatus' : 'telegramLastSeenText', 'Пока доступен переход в профиль.');
  }
}

function updateRoutePresentation(resetScroll) {
  motionController.reset(true);
  canvasController.leave();
  if (resetScroll) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    for (const timeline of $$('.timeline')) timeline.scrollTop = 0;
  }
}

function setupPresentation() {
  for (const timeline of $$('.timeline')) {
    const title = timeline.closest('.history-panel')?.querySelector('h3');
    if (title?.id) timeline.setAttribute('aria-labelledby', title.id);
  }
  for (const image of $$('img')) image.draggable = false;
  const visibility = () => {
    document.documentElement.classList.toggle('page-paused', document.hidden);
    if (document.hidden) { canvasController.leave(); motionController.reset(true); }
  };
  document.addEventListener('visibilitychange', visibility);
  visibility();
  addEventListener('pagehide', () => { canvasController.stop(); motionController.reset(true); });
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    interactionHub.init();
    canvasController.resize();
    canvasController.resume();
    motionController.measureSoon();
    refreshManager.startPolling();
    startLiveTicker();
  });
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => motionController.measureSoon());
    observer.observe(dom.profileScreen);
    observer.observe(dom.trackerScreen);
  }
  updateProfilePresentation();
}
