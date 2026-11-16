// ============================================================================
// A07 SPACE ROCKET 3D - STRICT VIETNAMESE VOICE MANAGER
// Supports Gender (Nam/Nữ/Tự động) & Region (Bắc/Trung/Nam Bộ/Tự động)
// Enforces vi-VN language strictly: NEVER falls back to English voices.
// ============================================================================

export type RocketVoiceGender = 'AUTO' | 'FEMALE' | 'MALE';
export type RocketVoiceRegion = 'AUTO' | 'BAC' | 'TRUNG' | 'NAM';

export interface RocketVoicePreferences {
  enabled: boolean;
  gender: RocketVoiceGender;
  region: RocketVoiceRegion;
}

export interface RocketVoiceAvailability {
  supported: boolean;
  hasVietnameseVoice: boolean;
  vietnameseVoiceCount: number;
  selectedVoiceName: string | null;
  selectedVoiceLang: string | null;
}

export interface RocketSpeakOutcome {
  spoken: boolean;
  reason:
    | 'ok'
    | 'muted_or_disabled'
    | 'unsupported'
    | 'no_vietnamese_voice'
    | 'error';
  captionText: string;
}

const VOICE_PREFS_STORAGE_KEY = 'taydo_a07_voice_prefs_v1';

export const DEFAULT_ROCKET_VOICE_PREFS: RocketVoicePreferences = {
  enabled: true,
  gender: 'AUTO',
  region: 'AUTO',
};

export function loadRocketVoicePreferences(): RocketVoicePreferences {
  if (typeof window === 'undefined') return DEFAULT_ROCKET_VOICE_PREFS;
  try {
    const raw = window.localStorage.getItem(VOICE_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_ROCKET_VOICE_PREFS;
    const parsed = JSON.parse(raw) as Partial<RocketVoicePreferences>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      gender:
        parsed.gender === 'FEMALE' || parsed.gender === 'MALE' || parsed.gender === 'AUTO'
          ? parsed.gender
          : 'AUTO',
      region:
        parsed.region === 'BAC' ||
        parsed.region === 'TRUNG' ||
        parsed.region === 'NAM' ||
        parsed.region === 'AUTO'
          ? parsed.region
          : 'AUTO',
    };
  } catch {
    return DEFAULT_ROCKET_VOICE_PREFS;
  }
}

export function saveRocketVoicePreferences(prefs: RocketVoicePreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOICE_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Strictly verify that a SpeechSynthesisVoice is genuinely Vietnamese.
 * Never allows en-US / en-GB or non-Vietnamese voices through.
 */
export function isStrictlyVietnameseVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = (voice.lang || '').trim().toLowerCase().replace('_', '-');
  if (lang === 'vi' || lang.startsWith('vi-')) {
    return true;
  }
  const name = (voice.name || '').trim().toLowerCase();
  return (
    name.includes('vietnam') ||
    name.includes('tiếng việt') ||
    name.includes('tieng viet')
  );
}

function scoreVietnameseVoice(
  voice: SpeechSynthesisVoice,
  prefs: RocketVoicePreferences
): number {
  let score = 10;
  const nameLower = `${voice.name} ${voice.voiceURI}`.toLowerCase();

  // Prefer explicit vi-VN
  if ((voice.lang || '').toLowerCase().replace('_', '-') === 'vi-vn') {
    score += 15;
  }
  if (voice.localService) {
    score += 4;
  }

  // Gender matching hints across Windows / macOS / Chrome / Edge / Android Vietnamese voices
  // Common Vietnamese TTS names: HoaiMy / Linh / Chi / Mai / Lan / An (Female) vs NamMinh / Minh / Huy (Male)
  const femaleHints = ['hoaimy', 'hoai my', 'linh', 'mai', 'lan', 'chi', 'ngoc', 'female', 'nu', 'nữ'];
  const maleHints = ['namminh', 'nam minh', 'minh', 'huy', 'hung', 'tuan', 'male', 'nam '];

  const looksFemale = femaleHints.some((h) => nameLower.includes(h));
  const looksMale = maleHints.some((h) => nameLower.includes(h));

  if (prefs.gender === 'FEMALE') {
    if (looksFemale) score += 25;
    if (looksMale) score -= 12;
  } else if (prefs.gender === 'MALE') {
    if (looksMale) score += 25;
    if (looksFemale) score -= 12;
  }

  // Region matching hints when OS/Browser exposes regional voices
  const northHints = ['hanoi', 'ha noi', 'bac', 'bắc', 'linh', 'minh'];
  const centralHints = ['hue', 'huế', 'danang', 'da nang', 'trung'];
  const southHints = ['saigon', 'ho chi minh', 'hcm', 'hoaimy', 'namminh', 'nam bo', 'miền nam'];

  if (prefs.region === 'BAC' && northHints.some((h) => nameLower.includes(h))) {
    score += 18;
  } else if (prefs.region === 'TRUNG' && centralHints.some((h) => nameLower.includes(h))) {
    score += 18;
  } else if (prefs.region === 'NAM' && southHints.some((h) => nameLower.includes(h))) {
    score += 18;
  }

  return score;
}

