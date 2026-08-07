(() => {
  'use strict';

  const glassSelectors = [
    '#profileCard',
    '.tracker-topbar',
    '.tracker-tabs',
    '.platform-card',
    '.detail-card',
    '.stats-card',
    '.history-panel',
    '.timeline-entry',
    '.social-link',
    '.action-button',
    '.ghost-button',
    '.back-link',
    '.tab-link',
    '.filter-button',
    '.copy-button',
    '.status-pill',
    '.mini-badge'
  ].join(',');

  function stopCompetingCanvas() {
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

    try {
      if (typeof interactionHub !== 'undefined') interactionHub.destroy?.();
    } catch {}

    try {
      const refraction = window.QPolish?.refraction;
      if (refraction?.raf) cancelAnimationFrame(refraction.raf);
      refraction?.items?.forEach?.((item) => item?.cv?.remove?.());
      refraction?.items?.clear?.();
      if (refraction) {
        refraction.raf = 0;
        refraction.scan = () => {};
        refraction.add = () => {};
        refraction.draw = () => {};
        refraction.loop = () => {};
      }
    } catch {}

    document.querySelectorAll('.refraction-canvas').forEach((canvas) => canvas.remove());
  }

  function installGlass(root = document) {
    root.querySelectorAll(glassSelectors).forEach((element) => {
      element.classList.add('backup-glass');
    });
  }

  function updateGlassShine(event) {
    const element = document.elementsFromPoint(event.clientX, event.clientY)
      .find((candidate) => candidate.classList?.contains('backup-glass'));
    if (!element) return;

    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
    const y = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
    element.style.setProperty('--backup-shine-x', `${x}%`);
    element.style.setProperty('--backup-shine-y', `${y}%`);
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

  function installExactDescriptionWave() {
    const description = ensureDescriptionWords();
    if (!description) return;

    const words = [...description.querySelectorAll('.description-word')];
    const signature = `${description.textContent.trim()}::${words.length}`;
    if (description.dataset.backupExactWave === signature && words.every((word) => word.dataset.backupExactWave === '1')) return;

    description.dataset.backupExactWave = signature;

    words.forEach((word, index) => {
      word.getAnimations?.().forEach((animation) => animation.cancel());
      word.dataset.backupExactWave = '1';
      word.style.setProperty('--word-index', String(index));
      word.style.setProperty('--word-entry-delay', `${170 + index * 45}ms`);
      word.style.setProperty('--word-flow-delay', `${index * -180}ms`);

      if (typeof word.animate !== 'function') {
        word.style.setProperty(
          'animation',
          'backup-description-word-in 500ms cubic-bezier(.2,.8,.2,1) forwards, backup-description-word-living 5.4s ease-in-out infinite',
          'important'
        );
        word.style.setProperty('animation-delay', `${170 + index * 45}ms, ${index * -180}ms`, 'important');
        return;
      }

      // Exact archived entrance from refinements.css.
      word.animate(
        [
          { opacity: 0, filter: 'blur(4px)', transform: 'translateY(7px)' },
          { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' }
        ],
        {
          duration: 500,
          delay: 170 + index * 45,
          easing: 'cubic-bezier(.2, .8, .2, 1)',
          fill: 'forwards'
        }
      );

      // Exact archived living wave from main-card-effects.css, with the
      // original description-motion.js phase shift of -180 ms per word.
      word.animate(
        [
          { offset: 0, color: '#c7ccd7', textShadow: '0 0 0 rgba(172,159,255,0)' },
          { offset: 0.42, color: '#e2e4ec', textShadow: '0 0 10px rgba(172,159,255,.11)' },
          { offset: 0.58, color: '#d3d6e0', textShadow: '0 0 6px rgba(104,197,255,.07)' },
          { offset: 1, color: '#c7ccd7', textShadow: '0 0 0 rgba(172,159,255,0)' }
        ],
        {
          duration: 5400,
          delay: index * -180,
          iterations: Infinity,
          easing: 'ease-in-out',
          fill: 'both'
        }
      );
    });
  }

  let archiveAudioContext = null;
  let catReactionAnimation = null;

  function getArchiveAudioContext() {
    if (archiveAudioContext) return archiveAudioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    archiveAudioContext = new AudioContextClass();
    return archiveAudioContext;
  }

  function playArchiveMeow() {
    const context = getArchiveAudioContext();
    if (!context) return;

    const start = context.currentTime + 0.01;
    const finish = start + 0.52;
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const voice = context.createOscillator();
    const overtone = context.createOscillator();
    const overtoneGain = context.createGain();
    const vibrato = context.createOscillator();
    const vibratoGain = context.createGain();

    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(0.18, start + 0.045);
    master.gain.exponentialRampToValueAtTime(0.115, start + 0.22);
    master.gain.exponentialRampToValueAtTime(0.0001, finish);

    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.2, start);
    filter.frequency.setValueAtTime(1450, start);
    filter.frequency.exponentialRampToValueAtTime(2050, start + 0.13);
    filter.frequency.exponentialRampToValueAtTime(1050, finish);

    voice.type = 'triangle';
    voice.frequency.setValueAtTime(430, start);
    voice.frequency.exponentialRampToValueAtTime(760, start + 0.12);
    voice.frequency.exponentialRampToValueAtTime(610, start + 0.25);
    voice.frequency.exponentialRampToValueAtTime(330, finish);

    overtone.type = 'sine';
    overtone.detune.setValueAtTime(8, start);
    overtone.frequency.setValueAtTime(860, start);
    overtone.frequency.exponentialRampToValueAtTime(1450, start + 0.12);
    overtone.frequency.exponentialRampToValueAtTime(650, finish);
    overtoneGain.gain.setValueAtTime(0.055, start);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, finish);

    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(22, start);
    vibratoGain.gain.setValueAtTime(0, start);
    vibratoGain.gain.linearRampToValueAtTime(18, start + 0.09);
    vibratoGain.gain.linearRampToValueAtTime(7, finish);

    vibrato.connect(vibratoGain);
    vibratoGain.connect(voice.frequency);
    voice.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(master);
    master.connect(context.destination);

    voice.start(start);
    overtone.start(start);
    vibrato.start(start);
    voice.stop(finish + 0.02);
    overtone.stop(finish + 0.02);
    vibrato.stop(finish + 0.02);
  }

  function playArchiveCatJump(cat) {
    catReactionAnimation?.cancel?.();
    cat.classList.add('backup-cat-reacting');

    if (typeof cat.animate !== 'function') {
      window.setTimeout(() => cat.classList.remove('backup-cat-reacting'), 980);
      return;
    }

    catReactionAnimation = cat.animate(
      [
        { transform: 'translateY(0) rotate(0deg) scale(1)', offset: 0 },
        { transform: 'translateY(-7px) rotate(-3deg) scale(1.08)', offset: 0.24 },
        { transform: 'translateY(-5px) rotate(2deg) scale(1.06)', offset: 0.5 },
        { transform: 'translateY(-2px) rotate(-1deg) scale(1.025)', offset: 0.76 },
        { transform: 'translateY(0) rotate(0deg) scale(1)', offset: 1 }
      ],
      {
        duration: 980,
        easing: 'cubic-bezier(.22,.72,.24,1)',
        iterations: 1
      }
    );

    catReactionAnimation.onfinish = () => cat.classList.remove('backup-cat-reacting');
    catReactionAnimation.oncancel = () => cat.classList.remove('backup-cat-reacting');
  }

  async function archiveCatReact() {
    const cat = document.getElementById('catButton');
    if (!cat) return;

    playArchiveCatJump(cat);
    const context = getArchiveAudioContext();
    if (context?.state === 'suspended') {
      try {
        await context.resume();
        playArchiveMeow();
      } catch {}
    } else {
      playArchiveMeow();
    }

    if (typeof navigator.vibrate === 'function') navigator.vibrate(18);
  }

  function installExactCat() {
    const cat = document.getElementById('catButton');
    if (!cat) return;

    if (cat.textContent !== '🐈') cat.textContent = '🐈';
    cat.title = 'Мяу';
    cat.setAttribute('aria-label', 'Мяукнуть');
    document.getElementById('catHint')?.setAttribute('hidden', '');

    // The existing click listener in experience-5.js calls catController.meow()
    // dynamically, so replacing the method avoids a second click handler and
    // guarantees that only the archived sound/animation runs.
    try {
      if (typeof catController !== 'undefined') {
        catController.meow = archiveCatReact;
        catController.playSound = async () => playArchiveMeow();
      }
    } catch {}
  }

  let frame = 0;
  function applyAll() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      stopCompetingCanvas();
      installGlass();
      installExactDescriptionWave();
      installExactCat();
      try { window.QPolish?.archiveBackground?.start?.(); } catch {}
    });
  }

  addEventListener('pointermove', updateGlassShine, { passive: true });
  addEventListener('hashchange', applyAll);
  addEventListener('pageshow', applyAll);

  new MutationObserver(applyAll).observe(document.body, {
    childList: true,
    subtree: true
  });

  applyAll();
  setTimeout(applyAll, 120);
  setTimeout(applyAll, 700);
  setTimeout(applyAll, 1800);
})();
