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
