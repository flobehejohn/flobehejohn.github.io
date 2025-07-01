document.addEventListener("DOMContentLoaded", function() {
  // Audio player toggle
  const openAudioPlayerBtn = document.getElementById("openAudioPlayer");
  if (openAudioPlayerBtn) {
    openAudioPlayerBtn.addEventListener("click", function (e) {
      const audioPlayerModal = document.getElementById("audioPlayerModal");
      if (audioPlayerModal) {
        audioPlayerModal.style.display = "block";
        audioPlayerModal.classList.add("active");
        e.stopPropagation();
      }
    });
  }

  // Pour fermer la modale audio
  const closePlayerModal = document.getElementById("closePlayerModal");
  if (closePlayerModal) {
    closePlayerModal.addEventListener("click", function () {
      const audioPlayerModal = document.getElementById("audioPlayerModal");
      if (audioPlayerModal) {
        audioPlayerModal.style.display = "none";
        audioPlayerModal.classList.remove("active");
      }
    });
  }
});
