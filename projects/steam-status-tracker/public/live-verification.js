(() => {
  'use strict';

  function installDescriptionWave() {
    const description = document.getElementById('profileDescription');
    if (!description) return;

    if (!description.querySelector('.description-word')) {
      const text = description.textContent.replace(/\s+/g, ' ').trim();
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

    const words = [...description.querySelectorAll('.description-word')];
    words.forEach((word, index) => {
      word.getAnimations?.().forEach((animation) => animation.cancel());
      word.style.setProperty('animation-delay', `${index * -130}ms`, 'important');
      word.style.setProperty('animation-name', 'verified-description-wave', 'important');
      word.style.setProperty('animation-duration', '2.8s', 'important');
      word.style.setProperty('animation-timing-function', 'ease-in-out', 'important');
      word.style.setProperty('animation-iteration-count', 'infinite', 'important');
      word.style.setProperty('animation-fill-mode', 'both', 'important');
      word.style.setProperty('animation-play-state', 'running', 'important');
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
    installDescriptionWave();
  }

  addEventListener('pageshow', apply);
  addEventListener('hashchange', apply);
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });

  apply();
  installDeployProof();
  setTimeout(apply, 250);
  setTimeout(apply, 1200);
})();
