const player = document.getElementById("audioPlayer");
const playBtn = document.getElementById("toggleBtn");
const stopBtn = document.getElementById("stopBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const progress = document.getElementById("progress");
const volume = document.getElementById("volume");
const trackTitle = document.getElementById("trackTitle");
const cover = document.getElementById("cover");
const infoPanel = document.getElementById("infoPanel");

let playlist = [];
let trackIndex = 0;
let playlistReady = false;

// ✅ Fonction pour charger la playlist locale
async function loadPlaylist() {
  try {
    const res = await fetch("js/playlist.json");
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Playlist vide ou mal formée.");
    }

    playlist = data;
    playlistReady = true;

    // Démarrage sur une piste aléatoire
    trackIndex = Math.floor(Math.random() * playlist.length);
    setTrack(trackIndex, false);
  } catch (error) {
    console.error("Erreur de chargement de la playlist :", error);
    trackTitle.textContent = "Erreur de chargement de la playlist.";
  }
}

// ✅ Lecture de la piste
function setTrack(i, play = true) {
  if (!playlistReady || !playlist[i]) {
    console.warn(`Piste ${i} invalide.`);
    return;
  }

  trackIndex = i;
  const track = playlist[i];
  player.src = track.src;
  trackTitle.textContent = track.title;
  cover.querySelector("img").src = track.cover;

  if (play) {
    player
      .play()
      .then(() => {
        playBtn.classList.add("playing");
        cover.classList.add("playing");
        infoPanel.classList.add("open");
      })
      .catch((err) => {
        console.error("Erreur de lecture :", err);
      });
  }
}

// ✅ Boutons
playBtn.onclick = () => {
  if (!playlistReady || !playlist[trackIndex]) return;

  if (player.paused) {
    player
      .play()
      .then(() => {
        playBtn.classList.add("playing");
        cover.classList.add("playing");
        infoPanel.classList.add("open");
      })
      .catch((err) => {
        console.error("Erreur de lecture :", err);
      });
  } else {
    player.pause();
    playBtn.classList.remove("playing");
    cover.classList.remove("playing");
    infoPanel.classList.remove("open");
  }
};

stopBtn.onclick = () => {
  if (!playlistReady) return;
  player.pause();
  player.currentTime = 0;
  playBtn.classList.remove("playing");
  cover.classList.remove("playing");
  infoPanel.classList.remove("open");
};

nextBtn.onclick = () => {
  if (!playlistReady) return;
  trackIndex = (trackIndex + 1) % playlist.length;
  setTrack(trackIndex);
};

prevBtn.onclick = () => {
  if (!playlistReady) return;
  trackIndex = (trackIndex - 1 + playlist.length) % playlist.length;
  setTrack(trackIndex);
};

// ✅ Suivi du temps
player.ontimeupdate = () => {
  if (player.duration) {
    progress.value = (player.currentTime / player.duration) * 100;
    const minutes = Math.floor(player.currentTime / 60);
    const seconds = Math.floor(player.currentTime % 60)
      .toString()
      .padStart(2, "0");
    document.getElementById("timeDisplay").textContent =
      `${minutes}:${seconds}`;
  }
};

// ✅ Saut manuel dans la piste
progress.oninput = (e) => {
  if (player.duration) {
    player.currentTime = (e.target.value / 100) * player.duration;
  }
};

// ✅ Contrôle du volume
volume.oninput = (e) => {
  player.volume = e.target.value / 100;
};

// ✅ Piste suivante automatiquement
player.onended = () => {
  if (!playlistReady) return;
  trackIndex = (trackIndex + 1) % playlist.length;
  setTrack(trackIndex);
};

// ✅ Chargement initial
document.addEventListener("DOMContentLoaded", loadPlaylist);
