// assets/js/musicam/modules/audio.js
// Façade robuste vers audio-engine.js + preset initial & re-push au resume().
// Compatible avec votre midi.js actuel (sans sendPitchBend14).
//
// Patch 2 — Pousser un preset audio au (re)start
// - expose window.audio pour l’audit
// - garantit setParams>0, FX et tempo poussés dès l’unlock audio

import {
  AudioEngine,
  setSynthParams as _engineSetParams,
  setTempoBPM as _engineSetTempoBPM,
  ensureRunning as _ensureInit,
  panicAll as _panicAll,
  releaseNote as _releaseNote,
  triggerNote as _triggerNote,
  setDelayFeedback,
  setDelaySend,
  setMasterGain,
  setReverbSend,
} from './audio-engine.js';
import * as MIDI from './midi.js';
import { state } from './state.js';

// ———————————————————————————————————————————————————————————
// Presets par défaut (doux et sûrs)
const DEFAULT_PATCH = {
  // oscillateurs & mix
  wave1: 'sawtooth', wave2: 'sine', morph: 0.20, harmonics: 0.00,
  // enveloppe (slider-flats mappés plus bas vers adsr:{a,d,s,r})
  adsrA: 0.008, adsrD: 0.10, adsrS: 0.06, adsrR: 0.14,
  // filtre
  cutoffHz: 2200, resonanceQ: 8, filterType: 'lowpass', filterPoles: 2,
  // mod & drive/stéréo
  fmRate: 0, fmDepth: 0, drive: 0.06, width: 0.25,
  // LFO & jeu
  lfoRate: 0, lfoDepth: 0, lfoTarget: 'freq',
  glide: 0, playMode: 'poly',
  // bend (pour synth interne si pas de MIDI)
  pitchBend: 0
};

const DEFAULT_FX = { master: 0.90, delay: 0.20, delayFB: 0.35, reverb: 0.15 };

// ———————————————————————————————————————————————————————————
// Helpers UI/bus
function _ctx()       { return AudioEngine?.ctx || null; }
function _isRunning() { return _ctx()?.state === 'running'; }
function _emitUiAudioState() {
  try {
    const running = _isRunning();
    window.dispatchEvent(new CustomEvent('mc:audio', {
      detail: { running, state: _ctx()?.state || '—' }
    }));
  } catch {}
}

// Assure un state cohérent + valeurs par défaut
function ensureStateDefaults() {
  if (!state.synth) state.synth = { ...DEFAULT_PATCH };
  if (!state.fx)    state.fx    = { ...DEFAULT_FX };
  if (typeof state.tempoBPM !== 'number') state.tempoBPM = 120;
  if (!state.activeNotes) state.activeNotes = new Map();
  if (!state.outputMode) state.outputMode = 'synth'; // 'synth' ou 'midi'
}

// ———————————————————————————————————————————————————————————
// Normalisation des paramètres UI → moteur
function normalizeSynthParams(params = {}) {
  const out = { ...(params || {}) };

  // regrouper adsrA/D/S/R -> adsr:{a,d,s,r}
  if ('adsrA' in out || 'adsrD' in out || 'adsrS' in out || 'adsrR' in out) {
    const prev = (state.synth?.adsr) || {};
    out.adsr = {
      a: ('adsrA' in out) ? +out.adsrA : (prev.a ?? 0.01),
      d: ('adsrD' in out) ? +out.adsrD : (prev.d ?? 0.18),
      s: ('adsrS' in out) ? +out.adsrS : (prev.s ?? 0.65),
      r: ('adsrR' in out) ? +out.adsrR : (prev.r ?? 0.30),
    };
    delete out.adsrA; delete out.adsrD; delete out.adsrS; delete out.adsrR;
  }

  // alias waves
  if ('wave1' in out) { out.wave = out.wave1; delete out.wave1; }

  // cutoffHz -> cutoff normalisé (log) + garde cutoffHz pour debug/audit
  if ('cutoffHz' in out) {
    const hz = Math.max(30, Math.min(20000, +out.cutoffHz || 2000));
    const lo = 80, hi = 15000;
    const norm = Math.max(0, Math.min(1, Math.log(hz/lo) / Math.log(hi/lo)));
    out.cutoff = norm;
    out.cutoffHz = hz;
  }

  return out;
}

// ———————————————————————————————————————————————————————————
// API de paramétrage (persiste dans state + envoie au moteur)
export function setSynthParams(params = {}) {
  ensureStateDefaults();
  const p = normalizeSynthParams(params);
  state.synth = { ...(state.synth || {}), ...p };
  try { _engineSetParams(p); } catch (e) { console.warn('[audio.js] setSynthParams engine fail', e); }
}

export function setFX(params = {}) {
  ensureStateDefaults();
  state.fx = { ...(state.fx || {}), ...params };
  if ('master'  in params) try { setMasterGain(+params.master); } catch {}
  if ('delay'   in params) try { setDelaySend(+params.delay); } catch {}
  if ('delayFB' in params) try { setDelayFeedback(+params.delayFB); } catch {}
  if ('reverb'  in params) try { setReverbSend(+params.reverb); } catch {}
}

