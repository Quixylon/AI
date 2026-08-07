(() => {
  'use strict';

  const DESCRIPTION_MOTION_VERSION = '4';
  const reduceMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let fitFrame = 0;
  let cardResizeObserver = null;
  let routeObserver = null;

  function ensureDescriptionWords() {
    const description = document.getElementById('profileDescription');
    if (!description) return null;

    if (!description.querySelector('.description-word')) {
      const text = description.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return description;
      description.replaceChildren();
      description.setAttribute('aria-label', text);
      text.split(/\s+/).forEach((word, index, words) => {
        const span = document.createElement('span');
        span.className = 'description-word';
        span.textContent = word;
        description.append(span);
        if (index < words.length - 1) description.append(document.createTextNode(' '));
      });
    }

    return description;
  }

  function resetDescriptionWord(word) {
    word.getAnimations?.().forEach((animation) => animation.cancel());
    word.style.setProperty('animation', 'none', 'important');
    word.style.setProperty('position', 'relative', 'important');
    word.style.removeProperty('top');
    word.style.setProperty('opacity', '1');
    word.style.setProperty('filter', 'none');
    word.style.setProperty('translate', '0 0');
  }

  function installContinuousDescriptionMotion(force = false) {
    const description = ensureDescriptionWords();
    if (!description) return;

    const words = [...description.querySelectorAll('.description-word')];
    words.forEach((word, index) => {
      if (!force && word.dataset.liveDescriptionMotion === DESCRIPTION_MOTION_VERSION) return;

      resetDescriptionWord(word);
      word.dataset.liveDescriptionMotion = DESCRIPTION_MOTION_VERSION;
      word.style.setProperty('--word-index', String(index));

      if (reduceMotionQuery.matches || typeof word.animate !== 'function') return;

      // Entrance only fades/blurs. The permanent wave owns movement by itself,
      // so two animations never fight over the same transform property.
      word.animate(
        [
          { opacity: 0, filter: 'blur(4px)' },
          { opacity: 1, filter: 'blur(0)' }
        ],
        {
          duration: 500,
          delay: 110 + index * 38,
          easing: 'cubic-bezier(.2,.82,.2,1)',
          fill: 'both'
        }
      );

      // Individual `translate` is compositor-friendly and avoids the layout
      // reflow caused by the old animated `top` property.
      word.animate(
        [
          {
            offset: 0,
            translate: '0 0px',
            color: '#c7ccd7',
            textShadow: '0 0 0 rgba(172,159,255,0)'
          },
          {
            offset: 0.25,
            translate: '0 -1.2px',
            color: '#d8dce6',
            textShadow: '0 0 7px rgba(104,197,255,.08)'
          },
          {
            offset: 0.5,
            translate: '0 -2.8px',
            color: '#f3f4fa',
            textShadow: '0 0 13px rgba(172,159,255,.23), 0 0 5px rgba(104,197,255,.10)'
          },
          {
            offset: 0.75,
            translate: '0 -1.1px',
            color: '#dde0e9',
            textShadow: '0 0 8px rgba(172,159,255,.10)'
          },
          {
            offset: 1,
            translate: '0 0px',
            color: '#c7ccd7',
            textShadow: '0 0 0 rgba(172,159,255,0)'
          }
        ],
        {
          duration: 4200,
          delay: index * -175,
          iterations: Infinity,
          easing: 'ease-in-out',
          fill: 'both'
        }
      );
    });
  }

  function isDesktopProfileActive() {
    const profileScreen = document.getElementById('profileScreen');
    return Boolean(
      profileScreen &&
      profileScreen.classList.contains('is-active') &&
      profileScreen.getAttribute('aria-hidden') !== 'true' &&
      matchMedia('(min-width: 721px)').matches
    );
  }

  function fitDesktopProfile() {
    const card = document.getElementById('profileCard');
    const locked = isDesktopProfileActive();

    document.documentElement.classList.toggle('profile-desktop-locked', locked);
    document.body.classList.toggle('profile-desktop-locked', locked);

    if (!card) return;
    if (!locked) {
      card.style.removeProperty('--profile-fit-scale');
      return;
    }

    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      const naturalHeight = card.offsetHeight;
      if (!naturalHeight) return;

      const availableHeight = Math.max(320, window.innerHeight - 40);
      const scale = Math.min(1, availableHeight / naturalHeight);
      card.style.setProperty('--profile-fit-scale', String(Math.max(0.78, scale)));
    });
  }

  function installDesktopProfileWatcher() {
    const card = document.getElementById('profileCard');
    const profileScreen = document.getElementById('profileScreen');

    cardResizeObserver?.disconnect();
    routeObserver?.disconnect();

    if (card && typeof ResizeObserver === 'function') {
      cardResizeObserver = new ResizeObserver(fitDesktopProfile);
      cardResizeObserver.observe(card);
    }

    if (profileScreen && typeof MutationObserver === 'function') {
      routeObserver = new MutationObserver(fitDesktopProfile);
      routeObserver.observe(profileScreen, {
        attributes: true,
        attributeFilter: ['class', 'aria-hidden']
      });
    }

    fitDesktopProfile();
  }

  async function installDeployProof() {
    let proof = document.getElementById('deployProof');
    if (!proof) {
      proof = document.createElement('div');
      proof.id = 'deployProof';
      proof.setAttribute('aria-label', 'Индикатор версии сайта');
      proof.innerHTML = '<span class="deploy-proof__pulse"></span><span class="deploy-proof__build">BUILD …</span><span class="deploy-proof__tick">0</span>';
      document.body.append(proof);
    }

    let buildLabel = 'BUILD local';
    try {
      const response = await fetch(`./data/build-info.json?t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const info = await response.json();
        const run = String(info.runId || '').slice(-6);
        const commit = String(info.sourceCommit || '').slice(0, 7);
        buildLabel = run ? `BUILD ${run}` : `BUILD ${commit || 'unknown'}`;
        proof.title = `commit ${commit || 'unknown'} · ${info.builtAt || ''}`;
      }
    } catch {}

    proof.querySelector('.deploy-proof__build').textContent = buildLabel;

    const tickNode = proof.querySelector('.deploy-proof__tick');
    let tick = 0;
    window.setInterval(() => {
      tick = (tick + 1) % 1000;
      tickNode.textContent = String(tick).padStart(3, '0');
    }, 1000);
  }

  function installGlass() {
    document.getElementById('profileCard')?.classList.add('backup-glass');
  }

  function apply(forceDescription = false) {
    installGlass();
    installContinuousDescriptionMotion(forceDescription);
    fitDesktopProfile();
  }

  addEventListener('pageshow', () => apply(false));
  addEventListener('hashchange', () => requestAnimationFrame(() => apply(false)));
  addEventListener('resize', fitDesktopProfile, { passive: true });

  reduceMotionQuery.addEventListener?.('change', () => apply(true));

  apply(false);
  installDesktopProfileWatcher();
  installDeployProof();
  setTimeout(() => apply(false), 250);
  setTimeout(() => apply(false), 1200);
})();
