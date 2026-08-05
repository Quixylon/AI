const cat = document.querySelector('#dancing-cat');

let audioContext = null;
let reactionTimer = 0;
let reactionAnimation = null;

function getAudioContext() {
  if (audioContext) return audioContext;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  audioContext = new AudioContextClass();
  return audioContext;
}

function playMeow() {
  const context = getAudioContext();
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

function playJumpAnimation() {
  if (!cat) return;

  reactionAnimation?.cancel();

  if (typeof cat.animate === 'function') {
    reactionAnimation = cat.animate(
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
    return;
  }

  window.clearTimeout(reactionTimer);
  cat.classList.remove('is-meowing');
  void cat.offsetWidth;
  cat.classList.add('is-meowing');
  reactionTimer = window.setTimeout(() => cat.classList.remove('is-meowing'), 980);
}

function react() {
  if (!cat) return;

  cat.classList.add('is-hint-dismissed');
  playJumpAnimation();

  const context = getAudioContext();
  if (context?.state === 'suspended') {
    context.resume().then(playMeow).catch(() => {});
  } else {
    playMeow();
  }

  if (typeof navigator.vibrate === 'function') navigator.vibrate(18);
}

if (cat) {
  cat.addEventListener('click', react);
}
