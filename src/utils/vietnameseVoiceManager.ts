/**
 * VietnameseVoiceManager — Bộ quản lý giọng đọc tiếng Việt chuyên biệt cho Smart EDU (A01).
 *
 * Nguyên tắc bắt buộc:
 * 1. Chỉ sử dụng giọng đọc tiếng Việt hợp lệ (`vi`, `vi-VN`, `vi_VN`).
 * 2. Không bao giờ tự ý chuyển sang giọng tiếng Anh (`en-US`, `en-GB`, ...) hoặc ngôn ngữ khác.
 * 3. Chờ tải danh sách giọng bất đồng bộ thông qua `voiceschanged` (xử lý trình duyệt tải chậm).
 * 4. Ưu tiên giọng Việt chất lượng cao (Edge Natural/Online, Google tiếng Việt, Desktop vi-VN).
 * 5. Chống đọc chồng nhiều lần khi quay liên tiếp và bảo toàn cấu hình giáo viên trong localStorage.
 * 6. Hỗ trợ dịch vụ TTS dự phòng tùy chọn CHỈ khi triển khai đã cấu hình endpoint hợp lệ (không API key ở frontend).
 */

export type VoiceSupportStatus =
  | 'LOADING'
  | 'READY_VI'
  | 'FALLBACK_ENDPOINT'
  | 'UNAVAILABLE_NO_VI_VOICE'
  | 'UNSUPPORTED_BROWSER';

