import { getTrackEmbedConfig } from "../musicEmbeds";
import { getDefaultSchoolId, getSchoolAudioConfig } from "./schoolAudio.config";

const SETTINGS_STORAGE_KEY = "scholomance.ambient.settings.v1";

const DEFAULT_SETTINGS = Object.freeze({
  schoolId: null,
  volume: 0.5,
  autoplayAmbient: false,
  cyclingEnabled: true,
  orbVisible: true,
});

const DEFAULT_OPTIONS = Object.freeze({
  tuningDurationMs: null,
  tuningDurationMinMs: 1500,
  tuningDurationMaxMs: 3000,
  fadeOutMs: 350,
  fadeInMs: 700,
  dialLockMs: 300,
  signalPollMs: 90,
});

export const AMBIENT_PLAYER_STATES = Object.freeze({
  IDLE: "IDLE",
  PLAYING: "PLAYING",
  TUNING: "TUNING",
  PAUSED: "PAUSED",
  ERROR: "ERROR",
});

export const AMBIENT_PLAYER_EVENTS = Object.freeze({
  SELECT_SCHOOL: "SELECT_SCHOOL",
  TUNE_COMPLETE: "TUNE_COMPLETE",
  PLAY: "PLAY",
  PAUSE: "PAUSE",
  TRACK_ENDED: "TRACK_ENDED",
  ERROR: "ERROR",
});

function canUseBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function toPositiveMs(value, fallbackMs) {
  if (!Number.isFinite(value)) return fallbackMs;
  return Math.max(1, Math.round(value));
}

function clampMsWithinRange(value, minMs, maxMs) {
  return Math.max(minMs, Math.min(maxMs, Math.round(value)));
}

function safeJsonParse(value, fallbackValue) {
  try {
    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
}

function getStorage(optionsStorage) {
  if (optionsStorage) return optionsStorage;
  if (!canUseBrowser()) return null;
  return window.localStorage || null;
}

function readPersistedSettings(storage) {
  if (!storage) return { ...DEFAULT_SETTINGS };
  const raw = storage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  const parsed = safeJsonParse(raw, {});
  return {
    schoolId: typeof parsed.schoolId === "string" ? parsed.schoolId : DEFAULT_SETTINGS.schoolId,
    volume: clamp01(parsed.volume ?? DEFAULT_SETTINGS.volume),
    autoplayAmbient: Boolean(parsed.autoplayAmbient),
    cyclingEnabled: parsed.cyclingEnabled ?? DEFAULT_SETTINGS.cyclingEnabled,
    orbVisible: parsed.orbVisible ?? DEFAULT_SETTINGS.orbVisible,
  };
}

function createAudioContext() {
  if (!canUseBrowser()) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}

function createWhiteNoiseBuffer(audioContext, durationSec) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * durationSec));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function createCrackleCurve(steps = 256) {
  const curve = new Float32Array(steps);
  for (let index = 0; index < steps; index += 1) {
    const baseNoise = Math.pow(Math.random(), 1.9) * 0.2;
    const hasBurst = Math.random() > 0.84;
    const burst = hasBurst ? 0.32 + Math.random() * 0.5 : 0;
    curve[index] = Math.min(1, baseNoise + burst);
  }
  curve[0] = 0;
  curve[steps - 1] = 0;
  return curve;
}

