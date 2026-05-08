"use strict";

/*
  GaplessMusicController
  ----------------------
  A reusable music controller for browser games.

  Design goals:
  - Prefer Web Audio because it can schedule loop handoffs precisely.
  - Keep HTMLAudioElement playback as a fallback for browsers or file contexts
    that block fetch/decodeAudioData.
  - Support intro + loop pairs for each music mode.
  - Preserve the current musical position when switching modes.
  - Fade output smoothly for tab visibility changes or mode changes.
*/
class GaplessMusicController {
  constructor(options) {
    this.modes = options.modes;
    this.initialMode = options.initialMode || Object.keys(options.modes)[0];
    this.fadeSeconds = options.fadeSeconds ?? 0.22;
    this.startDelaySeconds = options.startDelaySeconds ?? 0.02;
    this.outputScale = 1;
    this.mode = this.initialMode;
    this.section = "intro";
    this.sectionStartTime = 0;
    this.started = false;
    this.usingWebAudio = false;
    this.context = null;
    this.master = null;
    this.buffers = {};
    this.bufferLoadPromise = null;
    this.activeSources = [];
    this.htmlFadeFrame = null;
    this.transitionId = 0;
    this.AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.html = this.createHtmlTracks();
  }

  createHtmlTracks() {
    const tracks = {};

    Object.keys(this.modes).forEach((modeName) => {
      tracks[modeName] = {};

      ["intro", "loop"].forEach((sectionName) => {
        const source = this.chooseSource(this.modes[modeName][sectionName]);
        const audio = new Audio(source.url);

        audio.preload = "auto";
        audio.loop = sectionName === "loop";
        audio.volume = this.volumeFor(modeName) * this.outputScale;
        audio.load();
        tracks[modeName][sectionName] = audio;
      });

      tracks[modeName].intro.addEventListener("ended", () => {
        if (this.usingWebAudio || this.mode !== modeName) return;
        this.playHtml(modeName, "loop", 0);
      });
    });

    return tracks;
  }

  chooseSource(sectionSources) {
    const sources = Array.isArray(sectionSources) ? sectionSources : [sectionSources];
    const tester = document.createElement("audio");
    const supported = sources.find((source) => {
      if (typeof source === "string") return true;
      if (!source.type) return true;
      return tester.canPlayType(source.type) !== "";
    });
    const source = supported || sources[0];

    return typeof source === "string" ? { url: source } : source;
  }

  volumeFor(modeName) {
    return this.modes[modeName]?.volume ?? 1;
  }

  ensureContext() {
    if (!this.AudioContextClass) return null;

    if (!this.context) {
      this.context = new this.AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.volumeFor(this.mode) * this.outputScale;
      this.master.connect(this.context.destination);
    }

    return this.context;
  }

  loadBuffers() {
    const context = this.ensureContext();
    if (!context) return Promise.resolve(null);

    if (!this.bufferLoadPromise) {
      const jobs = [];

      Object.keys(this.modes).forEach((modeName) => {
        ["intro", "loop"].forEach((sectionName) => {
          const source = this.chooseSource(this.modes[modeName][sectionName]);

          jobs.push(
            fetch(source.url)
              .then((response) => response.arrayBuffer())
              .then((data) => context.decodeAudioData(data))
              .then((buffer) => [modeName, sectionName, buffer])
          );
        });
      });

      this.bufferLoadPromise = Promise.all(jobs)
        .then((entries) => {
          entries.forEach(([modeName, sectionName, buffer]) => {
            this.buffers[modeName] ||= {};
            this.buffers[modeName][sectionName] = buffer;
          });
          return this.buffers;
        })
        .catch(() => null);
    }

    return this.bufferLoadPromise;
  }

  currentPosition() {
    if (!this.started) return { section: "intro", offset: 0 };

    if (!this.usingWebAudio || !this.context) {
      const intro = this.html[this.mode].intro;
      const loop = this.html[this.mode].loop;

      if (intro.paused && !loop.paused) {
        return { section: "loop", offset: loop.currentTime || 0 };
      }

      return { section: "intro", offset: intro.currentTime || 0 };
    }

    const elapsed = Math.max(0, this.context.currentTime - this.sectionStartTime);
    const buffer = this.buffers[this.mode]?.[this.section];

    if (this.section === "loop" && buffer?.duration) {
      return { section: "loop", offset: elapsed % buffer.duration };
    }

    return { section: "intro", offset: Math.min(elapsed, buffer?.duration || elapsed) };
  }

  stopSource(item, when = this.context?.currentTime || 0) {
    try {
      item?.source.stop(when);
    } catch {
      // A source may already be stopped; stopping twice is harmless here.
    }
  }

  stopActiveSources(when = this.context?.currentTime || 0) {
    this.activeSources.forEach((item) => this.stopSource(item, when));
    this.activeSources.length = 0;
  }

  makeSource(modeName, sectionName, offset, when, gainValue) {
    const buffer = this.buffers[modeName][sectionName];
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const safeOffset = Math.min(offset, Math.max(0, buffer.duration - 0.01));
    const item = { source, gain, modeName, sectionName };

    source.buffer = buffer;
    source.loop = sectionName === "loop";
    gain.gain.setValueAtTime(gainValue, when);
    source.connect(gain);
    gain.connect(this.master);
    source.start(when, safeOffset);
    source.addEventListener("ended", () => {
      const index = this.activeSources.indexOf(item);
      if (index >= 0) this.activeSources.splice(index, 1);
    });
    this.activeSources.push(item);

    return item;
  }

