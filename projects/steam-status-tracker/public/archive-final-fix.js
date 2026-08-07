(() => {
  'use strict';

  function stopCompetingBackground() {
    const q = window.QPolish;

    try {
      q?.background?.stop?.();
      if (q?.background) {
        q.background.start = () => {};
      }
    } catch {}

    try {
      if (typeof canvasController !== 'undefined') {
        canvasController.stop?.();
        canvasController.destroy?.();
        canvasController.start = () => {};
        canvasController.resume = () => {};
        canvasController.setPointer = () => {};
        canvasController.setDown = () => {};
      }
    } catch {}

    document.querySelectorAll('.refraction-canvas').forEach((canvas) => canvas.remove());
  }

  function forceArchiveWave() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    description.querySelectorAll('.description-word').forEach((word, index) => {
      const entry = 170 + index * 45;
      const flow = index * -180;

      word.style.setProperty('--word-entry-delay', `${entry}ms`);
      word.style.setProperty('--word-flow-delay', `${flow}ms`);
      word.style.setProperty('animation', 'archive-description-word-in 500ms cubic-bezier(.2,.8,.2,1) forwards, archive-description-word-living 5.4s ease-in-out infinite', 'important');
      word.style.setProperty('animation-delay', `${entry}ms, ${flow}ms`, 'important');
      word.style.setProperty('animation-play-state', 'running', 'important');
    });
  }

  function apply() {
    stopCompetingBackground();
    forceArchiveWave();

    const archive = window.QPolish?.archiveBackground;
    try { archive?.start?.(); } catch {}
  }

  apply();
  addEventListener('pageshow', apply);
  addEventListener('hashchange', apply);
  setTimeout(apply, 120);
  setTimeout(apply, 700);
  setTimeout(apply, 1800);

  new MutationObserver(() => requestAnimationFrame(apply)).observe(document.body, {
    childList: true,
    subtree: true
  });
})();
