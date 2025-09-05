

(() => {
  'use strict';

  // ====== Audio (fusion des anciens audioFunctions.js) ======
  let audioCtx = null;
  let reverbBuffer = null;
  let hoverGainNode = null;

  function initAudio() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        generateReverbBuffer();
        createHoverGainBus();
      } else if (audioCtx.state === 'suspended') {
        audioCtx.resume?.();
      }
    } catch (e) {
      console.warn('AudioContext non supporté ou bloqué :', e);
    }
  }

  function generateReverbBuffer() {
    if (!audioCtx) return;
    const duration = 2 + Math.random() * 3;
    reverbBuffer = audioCtx.createBuffer(2, duration * audioCtx.sampleRate, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = reverbBuffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
      }
    }
  }

  function randomFreq(min, max) { return min + Math.random() * (max - min); }

  function createPanner3D() {
    const panner = audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    if (typeof panner.positionX !== 'undefined') {
      panner.positionX.value = randomFreq(-1, 1);
      panner.positionY.value = randomFreq(-0.3, 0.3);
      panner.positionZ.value = randomFreq(-0.5, 0.5);
    } else {
      panner.setPosition(randomFreq(-1, 1), randomFreq(-0.3, 0.3), randomFreq(-0.5, 0.5));
    }
    return panner;
  }

  function createReverbChain(gainValue = 0.8) {
    const convolver = audioCtx.createConvolver();
    convolver.buffer = reverbBuffer;
    const reverbGain = audioCtx.createGain();
    reverbGain.gain.value = gainValue;
    convolver.connect(reverbGain);
    return { convolver, reverbGain };
  }

  function createHoverGainBus() {
    hoverGainNode = audioCtx.createGain();
    hoverGainNode.gain.value = 1.0;
    hoverGainNode.connect(audioCtx.destination);
  }

  function triggerSidechain() {
    if (!hoverGainNode) return;
    const now = audioCtx.currentTime;
    hoverGainNode.gain.cancelScheduledValues(now);
    hoverGainNode.gain.setValueAtTime(hoverGainNode.gain.value, now);
    hoverGainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
    hoverGainNode.gain.linearRampToValueAtTime(1.0, now + 0.25);
  }

  function playBufferSound(buffer, attack, release, volume = 0.08) {
    if (!audioCtx) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);

    const { convolver, reverbGain } = createReverbChain(0.9);
    const panner = createPanner3D();

    source.connect(gain).connect(convolver).connect(reverbGain).connect(panner).connect(audioCtx.destination);
    source.start();
    triggerSidechain();
  }

  function generateNoise(length) {
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function playOpenSound() {
    initAudio();
    playBufferSound(generateNoise(audioCtx.sampleRate * 1.5), 0.15, 1.4, 0.025);
  }
  function playCloseSound() {
    initAudio();
    playBufferSound(generateNoise(audioCtx.sampleRate * 0.8), 0.1, 0.9, 0.02);
  }
  function playTypingClick() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    osc.type = 'triangle';
    osc.frequency.value = randomFreq(9000, 12000);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.015, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    const panner = createPanner3D();
    osc.connect(gain).connect(panner).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
    triggerSidechain();
  }
  function playHoverSound() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.value = randomFreq(10000, 18000);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(8500, now);
    filter.Q.value = 1;
    const { convolver, reverbGain } = createReverbChain(0.6);
    const panner = createPanner3D();
    osc.connect(filter).connect(gain).connect(convolver).connect(reverbGain).connect(panner).connect(hoverGainNode);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // ====== Typewriter (fusion de animationHelpers.js) ======
  function typeWriter(element, text, onComplete = () => {}, speedFactor = 1) {
    element.innerHTML = '';
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(`<span>${text}</span>`, 'text/html');
    const nodes = Array.from(htmlDoc.body.firstChild.childNodes);
    let i = 0;

    function write() {
      if (i < nodes.length) {
        const node = nodes[i++];
        if (node.nodeType === Node.TEXT_NODE) {
          const span = document.createElement('span');
          span.textContent = node.textContent;
          element.appendChild(span);
          playTypingClick();
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'STRONG') {
          const strong = document.createElement('strong');
          strong.classList.add('mgc-highlight-pop');
          strong.textContent = node.textContent;
          element.appendChild(strong);
          playTypingClick();
          requestAnimationFrame(() => strong.classList.add('mgc-active'));
        }
        setTimeout(() => requestAnimationFrame(write), 8 * speedFactor);
      } else {
        onComplete();
      }
    }
    requestAnimationFrame(write);
  }

  // ====== Init / Teardown (remplace main.js, compatible PJAX) ======
  const BOUND = new WeakSet();
  const HANDLERS = new WeakMap();
  const stateMap = new WeakMap();
  const originalTexts = new WeakMap();

  function bindCard(card, cards, index) {
    if (BOUND.has(card)) return;
    const textEl = card.querySelector('.mgc-magic-text');
    const closeBtn = card.querySelector('.mgc-close-btn');
    if (!textEl || !closeBtn) return;

    originalTexts.set(card, textEl.innerHTML);
    stateMap.set(card, false);

    const onClick = () => {
      const isOpen = stateMap.get(card);
      if (!isOpen) {
        card.classList.add('mgc-expanded', 'mgc-scintillate');
        playOpenSound();
        textEl.innerHTML = '';

        // petit effet sur la carte voisine
        const isPair = index % 2 === 0;
        const neighbor = isPair ? cards[index + 1] : cards[index - 1];
        if (neighbor) {
          neighbor.classList.add('mgc-opening-sibling');
          setTimeout(() => neighbor.classList.remove('mgc-opening-sibling'), 700);
        }

        typeWriter(textEl, originalTexts.get(card), () => {
          card.classList.add('mgc-show-close');
        }, 1.25);

        setTimeout(() => card.classList.remove('mgc-scintillate'), 700);
        stateMap.set(card, true);
      }
    };

    const onClose = (e) => {
      e.stopPropagation();
      const isOpen = stateMap.get(card);
      if (isOpen) {
        playCloseSound();
        card.classList.remove('mgc-expanded', 'mgc-show-close');
        textEl.innerHTML = originalTexts.get(card);
        stateMap.set(card, false);
      }
    };

    const onEnter = () => playHoverSound();
    const onOver  = () => playTypingClick();

    card.addEventListener('click', onClick);
    closeBtn.addEventListener('click', onClose);
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseover', onOver);

    HANDLERS.set(card, { onClick, onClose, onEnter, onOver });
    BOUND.add(card);
  }

  function initMagicCards(container) {
    initAudio();
    const root = (container instanceof Element) ? container : document;
    const grid = root.querySelector('.mgc-magic-grid') || document.querySelector('.mgc-magic-grid');
    if (!grid) {
      console.warn('[magic-cards] .mgc-magic-grid introuvable.');
      return;
    }
    const cards = Array.from(grid.querySelectorAll('.mgc-card'));
    cards.forEach((card, i) => bindCard(card, cards, i));
  }

  function teardownMagicCards(container) {
    const root = (container instanceof Element) ? container : document;
    const cards = root.querySelectorAll('.mgc-card');
    cards.forEach((card) => {
      const h = HANDLERS.get(card);
      if (h) {
        card.removeEventListener('click', h.onClick);
        card.removeEventListener('mouseenter', h.onEnter);
        card.removeEventListener('mouseover', h.onOver);
        const closeBtn = card.querySelector('.mgc-close-btn');
        closeBtn && closeBtn.removeEventListener('click', h.onClose);
        HANDLERS.delete(card);
      }
      // reset visuel + texte
      card.classList.remove('mgc-expanded','mgc-scintillate','mgc-show-close','mgc-opening-sibling');
      const textEl = card.querySelector('.mgc-magic-text');
      if (textEl && originalTexts.has(card)) textEl.innerHTML = originalTexts.get(card);
      stateMap.delete(card);
      originalTexts.delete(card);
      BOUND.delete(card);
    });
    try { audioCtx?.suspend?.(); } catch {}
  }

  // Expose global (UMD light)
  window.initMagicCards = initMagicCards;
  window.teardownMagicCards = teardownMagicCards;
})();

