(() => {
  'use strict';

  const DESCRIPTION_MOTION_VERSION = '7';
  const reduceMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let descriptionMotionInstalled = false;
  let fitFrame = 0;
  let fitCorrectionFrame = 0;
  let cardResizeObserver = null;
  let routeObserver = null;
  let shineFrame = 0;
  let shinePointerX = innerWidth / 2;
  let shinePointerY = innerHeight / 2;

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

  function splitGraphemes(text) {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter('ru', { granularity: 'grapheme' });
      return [...segmenter.segment(text)].map((part) => part.segment);
    }
    return Array.from(text);
  }

  function ensureDescriptionCharacters() {
    const description = document.getElementById('profileDescription');
    if (!description) return null;

    if (
      description.dataset.liveCharacterMotion === DESCRIPTION_MOTION_VERSION &&
      description.querySelector('.description-char')
    ) {
      return description;
    }

    const text = (description.getAttribute('aria-label') || description.textContent)
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return description;

    // Kill every older word-level Web Animation before replacing the markup.
    description.querySelectorAll('*').forEach((node) => {
      node.getAnimations?.().forEach((animation) => animation.cancel());
    });

    description.dataset.liveCharacterMotion = DESCRIPTION_MOTION_VERSION;
    description.replaceChildren();
    description.setAttribute('aria-label', text);

    let globalCharacterIndex = 0;
    const wordNodes = [];
    const words = text.split(/\s+/);

    words.forEach((wordText, wordIndex) => {
      const word = document.createElement('span');
      word.className = 'description-word';
      word.dataset.wordIndex = String(wordIndex);
      word.style.setProperty('--word-index', String(wordIndex));

      splitGraphemes(wordText).forEach((character, characterIndex) => {
        const span = document.createElement('span');
        span.className = 'description-char';
        span.textContent = character;
        span.dataset.wordIndex = String(wordIndex);
        span.dataset.characterIndex = String(characterIndex);
        span.dataset.globalCharacterIndex = String(globalCharacterIndex++);
        span.style.setProperty('--word-index', String(wordIndex));
        span.style.setProperty('--char-index', String(characterIndex));
        word.append(span);
      });

      // Mark the wrapper as already handled by backup-exact-card.js so its
      // legacy word animation cannot get reinstalled by its MutationObserver.
      word.dataset.backupExactWave = '1';
      wordNodes.push(word);
      description.append(word);
      if (wordIndex < words.length - 1) description.append(document.createTextNode(' '));
    });

    description.dataset.backupExactWave = `${description.textContent.trim()}::${wordNodes.length}`;
    return description;
  }

  function resetDescriptionCharacter(character) {
    character.getAnimations?.().forEach((animation) => animation.cancel());
    character.style.setProperty('animation', 'none', 'important');
    character.style.setProperty('opacity', '1');
    character.style.setProperty('filter', 'none');
    character.style.setProperty('translate', '0 0');
    character.style.setProperty('color', '#c7ccd7');
    character.style.setProperty('text-shadow', 'none');
  }

  function installDescriptionMotionOnce() {
    if (descriptionMotionInstalled) return;

    const description = ensureDescriptionCharacters();
    if (!description) return;

    const characters = [...description.querySelectorAll('.description-char')];
    if (!characters.length) return;

    descriptionMotionInstalled = true;
    description.dataset.liveDescriptionMotion = DESCRIPTION_MOTION_VERSION;

    characters.forEach((character) => {
      const wordIndex = Number(character.dataset.wordIndex || 0);
      const characterIndex = Number(character.dataset.characterIndex || 0);
      resetDescriptionCharacter(character);
      character.dataset.liveDescriptionMotion = DESCRIPTION_MOTION_VERSION;

      if (reduceMotionQuery.matches || typeof character.animate !== 'function') return;

      // One-time entrance. Characters inside the same word enter almost
      // together, with only a tiny intra-word stagger.
      character.animate(
        [
          { opacity: 0, filter: 'blur(3.5px)', transform: 'translate3d(0,5px,0)' },
          { opacity: 1, filter: 'blur(0)', transform: 'translate3d(0,0,0)' }
        ],
        {
          duration: 430,
          delay: 55 + wordIndex * 32 + characterIndex * 9,
          easing: 'cubic-bezier(.2,.82,.2,1)',
          fill: 'both'
        }
      );

      // Permanent character wave. Letters within one word have a small phase
      // difference, while the whole word gets a larger shared phase shift.
      // This keeps each word visually coherent without moving it as one block.
      character.animate(
        [
          { offset: 0,    translate: '0 0px',    color: '#c7ccd7', textShadow: '0 0 0 rgba(172,159,255,0)' },
          { offset: 0.15, translate: '0 -0.9px', color: '#d3d7e1', textShadow: '0 0 5px rgba(104,197,255,.05)' },
          { offset: 0.31, translate: '0 -2.15px', color: '#eef0f6', textShadow: '0 0 10px rgba(172,159,255,.16), 0 0 4px rgba(104,197,255,.07)' },
          { offset: 0.48, translate: '0 -1.25px', color: '#dde1ea', textShadow: '0 0 7px rgba(172,159,255,.09)' },
          { offset: 0.65, translate: '0 0.25px', color: '#cdd2dd', textShadow: '0 0 3px rgba(104,197,255,.035)' },
          { offset: 0.82, translate: '0 -0.75px', color: '#d9dde7', textShadow: '0 0 6px rgba(172,159,255,.07)' },
          { offset: 1,    translate: '0 0px',    color: '#c7ccd7', textShadow: '0 0 0 rgba(172,159,255,0)' }
        ],
        {
          duration: 1750,
          delay: -(wordIndex * 78 + characterIndex * 14),
          iterations: Infinity,
          easing: 'linear',
          fill: 'both'
        }
      );
    });
  }

  function stopDescriptionMotionForReducedMode() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    description.querySelectorAll('.description-char').forEach((character) => {
      character.getAnimations?.().forEach((animation) => animation.cancel());
      character.style.setProperty('opacity', '1');
      character.style.setProperty('filter', 'none');
      character.style.setProperty('translate', '0 0');
      character.style.setProperty('transform', 'none');
      character.style.setProperty('color', '#c7ccd7');
      character.style.setProperty('text-shadow', 'none');
    });
  }

  function syncGlassShine() {
    shineFrame = 0;

    document.querySelectorAll('.backup-glass').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return;

      const x = ((shinePointerX - rect.left) / rect.width) * 100;
      const y = ((shinePointerY - rect.top) / rect.height) * 100;
      element.style.setProperty('--backup-shine-x', `${x.toFixed(2)}%`);
      element.style.setProperty('--backup-shine-y', `${y.toFixed(2)}%`);
    });
  }

  function queueGlassShine(event) {
    if (event?.pointerType === 'touch') return;
    if (Number.isFinite(event?.clientX)) shinePointerX = event.clientX;
    if (Number.isFinite(event?.clientY)) shinePointerY = event.clientY;
    if (!shineFrame) shineFrame = requestAnimationFrame(syncGlassShine);
  }

  function installGlobalGlassShineTracking() {
    addEventListener('pointermove', queueGlassShine, { passive: true });
    addEventListener('pointerdown', queueGlassShine, { passive: true });
    addEventListener('resize', () => {
      shinePointerX = Math.min(shinePointerX, innerWidth);
      shinePointerY = Math.min(shinePointerY, innerHeight);
      if (!shineFrame) shineFrame = requestAnimationFrame(syncGlassShine);
    }, { passive: true });
    syncGlassShine();
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
      card.style.removeProperty('--profile-fit-y');
      return;
    }

    cancelAnimationFrame(fitFrame);
    cancelAnimationFrame(fitCorrectionFrame);
    fitFrame = requestAnimationFrame(() => {
      const naturalHeight = card.offsetHeight;
      if (!naturalHeight) return;

      // Keep a real visual gutter above and below the transformed card. The old
      // 0.78 floor was what allowed the bottom border to be clipped on shorter
      // desktop viewports.
      const availableHeight = Math.max(260, window.innerHeight - 72);
      const scale = Math.min(1, availableHeight / naturalHeight);
      card.style.setProperty('--profile-fit-scale', String(Math.max(0.5, scale)));
      card.style.setProperty('--profile-fit-y', '0px');

      fitCorrectionFrame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const topLimit = 22;
        const bottomLimit = window.innerHeight - 22;
        let shift = 0;

        if (rect.bottom > bottomLimit) shift -= rect.bottom - bottomLimit;
        if (rect.top + shift < topLimit) shift += topLimit - (rect.top + shift);

        card.style.setProperty('--profile-fit-y', `${shift.toFixed(2)}px`);
      });
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

  function disableImageDragging(root = document) {
    root.querySelectorAll('img').forEach((image) => {
      image.draggable = false;
      image.setAttribute('draggable', 'false');
    });
  }

  function initialApply() {
    installGlass();
    ensureUnifiedIntroPanel();
    installDescriptionMotionOnce();
    disableImageDragging();
    fitDesktopProfile();
  }

  addEventListener('pageshow', () => {
    installGlass();
    ensureUnifiedIntroPanel();
    disableImageDragging();
    fitDesktopProfile();
    requestAnimationFrame(syncGlassShine);
  });
  addEventListener('hashchange', () => requestAnimationFrame(() => {
    disableImageDragging();
    fitDesktopProfile();
    syncGlassShine();
  }));
  addEventListener('resize', fitDesktopProfile, { passive: true });

  reduceMotionQuery.addEventListener?.('change', () => {
    if (reduceMotionQuery.matches) stopDescriptionMotionForReducedMode();
  });

  initialApply();
  installDesktopProfileWatcher();
  installGlobalGlassShineTracking();
  installDeployProof();
})();