  scheduleWebAudio(modeName, sectionName, offset, crossfade) {
    const now = this.context.currentTime;
    const fade = crossfade ? this.fadeSeconds : 0.01;
    const when = now + this.startDelaySeconds;

    this.activeSources.forEach((item) => {
      item.gain.gain.cancelScheduledValues(now);
      item.gain.gain.setValueAtTime(item.gain.gain.value, now);
      item.gain.gain.linearRampToValueAtTime(0, now + fade);
      this.stopSource(item, now + fade + 0.04);
    });
    this.activeSources.length = 0;

    this.setMasterVolume(modeName, this.outputScale);
    const first = this.makeSource(modeName, sectionName, offset, when, crossfade ? 0 : 1);

    first.gain.gain.linearRampToValueAtTime(1, now + fade);
    this.mode = modeName;
    this.section = sectionName;
    this.sectionStartTime = when - offset;

    if (sectionName === "intro") {
      const introBuffer = this.buffers[modeName].intro;
      const remaining = Math.max(0.01, introBuffer.duration - offset);
      const loopWhen = when + remaining;

      this.makeSource(modeName, "loop", 0, loopWhen, 1);
      first.source.addEventListener("ended", () => {
        if (this.mode === modeName) {
          this.section = "loop";
          this.sectionStartTime = loopWhen;
        }
      });
    }
  }

  pauseHtmlTracks() {
    Object.values(this.html).forEach((modeTracks) => {
      modeTracks.intro.pause();
      modeTracks.loop.pause();
    });
  }

  playHtml(modeName, sectionName, offset) {
    this.usingWebAudio = false;
    this.stopActiveSources();
    this.pauseHtmlTracks();

    const track = this.html[modeName][sectionName];
    const duration = track.duration || 0;
    const safeOffset = sectionName === "loop" && duration > 0
      ? offset % duration
      : Math.min(offset, duration || offset);

    track.volume = this.volumeFor(modeName) * this.outputScale;
    track.currentTime = Math.max(0, safeOffset);
    this.mode = modeName;
    this.section = sectionName;

    const playback = track.play();
    playback?.catch(() => {});
    return playback;
  }

  async switchTo(modeName, options = {}) {
    const transitionId = ++this.transitionId;
    const position = options.restart
      ? { section: "intro", offset: 0 }
      : this.currentPosition();
    const sectionName = position.section;
    const targetHtml = this.html[modeName][sectionName];
    const offset = targetHtml.duration
      ? position.offset % targetHtml.duration
      : position.offset;

    try {
      const context = this.ensureContext();

      if (context) {
        await context.resume();
        const loaded = await this.loadBuffers();

        if (loaded?.[modeName]?.intro && loaded?.[modeName]?.loop) {
          if (transitionId !== this.transitionId) return true;
          this.usingWebAudio = true;
          this.pauseHtmlTracks();
          this.scheduleWebAudio(modeName, sectionName, offset, this.started);
          return true;
        }
      }
    } catch {
      // Fall through to HTML audio.
    }

    try {
      if (transitionId !== this.transitionId) return true;
      await this.playHtml(modeName, sectionName, offset);
      return true;
    } catch {
      return false;
    }
  }

  async start(modeName = this.initialMode) {
    if (this.started) return true;

    this.started = true;
    const ok = await this.switchTo(modeName, { restart: true });

    if (!ok) this.started = false;
    return ok;
  }

  async switchMode(modeName) {
    if (!this.started || this.mode === modeName) return false;
    return this.switchTo(modeName);
  }

  setMasterVolume(modeName, scale) {
    if (!this.master || !this.context) return;

    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.volumeFor(modeName) * scale, now);
  }

  setHtmlVolumeScale(scale) {
    Object.keys(this.html).forEach((modeName) => {
      this.html[modeName].intro.volume = this.volumeFor(modeName) * scale;
      this.html[modeName].loop.volume = this.volumeFor(modeName) * scale;
    });
  }

  fadeTo(scale, durationMs = 2000) {
    const startScale = this.outputScale;

    this.outputScale = scale;

    if (this.usingWebAudio && this.context && this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.volumeFor(this.mode) * startScale, now);
      this.master.gain.linearRampToValueAtTime(this.volumeFor(this.mode) * scale, now + durationMs / 1000);
    }

    window.cancelAnimationFrame(this.htmlFadeFrame);

    const startTime = performance.now();
    const tick = (now) => {
      const progress = durationMs > 0 ? Math.min(1, (now - startTime) / durationMs) : 1;
      const nextScale = startScale + (scale - startScale) * progress;

      this.setHtmlVolumeScale(nextScale);

      if (progress < 1) {
        this.htmlFadeFrame = window.requestAnimationFrame(tick);
      }
    };

    this.htmlFadeFrame = window.requestAnimationFrame(tick);
  }

  resumeContext() {
    if (this.context?.state === "suspended") {
      this.context.resume().catch(() => {});
    }
  }
}

window.GaplessMusicController = GaplessMusicController;
