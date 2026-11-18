// All sound is synthesised with WebAudio: no audio files, nothing to load.
// Engine hum, two-tone siren, gunshot, punch, pickup blips, mission jingle
// and a tiny bassline radio loop. Everything is guarded: in a headless run or
// before the first gesture there is no audio context and every call is a no-op.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let muted = false;
  let radioStep = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freqFrom, freqTo, seconds, type = 'sine', volume = 0.25) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqFrom, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), context.currentTime + seconds);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + seconds);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  // A short bassline loop in A minor, scheduled a step at a time.
  const BASSLINE = [55, 0, 55, 65.41, 0, 49, 0, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 0];
  function radioTick() {
    if (!context || muted) return;
    try {
      const note = BASSLINE[radioStep % BASSLINE.length];
      radioStep += 1;
      if (note > 0) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0.12, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(context.currentTime + 0.24);
      }
      if (radioStep % 4 === 0) {
        const hat = context.createBufferSource();
        hat.buffer = noiseBuffer(0.03);
        const gain = context.createGain();
        gain.gain.value = 0.05;
        hat.connect(gain);
        gain.connect(master);
        hat.start();
      }
    } catch {
      // Keep the loop alive even if one tick fails.
    }
  }

  return {
    unlock() { ensure(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    engine(on, speedRatio) {
      if (!ensure() || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      try {
        if (!engineOsc) {
          engineOsc = context.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = context.createGain();
          engineGain.gain.value = 0;
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speedRatio * 95;
        engineGain.gain.value = on ? 0.05 + speedRatio * 0.06 : 0;
      } catch {
        // Ignore.
      }
    },
    siren(on) {
      if (!ensure() || muted) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      try {
        if (!sirenOsc) {
          sirenOsc = context.createOscillator();
          sirenOsc.type = 'square';
          sirenGain = context.createGain();
          sirenGain.gain.value = 0;
          const lfo = context.createOscillator();
          lfo.frequency.value = 1.6;
          const lfoGain = context.createGain();
          lfoGain.gain.value = 140;
          lfo.connect(lfoGain);
          lfoGain.connect(sirenOsc.frequency);
          sirenOsc.frequency.value = 820;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          lfo.start();
        }
        sirenGain.gain.value = on ? 0.035 : 0;
      } catch {
        // Ignore.
      }
    },
    radio(on) {
      if (on && !radioTimer && ensure()) {
        radioTimer = window.setInterval(radioTick, 210);
      } else if (!on && radioTimer) {
        window.clearInterval(radioTimer);
        radioTimer = null;
      }
    },
    gunshot() {
      if (!ensure() || muted) return;
      try {
        const src = context.createBufferSource();
        src.buffer = noiseBuffer(0.14);
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, context.currentTime);
        filter.frequency.exponentialRampToValueAtTime(300, context.currentTime + 0.12);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.5, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start();
      } catch {
        // Ignore.
      }
    },
    punch() {
      if (!ensure() || muted) return;
      try {
        const src = context.createBufferSource();
        src.buffer = noiseBuffer(0.09);
        const filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 220;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.4, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start();
      } catch {
        // Ignore.
      }
    },
    pickup() { blip(880, 1320, 0.14, 'sine', 0.22); },
    cash() { blip(660, 660, 0.08, 'square', 0.12); blip(990, 990, 0.12, 'square', 0.12); },
    crash() {
      if (!ensure() || muted) return;
      try {
        const src = context.createBufferSource();
        src.buffer = noiseBuffer(0.22);
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.45, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start();
      } catch {
        // Ignore.
      }
    },
    jingle() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, freq, 0.22, 'triangle', 0.2), i * 110);
      });
    },
    busted() {
      [392, 330, 262].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, freq, 0.3, 'triangle', 0.2), i * 160);
      });
    },
  };
}
