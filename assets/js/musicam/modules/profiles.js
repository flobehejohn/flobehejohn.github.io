// assets/js/musicam/modules/profiles.js
// Profils MusiCam — localStorage + URL share, propre et robuste.

import { state } from './state.js';

// ———————————————————————————————————————————————————————
// Sélectionne uniquement les champs utiles à persister/partager
function pickProfileFromState() {
  return {
    instrument: state.instrument,
    outputMode: state.outputMode,
    movementThreshold: state.movementThreshold,
    noteOffHoldMs: state.noteOffHoldMs,
    currentScale: state.currentScale,
    mappingMode: state.mappingMode,
    calibration: state.calibration,                 // { wristOffsetY, deadZone }
    tuning: { modelType: state.tuning?.modelType || 'full' }, // 'full' | 'lite'
    level: state._desiredLevel || undefined,         // 'hi' | 'mid' (facultatif)
    autoResolution: !!state.autoResolution
  };
}

// Appliquer le profil au state (sans effets “engines”)
// Les effets (instrument/output/modelType/résolution) sont répliqués par musicam.js
function applyProfileToState(p) {
  if (!p || typeof p !== 'object') return false;

  if (typeof p.instrument === 'string') state.instrument = p.instrument;
  if (typeof p.outputMode === 'string') state.outputMode = p.outputMode;
  if (typeof p.movementThreshold === 'number') state.movementThreshold = p.movementThreshold;
  if (typeof p.noteOffHoldMs === 'number') state.noteOffHoldMs = p.noteOffHoldMs;
  if (typeof p.currentScale === 'string') state.currentScale = p.currentScale;
  if (typeof p.mappingMode === 'string') state.mappingMode = p.mappingMode;
  if (p.calibration && typeof p.calibration === 'object') {
    state.calibration = { ...(state.calibration||{}), ...(p.calibration||{}) };
  }
  if (p.tuning?.modelType) {
    state.tuning = { ...(state.tuning || {}), modelType: p.tuning.modelType };
  }
  if (p.level) state._desiredLevel = p.level;
  if (typeof p.autoResolution === "boolean") state.autoResolution = p.autoResolution;
  else if (p.level) state.autoResolution = (p.level === "hi");

  return true;
}

// ———————————————————————————————————————————————————————
// Stockage local
const LS_KEY = 'musicam_profiles_v1';

function loadAll() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function saveAll(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

export function listProfiles() {
  return Object.keys(loadAll()).sort();
}
export function saveProfile(name) {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim();
  if (!clean) return false;
  const all = loadAll();
  all[clean] = pickProfileFromState();
  saveAll(all);
  return true;
}
export function deleteProfile(name) {
  if (!name) return false;
  const all = loadAll();
  if (!(name in all)) return false;
  delete all[name];
  saveAll(all);
  return true;
}
export function loadProfile(name) {
  if (!name) return false;
  const all = loadAll();
  const p = all[name];
  if (!p) return false;
  return applyProfileToState(p);
}

// ———————————————————————————————————————————————————————
// Partage URL : ?mc=<base64(JSON)>
// Encode: btoa(encodeURIComponent(json)); Decode: JSON.parse(decodeURIComponent(atob(mc)))
export function profileToURL(p = pickProfileFromState()) {
  try {
    const json = JSON.stringify(p);
    const b64  = btoa(encodeURIComponent(json));
    const url  = new URL(location.href);
    url.searchParams.set('mc', b64);
    return url.toString();
  } catch {
    return null;
  }
}

export function tryLoadProfileFromURL() {
  const mc = new URL(location.href).searchParams.get('mc');
  if (!mc) return false;
  try {
    const json = decodeURIComponent(atob(mc));
    const p = JSON.parse(json);
    return applyProfileToState(p);
  } catch {
    console.warn('[Profiles] URL decode error');
    return false;
  }
}

// ———————————————————————————————————————————————————————
// API regroupée pour usage côté window.MusiCam
export const profilesAPI = {
  list : listProfiles,
  save : saveProfile,
  load : loadProfile,
  delete: deleteProfile,
  exportURL: profileToURL,
  tryLoadFromURL: tryLoadProfileFromURL,
  snapshot: pickProfileFromState,
  apply: applyProfileToState,
};
