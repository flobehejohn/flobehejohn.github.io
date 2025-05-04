// Attendre que le DOM soit enti�rement charg� avant d'ex�cuter le script
document.addEventListener("DOMContentLoaded", function () {
  // S�lectionne l'�l�ment de la photo magique
  const magicPhoto = document.getElementById("magic-photo");

  // Variables globales pour g�rer l'animation et le glitch
  let animationInterval = null;
  let glitchTimeout = null;

  // ------------------------------------------------------------
  // 1) Cr�ation d'un canvas en arri�re-plan pour les effets visuels
  // ------------------------------------------------------------

  // Cr�ation et ajout d'un �l�ment <canvas> au body
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  // Configuration du style du canvas pour qu'il soit en arri�re-plan
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.zIndex = "-1"; // S'assurer qu'il est derri�re l'image
  canvas.style.pointerEvents = "none"; // Emp�cher toute interaction avec le canvas

  // Contexte 2D pour dessiner sur le canvas
  const ctx = canvas.getContext("2d");

  /**
   * Ajuste la taille du canvas � la taille de la fen�tre
   */
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();

  // Mettre � jour le canvas en cas de redimensionnement de la fen�tre
  window.addEventListener("resize", resizeCanvas);

  // ------------------------------------------------------------
  // 2) Gestion des effets glitch au clic sur l'image
  // ------------------------------------------------------------

  magicPhoto.addEventListener("click", function () {
    if (!animationInterval) {
      startParticleAnimation(); // D�marre l'animation de particules

      let step = 0;
      // S�quence d'effets glitch appliqu�s successivement
      const glitchPhases = [
        () => applyGlitchEffect(0.1, 1.5, 10, 20, true), // Distorsion forte
        () => applyGlitchEffect(0.2, 1.2, 5, 10, false), // Lumi�re satur�e
        () => applyGlitchEffect(0.05, 2, 15, 30, true), // Explosion visuelle
        () => applyGlitchEffect(0.3, 1, 0, 5, false), // Effet sombre
        () => applyGlitchEffect(0.15, 1.3, 8, 12, true), // Filtrage fragment�
        () => applyGlitchEffect(0.2, 1, 0, 2, false), // Remise � z�ro
      ];

      // Appliquer les effets glitch en boucle toutes les 250ms
      animationInterval = setInterval(() => {
        glitchPhases[step]();
        step = (step + 1) % glitchPhases.length;
      }, 250);

      // Effet de duplication visuelle temporaire
      setTimeout(() => {
        magicPhoto.classList.add("duplicate");
        setTimeout(() => {
          magicPhoto.classList.remove("duplicate");
        }, 800);
      }, 600);

      // Effet de "mirroring" temporaire
      setTimeout(() => {
        magicPhoto.classList.add("mirror");
        setTimeout(() => {
          magicPhoto.classList.remove("mirror");
        }, 100);
      }, 1200);

      // Effet de saturation lumineuse finale
      setTimeout(() => {
        magicPhoto.style.filter = "brightness(5)";
        magicPhoto.style.opacity = "1";
        magicPhoto.style.imageRendering = "auto";
      }, 1800);

      // Fin de l'effet glitch apr�s 2.5 secondes
      glitchTimeout = setTimeout(() => {
        stopGlitch();
        stopParticleAnimation();
      }, 2500);
    } else {
      clearTimeout(glitchTimeout);
      glitchTimeout = setTimeout(() => {
        stopGlitch();
        stopParticleAnimation();
      }, 2500);
    }
  });

  /**
   * Applique un effet glitch en ajustant divers param�tres CSS
   * @param {number} opacity - Opacit� de l'image
   * @param {number} brightness - Luminosit� de l'image
   * @param {number} hueShift - D�calage de la teinte
   * @param {number} blur - Flou appliqu�
   * @param {boolean} pixelate - Appliquer un effet de pixellisation
   */
  function applyGlitchEffect(opacity, brightness, hueShift, blur, pixelate) {
    magicPhoto.style.filter = `
            opacity(${opacity})
            brightness(${brightness})
            hue-rotate(${hueShift}deg)
            blur(${blur}px)
            ${pixelate ? "contrast(20%) saturate(2) grayscale(1)" : ""}
        `;
  }

  /**
   * Arr�te les effets glitch et r�initialise l'image
   */
  function stopGlitch() {
    clearInterval(animationInterval);
    animationInterval = null;
    magicPhoto.style.filter = "none";
    magicPhoto.style.opacity = "1";
    magicPhoto.style.imageRendering = "auto";
  }

  // ------------------------------------------------------------
  // 3) Animation des particules en arri�re-plan
  // ------------------------------------------------------------
  let particles = [];
  let animationFrame = null;

  /**
   * D�marre l'animation des particules
   */
  function startParticleAnimation() {
    particles = generateParticles(7000); // G�n�re 7000 particules
    animateParticles();
  }

  /**
   * Arr�te l'animation des particules
   */
  function stopParticleAnimation() {
    cancelAnimationFrame(animationFrame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * G�n�re un ensemble de particules al�atoires
   * @param {number} count - Nombre de particules � g�n�rer
   * @returns {Array} Liste des particules
   */
  function generateParticles(count) {
    let generatedParticles = [];
    for (let i = 0; i < count; i++) {
      generatedParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.9 + 0.2, // Taille entre 0.2 et 2.1
        opacity: Math.random(),
        speedX: (Math.random() - 0.5) * 4,
        speedY: (Math.random() - 0.5) * 4,
      });
    }
    return generatedParticles;
  }

  /**
   * Anime les particules en leur donnant un mouvement fluide
   */
  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let progress = (performance.now() % 2000) / 2000;
    let centerX = canvas.width / 2;
    let centerY = canvas.height / 2;

    particles.forEach((p) => {
      if (progress < 0.5) {
        p.x += p.speedX;
        p.y += p.speedY;
      } else {
        let angle = Math.atan2(centerY - p.y, centerX - p.x);
        p.x += Math.cos(angle) * 2;
        p.y += Math.sin(angle) * 2;
      }

      if (progress > 0.8) {
        p.opacity -= 0.02;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${p.opacity})`;
      ctx.fill();
    });

    animationFrame = requestAnimationFrame(animateParticles);
  }
});
