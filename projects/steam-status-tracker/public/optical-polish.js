(() => {
  'use strict';

  const LIQUID_GLASS_URL = 'https://cdn.jsdelivr.net/npm/@ybouane/liquidglass@1.0.3/dist/index.js';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 721px)');
  const LENS_SIZE = 190;

  let lens = null;
  let lensInstance = null;
  let pointerFrame = 0;
  let fitFrame = 0;
  let pointerX = innerWidth / 2;
  let pointerY = innerHeight / 2;
  let cardObserver = null;

  function profileActive() {
    const screen = document.getElementById('profileScreen');
    return Boolean(screen && screen.classList.contains('is-active') && screen.getAttribute('aria-hidden') !== 'true');
  }

  function profileButtonConfig(element) {
    const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 16;
    return {
      blurAmount: 0.035,
      refraction: 1.04,
      chromAberration: 0.060,
      edgeHighlight: 0.16,
      specular: 0.24,
      fresnel: 0.92,
      distortion: 0.038,
      cornerRadius: Math.min(42, radius),
      zRadius: 18,
      opacity: 0.82,
      saturation: 0.12,
      tintStrength: 0.025,
      brightness: -0.055,
      shadowOpacity: 0.19,
      shadowSpread: 7,
      shadowOffsetY: 1,
      floating: false,
      button: true
    };
  }

  function polishProfileButtons() {
    document.querySelectorAll('#profileCard .liquidglass-ready').forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      if (element.dataset.opticalPolish === '2') return;
      element.dataset.opticalPolish = '2';
      element.dataset.config = JSON.stringify(profileButtonConfig(element));
    });
  }

  function fitProfileCard() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      const card = document.getElementById('profileCard');
      if (!card || !desktop.matches || !profileActive()) {
        card?.style.removeProperty('--profile-safe-scale');
        card?.style.removeProperty('--profile-safe-y');
        return;
      }

      card.style.setProperty('--profile-safe-y', '0px');
      const naturalHeight = card.offsetHeight;
      if (!naturalHeight) return;

      // Reserve a real viewport gutter; transformed shadows and rounded borders
      // must never touch the browser edge.
      const availableHeight = Math.max(320, innerHeight - 104);
      const scale = Math.min(1, availableHeight / naturalHeight);
      card.style.setProperty('--profile-safe-scale', String(Math.max(0.58, scale)));

      requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const topLimit = 34;
        const bottomLimit = innerHeight - 38;
        const desiredTop = Math.max(topLimit, (innerHeight - rect.height) / 2);
        let shift = desiredTop - rect.top;

        if (rect.bottom + shift > bottomLimit) {
          shift -= (rect.bottom + shift) - bottomLimit;
        }
        if (rect.top + shift < topLimit) {
          shift += topLimit - (rect.top + shift);
        }

        card.style.setProperty('--profile-safe-y', `${shift.toFixed(2)}px`);
      });
    });
  }

  function insideCard(x, y) {
    const card = document.getElementById('profileCard');
    if (!card || !profileActive()) return false;
    const rect = card.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function positionLens() {
    pointerFrame = 0;
    if (!lens) return;

    const visible = desktop.matches && !reduceMotion.matches && insideCard(pointerX, pointerY);
    lens.classList.toggle('is-visible', visible);

    if (!visible) {
      lens.style.transform = 'translate3d(-999px,-999px,0)';
      return;
    }

    lens.style.transform = `translate3d(${(pointerX - LENS_SIZE / 2).toFixed(2)}px, ${(pointerY - LENS_SIZE / 2).toFixed(2)}px, 0)`;

    // Moving the glass changes the sampled patch. Force just this one instance
    // to re-shade on the next frame; static DOM captures remain cached.
    try { lensInstance?.markChanged(); } catch {}
  }

  function queuePointer(event) {
    if (event?.pointerType === 'touch') return;
    if (Number.isFinite(event?.clientX)) pointerX = event.clientX;
    if (Number.isFinite(event?.clientY)) pointerY = event.clientY;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(positionLens);
  }

  async function installRefractionLens() {
    if (!desktop.matches || reduceMotion.matches || lensInstance) return;

    lens = document.createElement('div');
    lens.className = 'cursor-liquid-lens';
    lens.setAttribute('aria-hidden', 'true');
    lens.dataset.config = JSON.stringify({
      blurAmount: 0.012,
      refraction: 1.12,
      chromAberration: 0.065,
      edgeHighlight: 0.045,
      specular: 0.15,
      fresnel: 0.76,
      distortion: 0.048,
      cornerRadius: 95,
      zRadius: 58,
      opacity: 0.54,
      saturation: 0.10,
      tintStrength: 0.018,
      brightness: -0.07,
      shadowOpacity: 0,
      shadowSpread: 0,
      shadowOffsetY: 0,
      floating: false,
      button: false
    });
    document.body.append(lens);

    try {
      const module = await import(LIQUID_GLASS_URL);
      lensInstance = await module.LiquidGlass.init({
        root: document.body,
        glassElements: [lens],
        defaults: {
          blurAmount: 0.012,
          refraction: 1.12,
          shadowOpacity: 0
        }
      });
    } catch (error) {
      console.warn('Cursor refraction lens unavailable:', error);
      lens.remove();
      lens = null;
      lensInstance = null;
      return;
    }

    positionLens();
  }

  function destroyLens() {
    try { lensInstance?.destroy(); } catch {}
    lensInstance = null;
    lens?.remove();
    lens = null;
  }

  function installObservers() {
    const card = document.getElementById('profileCard');
    cardObserver?.disconnect();
    if (card && typeof ResizeObserver === 'function') {
      cardObserver = new ResizeObserver(fitProfileCard);
      cardObserver.observe(card);
    }

    new MutationObserver(() => {
      polishProfileButtons();
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function onMediaChange() {
    fitProfileCard();
    if (!desktop.matches || reduceMotion.matches) {
      destroyLens();
    } else {
      installRefractionLens();
    }
  }

  addEventListener('pointermove', queuePointer, { passive: true });
  addEventListener('pointerdown', queuePointer, { passive: true });
  addEventListener('resize', () => {
    fitProfileCard();
    queuePointer();
  }, { passive: true });
  addEventListener('hashchange', () => requestAnimationFrame(() => {
    fitProfileCard();
    polishProfileButtons();
    positionLens();
  }));
  addEventListener('pageshow', () => requestAnimationFrame(() => {
    fitProfileCard();
    polishProfileButtons();
    positionLens();
  }));

  desktop.addEventListener?.('change', onMediaChange);
  reduceMotion.addEventListener?.('change', onMediaChange);

  polishProfileButtons();
  fitProfileCard();
  installObservers();
  installRefractionLens();
})();
