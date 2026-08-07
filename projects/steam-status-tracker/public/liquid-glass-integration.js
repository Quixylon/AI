(() => {
  'use strict';

  const LIQUID_GLASS_URL = 'https://cdn.jsdelivr.net/npm/@ybouane/liquidglass@1.0.3/dist/index.js';
  const MAX_INSTANCES = 15;

  const cardSelector = [
    '#profileCard',
    '.profile-intro-panel',
    '.tracker-topbar',
    '.tracker-tabs',
    '.platform-card',
    '.detail-card',
    '.stats-card',
    '.history-panel',
    '.timeline-entry',
    '.activity-card'
  ].join(',');

  const buttonSelector = [
    '.social-link',
    '.action-button',
    '.ghost-button',
    '.back-link',
    '.tab-link',
    '.filter-button',
    '.copy-button',
    '.retry-button',
    '.refresh-button'
  ].join(',');

  const surfaceSelector = `${cardSelector},${buttonSelector}`;

  let LiquidGlass = null;
  let instances = [];
  let rebuildTimer = 0;
  let rebuilding = false;
  let rebuildAgain = false;
  let pointerFrame = 0;
  let pointerX = innerWidth / 2;
  let pointerY = innerHeight / 2;

  function isEditable(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    return Boolean(element?.closest('input, textarea, [contenteditable="true"]'));
  }

  function clearSelection() {
    const selection = window.getSelection?.();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
  }

  function installSelectionGuard() {
    const clearUnlessEditable = (event) => {
      if (isEditable(event?.target)) return;
      clearSelection();
    };

    document.addEventListener('selectstart', (event) => {
      if (isEditable(event.target)) return;
      event.preventDefault();
      clearSelection();
    }, true);

    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection?.();
      if (!selection || selection.isCollapsed) return;
      if (isEditable(selection.anchorNode)) return;
      selection.removeAllRanges();
    }, true);

    document.addEventListener('pointerdown', clearUnlessEditable, true);
    document.addEventListener('mousedown', clearUnlessEditable, true);

    document.addEventListener('dragstart', (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      if (element.closest('img, picture, svg')) event.preventDefault();
    }, true);

    document.querySelectorAll('img').forEach((image) => image.draggable = false);
    clearSelection();
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  }

  function depthOf(element) {
    let depth = 0;
    let node = element;
    while (node?.parentElement) {
      depth += 1;
      node = node.parentElement;
    }
    return depth;
  }

  function radiusOf(element, fallback) {
    const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius);
    return Number.isFinite(radius) && radius > 0 ? Math.min(72, radius) : fallback;
  }

  function isButtonSurface(element) {
    return element.matches(buttonSelector);
  }

  function isProfileButton(element) {
    return Boolean(element.closest('#profileCard')) && isButtonSurface(element);
  }

  function configFor(element) {
    const button = isButtonSurface(element);
    const profileButton = isProfileButton(element);
    const isMainCard = element.id === 'profileCard';
    const isSmallButton = button && element.matches('.copy-button,.filter-button,.tab-link,.back-link');

    // Stronger-than-default values on purpose: the old integration was so
    // subtle that the WebGL refraction was almost indistinguishable from CSS blur.
    return {
      blurAmount: isMainCard ? 0.10 : button ? 0.075 : 0.12,
      refraction: isMainCard ? 0.72 : button ? 0.96 : 0.84,
      chromAberration: button ? 0.070 : 0.045,
      edgeHighlight: button ? 0.34 : 0.22,
      specular: button ? 0.42 : 0.28,
      fresnel: button ? 1.0 : 0.96,
      distortion: button ? 0.035 : 0.022,
      cornerRadius: radiusOf(element, button ? 16 : 24),
      zRadius: isSmallButton ? 14 : button ? 20 : isMainCard ? 34 : 25,
      opacity: isMainCard ? 0.92 : button ? 0.90 : 0.93,
      saturation: 0.14,
      tintStrength: button ? 0.085 : 0.07,
      brightness: button ? 0.025 : 0.005,
      shadowOpacity: button ? 0.36 : 0.38,
      shadowSpread: button ? 11 : 14,
      shadowOffsetY: button ? 2 : 3,
      // Keep clickable profile controls clickable. Their visual floating motion
      // is CSS-driven; LiquidGlass's `floating:true` is drag mode and calls
      // preventDefault on pointerdown, which is wrong for navigation buttons.
      floating: false,
      button: button || profileButton
    };
  }

  function ensureSceneProxy(root) {
    root.classList.add('liquidglass-scene-root');

    let proxy = [...root.children].find((child) => child.classList?.contains('liquidglass-scene-proxy'));
    if (!proxy) {
      proxy = document.createElement('div');
      proxy.className = 'liquidglass-scene-proxy';
      proxy.setAttribute('aria-hidden', 'true');
      root.insertBefore(proxy, root.firstChild);
    }

    return proxy;
  }

  function collectGroups() {
    const activeScreen = document.querySelector('.screen.is-active[aria-hidden="false"]') || document.querySelector('.screen.is-active');
    if (!activeScreen) return [];

    const targets = [...activeScreen.querySelectorAll(surfaceSelector)].filter(isVisible);
    if (activeScreen.matches(surfaceSelector) && isVisible(activeScreen)) targets.unshift(activeScreen);

    targets.forEach((element) => {
      element.classList.add('liquidglass-preparing');
      element.dataset.config = JSON.stringify(configFor(element));
    });

    const groups = new Map();
    for (const element of targets) {
      const root = element.parentElement;
      if (!root) continue;
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(element);
    }

    return [...groups.entries()]
      .map(([root, elements]) => ({
        root,
        elements,
        proxy: ensureSceneProxy(root),
        depth: depthOf(root)
      }))
      .sort((a, b) => b.depth - a.depth)
      .slice(0, MAX_INSTANCES);
  }

  function removeSurfaceState() {
    document.querySelectorAll('.liquidglass-preparing,.liquidglass-ready').forEach((element) => {
      element.classList.remove('liquidglass-preparing', 'liquidglass-ready');
    });
    document.body.classList.remove('liquidglass-active');
  }

  function destroyInstances() {
    for (const record of instances.reverse()) {
      try { record.instance.destroy(); } catch (error) { console.warn('LiquidGlass destroy:', error); }
    }
    instances = [];
    removeSurfaceState();
  }

  function percentAt(rect, x, y) {
    return {
      x: ((x - rect.left) / Math.max(1, rect.width)) * 100,
      y: ((y - rect.top) / Math.max(1, rect.height)) * 100
    };
  }

  function nearRect(rect, x, y, margin = 320) {
    return x >= rect.left - margin && x <= rect.right + margin && y >= rect.top - margin && y <= rect.bottom + margin;
  }

  function applyPointerLighting() {
    pointerFrame = 0;

    for (const record of instances) {
      const rootRect = record.root.getBoundingClientRect();
      if (!rootRect.width || !rootRect.height) continue;

      const rootPoint = percentAt(rootRect, pointerX, pointerY);
      record.root.style.setProperty('--liquid-pointer-x', `${rootPoint.x.toFixed(2)}%`);
      record.root.style.setProperty('--liquid-pointer-y', `${rootPoint.y.toFixed(2)}%`);
      record.proxy.style.setProperty('--liquid-pointer-x', `${rootPoint.x.toFixed(2)}%`);
      record.proxy.style.setProperty('--liquid-pointer-y', `${rootPoint.y.toFixed(2)}%`);

      for (const element of record.elements) {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const point = percentAt(rect, pointerX, pointerY);
        element.style.setProperty('--liquid-pointer-x', `${point.x.toFixed(2)}%`);
        element.style.setProperty('--liquid-pointer-y', `${point.y.toFixed(2)}%`);
      }

      // The dotted proxy is part of the scene sampled by the shader. Re-render
      // nearby roots as the cursor light crosses them so the glow is refracted,
      // not merely painted on top of the glass.
      if (nearRect(rootRect, pointerX, pointerY)) {
        try { record.instance.markChanged(record.proxy); } catch {}
      }
    }
  }

  function queuePointerLighting(event) {
    if (event?.pointerType === 'touch') return;
    if (Number.isFinite(event?.clientX)) pointerX = event.clientX;
    if (Number.isFinite(event?.clientY)) pointerY = event.clientY;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointerLighting);
  }

  async function rebuild() {
    if (!LiquidGlass) return;
    if (rebuilding) {
      rebuildAgain = true;
      return;
    }

    rebuilding = true;
    rebuildAgain = false;
    destroyInstances();

    const groups = collectGroups();
    let initialized = 0;

    for (const group of groups) {
      try {
        const instance = await LiquidGlass.init({
          root: group.root,
          glassElements: group.elements,
          defaults: {
            blurAmount: 0.10,
            refraction: 0.84,
            chromAberration: 0.05,
            edgeHighlight: 0.24,
            specular: 0.30,
            fresnel: 0.96,
            distortion: 0.024,
            tintStrength: 0.07,
            shadowOpacity: 0.36
          }
        });
        instances.push({ ...group, instance });
        group.elements.forEach((element) => {
          element.classList.remove('liquidglass-preparing');
          element.classList.add('liquidglass-ready');
        });
        initialized += 1;
      } catch (error) {
        group.elements.forEach((element) => element.classList.remove('liquidglass-preparing'));
        console.warn('LiquidGlass init skipped for group:', error);
      }
    }

    if (initialized) document.body.classList.add('liquidglass-active');
    rebuilding = false;
    requestAnimationFrame(applyPointerLighting);

    if (rebuildAgain) scheduleRebuild(60);
  }

  function scheduleRebuild(delay = 100) {
    clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(rebuild, delay);
  }

  function mutationNeedsRebuild(mutations) {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) continue;
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.classList?.contains('liquidglass-scene-proxy')) continue;
        if (node.matches?.(surfaceSelector) || node.querySelector?.(surfaceSelector)) return true;
        if (node.matches?.('img')) node.draggable = false;
        node.querySelectorAll?.('img').forEach((image) => image.draggable = false);
      }
    }
    return false;
  }

  async function start() {
    installSelectionGuard();

    addEventListener('pointermove', queuePointerLighting, { passive: true });
    addEventListener('pointerdown', queuePointerLighting, { passive: true });
    addEventListener('resize', () => {
      pointerX = Math.min(pointerX, innerWidth);
      pointerY = Math.min(pointerY, innerHeight);
      if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointerLighting);
    }, { passive: true });

    try {
      const module = await import(LIQUID_GLASS_URL);
      LiquidGlass = module.LiquidGlass;
    } catch (error) {
      console.error('LiquidGlass library failed to load:', error);
      return;
    }

    await rebuild();

    addEventListener('hashchange', () => scheduleRebuild(120));
    addEventListener('pageshow', () => scheduleRebuild(80));

    new MutationObserver((mutations) => {
      if (mutationNeedsRebuild(mutations)) scheduleRebuild(140);
    }).observe(document.body, { childList: true, subtree: true });
  }

  start();
})();
