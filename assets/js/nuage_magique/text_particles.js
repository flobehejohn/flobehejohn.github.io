// text_particles.js — texte en particules ultra lisible
// - Remplissage dense (shader: pulse luminosité + micro-mouvements XY/Z)
// - Contour noir net (PointsMaterial)
// - Wrap multi-lignes par nb de caractères (support '\n')
// - Expose group.userData.localBBox pour auto-fit

import THREE from './bootstrap.js';

/*
 * ⚠️ IMPORTANT : utilise une police avec "Latin Extended"
 * Ici : Noto Sans_Regular.json (typeface JSON) — accents OK.
 * Place le fichier dans: /assets/js/nuage_magique/fonts/
 */
const DEFAULT_FONT_URLS = [
  '/assets/js/nuage_magique/fonts/Noto%20Sans_Regular.json',               // 1) Latin étendu (accents)
  '/assets/js/nuage_magique/fonts/NotoSans-Regular.typeface.json',         // 2) autre option
  '/assets/js/nuage_magique/fonts/helvetiker_regular.typeface.json'        // 3) fallback ASCII
];

const DEFAULTS = {
  size: 4.0,

  // Échantillonnage
  contourPoints: 360,
  holePoints: 150,

  // Remplissage intérieur (triangulation → points)
  fillDensity: 0.9,
  fillIntensity: 180.0,
  minPerTri: 3,

  // Contour noir (lisibilité)
  strokeEnabled: true,
  strokeColor: 0x000000,
  strokeSizeMul: 0.85,
  strokeContourMul: 1.6,
  strokeHoleMul: 1.2,

  // Légère irrégularité
  jitter: 0.006,

  // Style remplissage
  color: 0xFFFFFF,
  glowColor: 0x123A6F,
  pointSize: 0.34,
  opacity: 1.0,
  additive: true,

  // “Respiration” + swarm
  pulseAmp: 0.12,
  pulseFreq: 0.12,
  lumAmp: 0.25,
  lumFreq: 0.12,
  swarmAmp: 0.02,

  // Ondulation Z très douce
  waveSpeed: 0.45,
  waveFreq: 0.12,
  waveAmp: 0.006,

  // Multi-lignes
  maxCharsPerLine: 18,
  lineSpacing: 1.35,

  // Sécurité perfs
  maxPoints: 52000,

  glowMap: null
};

