(function (window, document) {
  'use strict';

  function clearAudioCors() {
    var player = document.getElementById('audioPlayer');
    if (!player) return;
    try { player.removeAttribute('crossorigin'); } catch (_) {}
    try { player.removeAttribute('crossOrigin'); } catch (_) {}
    try { if (player.crossOrigin === 'anonymous') player.crossOrigin = null; } catch (_) {}
  }

  function installGuard() {
    var player = document.getElementById('audioPlayer');
    if (!player || player.__audioCorsCompatInstalled) return;
    player.__audioCorsCompatInstalled = true;

    var originalSetAttribute = player.setAttribute.bind(player);
    player.setAttribute = function (name, value) {
      if (String(name).toLowerCase() === 'crossorigin' && String(value).toLowerCase() === 'anonymous') {
        clearAudioCors();
        return;
      }
      return originalSetAttribute(name, value);
    };

    ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'error'].forEach(function (eventName) {
      player.addEventListener(eventName, clearAudioCors, true);
    });
  }

  function boot() {
    installGuard();
    clearAudioCors();
    window.setTimeout(clearAudioCors, 0);
    window.setTimeout(clearAudioCors, 250);
    window.setTimeout(clearAudioCors, 1000);
  }

  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('pjax:ready', boot);
  document.addEventListener('click', boot, true);
  document.addEventListener('pointerdown', boot, true);
  boot();
})(window, document);
