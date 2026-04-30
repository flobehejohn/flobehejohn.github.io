// assets/js/musicam/modules/detector.js
// Wrappers MediaPipe/TFJS pour BlazePose & FaceMesh
// - Pose : tente d'abord MediaPipe (WebGL), puis fallback TFJS (wasm→cpu).
// - FaceMesh : optionnel (OFF par défaut), logs doux si assets manquent.

const PATHS = {
  poseSolutionPath: '/assets/vendor/mediapipe/pose',
  faceSolutionPath: '/assets/vendor/mediapipe/face_mesh',
};

let faceEnabled = false;

// ————————————————————————————————
// Helpers globals + logs
function hasGlobalsPose() { return !!window.poseDetection; }
function hasGlobalsFace() { return !!window.faceLandmarksDetection; }
function hasTf()         { return !!window.tf; }

const info = (...a) => console.info('[Detector]', ...a);
const warn = (...a) => console.warn('[Detector]', ...a);
const err  = (...a) => console.error('[Detector]', ...a);

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch { return false; }
}

async function detectPoseAssets(solutionPath = PATHS.poseSolutionPath) {
  // Vérifie la présence des binaires MediaPipe Pose
  const packed = await Promise.all([
    headOk(`${solutionPath}/pose_solution_wasm_bin.wasm`),
    headOk(`${solutionPath}/pose_solution_simd_wasm_bin.wasm`),
    headOk(`${solutionPath}/pose_solution_wasm_bin.js`),
    headOk(`${solutionPath}/pose_solution_simd_wasm_bin.js`),
    headOk(`${solutionPath}/pose_solution_packed_assets.data`),
    headOk(`${solutionPath}/pose_solution_packed_assets_loader.js`),
  ]);
  return packed.some(Boolean);
}

async function detectFaceAssets(solutionPath = PATHS.faceSolutionPath) {
  const packedOk = await Promise.all([
    headOk(`${solutionPath}/face_mesh_solution_packed_assets_loader.js`),
    headOk(`${solutionPath}/face_mesh_solution_packed_assets.data`),
    headOk(`${solutionPath}/face_mesh_solution_simd_wasm_bin.js`),
    headOk(`${solutionPath}/face_mesh_solution_simd_wasm_bin.wasm`),
  ]);
  const hasPacked = packedOk.every(Boolean);
  const hasBinaryGraph = await headOk(`${solutionPath}/face_mesh.binarypb`);
  if (hasPacked) return { mode: 'packed', solutionPath };
  if (hasBinaryGraph) return { mode: 'binarypb', solutionPath };
  return { mode: 'none', solutionPath };
}

// ————————————————————————————————
// Validation globals
export function assertGlobalsOrDie() {
  const poseOK = hasGlobalsPose();
  const faceOK = hasGlobalsFace();

  if (!poseOK) {
    err('Dépendances Pose manquantes. Charge /assets/vendor/models/pose-detection.min.js + deps.');
    throw new Error('Globals not found: poseDetection');
  }
  if (!faceOK) {
    // Optionnel → juste un avertissement
    warn('Globals Face non présents. FaceMesh restera OFF (optionnel).');
  }
  return { poseOK, faceOK };
}

// ————————————————————————————————
// POSE: MediaPipe → TFJS fallback
export async function createPoseDetector(modelType = 'full') {
  if (!hasGlobalsPose()) {
    err('poseDetection introuvable (pose-detection.min.js manquant).');
    throw new Error('poseDetection global missing');
  }
  const model = window.poseDetection.SupportedModels.BlazePose;

  // Sondes d’assets (utile pour diagnostiquer les 404/serveur)
  const mpAssetsOK = await detectPoseAssets(PATHS.poseSolutionPath);
  if (!mpAssetsOK) {
    warn(`Assets MediaPipe Pose introuvables sous ${PATHS.poseSolutionPath}. On tentera TFJS.`);
  }

  // 1) Essai MediaPipe (rapide si WebGL OK + assets OK)
  if (mpAssetsOK) {
    try {
      const det = await window.poseDetection.createDetector(model, {
        runtime: 'mediapipe',
        modelType,              // 'full' | 'lite'
        solutionPath: PATHS.poseSolutionPath
      });
      info(`Pose detector prêt (runtime=mediapipe, modelType=${modelType}).`);
      return det;
    } catch (e) {
      warn('Mediapipe/WebGL indisponible → fallback TFJS.', e);
    }
  } else {
    warn('MediaPipe non utilisable (assets manquants) → fallback TFJS.');
  }

  // 2) Fallback TFJS — nécessite tf.min.js + un backend (wasm/cpu)
  if (!hasTf()) {
    err('TFJS absent. Charge tf.min.js (+ backend wasm/cpu) AVANT pose-detection.min.js.');
    throw new Error('TFJS not loaded for runtime=tfjs');
  }

  try {
    let chosen = 'cpu';
    // On essaye en priorité WASM (si le .js/.wasm est servi avec le bon MIME)
    if (window.tf?.setBackend) {
      try {
        await tf.setBackend('wasm');
        chosen = 'wasm';
      } catch {
        await tf.setBackend('cpu');
        chosen = 'cpu';
      }
      await tf.ready();
    }
    info(`TFJS backend='${(tf.engine && tf.engine().backendName) || chosen}' actif.`);

    const det = await window.poseDetection.createDetector(model, {
      runtime: 'tfjs',
      modelType,
      enableSmoothing: true
    });
    info(`Pose detector prêt (runtime=tfjs, modelType=${modelType}).`);
    return det;
  } catch (e2) {
    err('Échec création Pose detector (TFJS aussi).', e2);
    throw e2;
  }
}

// ————————————————————————————————
// FACE (optionnel)
export function isFaceEnabled() { return faceEnabled; }
export function setFaceEnabled(on) {
  faceEnabled = !!on;
  info(`Face ${faceEnabled ? 'ON' : 'OFF'}.`);
  return faceEnabled;
}

export async function createFaceModel() {
  if (!faceEnabled) { info('Face OFF → createFaceModel() ignoré.'); return null; }
  if (!hasGlobalsFace()) { warn('faceLandmarksDetection manquant.'); return null; }

  const probe = await detectFaceAssets(PATHS.faceSolutionPath);
  if (probe.mode === 'none') {
    warn(`Assets FaceMesh introuvables sous ${probe.solutionPath}. Face OFF.`);
    faceEnabled = false;
    return null;
  }

  const model = window.faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
  const opts = {
    runtime: 'mediapipe',
    refineLandmarks: true,
    solutionPath: PATHS.faceSolutionPath,
  };
  try {
    const det = await window.faceLandmarksDetection.createDetector(model, opts);
    info(`Face detector prêt (assets=${probe.mode}).`);
    return det;
  } catch (e) {
    warn('FaceMesh indisponible. Désactivation.', e);
    faceEnabled = false;
    return null;
  }
}

// ————————————————————————————————
// Dispose safe
export async function safeDispose(det) {
  try { await det?.dispose?.(); } catch(_) {}
}

// (optionnel) Expose PATHS & helpers
export const DetectorPaths = Object.freeze({ ...PATHS });
export const FaceAssets = { detectFaceAssets };
