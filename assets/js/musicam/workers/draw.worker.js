// assets/js/musicam/workers/draw.worker.js
// OffscreenCanvas worker — overlay 1:1 robuste
// • Protocoles pris en charge :
//   - init { canvas, cssW, cssH, dpr }
//   - config { skeleton, styles }
//   - resize { cssW, cssH, dpr }  ← resize CSS/DPR
//   - resize { width, height }    ← legacy: dimensions vidéo (vw/vh)
//   - fit { cssW,cssH,vidW,vidH,scale,dx,dy,mode,mirrored } ← mapping cover/contain 1:1
//   - pose { vw, vh, mirrored, kps[, face] }  ← objets {x,y,score}
//   - draw { vw, vh, mirrored, k:Float32Array, f?:Float32Array } ← packé (x,y,score)*
//   - visibility { hidden:boolean }
// • Miroir géré proprement (x -> vw - x) ; styles fusionnés ; commit() pour Firefox.

let canvas = null, ctx = null;
let DPR = 1;

// Taille "pixel" réelle de la surface (canvas.width/height)
let W = 0, H = 0;

// État "fit" (mapping cover/contain -> transform 1:1)
let fit = {
  enabled: false,
  cssW: 0, cssH: 0,
  vidW: 0, vidH: 0,
  scale: 1, dx: 0, dy: 0,
  mode: 'cover',
  mirrored: false
};

// Dernières dimensions vidéo connues (utile hors fit)
let lastVW = 0, lastVH = 0;

// Skeleton & styles
let skeleton = null; // Uint16Array [a0,b0,a1,b1,...]
let styles = {
  kpMinScore: 0.4,
  kpRadius: 5,
  skeletonOpacity: 0.9,
  skeletonLineWidth: 2,
  kpColor: '#00e0ff',
  skeletonColor: 'rgba(255,255,255,0.9)'
};

let isHidden = false;

// ———————————————————————————————————————————————————————————
// Utils
const isArrayLike = (a) => a && typeof a.length === 'number';

function normalizeSkeleton(s) {
  if (!s) return null;
  if (s instanceof Uint16Array) return s;
  if (Array.isArray(s) && typeof s[0] === 'number') return new Uint16Array(s);
  if (Array.isArray(s) && Array.isArray(s[0])) {
    const flat = new Uint16Array(s.length * 2);
    for (let i = 0; i < s.length; i++) { flat[i*2] = s[i][0]|0; flat[i*2+1] = s[i][1]|0; }
    return flat;
  }
  return null;
}

function resizeTo(pxW, pxH){
  const w = Math.max(2, pxW|0), h = Math.max(2, pxH|0);
  if (!canvas) return;
  if (w !== W || h !== H) { W = w; H = h; canvas.width = W; canvas.height = H; }
}

function resizeFromCSS(cssW, cssH, dpr){
  if (dpr) DPR = Math.max(1, dpr);
  fit.cssW = cssW|0; fit.cssH = cssH|0;
  resizeTo(Math.floor(fit.cssW * DPR), Math.floor(fit.cssH * DPR));
}

function clearAll() {
  if (!ctx || !canvas) return;
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.restore();
}

function applyFitTransform() {
  if (!ctx) return;
  if (fit.enabled) {
    // Transforme l'espace "vidéo" (vw/vh) -> pixels écran via cover/contain + DPR
    ctx.setTransform(fit.scale * DPR, 0, 0, fit.scale * DPR, fit.dx * DPR, fit.dy * DPR);
  } else {
    // Legacy: on dessine directement dans l'espace vidéo (canvas = vw×vh)
    ctx.setTransform(1,0,0,1,0,0);
  }
}

function packedToKps(buf){
  // buf: Array-like de (x,y,score) répétés
  const n = buf.length - (buf.length % 3);
  const out = new Array(n/3);
  for (let i=0, j=0; i<n; i+=3, j++){
    out[j] = { x: buf[i]||0, y: buf[i+1]||0, score: buf[i+2]||0 };
  }
  return out;
}

// ———————————————————————————————————————————————————————————
// Dessin
function drawFace(points, color='rgba(255,179,71,0.9)'){
  if (!ctx || !isArrayLike(points) || !points.length) return;
  ctx.save(); ctx.fillStyle=color;
  if (typeof points[0] === 'number') {
    const step = Math.max(1, Math.floor((points.length/2) / 200));
    for (let i=0; i<points.length; i += 2*step) {
      const x = points[i], y = points[i+1];
      ctx.fillRect((x|0)-1,(y|0)-1,2,2);
    }
  } else {
    const step = Math.max(1, Math.floor(points.length / 200));
    for (let i=0; i<points.length; i += step) {
      const p = points[i]; const x = p?.x ?? p?.[0], y = p?.y ?? p?.[1];
      if (x!=null && y!=null) ctx.fillRect((x|0)-1,(y|0)-1,2,2);
    }
  }
  ctx.restore();
}