function defaultDialSfxPlayer(contextRef, settings = {}) {
  const { lockUntilRef, lockMs = DEFAULT_OPTIONS.dialLockMs, nowFn = Date.now } = settings;
  const now = nowFn();
  if (lockUntilRef.current > now) {
    return false;
  }
  lockUntilRef.current = now + lockMs;

  const audioContext = contextRef.current;
  if (!audioContext) {
    return false;
  }

  const requestedDurationMs = toPositiveMs(settings.durationMs, DEFAULT_OPTIONS.tuningDurationMinMs);
  const durationMs = clampMsWithinRange(requestedDurationMs, 450, 6000);
  const durationSec = durationMs / 1000;
  const startAt = audioContext.currentTime + 0.01;
  const stopAt = startAt + durationSec;
  const source = audioContext.createBufferSource();
  source.buffer = createWhiteNoiseBuffer(audioContext, durationSec + 0.12);

  const highPass = audioContext.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(220, startAt);
  highPass.frequency.exponentialRampToValueAtTime(110, stopAt);
  highPass.Q.setValueAtTime(0.55, startAt);

  const bandPass = audioContext.createBiquadFilter();
  bandPass.type = "bandpass";
  bandPass.frequency.setValueAtTime(2900, startAt);
  bandPass.frequency.exponentialRampToValueAtTime(620, startAt + durationSec * 0.72);
  bandPass.frequency.linearRampToValueAtTime(940, stopAt);
  bandPass.Q.setValueAtTime(1.1, startAt);
  bandPass.Q.linearRampToValueAtTime(0.72, stopAt);

  const crackleGain = audioContext.createGain();
  crackleGain.gain.setValueAtTime(0.0001, startAt);
  crackleGain.gain.setValueCurveAtTime(createCrackleCurve(320), startAt, durationSec);

  const gain = audioContext.createGain();
  const attackEnd = startAt + Math.min(0.2, durationSec * 0.16);
  const bodyEnd = startAt + durationSec * 0.72;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(0.24, attackEnd);
  gain.gain.exponentialRampToValueAtTime(0.09, bodyEnd);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  source.connect(highPass);
  highPass.connect(bandPass);
  bandPass.connect(crackleGain);
  crackleGain.connect(gain);
  gain.connect(audioContext.destination);
  source.start(startAt);
  source.stop(stopAt);

  source.onended = () => {
    source.disconnect();
    highPass.disconnect();
    bandPass.disconnect();
    crackleGain.disconnect();
    gain.disconnect();
  };
  return true;
}

async function createTrackController({
  container,
  trackUrl,
  volume,
  autoPlay,
  onTrackEnded,
  audioContext = null,
}) {
  const embed = getTrackEmbedConfig(trackUrl, { autoPlay });
  if (!embed?.src) {
    throw new Error("Unsupported track URL");
  }

  if ((embed.provider === "suno" || embed.provider === "direct") && embed.audioUrl) {
    const audio = document.createElement("audio");
    audio.src = embed.audioUrl;
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.loop = true;
    audio.style.cssText = "width:0;height:0;opacity:0;pointer-events:none;position:absolute;";
    audio.setAttribute("aria-hidden", "true");
    container.appendChild(audio);

    audio.addEventListener("error", (e) => {
      console.error("Suno audio playback error:", e.target.error);
    });

    let analyser = null;
    let analyserData = null;
    let mediaSource = null;
    let outputGain = null;

    if (audioContext && typeof audioContext.createMediaElementSource === "function") {
      try {
        mediaSource = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        analyserData = new Uint8Array(analyser.fftSize);
        outputGain = audioContext.createGain();
        outputGain.gain.value = clamp01(volume);
        mediaSource.connect(analyser);
        analyser.connect(outputGain);
        outputGain.connect(audioContext.destination);
      } catch {
        analyser = null;
        analyserData = null;
        try {
          mediaSource?.disconnect();
          outputGain?.disconnect();
        } catch {
          // Ignore cleanup failures.
        }
      }
    }

    if (typeof onTrackEnded === "function") {
      audio.addEventListener("ended", onTrackEnded);
    }

    const loadPromise = new Promise((resolve) => {
      const handleCanPlay = () => {
        audio.removeEventListener("canplaythrough", handleCanPlay);
        resolve();
      };
      audio.addEventListener("canplaythrough", handleCanPlay);
      setTimeout(resolve, 5000);
    });

    let sunoVolume = clamp01(volume);
    if (!outputGain) {
      audio.volume = sunoVolume;
    } else {
      audio.volume = 1;
    }

    return {
      provider: embed.provider,
      schoolId: null,
      loadPromise,
      getVolume: () => sunoVolume,
      setVolume: (value) => {
        sunoVolume = clamp01(value);
        if (outputGain) {
          outputGain.gain.value = sunoVolume;
        } else {
          audio.volume = sunoVolume;
        }
      },
      getSignalLevel: () => {
        if (analyser && analyserData) {
          analyser.getByteTimeDomainData(analyserData);
          let squareSum = 0;
          for (let index = 0; index < analyserData.length; index += 1) {
            const normalized = (analyserData[index] - 128) / 128;
            squareSum += normalized * normalized;
          }
          const rms = Math.sqrt(squareSum / analyserData.length);
          return clamp01((rms - 0.012) / 0.12);
        }
        const t = audio.currentTime || 0;
        const pseudoBeat = Math.abs(Math.sin(t * 2.5)) * 0.5;
        const sparkle = Math.random() * 0.2;
        return clamp01(0.2 + pseudoBeat + sparkle);
      },
      play: async () => {
        await loadPromise;
        if (audioContext && audioContext.state === "suspended") {
          try {
            await audioContext.resume();
          } catch {
            // Context resume failed.
          }
        }
        try {
          await audio.play();
        } catch {
          // Ignore autoplay/user gesture restrictions.
        }
      },
      pause: async () => {
        audio.pause();
      },
      destroy: () => {
        audio.pause();
        try {
          mediaSource?.disconnect();
          analyser?.disconnect();
          outputGain?.disconnect();
        } catch {
          // Ignore analyser graph teardown failures.
        }
        audio.removeAttribute("src");
        audio.load();
        audio.remove();
      },
    };
  }

  const iframe = document.createElement("iframe");
  iframe.src = embed.src;
  iframe.allow = "autoplay";
  iframe.style.cssText = "width:0;height:0;border:0;";
  iframe.title = "Ambient player";
  container.appendChild(iframe);
  let iframeVolume = volume;
  return {
    provider: embed.provider,
    schoolId: null,
    getVolume: () => iframeVolume,
    setVolume: (value) => {
      iframeVolume = clamp01(value);
    },
    getSignalLevel: () => null,
    play: async () => {},
    pause: async () => {},
    destroy: () => iframe.remove(),
  };
}

