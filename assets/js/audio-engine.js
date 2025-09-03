/* ==================================
   audio-engine.js
   ===================================
   ✅ Moteur audio optimisé basé sur Tone.js
   ✅ Lecture MIDI fluide et polyphonique
   ✅ Lecture audio avec side-chain + volume global
   ✅ Support d'un bouton STOP et contrôle de volume
   =================================== */

console.log("✅ Chargement de AudioEngine...");

if (typeof Tone === "undefined") {
  console.error("❌ Tone.js n'est pas chargé !");
} else {
  console.log("✅ Tone.js est bien chargé.");
}

// 🎹 Synthé polyphonique pour la lecture MIDI
const synthMaster = new Tone.PolySynth(Tone.Synth);

// 🎚️ Compresseur pour side-chain
const sideChainCompressor = new Tone.Compressor({
  threshold: -30,
  ratio: 12,
  attack: 0.003,
  release: 0.25,
});

const backgroundPlayer = new Tone.Player({
  url: "https://pub-280f3c4082bb477f9ad37b96d10ee653.r2.dev/audio/backgrounds/ambiance_loop.mp3",
  loop: true,
  autostart: false,
  onload: () => console.log("✅ ambiance_loop.mp3 chargé depuis Cloudflare R2"),
  onerror: (e) => console.error("❌ Erreur chargement ambiance_loop.mp3 :", e),
});

// 🔉 Contrôle global du volume
let masterGain = new Tone.Gain(0.7).toDestination();
let activePlayers = [];

// 🔌 Connecter les éléments audio au masterGain
function connectToOutput(node) {
  synthMaster.connect(node);
  backgroundPlayer.disconnect().connect(node);
  masterGain = node;
  console.log("🔌 Sortie audio redirigée vers le contrôleur global de volume.");
}

// ⛔ Stopper tous les sons actifs
function stopAll() {
  try {
    console.log("⏹️ Arrêt global demandé...");

    // Libération des notes MIDI
    if (synthMaster) {
      synthMaster.releaseAll();
      console.log("🎹 Synthé arrêté.");
    }

    // Arrêt du player de fond s’il est en cours
    if (backgroundPlayer && backgroundPlayer.state === "started") {
      backgroundPlayer.stop();
      console.log("🎵 Ambiance stoppée.");
    }

    // Arrêt de tous les SFX actifs
    activePlayers = activePlayers.filter((player) => {
      if (player && player.state === "started") {
        player.stop();
        console.log("🔇 SFX stoppé.");
        return false; // le retire de la liste
      }
      return true;
    });

    console.log("✅ Tous les sons ont été arrêtés proprement.");
  } catch (error) {
    console.error("❌ Erreur lors de l'arrêt global :", error);
  }
}

// 🎼 Lire un fichier MIDI externe
async function playMidiFile(url) {
  try {
    console.log("🎼 Chargement du MIDI :", url);
    const midiResponse = await fetch(url);
    const arrayBuffer = await midiResponse.arrayBuffer();
    const midiData = new Tone.Midi(arrayBuffer);

    if (!midiData.tracks || midiData.tracks.length === 0) {
      console.warn("⚠️ Aucune piste MIDI détectée.");
      return;
    }

    const now = Tone.now() + 0.5;
    midiData.tracks.forEach((track) => {
      track.notes.forEach((note) => {
        synthMaster.triggerAttackRelease(
          note.name,
          note.duration,
          note.time + now,
          note.velocity,
        );
      });
    });

    console.log("✅ Lecture MIDI terminée.");
  } catch (error) {
    console.error("❌ Erreur lors de la lecture du fichier MIDI :", error);
  }
}

function startBackgroundMusic() {
  try {
    // 🧠 Vérifie que le contexte audio est bien démarré
    if (!Tone.context || Tone.context.state !== "running") {
      console.warn(
        "⚠️ Contexte audio Tone.js suspendu. Attendez une interaction utilisateur (Tone.start()).",
      );
      return;
    }

    // 🌀 Si le buffer n’est pas encore prêt, on attend avec un callback onload
    if (!backgroundPlayer.buffer || !backgroundPlayer.buffer.loaded) {
      console.warn(
        "⏳ ambiance_loop.mp3 non encore chargée. Attente en cours...",
      );
      backgroundPlayer.onload = () => {
        console.log("✅ ambiance_loop.mp3 chargé depuis Cloudflare R2");
        if (backgroundPlayer.state !== "started") {
          console.log("🎵 Lecture automatique de l’ambiance...");
          backgroundPlayer.start();
        }
      };
      return;
    }

    // ✅ Si tout est prêt, on lance la lecture
    if (backgroundPlayer.state !== "started") {
      console.log("🎵 Démarrage de la musique d’ambiance...");
      backgroundPlayer.start();
    } else {
      console.log("ℹ️ L’ambiance est déjà en cours.");
    }
  } catch (err) {
    console.error("❌ Erreur dans startBackgroundMusic() :", err);
  }
}

// ⚙️ Modifier les paramètres du compresseur
function setSideChainParams(threshold, attack) {
  sideChainCompressor.threshold.value = threshold;
  sideChainCompressor.attack = attack;
  console.log(
    `🎚️ Side-chain mis à jour : threshold=${threshold}, attack=${attack}`,
  );
}
// 🔔 Jouer un son court hébergé sur Cloudflare R2 (via HTTPS public)
document.addEventListener("click", () => {
  const sfxPlayer = new Tone.Player({
    url: "https://pub-280f3c4082bb477f9ad37b96d10ee653.r2.dev/audio/sfx/clic_01.mp3",
    autostart: true,
    onload: () => console.log("🔔 SFX Cloudflare chargé et joué."),
    onerror: (e) => console.error("❌ Erreur chargement SFX Cloudflare :", e),
  }).connect(masterGain);

  activePlayers.push(sfxPlayer);
});

// 🎚️ Routage audio
synthMaster.connect(sideChainCompressor);
sideChainCompressor.connect(masterGain);

// ✅ Exporter l'interface publique
window.AudioEngine = {
  playMidiFile,
  startBackgroundMusic,
  setSideChainParams,
  stopAll,
  connectToOutput,
};

console.log("✅ AudioEngine chargé avec succès !");
