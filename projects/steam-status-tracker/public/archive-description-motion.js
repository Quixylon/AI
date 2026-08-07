(() => {
  'use strict';

  function applyWordDelays() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    description.querySelectorAll('.description-word').forEach((word, index) => {
      word.style.setProperty('--word-index', String(index));
      word.style.setProperty('--word-entry-delay', `${170 + index * 45}ms`);
      word.style.setProperty('--word-flow-delay', `${index * -180}ms`);
    });
  }

  let observer;
  function attach() {
    const description = document.getElementById('profileDescription');
    if (!description) return;
    observer?.disconnect();
    observer = new MutationObserver(applyWordDelays);
    observer.observe(description, { childList: true });
    applyWordDelays();
  }

  attach();
  addEventListener('hashchange', attach);
  addEventListener('pageshow', attach);
  setTimeout(attach, 500);
})();