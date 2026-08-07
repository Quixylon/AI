(() => {
  'use strict';

  const ARCHIVE_ANIMATION = 'archive-description-word-in 500ms cubic-bezier(.2, .8, .2, 1) forwards, archive-description-word-living 5.4s ease-in-out infinite';

  function applyArchiveWave() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    description.querySelectorAll('.description-word').forEach((word, index) => {
      const entryDelay = 170 + index * 45;
      const flowDelay = index * -180;

      word.style.setProperty('--word-index', String(index));
      word.style.setProperty('--word-entry-delay', `${entryDelay}ms`);
      word.style.setProperty('--word-flow-delay', `${flowDelay}ms`);
      word.style.setProperty('animation', ARCHIVE_ANIMATION, 'important');
      word.style.setProperty('animation-delay', `${entryDelay}ms, ${flowDelay}ms`, 'important');
      word.style.setProperty('animation-play-state', 'running', 'important');
    });
  }

  let observer;
  function attach() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    observer?.disconnect();
    observer = new MutationObserver(applyArchiveWave);
    observer.observe(description, { childList: true, subtree: true });
    applyArchiveWave();
  }

  attach();
  addEventListener('hashchange', attach);
  addEventListener('pageshow', attach);
  setTimeout(attach, 100);
  setTimeout(attach, 650);
  setInterval(applyArchiveWave, 3000);
})();
