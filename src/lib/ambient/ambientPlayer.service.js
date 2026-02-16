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

const DEFAULT_PROVIDER_CAPABILITIES = Object.freeze({
  canAnalyze: false,
  canSetVolumeSmooth: false,
  supportsSeek: false,
});

const CONTEXT_RECOVERY_EVENTS = Object.freeze(["pointerdown", "keydown", "touchstart"]);

function createProviderCapabilities(overrides = {}) {
  return {
    ...DEFAULT_PROVIDER_CAPABILITIES,
    ...overrides,
  };
}

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

function parseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function extractYouTubeVideoId(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();

  if (host.includes("youtu.be")) {
    const fromPath = parsed.pathname.split("/").filter(Boolean)[0];
    return fromPath || null;
  }

  if (host.includes("youtube.com")) {
    if (parsed.pathname.startsWith("/embed/")) {
      const fromEmbed = parsed.pathname.split("/").filter(Boolean)[1];
      return fromEmbed || null;
    }
    return parsed.searchParams.get("v") || null;
  }

  return null;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

const PERCUSSIVE_PULSE_CONFIG = Object.freeze({
  energyEmaAlpha: 0.26,
  floorRiseAlpha: 0.02,
  floorFallAlpha: 0.2,
  cooldownMs: 110, // ~9 Hz max pulse frequency from detected transients.
  holdMs: 42,
  decayMs: 220,
  hitScoreThreshold: 0.08,
  peakWeight: 1.85,
  transientWeight: 2.45,
  crestWeight: 1.15,
});

export function createPercussivePulseState(overrides = {}) {
  return {
    energyEma: 0,
    floorEma: 0.01,
    pulse: 0,
    lastHitMs: -Infinity,
    lastSampleMs: null,
    ...overrides,
  };
}

export function getPercussivePulseLevelFromWaveform(
  byteTimeData,
  pulseState,
  nowMs = getNowMs()
) {
  if (!pulseState || typeof pulseState !== "object") {
    return 0;
  }
  if (!(byteTimeData instanceof Uint8Array) || byteTimeData.length === 0) {
    return clamp01(pulseState.pulse || 0);
  }

  let absMean = 0;
  let absPeak = 0;
  for (let index = 0; index < byteTimeData.length; index += 1) {
    const normalized = Math.abs((byteTimeData[index] - 128) / 128);
    absMean += normalized;
    if (normalized > absPeak) absPeak = normalized;
  }
  absMean /= byteTimeData.length;

  const previousEnergy = pulseState.energyEma || 0;
  const previousFloor = pulseState.floorEma || 0.01;
  const previousPulse = pulseState.pulse || 0;
  const previousSampleMs = pulseState.lastSampleMs;
  const deltaMs = Number.isFinite(previousSampleMs) ? Math.max(0, nowMs - previousSampleMs) : 0;

  pulseState.energyEma =
    previousEnergy + (absMean - previousEnergy) * PERCUSSIVE_PULSE_CONFIG.energyEmaAlpha;

  const floorAlpha =
    absMean < previousFloor
      ? PERCUSSIVE_PULSE_CONFIG.floorFallAlpha
      : PERCUSSIVE_PULSE_CONFIG.floorRiseAlpha;
  pulseState.floorEma = previousFloor + (absMean - previousFloor) * floorAlpha;

  const transientEnergy = Math.max(0, absMean - previousEnergy);
  const crest = Math.max(0, absPeak - absMean);
  const adaptivePeakBase = pulseState.floorEma + 0.045;
  const peakExcursion = Math.max(0, absPeak - adaptivePeakBase);

  const hitScore =
    transientEnergy * PERCUSSIVE_PULSE_CONFIG.transientWeight +
    crest * PERCUSSIVE_PULSE_CONFIG.crestWeight +
    peakExcursion * PERCUSSIVE_PULSE_CONFIG.peakWeight;
  const isOffCooldown = nowMs - pulseState.lastHitMs >= PERCUSSIVE_PULSE_CONFIG.cooldownMs;
  const isPercussiveHit =
    isOffCooldown && hitScore >= PERCUSSIVE_PULSE_CONFIG.hitScoreThreshold;

  let nextPulse = previousPulse;
  if (isPercussiveHit) {
    pulseState.lastHitMs = nowMs;
    nextPulse = 1;
  } else if (deltaMs > 0) {
    const decay = Math.exp(-deltaMs / PERCUSSIVE_PULSE_CONFIG.decayMs);
    nextPulse = previousPulse * decay;
  }

  if (nowMs - pulseState.lastHitMs <= PERCUSSIVE_PULSE_CONFIG.holdMs) {
    nextPulse = Math.max(nextPulse, 0.92);
  }

  pulseState.pulse = clamp01(nextPulse);
  pulseState.lastSampleMs = nowMs;

  const normalizedEnergy = clamp01(
    (absMean - pulseState.floorEma * 0.82) / (0.27 + pulseState.floorEma)
  );
  return clamp01(normalizedEnergy * 0.42 + pulseState.pulse * 0.94);
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

let youtubeIframeApiPromise = null;

function loadYoutubeIframeApi() {
  if (!canUseBrowser()) {
    return Promise.reject(new Error("YouTube iframe API requires a browser environment"));
  }

  if (window.YT && typeof window.YT.Player === "function") {
    return Promise.resolve(window.YT);
  }

  if (youtubeIframeApiPromise) {
    return youtubeIframeApiPromise;
  }

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    const settle = (handler, value) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      handler(value);
    };

    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReadyHandler === "function") {
        try {
          previousReadyHandler();
        } catch {
          // Ignore other ready callback failures.
        }
      }
      if (window.YT && typeof window.YT.Player === "function") {
        settle(resolve, window.YT);
        return;
      }
      settle(reject, new Error("YouTube iframe API loaded without Player constructor"));
    };

    const scriptSrc = "https://www.youtube.com/iframe_api";
    const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = scriptSrc;
      script.async = true;
      script.onerror = () => {
        settle(reject, new Error("Failed to load YouTube iframe API script"));
      };
      const host = document.head || document.body || document.documentElement;
      host.appendChild(script);
    }

    if (window.YT && typeof window.YT.Player === "function") {
      settle(resolve, window.YT);
      return;
    }

    timeoutId = window.setTimeout(() => {
      settle(reject, new Error("Timed out loading YouTube iframe API"));
    }, 12000);
  }).catch((error) => {
    youtubeIframeApiPromise = null;
    throw error;
  });

  return youtubeIframeApiPromise;
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
  if (!embed?.src && !embed?.audioUrl) {
    throw new Error("Unsupported track URL");
  }
  const youtubeVideoId = embed.provider === "youtube" ? extractYouTubeVideoId(trackUrl) : null;

  if (embed.provider === "youtube" && youtubeVideoId) {
    let player = null;
    let mountNode = null;
    let currentVolume = clamp01(volume);
    let destroyed = false;
    const capabilities = createProviderCapabilities({
      canAnalyze: false,
      canSetVolumeSmooth: true,
      supportsSeek: true,
    });

    const teardownPlayer = () => {
      if (player) {
        try {
          player.destroy();
        } catch {
          // Ignore YouTube teardown failures.
        }
      }
      player = null;
      if (mountNode) {
        mountNode.remove();
        mountNode = null;
      }
    };

    const loadPromise = loadYoutubeIframeApi()
      .then((api) => {
        if (destroyed) return;
        return new Promise((resolve, reject) => {
          let settled = false;
          const settle = (handler, value) => {
            if (settled) return;
            settled = true;
            handler(value);
          };

          mountNode = document.createElement("div");
          mountNode.style.cssText =
            "width:0;height:0;overflow:hidden;pointer-events:none;position:absolute;";
          container.appendChild(mountNode);

          player = new api.Player(mountNode, {
          videoId: youtubeVideoId,
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            loop: 1, // Loop works with playlist, otherwise requires manual restart
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            start: 0,
            playsinline: 1,
          },
          events: {
            onReady: (e) => {
              if (destroyed) {
                teardownPlayer();
                settle(resolve);
                return;
              }
              try {
                e.target.setVolume(currentVolume * 100); // YT API uses 0-100
              } catch {
                // Ignore transient volume errors before player settles.
              }
              settle(resolve);
            },
            onStateChange: (e) => {
              if (destroyed) return;
              if (e.data === api.PlayerState.ENDED) {
                // Manually loop if single video
                try {
                  e.target.seekTo(0);
                  e.target.playVideo();
                } catch {
                  // Ignore loop restart failures.
                }
                onTrackEnded?.();
              }
            },
            onError: () => {
              settle(reject, new Error("YouTube player failed to initialize"));
            },
          }
        });
      });
      })
      .catch((error) => {
        teardownPlayer();
        throw error;
      });

    return {
      provider: embed.provider,
      capabilities,
      schoolId: null,
      loadPromise,
      getVolume: () => currentVolume,
      setVolume: (value) => {
        currentVolume = clamp01(value);
        if (!destroyed && player) {
          try {
            player.setVolume(currentVolume * 100);
          } catch {
            // Ignore early setVolume calls before player ready.
          }
        }
      },
      getSignalLevel: () => null,
      play: async () => {
        await loadPromise; // Ensure player is ready
        if (destroyed) return;
        player?.playVideo();
      },
      pause: async () => {
        if (destroyed) return;
        player?.pauseVideo();
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        teardownPlayer();
      },
    };
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

    const handleAudioError = (e) => {
      console.error("Suno audio playback error:", e.target.error);
    };
    audio.addEventListener("error", handleAudioError);

    let analyser = null;
    let analyserData = null;
    let mediaSource = null;
    let outputGain = null;
    const pulseState = createPercussivePulseState();

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

    const handleEnded = () => onTrackEnded?.();
    if (typeof onTrackEnded === "function") {
      audio.addEventListener("ended", handleEnded);
    }

    let resolvedLoad = false;
    let loadTimeoutId = null;
    const handleCanPlay = () => {
      if (resolvedLoad) return;
      resolvedLoad = true;
      audio.removeEventListener("canplaythrough", handleCanPlay);
      if (loadTimeoutId !== null) {
        clearTimeout(loadTimeoutId);
      }
      loadTimeoutId = null;
    };

    const loadPromise = new Promise((resolve) => {
      const resolveWhenReady = () => {
        if (resolvedLoad) {
          resolve();
          return;
        }
        handleCanPlay();
        resolve();
      };
      audio.addEventListener("canplaythrough", handleCanPlay);
      loadTimeoutId = setTimeout(resolveWhenReady, 5000);
      if (audio.readyState >= 3) {
        resolveWhenReady();
      }
    });

    let sunoVolume = clamp01(volume);
    const capabilities = createProviderCapabilities({
      canAnalyze: Boolean(analyser),
      canSetVolumeSmooth: true,
      supportsSeek: true,
    });
    let destroyed = false;

    const disconnectGraph = () => {
      try {
        mediaSource?.disconnect();
        analyser?.disconnect();
        outputGain?.disconnect();
      } catch {
        // Ignore analyser graph teardown failures.
      }
      mediaSource = null;
      analyser = null;
      outputGain = null;
      analyserData = null;
    };

    if (!outputGain) {
      audio.volume = sunoVolume;
    } else {
      audio.volume = 1;
    }

    return {
      provider: embed.provider,
      capabilities,
      schoolId: null,
      loadPromise,
      getVolume: () => sunoVolume,
      setVolume: (value) => {
        sunoVolume = clamp01(value);
        if (destroyed) return;
        if (outputGain) {
          outputGain.gain.value = sunoVolume;
        } else {
          audio.volume = sunoVolume;
        }
      },
      getSignalLevel: () => {
        if (analyser && analyserData && typeof analyser.getByteTimeDomainData === "function") {
          analyser.getByteTimeDomainData(analyserData);
          return getPercussivePulseLevelFromWaveform(analyserData, pulseState, getNowMs());
        }
        return null;
      },
      play: async () => {
        await loadPromise;
        if (destroyed) return;
        if (audioContext && (audioContext.state === "suspended" || audioContext.state === "interrupted")) {
          try {
            await audioContext.resume();
          } catch {
            // Context resume failed.
          }
        }
        try {
          await audio.play();
        } catch (err) {
          console.warn("Audio playback failed (user gesture?):", err);
          throw new Error("Audio playback blocked. Please interact with the page.");
        }
      },
      pause: async () => {
        if (destroyed) return;
        audio.pause();
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        audio.pause();
        audio.removeEventListener("error", handleAudioError);
        audio.removeEventListener("canplaythrough", handleCanPlay);
        if (typeof onTrackEnded === "function") {
          audio.removeEventListener("ended", handleEnded);
        }
        if (loadTimeoutId !== null) {
          clearTimeout(loadTimeoutId);
          loadTimeoutId = null;
        }
        disconnectGraph();
        audio.removeAttribute("src");
        try {
          audio.load();
        } catch {
          // Ignore late teardown load errors.
        }
        audio.remove();
      },
    };
  }

  // Suno embed fallback: avoid brittle direct-MP3 URLs while preserving play/pause controls.
  if (embed.provider === "suno" && embed.src) {
    const iframe = document.createElement("iframe");
    iframe.allow = "autoplay";
    iframe.style.cssText = "width:0;height:0;border:0;position:absolute;pointer-events:none;";
    iframe.title = "Suno player";
    container.appendChild(iframe);

    let sunoVolume = clamp01(volume);

    const setAutoplaySrc = (enabled) => {
      try {
        const url = new URL(embed.src);
        if (enabled) {
          url.searchParams.set("autoplay", "1");
        } else {
          url.searchParams.delete("autoplay");
        }
        iframe.src = url.toString();
      } catch {
        iframe.src = embed.src;
      }
    };

    if (autoPlay) {
      setAutoplaySrc(true);
    } else {
      iframe.src = embed.src;
    }

    return {
      provider: embed.provider,
      capabilities: createProviderCapabilities({
        canAnalyze: false,
        canSetVolumeSmooth: false,
        supportsSeek: false,
      }),
      schoolId: null,
      loadPromise: Promise.resolve(),
      getVolume: () => sunoVolume,
      setVolume: (value) => {
        sunoVolume = clamp01(value);
      },
      getSignalLevel: () => null,
      play: async () => {
        setAutoplaySrc(true);
      },
      pause: async () => {
        iframe.src = "about:blank";
      },
      destroy: () => {
        iframe.remove();
      },
    };
  }

  // Fallback for unsupported embeds or other iframe providers
  // This iframe cannot be controlled by JS, so it's a passive display
  const iframe = document.createElement("iframe");
  iframe.src = embed.src;
  iframe.allow = "autoplay";
  iframe.style.cssText = "width:0;height:0;border:0;position:absolute;pointer-events:none;";
  iframe.title = "Ambient player";
  container.appendChild(iframe);
  
  return {
    provider: embed.provider,
    capabilities: createProviderCapabilities({
      canAnalyze: false,
      canSetVolumeSmooth: false,
      supportsSeek: false,
    }),
    schoolId: null, // Not directly associated with a school for control purposes
    getVolume: () => 0, // Cannot control iframe volume directly
    setVolume: () => {}, // No-op
    getSignalLevel: () => null, // Cannot get signal from iframe
    play: async () => {}, // Cannot control iframe directly
    pause: async () => {}, // Cannot control iframe directly
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
    this.pendingTuneOperationId = null;
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
    this.hasPlayedDialSfx = false;
    this.tuneOperationId = 0;
    this.activeTuneOperationId = 0;
    this.contextRecoveryListenersAttached = false;
    this._onVisibilityChange = this._handleVisibilityChange.bind(this);
    this._onUserInteraction = this._handleUserInteraction.bind(this);

    this._attachContextRecoveryListeners();
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

  _ensureAudioContext() {
    const current = this.audioContextRef.current;
    if (current && current.state !== "closed") {
      return current;
    }
    this.audioContextRef.current = createAudioContext();
    return this.audioContextRef.current;
  }

  async ensureContextRunning() {
    const context = this._ensureAudioContext();
    if (!context) {
      return false;
    }
    if (context.state === "running") {
      return true;
    }
    if (typeof context.resume !== "function") {
      return false;
    }
    try {
      await context.resume();
    } catch (err) {
      console.warn("Failed to resume AudioContext:", err);
      return false;
    }
    return context.state === "running";
  }

  _handleVisibilityChange() {
    if (!canUseBrowser()) return;
    if (document.visibilityState === "visible") {
      void this.ensureContextRunning();
    }
  }

  _handleUserInteraction() {
    void this.ensureContextRunning();
  }

  _attachContextRecoveryListeners() {
    if (!canUseBrowser() || this.contextRecoveryListenersAttached) {
      return;
    }
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    CONTEXT_RECOVERY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, this._onUserInteraction, { passive: true });
    });
    this.contextRecoveryListenersAttached = true;
  }

  _detachContextRecoveryListeners() {
    if (!canUseBrowser() || !this.contextRecoveryListenersAttached) {
      return;
    }
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    CONTEXT_RECOVERY_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, this._onUserInteraction);
    });
    this.contextRecoveryListenersAttached = false;
  }

  _nextTuneOperationId() {
    this.tuneOperationId += 1;
    this.activeTuneOperationId = this.tuneOperationId;
    return this.activeTuneOperationId;
  }

  _isTuneOperationCurrent(tuneOperationId) {
    return Number.isFinite(tuneOperationId) && tuneOperationId === this.activeTuneOperationId;
  }

  _isTuneOperationActive(tuneOperationId) {
    return (
      this.state.status === AMBIENT_PLAYER_STATES.TUNING &&
      this._isTuneOperationCurrent(tuneOperationId)
    );
  }

  _destroyController(controller) {
    if (!controller || typeof controller.destroy !== "function") {
      return;
    }
    try {
      controller.destroy();
    } catch (err) {
      console.warn("Failed to destroy track controller:", err);
    }
  }

  _getControllerCapabilities(controller = this.currentController) {
    if (!controller || typeof controller !== "object") {
      return DEFAULT_PROVIDER_CAPABILITIES;
    }
    return createProviderCapabilities(controller.capabilities || {});
  }

  _computeSyntheticSignalLevel() {
    const clock = this.nowFn() * 0.001;
    const lfo = 0.24 + Math.abs(Math.sin(clock * 2.7)) * 0.44;
    const shimmer = this.randomFn() * 0.22;
    return clamp01(lfo + shimmer);
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
      this._clearTuneTimer();
      this._nextTuneOperationId();
      if (this.state.schoolId !== null) {
        this._setState({ schoolId: null, paletteKey: null, orbSkinKey: null, trackUrl: null });
        this._persistSettings();
      }
      if (this.currentController) {
        this._destroyController(this.currentController);
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
    await this.ensureContextRunning();
    if (this.state.audioUnlocked) return true;

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

    const tuneOperationId = this._nextTuneOperationId();

    if (this.state.status === AMBIENT_PLAYER_STATES.TUNING) {
      this._transition(AMBIENT_PLAYER_EVENTS.SELECT_SCHOOL, {
        schoolId,
        queued: true,
        tuneOperationId,
      });
      const queuedTuneDurationMs = this.pendingTuneDurationMs || this._resolveTuneDurationMs();
      this.pendingTuneDurationMs = queuedTuneDurationMs;
      this._startTuneTimer(queuedTuneDurationMs, tuneOperationId);
      return true;
    }

    const isSameTrackActive = this.currentController && this.currentTrackSchoolId === schoolId;
    const forceRetune = Boolean(options.forceRetune);
    const skipTuning = Boolean(options.skipTuning);
    const shouldPlayDialSfx = options.playDialSfx !== false;

    this._transition(AMBIENT_PLAYER_EVENTS.SELECT_SCHOOL, {
      schoolId,
      queued: false,
      tuneOperationId,
    });
    if (skipTuning) {
      this.pendingTuneDurationMs = null;
      if (shouldPlayDialSfx) {
        this._playDialSfx(420);
      }
    } else {
      const tuneDurationMs = this._resolveTuneDurationMs();
      this.pendingTuneDurationMs = tuneDurationMs;
      this._startTuneTimer(tuneDurationMs, tuneOperationId);
      if (shouldPlayDialSfx) {
        this._playDialSfx(tuneDurationMs);
      }
    }
    this._startSignalMonitor();

    if (!isSameTrackActive || forceRetune) {
      this.fadeOutPromise = this._fadeOutCurrentTrackIfNeeded();
    } else {
      this.fadeOutPromise = Promise.resolve();
    }

    this._persistSettings();
    if (skipTuning) {
      try {
        await this._completeTuning(tuneOperationId);
      } catch {
        this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: "Failed to complete tuning" });
        return false;
      }
    }
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
      try {
        await this.currentController.play();
        this._transition(AMBIENT_PLAYER_EVENTS.PLAY);
        this._startSignalMonitor();
      } catch (err) {
        this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: err.message });
      }
      return;
    }

    const schoolId = this.state.schoolId || getDefaultSchoolId(this.playableSchoolIds);
    if (!schoolId) return;
    await this.setSchool(schoolId, { forceRetune: true, skipTuning: true, playDialSfx: true });
  }

  async pause() {
    this._clearTuneTimer();
    this._stopSignalMonitor({ resetSignal: true });
    if (this.currentController) {
      try {
        await this.currentController.pause();
      } catch (err) {
        console.warn("Error pausing controller:", err);
      }
    }
    this._transition(AMBIENT_PLAYER_EVENTS.PAUSE);
  }

  async togglePlayPause() {
    if (this.state.status === AMBIENT_PLAYER_STATES.PLAYING || this.state.status === AMBIENT_PLAYER_STATES.TUNING) {
      await this.pause();
      return;
    }
    await this.play();
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
      this._destroyController(this.currentController);
      this.currentController = null;
      this.currentTrackSchoolId = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this._detachContextRecoveryListeners();
    this.pendingTuneOperationId = null;
    this._nextTuneOperationId();
    const context = this.audioContextRef.current;
    if (context && typeof context.close === "function" && context.state !== "closed") {
      context.close().catch(() => {});
    }
    this.audioContextRef.current = null;
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
        const { schoolId, queued = false, tuneOperationId = this.activeTuneOperationId } = payload;
        if (Number.isFinite(tuneOperationId)) {
          this.activeTuneOperationId = tuneOperationId;
        }
        this._applySchoolSelection(schoolId);
        if (queued) {
          this._setState({
            queuedSchoolId: schoolId,
            isLoading: true,
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

  _startTuneTimer(durationMs, tuneOperationId = this.activeTuneOperationId) {
    if (this.pendingTuneTimer) {
      clearTimeout(this.pendingTuneTimer);
      this.pendingTuneTimer = null;
    }
    const tuneMs = toPositiveMs(durationMs, DEFAULT_OPTIONS.tuningDurationMinMs);
    this.pendingTuneDurationMs = tuneMs;
    this.pendingTuneOperationId = tuneOperationId;
    this.pendingTuneTimer = setTimeout(async () => {
      try {
        await this._completeTuning(tuneOperationId);
      } catch {
        if (this._isTuneOperationCurrent(tuneOperationId)) {
          this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: "Failed to complete tuning" });
        }
      }
    }, tuneMs);
  }

  _clearTuneTimer() {
    if (this.pendingTuneTimer) {
      clearTimeout(this.pendingTuneTimer);
      this.pendingTuneTimer = null;
    }
    this.pendingTuneSchoolId = null;
    this.pendingTuneOperationId = null;
    this.pendingTuneDurationMs = null;
    if (this.state.queuedSchoolId || this.state.isLoading) {
      this._setState({ queuedSchoolId: null, isLoading: false });
    }
  }

  _playDialSfx(durationMs) {
    if (this.hasPlayedDialSfx) {
      return;
    }
    this.hasPlayedDialSfx = true;
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

    const capabilities = this._getControllerCapabilities();
    const sampledLevel = this.currentController?.getSignalLevel?.();
    if (capabilities.canAnalyze && Number.isFinite(sampledLevel)) {
      return clamp01(sampledLevel);
    }

    return this._computeSyntheticSignalLevel();
  }

  _startSignalMonitor() {
    if (!canUseBrowser() || this.signalMonitorTimer || this.listeners.size === 0) return;
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

  async _completeTuning(tuneOperationId = this.activeTuneOperationId) {
    if (!this._isTuneOperationCurrent(tuneOperationId)) {
      return;
    }

    if (this.pendingTuneOperationId === tuneOperationId) {
      this.pendingTuneTimer = null;
      this.pendingTuneDurationMs = null;
      this.pendingTuneOperationId = null;
    }

    const targetSchoolId = this.state.queuedSchoolId || this.pendingTuneSchoolId || this.state.schoolId;
    if (!targetSchoolId) {
      if (this._isTuneOperationCurrent(tuneOperationId)) {
        this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: "No school selected for tuning" });
      }
      return;
    }

    if (!this._isTuneOperationActive(tuneOperationId)) {
      return;
    }

    const targetConfig = this._getSchoolConfig(targetSchoolId);
    if (!targetConfig?.trackUrl) {
      if (this._isTuneOperationCurrent(tuneOperationId)) {
        this._transition(AMBIENT_PLAYER_EVENTS.ERROR, { error: "Selected school has no track" });
      }
      return;
    }

    await this.fadeOutPromise;

    if (!this._isTuneOperationActive(tuneOperationId)) {
      return;
    }

    const isAlreadyLoaded = this.currentController && this.currentTrackSchoolId === targetSchoolId;
    if (!isAlreadyLoaded) {
      await this._fadeOutCurrentTrackIfNeeded();

      if (!this._isTuneOperationActive(tuneOperationId)) {
        return;
      }

      const didLoadTrack = await this._loadSchoolTrack(
        targetSchoolId,
        targetConfig.trackUrl,
        tuneOperationId
      );
      if (!didLoadTrack || !this._isTuneOperationActive(tuneOperationId)) {
        return;
      }
    } else {
      try {
        await this.currentController.play();
      } catch (err) {
        console.warn("Failed to play existing controller:", err);
      }
      if (!this._isTuneOperationActive(tuneOperationId)) {
        return;
      }
    }

    if (this._isTuneOperationActive(tuneOperationId)) {
      this.pendingTuneSchoolId = null;
      this._transition(AMBIENT_PLAYER_EVENTS.TUNE_COMPLETE);
    }
  }

  async _fadeOutCurrentTrackIfNeeded() {
    if (!this.currentController) return;
    const controller = this.currentController;
    await this._fadeControllerVolume(controller, 0, this.options.fadeOutMs);
    try {
      await controller.pause();
    } catch (err) {
      console.warn("Error pausing controller during fade out:", err);
    }
    this._destroyController(controller);
    if (this.currentController === controller) {
      this.currentController = null;
      this.currentTrackSchoolId = null;
    }
  }

  async _loadSchoolTrack(schoolId, trackUrl, tuneOperationId = this.activeTuneOperationId) {
    const container = this._ensureContainer();
    if (!container) {
      throw new Error("Unable to initialize ambient container");
    }

    const audioContext = this._ensureAudioContext();

    const controller = this.controllerFactory
      ? await this.controllerFactory({
          schoolId,
          trackUrl,
          volume: 0,
          autoPlay: true,
          onTrackEnded: () => this._transition(AMBIENT_PLAYER_EVENTS.TRACK_ENDED),
          audioContext,
        })
      : await createTrackController({
          container,
          trackUrl,
          volume: 0,
          autoPlay: true,
          onTrackEnded: () => this._transition(AMBIENT_PLAYER_EVENTS.TRACK_ENDED),
          audioContext,
        });

    if (!this._isTuneOperationActive(tuneOperationId)) {
      this._destroyController(controller);
      return false;
    }

    controller.schoolId = schoolId;
    controller.setVolume(0);
    this.currentController = controller;
    this.currentTrackSchoolId = schoolId;

    if (controller.loadPromise) {
      await controller.loadPromise;
    }

    if (!this._isTuneOperationActive(tuneOperationId)) {
      if (this.currentController === controller) {
        this.currentController = null;
        this.currentTrackSchoolId = null;
      }
      this._destroyController(controller);
      return false;
    }

    try {
      await controller.play();
      if (!this._isTuneOperationActive(tuneOperationId)) {
        if (this.currentController === controller) {
          this.currentController = null;
          this.currentTrackSchoolId = null;
        }
        this._destroyController(controller);
        return false;
      }
      await this._fadeControllerVolume(controller, this.state.volume, this.options.fadeInMs);
      if (!this._isTuneOperationActive(tuneOperationId)) {
        if (this.currentController === controller) {
          this.currentController = null;
          this.currentTrackSchoolId = null;
        }
        this._destroyController(controller);
        return false;
      }
      this._startSignalMonitor();
      return true;
    } catch (err) {
      if (this.currentController === controller) {
        this.currentController = null;
        this.currentTrackSchoolId = null;
      }
      this._destroyController(controller);
      console.error("Failed to play track after loading:", err);
      throw err;
    }
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

    const capabilities = this._getControllerCapabilities(controller);
    if (!capabilities.canSetVolumeSmooth) {
      controller.setVolume(target);
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