export function selectVietnameseSpeechVoice(
  voices: readonly SpeechSynthesisVoice[],
  prefs: RocketVoicePreferences
): {
  voice: SpeechSynthesisVoice | null;
  vietnameseVoices: SpeechSynthesisVoice[];
} {
  const vietnameseVoices = voices.filter(isStrictlyVietnameseVoice);
  if (vietnameseVoices.length === 0) {
    return { voice: null, vietnameseVoices: [] };
  }

  const ranked = [...vietnameseVoices].sort(
    (a, b) => scoreVietnameseVoice(b, prefs) - scoreVietnameseVoice(a, prefs)
  );
  return { voice: ranked[0], vietnameseVoices };
}

export function buildVietnameseRegionToneProfile(prefs: RocketVoicePreferences): {
  rate: number;
  pitch: number;
} {
  let rate = 1.0;
  let pitch = 1.0;

  if (prefs.gender === 'MALE') {
    pitch = 0.88;
  } else if (prefs.gender === 'FEMALE') {
    pitch = 1.1;
  }

  if (prefs.region === 'BAC') {
    rate = 1.02;
  } else if (prefs.region === 'TRUNG') {
    rate = 0.96;
    pitch = Math.max(0.82, pitch - 0.03);
  } else if (prefs.region === 'NAM') {
    rate = 0.98;
    pitch = Math.min(1.2, pitch + 0.03);
  }

  return { rate, pitch };
}

export class SpaceRocketVoiceManager {
  private voices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<(availability: RocketVoiceAvailability) => void>();
  private currentPrefs: RocketVoicePreferences = DEFAULT_ROCKET_VOICE_PREFS;
  private isBound = false;

  constructor(initialPrefs?: RocketVoicePreferences) {
    if (initialPrefs) {
      this.currentPrefs = initialPrefs;
    }
    this.refreshVoices();
    this.bindVoicesChanged();
  }

  private bindVoicesChanged() {
    if (this.isBound || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    this.isBound = true;
    try {
      window.speechSynthesis.addEventListener('voiceschanged', this.handleVoicesChanged);
    } catch {
      // Some environments expose onvoiceschanged only
      window.speechSynthesis.onvoiceschanged = this.handleVoicesChanged;
    }
  }

  private handleVoicesChanged = () => {
    this.refreshVoices();
    const avail = this.getAvailability();
    this.listeners.forEach((cb) => cb(avail));
  };

  public refreshVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.voices = [];
      return;
    }
    try {
      this.voices = window.speechSynthesis.getVoices() || [];
    } catch {
      this.voices = [];
    }
  }

  public setPreferences(prefs: RocketVoicePreferences): void {
    this.currentPrefs = prefs;
    saveRocketVoicePreferences(prefs);
    const avail = this.getAvailability();
    this.listeners.forEach((cb) => cb(avail));
  }

  public subscribe(cb: (availability: RocketVoiceAvailability) => void): () => void {
    this.listeners.add(cb);
    cb(this.getAvailability());
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getAvailability(): RocketVoiceAvailability {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return {
        supported: false,
        hasVietnameseVoice: false,
        vietnameseVoiceCount: 0,
        selectedVoiceName: null,
        selectedVoiceLang: null,
      };
    }
    if (this.voices.length === 0) {
      this.refreshVoices();
    }
    const { voice, vietnameseVoices } = selectVietnameseSpeechVoice(
      this.voices,
      this.currentPrefs
    );
    return {
      supported: true,
      hasVietnameseVoice: vietnameseVoices.length > 0,
      vietnameseVoiceCount: vietnameseVoices.length,
      selectedVoiceName: voice ? voice.name : null,
      selectedVoiceLang: voice ? voice.lang : null,
    };
  }

  public cancel(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  public speakVietnamese(text: string, isMuted: boolean): RocketSpeakOutcome {
    const cleanText = text.trim();
    if (!cleanText) {
      return { spoken: false, reason: 'muted_or_disabled', captionText: '' };
    }
    if (isMuted || !this.currentPrefs.enabled) {
      return { spoken: false, reason: 'muted_or_disabled', captionText: cleanText };
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return { spoken: false, reason: 'unsupported', captionText: cleanText };
    }

    if (this.voices.length === 0) {
      this.refreshVoices();
    }

    const { voice } = selectVietnameseSpeechVoice(this.voices, this.currentPrefs);
    // CRITICAL REQUIREMENT: Never fall back to English or non-Vietnamese voice
    if (!voice) {
      return {
        spoken: false,
        reason: 'no_vietnamese_voice',
        captionText: cleanText,
      };
    }

    try {
      window.speechSynthesis.cancel(); // Prevent overlapping lines
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.voice = voice;
      utter.lang = 'vi-VN';
      const { rate, pitch } = buildVietnameseRegionToneProfile(this.currentPrefs);
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = 0.92;
      window.speechSynthesis.speak(utter);
      return { spoken: true, reason: 'ok', captionText: cleanText };
    } catch {
      return { spoken: false, reason: 'error', captionText: cleanText };
    }
  }

  public dispose(): void {
    this.cancel();
    this.listeners.clear();
    if (this.isBound && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.removeEventListener('voiceschanged', this.handleVoicesChanged);
      } catch {
        if (window.speechSynthesis.onvoiceschanged === this.handleVoicesChanged) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      }
    }
    this.isBound = false;
  }
}
