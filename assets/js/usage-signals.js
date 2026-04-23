(() => {
  'use strict';

  const STORAGE_KEY = 'site_usage_signals_v1';
  const MAX_ITEMS = 200;

  function readQueue() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function writeQueue(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
    } catch {}
  }

  function push(type, details = {}) {
    const items = readQueue();
    items.push({
      ts: new Date().toISOString(),
      type,
      path: window.location.pathname,
      title: document.title,
      details
    });
    writeQueue(items);
  }

  function trackPage(reason) {
    push('page_view', {
      reason,
      href: window.location.href
    });
  }

  function onClick(event) {
    const el = event.target instanceof Element ? event.target.closest('a,button,[data-track]') : null;
    if (!el) return;

    push('click', {
      id: el.id || '',
      tag: el.tagName.toLowerCase(),
      text: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      href: el.getAttribute('href') || '',
      track: el.getAttribute('data-track') || ''
    });
  }

  function attachAudioSignals() {
    const player = document.getElementById('audioPlayer');
    if (!player || player.dataset.usageSignalsBound === '1') return;

    player.addEventListener('play', () => push('audio_play', { currentTime: Math.round(player.currentTime || 0) }));
    player.addEventListener('pause', () => push('audio_pause', { currentTime: Math.round(player.currentTime || 0) }));
    player.addEventListener('ended', () => push('audio_end', { currentTime: Math.round(player.currentTime || 0) }));
    player.dataset.usageSignalsBound = '1';
  }

  document.addEventListener('click', onClick, { capture: true });
  document.addEventListener('DOMContentLoaded', () => {
    trackPage('domcontentloaded');
    attachAudioSignals();
  });
  document.addEventListener('pjax:ready', () => {
    trackPage('pjax:ready');
    attachAudioSignals();
  });
  window.addEventListener('beforeunload', () => push('page_unload'));

  window.SiteUsageSignals = Object.freeze({
    push,
    pageView: trackPage,
    readQueue,
    clear() {
      writeQueue([]);
    }
  });
})();
