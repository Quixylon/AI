'use strict';

// Translation-based entrances keep the live SVG background aligned.
const surfaceMotion = {
  observer: null,
  observed: new WeakSet(),
  animations: new Set(),
  revealed: new WeakSet(),
  lastRoute: null,
  selector: '.identity-panel, .tracker-door, .destinations-panel, .tracker-topbar, .platform-card, .detail-card, .stats-card, .history-panel',
  register() {
    if (!this.observer && typeof IntersectionObserver === 'function') {
      this.observer = new IntersectionObserver(entries => {
        const arriving=[];
        for (const entry of entries) {
          entry.target.classList.toggle('is-in-view', entry.isIntersecting);
          if(entry.isIntersecting && this.lastRoute && !this.revealed.has(entry.target)) arriving.push(entry.target);
        }
        this.cascade(arriving);
      }, { rootMargin: '30px' });
    }
    document.querySelectorAll(this.selector).forEach((element, index) => {
      if (!element.matches('.identity-panel,.tracker-door')) element.classList.add('glass-surface');
      element.classList.add('float-surface');
      element.style.setProperty('--float-phase', `${-index * 1.7}s`);
      element.style.setProperty('--float-period', `${7 + index % 4}s`);
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
  cascade(elements) {
    elements.forEach((element,index)=>this.enter(element,Math.min(index*85,340)));
  },
  enter(element, delay=0) {
    if(!element || element.closest('[hidden]') || typeof element.animate!=='function')return;
    this.revealed.add(element);if(REDUCED_MOTION.matches)return;
    this.track(element.animate([
      {opacity:0,translate:"0 18px"},
      {opacity:1,translate:"0 0"}
    ],{duration:620,delay,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));
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
      const animation=element.animate([
        {opacity:1},
        {opacity:0}
      ],{duration:110,easing:'ease-in',fill:'forwards'});
      this.track(animation); return animation;
    });
    await Promise.allSettled(animations.map(animation=>animation.finished));
    // The caller hides the old route synchronously before removing filled effects.
    return ()=>animations.forEach(animation=>animation.cancel());
  },
  reveal() {
    const route=`${state.route.screen}/${state.route.trackerTab}`;
    if(route===this.lastRoute)return;
    this.lastRoute=route;this.cancel();
    const view=state.route.screen==='profile'?dom.profileScreen:document.querySelector('.tracker-view.is-active');
    if(!view)return;
    // Off-screen panels still get their first entrance when scrolled into view.
    view.querySelectorAll(this.selector).forEach(element=>this.revealed.delete(element));
    this.cascade(this.visibleElements());
    motionController.measureSoon();
  }

};

// Rendering hooks replace the previous whole-page MutationObserver patch layers.
function updateProfilePresentation() {
  const description = byId('profileDescription');
  if (description) description.removeAttribute('aria-label');
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
