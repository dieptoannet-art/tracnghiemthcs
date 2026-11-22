/**
 * EduGameAudioController — Bộ điều khiển âm thanh & giọng đọc tiếng Việt dùng chung
 * cho nhóm trò chơi gọi học sinh ngẫu nhiên A05–A12 (Tây Đô Smart EDU).
 *
 * Nguyên tắc thiết kế:
 * 1. Tái sử dụng chuẩn `VietnameseVoiceManager` của A01: chỉ dùng giọng `vi-VN` / `vi`,
 *    tuyệt đối không fallback sang tiếng Anh.
 * 2. Web Audio API tổng hợp 100% (không phụ thuộc file MP3 ngoài -> không lỗi 404 trên build).
 * 3. Bus tổng (`masterGain` + `DynamicsCompressorNode`) cân bằng âm lượng cho loa máy chiếu:
 *    - Tiếng về đích / bóng bật / xúc xắc chạm bàn không đột ngột lớn hơn nhiều phần còn lại.
 *    - `stopAll()` cắt ngay mọi âm thanh đang phát (loop, oscillator, noise) khi tắt loa / bỏ qua / thoát.
 * 4. Gắn token lượt (`turnToken`) chống phát lặp / phát bù khi bấm nhanh, re-render hay bật lại loa.
 * 5. Lưu cấu hình chung (tắt/bật âm thanh & đọc tên) an toàn, tách biệt tự động khi chạy `/demo`.
 */

import {
  VietnameseVoiceManager,
  VoiceManagerSnapshot,
  SpeakResult,
} from './vietnameseVoiceManager';
import {
  KHKT_DEMO_STORAGE_PREFIX,
  isKhktDemoRuntime,
} from './khktDemoSandbox';

const PROD_MUTED_KEY = 'taydo_edu_game_muted_v1';
const PROD_VOICE_ENABLED_KEY = 'taydo_edu_game_voice_enabled_v1';

function getScopedAudioStorageKey(prodKey: string): string {
  return isKhktDemoRuntime() ? `${KHKT_DEMO_STORAGE_PREFIX}${prodKey}` : prodKey;
}

export function loadEduGameMuted(defaultValue = false): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(getScopedAudioStorageKey(PROD_MUTED_KEY));
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveEduGameMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getScopedAudioStorageKey(PROD_MUTED_KEY), String(Boolean(muted)));
  } catch {
    // Ignore storage quota/privacy mode errors
  }
}

export function loadEduGameVoiceEnabled(defaultValue = true): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(getScopedAudioStorageKey(PROD_VOICE_ENABLED_KEY));
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveEduGameVoiceEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getScopedAudioStorageKey(PROD_VOICE_ENABLED_KEY),
      String(Boolean(enabled))
    );
  } catch {
    // Ignore storage quota/privacy mode errors
  }
}

export function stopAllGlobalEduSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore speechSynthesis cancel errors
    }
  }
}

// ============================================================================
// SHARED CLASSROOM-BALANCED WEB AUDIO ENGINE (A05–A12)
// ============================================================================
export class EduGameSoundBank {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeNodes = new Set<AudioScheduledSourceNode>();

  // Continuous / rhythmic movement layers (strictly single-layer to prevent stacking)
  private waterSource: AudioBufferSourceNode | null = null;
  private waterGain: GainNode | null = null;
  private waterLfo: OscillatorNode | null = null;
  private waterLfoGain: GainNode | null = null;

  private hoofTimer: number | null = null;
  private hoofMutedCheck: (() => boolean) | null = null;
  private hoofProgress = 0;
  private hoofStepIndex = 0;

  private tugPullTimer: number | null = null;
  private tugPullMutedCheck: (() => boolean) | null = null;
  private tugPullStep = 0;

  private relayStepTimer: number | null = null;
  private relayStepMutedCheck: (() => boolean) | null = null;
  private relayStepIndex = 0;

  private carEngineOsc: OscillatorNode | null = null;
  private carEngineSubOsc: OscillatorNode | null = null;
  private carEngineGain: GainNode | null = null;
  private carEngineWatchTimer: number | null = null;
  private carEngineMutedCheck: (() => boolean) | null = null;

  private activeTurnToken: string | null = null;
  private disposed = false;

  /**
   * Call synchronously inside a user gesture (click/keydown) to unlock Web Audio.
   */
  public unlock(): void {
    if (this.disposed) return;
    this.ensureGraph();
  }

  public setActiveTurnToken(token: string | null): void {
    this.activeTurnToken = token;
  }

  public isTurnValid(token?: string | null): boolean {
    if (this.disposed) return false;
    if (!token) return true;
    return this.activeTurnToken === token;
  }

  private ensureGraph(): { ctx: AudioContext; out: GainNode } | null {
    if (this.disposed || typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.compressor) {
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-16, this.ctx.currentTime);
      comp.knee.setValueAtTime(18, this.ctx.currentTime);
      comp.ratio.setValueAtTime(4, this.ctx.currentTime);
      comp.attack.setValueAtTime(0.005, this.ctx.currentTime);
      comp.release.setValueAtTime(0.12, this.ctx.currentTime);
      comp.connect(this.ctx.destination);
      this.compressor = comp;
    }

    if (!this.masterGain) {
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      gain.connect(this.compressor);
      this.masterGain = gain;
    }