function drawPose({ kps, vw, vh, mirrored, face }){
  if (!ctx || !kps || !kps.length) return;

  const th = styles.kpMinScore ?? 0.4;
  const r  = styles.kpRadius    ?? 5;

  // lignes du squelette
  if (skeleton && skeleton.length >= 2) {
    ctx.save();
    ctx.globalAlpha = styles.skeletonOpacity ?? 0.9;
    ctx.lineWidth   = styles.skeletonLineWidth ?? 2;
    ctx.lineCap     = 'round';
    ctx.strokeStyle = styles.skeletonColor || 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    for (let i=0; i<skeleton.length; i+=2){
      const a = skeleton[i], b = skeleton[i+1];
      const A = kps[a], B = kps[b];
      if (!A || !B) continue;
      if ((A.score||0) < th || (B.score||0) < th) continue;
      const Ax = mirrored ? (vw - A.x) : A.x;
      const Bx = mirrored ? (vw - B.x) : B.x;
      ctx.moveTo(Ax, A.y);
      ctx.lineTo(Bx, B.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // points
  ctx.save();
  ctx.fillStyle = styles.kpColor || '#00e0ff';
  for (const p of kps){
    if (!p || (p.score||0) < th) continue;
    const px = mirrored ? (vw - p.x) : p.x;
    ctx.beginPath(); ctx.arc(px, p.y, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // visage (optionnel)
  if (face && face.length) drawFace(face);
}

// ———————————————————————————————————————————————————————————
// Messages
self.onmessage = (e) => {
  const d = e.data || {};
  switch (d.type) {

    case 'init': {
      canvas = d.canvas || null;
      DPR = Math.max(1, d.dpr || 1);
      if (canvas) {
        try { ctx = canvas.getContext('2d', { alpha:true, desynchronized:true }); }
        catch { ctx = canvas.getContext('2d'); }
      }
      if (d.cssW && d.cssH) resizeFromCSS(d.cssW, d.cssH, d.dpr);
      break;
    }

    case 'config': {
      if (d.skeleton) skeleton = normalizeSkeleton(d.skeleton);
      if (d.styles)   styles   = { ...styles, ...d.styles };
      try { self.postMessage({ type:'configOk', len: skeleton ? skeleton.length : 0 }); } catch {}
      break;
    }

    case 'resize': {
      // Deux formes :
      // 1) { cssW, cssH, dpr } → redimension CSS/DPR (fit possible)
      // 2) { width, height }   → legacy (dimensions vidéo)
      if (d.cssW && d.cssH) {
        resizeFromCSS(d.cssW, d.cssH, d.dpr);
        // si un fit est actif, on garde son état mais la surface a changé
        // (le main renverra en général un fit() à jour juste après)
      } else if (d.width && d.height) {
        lastVW = d.width|0; lastVH = d.height|0;
        if (!fit.enabled) {
          // mode legacy : la surface pixel = vw×vh ; pas de transform
          resizeTo(lastVW, lastVH);
        }
      }
      break;
    }

    case 'fit': {
      // Reçoit le mapping calculé côté main (cover/contain strict)
      // { cssW,cssH,vidW,vidH,scale,dx,dy,mode,mirrored }
      fit.enabled  = true;
      fit.cssW     = d.cssW|0;
      fit.cssH     = d.cssH|0;
      fit.vidW     = (d.vidW|0) || lastVW || fit.vidW;
      fit.vidH     = (d.vidH|0) || lastVH || fit.vidH;
      fit.scale    = +d.scale || 1;
      fit.dx       = +d.dx || 0;
      fit.dy       = +d.dy || 0;
      fit.mode     = d.mode || 'cover';
      fit.mirrored = !!d.mirrored;

      // S’assure que la surface suit le CSS*DPR
      if (fit.cssW && fit.cssH) resizeFromCSS(fit.cssW, fit.cssH, DPR);
      break;
    }

    case 'visibility': {
      isHidden = !!d.hidden;
      if (isHidden) { clearAll(); ctx?.commit?.(); }
      break;
    }

    // Nouveau protocole (objets)
    case 'pose': {
      if (!canvas || !ctx) return;
      if (isHidden) return;

      const vw = d.vw|0, vh = d.vh|0;
      lastVW = vw || lastVW; lastVH = vh || lastVH;

      // Si fit actif mais pas encore de cssW/H (cas limite), on force la surface CSS courante
      if (fit.enabled && (!fit.cssW || !fit.cssH) && canvas) {
        fit.cssW = canvas.width / DPR;
        fit.cssH = canvas.height / DPR;
      }

      clearAll();
      applyFitTransform();

      const mirrored = (d.mirrored !== undefined) ? !!d.mirrored : !!fit.mirrored;
      const kps = Array.isArray(d.kps) ? d.kps : (isArrayLike(d.kps) ? packedToKps(d.kps) : null);
      if (kps && kps.length) {
        drawPose({ kps, vw, vh, mirrored, face: d.face });
      }
      ctx.commit?.();
      try { self.postMessage({ type:'stats', kLen:kps ? kps.length : 0, fLen:(d.face?.length||0) }); } catch {}
      break;
    }

    // Ancien protocole (packé)
    case 'draw': {
      if (!canvas || !ctx) return;
      if (isHidden) return;

      const vw = d.vw|0, vh = d.vh|0;
      lastVW = vw || lastVW; lastVH = vh || lastVH;

      if (!fit.enabled) {
        // Legacy : surface = vw×vh ; aucune transform
        if (canvas.width !== vw || canvas.height !== vh) resizeTo(vw, vh);
      } else {
        // Fit actif : surface suit déjà CSS*DPR ; on applique le mapping
        // (pas de resize ici)
      }

      clearAll();
      applyFitTransform();

      const hasK = isArrayLike(d.k) && d.k.length>0;
      const hasF = isArrayLike(d.f) && d.f.length>0;
      const mirrored = (d.mirrored !== undefined) ? !!d.mirrored : !!fit.mirrored;

      const kps = hasK ? packedToKps(d.k) : [];
      if (kps.length) drawPose({ kps, vw, vh, mirrored, face: hasF ? d.f : null });

      ctx.commit?.();
      try { self.postMessage({ type:'stats', kLen:kps.length, fLen:(hasF ? d.f.length : 0), stride:3 }); } catch {}
      break;
    }
  }
};
