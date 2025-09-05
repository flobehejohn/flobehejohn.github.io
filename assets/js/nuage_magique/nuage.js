// /assets/js/nuage_magique/nuage.js
// Nuage (PointsMaterial) + Texte (fill glowy + contour noir) dans la même scène
// Interactions : vent (nuage), burst (texte), assemble/dissolve (dblclick).
// fitTextToView(camera, {margin, bottomSafe}) centre + scale le texte pour tenir à l’écran.
// PATCH : audio-reactif via setExternalDrive({ bass, high, rms }) + logs détaillés.

import THREE from './bootstrap.js';
import { createTextGroup } from './text_particles.js';

/* ========================================================================== */
/* LOGGING                                                                    */
/* ========================================================================== */
const TAG = '%c[NuageScene]';
const CSS = 'background:#0b1f2a;color:#8bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
const OK  = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
const BAD = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';
const dbgEnabled = () => (window.__NUAGE_SCENE_DEBUG__ ?? true);
const info = (m, ...a) => { if (dbgEnabled()) console.log( TAG+' '+m, CSS, ...a); };
const ok   = (m, ...a) => { if (dbgEnabled()) console.log( TAG+' '+m, OK,  ...a); };
const warn = (m, ...a) => { if (dbgEnabled()) console.warn(TAG+' '+m, CSS, ...a); };
const err  = (m, ...a) => { if (dbgEnabled()) console.error(TAG+' '+m, BAD, ...a); };
const group   = (t) => { if (dbgEnabled()) { try { console.groupCollapsed(TAG+' '+t, CSS); } catch {} } };
const groupEnd= () => { if (dbgEnabled()) { try { console.groupEnd(); } catch {} } };

/* ========================================================================== */
/* BRUIT RAPIDE (pseudo-Perlin 4D)                                            */
/* ========================================================================== */
function pseudoPerlin(x, y, z, t) {
  function hash(n) { return Math.abs(Math.sin(n) * 43758.5453123) % 1; }
  let ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), it = Math.floor(t);
  let fx = x - ix, fy = y - iy, fz = z - iz, ft = t - it;
  let v = 0;
  for (let dx=0; dx<=1; dx++) for (let dy=0; dy<=1; dy++)
  for (let dz=0; dz<=1; dz++) for (let dt=0; dt<=1; dt++) {
    let h = hash(ix+dx + (iy+dy)*57 + (iz+dz)*113 + (it+dt)*197);
    let wx = dx?fx:1.0-fx, wy = dy?fy:1.0-fy, wz = dz?fz:1.0-fz, wt = dt?ft:1.0-ft;
    v += h * wx * wy * wz * wt;
  }
  return v;
}

