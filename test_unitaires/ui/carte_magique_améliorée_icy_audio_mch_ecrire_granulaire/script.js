// Exécute le script seulement quand le DOM est totalement chargé
document.addEventListener("DOMContentLoaded", () => {
  // Sélection des éléments HTML principaux
  const card = document.getElementById("magicCard"); // Carte principale cliquable
  const details = document.getElementById("details"); // Contenu masqué à faire apparaître
  const closeBtn = details.querySelector(".close-btn"); // Bouton de fermeture de la carte
  const magicText = document.getElementById("magicText"); // Texte à animer (effet machine à écrire)
  const originalText = magicText.textContent; // Stockage du texte d’origine

  // Variables de contrôle d’état
  let isExpanded = false; // Indique si la carte est ouverte ou non
  let animationFrame; // Pour gérer les animations avec requestAnimationFrame
  let audioCtx = null; // Contexte audio WebAudio (initialisé au premier clic)

  // 🔊 Initialise le contexte audio (obligatoire pour utiliser Web Audio API)
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // 🔉 Joue un bruit de clic discret (effet machine à écrire) pour chaque lettre
  function playTypingClick() {
    initAudio();

    const bufferSize = 0.05 * audioCtx.sampleRate; // Durée du son (0.05s)
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate); // 1 canal (mono)
    const data = buffer.getChannelData(0);

    // Génération de bruit blanc dégressif (click percussif)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }

    const source = audioCtx.createBufferSource(); // Crée un lecteur de son
    const gain = audioCtx.createGain(); // Contrôle du volume
    const pan = audioCtx.createStereoPanner(); // Panoramique gauche/droite

    source.buffer = buffer;

    // 💡 Volume variable entre 0.07 et 0.1 pour donner du naturel
    // 👉 Plus fort : augmente la base 0.07 à ~0.12 max
    gain.gain.value = 0.0007 + Math.random() * 0.03;

    // 🔄 Pan gauche/droite aléatoire pour spatialisation subtile
    pan.pan.value = Math.random() * 2 - 1;

    // Connexions des noeuds audio
    source.connect(gain).connect(pan).connect(audioCtx.destination);
    source.start(); // Lance immédiatement
  }

  // 🔊 Son magique d'ouverture/fermeture (bruit blanc filtré avec réverb-like)
  function playOpenCloseSound() {
    initAudio();

    const bufferSize = 2 * audioCtx.sampleRate; // 2 secondes de bruit blanc
    const noiseBuffer = audioCtx.createBuffer(
      1,
      bufferSize,
      audioCtx.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);

    // Génère du bruit blanc
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    // 💡 Filtres pour sculpter le son :
    const bandpass = audioCtx.createBiquadFilter(); // Conserve une bande de fréquences
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(500, audioCtx.currentTime); // Centré sur 500Hz
    bandpass.Q.value = 0.9; // Qualité du filtre

    const highpass = audioCtx.createBiquadFilter(); // Supprime les très basses fréquences
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(1200, audioCtx.currentTime); // Laisse passer à partir de 1200Hz

    const gain = audioCtx.createGain();

    // 📈 Enveloppe de volume (fade-in rapide puis fade-out long)
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime); // Volume très faible au départ

    // ➕ Augmentation rapide jusqu’à 0.4 (volume perceptible)
    // 👉 Pour amplifier l'effet magique, augmenter à 0.6 ou 0.8 max
    gain.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + 0.15);

    // ⬇️ Extinction progressive vers 0 (silence)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

    // Connexion des éléments
    noise
      .connect(bandpass)
      .connect(highpass)
      .connect(gain)
      .connect(audioCtx.destination);
    noise.start();
    noise.stop(audioCtx.currentTime + 1.5);
  }

  // 📦 Déplie la carte + anime le texte
  const expand = () => {
    playOpenCloseSound(); // Son d’ouverture

    details.classList.add("open");
    let height = 0;
    const fullHeight = details.scrollHeight;

    // Animation fluide d’expansion verticale
    const step = () => {
      height += 10;
      if (height >= fullHeight) {
        details.style.maxHeight = fullHeight + "px";
        return;
      }
      details.style.maxHeight = height + "px";
      animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);

    // Animation machine à écrire
    typeWriter(magicText, originalText);
  };

  // 📦 Replie la carte + masque le texte
  const collapse = () => {
    playOpenCloseSound(); // Son de fermeture

    cancelAnimationFrame(animationFrame);
    let height = details.scrollHeight;
    details.classList.remove("open");

    // Animation fluide de repli
    const step = () => {
      height -= 10;
      if (height <= 0) {
        details.style.maxHeight = "0px";
        magicText.textContent = originalText; // Réinitialise le texte
        return;
      }
      details.style.maxHeight = height + "px";
      animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);
  };

  // 🖋️ Machine à écrire magique + son à chaque lettre
  const typeWriter = (element, text) => {
    element.textContent = "";
    let i = 0;

    function write() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        playTypingClick(); // 🔊 Son court à chaque lettre
        i++;
        setTimeout(write, 30 + Math.random() * 10); // Vitesse aléatoire
      }
    }
    write();
  };

  // 🧙‍♂️ Clique sur la carte pour ouvrir/fermer
  card.addEventListener("click", (e) => {
    if (e.target === closeBtn) return;

    // Animation de brillance
    card.classList.add("clicked");
    setTimeout(() => card.classList.remove("clicked"), 700);

    if (!isExpanded) {
      expand();
    } else {
      collapse();
    }
    isExpanded = !isExpanded;
  });

  // 🧵 Bouton "fermer"
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Empêche le clic de remonter à la carte
    collapse();
    isExpanded = false;
  });

  // 🖱️ Effet de lumière qui suit la souris
  card.addEventListener("mousemove", (e) => {
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 10;
    const y = (e.clientY - top - height / 2) / 10;
    card.style.boxShadow = `${x}px ${y}px 24px var(--shadow)`;
  });

  // ✨ Repositionne l'ombre quand la souris sort
  card.addEventListener("mouseleave", () => {
    card.style.boxShadow = `0 0 20px var(--shadow)`;
  });
});
