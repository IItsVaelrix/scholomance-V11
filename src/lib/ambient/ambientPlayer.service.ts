import { getSchoolAudioConfig } from "../../lib/ambient/schoolAudio.config";

export const AMBIENT_PLAYER_STATES = {
  STANDBY: 'STANDBY' as const,
  TUNING: 'TUNING' as const,
  PLAYING: 'PLAYING' as const,
  PAUSED: 'PAUSED' as const,
  ERROR: 'ERROR' as const
} as const;

type AmbientState = {
  schoolId: string | null;
  queuedSchoolId: string | null;
  status: (typeof AMBIENT_PLAYER_STATES)[keyof typeof AMBIENT_PLAYER_STATES];
  isLoading: boolean;
};

class AmbientPlayerService {
  private state: AmbientState = {
    schoolId: null,
    queuedSchoolId: null,
    status: AMBIENT_PLAYER_STATES.STANDBY,
    isLoading: false,
  };
  private audio = new Audio();
  private subscribers = new Set<(state: AmbientState) => void>();
  private analyser?: AnalyserNode;
  private rafId: number | null = null;
  private container: HTMLElement | null = null;

  constructor() {
    this.audio.crossOrigin = 'anonymous';
    this.audio.loop = true;
    this.audio.volume = 0.5;
    this.audio.onended = () => {
      this.state.status = AMBIENT_PLAYER_STATES.STANDBY;
      this.notify();
    };
  }

  setContainer(container: HTMLElement) {
    this.container = container;
    if (this.audio.parentNode) this.audio.parentNode.removeChild(this.audio);
    container.appendChild(this.audio);
  }

  subscribe(fn: (state: AmbientState) => void) {
    this.subscribers.add(fn);
    fn(this.state);
  }

  private notify() {
    this.subscribers.forEach(fn => fn(this.state));
  }

  getState(): AmbientState { return { ...this.state }; }

  getSignalLevel(): number {
    // Stub: Sine wave for visual feedback
    return Math.abs(Math.sin(Date.now() * 0.003)) * 0.7;
  }

  async unlockAudio() {
    try {
      this.audio.play().catch(() => {});
      this.audio.pause();
    } catch {}
  }

  async setSchool(schoolId: string): Promise<boolean> {
    const config = getSchoolAudioConfig(schoolId);
    if (!config?.trackUrl) {
      this.state.status = AMBIENT_PLAYER_STATES.ERROR;
      this.notify();
      return false;
    }

    this.state.status = AMBIENT_PLAYER_STATES.TUNING;
    this.state.isLoading = true;
    this.notify();

    try {
      this.audio.src = config.trackUrl;
      await new Promise((resolve, reject) => {
        this.audio.oncanplay = resolve;
        this.audio.onerror = reject;
        this.audio.load();
      });
      this.state.schoolId = schoolId;
      this.state.status = AMBIENT_PLAYER_STATES.PLAYING;
    } catch (e) {
      console.error('Audio load failed:', e);
      this.state.status = AMBIENT_PLAYER_STATES.ERROR;
    } finally {
      this.state.isLoading = false;
      this.notify();
    }
    return true;
  }

  async togglePlayPause() {
    try {
      if (this.audio.paused || this.state.status === AMBIENT_PLAYER_STATES.TUNING) {
        await this.audio.play();
        this.state.status = AMBIENT_PLAYER_STATES.PLAYING;
      } else {
        this.audio.pause();
        this.state.status = AMBIENT_PLAYER_STATES.PAUSED;
      }
    } catch (e) {
      console.error('Play/pause failed:', e);
      this.state.status = AMBIENT_PLAYER_STATES.ERROR;
    }
    this.notify();
  }

  setVolume(value: number) {
    this.audio.volume = Math.max(0, Math.min(1, value));
  }

  cycleSchool(delta: number) {
    // Cycle SONIC stations
    const pool = require('../../data/sonicStationBuckets').getSonicStationTrackPool();
    const idx = Math.floor(Math.random() * pool.length);
    this.setSchool(pool[idx]?.schoolId || 'SONIC');
  }

  seek(offset: number) {
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + offset));
  }
}

let instance: AmbientPlayerService | null = null;
export function getAmbientPlayerService(): AmbientPlayerService {
  if (!instance) instance = new AmbientPlayerService();
  return instance;
}