// Halo doux
function generateGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 4, size/2, size/2, size/2);
  g.addColorStop(0.00, 'rgba(255,255,255,0.70)');
  g.addColorStop(0.35, 'rgba(180,200,235,0.22)');
  g.addColorStop(1.00, 'rgba(0,0,0,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// --- Shaders ---
const textVertexShader = `
precision mediump float;
attribute float amp;
attribute float phase;
uniform float uTime;
uniform float uSize;
uniform float uPulseAmp;
uniform float uPulseFreq;
uniform float uSwarmAmp;
uniform vec3  uColor;
uniform vec3  uGlowColor;
varying vec3 vInnerColor;
varying vec3 vGlowColor;
varying float vPulse;
varying float vPhase;
void main(){
  vInnerColor = uColor;
  vGlowColor  = uGlowColor;
  vPhase = phase;

  float pulse = 1.0 + uPulseAmp * sin(uTime * uPulseFreq + phase);
  vPulse = pulse;

  vec3 pos = position;
  pos.x += sin(uTime * 0.50 + phase * 2.3) * uSwarmAmp;
  pos.y += cos(uTime * 0.52 + phase * 1.9) * uSwarmAmp;
  pos.z += sin(uTime * 0.6  + phase * 1.7) * amp;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uSize * pulse * (300.0 / -mvPosition.z);
}
`;
const textFragmentShader = `
precision mediump float;
uniform sampler2D uMap;
uniform float     uOpacity;
uniform float     uLumAmp;
uniform float     uLumFreq;
uniform float     uTime;
varying vec3  vInnerColor;
varying vec3  vGlowColor;
varying float vPulse;
varying float vPhase;
void main(){
  vec2 uv = gl_PointCoord;
  vec4 tex = texture2D(uMap, uv);

  float r   = distance(uv, vec2(0.5));
  float rim = smoothstep(0.20, 0.70, r);
  vec3 baseColor = mix(vInnerColor, vGlowColor, rim);

  float lum = 1.0 + uLumAmp * sin(uTime * uLumFreq + vPhase * 1.13);
  baseColor *= clamp(lum, 0.75, 1.6);

  float alpha = tex.a * uOpacity * clamp(0.85 + 0.25 * (vPulse - 1.0), 0.65, 1.15);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(baseColor, alpha);
}
`;

// Wrap helpers
function normalizeSpaces(s) {
  return (s || '')
    .normalize('NFC') // important pour les accents
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
function wrapByChars(text, maxCharsPerLine) {
  const lines = [];
  const blocks = text.split('\n');
  blocks.forEach(block => {
    const words = block.split(' ');
    let current = '';
    for (const w of words) {
      if (!current.length) current = w;
      else if ((current.length + 1 + w.length) <= maxCharsPerLine) current += ' ' + w;
      else { lines.push(current); current = w; }
    }
    if (current.length) lines.push(current);
  });
  return lines;
}

// Sampling
function sampleFillPointsFromShape(shape, contourPts, holePts, fillIntensity, fillDensity, minPerTri, jitter, size, offsetX, offsetY, outArray, maxPoints) {
  if (!THREE.ShapeUtils || typeof THREE.ShapeUtils.triangulateShape !== 'function') return;
  const contour = shape.getSpacedPoints(Math.max(60, Math.floor(contourPts)));
  const holes   = (shape.holes || []).map(h => h.getSpacedPoints(Math.max(40, Math.floor(holePts))));
  const tris    = THREE.ShapeUtils.triangulateShape(contour, holes);
  const allPts2 = contour.concat(...holes);

  let estimate = 0;
  for (const tri of tris) {
    const pA = allPts2[tri[0]], pB = allPts2[tri[1]], pC = allPts2[tri[2]];
    const area = Math.abs((pB.x - pA.x) * (pC.y - pA.y) - (pB.y - pA.y) * (pC.x - pA.x)) * 0.5;
    estimate += Math.max(minPerTri, Math.floor(area * fillIntensity * fillDensity));
  }
  let scale = 1.0;
  if (estimate + outArray.length > maxPoints) {
    scale = Math.max(0.15, (maxPoints - outArray.length) / Math.max(estimate, 1));
  }

  for (const tri of tris) {
    const pA = allPts2[tri[0]], pB = allPts2[tri[1]], pC = allPts2[tri[2]];
    const area = Math.abs((pB.x - pA.x) * (pC.y - pA.y) - (pB.y - pA.y) * (pC.x - pA.x)) * 0.5;
    const samples = Math.max(minPerTri, Math.floor(area * fillIntensity * fillDensity * scale));
    for (let k = 0; k < samples; k++) {
      let a = Math.random(), b = Math.random();
      if (a + b > 1) { a = 1 - a; b = 1 - b; }
      const c = 1 - a - b;
      const x = a * pA.x + b * pB.x + c * pC.x;
      const y = a * pA.y + b * pB.y + c * pC.y;
      outArray.push(new THREE.Vector3(
        x + offsetX + (Math.random() - 0.5) * jitter * size,
        y + offsetY + (Math.random() - 0.5) * jitter * size,
        (Math.random() - 0.5) * 0.02
      ));
      if (outArray.length >= maxPoints) return;
    }
    if (outArray.length >= maxPoints) return;
  }
}
function sampleContourPointsFromShape(shape, contourPts, holePts, offsetX, offsetY, outArray, maxPoints) {
  const outline = shape.getSpacedPoints(Math.max(60, Math.floor(contourPts)));
  for (const p of outline) {
    outArray.push(new THREE.Vector3(p.x + offsetX, p.y + offsetY, 0));
    if (outArray.length >= maxPoints) return;
  }
  (shape.holes || []).forEach(h => {
    const hh = h.getSpacedPoints(Math.max(40, Math.floor(holePts)));
    for (const p of hh) {
      outArray.push(new THREE.Vector3(p.x + offsetX, p.y + offsetY, 0));
      if (outArray.length >= maxPoints) return;
    }
  });
}

// Build
async function buildGroupFromFont(font, message, opts) {
  const o = { ...DEFAULTS, ...opts };
  const {
    size, contourPoints, holePoints,
    fillDensity, fillIntensity, minPerTri, jitter,
    color, glowColor, pointSize, opacity, additive, glowMap,
    pulseAmp, pulseFreq, lumAmp, lumFreq, swarmAmp, waveAmp,
    strokeEnabled, strokeColor, strokeSizeMul, strokeContourMul, strokeHoleMul,
    maxCharsPerLine, lineSpacing, maxPoints
  } = o;

  const text = normalizeSpaces(message || '');

  // ==== Ajustements dynamiques selon le nb de caractères ====
  const charCount = text.replace(/\s/g, '').length;
  let ps = pointSize;
  let fd = fillDensity;
  let fi = fillIntensity;
  let mpt = minPerTri;
  let sw = swarmAmp;
  let la = lumAmp;
  let pa = pulseAmp;
  let wa = waveAmp;
  let ssm = strokeSizeMul;
  let jitterLocal = jitter;
  let mpLimit = maxPoints;

  if (charCount <= 2) {
    ps *= 1.35;
    fd = Math.min(1.0, fd * 1.12);
    fi *= 2.2;
    mpt += 4;
    sw *= 2.1;
    la *= 1.7;
    pa *= 1.25;
    wa *= 1.6;
    ssm *= 1.05;
    jitterLocal *= 1.02;
    mpLimit = Math.min(120000, Math.floor(maxPoints * 1.25));
  } else if (charCount <= 6) {
    ps *= 1.20;
    fd = Math.min(1.0, fd * 1.06);
    fi *= 1.6;
    mpt += 2;
    sw *= 1.6;
    la *= 1.35;
    pa *= 1.12;
    wa *= 1.35;
    ssm *= 1.02;
    mpLimit = Math.min(100000, Math.floor(maxPoints * 1.15));
  } else if (charCount >= 18) {
    sw *= 1.25;
    la *= 1.2;
    wa *= 1.15;
    jitterLocal *= 1.03;
  }

  // Wrap multi-lignes
  const rawLines = (function wrapByChars(text, maxCharsPerLine) {
    const lines = [];
    const blocks = text.split('\n');
    blocks.forEach(block => {
      const words = block.split(' ');
      let current = '';
      for (const w of words) {
        if (!current.length) current = w;
        else if ((current.length + 1 + w.length) <= maxCharsPerLine) current += ' ' + w;
        else { lines.push(current); current = w; }
      }
      if (current.length) lines.push(current);
    });
    return lines;
  })(text, maxCharsPerLine);

  const lineHeight = size * lineSpacing;

  // Mesure largeur par ligne
  const shapesPerLine = [];
  const lineWidths = [];
  for (const line of rawLines) {
    const lineShapes = font.generateShapes(line, size);
    let minX = +Infinity, maxX = -Infinity;
    lineShapes.forEach(sh => {
      const pts = sh.getSpacedPoints(64);
      for (const p of pts) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; }
    });
    const width = (minX === +Infinity) ? 0 : (maxX - minX);
    shapesPerLine.push(lineShapes);
    lineWidths.push(width);
  }

  const totalHeight = (rawLines.length - 1) * lineHeight;
  const outlinePts = [];
  const fillPts = [];

  rawLines.forEach((line, idx) => {
    const yOff = (totalHeight * 0.5) - idx * lineHeight;
    const lineShapes = shapesPerLine[idx];
    const width = lineWidths[idx];
    const xOff = -width / 2;

    lineShapes.forEach(shape => {
      if (strokeEnabled) {
        sampleContourPointsFromShape(
          shape,
          contourPoints * strokeContourMul,
          holePoints * strokeHoleMul,
          xOff, yOff,
          outlinePts, mpLimit
        );
      }
      sampleFillPointsFromShape(
        shape,
        contourPoints, holePoints,
        fi, fd, mpt, jitterLocal, size,
        xOff, yOff,
        fillPts, mpLimit
      );
    });
  });

  const allForBBox = outlinePts.concat(fillPts);
  const bbox = (allForBBox.length
    ? new THREE.Box3().setFromPoints(allForBBox)
    : new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1,1,1)));
  const center = bbox.getCenter(new THREE.Vector3());
  outlinePts.forEach(v => v.sub(center));
  fillPts.forEach(v => v.sub(center));

  // --- Remplissage (shader) ---
  const countFill = fillPts.length;
  const geomFill = new THREE.BufferGeometry();
  const posFill = new Float32Array(countFill * 3);
  const ampFill = new Float32Array(countFill);
  const phaseFill = new Float32Array(countFill);
  for (let i = 0; i < countFill; i++) {
    const v = fillPts[i];
    posFill[i*3+0] = v.x; posFill[i*3+1] = v.y; posFill[i*3+2] = v.z;
    ampFill[i]   = (Math.random() * 2 - 1) * wa;
    phaseFill[i] = Math.random() * Math.PI * 2;
  }
  geomFill.setAttribute('position', new THREE.BufferAttribute(posFill, 3));
  geomFill.setAttribute('amp',      new THREE.BufferAttribute(ampFill, 1));
  geomFill.setAttribute('phase',    new THREE.BufferAttribute(phaseFill, 1));

  const tex = o.glowMap || generateGlowTexture();
  const colInner = new THREE.Color(o.color);
  const colGlow  = new THREE.Color(o.glowColor);
  const matFill = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uMap:       { value: tex },
      uOpacity:   { value: o.opacity },
      uSize:      { value: ps },
      uPulseAmp:  { value: pa },
      uPulseFreq: { value: o.pulseFreq },
      uLumAmp:    { value: la },
      uLumFreq:   { value: o.lumFreq },
      uSwarmAmp:  { value: sw },
      uColor:     { value: new THREE.Vector3(colInner.r, colInner.g, colInner.b) },
      uGlowColor: { value: new THREE.Vector3(colGlow.r,  colGlow.g,  colGlow.b ) }
    },
    vertexShader:   textVertexShader,
    fragmentShader: textFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    alphaTest: 0.01
  });
  const fill = new THREE.Points(geomFill, matFill);
  fill.renderOrder = 999;

  // --- Contour (noir) ---
  let stroke = null;
  if (o.strokeEnabled && outlinePts.length) {
    const countStroke = outlinePts.length;
    const geomStroke = new THREE.BufferGeometry();
    const posStroke = new Float32Array(countStroke * 3);
    for (let i = 0; i < countStroke; i++) {
      const v = outlinePts[i];
      posStroke[i*3+0] = v.x; posStroke[i*3+1] = v.y; posStroke[i*3+2] = v.z;
    }
    geomStroke.setAttribute('position', new THREE.BufferAttribute(posStroke, 3));
    const matStroke = new THREE.PointsMaterial({
      color: o.strokeColor,
      size: Math.max(0.01, matFill.uniforms.uSize.value * o.strokeSizeMul),
      map: tex,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      alphaTest: 0.02
    });
    stroke = new THREE.Points(geomStroke, matStroke);
    stroke.renderOrder = 1000;

    stroke.userData.home   = posStroke.slice();
    stroke.userData.target = posStroke.slice();
    stroke.userData.mode   = 'assemble';
  }

  const group = new THREE.Group();
  group.add(fill);
  if (stroke) group.add(stroke);

  fill.userData.home   = posFill.slice();
  fill.userData.target = posFill.slice();
  fill.userData.mode   = 'assemble';

  group.userData.fill      = fill;
  group.userData.stroke    = stroke;
  group.userData.hasStroke = !!stroke;

  const localBBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(0,0,0),
    new THREE.Vector3(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z)
  );
  group.userData.localBBox = {
    min: localBBox.min.clone(),
    max: localBBox.max.clone(),
    width:  localBBox.max.x - localBBox.min.x,
    height: localBBox.max.y - localBBox.min.y
  };

  return { group, fill, stroke };
}

// API — charge une police avec fallback
export function createTextGroup(message = '', options = {}) {
  const loader = new THREE.FontLoader();
  const urls = options.fontUrl
    ? [options.fontUrl, ...DEFAULT_FONT_URLS]
    : DEFAULT_FONT_URLS.slice();

  return new Promise((resolve, reject) => {
    const tryLoad = (i) => {
      if (i >= urls.length) return reject(new Error('Aucune police n’a pu être chargée.'));
      loader.load(
        urls[i],
        (font) => { buildGroupFromFont(font, message, options).then(resolve).catch(reject); },
        undefined,
        () => { console.warn('[text_particles] Police KO:', urls[i]); tryLoad(i + 1); }
      );
    };
    tryLoad(0);
  });
}