export class AmbientPlayerService {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.storage = getStorage(options.storage);
    const persisted = readPersistedSettings(this.storage);
    const schoolConfig = getSchoolAudioConfig(persisted.schoolId);

    this.state = {
      status: AMBIENT_PLAYER_STATES.IDLE,
      schoolId: schoolConfig ? persisted.schoolId : null,
      queuedSchoolId: null,
      paletteKey: schoolConfig?.paletteKey || null,
      orbSkinKey: schoolConfig?.orbSkinKey || null,
      trackUrl: schoolConfig?.trackUrl || null,
      isPlaying: false,
      isLoading: false,
      signalLevel: 0,
      volume: persisted.volume,
      autoplayAmbient: Boolean(persisted.autoplayAmbient),
      cyclingEnabled: Boolean(persisted.cyclingEnabled),
      orbVisible: Boolean(persisted.orbVisible),
      audioUnlocked: false,
      error: null,
    };

    this.listeners = new Set();
    this.playableSchoolIds = [];
    this.pendingTuneTimer = null;
    this.pendingTuneSchoolId = null;
    this.fadeOutPromise = Promise.resolve();
    this.currentController = null;
    this.currentTrackSchoolId = null;
    this.container = null;
    this.pendingTuneDurationMs = null;
    this.signalMonitorTimer = null;
    this.audioContextRef = { current: createAudioContext() };
    this.dialLockUntilRef = { current: 0 };
    this.controllerFactory = options.controllerFactory;
    this.dialSfxPlayer = options.dialSfxPlayer || ((settings) => defaultDialSfxPlayer(this.audioContextRef, settings));
    this.nowFn = options.nowFn || Date.now;
    this.randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;
    this.dynamicSchools = [];
  }

  _getSchoolConfig(schoolId) {
    const dynamic = this.dynamicSchools.find(s => s.id === schoolId);
    if (dynamic) return dynamic;
    return getSchoolAudioConfig(schoolId);
  }

  setDynamicSchools(schools = []) {
    this.dynamicSchools = Array.isArray(schools) ? schools : [];
    this._emitState();
  }

  subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    this.listeners.add(listener);
    listener(this.getState());
    if (this.listeners.size === 1 && (this.state.isPlaying || this.state.status === AMBIENT_PLAYER_STATES.TUNING)) {
      this._startSignalMonitor();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this._stopSignalMonitor({ resetSignal: false });
      }
    };
  }

  getState() {
    return { ...this.state };
  }

  setPlayableSchools(playableSchoolIds = []) {
    this.playableSchoolIds = Array.isArray(playableSchoolIds) ? [...playableSchoolIds] : [];

    if (this.playableSchoolIds.length === 0) {
      if (this.state.schoolId !== null) {
        this._setState({ schoolId: null, paletteKey: null, orbSkinKey: null, trackUrl: null });
        this._persistSettings();
      }
      if (this.currentController) {
        this.currentController.destroy();
        this.currentController = null;
        this.currentTrackSchoolId = null;
      }
      this._stopSignalMonitor({ resetSignal: true });
      return;
    }

    if (!this.state.schoolId || !this.playableSchoolIds.includes(this.state.schoolId)) {
      const fallbackSchoolId = getDefaultSchoolId(this.playableSchoolIds);
      this._applySchoolSelection(fallbackSchoolId);
      this._persistSettings();
    }
  }

  async unlockAudio() {
    if (this.state.audioUnlocked) return true;
    const context = this.audioContextRef.current;
    if (context?.state === "suspended") {
      try {
        await context.resume();
      } catch (err) {
        console.warn("Failed to resume AudioContext:", err);
      }
    }

    const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
    try {
      const playPromise = silentAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch {
      // Ignore sync errors.
    }

    this._setState({ audioUnlocked: true });
    if (
      this.state.autoplayAmbient &&
      this.state.status === AMBIENT_PLAYER_STATES.IDLE &&
      this.state.schoolId
    ) {
      await this.play();
    }
    return true;
  }

  async setSchool(schoolId, options = {}) {
    if (!schoolId || !this.playableSchoolIds.includes(schoolId)) {
      this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: "School is not playable" });
      return false;
    }

    await this.unlockAudio();

    if (this.state.status === AMBIENT_PLAYER_STATES.TUNING) {
      this._transition(AMBIENT_PLAYER_EVENTS.SELECT_SCHOOL, { schoolId, queued: true });
      return true;
    }

    const isSameTrackActive = this.currentController && this.currentTrackSchoolId === schoolId;
    const forceRetune = Boolean(options.forceRetune);

    this._transition(AMBIENT_PLAYER_EVENTS.SELECT_SCHOOL, { schoolId, queued: false });
    const tuneDurationMs = this._resolveTuneDurationMs();
    this.pendingTuneDurationMs = tuneDurationMs;
    this._startTuneTimer(tuneDurationMs);
    this._playDialSfx(tuneDurationMs);
    this._startSignalMonitor();

    if (!isSameTrackActive || forceRetune) {
      this.fadeOutPromise = this._fadeOutCurrentTrackIfNeeded();
    } else {
      this.fadeOutPromise = Promise.resolve();
    }

    this._persistSettings();
    return true;
  }

  async cycleSchool(direction = 1) {
    if (this.playableSchoolIds.length === 0) return false;
    if (!this.state.cyclingEnabled) {
      return await this.setSchool(this.state.schoolId || this.playableSchoolIds[0], { forceRetune: true });
    }
    const currentSchoolId = this.state.schoolId || this.playableSchoolIds[0];
    const currentIndex = this.playableSchoolIds.indexOf(currentSchoolId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + this.playableSchoolIds.length) % this.playableSchoolIds.length;
    const nextSchoolId = this.playableSchoolIds[nextIndex];
    return await this.setSchool(nextSchoolId);
  }

  async play() {
    await this.unlockAudio();

    if (this.state.status === AMBIENT_PLAYER_STATES.TUNING) {
      return;
    }

    if (this.currentController) {
      await this.currentController.play();
      this._transition(AMBIENT_PLAYER_EVENTS.PLAY);
      this._startSignalMonitor();
      return;
    }

    const schoolId = this.state.schoolId || getDefaultSchoolId(this.playableSchoolIds);
    if (!schoolId) return;
    await this.setSchool(schoolId, { forceRetune: true });
  }

  async pause() {
    this._clearTuneTimer();
    this._stopSignalMonitor({ resetSignal: true });
    if (this.currentController) {
      await this.currentController.pause();
    }
    this._transition(AMBIENT_PLAYER_EVENTS.PAUSE);
  }

  togglePlayPause() {
    if (this.state.status === AMBIENT_PLAYER_STATES.PLAYING) {
      this.pause();
      return;
    }
    this.play();
  }

  setVolume(volume) {
    const clamped = clamp01(volume);
    this._setState({ volume: clamped });
    if (this.currentController) {
      this.currentController.setVolume(clamped);
    }
    this._persistSettings();
  }

  setAutoplayAmbient(enabled) {
    const nextValue = Boolean(enabled);
    this._setState({ autoplayAmbient: nextValue });
    this._persistSettings();
    if (
      nextValue &&
      this.state.audioUnlocked &&
      this.state.status === AMBIENT_PLAYER_STATES.IDLE &&
      this.state.schoolId
    ) {
      this.play();
    }
  }

  toggleAutoplayAmbient() {
    this.setAutoplayAmbient(!this.state.autoplayAmbient);
  }

  setCyclingEnabled(enabled) {
    this._setState({ cyclingEnabled: Boolean(enabled) });
    this._persistSettings();
  }

  toggleCyclingEnabled() {
    this.setCyclingEnabled(!this.state.cyclingEnabled);
  }

  setOrbVisibility(visible) {
    this._setState({ orbVisible: Boolean(visible) });
    this._persistSettings();
  }

  toggleOrbVisibility() {
    this.setOrbVisibility(!this.state.orbVisible);
  }

  destroy() {
    this._clearTuneTimer();
    this._stopSignalMonitor({ resetSignal: true });
    if (this.currentController) {
      this.currentController.destroy();
      this.currentController = null;
      this.currentTrackSchoolId = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.listeners.clear();
  }

  _emitState() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  _setState(patch) {
    this.state = { ...this.state, ...patch };
    this._emitState();
  }

  _persistSettings() {
    if (!this.storage) return;
    const payload = {
      schoolId: this.state.schoolId,
      volume: this.state.volume,
      autoplayAmbient: this.state.autoplayAmbient,
      cyclingEnabled: this.state.cyclingEnabled,
      orbVisible: this.state.orbVisible,
    };
    try {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors.
    }
  }

  _applySchoolSelection(schoolId) {
    const config = this._getSchoolConfig(schoolId);
    this._setState({
      schoolId,
      paletteKey: config?.paletteKey || null,
      orbSkinKey: config?.orbSkinKey || null,
      trackUrl: config?.trackUrl || null,
    });
  }

  _transition(event, payload = {}) {
    switch (event) {
      case AMBIENT_PLAYER_EVENTS.SELECT_SCHOOL: {
        const { schoolId, queued = false } = payload;
        this._applySchoolSelection(schoolId);
        if (queued) {
          this._setState({
            queuedSchoolId: schoolId,
            error: null,
          });
          return;
        }
        this.pendingTuneSchoolId = schoolId;
        this._setState({
          status: AMBIENT_PLAYER_STATES.TUNING,
          isLoading: true,
          isPlaying: false,
          signalLevel: Math.max(this.state.signalLevel, 0.32),
          queuedSchoolId: null,
          error: null,
        });
        return;
      }
      case AMBIENT_PLAYER_EVENTS.TUNE_COMPLETE: {
        this._setState({
          status: AMBIENT_PLAYER_STATES.PLAYING,
          isLoading: false,
          isPlaying: true,
          queuedSchoolId: null,
          error: null,
        });
        return;
      }
      case AMBIENT_PLAYER_EVENTS.PLAY: {
        this._setState({
          status: AMBIENT_PLAYER_STATES.PLAYING,
          isPlaying: true,
          isLoading: false,
          error: null,
        });
        return;
      }
      case AMBIENT_PLAYER_EVENTS.PAUSE: {
        this._setState({
          status: AMBIENT_PLAYER_STATES.PAUSED,
          isPlaying: false,
          isLoading: false,
          signalLevel: 0,
        });
        return;
      }
      case AMBIENT_PLAYER_EVENTS.TRACK_ENDED: {
        this._setState({ isPlaying: true });
        return;
      }
      case AMBIENT_PLAYER_EVENTS.ERROR: {
        this._stopSignalMonitor({ resetSignal: false });
        this._setState({
          status: AMBIENT_PLAYER_STATES.ERROR,
          isPlaying: false,
          isLoading: false,
          signalLevel: 0,
          error: payload.error || "Unable to play ambient track",
        });
        return;
      }
      default:
        return;
    }
  }

  _resolveTuneDurationMs() {
    const fixedDurationMs = Number(this.options.tuningDurationMs);
    if (Number.isFinite(fixedDurationMs) && fixedDurationMs > 0) {
      return toPositiveMs(fixedDurationMs, DEFAULT_OPTIONS.tuningDurationMinMs);
    }

    const minMs = toPositiveMs(this.options.tuningDurationMinMs, DEFAULT_OPTIONS.tuningDurationMinMs);
    const maxCandidate = toPositiveMs(this.options.tuningDurationMaxMs, DEFAULT_OPTIONS.tuningDurationMaxMs);
    const maxMs = Math.max(minMs, maxCandidate);
    const randomValue = clamp01(this.randomFn());
    const nextDuration = minMs + (maxMs - minMs) * randomValue;
    return Math.round(nextDuration);
  }

  _startTuneTimer(durationMs) {
    this._clearTuneTimer();
    const tuneMs = toPositiveMs(durationMs, DEFAULT_OPTIONS.tuningDurationMinMs);
    this.pendingTuneDurationMs = tuneMs;
    this.pendingTuneTimer = setTimeout(async () => {
      try {
        await this._completeTuning();
      } catch {
        this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: "Failed to complete tuning" });
      }
    }, tuneMs);
  }

  _clearTuneTimer() {
    if (!this.pendingTuneTimer) return;
    clearTimeout(this.pendingTuneTimer);
    this.pendingTuneTimer = null;
    this.pendingTuneSchoolId = null;
    this.pendingTuneDurationMs = null;
    this._setState({ queuedSchoolId: null, isLoading: false });
  }

  _playDialSfx(durationMs) {
    this.dialSfxPlayer({
      lockUntilRef: this.dialLockUntilRef,
      lockMs: this.options.dialLockMs,
      nowFn: this.nowFn,
      durationMs,
    });
  }

  _computeSignalLevel() {
    if (this.state.status === AMBIENT_PLAYER_STATES.TUNING) {
      const clock = this.nowFn() * 0.001;
      const wobble = Math.abs(Math.sin(clock * 7.4)) * 0.32;
      const staticBurst = this.randomFn() * 0.45;
      return clamp01(0.22 + wobble + staticBurst);
    }

    if (!this.state.isPlaying) {
      return 0;
    }

    const sampledLevel = this.currentController?.getSignalLevel?.();
    if (Number.isFinite(sampledLevel)) {
      return clamp01(sampledLevel);
    }

    const clock = this.nowFn() * 0.001;
    const base = 0.28 + Math.abs(Math.sin(clock * 2.7)) * 0.45;
    const accent = this.randomFn() * 0.2;
    return clamp01(base + accent);
  }

  _startSignalMonitor() {
    if (this.signalMonitorTimer || this.listeners.size === 0) return;
    const pollMs = toPositiveMs(this.options.signalPollMs, DEFAULT_OPTIONS.signalPollMs);
    this.signalMonitorTimer = setInterval(() => {
      const nextSignal = this._computeSignalLevel();
      if (Math.abs(nextSignal - this.state.signalLevel) < 0.02) return;
      this._setState({ signalLevel: nextSignal });
    }, pollMs);
  }

  _stopSignalMonitor({ resetSignal = true } = {}) {
    if (this.signalMonitorTimer) {
      clearInterval(this.signalMonitorTimer);
      this.signalMonitorTimer = null;
    }
    if (resetSignal && this.state.signalLevel !== 0) {
      this._setState({ signalLevel: 0 });
    }
  }

  async _completeTuning() {
    this.pendingTuneTimer = null;
    this.pendingTuneDurationMs = null;
    const queuedSchoolId = this.state.queuedSchoolId;
    const targetSchoolId = queuedSchoolId || this.pendingTuneSchoolId || this.state.schoolId;
    this.pendingTuneSchoolId = null;
    this._setState({ queuedSchoolId: null });

    if (!targetSchoolId) {
      this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: "No school selected for tuning" });
      return;
    }

    const targetConfig = this._getSchoolConfig(targetSchoolId);
    if (!targetConfig?.trackUrl) {
      this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: "Selected school has no track" });
      return;
    }

    await this.fadeOutPromise;

    const isAlreadyLoaded = this.currentController && this.currentTrackSchoolId === targetSchoolId;
    if (!isAlreadyLoaded) {
      await this._fadeOutCurrentTrackIfNeeded();
      await this._loadSchoolTrack(targetSchoolId, targetConfig.trackUrl);
    }

    this._transition(AMBIENT_PLAYER_EVENTS.TUNE_COMPLETE);
  }

  async _fadeOutCurrentTrackIfNeeded() {
    if (!this.currentController) return;
    const controller = this.currentController;
    await this._fadeControllerVolume(controller, 0, this.options.fadeOutMs);
    await controller.pause();
    controller.destroy();
    if (this.currentController === controller) {
      this.currentController = null;
      this.currentTrackSchoolId = null;
    }
  }

  async _loadSchoolTrack(schoolId, trackUrl) {
    const container = this._ensureContainer();
    if (!container) {
      throw new Error("Unable to initialize ambient container");
    }

    const controller = this.controllerFactory
      ? await this.controllerFactory({
          schoolId,
          trackUrl,
          volume: 0,
          autoPlay: true,
          onTrackEnded: () => this._transition(AMBIENT_PLAYER_EVENTS.TRACK_ENDED),
          audioContext: this.audioContextRef.current,
        })
      : await createTrackController({
          container,
          trackUrl,
          volume: 0,
          autoPlay: true,
          onTrackEnded: () => this._transition(AMBIENT_PLAYER_EVENTS.TRACK_ENDED),
          audioContext: this.audioContextRef.current,
        });

    controller.schoolId = schoolId;
    controller.setVolume(0);
    this.currentController = controller;
    this.currentTrackSchoolId = schoolId;

    if (controller.loadPromise) {
      await controller.loadPromise;
    }

    await controller.play();
    await this._fadeControllerVolume(controller, this.state.volume, this.options.fadeInMs);
    this._startSignalMonitor();
  }

  _ensureContainer() {
    if (!canUseBrowser()) return null;
    if (this.container) return this.container;
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
    container.setAttribute("aria-hidden", "true");
    document.body.appendChild(container);
    this.container = container;
    return this.container;
  }

  _fadeControllerVolume(controller, targetVolume, durationMs) {
    const target = clamp01(targetVolume);
    if (!controller || durationMs <= 0) {
      controller?.setVolume(target);
      return Promise.resolve();
    }

    const from = clamp01(controller.getVolume ? controller.getVolume() : this.state.volume);
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? () => performance.now()
        : () => Date.now();
    const frame =
      typeof requestAnimationFrame === "function"
        ? (cb) => requestAnimationFrame(cb)
        : (cb) => setTimeout(() => cb(now()), 16);
    const startAt = now();

    return new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = now - startAt;
        const progress = Math.min(1, elapsed / durationMs);
        const nextVolume = from + (target - from) * progress;
        controller.setVolume(nextVolume);
        if (progress < 1) {
          frame(tick);
        } else {
          resolve();
        }
      };
      frame(tick);
    });
  }
}

let ambientPlayerServiceInstance = null;

export function getAmbientPlayerService() {
  if (!ambientPlayerServiceInstance) {
    ambientPlayerServiceInstance = new AmbientPlayerService();
  }
  return ambientPlayerServiceInstance;
}
