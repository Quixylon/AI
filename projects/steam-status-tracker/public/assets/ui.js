'use strict';

// Panels morph around their own centres: no offscreen or directional entrance.
// Scale/rounding belong to the transition; translate and transform retain float/tilt.
const surfaceMotion = {
  observer: null,
  observed: new WeakSet(),
  animations: new Set(),
  revealed: new WeakSet(),
  lastRoute: null,
  selector: '.panel, .platform-card, .detail-card, .stats-card, .history-panel',
  register() {
    if (!this.observer && typeof IntersectionObserver === 'function') {
      this.observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-in-view', entry.isIntersecting);
          if(entry.isIntersecting && this.lastRoute && !this.revealed.has(entry.target)) this.enter(entry.target,0);
        }
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
    canvasController.lens?.register();
  },
  cancel() {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  },
  track(animation) {
    this.animations.add(animation);
    animation.finished.then(()=>{this.animations.delete(animation);motionController.measureSoon();},()=>this.animations.delete(animation));
  },
  enter(element, delay=0) {
    if(!element || element.closest('[hidden]') || typeof element.animate!=='function') return;
    this.revealed.add(element);
    if(REDUCED_MOTION.matches) return;
    const radius=parseFloat(getComputedStyle(element).borderTopLeftRadius)||0;
    this.track(element.animate([
      {opacity:0,scale:'.985 .95',filter:'blur(3px)',borderRadius:`${radius+14}px`},
      {opacity:1,scale:'1.002 1.004',filter:'blur(0px)',borderRadius:`${Math.max(0,radius-1)}px`,offset:.68},
      {opacity:1,scale:'1',filter:'blur(0px)',borderRadius:`${radius}px`}
    ],{duration:460,delay,easing:'cubic-bezier(.22,.8,.24,1)',fill:'backwards'}));
  },
  visibleElements() {
    const profile=state.route.screen==='profile';
    const view=profile?dom.profileScreen:document.querySelector('.tracker-view.is-active');
    return view?[...view.querySelectorAll(this.selector)].filter(element=>{
      const r=element.getBoundingClientRect();
      return !element.closest('[hidden]') && r.width>0 && r.bottom>0 && r.top<innerHeight;
    }):[];
  },
  async exit() {
    this.cancel();
    if(REDUCED_MOTION.matches || document.hidden) return;
    const animations=this.visibleElements().filter(element=>typeof element.animate==='function').map(element=>{
      const radius=parseFloat(getComputedStyle(element).borderTopLeftRadius)||0;
      const animation=element.animate([
        {opacity:1,scale:'1',filter:'blur(0px)',borderRadius:`${radius}px`},
        {opacity:0,scale:'.985 .96',filter:'blur(5px)',borderRadius:`${radius+18}px`}
      ],{duration:150,easing:'cubic-bezier(.4,0,.8,.3)',fill:'forwards'});
      this.track(animation); return animation;
    });
    await Promise.allSettled(animations.map(animation=>animation.finished));
    // The caller hides the old route synchronously before removing filled effects.
    return ()=>animations.forEach(animation=>animation.cancel());
  },
  reveal() {
    const route = `${state.route.screen}/${state.route.trackerTab}`;
    if (route === this.lastRoute) return;
    this.lastRoute = route;
    this.cancel();
    if (REDUCED_MOTION.matches) return;
    this.visibleElements().forEach((element,index)=>this.enter(element,Math.min(index*28,84)));
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
  document.addEventListener('pointerdown',event=>{
    if(REDUCED_MOTION.matches || event.button!==0) return;
    const control=event.target.closest('.social-link,.tracker-door,.action-button,.filter-button,.tab-link,.back-link');
    if(control?.animate) surfaceMotion.track(control.animate([{scale:'1'},{scale:'.974',offset:.24},{scale:'1'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'}));
  },{passive:true});
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
