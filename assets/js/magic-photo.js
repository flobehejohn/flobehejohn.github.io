// assets/js/magic-photo.js — version compatible PJAX
(() => {
  'use strict';

  // État interne (réutilisé entre init/destroy)
  let mounted = false;
  let magicPhoto = null;
  let canvas = null, ctx = null;
  let resizeHandler = null;
  let clickHandler = null;

  let animationInterval = null;
  let glitchTimeout = null;
  let animationFrame = null;
  let particles = [];

  // ---------- Effets glitch / particules ----------
  function applyGlitchEffect(opacity, brightness, hueShift, blur, pixelate) {
    if (!magicPhoto) return;
    magicPhoto.style.filter = `
      opacity(${opacity})
      brightness(${brightness})
      hue-rotate(${hueShift}deg)
      blur(${blur}px)
      ${pixelate ? "contrast(20%) saturate(2) grayscale(1)" : ""}
    `;
  }

  function stopGlitch() {
    if (animationInterval) { clearInterval(animationInterval); animationInterval = null; }
    if (!magicPhoto) return;
    magicPhoto.style.filter = "none";
    magicPhoto.style.opacity = "1";
    magicPhoto.style.imageRendering = "auto";
    magicPhoto.classList.remove("duplicate", "mirror");
  }

  function generateParticles(count) {
    const out = [];
    const w = canvas?.width || 0, h = canvas?.height || 0;
    for (let i = 0; i < count; i++) {
      out.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 1.9 + 0.2,
        opacity: Math.random(),
        speedX: (Math.random() - 0.5) * 4,
        speedY: (Math.random() - 0.5) * 4,
      });
    }
    return out;
  }

  function animateParticles() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const progress = (performance.now() % 2000) / 2000;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    for (const p of particles) {
      if (progress < 0.5) {
        p.x += p.speedX;
        p.y += p.speedY;
      } else {
        const a = Math.atan2(cy - p.y, cx - p.x);
        p.x += Math.cos(a) * 2;
        p.y += Math.sin(a) * 2;
      }
      if (progress > 0.8) p.opacity -= 0.02;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${p.opacity})`;
      ctx.fill();
    }
    animationFrame = requestAnimationFrame(animateParticles);
  }

  function startParticleAnimation() {
    if (!canvas) return;
    particles = generateParticles(7000);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animateParticles();
  }

  function stopParticleAnimation() {
    if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = [];
  }

  // ---------- Init / Destroy ----------
  function init(container = document) {
    // Cherche l’élément dans le fragment PJAX (ou dans le document au 1er chargement)
    const root = (container instanceof Element) ? container : document;
    const el = root.querySelector('#magic-photo');
    if (!el) return; // pas de “magic photo” sur cette page

    // Si déjà monté pour CET élément, on ne refait rien
    if (mounted && magicPhoto === el) return;

    // Si on change d’élément, cleanup d’abord
    if (mounted && magicPhoto && magicPhoto !== el) destroy();

    magicPhoto = el;

    // Canvas arrière-plan
    canvas = document.createElement('canvas');
    canvas.setAttribute('data-magicphoto-canvas', '');
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0', left: '0',
      width: '100vw', height: '100vh',
      zIndex: '-1', pointerEvents: 'none'
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeHandler = resizeCanvas;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Click → séquence glitch + particules
    clickHandler = () => {
      if (animationInterval) {
        // Si déjà en cours, on prolonge juste la fin
        if (glitchTimeout) clearTimeout(glitchTimeout);
        glitchTimeout = setTimeout(() => { stopGlitch(); stopParticleAnimation(); }, 2500);
        return;
      }

      startParticleAnimation();

      let step = 0;
      const glitchPhases = [
        () => applyGlitchEffect(0.1, 1.5, 10, 20, true),
        () => applyGlitchEffect(0.2, 1.2, 5, 10, false),
        () => applyGlitchEffect(0.05, 2, 15, 30, true),
        () => applyGlitchEffect(0.3, 1, 0, 5, false),
        () => applyGlitchEffect(0.15, 1.3, 8, 12, true),
        () => applyGlitchEffect(0.2, 1, 0, 2, false),
      ];
      animationInterval = setInterval(() => {
        glitchPhases[step]();
        step = (step + 1) % glitchPhases.length;
      }, 250);

      // Duplications / mirroring (si des classes CSS existent)
      setTimeout(() => {
        magicPhoto.classList.add("duplicate");
        setTimeout(() => magicPhoto.classList.remove("duplicate"), 800);
      }, 600);

      setTimeout(() => {
        magicPhoto.classList.add("mirror");
        setTimeout(() => magicPhoto.classList.remove("mirror"), 100);
      }, 1200);

      setTimeout(() => {
        magicPhoto.style.filter = "brightness(5)";
        magicPhoto.style.opacity = "1";
        magicPhoto.style.imageRendering = "auto";
      }, 1800);

      glitchTimeout = setTimeout(() => {
        stopGlitch();
        stopParticleAnimation();
      }, 2500);
    };
    magicPhoto.addEventListener('click', clickHandler);

    mounted = true;
  }

  function destroy() {
    if (!mounted) return;

    // Timers / RAF
    if (animationInterval) { clearInterval(animationInterval); animationInterval = null; }
    if (glitchTimeout) { clearTimeout(glitchTimeout); glitchTimeout = null; }
    if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }

    // Listeners
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
    if (magicPhoto && clickHandler) { magicPhoto.removeEventListener('click', clickHandler); clickHandler = null; }

    // Styles et classes
    if (magicPhoto) {
      magicPhoto.style.filter = '';
      magicPhoto.style.opacity = '';
      magicPhoto.style.imageRendering = '';
      magicPhoto.classList.remove('duplicate', 'mirror');
    }

    // Canvas
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null;

    particles = [];
    magicPhoto = null;
    mounted = false;
  }

  // ---------- Hooks globaux ----------
  document.addEventListener('DOMContentLoaded', () => init(document));
  document.addEventListener('pjax:ready', (e) => init(e.detail?.container || document));
  document.addEventListener('pjax:before', () => destroy());

  // (Optionnel) API globale pour le hub
  window.initMagicPhoto = window.initMagicPhoto || init;
  window.teardownMagicPhoto = window.teardownMagicPhoto || destroy;
})();