(() => {
  'use strict';

  const DESCRIPTION_MOTION_VERSION = '5';
  const reduceMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let descriptionMotionInstalled = false;
  let fitFrame = 0;
  let cardResizeObserver = null;
  let routeObserver = null;

  function ensureUnifiedIntroPanel() {
    const card = document.getElementById('profileCard');
    const hello = card?.querySelector('.hello-row');
    const description = document.getElementById('profileDescription');
    if (!card || !hello || !description) return null;

    let panel = card.querySelector('.profile-intro-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'profile-intro-panel';
      panel.setAttribute('aria-label', 'Приветствие');
      hello.parentNode.insertBefore(panel, hello);
      panel.append(hello, description);
    } else {
      if (hello.parentNode !== panel) panel.append(hello);
      if (description.parentNode !== panel) panel.append(description);
    }

    return panel;
  }

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

  function installDescriptionMotionOnce() {
    if (descriptionMotionInstalled) return;

    const description = ensureDescriptionWords();
    if (!description) return;

    const words = [...description.querySelectorAll('.description-word')];
    if (!words.length) return;

    descriptionMotionInstalled = true;
    description.dataset.liveDescriptionMotion = DESCRIPTION_MOTION_VERSION;

    words.forEach((word, index) => {
      resetDescriptionWord(word);
      word.dataset.liveDescriptionMotion = DESCRIPTION_MOTION_VERSION;
      word.style.setProperty('--word-index', String(index));

      if (reduceMotionQuery.matches || typeof word.animate !== 'function') return;

      // This entrance runs exactly once for the lifetime of the document.
      // Route changes, live status updates and BUILD ticks never reinstall it.
      word.animate(
        [
          { opacity: 0, filter: 'blur(4px)' },
          { opacity: 1, filter: 'blur(0)' }
        ],
        {
          duration: 520,
          delay: 90 + index * 34,
          easing: 'cubic-bezier(.2,.82,.2,1)',
          fill: 'both'
        }
      );

      // Permanent smooth wave. It changes only compositor-friendly translate
      // plus paint-only color/glow, never opacity or layout properties.
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
            translate: '0 -1px',
            color: '#d7dbe5',
            textShadow: '0 0 7px rgba(104,197,255,.07)'
          },
          {
            offset: 0.5,
            translate: '0 -2.2px',
            color: '#eef0f6',
            textShadow: '0 0 11px rgba(172,159,255,.18), 0 0 4px rgba(104,197,255,.08)'
          },
          {
            offset: 0.75,
            translate: '0 -0.8px',
            color: '#d9dde7',
            textShadow: '0 0 7px rgba(172,159,255,.08)'
          },
          {
            offset: 1,
            translate: '0 0px',
            color: '#c7ccd7',
            textShadow: '0 0 0 rgba(172,159,255,0)'
          }
        ],
        {
          duration: 5000,
          delay: index * -155,
          iterations: Infinity,
          easing: 'ease-in-out',
          fill: 'both'
        }
      );
    });
  }

  function stopDescriptionMotionForReducedMode() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    description.querySelectorAll('.description-word').forEach((word) => {
      word.getAnimations?.().forEach((animation) => animation.cancel());
      word.style.setProperty('opacity', '1');
      word.style.setProperty('filter', 'none');
      word.style.setProperty('translate', '0 0');
      word.style.setProperty('color', '#c7ccd7');
      word.style.setProperty('text-shadow', 'none');
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

  function initialApply() {
    installGlass();
    ensureUnifiedIntroPanel();
    installDescriptionMotionOnce();
    fitDesktopProfile();
  }

  // Navigation and viewport changes may refit the card, but they must never
  // restart the description entrance animation.
  addEventListener('pageshow', () => {
    installGlass();
    ensureUnifiedIntroPanel();
    fitDesktopProfile();
  });
  addEventListener('hashchange', () => requestAnimationFrame(fitDesktopProfile));
  addEventListener('resize', fitDesktopProfile, { passive: true });

  reduceMotionQuery.addEventListener?.('change', () => {
    if (reduceMotionQuery.matches) stopDescriptionMotionForReducedMode();
  });

  initialApply();
  installDesktopProfileWatcher();
  installDeployProof();
})();
