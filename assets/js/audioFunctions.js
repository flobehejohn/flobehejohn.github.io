let audioCtx = null;
let reverbBuffer = null;
let hoverGainNode = null;

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    generateReverbBuffer();
    createHoverGainBus();
  }
}

function generateReverbBuffer() {
  const duration = 2 + Math.random() * 3;
  reverbBuffer = audioCtx.createBuffer(
    2,
    duration * audioCtx.sampleRate,
    audioCtx.sampleRate,
  );
  for (let ch = 0; ch < 2; ch++) {
    const data = reverbBuffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
    }
  }
}

function randomFreq(min, max) {
  return min + Math.random() * (max - min);
}

function createPanner3D() {
  const panner = audioCtx.createPanner();
  panner.panningModel = "HRTF";
  panner.setPosition(
    randomFreq(-1, 1),
    randomFreq(-0.3, 0.3),
    randomFreq(-0.5, 0.5),
  );
  return panner;
}

function createReverbChain(gainValue = 0.8) {
  const convolver = audioCtx.createConvolver();
  convolver.buffer = reverbBuffer;

  const reverbGain = audioCtx.createGain();
  reverbGain.gain.value = gainValue;

  convolver.connect(reverbGain);
  return { convolver, reverbGain };
}

function createHoverGainBus() {
  hoverGainNode = audioCtx.createGain();
  hoverGainNode.gain.value = 1.0;
  hoverGainNode.connect(audioCtx.destination);
}

// === SIDECHAIN ===
function triggerSidechain() {
  if (!hoverGainNode) return;
  const now = audioCtx.currentTime;
  hoverGainNode.gain.cancelScheduledValues(now);
  hoverGainNode.gain.setValueAtTime(hoverGainNode.gain.value, now);
  hoverGainNode.gain.linearRampToValueAtTime(0.2, now + 0.01); // attaque rapide
  hoverGainNode.gain.linearRampToValueAtTime(1.0, now + 0.25); // retour rapide
}

function playBufferSound(buffer, attack, release, volume = 0.08) {
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);

  const { convolver, reverbGain } = createReverbChain(0.9);
  const panner = createPanner3D();

  source
    .connect(gain)
    .connect(convolver)
    .connect(reverbGain)
    .connect(panner)
    .connect(audioCtx.destination);

  source.start();
  triggerSidechain(); // active le sidechain
}

function generateNoise(length) {
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// === Sons principaux
export function playOpenSound() {
  initAudio();
  playBufferSound(generateNoise(audioCtx.sampleRate * 1.5), 0.15, 1.4, 0.025);
}

export function playCloseSound() {
  initAudio();
  playBufferSound(generateNoise(audioCtx.sampleRate * 0.8), 0.1, 0.9, 0.02);
}

export function playTypingClick() {
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  osc.type = "triangle";
  osc.frequency.value = randomFreq(9000, 12000);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.015, now + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

  const panner = createPanner3D();
  osc.connect(gain).connect(panner).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.03);
  triggerSidechain();
}

// === Hover 3D filtré avec bus et spatialisation
export function playHoverSound() {
  initAudio();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  osc.type = "sine";
  osc.frequency.value = randomFreq(10000, 18000); // aigu mais pas ultra strident

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.04, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(8500, now);
  filter.Q.value = 1;

  const { convolver, reverbGain } = createReverbChain(0.6);
  const panner = createPanner3D();

  osc
    .connect(filter)
    .connect(gain)
    .connect(convolver)
    .connect(reverbGain)
    .connect(panner)
    .connect(hoverGainNode);

  osc.start(now);
  osc.stop(now + 0.15);
}
