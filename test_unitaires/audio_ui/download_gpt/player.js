const player = document.getElementById("audioPlayer");
const playBtn = document.querySelector(".toggle");
const stopBtn = document.querySelector(".stop");
const progress = document.querySelector(".progress");
const timeDisplay = document.querySelector(".time");
const volume = document.querySelector(".volume");
const nextBtn = document.querySelector(".next");
const prevBtn = document.querySelector(".prev");
const mainCover = document.querySelector("#main_cover");

let playlist = [
  "https://cdn.freesound.org/previews/250/250629_4486188-lq.mp3",
  "https://cdn.freesound.org/previews/321/321215_5260874-lq.mp3",
];
let trackIndex = 0;

function updateProgress() {
  progress.value = player.currentTime;
  const minutes = Math.floor(player.currentTime / 60);
  const seconds = Math.floor(player.currentTime % 60)
    .toString()
    .padStart(2, "0");
  timeDisplay.textContent = `${minutes}:${seconds}`;
}

function setTrack(index) {
  player.src = playlist[index];
  player.load();
  console.log(`🎵 Changement de piste : ${player.src}`);
}

function playPause() {
  if (player.paused) {
    player.play();
    playBtn.textContent = "⏸️";
    mainCover.classList.remove("inactive");
    mainCover.classList.add("active");
    console.log("▶️ Lecture lancée");
  } else {
    player.pause();
    playBtn.textContent = "▶️";
    mainCover.classList.remove("active");
    mainCover.classList.add("inactive");
    console.log("⏸️ Pause");
  }
}

function stop() {
  player.pause();
  player.currentTime = 0;
  playBtn.textContent = "▶️";
  mainCover.classList.remove("active");
  mainCover.classList.add("inactive");
  console.log("⏹️ Stop");
}

function nextTrack() {
  trackIndex = (trackIndex + 1) % playlist.length;
  setTrack(trackIndex);
  player.play();
  playBtn.textContent = "⏸️";
}

function prevTrack() {
  trackIndex = (trackIndex - 1 + playlist.length) % playlist.length;
  setTrack(trackIndex);
  player.play();
  playBtn.textContent = "⏸️";
}

player.addEventListener("timeupdate", updateProgress);
player.addEventListener("loadedmetadata", () => {
  progress.max = player.duration;
});

playBtn.addEventListener("click", playPause);
stopBtn.addEventListener("click", stop);
nextBtn.addEventListener("click", nextTrack);
prevBtn.addEventListener("click", prevTrack);

progress.addEventListener("input", (e) => {
  player.currentTime = e.target.value;
});

volume.addEventListener("input", (e) => {
  player.volume = e.target.value / 100;
  console.log(`🔊 Volume : ${Math.round(player.volume * 100)}%`);
});

imagesLoaded(document.querySelectorAll(".p_img"), () => {
  document.querySelector("#cover").classList.add("loaded");
  document.querySelector("#loading").classList.add("loaded");
});

setTrack(trackIndex);