export interface VoiceLike {
  voiceURI: string;
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

export interface VietnameseVoiceOption<T extends VoiceLike = VoiceLike> {
  voice: T;
  voiceURI: string;
  name: string;
  lang: string;
  qualityScore: number;
  qualityTierLabel: string;
  localService: boolean;
}

export interface VietnameseVoiceSettings {
  voiceEnabled: boolean;
  preferredVoiceURI: string | null;
  rate: number; // 0.7 .. 1.4
  volume: number; // 0 .. 1
  useConfiguredFallbackEndpoint: boolean;
}

export interface SpeakResult {
  spoken: boolean;
  reason:
    | 'spoken_vi_webspeech'
    | 'spoken_fallback_endpoint'
    | 'disabled_or_muted'
    | 'empty_text'
    | 'unsupported_browser'
    | 'no_vietnamese_voice'
    | 'superseded'
    | 'playback_error';
  message?: string;
  selectedVoiceName?: string;
  selectedVoiceLang?: string;
}

export interface VoiceManagerSnapshot {
  status: VoiceSupportStatus;
  vietnameseVoices: VietnameseVoiceOption<SpeechSynthesisVoice>[];
  selectedVoice: VietnameseVoiceOption<SpeechSynthesisVoice> | null;
  allVoiceCount: number;
  hasVietnameseVoice: boolean;
  fallbackServiceConfigured: boolean;
  statusMessage: string;
}

export const DEFAULT_VI_VOICE_SETTINGS: VietnameseVoiceSettings = {
  voiceEnabled: true,
  preferredVoiceURI: null,
  rate: 0.98,
  volume: 1.0,
  useConfiguredFallbackEndpoint: false,
};

const SETTINGS_STORAGE_PREFIX = 'taydo_a01_vi_voice_settings_v1';

/**
 * Kiểm tra chặt chẽ mã ngôn ngữ có phải tiếng Việt (`vi`, `vi-VN`, `vi_VN`) hay không.
 * Từ chối tuyệt đối `en-US`, `en-GB`, `fr-FR`... kể cả khi tên giọng chứa chuỗi con dễ gây nhầm.
 */
export function isStrictVietnameseLangTag(lang: string | undefined | null): boolean {
  if (!lang) return false;
  const normalized = lang.trim().toLowerCase().replace(/_/g, '-');
  return normalized === 'vi' || /^vi-[a-z0-9]{2,}$/i.test(normalized);
}

/**
 * Lọc danh sách giọng chỉ giữ lại giọng tiếng Việt hợp lệ.
 * Không bao giờ nhận giọng tiếng Anh (`en-*`) hay bất kỳ ngôn ngữ nào khác làm dự phòng.
 */
export function isStrictVietnameseVoice(voice: VoiceLike | null | undefined): boolean {
  if (!voice) return false;
  const lang = (voice.lang || '').trim();
  if (lang.length > 0) {
    return isStrictVietnameseLangTag(lang);
  }
  // Trường hợp trình duyệt đặc biệt trả về lang rỗng: chỉ nhận nếu tên ghi rõ tiếng Việt
  const nameLower = (voice.name || '').toLowerCase();
  return nameLower.includes('vietnamese') || nameLower.includes('tiếng việt');
}

/**
 * Chấm điểm chất lượng giọng tiếng Việt để tự động chọn giọng tự nhiên & rõ nét nhất.
 * Thứ tự ưu tiên:
 * 1. Microsoft Edge Natural / Neural Online (HoaiMy / NamMinh)
 * 2. Google tiếng Việt (Chrome)
 * 3. Giọng bản địa `vi-VN` (Microsoft An, macOS Linh, ...)
 * 4. Các giọng `vi` hợp lệ khác
 */
export function scoreVietnameseVoice(voice: VoiceLike): {
  score: number;
  tierLabel: string;
} {
  const nameLower = (voice.name || '').toLowerCase();
  const langNorm = (voice.lang || '').trim().toLowerCase().replace(/_/g, '-');

  let score = 0;
  let tierLabel = 'Tiếng Việt chuẩn';

  if (langNorm === 'vi-vn') {
    score += 35;
  } else if (langNorm === 'vi' || langNorm.startsWith('vi-')) {
    score += 20;
  }

  if (nameLower.includes('natural') || nameLower.includes('neural')) {
    score += 120;
    tierLabel = 'Giọng Tự nhiên (Natural)';
  } else if (nameLower.includes('google') && (nameLower.includes('tiếng việt') || nameLower.includes('viet'))) {
    score += 95;
    tierLabel = 'Google Tiếng Việt';
  } else if (nameLower.includes('online')) {
    score += 85;
    tierLabel = 'Giọng Trực tuyến (Online)';
  } else if (nameLower.includes('microsoft')) {
    score += 70;
    tierLabel = 'Microsoft Tiếng Việt';
  } else if (nameLower.includes('linh') || nameLower.includes('hoaimy') || nameLower.includes('namminh')) {
    score += 65;
    tierLabel = 'Giọng Hệ thống Chất lượng cao';
  }

  if (nameLower.includes('hoaimy')) score += 12;
  if (nameLower.includes('namminh')) score += 10;
  if (voice.localService) score += 6;
  if (voice.default) score += 4;

  return { score, tierLabel };
}

/**
 * Lọc, xếp hạng và chọn chính xác một giọng tiếng Việt từ danh sách thô.
 * Trả về `selected: null` nếu thiết bị không có giọng Việt (không trả về giọng Anh).
 */
export function selectBestVietnameseVoice<T extends VoiceLike>(
  allVoices: readonly T[],
  preferredVoiceURI?: string | null
): {
  vietnameseVoices: VietnameseVoiceOption<T>[];
  selected: VietnameseVoiceOption<T> | null;
} {
  const seenUris = new Set<string>();
  const viOptions: VietnameseVoiceOption<T>[] = [];

  for (const v of allVoices) {
    if (!isStrictVietnameseVoice(v)) continue;
    const key = v.voiceURI || `${v.name}_${v.lang}`;
    if (seenUris.has(key)) continue;
    seenUris.add(key);

    const { score, tierLabel } = scoreVietnameseVoice(v);
    viOptions.push({
      voice: v,
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang || 'vi-VN',
      qualityScore: score,
      qualityTierLabel: tierLabel,
      localService: Boolean(v.localService),
    });
  }

  viOptions.sort((a, b) => b.qualityScore - a.qualityScore || a.name.localeCompare(b.name, 'vi'));

  if (viOptions.length === 0) {
    return { vietnameseVoices: [], selected: null };
  }

  if (preferredVoiceURI) {
    const matched = viOptions.find((opt) => opt.voiceURI === preferredVoiceURI);
    if (matched) {
      return { vietnameseVoices: viOptions, selected: matched };
    }
  }

  return { vietnameseVoices: viOptions, selected: viOptions[0] };
}

/**
 * Đọc và lưu cài đặt giọng đọc A01 theo teacherId.
 */
export function loadA01VoiceSettings(teacherId: string): VietnameseVoiceSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_VI_VOICE_SETTINGS };
  try {
    const raw = window.localStorage.getItem(`${SETTINGS_STORAGE_PREFIX}_${teacherId || 'default'}`);
    if (!raw) return { ...DEFAULT_VI_VOICE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<VietnameseVoiceSettings>;
    return {
      voiceEnabled:
        typeof parsed.voiceEnabled === 'boolean'
          ? parsed.voiceEnabled
          : DEFAULT_VI_VOICE_SETTINGS.voiceEnabled,
      preferredVoiceURI:
        typeof parsed.preferredVoiceURI === 'string' && parsed.preferredVoiceURI.trim().length > 0
          ? parsed.preferredVoiceURI
          : null,
      rate:
        typeof parsed.rate === 'number' && Number.isFinite(parsed.rate)
          ? Math.min(1.4, Math.max(0.7, parsed.rate))
          : DEFAULT_VI_VOICE_SETTINGS.rate,
      volume:
        typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_VI_VOICE_SETTINGS.volume,
      useConfiguredFallbackEndpoint: Boolean(parsed.useConfiguredFallbackEndpoint),
    };
  } catch {
    return { ...DEFAULT_VI_VOICE_SETTINGS };
  }
}

