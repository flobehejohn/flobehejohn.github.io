// assets/js/musicam/modules/audio-engine.js
// Pont haut-niveau vers le worklet "flomo-voice-bank" + petit rack FX (master/delay/reverb).
// - Zéro son avant geste utilisateur (resume()).
// - Mémorise les derniers params (lastParams) et les renvoie après resume().
// - API: ensureRunning/resume/suspend, setSynthParams, triggerNote/releaseNote/panicAll,
//        setTempoBPM (+ division), setMasterGain/DelaySend/DelayFeedback/ReverbSend,
//        retune(freq, glideMs), setPitchBendSemitones(), sendPitchBend14().
// - Tolérant et idempotent.


const WORKLET_URL = new URL('../worklets/flomo-voice-bank.js', import.meta.url);
const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---------- Contexte & graph ----------
let ctx = null;
let node = null;            // AudioWorkletNode
let port = null;            // node.port
let dest = null;

// FX (dry + 2 sends)
let masterGain = null;
let delaySend = null, delayNode = null, delayFB = null;
let reverbSend = null, reverbNode = null;

// Tempo & delay
let tempoBPM = 120;
let delayDivision = 1/8; // noire = 1/1, croche = 1/2, double-croche = 1/4, etc.

// Cache des derniers paramètres envoyés au worklet
let lastParams = {};

// (optionnel) notif UI état audio
function _emitAudioState() {
  try {
    window.dispatchEvent(new CustomEvent('mc:audio', {
      detail: { running: ctx?.state === 'running', state: ctx?.state || '—' }
    }));
  } catch {}
}

// petite IR de réverb “cheap” (bruit décroissant)
function _createNoiseIR(seconds = 2.0) {
  const rate = ctx.sampleRate || 48000;
  const len = Math.max(1, Math.floor(seconds * rate));
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let a = 1.0;
    const decay = Math.pow(10, -3) ** (1 / len);
    for (let i = 0; i < len; i++) { data[i] = (Math.random() * 2 - 1) * a; a *= decay; }
  }
  return ir;
}

async function _ensureGraph() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  if (!dest) dest = ctx.destination;

  if (!node) {
    // 1) charger le worklet
    await ctx.audioWorklet.addModule(WORKLET_URL);
    node = new AudioWorkletNode(ctx, 'flomo-voice-bank', { numberOfOutputs: 1, outputChannelCount: [2] });
    port = node.port;

    // 2) debug (facultatif)
    try {
      port.onmessage = (e) => {
        const d = e.data || {};
        if (d.type === 'debug') {
          // relay vers l’UI ou la console si besoin
          window.dispatchEvent(new CustomEvent('mc:workletDebug', { detail: d }));
        }
      };
    } catch {}

    // 3) FX graph (dry + sends)
    masterGain = ctx.createGain(); masterGain.gain.value = 0.9;

    delaySend = ctx.createGain();  delaySend.gain.value = 0.0;
    delayNode = ctx.createDelay(2.0);
    delayFB   = ctx.createGain();  delayFB.gain.value = 0.25;
    delayNode.connect(delayFB); delayFB.connect(delayNode); // boucle FB

    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.0;
    reverbNode = ctx.createConvolver();
    try { reverbNode.buffer = _createNoiseIR(2.2); } catch {}

    // câblage
    node.connect(masterGain);      // dry
    node.connect(delaySend);       // send delay
    node.connect(reverbSend);      // send reverb

    delaySend.connect(delayNode);
    delayNode.connect(masterGain);

    reverbSend.connect(reverbNode);
    reverbNode.connect(masterGain);

    masterGain.connect(dest);
  }

  // 4) Si on a déjà des params, renvoie un snapshot de sécu
  if (port && lastParams && Object.keys(lastParams).length) {
    try { port.postMessage({ type: 'setParams', params: lastParams }); } catch {}
  }

  // 5) Applique tempo/delay courants
  _applyTempoToDelay();
}

function _applyTempoToDelay() {
  if (!delayNode || !ctx) return;
  // durée = (60/bpm) * division (ex: 1/8 → croche = (60/bpm)/2, 1/4 → double-croche)
  // Ici on choisit division comme "fraction de noire": noire=1 → 60/bpm ; croche=1/2 → (60/bpm)/2 ; etc.
  const target = (60 / (tempoBPM || 120)) * delayDivision;
  try { delayNode.delayTime.setTargetAtTime(target, ctx.currentTime, 0.05); }
  catch { delayNode.delayTime.value = target; }
}

// ---------- API publique ----------
export async function ensureRunning() {
  await _ensureGraph();
  return ctx;
}

export async function resume() {
  await _ensureGraph();
  if (ctx.state === 'suspended') await ctx.resume();
  // re-push des params après reprise (critique)
  try { if (port && lastParams) port.postMessage({ type: 'setParams', params: lastParams }); } catch {}
  _emitAudioState();
  return ctx;
}

