(function () {
  function merge(target, source) {
    for (let key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {};
        merge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  function find(arr, predicate) {
    for (let i = 0; i < arr.length; i++) {
      if (predicate(arr[i])) return arr[i];
    }
    return undefined;
  }

  function map(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  let idCount = 0;
  class Ids {
    next() {
      return ++idCount;
    }
  }

  class Events {
    constructor() {
      this.listeners = {};
    }

    on(event, callback) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(callback);
    }

    off(event, callback) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback,
      );
    }

    fire(event, data) {
      if (!this.listeners[event]) return;
      this.listeners[event].forEach((cb) => cb(data));
    }
  }

  const ids = new Ids();

  window.Granular = class Granular {
    constructor(options = {}) {
      this.events = new Events();

      const initialState = {
        envelope: {
          attack: random(0.1, 0.9),
          release: random(0.1, 0.9),
        },
        density: random(0.1, 0.9),
        spread: random(0.1, 0.9),
        pitch: 1,
      };

      this.state = {
        isBufferSet: false,
        envelope: {
          attack:
            (options.envelope && options.envelope.attack) ||
            initialState.envelope.attack,
          release:
            (options.envelope && options.envelope.release) ||
            initialState.envelope.release,
        },
        density: options.density || initialState.density,
        spread: options.spread || initialState.spread,
        pitch: options.pitch || initialState.pitch,
        voices: [],
      };

      this.context = options.audioContext || new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = 1;
      this.gain.connect(this.context.destination);
    }

    connect(audioNode) {
      this.gain.connect(audioNode);
    }

    disconnect() {
      this.gain.disconnect();
    }

    on(events, listener) {
      this.events.on(events, listener);
    }

    off(events, listener) {
      this.events.off(events, listener);
    }

    set(state) {
      this.state = merge(this.state, state);
    }

    setBuffer(data) {
      this.set({ isBufferSet: false });
      this.events.fire("settingBuffer", { buffer: data });

      if (data instanceof AudioBuffer) {
        this.buffer = data;
        this.set({ isBufferSet: true });
        this.events.fire("bufferSet", { buffer: data });
        return;
      }

      return new Promise((resolve) => {
        this.context.decodeAudioData(data, (buffer) => {
          this.buffer = buffer;
          this.set({ isBufferSet: true });
          this.events.fire("bufferSet", { buffer });
          resolve(buffer);
        });
      });
    }

    getVoice(id) {
      return find(this.state.voices, (voice) => voice.id === id);
    }

    startVoice(options = {}) {
      if (!this.state.isBufferSet) return;

      const self = this;

      class Voice {
        constructor(position, volume) {
          this.position = position;
          this.volume = volume;
          this.grains = [];
          this.grainsCount = 0;
          this.timeout = null;
        }

        update(options = {}) {
          if (options.position) this.position = options.position;
          if (options.volume) this.volume = options.volume;
        }

        play() {
          const _innerPlay = () => {
            const grain = self.createGrain(this.position, this.volume);
            this.grains[this.grainsCount] = grain;
            this.grainsCount = (this.grainsCount + 1) % 20;
            const density = map(self.state.density, 1, 0, 0, 1);
            const interval = density * 500 + 70;
            this.timeout = setTimeout(_innerPlay, interval);
          };
          _innerPlay();
        }

        stop() {
          clearTimeout(this.timeout);
        }
      }

      let { position = 0, volume = 1, id = ids.next() } = options;

      const voice = new Voice(position, volume);
      voice.play();

      this.state.voices.push({ voice, position, volume, id });

      return id;
    }

    updateVoice(id, options) {
      this.state.voices.forEach((v) => {
        if (v.id === id) v.voice.update(options);
      });
    }

    stopVoice(id) {
      this.state.voices.forEach((v) => {
        if (v.id === id) v.voice.stop();
      });
      this.state.voices = this.state.voices.filter((v) => v.id !== id);
    }

    createGrain(position, volume) {
      const now = this.context.currentTime;
      const source = this.context.createBufferSource();
      source.playbackRate.value *= this.state.pitch;
      source.buffer = this.buffer;

      const gain = this.context.createGain();
      source.connect(gain);
      gain.connect(this.gain);

      const offset = map(position, 0, 1, 0, this.buffer.duration);
      volume = clamp(volume, 0, 1);

      const attack = this.state.envelope.attack * 0.4;
      let release = this.state.envelope.release * 1.5;
      if (release < 0) release = 0.1;

      const randomoffset =
        Math.random() * this.state.spread - this.state.spread / 2;

      source.start(now, Math.max(0, offset + randomoffset), attack + release);
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.linearRampToValueAtTime(0, now + attack + release);

      source.stop(now + attack + release + 0.1);
      setTimeout(() => gain.disconnect(), (attack + release) * 1000 + 200);

      this.events.fire("grainCreated", {
        position,
        volume,
        pitch: this.state.pitch,
      });
    }
  };
})();