/* ========================================================================== */
/* TEXTURE GLOW POUR LES PARTICULES                                           */
/* ========================================================================== */
function generateGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 4, size/2, size/2, size/2);
  g.addColorStop(0, 'rgba(255,255,255,0.47)');
  g.addColorStop(0.20, 'rgba(160,200,255,0.17)');
  g.addColorStop(1, 'rgba(0,0,0,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ========================================================================== */
/* SCÈNE PRINCIPALE                                                           */
/* ========================================================================== */
export function createCloudScene() {
  group('init');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb7deff);

  /* ------------------------------ LUMIÈRES -------------------------------- */
  // Ambiance
  const colorLight = new THREE.PointLight(0x7ab8ff, 1.6, 140);
  colorLight.position.set(0, 0, 0);
  scene.add(colorLight);

  // Petites lumières “magiques” (chemins pseudo-orbitaux)
  const magicLights = [
    { color: 0xbad7ff, intensity: 2.5, bias: 0.31,
      path: (t)=>{ const r=5.8+Math.sin(t*0.77)*2.5+pseudoPerlin(0,0,0,t*0.31)*1.3;
                   const th=t*0.79+0.3; const ph=Math.PI/2+Math.cos(t*0.48)*0.43+pseudoPerlin(0,0,0,t*0.12)*0.32;
                   return [r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph)]; } },
    { color: 0xffb7f6, intensity: 2.6, bias: 0.63,
      path: (t)=>{ const r=6.3+Math.cos(t*0.53+1.7)*2.9+pseudoPerlin(1,0,0,t*0.27)*1.7;
                   const th=t*0.95+1.2; const ph=Math.PI/2+Math.sin(t*0.42)*0.53+pseudoPerlin(0,1,0,t*0.19)*0.45;
                   return [r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph)]; } },
    { color: 0xffe5b7, intensity: 2.2, bias: 0.47,
      path: (t)=>{ const r=6.7+Math.sin(t*0.67-0.6)*2.1+pseudoPerlin(0,0,1,t*0.17)*1.2;
                   const th=t*0.61-0.8; const ph=Math.PI/2+Math.sin(t*0.54)*0.55+pseudoPerlin(0,0,1,t*0.16)*0.33;
                   return [r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph)]; } },
  ];
  magicLights.forEach(ld => {
    const l = new THREE.PointLight(ld.color, ld.intensity, 25, 2.3);
    scene.add(l);
    ld.obj = l;
  });

  /* ------------------------------ NUAGE ----------------------------------- */
  const PARTICLES = 1500, RADIUS = 13, SPREAD = 7, R_MAX = RADIUS + SPREAD;
  const geometry  = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLES * 3);
  const opacities = new Float32Array(PARTICLES);
  const baseColors= new Float32Array(PARTICLES * 3);
  const seedAngles= new Float32Array(PARTICLES * 4);
  const velocities= new Float32Array(PARTICLES * 3);

  for (let i = 0; i < PARTICLES; i++) {
    const r = RADIUS * (0.73 + 0.31 * Math.random()) + Math.random() * SPREAD;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);

    positions[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3+2] = r * Math.cos(phi);

    seedAngles[i*4+0] = r;
    seedAngles[i*4+1] = theta;
    seedAngles[i*4+2] = phi;
    seedAngles[i*4+3] = Math.random() * 1000;

    const d = r / R_MAX;
    baseColors[i*3+0] = 0.8 + 0.18 * (1 - d);
    baseColors[i*3+1] = 0.89 + 0.14 * (1 - d);
    baseColors[i*3+2] = 1.0;

    opacities[i] = 0.14 + 0.54 * Math.pow(1 - d, 2) * Math.random();
    velocities[i*3+0] = velocities[i*3+1] = velocities[i*3+2] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('opacity',  new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('color',    new THREE.BufferAttribute(baseColors, 3));

  // *** Gamme de taille : "minuscule → moyen" mappée sur bass ***
  const SIZE_MIN = 2.0;   // minuscule
  const SIZE_MID = 3.0;   // moyen (pas plus)
  const glowMap  = generateGlowTexture();
  const material = new THREE.PointsMaterial({
    size: SIZE_MIN,
    map: glowMap,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.7,
    alphaTest: 0.0009,
  });
  const cloud = new THREE.Points(geometry, material);
  scene.add(cloud);

  const baseCloud = {
    sizeMin: SIZE_MIN,
    sizeMid: SIZE_MID,
    opacity: material.opacity
  };

  /* ------------------------------ INTERACTIONS ---------------------------- */
  function onPushImpulse(rayOrigin, rayDir) {
    for (let i = 0; i < PARTICLES; i++) {
      const p = new THREE.Vector3(positions[i*3+0], positions[i*3+1], positions[i*3+2]);
      const t = p.clone().sub(rayOrigin).dot(rayDir);
      const proj = rayOrigin.clone().add(rayDir.clone().multiplyScalar(t));
      const dist = p.distanceTo(proj);
      if (dist < 5) {
        const f = (1 - dist/5) * (2.7 + 0.9 * Math.random());
        const away = p.clone().sub(rayOrigin).normalize();
        velocities[i*3+0] += away.x * f;
        velocities[i*3+1] += away.y * f;
        velocities[i*3+2] += away.z * f;
      }
    }
    if (textGroup) pushImpulseText(rayOrigin, rayDir);
  }

  /* ------------------------------ TEXTE ----------------------------------- */
  let textGroup   = null;
  let textFill    = null;
  let textStroke  = null;
  let targetsFill = null;
  let targetsStroke = null;
  let textParams  = { lerp: 0.08 };
  const TMP = new THREE.Vector3();

  function randomCloudTarget(count) {
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = RADIUS * (0.73 + 0.31 * Math.random()) + Math.random() * SPREAD;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      out[i*3+0] = r * Math.sin(ph) * Math.cos(th);
      out[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      out[i*3+2] = r * Math.cos(ph);
    }
    return out;
  }

  function pushImpulseText(rayOrigin, rayDir) {
    if (textFill) {
      const pos = textFill.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        TMP.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const wp = textGroup.localToWorld(TMP.clone());
        const t = wp.clone().sub(rayOrigin).dot(rayDir);
        const proj = rayOrigin.clone().add(rayDir.clone().multiplyScalar(t));
        const dist = wp.distanceTo(proj);
        if (dist < 4) {
          const f = (1 - dist/4) * (0.25 + 0.35 * Math.random());
          const away = wp.clone().sub(rayOrigin).normalize();
          const wNew = wp.clone().add(away.multiplyScalar(f));
          const lNew = textGroup.worldToLocal(wNew);
          pos.setXYZ(i, lNew.x, lNew.y, lNew.z);
        }
      }
      pos.needsUpdate = true;
    }
    if (textStroke) {
      const pos = textStroke.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        TMP.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const wp = textGroup.localToWorld(TMP.clone());
        const t = wp.clone().sub(rayOrigin).dot(rayDir);
        const proj = rayOrigin.clone().add(rayDir.clone().multiplyScalar(t));
        const dist = wp.distanceTo(proj);
        if (dist < 4) {
          const f = (1 - dist/4) * (0.20 + 0.30 * Math.random());
          const away = wp.clone().sub(rayOrigin).normalize();
          const wNew = wp.clone().add(away.multiplyScalar(f));
          const lNew = textGroup.worldToLocal(wNew);
          pos.setXYZ(i, lNew.x, lNew.y, lNew.z);
        }
      }
      pos.needsUpdate = true;
    }
  }

  function preScatterFromOrigin(strength = 6.0, jitter = 0.6) {
    const origin = new THREE.Vector3(0, 0, 0);
    if (textFill) {
      const pos = textFill.geometry.getAttribute('position');
      const home = textFill.userData.home;
      for (let i = 0; i < pos.count; i++) {
        const hx = home[i*3+0], hy = home[i*3+1], hz = home[i*3+2];
        const dir = new THREE.Vector3(hx - origin.x, hy - origin.y, hz - origin.z).normalize();
        const s = strength * (1.0 + Math.random() * 0.6);
        const nx = hx + dir.x * s + (Math.random()-0.5)*jitter;
        const ny = hy + dir.y * s + (Math.random()-0.5)*jitter;
        const nz = hz + dir.z * s + (Math.random()-0.5)*jitter*0.4;
        pos.setXYZ(i, nx, ny, nz);
      }
      pos.needsUpdate = true;
      targetsFill = home.slice();
      textFill.userData.mode = 'assemble';
    }
    if (textStroke) {
      const pos = textStroke.geometry.getAttribute('position');
      const home = textStroke.userData.home;
      for (let i = 0; i < pos.count; i++) {
        const hx = home[i*3+0], hy = home[i*3+1], hz = home[i*3+2];
        const dir = new THREE.Vector3(hx - origin.x, hy - origin.y, hz - origin.z).normalize();
        const s = strength * (1.0 + Math.random() * 0.6);
        const nx = hx + dir.x * s + (Math.random()-0.5)*jitter;
        const ny = hy + dir.y * s + (Math.random()-0.5)*jitter;
        const nz = hz + dir.z * s + (Math.random()-0.5)*jitter*0.4;
        pos.setXYZ(i, nx, ny, nz);
      }
      pos.needsUpdate = true;
      targetsStroke = home.slice();
      textStroke.userData.mode = 'assemble';
    }
  }

  function burstText(ndc, camera) {
    if (!textFill && !textStroke) return;
    const vec = new THREE.Vector3(ndc.x, ndc.y, 0.3).unproject(camera);
    const rayOrigin = camera.position.clone();
    const rayDir = vec.clone().sub(camera.position).normalize();
    const t = Math.abs(rayDir.z) > 1e-3 ? (0 - rayOrigin.z) / rayDir.z : 10.0;
    const hitWorld = rayOrigin.clone().add(rayDir.clone().multiplyScalar(t));
    const hitLocal = textGroup ? textGroup.worldToLocal(hitWorld.clone()) : hitWorld;

    if (textFill) {
      const pos = textFill.geometry.getAttribute('position');
      if (!targetsFill) targetsFill = textFill.userData.home.slice();
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const dir = new THREE.Vector3(px - hitLocal.x, py - hitLocal.y, pz - hitLocal.z).normalize();
        const strength = 6.0 * (1.0 + Math.random() * 0.6);
        targetsFill[i*3+0] = px + dir.x * strength;
        targetsFill[i*3+1] = py + dir.y * strength;
        targetsFill[i*3+2] = pz + dir.z * strength;
      }
      textFill.userData.mode = 'dissolve';
    }
    if (textStroke) {
      const pos = textStroke.geometry.getAttribute('position');
      if (!targetsStroke) targetsStroke = textStroke.userData.home.slice();
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const dir = new THREE.Vector3(px - hitLocal.x, py - hitLocal.y, pz - hitLocal.z).normalize();
        const strength = 6.0 * (1.0 + Math.random() * 0.6);
        targetsStroke[i*3+0] = px + dir.x * strength;
        targetsStroke[i*3+1] = py + dir.y * strength;
        targetsStroke[i*3+2] = pz + dir.z * strength;
      }
      textStroke.userData.mode = 'dissolve';
    }
  }

  async function addText(message = '', options = {}) {
    if (textGroup) {
      scene.remove(textGroup);
      if (textFill)  { textFill.geometry.dispose();  textFill.material.dispose(); }
      if (textStroke){ textStroke.geometry.dispose(); textStroke.material.dispose(); }
      textGroup = textFill = textStroke = null;
      targetsFill = targetsStroke = null;
    }

    const baseGlow = generateGlowTexture();
    const { group:grp, fill, stroke } = await createTextGroup(message, { glowMap: baseGlow, ...options });
    textGroup = grp; textFill = fill; textStroke = stroke;
    textGroup.userData.charCount = (message || '').replace(/\s/g, '').length;
    scene.add(textGroup);

    if (textFill)   { targetsFill   = textFill.userData.home.slice();   textFill.userData.mode   = 'assemble'; }
    if (textStroke) { targetsStroke = textStroke.userData.home.slice(); textStroke.userData.mode = 'assemble'; }

    // Apparition inversée (scatter -> assemble)
    preScatterFromOrigin(6.0, 0.6);

    ok('Texte ajouté (%d chars).', textGroup.userData.charCount || 0);
    return textGroup;
  }

  function setTextMode(mode = 'assemble') {
    if (textFill) {
      const pos = textFill.geometry.getAttribute('position');
      if (mode === 'assemble') {
        targetsFill = textFill.userData.home.slice();
      } else {
        const worldTargets = randomCloudTarget(pos.count);
        const inv = new THREE.Matrix4().copy(textGroup.matrixWorld).invert();
        const local = new Float32Array(worldTargets.length);
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.set(worldTargets[i*3+0], worldTargets[i*3+1], worldTargets[i*3+2]).applyMatrix4(inv);
          local[i*3+0] = v.x; local[i*3+1] = v.y; local[i*3+2] = v.z;
        }
        targetsFill = local;
      }
      textFill.userData.mode = mode;
    }
    if (textStroke) {
      const pos = textStroke.geometry.getAttribute('position');
      if (mode === 'assemble') {
        targetsStroke = textStroke.userData.home.slice();
      } else {
        const worldTargets = randomCloudTarget(pos.count);
        const inv = new THREE.Matrix4().copy(textGroup.matrixWorld).invert();
        const local = new Float32Array(worldTargets.length);
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.set(worldTargets[i*3+0], worldTargets[i*3+1], worldTargets[i*3+2]).applyMatrix4(inv);
          local[i*3+0] = v.x; local[i*3+1] = v.y; local[i*3+2] = v.z;
        }
        targetsStroke = local;
      }
      textStroke.userData.mode = mode;
    }
    info('Text mode → %s', mode);
  }

  function toggleText() {
    if (!textFill && !textStroke) return;
    const current = (textFill?.userData.mode || textStroke?.userData.mode || 'assemble');
    setTextMode(current === 'assemble' ? 'dissolve' : 'assemble');
  }

  /* ------------------------------ FIT & METRICS --------------------------- */
  function fitTextToView(camera, opts = {}) {
    if (!textGroup) return;
    const isPortrait = window.innerHeight > window.innerWidth;
    const margin = (typeof opts === 'number') ? opts
                 : (typeof opts.margin === 'number') ? opts.margin
                 : (isPortrait ? 0.90 : 0.92);
    const bottomSafe = (typeof opts === 'object' && typeof opts.bottomSafe === 'number')
                 ? opts.bottomSafe
                 : (isPortrait ? 0.28 : 0.20);

    const lb = textGroup.userData.localBBox;
    if (!lb) return;

    const localW = Math.max(1e-6, lb.width);
    const localH = Math.max(1e-6, lb.height);

    const depth = Math.abs(camera.position.z - 0.0);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const frustumH = 2 * Math.tan(vFov / 2) * depth;
    const frustumW = frustumH * camera.aspect;

    const clipBottom = frustumH * bottomSafe;
    const usableH = Math.max(1e-6, frustumH - clipBottom);

    const availW = frustumW * margin;
    const availH = usableH * margin;

    const cc = textGroup.userData.charCount || 0;
    let maxHeightPerc = 1.0;
    if (cc <= 2)      maxHeightPerc = 0.35;
    else if (cc <= 6) maxHeightPerc = 0.50;

    const scaleByBox   = Math.min(availW / localW, availH / localH);
    const scaleByClamp = (usableH * maxHeightPerc) / localH;
    const scale = Math.max(0.0001, Math.min(scaleByBox, scaleByClamp));

    textGroup.scale.setScalar(scale);
    textGroup.position.set(0, clipBottom * 0.5, 0);
  }

  function fitTextToRect(camera, rectPx, renderer, margin = 0.92) {
    if (!textGroup || !textGroup.userData?.localBBox) return;

    const depth = Math.abs(camera.position.z - 0.0);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const frustumH = 2 * Math.tan(vFov / 2) * depth;
    const frustumW = frustumH * camera.aspect;

    const vpW = renderer?.domElement?.clientWidth  || window.innerWidth;
    const vpH = renderer?.domElement?.clientHeight || window.innerHeight;

    const localW = Math.max(1e-6, textGroup.userData.localBBox.width);
    const localH = Math.max(1e-6, textGroup.userData.localBBox.height);

    const availW = (rectPx.width  / vpW) * frustumW * margin;
    const availH = (rectPx.height / vpH) * frustumH * margin;
    const scale  = Math.max(0.0001, Math.min(availW / localW, availH / localH));

    textGroup.scale.setScalar(scale);

    const cx = rectPx.left + rectPx.width / 2;
    const cy = rectPx.top  + rectPx.height / 2;
    const xN = (cx / vpW) * 2 - 1;
    const yN = -((cy / vpH) * 2 - 1);

    const worldX = xN * (frustumW / 2);
    const worldY = yN * (frustumH / 2);
    textGroup.position.set(worldX, worldY, 0);
  }

  function getTextMetrics(camera, renderer) {
    if (!textGroup || !textGroup.userData?.localBBox) return null;
    const depth = Math.abs(camera.position.z - 0.0);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const frustumH = 2 * Math.tan(vFov / 2) * depth;
    const vpH = renderer?.domElement?.clientHeight || window.innerHeight;
    const pxPerUnit = vpH / frustumH;

    const w = textGroup.userData.localBBox.width  * textGroup.scale.x * pxPerUnit;
    const h = textGroup.userData.localBBox.height * textGroup.scale.y * pxPerUnit;
    return { widthPx: w, heightPx: h, charCount: textGroup.userData.charCount || 0 };
  }

  /* ------------------------------ ANIMATION ------------------------------- */
  // Tonnerre autonome (existant)
  let thunderTimer = 0, thunderValue = 0, thunderTarget = 0;

  // 🔊 AUDIO-DRIVE — état partagé + lissages locaux
  let drive = { bass: 0, high: 0, rms: 0 };
  let bassSmooth = 0;
  let highSmooth = 0;   // aigu moyen
  let hiPulse    = 0;   // pic d'attaque aigu
  let prevHigh   = 0;
  const LERP = (a,b,t) => a + (b-a)*t;
  const MIX  = (a,b,k) => a + (b-a)*Math.max(0,Math.min(1,k));

  function animateCloud(clock, camera) {
    const pos = geometry.getAttribute('position');
    const opa = geometry.getAttribute('opacity');
    const col = geometry.getAttribute('color');
    const t = clock.getElapsedTime();

    // Thunder autonome (léger)
    if (thunderTimer <= 0 && Math.random() < 0.008) { thunderTarget = 1 + Math.random() * 1.4; thunderTimer = 0.7 + Math.random() * 0.65; }
    if (thunderTimer > 0) { thunderValue += (thunderTarget - thunderValue) * 0.24; thunderTimer -= 0.016; }
    else { thunderValue += (0 - thunderValue) * 0.09; }

    // 🔊 audio → lissages + détection d'attaque aigu
    bassSmooth = LERP(bassSmooth, Math.min(1, Math.max(0, drive.bass || 0)), 0.35);
    highSmooth = LERP(highSmooth, Math.min(1, Math.max(0, drive.high || 0)), 0.55);
    const hiImpact = Math.max(0, (drive.high || 0) - prevHigh);
    hiPulse = Math.max(hiPulse * 0.86, hiImpact * 1.8); // attaque rapide, décroissance
    prevHigh = drive.high || 0;

    // 1) Nuage : TAILLE/OPACITÉ pilotées par les basses → minuscule..moyen
    const sizeNow    = MIX(baseCloud.sizeMin, baseCloud.sizeMid, bassSmooth);
    const opacityMul = MIX(1.0, 1.30, bassSmooth);
    cloud.material.size    = sizeNow;
    cloud.material.opacity = Math.max(0.25, Math.min(1.0, baseCloud.opacity * opacityMul));

    // micro-impulsions (douces) sur les basses
    const posCount = pos.count;
    for (let i = 0; i < posCount; i++) {
      const w = 0.0025 * bassSmooth;
      velocities[i*3+0] += (Math.sin(t*3.1 + i*0.27))*w;
      velocities[i*3+1] += (Math.cos(t*2.7 + i*0.19))*w;
      velocities[i*3+2] += (Math.sin(t*2.2 + i*0.13))*w;
    }

    // Update position + opacité + COULEUR (réchauffement sur les aigus)
    const thunderOp = 1 + (0.50 * bassSmooth) + thunderValue * 0.6; // mix autonome + audio
    const warmTarget = [1.00, 0.78, 0.55]; // orange doux
    const warmKBase  = Math.min(1, highSmooth * 0.6 + hiPulse * 1.4); // plus d'effet sur impact
    for (let i = 0; i < posCount; i++) {
      let r0 = seedAngles[i*4+0], th0 = seedAngles[i*4+1], ph0 = seedAngles[i*4+2], off = seedAngles[i*4+3];
      let dR = 0.7 * Math.sin(t * 0.34 + off) + 0.19 * pseudoPerlin(i, 0, 0, t * 0.11 + off);
      let dTh= 0.28 * Math.sin(t * 0.21 + i) + 0.13 * pseudoPerlin(0, i, 0, t * 0.17 + off);
      let dPh= 0.17 * Math.cos(t * 0.32 + i) + 0.12 * pseudoPerlin(0, 0, i, t * 0.16 + off);

      let r  = Math.max(RADIUS*0.53, Math.min(r0 + dR, R_MAX));
      let th = th0 + dTh;
      let ph = ph0 + dPh;

      velocities[i*3+0] *= 0.91;
      velocities[i*3+1] *= 0.91;
      velocities[i*3+2] *= 0.91;

      r  += velocities[i*3+0];
      th += velocities[i*3+1] * 0.22;
      ph += velocities[i*3+2] * 0.19;

      pos.array[i*3+0] = r * Math.sin(ph) * Math.cos(th);
      pos.array[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      pos.array[i*3+2] = r * Math.cos(ph);

      const baseOpa = 0.13 + 0.31 * Math.abs(Math.sin(t * 0.22 + i * 0.92));
      const jitter  = 0.32 * pseudoPerlin(i*0.33, i*0.16, 0, t*0.27);
      opa.array[i]  = Math.max(0.06, baseOpa * (0.69 + jitter) * thunderOp);

      // Couleur "froide" de base
      const c0 = 0.82 + 0.13 * Math.sin(t*0.37 + i*0.21);
      const c1 = 0.91 + 0.08 * Math.sin(t*0.24 + i*0.50);
      const c2 = 1.00 - 0.08 * Math.abs(Math.cos(t*0.31 + i*0.60));

      // Warm mix sur aigu (attack > sustain)
      const warmK = Math.max(0, Math.min(1, warmKBase));
      col.array[i*3+0] = MIX(c0, warmTarget[0], warmK);
      col.array[i*3+1] = MIX(c1, warmTarget[1], warmK);
      col.array[i*3+2] = MIX(c2, warmTarget[2], warmK);
    }
    pos.needsUpdate = true; opa.needsUpdate = true; col.needsUpdate = true;

    // Rotation douce du nuage
    cloud.rotation.y += 0.0005;
    cloud.rotation.x += 0.00021;

    // Lumières magiques : pompes sur audio + thunder autonome
    magicLights.forEach((l, idx) => {
      const p = l.path(t + l.bias * 13.4);
      l.obj.position.set(p[0], p[1], p[2]);
      const baseI = l.intensity + 0.4 * Math.sin(t * (0.93 + 0.19*idx));
      l.obj.intensity = baseI * (1 + bassSmooth * (1.6 + idx * 0.21)) * (1 + thunderValue * 0.4);
    });

    // Texte : uniforms temps + modulation audio
    if (textFill && textFill.material?.uniforms) {
      const u = textFill.material.uniforms; // (uTime, uPulseAmp, uLumAmp, uSwarmAmp si présents)
      if (u.uTime)     u.uTime.value     = t;
      if (u.uPulseAmp) u.uPulseAmp.value = 0.12 * (1 + 0.9 * bassSmooth + 0.4 * hiPulse);
      if (u.uLumAmp)   u.uLumAmp.value   = 0.25 * (1 + 1.2 * bassSmooth + 0.6 * highSmooth);
      if (u.uSwarmAmp) u.uSwarmAmp.value = 0.02 * (1 + 1.0 * bassSmooth);
    }

    // Lerp assemble/dissolve
    if (textFill && targetsFill) {
      const pf = textFill.geometry.getAttribute('position');
      const k  = textParams.lerp;
      for (let i = 0; i < pf.count; i++) {
        const cx = pf.getX(i), cy = pf.getY(i), cz = pf.getZ(i);
        const tx = targetsFill[i*3+0], ty = targetsFill[i*3+1], tz = targetsFill[i*3+2];
        pf.setXYZ(i, cx + (tx-cx)*k, cy + (ty-cy)*k, cz + (tz-cz)*k);
      }
      pf.needsUpdate = true;
    }
    if (textStroke && targetsStroke) {
      const ps = textStroke.geometry.getAttribute('position');
      const k  = textParams.lerp;
      for (let i = 0; i < ps.count; i++) {
        const cx = ps.getX(i), cy = ps.getY(i), cz = ps.getZ(i);
        const tx = targetsStroke[i*3+0], ty = targetsStroke[i*3+1], tz = targetsStroke[i*3+2];
        ps.setXYZ(i, cx + (tx-cx)*k, cy + (ty-cy)*k, cz + (tz-cz)*k);
      }
      ps.needsUpdate = true;
    }
  }

  /* ------------------------------ INPUT SOURIS ---------------------------- */
  cloud.userData.onPointer = (mouse, camera) => {
    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.3).unproject(camera);
    const rayOrigin = camera.position.clone();
    const rayDir = vector.clone().sub(camera.position).normalize();
    onPushImpulse(rayOrigin, rayDir);
  };

  /* ------------------------------ AUDIO-DRIVE API ------------------------- */
  function setExternalDrive(d) {
    if (!d) return;
    if (typeof d.bass === 'number') drive.bass = d.bass;
    if (typeof d.high === 'number') drive.high = d.high;
    if (typeof d.rms  === 'number') drive.rms  = d.rms;
  }

  ok('init OK (particles=%d)', PARTICLES);
  groupEnd();

  /* ------------------------------ EXPORT SCÈNE ---------------------------- */
  return {
    scene,
    cloud,
    animateCloud,
    addText,
    setTextMode,
    toggleText,
    burstText,
    fitTextToView,
    fitTextToRect,
    getTextMetrics,
    // Audio-reactif
    setExternalDrive
  };
}