export async function suspend() {
  if (!ctx) return;
  try { await ctx.suspend(); } catch (e) { console.warn('[AudioEngine] suspend failed', e); }
  _emitAudioState();
}

// ---------- Synth params ----------
export function setSynthParams(params = {}) {
  if (!port) return;
  // merge côté app (permet alias/typage tolérant côté Worklet)
  lastParams = { ...(lastParams || {}), ...(params || {}) };
  try { port.postMessage({ type: 'setParams', params: lastParams }); }
  catch (e) { console.warn('[AudioEngine] setSynthParams failed', e); }
}

// ---------- Notes ----------
export function triggerNote(midi = 60, vel = 0.9) {
  if (!port) return;
  try { port.postMessage({ type: 'noteOn', midi:+midi, vel:+vel, freq: midiToHz(+midi) }); }
  catch (e) { console.warn('[AudioEngine] triggerNote failed', e); }
}
export function releaseNote(midi) {
  if (!port) return;
  try { port.postMessage({ type: 'noteOff', midi: (typeof midi === 'number') ? +midi : null }); }
  catch (e) { console.warn('[AudioEngine] releaseNote failed', e); }
}
export function panicAll() { if (port) try { port.postMessage({ type:'noteOff', midi:null }); } catch {} }

// ---------- Pitch / retune ----------
/** Retune continu (utile pour mappings “theremin”, etc.). */
export function retune(freqHz = 0, glideMs = null) {
  if (!port) return;
  const msg = { type: 'retune' };
  if (freqHz > 0) msg.freq = +freqHz;
  if (glideMs != null) msg.glideSec = Math.max(0, (+glideMs)/1000);
  try { port.postMessage(msg); } catch {}
}

/** Pitch bend en demi-tons (le Worklet lisse via le suiveur global). */
export function setPitchBendSemitones(semitones = 0) {
  setSynthParams({ pitchBend: +semitones });
}

/** Pitch bend MIDI 14 bits → demi-tons (+/-range). value=0..16383, rangeSemitones=2 par défaut. */
export function sendPitchBend14(value = 8192, rangeSemitones = 2) {
  const v = Math.max(0, Math.min(16383, value|0));
  const norm = (v - 8192) / 8192; // -1..+1
  setPitchBendSemitones(norm * (rangeSemitones || 2));
}

// ---------- FX / Tempo ----------
export function setTempoBPM(bpm = 120) { tempoBPM = +bpm || 120; _applyTempoToDelay(); }
/** Change la division du delay par rapport à la noire. Ex: 1/8 = croche, 1/4 = double-croche, 3/8 = croche pointée. */
export function setDelayDivision(frac = 1/8) { delayDivision = Math.max(1/64, +frac || 1/8); _applyTempoToDelay(); }

export function setMasterGain(v = 0.9) {
  if (!masterGain || !ctx) return;
  const g = Math.max(0, Math.min(1.5, +v || 0));
  try { masterGain.gain.setTargetAtTime(g, ctx.currentTime, 0.035); } catch { masterGain.gain.value = g; }
}
export function setDelaySend(v = 0) {
  if (!delaySend || !ctx) return;
  const g = Math.max(0, Math.min(1, +v || 0));
  try { delaySend.gain.setTargetAtTime(g, ctx.currentTime, 0.05); } catch { delaySend.gain.value = g; }
}
export function setDelayFeedback(v = 0.25) {
  if (!delayFB || !ctx) return;
  const g = Math.max(0, Math.min(0.95, +v || 0));
  try { delayFB.gain.setTargetAtTime(g, ctx.currentTime, 0.05); } catch { delayFB.gain.value = g; }
}
export function setReverbSend(v = 0) {
  if (!reverbSend || !ctx) return;
  const g = Math.max(0, Math.min(1, +v || 0));
  try { reverbSend.gain.setTargetAtTime(g, ctx.currentTime, 0.05); } catch { reverbSend.gain.value = g; }
}

// helpers “compat” (audio.js peut appeler AudioEngine.noteOn/NoteOff)
function _noteOn(m, v) { return triggerNote(m, v); }
function _noteOff(m)   { return releaseNote(m); }
function _allOff()     { return panicAll(); }

// Objet utilitaire (utilisé par audio.js)
export const AudioEngine = {
  get ctx()   { return ctx; },
  get node()  { return node; },
  get graph() { return { masterGain, delaySend, delayFB, delayNode, reverbSend, reverbNode }; },
  resume, suspend,
  noteOn: _noteOn,
  noteOffNote: _noteOff,
  allNotesOff: _allOff,
};

// Expose optionnel pour audit console
try { window.AudioEngine = AudioEngine; } catch {}
export { midiToHz };

