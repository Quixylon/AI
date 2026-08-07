(() => {
  'use strict';

  function installArchivedDescription() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    if (!description.querySelector('.description-word')) {
      const text = description.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return;
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

    description.querySelectorAll('.description-word').forEach((word, index) => {
      if (word.dataset.exactArchiveDescription === '1') return;

      // backup-exact-card.js installs Web Animations first. Remove them once,
      // then restart the literal archived CSS animation from a clean state.
      word.getAnimations?.().forEach((animation) => animation.cancel());
      word.style.setProperty('--word-index', String(index));
      word.style.setProperty('--word-entry-delay', `${170 + index * 45}ms`);
      word.style.setProperty('--word-flow-delay', `${index * -180}ms`);
      word.style.setProperty('animation', 'none', 'important');
      void word.offsetWidth;
      word.style.removeProperty('animation');
      word.dataset.exactArchiveDescription = '1';
    });
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

  function apply() {
    installGlass();
    installArchivedDescription();
  }

  // Deliberately no document-wide MutationObserver here: the live BUILD tick
  // changes every second and used to restart the text animation every second.
  addEventListener('pageshow', apply);
  addEventListener('hashchange', apply);

  apply();
  installDeployProof();
  setTimeout(apply, 250);
  setTimeout(apply, 1200);
})();