    if (!this.noiseBuffer) {
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, Math.max(sr * 2, 16000), sr);
      const ch = buf.getChannelData(0);
      // Gentle pink-tinted white noise (warmer on classroom speakers than harsh white noise)
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < ch.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        ch[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 1.4));
      }
      this.noiseBuffer = buf;
    }

    return { ctx: this.ctx, out: this.masterGain };
  }

  private trackNode<T extends AudioScheduledSourceNode>(node: T): T {
    this.activeNodes.add(node);
    const cleanup = () => {
      this.activeNodes.delete(node);
    };
    node.onended = cleanup;
    return node;
  }

  /**
   * Immediately stops all continuous movement layers (water swim loop, hoofbeat loop).
   */
  public stopLoops(): void {
    this.stopWaterSwimLoop();
    this.stopHoofbeatLoop();
    this.stopTugPullLoop();
    this.stopRelayStepLoop();
    this.stopCarEngineLoop();
  }

  /**
   * Immediately silences all loops AND every currently playing / scheduled sound effect.
   * Recreates a clean masterGain node so subsequent events after unmuting play normally
   * without replaying anything from the muted window.
   */
  public stopAll(): void {
    this.stopLoops();

    this.activeNodes.forEach((node) => {
      try {
        node.onended = null;
        node.stop(0);
      } catch {
        // Ignore already stopped nodes
      }
      try {
        node.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    });
    this.activeNodes.clear();

    if (this.masterGain) {
      try {
        if (this.ctx) {
          this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        this.masterGain.disconnect();
      } catch {
        // Ignore
      }
      this.masterGain = null;
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.stopAll();
    if (this.compressor) {
      try {
        this.compressor.disconnect();
      } catch {
        // Ignore
      }
      this.compressor = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }

  // --------------------------------------------------------------------------
  // SHARED COUNTDOWN & CLASSROOM CHIMES
  // --------------------------------------------------------------------------
  public playCountdownBeep(step: 3 | 2 | 1, muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const freq = step === 3 ? 440 : step === 2 ? 523.25 : 659.25;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Ignore
    }
  }

  public playRevealChime(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    this.stopLoops();
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Balanced classroom reveal arpeggio (C5 - E5 - G5 - C6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.085;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.115, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (idx === 3 ? 0.42 : 0.24));
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.46);
      });
    } catch {
      // Ignore
    }
  }

  public playTimerBell(muted: boolean): void {
    if (muted || this.disposed) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, idx) => {
        const start = now + idx * 0.14;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.11, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // A05 — VỊT ĐUA (Start whistle + single duck quack, gentle water loop, finish)
  // --------------------------------------------------------------------------
  public playDuckStartSignal(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // 1. Short bright aquatic start signal
      [587.33, 880.0].forEach((freq, idx) => {
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.11 : 0.08, now + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.35);
      });

      // 2. ONE subtle playful duck quack accent right after whistle (never per-duck stacked)
      const qStart = now + 0.16;
      const qOsc = this.trackNode(ctx.createOscillator());
      const qFilter = ctx.createBiquadFilter();
      const qGain = ctx.createGain();
      qOsc.type = 'sawtooth';
      qOsc.frequency.setValueAtTime(340, qStart);
      qOsc.frequency.exponentialRampToValueAtTime(245, qStart + 0.13);
      qFilter.type = 'bandpass';
      qFilter.frequency.setValueAtTime(1180, qStart);
      qFilter.frequency.exponentialRampToValueAtTime(720, qStart + 0.13);
      qFilter.Q.setValueAtTime(3.2, qStart);
      qGain.gain.setValueAtTime(0.001, qStart);
      qGain.gain.linearRampToValueAtTime(0.075, qStart + 0.02);
      qGain.gain.exponentialRampToValueAtTime(0.001, qStart + 0.15);
      qOsc.connect(qFilter);
      qFilter.connect(qGain);
      qGain.connect(out);
      qOsc.start(qStart);
      qOsc.stop(qStart + 0.17);
    } catch {
      // Ignore
    }
  }

  public startWaterSwimLoop(muted: boolean, turnToken?: string): void {
    this.stopWaterSwimLoop();
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g || !this.noiseBuffer) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      const src = this.trackNode(ctx.createBufferSource());
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(620, now);
      filter.Q.setValueAtTime(1.15, now);

      // Soft wave modulation so water sounds natural and gentle
      const lfo = this.trackNode(ctx.createOscillator());
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(2.6, now);
      lfoGain.gain.setValueAtTime(210, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.25);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      src.start(now);
      lfo.start(now);

      this.waterSource = src;
      this.waterGain = gain;
      this.waterLfo = lfo;
      this.waterLfoGain = lfoGain;
    } catch {
      // Ignore
    }
  }

  public stopWaterSwimLoop(): void {
    if (this.waterGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.waterGain.gain.cancelScheduledValues(now);
        this.waterGain.gain.setTargetAtTime(0.0001, now, 0.04);
      } catch {
        // Ignore
      }
    }
    const stopAt = this.ctx ? this.ctx.currentTime + 0.08 : 0;
    if (this.waterSource) {
      try {
        this.waterSource.stop(stopAt);
      } catch {
        // Ignore
      }
      this.activeNodes.delete(this.waterSource);
      this.waterSource = null;
    }
    if (this.waterLfo) {
      try {
        this.waterLfo.stop(stopAt);
      } catch {
        // Ignore
      }
      this.activeNodes.delete(this.waterLfo);
      this.waterLfo = null;
    }
    if (this.waterLfoGain) {
      try {
        this.waterLfoGain.disconnect();
      } catch {
        // Ignore
      }
      this.waterLfoGain = null;
    }
    this.waterGain = null;
  }

  public playDuckFinishFanfare(muted: boolean, turnToken?: string): void {
    this.stopWaterSwimLoop();
    this.playRevealChime(muted, turnToken);
  }

  // --------------------------------------------------------------------------
  // A06 — ĐUA NGỰA (Start bell, single shared rhythmic hoofbeat layer, finish)
  // --------------------------------------------------------------------------
  public playHorseStartBell(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const partials = [880, 1320, 1760];
      partials.forEach((freq, idx) => {
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.12 : 0.045, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.48);
      });
    } catch {
      // Ignore
    }
  }

  private playSingleGallopBeat(intensity: number): void {
    const g = this.ensureGraph();
    if (!g || !this.noiseBuffer) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // 3-beat gallop cadence ("clop-clop-clop") on ONE shared layer (no multi-horse stacking)
      const offsets = [0, 0.072, 0.145];
      const freqs = [210, 275, 235];
      offsets.forEach((offset, idx) => {
        const src = this.trackNode(ctx.createBufferSource());
        src.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freqs[idx], now + offset);
        filter.Q.setValueAtTime(2.8, now + offset);

        const gain = ctx.createGain();
        const peak = Math.min(0.072, (idx === 0 ? 0.055 : 0.044) * intensity);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(peak, now + offset + 0.009);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.058);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        src.start(now + offset);
        src.stop(now + offset + 0.068);
      });
    } catch {
      // Ignore
    }
  }

  public startHoofbeatLoop(getIsMuted: () => boolean, turnToken?: string): void {
    this.stopHoofbeatLoop();
    if (getIsMuted() || !this.isTurnValid(turnToken)) return;
    this.ensureGraph();
    this.hoofMutedCheck = getIsMuted;
    this.hoofProgress = 0;
    this.hoofStepIndex = 0;

    const scheduleNext = () => {
      if (this.disposed || !this.hoofMutedCheck || !this.isTurnValid(turnToken)) {
        this.stopHoofbeatLoop();
        return;
      }
      if (this.hoofMutedCheck()) {
        this.stopHoofbeatLoop();
        return;
      }
      const intensity = 0.85 + Math.min(1, this.hoofProgress) * 0.25;
      this.playSingleGallopBeat(intensity);
      this.hoofStepIndex++;
      // Slightly faster cadence during final sprint (310ms -> 245ms)
      const nextDelayMs = Math.round(310 - Math.min(1, this.hoofProgress) * 65);
      this.hoofTimer = window.setTimeout(scheduleNext, nextDelayMs);
    };

    scheduleNext();
  }

  public updateHoofbeatProgress(progressU: number): void {
    this.hoofProgress = Math.max(0, Math.min(1, progressU));
  }

  public stopHoofbeatLoop(): void {
    if (this.hoofTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.hoofTimer);
      this.hoofTimer = null;
    }
    this.hoofMutedCheck = null;
  }

  public playHorseFinishFanfare(muted: boolean, turnToken?: string): void {
    this.stopHoofbeatLoop();
    this.playRevealChime(muted, turnToken);
  }

  // --------------------------------------------------------------------------
  // A08 — BÓNG BAY MAY MẮN (Soft float/spotlight tick, inflate, balanced pop)
  // --------------------------------------------------------------------------
  public playBalloonMoveTick(muted: boolean, step = 0, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      const base = 520 + (step % 6) * 55;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.25, now + 0.045);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Ignore
    }
  }

  public playBalloonInflate(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.24);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch {
      // Ignore
    }
  }

  public playBalloonPop(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g || !this.noiseBuffer) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // Short crisp pop — intentionally projector-balanced (never startlingly loud!)
      const src = this.trackNode(ctx.createBufferSource());
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(980, now);
      filter.Q.setValueAtTime(1.4, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.115, now + 0.006);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(out);
      src.start(now);
      src.stop(now + 0.1);

      // Soft bubble pitch drop
      const osc = this.trackNode(ctx.createOscillator());
      const oGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.07);
      oGain.gain.setValueAtTime(0.085, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(oGain);
      oGain.connect(out);
      osc.start(now);
      osc.stop(now + 0.085);
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // A09 — XÚC XẮC CHỌN TÊN (Rolling rattle + felt/wood table bounce)
  // --------------------------------------------------------------------------
  public playDiceRollTick(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const startFreq = 420 + Math.random() * 220;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 1.45, now + 0.03);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Ignore
    }
  }

  public playDiceTableBounce(muted: boolean, intensity = 1, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const clamped = Math.max(0.25, Math.min(1, intensity));

      // Balanced wooden-table impact thud + crisp acrylic tap
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(210 * clamped + 95, now);
      osc.frequency.exponentialRampToValueAtTime(64, now + 0.075);
      gain.gain.setValueAtTime(0.115 * clamped, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.09);

      if (this.noiseBuffer) {
        const src = this.trackNode(ctx.createBufferSource());
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(900, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.045 * clamped, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
        src.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        src.start(now);
        src.stop(now + 0.04);
      }
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // A10 — THẺ BÀI BÍ MẬT (Card shuffle riffle + card flip swoosh + soft error)
  // --------------------------------------------------------------------------
  public playCardShuffle(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g || !this.noiseBuffer) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // 4 quick crisp card riffle flicks
      for (let i = 0; i < 4; i++) {
        const start = now + i * 0.055;
        const src = this.trackNode(ctx.createBufferSource());
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400 + i * 160, start);
        filter.Q.setValueAtTime(2.0, start);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.075, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        src.start(start);
        src.stop(start + 0.052);
      }
    } catch {
      // Ignore
    }
  }

  public playCardFlip(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // Crisp paper/card flip swoosh
      if (this.noiseBuffer) {
        const src = this.trackNode(ctx.createBufferSource());
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(850, now);
        filter.frequency.exponentialRampToValueAtTime(2100, now + 0.12);
        filter.Q.setValueAtTime(1.8, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        src.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        src.start(now);
        src.stop(now + 0.16);
      }

      // Soft melodic flip snap
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.11);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignore
    }
  }

  public playSoftError(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.linearRampToValueAtTime(175, now + 0.22);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // A11 — BÁNH XE SỐ (Crisp peg click while rotating)
  // --------------------------------------------------------------------------
  public playWheelPegTick(muted: boolean, velocityFactor = 0.6, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const v = Math.max(0.15, Math.min(1, velocityFactor));
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640 + Math.round(v * 320), now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.036);
      gain.gain.setValueAtTime(0.055 + v * 0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // A12 — ROBOT CHỌN BẠN (Boot chime, radar scan pulse, target found)
  // --------------------------------------------------------------------------
  public playRobotBoot(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [330, 440, 660].forEach((freq, idx) => {
        const start = now + idx * 0.075;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.085, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch {
      // Ignore
    }
  }

  public playRobotScanPulse(stepIndex: number, muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      const freq = 520 + (stepIndex % 5) * 80;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.055);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.075);
    } catch {
      // Ignore
    }
  }

  public playRobotTargetFound(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [659.25, 880, 1174.66].forEach((freq, idx) => {
        const start = now + idx * 0.065;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.105, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // D03 — KÉO CO KIẾN THỨC 3D
  // (Referee start whistle, taut rope pull creak + footsteps loop, neutral tie cue,
  //  balanced victory fanfare & draw chime)
  // --------------------------------------------------------------------------
  public playTugWhistle(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // Crisp two-partial referee whistle with gentle pea-trill modulation
      const osc = this.trackNode(ctx.createOscillator());
      const lfo = this.trackNode(ctx.createOscillator());
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2180, now);
      osc.frequency.linearRampToValueAtTime(2360, now + 0.06);
      osc.frequency.setValueAtTime(2320, now + 0.24);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(34, now);
      lfoGain.gain.setValueAtTime(55, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.088, now + 0.025);
      gain.gain.setValueAtTime(0.082, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + 0.32);
      lfo.stop(now + 0.32);
    } catch {
      // Ignore
    }
  }

  private playSingleTugPullStrain(step: number): void {
    const g = this.ensureGraph();
    if (!g || !this.noiseBuffer) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // 1. Hemp rope tension creak (warm low-mid filtered noise burst)
      const ropeSrc = this.trackNode(ctx.createBufferSource());
      ropeSrc.buffer = this.noiseBuffer;
      const ropeFilter = ctx.createBiquadFilter();
      ropeFilter.type = 'bandpass';
      ropeFilter.frequency.setValueAtTime(420 + (step % 3) * 55, now);
      ropeFilter.frequency.linearRampToValueAtTime(610 + (step % 2) * 60, now + 0.14);
      ropeFilter.Q.setValueAtTime(4.2, now);
      const ropeGain = ctx.createGain();
      ropeGain.gain.setValueAtTime(0.001, now);
      ropeGain.gain.linearRampToValueAtTime(0.065, now + 0.025);
      ropeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      ropeSrc.connect(ropeFilter);
      ropeFilter.connect(ropeGain);
      ropeGain.connect(out);
      ropeSrc.start(now);
      ropeSrc.stop(now + 0.17);

      // 2. Light alternating turf footstep thud
      const stepOsc = this.trackNode(ctx.createOscillator());
      const stepGain = ctx.createGain();
      stepOsc.type = 'sine';
      const footStart = now + 0.055;
      stepOsc.frequency.setValueAtTime(step % 2 === 0 ? 132 : 118, footStart);
      stepOsc.frequency.exponentialRampToValueAtTime(56, footStart + 0.075);
      stepGain.gain.setValueAtTime(0.001, footStart);
      stepGain.gain.linearRampToValueAtTime(0.075, footStart + 0.01);
      stepGain.gain.exponentialRampToValueAtTime(0.001, footStart + 0.085);
      stepOsc.connect(stepGain);
      stepGain.connect(out);
      stepOsc.start(footStart);
      stepOsc.stop(footStart + 0.095);
    } catch {
      // Ignore
    }
  }

  public startTugPullLoop(getIsMuted: () => boolean, turnToken?: string): void {
    this.stopTugPullLoop();
    if (getIsMuted() || !this.isTurnValid(turnToken)) return;
    this.ensureGraph();
    this.tugPullMutedCheck = getIsMuted;
    this.tugPullStep = 0;

    const scheduleNext = () => {
      if (this.disposed || !this.tugPullMutedCheck || !this.isTurnValid(turnToken)) {
        this.stopTugPullLoop();
        return;
      }
      if (this.tugPullMutedCheck()) {
        this.stopTugPullLoop();
        return;
      }
      this.playSingleTugPullStrain(this.tugPullStep);
      this.tugPullStep++;
      if (typeof window !== 'undefined') {
        this.tugPullTimer = window.setTimeout(scheduleNext, 225);
      }
    };

    scheduleNext();
  }

  public stopTugPullLoop(): void {
    if (this.tugPullTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.tugPullTimer);
      this.tugPullTimer = null;
    }
    this.tugPullMutedCheck = null;
  }

  /**
   * Short neutral feedback cue when rope does not move (both right or both wrong).
   * Intentionally level-pitched so it never sounds like one team won the turn.
   */
  public playTugNeutralTick(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    this.stopTugPullLoop();
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [0, 0.11].forEach((offset) => {
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now + offset);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.072, now + offset + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.085);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now + offset);
        osc.stop(now + offset + 0.095);
      });
    } catch {
      // Ignore
    }
  }

  public playTugWinFanfare(muted: boolean, turnToken?: string): void {
    this.stopTugPullLoop();
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Warm stadium victory fanfare (C5 - E5 - G5 - C6), projector-balanced gain
      const notes = [
        { freq: 523.25, t: 0, dur: 0.16 },
        { freq: 659.25, t: 0.11, dur: 0.16 },
        { freq: 783.99, t: 0.22, dur: 0.18 },
        { freq: 1046.5, t: 0.34, dur: 0.52 },
      ];
      notes.forEach(({ freq, t, dur }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.105, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  public playTugDrawChime(muted: boolean, turnToken?: string): void {
    this.stopTugPullLoop();
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Balanced two-chord draw resolution (distinct from win fanfare)
      const chords = [
        { freqs: [392.0, 493.88], t: 0, dur: 0.24 },
        { freqs: [440.0, 523.25], t: 0.2, dur: 0.38 },
      ];
      chords.forEach(({ freqs, t, dur }) => {
        freqs.forEach((freq) => {
          const start = now + t;
          const osc = this.trackNode(ctx.createOscillator());
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(0.068, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
          osc.connect(gain);
          gain.connect(out);
          osc.start(start);
          osc.stop(start + dur + 0.04);
        });
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // D05 — TIẾP SỨC ĐỒNG ĐỘI 3D
  // (Short start whistle, single-layer light footsteps, ONE unified baton handoff
  //  signal regardless of team count, balanced podium summary fanfare)
  // --------------------------------------------------------------------------
  public playRelayWhistle(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const lfo = this.trackNode(ctx.createOscillator());
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2240, now);
      osc.frequency.linearRampToValueAtTime(2420, now + 0.05);
      osc.frequency.setValueAtTime(2380, now + 0.22);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(36, now);
      lfoGain.gain.setValueAtTime(48, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.082, now + 0.02);
      gain.gain.setValueAtTime(0.075, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + 0.3);
      lfo.stop(now + 0.3);
    } catch {
      // Ignore
    }
  }

  private playSingleRelayFootstep(step: number): void {
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // Crisp, light synthetic track footstep (single shared layer for all lanes)
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(step % 2 === 0 ? 155 : 138, now);
      osc.frequency.exponentialRampToValueAtTime(62, now + 0.055);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.062);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.07);

      if (this.noiseBuffer) {
        const src = this.trackNode(ctx.createBufferSource());
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100 + (step % 2) * 140, now);
        filter.Q.setValueAtTime(2.2, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.032, now + 0.006);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        src.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        src.start(now);
        src.stop(now + 0.052);
      }
    } catch {
      // Ignore
    }
  }

  public startRelayStepLoop(getIsMuted: () => boolean, turnToken?: string): void {
    this.stopRelayStepLoop();
    if (getIsMuted() || !this.isTurnValid(turnToken)) return;
    this.ensureGraph();
    this.relayStepMutedCheck = getIsMuted;
    this.relayStepIndex = 0;

    const scheduleNext = () => {
      if (this.disposed || !this.relayStepMutedCheck || !this.isTurnValid(turnToken)) {
        this.stopRelayStepLoop();
        return;
      }
      if (this.relayStepMutedCheck()) {
        this.stopRelayStepLoop();
        return;
      }
      this.playSingleRelayFootstep(this.relayStepIndex);
      this.relayStepIndex++;
      if (typeof window !== 'undefined') {
        this.relayStepTimer = window.setTimeout(scheduleNext, 165);
      }
    };

    scheduleNext();
  }

  public stopRelayStepLoop(): void {
    if (this.relayStepTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.relayStepTimer);
      this.relayStepTimer = null;
    }
    this.relayStepMutedCheck = null;
  }

  /**
   * ONE unified clean baton handoff cue for all simultaneous passing lanes
   * (prevents overlapping sound stacking across 2–6 teams).
   */
  public playRelayBatonPass(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [659.25, 987.77]; // E5 -> B5 clean handoff chime
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.065;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.09, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.2);
      });
    } catch {
      // Ignore
    }
  }

  public playRelayFinishFanfare(muted: boolean, turnToken?: string): void {
    this.stopRelayStepLoop();
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Bright stadium finish arpeggio (C5 - E5 - G5 - A5 - C6), projector-safe gain
      const notes = [
        { freq: 523.25, t: 0, dur: 0.14 },
        { freq: 659.25, t: 0.095, dur: 0.14 },
        { freq: 783.99, t: 0.19, dur: 0.15 },
        { freq: 880.0, t: 0.285, dur: 0.16 },
        { freq: 1046.5, t: 0.39, dur: 0.52 },
      ];
      notes.forEach(({ freq, t, dur }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.102, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // D04 — ĐUA XE TỐC ĐỘ 3D
  // (Starting lights countdown, single-layer light car engine motion,
  //  ONE unified Turbo boost cue when 1+ cars trigger Turbo, podium/tie fanfare)
  // --------------------------------------------------------------------------
  public playCarStartCountdown(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Crisp 3-2-1-GO starting gantry tones (F4 - F4 - F4 - C5)
      const beats = [
        { freq: 349.23, t: 0.0, dur: 0.12, peak: 0.075 },
        { freq: 349.23, t: 0.24, dur: 0.12, peak: 0.075 },
        { freq: 349.23, t: 0.48, dur: 0.12, peak: 0.075 },
        { freq: 698.46, t: 0.72, dur: 0.28, peak: 0.095 },
      ];
      beats.forEach(({ freq, t, dur, peak }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = t >= 0.7 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  public startCarEngineLoop(getIsMuted: () => boolean, turnToken?: string): void {
    this.stopCarEngineLoop();
    if (getIsMuted() || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.linearRampToValueAtTime(520, now + 0.65);
      filter.frequency.linearRampToValueAtTime(310, now + 1.35);
      filter.Q.setValueAtTime(1.6, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.048, now + 0.09);

      const osc = this.trackNode(ctx.createOscillator());
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(76, now);
      osc.frequency.linearRampToValueAtTime(132, now + 0.55);
      osc.frequency.linearRampToValueAtTime(98, now + 1.3);

      const subOsc = this.trackNode(ctx.createOscillator());
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(38, now);
      subOsc.frequency.linearRampToValueAtTime(66, now + 0.55);
      subOsc.frequency.linearRampToValueAtTime(49, now + 1.3);

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc.start(now);
      subOsc.start(now);

      this.carEngineOsc = osc;
      this.carEngineSubOsc = subOsc;
      this.carEngineGain = gain;
      this.carEngineMutedCheck = getIsMuted;

      // Safety watchdog: stop immediately if muted mid-run or turn becomes stale
      const checkAlive = () => {
        if (this.disposed || !this.carEngineMutedCheck || !this.isTurnValid(turnToken)) {
          this.stopCarEngineLoop();
          return;
        }
        if (this.carEngineMutedCheck()) {
          this.stopCarEngineLoop();
          return;
        }
        if (typeof window !== 'undefined') {
          this.carEngineWatchTimer = window.setTimeout(checkAlive, 90);
        }
      };
      if (typeof window !== 'undefined') {
        this.carEngineWatchTimer = window.setTimeout(checkAlive, 90);
      }
    } catch {
      this.stopCarEngineLoop();
    }
  }

  public stopCarEngineLoop(): void {
    if (this.carEngineWatchTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.carEngineWatchTimer);
      this.carEngineWatchTimer = null;
    }
    this.carEngineMutedCheck = null;

    const nodes = [this.carEngineOsc, this.carEngineSubOsc];
    this.carEngineOsc = null;
    this.carEngineSubOsc = null;

    if (this.carEngineGain) {
      try {
        if (this.ctx) {
          this.carEngineGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.carEngineGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        }
        this.carEngineGain.disconnect();
      } catch {
        // Ignore
      }
      this.carEngineGain = null;
    }

    nodes.forEach((node) => {
      if (!node) return;
      try {
        node.onended = null;
        node.stop(0);
      } catch {
        // Ignore
      }
      try {
        node.disconnect();
      } catch {
        // Ignore
      }
      this.activeNodes.delete(node);
    });
  }

  /**
   * ONE unified Turbo boost cue regardless of how many cars activate Turbo
   * on the same turn (prevents audio stacking on classroom speakers).
   */
  public playCarTurboBoost(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // Crisp electric-gold sweep riser
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.24);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.36);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.088, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.4);

      // Brief air-whoosh layer
      if (this.noiseBuffer) {
        const src = this.trackNode(ctx.createBufferSource());
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(700, now);
        bp.frequency.exponentialRampToValueAtTime(2400, now + 0.25);
        bp.Q.setValueAtTime(1.5, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.045, now + 0.03);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        src.connect(bp);
        bp.connect(nGain);
        nGain.connect(out);
        src.start(now);
        src.stop(now + 0.35);
      }
    } catch {
      // Ignore
    }
  }

  public playCarFinishFanfare(muted: boolean, isTie = false, turnToken?: string): void {
    this.stopCarEngineLoop();
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isTie
        ? [
            // Warm balanced cadence for tie ("Đồng hạng")
            { freq: 523.25, t: 0, dur: 0.16 },
            { freq: 659.25, t: 0.12, dur: 0.16 },
            { freq: 783.99, t: 0.24, dur: 0.44 },
          ]
        : [
            // Checkered-flag victory arpeggio
            { freq: 523.25, t: 0, dur: 0.12 },
            { freq: 659.25, t: 0.09, dur: 0.12 },
            { freq: 783.99, t: 0.18, dur: 0.14 },
            { freq: 1046.5, t: 0.28, dur: 0.48 },
          ];
      notes.forEach(({ freq, t, dur }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.098, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // ---- D07: THÁCH ĐẤU NHÓM 3D (Tournament Arena Classroom Cues) ----

  public playChallengeRoundOpen(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Crisp tournament round-opening chord (D major triad + soft bell overtone)
      const notes = [
        { freq: 293.66, t: 0, dur: 0.28, amp: 0.065, type: 'triangle' as OscillatorType },
        { freq: 440.0, t: 0.05, dur: 0.28, amp: 0.06, type: 'triangle' as OscillatorType },
        { freq: 587.33, t: 0.1, dur: 0.36, amp: 0.075, type: 'sine' as OscillatorType },
      ];
      notes.forEach(({ freq, t, dur, amp, type }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  public playChallengeQuestionLock(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Short decisive double-chime for locking answers / grading confirmation
      const notes = [
        { freq: 523.25, t: 0, dur: 0.09, amp: 0.06 },
        { freq: 659.25, t: 0.07, dur: 0.14, amp: 0.065 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Plays ONE unified matchup score reveal cue per round/question reveal,
   * avoiding overlapping cacophony when multiple pairs finish simultaneously.
   */
  public playChallengeScoreReveal(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 440.0, t: 0, dur: 0.12, amp: 0.06 },
        { freq: 554.37, t: 0.08, dur: 0.14, amp: 0.068 },
        { freq: 659.25, t: 0.16, dur: 0.24, amp: 0.075 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  public playChallengeTournamentFinish(
    muted: boolean,
    trophyAwarded: boolean,
    isTie = false,
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = !trophyAwarded
        ? [
            // Soft neutral closure for early-ended tournament (no trophy)
            { freq: 440.0, t: 0, dur: 0.16, amp: 0.055 },
            { freq: 392.0, t: 0.14, dur: 0.26, amp: 0.055 },
          ]
        : isTie
        ? [
            // Warm balanced cadence for shared-rank podium ("Đồng hạng")
            { freq: 523.25, t: 0, dur: 0.16, amp: 0.075 },
            { freq: 659.25, t: 0.12, dur: 0.16, amp: 0.08 },
            { freq: 783.99, t: 0.24, dur: 0.44, amp: 0.085 },
          ]
        : [
            // Tournament championship fanfare
            { freq: 523.25, t: 0, dur: 0.12, amp: 0.082 },
            { freq: 659.25, t: 0.09, dur: 0.12, amp: 0.086 },
            { freq: 783.99, t: 0.18, dur: 0.14, amp: 0.09 },
            { freq: 1046.5, t: 0.28, dur: 0.48, amp: 0.095 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = trophyAwarded ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // ---- E01: NHẢY THEO LỆNH 3D (Classroom Movement & Signal Cues) ----

  public playJumpPrepareCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.14);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignore
    }
  }

  /**
   * Single crisp execution signal ("THỰC HIỆN!") — clear on classroom speakers, never harsh.
   */
  public playJumpExecuteSignal(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 659.25, t: 0, dur: 0.11, amp: 0.08 },
        { freq: 987.77, t: 0.08, dur: 0.22, amp: 0.09 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  public playJumpSessionSummary(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.12, amp: 0.07 },
        { freq: 659.25, t: 0.09, dur: 0.12, amp: 0.075 },
        { freq: 783.99, t: 0.18, dur: 0.14, amp: 0.08 },
        { freq: 1046.5, t: 0.28, dur: 0.36, amp: 0.085 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // E02 — BẮT BÓNG KIẾN THỨC 3D (Bounce on open, catch swish, outcome, summary)
  // --------------------------------------------------------------------------
  public playBallBounceCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Two crisp basketball-on-hardwood bounces
      const bounces = [
        { t: 0, f0: 210, f1: 118, amp: 0.11, dur: 0.12 },
        { t: 0.14, f0: 245, f1: 138, amp: 0.085, dur: 0.1 },
      ];
      bounces.forEach(({ t, f0, f1, amp, dur }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f0, start);
        osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      // Ignore
    }
  }

  public playBallCatchWhoosh(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // Short airy swish through net using bandpass noise
      if (this.noiseBuffer) {
        const src = this.trackNode(ctx.createBufferSource());
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(700, now);
        filter.frequency.exponentialRampToValueAtTime(1950, now + 0.14);
        filter.Q.setValueAtTime(1.8, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.085, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        src.start(now);
        src.stop(now + 0.2);
      }

      // Soft rim tap at catch impact
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.19);
      gain.gain.setValueAtTime(0.001, now + 0.09);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.105);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + 0.09);
      osc.stop(now + 0.23);
    } catch {
      // Ignore
    }
  }

  public playBallOutcomeCue(isCorrect: boolean, muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isCorrect
        ? [
            { freq: 587.33, t: 0, dur: 0.12, amp: 0.08 },
            { freq: 880, t: 0.1, dur: 0.24, amp: 0.09 },
          ]
        : [
            { freq: 330, t: 0, dur: 0.13, amp: 0.065 },
            { freq: 261.63, t: 0.12, dur: 0.2, amp: 0.06 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = isCorrect ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  public playBallSessionSummary(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.12, amp: 0.075 },
        { freq: 659.25, t: 0.09, dur: 0.12, amp: 0.08 },
        { freq: 783.99, t: 0.18, dur: 0.14, amp: 0.085 },
        { freq: 1046.5, t: 0.28, dur: 0.34, amp: 0.09 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // ==========================================================================
  // E04: SIMON SAYS (SIMON BẢO) 3D — NEUTRAL SIGNAL & GENTLE FEEDBACK CUES
  // ==========================================================================

  /**
   * Plays ONE identical crisp neutral classroom cue on "Ra hiệu" for EVERY command type
   * so the start sound NEVER leaks whether the command requires Execute or Hold.
   */
  public playSimonSignalCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 587.33, t: 0, dur: 0.075, amp: 0.085 },
        { freq: 880, t: 0.065, dur: 0.11, amp: 0.09 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.025);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Gentle post-reveal feedback chime for E04 (never harsh or distracting on projectors).
   */
  public playSimonFeedbackCue(isPositive: boolean, muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isPositive
        ? [
            { freq: 523.25, t: 0, dur: 0.11, amp: 0.08 },
            { freq: 659.25, t: 0.085, dur: 0.12, amp: 0.085 },
            { freq: 783.99, t: 0.175, dur: 0.22, amp: 0.09 },
          ]
        : [
            { freq: 392.0, t: 0, dur: 0.12, amp: 0.07 },
            { freq: 329.63, t: 0.11, dur: 0.18, amp: 0.065 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = isPositive ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Short warm auditorium chord when an E04 session completes.
   */
  public playSimonSessionSummary(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.12, amp: 0.075 },
        { freq: 659.25, t: 0.09, dur: 0.12, amp: 0.08 },
        { freq: 783.99, t: 0.18, dur: 0.14, amp: 0.085 },
        { freq: 1046.5, t: 0.28, dur: 0.34, amp: 0.09 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // ==========================================================================
  // E05: SĂN SAO KIẾN THỨC 3D — STAR MAP & CONSTELLATION CUES
  // ==========================================================================

  /** Light crystalline chime when opening a star on the 3D/2D map. */
  public playStarSelectCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 659.25, t: 0, dur: 0.09, amp: 0.07 },
        { freq: 987.77, t: 0.055, dur: 0.14, amp: 0.075 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.025);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Unified golden chime when a star lights up.
   * Fires ONCE per star even if multiple teams answer correctly.
   */
  public playStarLitCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.12, amp: 0.08 },
        { freq: 659.25, t: 0.08, dur: 0.13, amp: 0.085 },
        { freq: 783.99, t: 0.16, dur: 0.15, amp: 0.09 },
        { freq: 1046.5, t: 0.25, dur: 0.28, amp: 0.09 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  /** Gentle neutral cue when solution is revealed without lighting the star. */
  public playStarMissCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 392.0, t: 0, dur: 0.12, amp: 0.065 },
        { freq: 329.63, t: 0.11, dur: 0.18, amp: 0.06 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  /** Radiant harmonic arpeggio when all stars in a constellation cluster light up. */
  public playConstellationCompleteCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.14, amp: 0.075 },
        { freq: 659.25, t: 0.09, dur: 0.14, amp: 0.08 },
        { freq: 783.99, t: 0.18, dur: 0.16, amp: 0.085 },
        { freq: 987.77, t: 0.27, dur: 0.18, amp: 0.085 },
        { freq: 1318.51, t: 0.37, dur: 0.38, amp: 0.09 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  /** Warm observatory chord when an E05 Star Hunt session completes. */
  public playStarSessionSummary(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.15, amp: 0.075 },
        { freq: 659.25, t: 0.1, dur: 0.15, amp: 0.08 },
        { freq: 783.99, t: 0.2, dur: 0.18, amp: 0.085 },
        { freq: 1046.5, t: 0.31, dur: 0.4, amp: 0.09 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // F01 — SUDOKU 3D (Ceramic tile click, brief conflict cue, completion chime)
  // --------------------------------------------------------------------------

  /** Crisp, light ceramic click when placing a number or toggling a candidate note. */
  public playSudokuPlaceTile(muted: boolean, isNote = false, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = isNote ? 'sine' : 'triangle';
      const baseFreq = isNote ? 740 : 540;
      const endFreq = isNote ? 880 : 680;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.055);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isNote ? 0.048 : 0.072, now + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.072);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.085);
    } catch {
      // Ignore
    }
  }

  /** Brief, clear low-mid two-tone signal when conflict check detects duplicate numbers. */
  public playSudokuConflictCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 330, t: 0, dur: 0.1, amp: 0.07 },
        { freq: 261.63, t: 0.105, dur: 0.16, amp: 0.075 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.025);
      });
    } catch {
      // Ignore
    }
  }

  /** Warm celebratory harmonic arpeggio when the Sudoku board is validly completed. */
  public playSudokuCompleteFanfare(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.14, amp: 0.075 },
        { freq: 659.25, t: 0.09, dur: 0.15, amp: 0.08 },
        { freq: 783.99, t: 0.18, dur: 0.16, amp: 0.085 },
        { freq: 1046.5, t: 0.28, dur: 0.34, amp: 0.095 },
        { freq: 1318.51, t: 0.39, dur: 0.44, amp: 0.085 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // F02 — TANGRAM 3D (Tactile piece placement/snap, overlap bump, completion)
  // --------------------------------------------------------------------------

  /** Soft tactile placement sound; slightly brighter harmonic chime when snapped to edge/vertex. */
  public playTangramPlacePiece(muted: boolean, snapped = false, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(snapped ? 587.33 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(snapped ? 880 : 523.25, now + 0.065);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(snapped ? 0.075 : 0.062, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore
    }
  }

  /** Brief soft muted bump when an overlapping placement is rejected and reverted. */
  public playTangramRejectCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(175, now + 0.14);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.155);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.17);
    } catch {
      // Ignore
    }
  }

  /** Warm celebratory completion arpeggio when all 7 Tangram pieces validly fill the target. */
  public playTangramCompleteFanfare(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.14, amp: 0.075 },
        { freq: 659.25, t: 0.09, dur: 0.15, amp: 0.08 },
        { freq: 783.99, t: 0.18, dur: 0.16, amp: 0.085 },
        { freq: 1046.5, t: 0.28, dur: 0.34, amp: 0.095 },
        { freq: 1318.51, t: 0.39, dur: 0.44, amp: 0.085 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // E03 — PHẢN XẠ NHANH 3D (Crisp Go signal, early bump, result & summary)
  // NOTE: Zero audio during waiting period so sound never hints signal timing.
  // --------------------------------------------------------------------------

  /** Instant crisp turquoise-signal cue played the moment BẤM! / TRẢ LỜI opens. */
  public playReflexGoCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [880, 1318.51].forEach((freq, idx) => {
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.11 : 0.065, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.16);
      });
    } catch {
      // Ignore
    }
  }

  /** Short non-harsh low double-tone for early press ("Bấm sớm") or timeout. */
  public playReflexEarlyCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [280, 210].forEach((freq, idx) => {
        const start = now + idx * 0.09;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.095, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.13);
      });
    } catch {
      // Ignore
    }
  }

  /** Clean confirmation chime when a valid reaction or Math result is revealed. */
  public playReflexResultCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [587.33, 880].forEach((freq, idx) => {
        const start = now + idx * 0.07;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.085, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // Ignore
    }
  }

  /** Warm celebratory chord for E03 session summary screen. */
  public playReflexSummaryFanfare(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.15, amp: 0.08 },
        { freq: 659.25, t: 0.09, dur: 0.16, amp: 0.085 },
        { freq: 783.99, t: 0.18, dur: 0.18, amp: 0.09 },
        { freq: 1046.5, t: 0.28, dur: 0.38, amp: 0.095 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // F03 — THÁP HÀ NỘI 3D (Wood disc lift, gentle placement, reject & fanfare)
  // --------------------------------------------------------------------------

  /** Light wooden upward pluck when lifting/selecting the top disc. */
  public playHanoiLiftDisc(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.065);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore
    }
  }

  /** Soft wooden click/placement pitched gently by disc size (1=highest, 8=warmest). */
  public playHanoiPlaceDisc(muted: boolean, discNumber: number = 1, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const safeDisc = Math.max(1, Math.min(8, discNumber));
      const baseFreq = 540 - (safeDisc - 1) * 38;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq * 1.15, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.78, now + 0.09);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.095, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Ignore
    }
  }

  /** Soft low double-knock when placing a larger disc onto a smaller disc is rejected. */
  public playHanoiInvalidMove(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [230, 185].forEach((freq, idx) => {
        const start = now + idx * 0.075;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.11);
      });
    } catch {
      // Ignore
    }
  }

  /** Warm celebratory chord fired ONCE when all discs are validly stacked on peg C. */
  public playHanoiCompleteFanfare(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.16, amp: 0.08 },
        { freq: 659.25, t: 0.09, dur: 0.17, amp: 0.085 },
        { freq: 783.99, t: 0.18, dur: 0.19, amp: 0.09 },
        { freq: 1046.5, t: 0.28, dur: 0.36, amp: 0.095 },
        { freq: 1318.51, t: 0.4, dur: 0.44, amp: 0.085 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // D06 — VUA GHI ĐIỂM 3D
  // (Light tile open chime, ONE unified score-award signal even when multiple
  //  teams score together, and balanced summary fanfare)
  // --------------------------------------------------------------------------

  /** Light crisp tile-open chime when a point tile is selected on the board. */
  public playKingTileOpen(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.1 },
        { freq: 783.99, t: 0.055, dur: 0.14 },
      ];
      notes.forEach(({ freq, t, dur }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.078, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * ONE unified scoring signal fired when 1 or more teams earn points on a tile.
   * Intentionally single-shot so multiple scoring teams never stack audio.
   */
  public playKingScoreAward(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 587.33, t: 0, dur: 0.14, amp: 0.082 },
        { freq: 880.0, t: 0.075, dur: 0.18, amp: 0.09 },
        { freq: 1174.66, t: 0.15, dur: 0.28, amp: 0.088 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  /** Balanced championship summary fanfare when match finishes. */
  public playKingSummaryFanfare(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.16, amp: 0.08 },
        { freq: 659.25, t: 0.095, dur: 0.16, amp: 0.085 },
        { freq: 783.99, t: 0.19, dur: 0.2, amp: 0.09 },
        { freq: 1046.5, t: 0.3, dur: 0.42, amp: 0.095 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // F04 — MÊ CUNG TRÍ TUỆ 3D
  // (Rate-limited soft step cue so sequence playback never stacks harshly,
  //  gentle blocked-wall bump cue, and warm goal-reached chime)
  // --------------------------------------------------------------------------
  private lastMazeStepMs = 0;

  /** Soft robot step tap with >= 115ms spacing so rapid sequence runs never sound harsh. */
  public playMazeStep(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const nowMs = Date.now();
    if (nowMs - this.lastMazeStepMs < 115) return;
    this.lastMazeStepMs = nowMs;

    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.048);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.075);
    } catch {
      // Ignore
    }
  }

  /** Gentle low bump cue when robot encounters a wall or maze boundary. */
  public playMazeWallBump(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.exponentialRampToValueAtTime(115, now + 0.13);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.088, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Ignore
    }
  }

  /** Warm celebratory chime played ONCE when robot enters the goal portal E. */
  public playMazeGoalFanfare(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.15, amp: 0.078 },
        { freq: 659.25, t: 0.085, dur: 0.16, amp: 0.084 },
        { freq: 783.99, t: 0.17, dur: 0.18, amp: 0.088 },
        { freq: 1046.5, t: 0.27, dur: 0.38, amp: 0.094 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.035);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // F05 — GIẢI MẬT MÃ 3D
  // (Soft keypad tap, submit latch signal, and mechanical vault-unlock chord)
  // --------------------------------------------------------------------------
  private lastCipherKeyMs = 0;

  /** Soft mechanical keypad click (rate-limited >= 55ms so fast typing stays crisp). */
  public playCipherKeyTap(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const nowMs = Date.now();
    if (nowMs - this.lastCipherKeyMs < 55) return;
    this.lastCipherKeyMs = nowMs;

    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.032);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.048, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Ignore
    }
  }

  /** Lock-check signal on code submission (distinct muted latch thud when wrong, crisp confirm ping when matched). */
  public playCipherSubmit(muted: boolean, matched: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      if (matched) {
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.065);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.075, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.21);
      } else {
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(125, now + 0.16);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.088, now + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {
      // Ignore
    }
  }

  /** Mechanical bolt click followed by a warm golden vault-unlock harmonic chord. */
  public playCipherVaultOpen(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;

      // Mechanical bolt slide click (2 quick metallic ticks)
      [0, 0.085].forEach((offset, idx) => {
        const start = now + offset;
        const clickOsc = this.trackNode(ctx.createOscillator());
        const clickGain = ctx.createGain();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(idx === 0 ? 310 : 440, start);
        clickOsc.frequency.exponentialRampToValueAtTime(160, start + 0.045);
        clickGain.gain.setValueAtTime(0.001, start);
        clickGain.gain.linearRampToValueAtTime(0.055, start + 0.006);
        clickGain.gain.exponentialRampToValueAtTime(0.001, start + 0.055);
        clickOsc.connect(clickGain);
        clickGain.connect(out);
        clickOsc.start(start);
        clickOsc.stop(start + 0.065);
      });

      // Warm golden arpeggio chord
      const notes = [
        { freq: 523.25, t: 0.16, dur: 0.18, amp: 0.075 },
        { freq: 659.25, t: 0.24, dur: 0.2, amp: 0.082 },
        { freq: 783.99, t: 0.32, dur: 0.22, amp: 0.086 },
        { freq: 1046.5, t: 0.42, dur: 0.42, amp: 0.092 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // D08 — ĐẤU TRƯỜNG 4 ĐỘI 3D
  // (Open question chime, Double-Power lock, SINGLE shared score award to prevent stacking,
  //  and podium summary fanfare)
  // --------------------------------------------------------------------------

  /** Crisp broadcast chime when teacher opens a question. */
  public playArenaOpenQuestion(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.14, amp: 0.068 },
        { freq: 783.99, t: 0.09, dur: 0.22, amp: 0.075 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  /** Distinct lock-in sound when a team activates Double Power (×2) before opening. */
  public playArenaDoubleLock(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.078, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Ignore
    }
  }

  /** SINGLE shared score-award fanfare even when multiple teams score simultaneously (zero stacking). */
  public playArenaScoreAward(
    muted: boolean,
    hasDoubleWinner: boolean,
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = hasDoubleWinner
        ? [
            { freq: 523.25, t: 0, dur: 0.14, amp: 0.072 },
            { freq: 659.25, t: 0.075, dur: 0.15, amp: 0.078 },
            { freq: 783.99, t: 0.15, dur: 0.16, amp: 0.084 },
            { freq: 1046.5, t: 0.23, dur: 0.34, amp: 0.09 },
          ]
        : [
            { freq: 587.33, t: 0, dur: 0.14, amp: 0.07 },
            { freq: 739.99, t: 0.08, dur: 0.15, amp: 0.075 },
            { freq: 880, t: 0.16, dur: 0.28, amp: 0.082 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.035);
      });
    } catch {
      // Ignore
    }
  }

  /** Warm celebratory fanfare on match summary screen. */
  public playArenaSummaryFanfare(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.16, amp: 0.074 },
        { freq: 659.25, t: 0.1, dur: 0.18, amp: 0.08 },
        { freq: 783.99, t: 0.2, dur: 0.2, amp: 0.086 },
        { freq: 1046.5, t: 0.31, dur: 0.44, amp: 0.092 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // D01 — ĐẤU TRƯỜNG 1 ĐẤU 1 3D ("SONG ĐẤU TRI THỨC")
  // (Match start, Buzzer claim A/B, Answer lock, Neutral/Uplifting outcome, Match finish)
  // --------------------------------------------------------------------------

  public playDuelMatchStart(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 440, t: 0, dur: 0.14, amp: 0.068 },
        { freq: 554.37, t: 0.09, dur: 0.14, amp: 0.072 },
        { freq: 659.25, t: 0.18, dur: 0.24, amp: 0.08 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  public playDuelBuzzerClaim(muted: boolean, side: 'A' | 'B', turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const baseFreq = side === 'A' ? 587.33 : 659.25;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.12);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.082, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignore
    }
  }

  public playDuelAnswerLock(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(392.0, now + 0.07);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.068, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Ignore
    }
  }

  /** Warm positive chime when correct; calm non-mocking neutral marimba note when incorrect. */
  public playDuelOutcomeTone(muted: boolean, anyCorrect: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = anyCorrect
        ? [
            { freq: 523.25, t: 0, dur: 0.14, amp: 0.072 },
            { freq: 659.25, t: 0.08, dur: 0.15, amp: 0.076 },
            { freq: 783.99, t: 0.16, dur: 0.26, amp: 0.084 },
          ]
        : [
            { freq: 392.0, t: 0, dur: 0.12, amp: 0.055 },
            { freq: 349.23, t: 0.1, dur: 0.18, amp: 0.05 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = anyCorrect ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  public playDuelFinishFanfare(muted: boolean, isTie: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isTie
        ? [
            { freq: 523.25, t: 0, dur: 0.16, amp: 0.07 },
            { freq: 659.25, t: 0.11, dur: 0.18, amp: 0.074 },
            { freq: 783.99, t: 0.22, dur: 0.34, amp: 0.078 },
          ]
        : [
            { freq: 523.25, t: 0, dur: 0.15, amp: 0.074 },
            { freq: 659.25, t: 0.09, dur: 0.16, amp: 0.08 },
            { freq: 783.99, t: 0.18, dur: 0.18, amp: 0.084 },
            { freq: 1046.5, t: 0.29, dur: 0.44, amp: 0.092 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // D02 — ĐUA THUYỀN 3D ("ĐƯỜNG ĐUA TRI THỨC")
  // (Regatta start horn, Water oar splash + advance chime, Stop whistle, Finish fanfare)
  // --------------------------------------------------------------------------

  public playBoatStartHorn(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [392.0, 523.25].forEach((freq, i) => {
        const start = now + i * 0.1;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.075, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // Ignore
    }
  }

  public playBoatRowSplash(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Gentle filtered water wake swoosh
      if (this.noiseBuffer) {
        const src = this.trackNode(ctx.createBufferSource());
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(700, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 0.22);
        filter.Q.setValueAtTime(1.8, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.052, now + 0.04);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        src.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        src.start(now);
        src.stop(now + 0.3);
      }
      // Crisp water-drop advance arpeggio
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const start = now + 0.04 + idx * 0.07;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.068, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch {
      // Ignore
    }
  }

  public playBoatStopWhistle(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(740, now + 0.14);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.064, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignore
    }
  }

  public playBoatFinishFanfare(muted: boolean, isCoWin: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isCoWin
        ? [
            { freq: 523.25, t: 0, dur: 0.15, amp: 0.074 },
            { freq: 659.25, t: 0.09, dur: 0.16, amp: 0.078 },
            { freq: 783.99, t: 0.18, dur: 0.2, amp: 0.082 },
            { freq: 987.77, t: 0.28, dur: 0.36, amp: 0.088 },
          ]
        : [
            { freq: 523.25, t: 0, dur: 0.14, amp: 0.074 },
            { freq: 659.25, t: 0.08, dur: 0.15, amp: 0.08 },
            { freq: 783.99, t: 0.16, dur: 0.18, amp: 0.084 },
            { freq: 1046.5, t: 0.26, dur: 0.42, amp: 0.092 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // --------------------------------------------------------------------------
  // C10 — GIẢI CỨU ĐẠI DƯƠNG 3D ("HẢI TRÌNH XANH – PHỤC HỒI ĐẠI DƯƠNG")
  // (Gentle water pulse, mission select, lock answer, result cue, zone complete, summary)
  // --------------------------------------------------------------------------

  public playOceanWaterPulse(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g || !this.noiseBuffer) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const src = this.trackNode(ctx.createBufferSource());
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.linearRampToValueAtTime(640, now + 0.45);
      filter.frequency.linearRampToValueAtTime(340, now + 0.9);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.024, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      src.start(now);
      src.stop(now + 1.0);
    } catch {
      // Ignore
    }
  }

  public playOceanSelectMission(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.11);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.062, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.17);
    } catch {
      // Ignore
    }
  }

  public playOceanLockAnswer(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [523.25, 659.25].forEach((freq, idx) => {
        const start = now + idx * 0.055;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.06, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.14);
      });
    } catch {
      // Ignore
    }
  }

  public playOceanResultCue(muted: boolean, isCorrect: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isCorrect
        ? [
            { freq: 523.25, t: 0, dur: 0.13, amp: 0.068 },
            { freq: 659.25, t: 0.08, dur: 0.14, amp: 0.072 },
            { freq: 783.99, t: 0.16, dur: 0.24, amp: 0.078 },
          ]
        : [
            // Gentle neutral-warm cue (never harsh or punitive)
            { freq: 392.0, t: 0, dur: 0.14, amp: 0.056 },
            { freq: 349.23, t: 0.12, dur: 0.22, amp: 0.052 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = isCorrect ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  public playOceanZoneComplete(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      [440.0, 554.37, 659.25, 880.0].forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.074, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.31);
      });
    } catch {
      // Ignore
    }
  }

  public playOceanVoyageSummary(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.14, amp: 0.072 },
        { freq: 659.25, t: 0.09, dur: 0.14, amp: 0.076 },
        { freq: 783.99, t: 0.18, dur: 0.16, amp: 0.08 },
        { freq: 1046.5, t: 0.28, dur: 0.48, amp: 0.088 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch {
      // Ignore
    }
  }

  // ---- B10: Câu hỏi chớp nhoáng 3D ----
  public playLightningStartCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.09, amp: 0.062 },
        { freq: 659.25, t: 0.065, dur: 0.09, amp: 0.066 },
        { freq: 987.77, t: 0.13, dur: 0.16, amp: 0.07 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playLightningTickWarn(muted: boolean, urgent = false, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(urgent ? 880 : 680, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(urgent ? 0.055 : 0.04, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playLightningLockCue(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.06);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playLightningResultCue(
    muted: boolean,
    outcome: 'correct' | 'wrong' | 'skipped' | 'timeout',
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes =
        outcome === 'correct'
          ? [
              { freq: 587.33, t: 0, dur: 0.11, amp: 0.068 },
              { freq: 739.99, t: 0.07, dur: 0.12, amp: 0.072 },
              { freq: 880.0, t: 0.14, dur: 0.22, amp: 0.076 },
            ]
          : outcome === 'timeout'
            ? [
                { freq: 440.0, t: 0, dur: 0.14, amp: 0.052 },
                { freq: 349.23, t: 0.11, dur: 0.2, amp: 0.048 },
              ]
            : [
                { freq: 392.0, t: 0, dur: 0.12, amp: 0.05 },
                { freq: 329.63, t: 0.09, dur: 0.18, amp: 0.045 },
              ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = outcome === 'correct' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.025);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playLightningSummaryFanfare(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.13, amp: 0.07 },
        { freq: 659.25, t: 0.08, dur: 0.13, amp: 0.074 },
        { freq: 783.99, t: 0.16, dur: 0.15, amp: 0.078 },
        { freq: 1046.5, t: 0.25, dur: 0.42, amp: 0.084 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  // ---- C06: Truy tìm kho báu 3D ----
  public playTreasureMapRustle(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g || !this.noiseBuffer) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const src = this.trackNode(ctx.createBufferSource());
      src.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1650, now);
      filter.frequency.exponentialRampToValueAtTime(920, now + 0.16);
      filter.Q.setValueAtTime(1.4, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      src.start(now);
      src.stop(now + 0.2);
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playTreasureAnswerCue(
    muted: boolean,
    isCorrect: boolean,
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isCorrect
        ? [
            { freq: 523.25, t: 0, dur: 0.11, amp: 0.065 },
            { freq: 659.25, t: 0.07, dur: 0.12, amp: 0.07 },
            { freq: 783.99, t: 0.14, dur: 0.2, amp: 0.074 },
          ]
        : [
            { freq: 392.0, t: 0, dur: 0.13, amp: 0.05 },
            { freq: 329.63, t: 0.1, dur: 0.18, amp: 0.045 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = isCorrect ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.025);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playTreasureShardCollect(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 659.25, t: 0, dur: 0.13, amp: 0.064 },
        { freq: 880.0, t: 0.07, dur: 0.15, amp: 0.07 },
        { freq: 1174.66, t: 0.15, dur: 0.28, amp: 0.074 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playTreasureChestOpen(
    muted: boolean,
    isSuccess = true,
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      // Brass latch click + golden chest fanfare
      const notes = isSuccess
        ? [
            { freq: 392.0, t: 0, dur: 0.1, amp: 0.062 },
            { freq: 523.25, t: 0.08, dur: 0.12, amp: 0.068 },
            { freq: 659.25, t: 0.16, dur: 0.14, amp: 0.072 },
            { freq: 783.99, t: 0.24, dur: 0.18, amp: 0.076 },
            { freq: 1046.5, t: 0.34, dur: 0.45, amp: 0.084 },
          ]
        : [
            { freq: 392.0, t: 0, dur: 0.14, amp: 0.055 },
            { freq: 349.23, t: 0.12, dur: 0.24, amp: 0.05 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.035);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  // ---- C07: Giải cứu công chúa 3D ----
  public playPrincessEnterZone(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 440.0, t: 0, dur: 0.11, amp: 0.055 },
        { freq: 554.37, t: 0.08, dur: 0.14, amp: 0.06 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.025);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playPrincessKeyAwarded(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 587.33, t: 0, dur: 0.12, amp: 0.062 },
        { freq: 739.99, t: 0.07, dur: 0.14, amp: 0.066 },
        { freq: 880.0, t: 0.14, dur: 0.16, amp: 0.07 },
        { freq: 1174.66, t: 0.22, dur: 0.3, amp: 0.075 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playPrincessGateRescue(
    muted: boolean,
    isSuccess = true,
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isSuccess
        ? [
            { freq: 523.25, t: 0, dur: 0.11, amp: 0.065 },
            { freq: 659.25, t: 0.09, dur: 0.13, amp: 0.07 },
            { freq: 783.99, t: 0.18, dur: 0.15, amp: 0.074 },
            { freq: 1046.5, t: 0.28, dur: 0.24, amp: 0.078 },
            { freq: 1318.51, t: 0.4, dur: 0.46, amp: 0.082 },
          ]
        : [
            { freq: 392.0, t: 0, dur: 0.14, amp: 0.052 },
            { freq: 349.23, t: 0.12, dur: 0.22, amp: 0.048 },
          ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.035);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  // ---- C09: Bingo kiến thức 3D ----
  public playBingoOpenQuestion(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.1, amp: 0.055 },
        { freq: 659.25, t: 0.07, dur: 0.13, amp: 0.06 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.025);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playBingoMarkCell(
    muted: boolean,
    isValid = true,
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const osc = this.trackNode(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = isValid ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(isValid ? 784.0 : 280.0, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isValid ? 0.05 : 0.04, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playBingoVerifiedWin(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, t: 0, dur: 0.1, amp: 0.062 },
        { freq: 659.25, t: 0.08, dur: 0.12, amp: 0.066 },
        { freq: 783.99, t: 0.16, dur: 0.14, amp: 0.072 },
        { freq: 1046.5, t: 0.25, dur: 0.32, amp: 0.078 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playC03OpenQuestion(muted: boolean, turnToken?: string): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = [
        { freq: 440.0, t: 0, dur: 0.08, amp: 0.045 },
        { freq: 587.33, t: 0.07, dur: 0.14, amp: 0.052 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playC03LockAnswer(
    muted: boolean,
    isCorrect = true,
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const notes = isCorrect
        ? [
            { freq: 523.25, t: 0, dur: 0.08, amp: 0.05 },
            { freq: 659.25, t: 0.06, dur: 0.14, amp: 0.058 },
          ]
        : [{ freq: 246.94, t: 0, dur: 0.16, amp: 0.045 }];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = isCorrect ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }

  public playC03RoundTransition(
    muted: boolean,
    roundNumber: number,
    turnToken?: string
  ): void {
    if (muted || !this.isTurnValid(turnToken)) return;
    const g = this.ensureGraph();
    if (!g) return;
    try {
      const { ctx, out } = g;
      const now = ctx.currentTime;
      const base = roundNumber >= 3 ? 659.25 : roundNumber === 2 ? 587.33 : 523.25;
      const notes = [
        { freq: base, t: 0, dur: 0.09, amp: 0.052 },
        { freq: base * 1.25, t: 0.08, dur: 0.11, amp: 0.058 },
        { freq: base * 1.5, t: 0.16, dur: 0.24, amp: 0.064 },
      ];
      notes.forEach(({ freq, t, dur, amp }) => {
        const start = now + t;
        const osc = this.trackNode(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore audio errors cleanly
    }
  }
}

// ============================================================================
// STRICT VIETNAMESE VOICE ANNOUNCER (Wraps A01 VietnameseVoiceManager)
// - Guarantees at most ONE announcement per turnId
// - Never falls back to English
// - Cancels immediately on mute / skip / replay / unmount
// ============================================================================
export class EduGameVoiceController {
  private manager: VietnameseVoiceManager;
  private spokenTurnIds = new Set<string>();
  private disposed = false;

  constructor(preferredVoiceURI: string | null = null) {
    this.manager = new VietnameseVoiceManager(preferredVoiceURI, false);
  }

  public subscribe(listener: (snapshot: VoiceManagerSnapshot) => void): () => void {
    return this.manager.subscribe(listener);
  }

  public getSnapshot(): VoiceManagerSnapshot {
    return this.manager.getSnapshot();
  }

  public setPreferredVoiceURI(uri: string | null): void {
    this.manager.setPreferredVoiceURI(uri);
  }

  public stop(): void {
    this.manager.stop();
  }

  public resetTurnDedupe(): void {
    this.spokenTurnIds.clear();
  }

  /**
   * Speaks the Vietnamese student name announcement AT MOST ONCE for a given `turnId`.
   * Calls `onBeforeSpeak` (e.g. to stop background loops) before starting speech.
   * Never blocks UI or falls back to English.
   */
  public async announceStudentOnce(params: {
    turnId: string;
    studentName: string;
    customText?: string;
    isMuted: boolean;
    voiceEnabled: boolean;
    rate?: number;
    volume?: number;
    preferredVoiceURI?: string | null;
    onBeforeSpeak?: () => void;
  }): Promise<SpeakResult> {
    if (this.disposed) {
      return { spoken: false, reason: 'superseded' };
    }
    const cleanName = (params.studentName || '').trim();
    const text = (params.customText || (cleanName ? `Xin chúc mừng bạn ${cleanName}!` : '')).trim();
    if (!text) {
      return { spoken: false, reason: 'empty_text' };
    }
    if (params.isMuted || !params.voiceEnabled) {
      return { spoken: false, reason: 'disabled_or_muted' };
    }
    if (this.spokenTurnIds.has(params.turnId)) {
      return { spoken: false, reason: 'superseded' };
    }
    this.spokenTurnIds.add(params.turnId);
    params.onBeforeSpeak?.();

    return await this.manager.speakVietnamese(text, {
      isMuted: params.isMuted,
      voiceEnabled: params.voiceEnabled,
      rate: params.rate ?? 0.98,
      volume: params.volume ?? 0.95,
      preferredVoiceURI: params.preferredVoiceURI,
    });
  }

  /**
   * Explicit user-triggered replay (e.g. "Đọc lại tên" button).
   */
  public async replayText(params: {
    text: string;
    isMuted: boolean;
    voiceEnabled?: boolean;
    rate?: number;
    volume?: number;
    preferredVoiceURI?: string | null;
    onBeforeSpeak?: () => void;
  }): Promise<SpeakResult> {
    if (this.disposed) {
      return { spoken: false, reason: 'superseded' };
    }
    if (params.isMuted) {
      return { spoken: false, reason: 'disabled_or_muted' };
    }
    params.onBeforeSpeak?.();
    return await this.manager.speakVietnamese(params.text, {
      isMuted: params.isMuted,
      voiceEnabled: params.voiceEnabled ?? true,
      rate: params.rate ?? 0.98,
      volume: params.volume ?? 0.95,
      preferredVoiceURI: params.preferredVoiceURI,
    });
  }

  public dispose(): void {
    this.disposed = true;
    this.spokenTurnIds.clear();
    this.manager.dispose();
  }
}
