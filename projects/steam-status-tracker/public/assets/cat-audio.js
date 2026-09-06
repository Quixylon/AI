const playProfileMeow = (() => {
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


  return async () => {
    const context = getArchiveAudioContext();
    if (context?.state === 'suspended') await context.resume();
    playArchiveMeow();
  };
})();
