const audio = document.querySelector('#profile-audio');
const card = document.querySelector('.music-card');
const toggle = document.querySelector('#music-toggle');
const progress = document.querySelector('#music-progress');
const currentTime = document.querySelector('#music-current-time');
const duration = document.querySelector('#music-duration');
const gate = document.querySelector('#sound-gate');
const gateButton = document.querySelector('#sound-gate-button');

let seeking = false;
let started = false;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function syncState() {
  const playing = !audio.paused && !audio.ended;
  card?.classList.toggle('is-playing', playing);
  toggle?.setAttribute('aria-label', playing ? 'Поставить музыку на паузу' : 'Включить музыку');
}

function syncProgress() {
  if (!seeking && Number.isFinite(audio.duration) && audio.duration > 0) {
    const value = Math.round((audio.currentTime / audio.duration) * 1000);
    progress.value = String(value);
    progress.style.setProperty('--audio-progress', `${value / 10}%`);
  }

  currentTime.textContent = formatTime(audio.currentTime);
  duration.textContent = formatTime(audio.duration);
}

function hideGate() {
  if (!gate || gate.hidden) return;
  gate.classList.add('is-closing');
  window.setTimeout(() => {
    gate.hidden = true;
    gate.classList.remove('is-closing');
  }, 380);
}

function showGate() {
  if (!gate) return;
  gate.hidden = false;
  gate.classList.remove('is-closing');
}

async function startAudio() {
  try {
    audio.volume = 0.72;
    await audio.play();
    started = true;
    hideGate();
    syncState();
    return true;
  } catch {
    showGate();
    syncState();
    return false;
  }
}

async function toggleAudio() {
  if (audio.paused) {
    await startAudio();
  } else {
    audio.pause();
  }
  syncState();
}

function startFromFirstInteraction(event) {
  if (started || !audio.paused) return;
  if (event?.target?.closest?.('a[href]')) return;
  startAudio();
}

toggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleAudio();
});

gateButton?.addEventListener('click', () => startAudio());

progress?.addEventListener('input', () => {
  seeking = true;
  const percent = Number(progress.value) / 10;
  progress.style.setProperty('--audio-progress', `${percent}%`);

  if (Number.isFinite(audio.duration)) {
    currentTime.textContent = formatTime((Number(progress.value) / 1000) * audio.duration);
  }
});

progress?.addEventListener('change', () => {
  if (Number.isFinite(audio.duration)) {
    audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
  }
  seeking = false;
  syncProgress();
});

audio.addEventListener('loadedmetadata', syncProgress);
audio.addEventListener('durationchange', syncProgress);
audio.addEventListener('timeupdate', syncProgress);
audio.addEventListener('play', syncState);
audio.addEventListener('pause', syncState);
audio.addEventListener('ended', syncState);
audio.addEventListener('error', () => {
  card?.classList.add('audio-error');
  currentTime.textContent = '—';
  duration.textContent = '—';
  showGate();
});

window.addEventListener('pointerdown', startFromFirstInteraction, { passive: true, once: true });
window.addEventListener('touchstart', startFromFirstInteraction, { passive: true, once: true });
window.addEventListener('keydown', startFromFirstInteraction, { once: true });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && started && audio.paused) startAudio();
});

startAudio();
