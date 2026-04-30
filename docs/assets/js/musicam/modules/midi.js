// assets/js/musicam/modules/midi.js
// WebMIDI helper robuste : init, sélection d'output, NoteOn/Off, CC,
// PitchBend 14 bits (0..16383, centre=8192) + util en demi-tons (±range).
// Compatible avec plusieurs styles d'import (midiNoteOn/sendNoteOn, etc.)

let _access = null;
let _out = null;
let _tried = false;     // évite de redemander après refus (ex. Firefox sans add-on)
let _defaultChannel = 0;

// ———————————————————————————————————————————————————————————
// Init / état
// ———————————————————————————————————————————————————————————
export async function initMIDI() {
  // Si déjà tenté, renvoyer l’état sans relancer (UX stable sous Firefox)
  if (_tried) {
    const info = {
      enabled: !!_out,
      outputs: _access ? Array.from(_access.outputs.values()).map(o => ({ id:o.id, name:o.name })) : [],
      defaultName: _out?.name || null
    };
    _publishWindowState(info.enabled, info.defaultName, info.outputs);
    return info;
  }
  _tried = true;

  if (!('requestMIDIAccess' in navigator)) {
    console.info('[MIDI] WebMIDI unsupported → synth fallback');
    _access = null; _out = null;
    const info = { enabled:false, outputs:[], defaultName:null, reason:'unsupported' };
    _publishWindowState(false, null, []);
    return info;
  }

  try {
    _access = await navigator.requestMIDIAccess({ sysex:false });
    const outs = Array.from(_access.outputs.values());
    _out = outs[0] || null;

    const info = {
      enabled: !!_out,
      outputs: outs.map(o => ({ id:o.id, name:o.name })),
      defaultName: _out?.name || null
    };
    console.info('[MIDI] init:', info);
    _publishWindowState(info.enabled, info.defaultName, info.outputs);
    return info;
  } catch (e) {
    console.warn('[MIDI] requestMIDIAccess failed → synth fallback', e);
    // mémorise l’échec pour ne pas spammer
    _access = { outputs: new Map(), denied: true };
    _out = null;
    const info = { enabled:false, outputs:[], defaultName:null, reason:String(e?.message || e) };
    _publishWindowState(false, null, []);
    return info;
  }
}

function _publishWindowState(enabled, name, outputs) {
  try {
    window.__MIDI = {
      enabled: !!enabled,
      name: name || null,
      outputs: outputs || [],
      setOutputByName,
      midiEnabled,
    };
  } catch {}
}

export function midiEnabled() { return !!_out; }
// alias pour compat héritée
export const hasMIDI = midiEnabled;

export function listOutputs() {
  if (!_access) return [];
  return Array.from(_access.outputs.values()).map(o => ({ id:o.id, name:o.name }));
}
// alias compat héritée
export const listMIDIOutputs = () => listOutputs().map(o => o.name);

export function setOutputByName(name='') {
  if (!_access) return false;
  const outs = Array.from(_access.outputs.values());
  const found = outs.find(o => (o.name||'') === name);
  if (found) {
    _out = found;
    _publishWindowState(!!_out, _out?.name || null, listOutputs());
    return true;
  }
  return false;
}
// alias compat héritée
export const setMIDIOutputByName = setOutputByName;

export function setDefaultChannel(ch=0) {
  _defaultChannel = Math.max(0, Math.min(15, ch|0));
}
export function getDefaultChannel() { return _defaultChannel; }
export function getSelectedOutputName() { return _out?.name || null; }

// ———————————————————————————————————————————————————————————
// Util internes
// ———————————————————————————————————————————————————————————
function _toCh(channel) {
  return Number.isFinite(channel) ? (channel|0) & 0x0F : _defaultChannel;
}
function _velTo7(v) {
  // v ∈ [0..1] ou [0..127]
  if (typeof v !== 'number') return 0;
  if (v <= 1) return Math.max(0, Math.min(127, Math.round(v*127)));
  return Math.max(0, Math.min(127, v|0));
}

// ———————————————————————————————————————————————————————————
// Envois de messages
// ———————————————————————————————————————————————————————————
export function sendNoteOn(note=60, vel=0.8, channel=_defaultChannel) {
  if (!_out) return false;
  const ch = _toCh(channel);
  const nn = Math.max(0, Math.min(127, note|0));
  const vv = _velTo7(vel);
  _out.send([0x90|ch, nn, vv]);
  return true;
}
export function sendNoteOff(note=60, channel=_defaultChannel) {
  if (!_out) return false;
  const ch = _toCh(channel);
  const nn = Math.max(0, Math.min(127, note|0));
  // Note Off via Note On vel=0 (souvent plus compatible)
  _out.send([0x90|ch, nn, 0x00]);
  return true;
}
// alias compat (certains modules importent midiNoteOn/Off)
export const midiNoteOn  = sendNoteOn;
export const midiNoteOff = sendNoteOff;

export function sendCC(cc=1, value=0, channel=_defaultChannel) {
  if (!_out) return false;
  const ch = _toCh(channel);
  const c  = Math.max(0, Math.min(127, cc|0));
  const v  = Math.max(0, Math.min(127, value|0));
  _out.send([0xB0|ch, c, v]);
  return true;
}

/**
 * Envoi Pitch Bend 14 bits (0..16383), centre=8192.
 * @param {number} value14  - 0..16383 (8192 = centre)
 * @param {number} channel  - 0..15
 */
export function sendPitchBend14(value14=8192, channel=_defaultChannel) {
  if (!_out) return false;
  const ch = _toCh(channel);
  let v = Math.max(0, Math.min(16383, value14|0));
  const lsb = v & 0x7F;        // 0..127
  const msb = (v >> 7) & 0x7F; // 0..127
  _out.send([0xE0|ch, lsb, msb]);
  return true;
}

/**
 * Helper pratique : envoie un bend en demi-tons, mappé sur une plage ±rangeSemitones.
 * @param {number} semitones        - ex: -2..+2
 * @param {number} rangeSemitones   - par défaut 2 (classique)
 * @param {number} channel          - 0..15
 */
export function sendPitchBendSemitones(semitones=0, rangeSemitones=2, channel=_defaultChannel) {
  if (!_out) return false;
  const r = Math.max(0.5, Math.abs(rangeSemitones));
  const s = Math.max(-r, Math.min(r, +semitones || 0));
  // s=-r → 0 ; s=0 → 8192 ; s=+r → 16383
  const norm = (s / (2*r)) + 0.5;          // 0..1
  const v14  = Math.max(0, Math.min(16383, Math.round(norm * 16383)));
  return sendPitchBend14(v14, channel);
}

export function allNotesOff(channel=_defaultChannel) {
  if (!_out) return false;
  const ch = _toCh(channel);
  // CC 123: All Notes Off, CC 120: All Sound Off
  _out.send([0xB0|ch, 123, 0]);
  _out.send([0xB0|ch, 120, 0]);
  return true;
}
