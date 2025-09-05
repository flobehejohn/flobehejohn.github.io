// ✅ Correction finale de assets/js/player.js pour continuer lecture même modale fermée

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("audioPlayerModal");
  const openBtn = document.getElementById("openAudioPlayer");
  const closeBtn = document.getElementById("closePlayerModal");

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

  async function loadPlaylist() {
    try {
      const res = await fetch("assets/js/playlist.json");
      playlist = await res.json();
      trackIndex = Math.floor(Math.random() * playlist.length);
      setTrack(trackIndex, false);
    } catch (error) {
      console.error("Playlist introuvable :", error);
    }
  }

  function setTrack(i, play = true) {
    trackIndex = i % playlist.length;
    player.src = playlist[trackIndex].src;
    trackTitle.textContent = playlist[trackIndex].title;
    cover.querySelector("img").src = playlist[trackIndex].cover;
    if (play) player.play();
    playBtn.classList.toggle("playing", play);
    cover.classList.toggle("playing", play);
    infoPanel.classList.toggle("open", play);
  }

  // ✅ Gestion Play/Pause cohérente avec icônes vectorielles
  playBtn.onclick = () => {
    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  };

  player.onplay = () => {
    playBtn.classList.add("playing");
    cover.classList.add("playing");
    infoPanel.classList.add("open");
  };

  player.onpause = () => {
    playBtn.classList.remove("playing");
    cover.classList.remove("playing");
    infoPanel.classList.remove("open");
  };

  stopBtn.onclick = () => {
    player.pause();
    player.currentTime = 0;
    playBtn.classList.remove("playing");
    cover.classList.remove("playing");
    infoPanel.classList.remove("open");
  };

  nextBtn.onclick = () => setTrack(trackIndex + 1);
  prevBtn.onclick = () => setTrack(trackIndex - 1 + playlist.length);

  player.ontimeupdate = () => {
    progress.value = (player.currentTime / player.duration) * 100 || 0;
    document.getElementById("timeDisplay").textContent =
      `${Math.floor(player.currentTime / 60)}:${Math.floor(
        player.currentTime % 60,
      )
        .toString()
        .padStart(2, "0")}`;
  };

  progress.oninput = (e) =>
    (player.currentTime = (e.target.value / 100) * player.duration);
  volume.oninput = (e) => (player.volume = e.target.value / 100);
  player.onended = nextBtn.onclick;

  openBtn.onclick = () => (modal.style.display = "flex");
  closeBtn.onclick = () => {
    modal.style.display = "none";
    // player.pause(); //✅ supprimé : évite l'arrêt automatique de l'audio à la fermeture
  };

  loadPlaylist();
});
