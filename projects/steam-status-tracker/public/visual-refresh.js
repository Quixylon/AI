(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const set = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
  let scheduled = 0;
  let linksSignature = '';

  // Preserve the existing profile, integrations and full, bounded histories.
  function prepareInterface() {
    set($('trackerTitle'), 'Трекер');
    set($('trackerEyebrow'), 'QUIXYLON');
    ['refreshAllButton', 'retrySteamButton', 'retryDiscordButton', 'retryTelegramButton'].forEach(id => $(id)?.remove());
    document.querySelectorAll('.tech-details,.global-tech-details,.history-controls,.history-range,.tracker-statusbar').forEach(node => node.remove());
    document.querySelectorAll('#steamView .data-item').forEach(node => {
      const label = node.querySelector('.data-item__label');
      if (!label) return;
      if (['personaState', 'App ID', 'Последнее обновление'].includes(label.textContent.trim())) node.remove();
      else if (label.textContent.trim() === 'SteamID64') label.textContent = 'Steam ID';
    });
    for (const timeline of document.querySelectorAll('.timeline')) {
      timeline.tabIndex = 0;
      timeline.setAttribute('role', 'region');
      const title = timeline.closest('.history-panel')?.querySelector('h3');
      if (title?.id) timeline.setAttribute('aria-labelledby', title.id);
    }
    document.querySelectorAll('img').forEach(image => { image.draggable = false; });
  }

  function description() {
    const node = $('profileDescription');
    if (!node || node.querySelector('.description-char')) return;
    const value = node.textContent.replace(/\s+/g, ' ').trim();
    if (!value) return;
    node.setAttribute('aria-label', value);
    const fragment = document.createDocumentFragment();
    let order = 0;
    value.split(' ').forEach((text, index) => {
      if (index) fragment.append(' ');
      const word = document.createElement('span');
      word.className = 'description-word';
      word.setAttribute('aria-hidden', 'true');
      for (const letter of Array.from(text)) {
        const character = document.createElement('span');
        character.className = 'description-char';
        character.style.setProperty('--char-order', order++);
        character.textContent = letter;
        word.append(character);
      }
      fragment.append(word);
    });
    node.replaceChildren(fragment);
  }

  function integrationLabels() {
    for (const platform of ['discord', 'telegram']) {
      if (state[platform]?.status?.configured !== false) continue;
      const title = platform === 'discord' ? 'Discord' : 'Telegram';
      set($(`${platform}OverviewBadge`), 'В процессе');
      $(`${platform}OverviewBadge`)?.setAttribute('data-state', 'progress');
      set($(`${platform}OverviewStatus`), 'В процессе');
      set($(`${platform}OverviewActivity`), 'Интеграция разрабатывается');
      set($(`${platform}DetailMainStatus`), 'В процессе');
      set($(platform === 'discord' ? 'discordCustomStatus' : 'telegramLastSeenText'), `Интеграция ${title} разрабатывается`);
    }
    const checkedAt = state.steam.status?.checkedAt;
    if (checkedAt) set($('trackerLastUpdate'), `Синхронизация: ${formatDateTime(checkedAt)}`);
  }

  function histories() {
    let steamChanged = false;
    for (const key of ['steamGames', 'steamPresence', 'discord', 'telegram']) {
      const view = state.historyView[key];
      if (!view || view.visible === 10000) continue;
      view.visible = 10000;
      if (key.startsWith('steam')) steamChanged = true;
      else if (key === 'discord') renderDiscordHistory();
      else renderTelegramHistory();
    }
    if (steamChanged) renderSteamHistory();
  }

  function apply() {
    scheduled = 0;
    description();
    integrationLabels();
    histories();
    const signature = [...document.querySelectorAll('.social-link')].map(node => node.dataset.key).join('|');
    if (signature !== linksSignature) {
      linksSignature = signature;
      motionController.registerAll();
    }
  }
  function schedule(records) {
    // Duration counters update once per second; those changes need no layout work.
    if (Array.isArray(records) && records.every(record => record.target.nodeType === 1 && record.target.matches('[data-live-duration],#visitorCount'))) return;
    if (!scheduled) scheduled = requestAnimationFrame(apply);
  }

  prepareInterface();
  motionController.registerAll();
  apply();
  const observer = new MutationObserver(schedule);
  observer.observe(document.querySelector('.app-shell'), { childList: true, subtree: true });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => motionController.measureSoon()) : null;
  if ($('profileCard')) resizeObserver?.observe($('profileCard'));
  if (document.querySelector('.tracker-layout')) resizeObserver?.observe(document.querySelector('.tracker-layout'));

  addEventListener('hashchange', () => {
    motionController.reset(true);
    canvasController.leave();
    document.querySelectorAll('.timeline').forEach(node => { node.scrollTop = 0; });
    window.scrollTo({ top: 0, behavior: 'instant' });
    motionController.measureSoon();
    schedule();
  });
  const visibility = () => {
    document.documentElement.classList.toggle('page-paused', document.hidden);
    if (document.hidden) {
      canvasController.leave();
      motionController.reset(true);
    }
  };
  document.addEventListener('visibilitychange', visibility);
  visibility();
  // pagehide/pageshow also cover the iOS back-forward cache.
  addEventListener('pagehide', () => { canvasController.stop(); motionController.reset(true); });
  addEventListener('pageshow', event => {
    if (event.persisted) {
      interactionHub.init();
      canvasController.resize();
      canvasController.resume();
      motionController.measureSoon();
      refreshManager.startPolling();
      startLiveTicker();
    }
  });
  document.documentElement.classList.remove('app-booting');
  document.documentElement.classList.add('app-ready');
})();

(() => {
  let archiveAudioContext = null;

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


  catController.playSound = async () => {
    const context = getArchiveAudioContext();
    if (context?.state === 'suspended') await context.resume();
    playArchiveMeow();
  };
})();
