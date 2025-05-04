const player = document.getElementById("audioPlayer");
const cover = document.getElementById("cover");
const coverArt = document.getElementById("coverArt");
const playBtn = document.getElementById("toggleBtn");
const stopBtn = document.getElementById("stopBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const progress = document.getElementById("progress");
const volume = document.getElementById("volume");
const trackTitle = document.getElementById("trackTitle");

let playlist = [];
let trackIndex = 0;
let playlistReady = false;

// Setup WaveSurfer
const wavesurfer = WaveSurfer.create({
  container: "#waveform",
  waveColor: "#A8DBA8",
  progressColor: "#3B8686",
  backend: "WebAudio",
  cursorWidth: 1,
  barWidth: 2,
  responsive: true,
  hideScrollbar: true,
});

async function loadPlaylist() {
  const res = await fetch("js/playlist.json");
  const data = await res.json();
  playlist = data;
  playlistReady = true;
  trackIndex = Math.floor(Math.random() * playlist.length);
  setTrack(trackIndex, false);
}

function setTrack(index, play = true) {
  const track = playlist[index];
  player.src = track.src;
  trackTitle.textContent = track.title;
  coverArt.src = track.cover;
  wavesurfer.load(track.src);
  if (play) player.play();
}

playBtn.onclick = () => togglePlayback();
function togglePlayback() {
  if (player.paused) {
    player.play();
    playBtn.classList.add("playing");
    cover.classList.add("playing");
  } else {
    player.pause();
    playBtn.classList.remove("playing");
    cover.classList.remove("playing");
  }
}
stopBtn.onclick = () => {
  player.pause();
  player.currentTime = 0;
};
nextBtn.onclick = () => {
  trackIndex = (trackIndex + 1) % playlist.length;
  setTrack(trackIndex);
};
prevBtn.onclick = () => {
  trackIndex = (trackIndex - 1 + playlist.length) % playlist.length;
  setTrack(trackIndex);
};
progress.oninput = (e) => {
  player.currentTime = (e.target.value / 100) * player.duration;
};
volume.oninput = (e) => {
  player.volume = e.target.value / 100;
};

wavesurfer.on("ready", () => {
  wavesurfer.addRegion({
    start: 0,
    end: wavesurfer.getDuration(),
    color: "rgba(0, 0, 0, 0)",
  });
});
wavesurfer.on("region-in", (region) => {
  wavesurfer.play(region.start, region.end);
});
wavesurfer.on("region-out", () => {
  wavesurfer.pause();
});
wavesurfer.on("region-update-end", (region) => {
  const newTime = region.start;
  wavesurfer.seekTo(newTime / wavesurfer.getDuration());
});

document.addEventListener("DOMContentLoaded", loadPlaylist);
