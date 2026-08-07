(() => {
  'use strict';

  const installed = new WeakMap();
  let frame = 0;

  function installWaveMotion() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    const words = [...description.querySelectorAll('.description-word')];
    if (!words.length) return;

    words.forEach((word, index) => {
      const current = installed.get(word);
      if (current && current.playState !== 'idle' && current.playState !== 'finished') return;
      if (typeof word.animate !== 'function') return;

      const animation = word.animate(
        [
          { offset: 0, transform: 'translateY(0)' },
          { offset: 0.42, transform: 'translateY(-1px)' },
          { offset: 0.58, transform: 'translateY(0.5px)' },
          { offset: 1, transform: 'translateY(0)' }
        ],
        {
          duration: 5400,
          delay: index * -180,
          iterations: Infinity,
          easing: 'ease-in-out',
          fill: 'both'
        }
      );

      installed.set(word, animation);
    });
  }

  function scheduleWaveMotion() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = 0;
        installWaveMotion();
      });
    });
  }

  addEventListener('pageshow', scheduleWaveMotion);
  addEventListener('hashchange', scheduleWaveMotion);

  new MutationObserver(scheduleWaveMotion).observe(document.body, {
    childList: true,
    subtree: true
  });

  scheduleWaveMotion();
  setTimeout(scheduleWaveMotion, 150);
  setTimeout(scheduleWaveMotion, 900);
})();
