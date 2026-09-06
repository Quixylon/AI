'use strict';

// Float uses individual translate, tilt owns transform, and entrance owns scale.
// Keeping them separate prevents one animation from resetting another.
const surfaceMotion = {
  observer: null,
  observed: new WeakSet(),
  animations: new Set(),
  lastRoute: null,
  selector: '.panel, .platform-card, .detail-card, .stats-card, .history-panel',
  register() {
    if (!this.observer && typeof IntersectionObserver === 'function') {
      this.observer = new IntersectionObserver(entries => {
        for (const entry of entries) entry.target.classList.toggle('is-in-view', entry.isIntersecting);
      }, { rootMargin: '30px' });
    }
    document.querySelectorAll(this.selector).forEach((element, index) => {
      element.classList.add('glass-surface', 'float-surface');
      element.style.setProperty('--float-phase', `${-index * 1.7}s`);
      element.style.setProperty('--float-period', `${7.5 + index % 4 * .7}s`);
      if (!this.observed.has(element)) {
        this.observed.add(element);
        if (this.observer) this.observer.observe(element);
        else element.classList.add('is-in-view');
      }
    });
  },
  cancel() {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  },
  reveal() {
    const route = `${state.route.screen}/${state.route.trackerTab}`;
    if (route === this.lastRoute) return;
    const previous = this.lastRoute;
    this.lastRoute = route;
    this.cancel();
    if (REDUCED_MOTION.matches) return;
    const profile = state.route.screen === 'profile';
    const view = profile ? dom.profileScreen : document.querySelector('.tracker-view.is-active');
    if (!view) return;
    const elements = [...view.querySelectorAll(profile ? '.profile-masthead, .panel, .profile-footer' : this.selector)];
    if (!profile && !previous?.startsWith('tracker/')) elements.unshift(document.querySelector('.tracker-topbar'));
    const reveal = (element, delay, compact = false) => {
      if (!element || element.closest('[hidden]') || typeof element.animate !== 'function') return;
      const bounds = element.getBoundingClientRect();
      if (bounds.top > innerHeight + 80) return;
      const animation = element.animate([
        { opacity: 0, scale: compact ? '.97' : '.94', filter: 'blur(7px)' },
        { opacity: 1, scale: '1', filter: 'blur(0px)' }
      ], { duration: compact ? 550 : 820, delay, easing: 'cubic-bezier(.18,.75,.22,1)', fill: 'backwards' });
      this.animations.add(animation);
      animation.finished.then(() => { this.animations.delete(animation); motionController.measureSoon(); }, () => this.animations.delete(animation));
    };
    elements.forEach((element, index) => reveal(element, Math.min(index * 85, 420)));
    if (profile) view.querySelectorAll('.social-link').forEach((element, index) => reveal(element, 230 + index * 35, true));
    motionController.measureSoon();
  }
};

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
  surfaceMotion.register();
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
  surfaceMotion.reveal();
}

function setupPresentation() {
  REDUCED_MOTION.addEventListener?.('change', () => { if (REDUCED_MOTION.matches) surfaceMotion.cancel(); });
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
