'use strict';

// Navigation expands the actual destination from the activated control.
// Deep links unfold from the top edge; scroll entries reveal without translation.
const surfaceMotion = {
  observer: null,
  observed: new WeakSet(),
  animations: new Set(),
  revealed: new WeakSet(),
  lastRoute: null,
  source: null,
  viewAnimations: new WeakMap(),
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
  captureSource(control) {
    const href=control?.getAttribute('href');
    if(!href || !/^#(?:profile|tracker(?:[/-]|$))/.test(href))return;
    const r=control.getBoundingClientRect();
    if(!r.width || !r.height)return;
    this.source={route:parseRoute(href).canonical,at:performance.now(),left:r.left,top:r.top,width:r.width,height:r.height};
  },
  takeSource(parsed) {
    const source=this.source;this.source=null;
    return source?.route===parsed.canonical && performance.now()-source.at<1200 ? source : null;
  },
  animateView(view,frames,options) {
    view.classList.add('route-entering');
    const animation=view.animate(frames,options);
    this.viewAnimations.set(view,animation);this.track(animation);
    const cleanup=()=>{
      if(this.viewAnimations.get(view)!==animation)return;
      this.viewAnimations.delete(view);view.classList.remove('route-entering');
      motionController.measureSoon();
    };
    animation.finished.then(cleanup,cleanup);
  },
  enter(element, delay=0) {
    if(!element || element.closest('[hidden]') || typeof element.animate!=='function')return;
    this.revealed.add(element);if(REDUCED_MOTION.matches)return;
    this.track(element.animate([
      {clipPath:'inset(0 0 100% 0 round 18px)'},
      {clipPath:'inset(0 0 0 0 round 0px)'}
    ],{duration:430,delay,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
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
  reveal(source=null) {
    const route=`${state.route.screen}/${state.route.trackerTab}`;
    if(route===this.lastRoute)return;
    this.lastRoute=route;this.cancel();
    const view=state.route.screen==='profile'?dom.profileScreen:document.querySelector('.tracker-view.is-active');
    if(!view || typeof view.animate!=='function')return;
    view.querySelectorAll(this.selector).forEach(element=>this.revealed.add(element));
    if(REDUCED_MOTION.matches)return;
    const rect=view.getBoundingClientRect();
    if(source && rect.width>0 && rect.height>0) {
      const geometry=routeMorphGeometry(source,rect);
      this.animateView(view,[
        {translate:`${geometry.x}px ${geometry.y}px`,scale:`${geometry.sx} ${geometry.sy}`,opacity:.18,clipPath:'inset(0 round 28px)'},
        {translate:'0 0',scale:'1',opacity:1,clipPath:'inset(0 round 0px)'}
      ],{duration:560,easing:'cubic-bezier(.18,.82,.2,1)',fill:'backwards'});
    } else {
      // Reloads and direct URLs have no originating button: open as one sheet.
      this.animateView(view,[
        {clipPath:'inset(0 0 100% 0 round 28px)'},
        {clipPath:'inset(0 0 0 0 round 0px)'}
      ],{duration:580,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'});
    }
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

function updateRoutePresentation(resetScroll,source=null) {
  motionController.reset(true);
  canvasController.leave();
  if (resetScroll) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    for (const timeline of $$('.timeline')) timeline.scrollTop = 0;
  }
  surfaceMotion.reveal(source);
}

function setupPresentation() {
  document.addEventListener('click',event=>{
    if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    surfaceMotion.captureSource(event.target.closest('a[href]'));
  },{capture:true});
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
