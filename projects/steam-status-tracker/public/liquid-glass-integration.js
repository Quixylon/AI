(() => {
  'use strict';

  const LIQUID_GLASS_URL = 'https://cdn.jsdelivr.net/npm/@ybouane/liquidglass@1.0.3/dist/index.js';
  const MAX_INSTANCES = 14;

  const cardSelector = [
    '#profileCard',
    '.profile-intro-panel',
    '.tracker-topbar',
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

  function isEditable(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    return Boolean(element?.closest('input, textarea, [contenteditable="true"]'));
  }

  function clearSelection() {
    const selection = window.getSelection?.();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
  }

  function installSelectionGuard() {
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

    document.addEventListener('pointerdown', (event) => {
      if (!isEditable(event.target)) clearSelection();
    }, true);

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

  function configFor(element) {
    const button = isButtonSurface(element);
    const isMainCard = element.id === 'profileCard';
    const isSmallButton = button && (element.matches('.copy-button,.filter-button,.tab-link,.back-link'));

    return {
      blurAmount: isMainCard ? 0.18 : button ? 0.16 : 0.21,
      refraction: isMainCard ? 0.48 : button ? 0.74 : 0.61,
      chromAberration: button ? 0.035 : 0.026,
      edgeHighlight: button ? 0.16 : 0.11,
      specular: button ? 0.18 : 0.12,
      fresnel: button ? 0.92 : 0.78,
      distortion: button ? 0.018 : 0.012,
      cornerRadius: radiusOf(element, button ? 16 : 24),
      zRadius: isSmallButton ? 12 : button ? 17 : isMainCard ? 30 : 22,
      opacity: 0.97,
      saturation: 0.08,
      tintStrength: 0.055,
      brightness: -0.015,
      shadowOpacity: button ? 0.24 : 0.32,
      shadowSpread: button ? 8 : 12,
      shadowOffsetY: button ? 1 : 2,
      floating: false,
      button
    };
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
      .map(([root, elements]) => ({ root, elements, depth: depthOf(root) }))
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
    for (const instance of instances.reverse()) {
      try { instance.destroy(); } catch (error) { console.warn('LiquidGlass destroy:', error); }
    }
    instances = [];
    removeSurfaceState();
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
            blurAmount: 0.18,
            refraction: 0.64,
            chromAberration: 0.03,
            edgeHighlight: 0.12,
            specular: 0.14,
            fresnel: 0.82,
            tintStrength: 0.05,
            shadowOpacity: 0.28
          }
        });
        instances.push(instance);
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
        if (node.matches?.(surfaceSelector) || node.querySelector?.(surfaceSelector)) return true;
        if (node.matches?.('img')) node.draggable = false;
        node.querySelectorAll?.('img').forEach((image) => image.draggable = false);
      }
    }
    return false;
  }

  async function start() {
    installSelectionGuard();

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