export function setTempoBPM(bpm = 120) {
  ensureStateDefaults();
  state.tempoBPM = +bpm || 120;
  try { _engineSetTempoBPM(state.tempoBPM); } catch {}
}

export function setInstrument(name) { state.instrument = name; }
export function setOutputMode(mode) { state.outputMode = mode; }

// ———————————————————————————————————————————————————————————
// Notes (route vers MIDI si demandé et disponible, sinon synth)
export function noteOn(midi, vel = 0.85) {
  ensureStateDefaults();
  const id = `${midi}`;
  if (_isRunning() && state.outputMode === 'midi' && typeof MIDI.midiNoteOn === 'function' && (MIDI.hasMIDI?.() ?? false)) {
    try { MIDI.midiNoteOn(midi, Math.round(Math.max(0, Math.min(127, vel <= 1 ? vel*127 : vel)))); } catch {}
  } else if (_isRunning()) {
    if (typeof AudioEngine.noteOn === 'function') AudioEngine.noteOn(midi, vel);
    else _triggerNote(midi, vel);
  }
  state.activeNotes.set(id, { t: performance.now(), vel });
}

export function noteOff(midi) {
  ensureStateDefaults();
  const id = `${midi}`;
  if (_isRunning() && state.outputMode === 'midi' && typeof MIDI.midiNoteOff === 'function' && (MIDI.hasMIDI?.() ?? false)) {
    try { MIDI.midiNoteOff(midi); } catch {}
  } else if (_isRunning()) {
    if (typeof AudioEngine.noteOffNote === 'function') AudioEngine.noteOffNote(midi);
    else _releaseNote(midi);
  }
  state.activeNotes.delete(id);
}

export function stopAllVoices() {
  try {
    if (typeof AudioEngine.allNotesOff === 'function') return AudioEngine.allNotesOff();
    return _panicAll();
  } catch {}
}

// Pitch bend : si midi.js expose sendPitchBend14 → utilise-le, sinon bend interne synth
export function setPitchBend(semitones = 0, range = 2) {
  ensureStateDefaults();
  if (state.outputMode === 'midi' && (MIDI.hasMIDI?.() ?? false) && typeof MIDI.sendPitchBend14 === 'function') {
    // map [-range..+range] -> [0..16383] (8192 centre)
    const s = Math.max(-range, Math.min(range, +semitones));
    const val14 = Math.round(8192 + (s / range) * 8192);
    try { MIDI.sendPitchBend14(val14); } catch {}
  } else {
    setSynthParams({ pitchBend: semitones });
  }
}

// ———————————————————————————————————————————————————————————
// Cycle de vie Audio
export async function ensureAudioRunning() {
  try { await _ensureInit(); }
  catch (e) { console.warn('[audio.js] ensureAudioRunning failed', e); }
  finally { _emitUiAudioState(); }
  return _ctx();
}

export async function start() {
  ensureStateDefaults();
  try {
    await _ensureInit();
    if (_ctx()?.state === 'suspended') await AudioEngine.resume();
  } catch (e) {
    console.error('[audio.js] start() failed', e);
  } finally {
    // — push preset + FX + tempo pour garantir "params sent: >0"
    try {
      setSynthParams({ ...state.synth });
      setFX({ ...state.fx });
      setTempoBPM(state.tempoBPM);
    } catch (e2) {
      console.warn('[audio.js] re-apply after start failed', e2);
    }
    _emitUiAudioState();
  }
  return _ctx();
}

export async function resume() {
  ensureStateDefaults();
  try {
    await _ensureInit();
    await AudioEngine.resume();
  } catch (e) {
    console.error('[audio.js] resume() failed', e);
  } finally {
    try {
      setSynthParams({ ...state.synth });
      setFX({ ...state.fx });
      setTempoBPM(state.tempoBPM);
    } catch {}
    _emitUiAudioState();
  }
  return _ctx();
}

export async function suspend() {
  try { await AudioEngine.suspend(); }
  catch (e) { console.error('[audio.js] suspend() failed', e); }
  finally { _emitUiAudioState(); }
}

export async function stop({ panic = false } = {}) {
  try {
    if (panic) { try { _panicAll(); } catch {} }
    await AudioEngine.suspend();
  } catch (e) {
    console.error('[audio.js] stop() failed', e);
  } finally {
    _emitUiAudioState();
  }
}

// Debug console (optionnel) — l’audit hooke window.audio.*
try {
  const API = {
    start, resume, suspend, ensureAudioRunning,
    setSynthParams, setFX, setTempoBPM, setInstrument, setOutputMode,
    noteOn, noteOff, stopAllVoices, setPitchBend,
    DEFAULT_PATCH, DEFAULT_FX, state
  };
  window.AudioAPI = API;
  window.audio    = API;
} catch {}