export function saveA01VoiceSettings(teacherId: string, settings: VietnameseVoiceSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${SETTINGS_STORAGE_PREFIX}_${teacherId || 'default'}`,
      JSON.stringify(settings)
    );
  } catch {
    // Ignore localStorage quota/private mode errors
  }
}

function resolveConfiguredFallbackTtsEndpoint(): string | null {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    const raw = metaEnv?.VITE_VI_TTS_ENDPOINT;
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Chỉ cho phép endpoint HTTPS hoặc cùng origin `/api/...`, không chứa bí mật
    if (trimmed.startsWith('/') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// VIETNAMESE VOICE MANAGER CONTROLLER (Quản lý voiceschanged, phát, hủy chồng âm)
// ============================================================================
export class VietnameseVoiceManager {
  private listeners = new Set<(snapshot: VietnameseVoiceSnapshotLike) => void>();
  private preferredVoiceURI: string | null = null;
  private useFallbackService = false;
  private activeRequestId = 0;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private activeFallbackAudio: HTMLAudioElement | null = null;
  private pendingSpeakTimer: number | null = null;
  private voicesLoadedOnce = false;
  private disposed = false;
  private boundVoicesChangedHandler: (() => void) | null = null;

  constructor(initialPreferredURI: string | null = null, useFallbackService = false) {
    this.preferredVoiceURI = initialPreferredURI;
    this.useFallbackService = useFallbackService;
    this.bindSpeechListeners();
  }

  private getSpeechApi(): SpeechSynthesis | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return null;
    }
    return window.speechSynthesis;
  }

  private bindSpeechListeners(): void {
    const synth = this.getSpeechApi();
    if (!synth) return;

    const handleVoicesChanged = () => {
      if (this.disposed) return;
      this.voicesLoadedOnce = true;
      this.emitSnapshot();
    };

    this.boundVoicesChangedHandler = handleVoicesChanged;
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', handleVoicesChanged);
    } else {
      synth.onvoiceschanged = handleVoicesChanged;
    }

    // Gọi mồi để một số trình duyệt bắt đầu nạp danh sách giọng nền
    try {
      const initial = synth.getVoices();
      if (initial.length > 0) {
        this.voicesLoadedOnce = true;
      }
    } catch {
      // Ignore
    }
  }

  public setPreferredVoiceURI(uri: string | null): void {
    this.preferredVoiceURI = uri;
    this.emitSnapshot();
  }

  public setUseFallbackService(enabled: boolean): void {
    this.useFallbackService = enabled;
    this.emitSnapshot();
  }

  public getSnapshot(): VoiceManagerSnapshot {
    const synth = this.getSpeechApi();
    const fallbackEndpoint = resolveConfiguredFallbackTtsEndpoint();
    const fallbackServiceConfigured = Boolean(fallbackEndpoint);

    if (!synth) {
      return {
        status: fallbackServiceConfigured && this.useFallbackService ? 'FALLBACK_ENDPOINT' : 'UNSUPPORTED_BROWSER',
        vietnameseVoices: [],
        selectedVoice: null,
        allVoiceCount: 0,
        hasVietnameseVoice: false,
        fallbackServiceConfigured,
        statusMessage: 'Trình duyệt không hỗ trợ Web Speech API.',
      };
    }

    let allVoices: SpeechSynthesisVoice[] = [];
    try {
      allVoices = synth.getVoices() || [];
    } catch {
      allVoices = [];
    }

    if (allVoices.length > 0) {
      this.voicesLoadedOnce = true;
    }

    const { vietnameseVoices, selected } = selectBestVietnameseVoice(allVoices, this.preferredVoiceURI);

    if (selected) {
      return {
        status: 'READY_VI',
        vietnameseVoices,
        selectedVoice: selected,
        allVoiceCount: allVoices.length,
        hasVietnameseVoice: true,
        fallbackServiceConfigured,
        statusMessage: `Sẵn sàng giọng Tiếng Việt: ${selected.name} (${selected.lang})`,
      };
    }

    if (allVoices.length === 0 && !this.voicesLoadedOnce) {
      return {
        status: 'LOADING',
        vietnameseVoices: [],
        selectedVoice: null,
        allVoiceCount: 0,
        hasVietnameseVoice: false,
        fallbackServiceConfigured,
        statusMessage: 'Đang tải danh sách giọng đọc từ trình duyệt...',
      };
    }

    if (fallbackServiceConfigured && this.useFallbackService) {
      return {
        status: 'FALLBACK_ENDPOINT',
        vietnameseVoices: [],
        selectedVoice: null,
        allVoiceCount: allVoices.length,
        hasVietnameseVoice: false,
        fallbackServiceConfigured,
        statusMessage: 'Đang dùng dịch vụ TTS Tiếng Việt dự phòng đã cấu hình.',
      };
    }

    return {
      status: 'UNAVAILABLE_NO_VI_VOICE',
      vietnameseVoices: [],
      selectedVoice: null,
      allVoiceCount: allVoices.length,
      hasVietnameseVoice: false,
      fallbackServiceConfigured,
      statusMessage: 'Thiết bị chưa có giọng đọc tiếng Việt',
    };
  }

  private emitSnapshot(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(snap);
      } catch {
        // Ignore subscriber error
      }
    });
  }

  public subscribe(listener: (snapshot: VoiceManagerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Chờ danh sách giọng trình duyệt tải xong qua sự kiện `voiceschanged`
   * hoặc polling an toàn tối đa `timeoutMs` cho máy tải chậm.
   */
  public async waitForVoicesReady(timeoutMs = 1500): Promise<VoiceManagerSnapshot> {
    const synth = this.getSpeechApi();
    if (!synth) return this.getSnapshot();

    const first = synth.getVoices();
    if (first && first.length > 0) {
      this.voicesLoadedOnce = true;
      const snap = this.getSnapshot();
      this.emitSnapshot();
      return snap;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const onChanged = () => {
        const list = synth.getVoices();
        if (list && list.length > 0) {
          this.voicesLoadedOnce = true;
          finish();
        }
      };

      const pollTimer = window.setInterval(() => {
        try {
          const list = synth.getVoices();
          if (list && list.length > 0) {
            this.voicesLoadedOnce = true;
            finish();
          }
        } catch {
          // Ignore
        }
      }, 120);

      const maxTimer = window.setTimeout(() => {
        this.voicesLoadedOnce = true;
        finish();
      }, Math.max(200, timeoutMs));

      const cleanup = () => {
        window.clearInterval(pollTimer);
        window.clearTimeout(maxTimer);
        if (typeof synth.removeEventListener === 'function') {
          synth.removeEventListener('voiceschanged', onChanged);
        }
      };

      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', onChanged);
      }
    });

    const finalSnap = this.getSnapshot();
    this.emitSnapshot();
    return finalSnap;
  }

  /**
   * Dừng ngay mọi âm thanh giọng nói đang phát để chống đọc chồng.
   */
  public stop(): void {
    this.activeRequestId++;
    if (this.pendingSpeakTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.pendingSpeakTimer);
      this.pendingSpeakTimer = null;
    }
    if (this.activeFallbackAudio) {
      try {
        this.activeFallbackAudio.pause();
        this.activeFallbackAudio.src = '';
      } catch {
        // Ignore
      }
      this.activeFallbackAudio = null;
    }
    this.activeUtterance = null;
    const synth = this.getSpeechApi();
    if (synth) {
      try {
        synth.cancel();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Đọc văn bản tiếng Việt an toàn:
   * - Chờ giọng tải nếu danh sách ban đầu chưa sẵn sàng.
   * - Chỉ phát khi có giọng `vi` / `vi-VN` hợp lệ (hoặc fallback endpoint đã cấu hình).
   * - Tuyệt đối không dùng giọng `en-US`, `en-GB` hoặc bất kỳ giọng không phải tiếng Việt.
   */
  public async speakVietnamese(
    rawText: string,
    options: {
      rate?: number;
      volume?: number;
      pitch?: number;
      preferredVoiceURI?: string | null;
      useFallbackEndpoint?: boolean;
      forceBypassMute?: boolean;
      isMuted?: boolean;
      voiceEnabled?: boolean;
    } = {}
  ): Promise<SpeakResult> {
    if (this.disposed) {
      return { spoken: false, reason: 'superseded' };
    }

    const text = (rawText || '').trim();
    if (!text) {
      return { spoken: false, reason: 'empty_text' };
    }

    if (!options.forceBypassMute && (options.isMuted || options.voiceEnabled === false)) {
      return { spoken: false, reason: 'disabled_or_muted' };
    }

    if (options.preferredVoiceURI !== undefined) {
      this.preferredVoiceURI = options.preferredVoiceURI;
    }
    if (options.useFallbackEndpoint !== undefined) {
      this.useFallbackService = options.useFallbackEndpoint;
    }

    // Dừng giọng trước đó trước khi bắt đầu lượt mới
    this.stop();
    const myRequestId = this.activeRequestId;

    const synth = this.getSpeechApi();
    const snap = synth ? await this.waitForVoicesReady(1300) : this.getSnapshot();

    if (this.disposed || myRequestId !== this.activeRequestId) {
      return { spoken: false, reason: 'superseded' };
    }

    // 1. Ưu tiên giọng Việt chuẩn từ Web Speech API
    if (synth && snap.selectedVoice) {
      const chosen = snap.selectedVoice;
      const rate = Math.min(1.4, Math.max(0.7, options.rate ?? 0.98));
      const volume = Math.min(1, Math.max(0, options.volume ?? 1));
      const pitch = Math.min(1.3, Math.max(0.8, options.pitch ?? 1.02));

      return await new Promise<SpeakResult>((resolve) => {
        const triggerSpeak = () => {
          if (this.disposed || myRequestId !== this.activeRequestId) {
            resolve({ spoken: false, reason: 'superseded' });
            return;
          }
          try {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            utterance.voice = chosen.voice;
            utterance.rate = rate;
            utterance.volume = volume;
            utterance.pitch = pitch;

            // Giữ tham chiếu mạnh để tránh GC cắt ngang sự kiện trên Chrome
            this.activeUtterance = utterance;

            utterance.onend = () => {
              if (this.activeUtterance === utterance) {
                this.activeUtterance = null;
              }
            };
            utterance.onerror = () => {
              if (this.activeUtterance === utterance) {
                this.activeUtterance = null;
              }
            };

            synth.speak(utterance);
            resolve({
              spoken: true,
              reason: 'spoken_vi_webspeech',
              selectedVoiceName: chosen.name,
              selectedVoiceLang: chosen.lang,
            });
          } catch {
            this.activeUtterance = null;
            resolve({
              spoken: false,
              reason: 'playback_error',
              message: 'Không thể phát âm thanh giọng đọc trình duyệt.',
            });
          }
        };

        // Nếu synth vừa cancel() khi đang phát, chờ 45ms để Chromium không nuốt câu mới
        if (synth.speaking || synth.pending) {
          synth.cancel();
          this.pendingSpeakTimer = window.setTimeout(() => {
            this.pendingSpeakTimer = null;
            triggerSpeak();
          }, 45);
        } else {
          triggerSpeak();
        }
      });
    }

    // 2. Chỉ dùng dịch vụ TTS dự phòng nếu hệ thống đã cấu hình endpoint hợp lệ
    const endpoint = resolveConfiguredFallbackTtsEndpoint();
    if (endpoint && (this.useFallbackService || options.useFallbackEndpoint)) {
      try {
        const rate = Math.min(1.4, Math.max(0.7, options.rate ?? 0.98));
        const volume = Math.min(1, Math.max(0, options.volume ?? 1));
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, lang: 'vi-VN', rate }),
        });
        if (!resp.ok || this.disposed || myRequestId !== this.activeRequestId) {
          return {
            spoken: false,
            reason: myRequestId !== this.activeRequestId ? 'superseded' : 'playback_error',
          };
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = volume;
        this.activeFallbackAudio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (this.activeFallbackAudio === audio) this.activeFallbackAudio = null;
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          if (this.activeFallbackAudio === audio) this.activeFallbackAudio = null;
        };
        await audio.play();
        return {
          spoken: true,
          reason: 'spoken_fallback_endpoint',
          selectedVoiceName: 'Dịch vụ TTS Tiếng Việt dự phòng',
          selectedVoiceLang: 'vi-VN',
        };
      } catch {
        return {
          spoken: false,
          reason: 'no_vietnamese_voice',
          message: 'Thiết bị chưa có giọng đọc tiếng Việt',
        };
      }
    }

    // 3. Không có giọng Việt & không có fallback TTS -> Im lặng an toàn, TUYỆT ĐỐI KHÔNG đọc tiếng Anh!
    return {
      spoken: false,
      reason: synth ? 'no_vietnamese_voice' : 'unsupported_browser',
      message: synth
        ? 'Thiết bị chưa có giọng đọc tiếng Việt'
        : 'Trình duyệt không hỗ trợ Web Speech API.',
    };
  }

  public dispose(): void {
    this.disposed = true;
    this.stop();
    this.listeners.clear();
    const synth = this.getSpeechApi();
    if (synth && this.boundVoicesChangedHandler) {
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', this.boundVoicesChangedHandler);
      } else if (synth.onvoiceschanged === this.boundVoicesChangedHandler) {
        synth.onvoiceschanged = null;
      }
    }
    this.boundVoicesChangedHandler = null;
  }
}

export type VietnameseVoiceSnapshotLike = VoiceManagerSnapshot;

// ============================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG CHO VIETNAMESEVOICEMANAGER (ĐA THIẾT BỊ & KHÔNG RƠI VỀ EN)
// ============================================================================
export interface VoiceUnitTestCase {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runVietnameseVoiceManagerTests(): {
  passed: boolean;
  totalChecks: number;
  cases: VoiceUnitTestCase[];
} {
  const cases: VoiceUnitTestCase[] = [];

  // 1. Chrome Windows có giọng tiếng Việt + nhiều giọng tiếng Anh mặc định
  const chromeWinVoices: VoiceLike[] = [
    { voiceURI: 'Microsoft David', name: 'Microsoft David - English (United States)', lang: 'en-US', default: true },
    { voiceURI: 'Google US English', name: 'Google US English', lang: 'en-US' },
    { voiceURI: 'Google Tiếng Việt', name: 'Google tiếng Việt', lang: 'vi-VN', localService: false },
  ];
  const resChrome = selectBestVietnameseVoice(chromeWinVoices);
  cases.push({
    id: 'voice_chrome_win_vi',
    label: 'Chrome Windows (mặc định en-US + Google tiếng Việt): Chọn đúng Google tiếng Việt',
    passed: resChrome.selected?.voiceURI === 'Google Tiếng Việt' && resChrome.vietnameseVoices.length === 1,
    detail: `selected=${resChrome.selected?.name ?? 'null'} (${resChrome.selected?.lang ?? ''})`,
  });

  // 2. Edge Windows có giọng Microsoft HoaiMy Natural & Microsoft An Desktop
  const edgeWinVoices: VoiceLike[] = [
    { voiceURI: 'edge-en', name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', default: true },
    { voiceURI: 'edge-an', name: 'Microsoft An - Vietnamese (Vietnam)', lang: 'vi-VN', localService: true },
    { voiceURI: 'edge-hoaimy', name: 'Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', lang: 'vi-VN', localService: false },
    { voiceURI: 'edge-namminh', name: 'Microsoft NamMinh Online (Natural) - Vietnamese (Vietnam)', lang: 'vi-VN', localService: false },
  ];
  const resEdge = selectBestVietnameseVoice(edgeWinVoices);
  cases.push({
    id: 'voice_edge_win_vi',
    label: 'Edge Windows: Ưu tiên giọng Natural chất lượng cao (HoaiMy Natural)',
    passed: resEdge.selected?.voiceURI === 'edge-hoaimy' && resEdge.vietnameseVoices.length === 3,
    detail: `selected=${resEdge.selected?.name ?? 'null'}, totalVi=${resEdge.vietnameseVoices.length}`,
  });

  // 3. Máy KHÔNG có giọng tiếng Việt (rỗng hoàn toàn)
  const emptyVoices: VoiceLike[] = [];
  const resEmpty = selectBestVietnameseVoice(emptyVoices);
  cases.push({
    id: 'voice_empty_device',
    label: 'Máy không có giọng Việt (danh sách rỗng): Trả về null, không fallback tiếng Anh',
    passed: resEmpty.selected === null && resEmpty.vietnameseVoices.length === 0,
    detail: `selected=${String(resEmpty.selected)}`,
  });

  // 4. Máy chỉ có giọng mặc định tiếng Anh & ngôn ngữ khác (bao gồm tên bẫy chứa "vi" như Victoria/Latvian)
  const enOnlyVoices: VoiceLike[] = [
    { voiceURI: 'en-us', name: 'Microsoft David - English (United States)', lang: 'en-US', default: true },
    { voiceURI: 'en-gb', name: 'Google UK English Female (Victoria)', lang: 'en-GB' },
    { voiceURI: 'lv-lv', name: 'Latvian Standard', lang: 'lv-LV' },
  ];
  const resEnOnly = selectBestVietnameseVoice(enOnlyVoices);
  cases.push({
    id: 'voice_en_default_rejected',
    label: 'Máy chỉ có giọng mặc định en-US/en-GB (kể cả tên Victoria): Từ chối 100%, không đọc tiếng Anh',
    passed: resEnOnly.selected === null && resEnOnly.vietnameseVoices.length === 0,
    detail: `selected=${String(resEnOnly.selected)}, viCount=${resEnOnly.vietnameseVoices.length}`,
  });

  // 5. Người dùng chọn thủ công một giọng Việt cụ thể (vd: Microsoft NamMinh)
  const resManual = selectBestVietnameseVoice(edgeWinVoices, 'edge-namminh');
  cases.push({
    id: 'voice_manual_preference',
    label: 'Giữ đúng lựa chọn thủ công của giáo viên khi giọng Việt tồn tại',
    passed: resManual.selected?.voiceURI === 'edge-namminh',
    detail: `selected=${resManual.selected?.voiceURI ?? 'null'}`,
  });

  // 6. Nếu preference trước đó là giọng không hợp lệ/tiếng Anh -> không nhận, chọn giọng Việt chuẩn
  const resPoisonPref = selectBestVietnameseVoice(edgeWinVoices, 'edge-en');
  cases.push({
    id: 'voice_reject_en_preference',
    label: 'Chặn preference URI tiếng Anh, tự chuyển về giọng Việt tốt nhất',
    passed: resPoisonPref.selected?.voiceURI === 'edge-hoaimy',
    detail: `selected=${resPoisonPref.selected?.voiceURI ?? 'null'}`,
  });

  // 7. Hỗ trợ cả mã ngắn `vi` và `vi_VN`
  const shortLangVoices: VoiceLike[] = [
    { voiceURI: 'mac-linh', name: 'Linh', lang: 'vi_VN', localService: true },
    { voiceURI: 'short-vi', name: 'Vietnamese Basic', lang: 'vi', localService: true },
  ];
  const resShort = selectBestVietnameseVoice(shortLangVoices);
  cases.push({
    id: 'voice_lang_variants',
    label: 'Chấp nhận chuẩn mã `vi`, `vi-VN`, `vi_VN` và ưu tiên `vi_VN` chất lượng tốt hơn',
    passed: resShort.vietnameseVoices.length === 2 && resShort.selected?.voiceURI === 'mac-linh',
    detail: `selected=${resShort.selected?.voiceURI}, count=${resShort.vietnameseVoices.length}`,
  });

  const failed = cases.filter((c) => !c.passed);
  return {
    passed: failed.length === 0,
    totalChecks: cases.length,
    cases,
  };
}
