import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  saveEduGameMuted,
  loadEduGameVoiceEnabled,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from './eduGameAudioController';
import { runVietnameseVoiceManagerTests } from './vietnameseVoiceManager';
import {
  SpaceRocketVoiceManager,
  isStrictlyVietnameseVoice,
  loadRocketVoicePreferences,
  saveRocketVoicePreferences,
} from '../components/teacher/games/SpaceRocketVoiceManager';
import { KHKT_DEMO_STORAGE_PREFIX } from './khktDemoSandbox';

// ============================================================================
// Lightweight Browser Global Mocks (localStorage, speechSynthesis, AudioContext)
// ============================================================================
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
  keys(): string[] {
    return Array.from(this.map.keys());
  }
}

interface MockAudioParam {
  value: number;
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime: (v: number, t: number) => void;
  exponentialRampToValueAtTime: (v: number, t: number) => void;
  setTargetAtTime: (v: number, t: number, tc: number) => void;
  cancelScheduledValues: (t: number) => void;
}

function createMockAudioParam(initial = 0): MockAudioParam {
  return {
    value: initial,
    setValueAtTime(v: number) {
      this.value = v;
    },
    linearRampToValueAtTime(v: number) {
      this.value = v;
    },
    exponentialRampToValueAtTime(v: number) {
      this.value = v;
    },
    setTargetAtTime(v: number) {
      this.value = v;
    },
    cancelScheduledValues() {},
  };
}

class MockScheduledNode {
  started = false;
  stopped = false;
  disconnected = false;
  loop = false;
  buffer: unknown = null;
  type = 'sine';
  frequency = createMockAudioParam(440);
  onended: (() => void) | null = null;
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  resumedCount = 0;
  closedCount = 0;
  createdSources: MockScheduledNode[] = [];

  resume(): Promise<void> {
    this.resumedCount++;
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closedCount++;
    this.state = 'closed';
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: createMockAudioParam(1),
      connect() {},
      disconnect() {},
    };
  }
  createDynamicsCompressor() {
    return {
      threshold: createMockAudioParam(-16),
      knee: createMockAudioParam(18),
      ratio: createMockAudioParam(4),
      attack: createMockAudioParam(0.005),
      release: createMockAudioParam(0.12),
      connect() {},
      disconnect() {},
    };
  }
  createBiquadFilter() {
    return {
      type: 'bandpass',
      frequency: createMockAudioParam(600),
      Q: createMockAudioParam(1),
      connect() {},
      disconnect() {},
    };
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return {
      getChannelData: () => data,
    };
  }
  createOscillator() {
    const node = new MockScheduledNode();
    this.createdSources.push(node);
    return node;
  }
  createBufferSource() {
    const node = new MockScheduledNode();
    this.createdSources.push(node);
    return node;
  }
}

class MockSpeechSynthesisUtterance {
  text: string;
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function installBrowserMocks(options: {
  pathname?: string;
  voices?: Array<Partial<SpeechSynthesisVoice>>;
  audioCtxClass?: new () => unknown;
} = {}) {
  const storage = new MemoryStorage();
  const spokenUtterances: MockSpeechSynthesisUtterance[] = [];
  let cancelCount = 0;
  let lastCreatedAudioCtx: MockAudioContext | null = null;

  const voices = (options.voices || []).map((v, i) => ({
    voiceURI: v.voiceURI ?? `voice-${i}`,
    name: v.name ?? `Voice ${i}`,
    lang: v.lang ?? '',
    localService: v.localService ?? true,
    default: v.default ?? false,
  })) as SpeechSynthesisVoice[];

  const speechSynthesis = {
    speaking: false,
    pending: false,
    getVoices: () => voices,
    speak: (u: MockSpeechSynthesisUtterance) => {
      spokenUtterances.push(u);
    },
    cancel: () => {
      cancelCount++;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    onvoiceschanged: null as (() => void) | null,
  };

  class TrackedAudioContext extends MockAudioContext {
    constructor() {
      super();
      lastCreatedAudioCtx = this;
    }
  }

  const fakeWindow = {
    localStorage: storage,
    location: { pathname: options.pathname ?? '/' },
    speechSynthesis,
    AudioContext: options.audioCtxClass ?? TrackedAudioContext,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
  };

  const prevWindow = (globalThis as Record<string, unknown>).window;
  const prevUtterance = (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;

  (globalThis as Record<string, unknown>).window = fakeWindow;
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

  return {
    storage,
    spokenUtterances,
    getCancelCount: () => cancelCount,
    getAudioCtx: () => lastCreatedAudioCtx,
    setPathname: (p: string) => {
      fakeWindow.location.pathname = p;
    },
    restore: () => {
      if (prevWindow === undefined) {
        delete (globalThis as Record<string, unknown>).window;
      } else {
        (globalThis as Record<string, unknown>).window = prevWindow;
      }
      if (prevUtterance === undefined) {
        delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
      } else {
        (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = prevUtterance;
      }
    },
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

test('A01 VietnameseVoiceManager reference baseline passes all strict checks', () => {
  const result = runVietnameseVoiceManagerTests();
  assert.equal(result.passed, true, `Failed voice cases: ${JSON.stringify(result.cases.filter((c) => !c.passed))}`);
  assert.ok(result.totalChecks >= 7);
});

test('Audio mute & voice preferences persist and isolate cleanly in /demo runtime', () => {
  const env = installBrowserMocks({ pathname: '/' });
  try {
    assert.equal(loadEduGameMuted(false), false);
    assert.equal(loadEduGameVoiceEnabled(true), true);

    saveEduGameMuted(true);
    saveEduGameVoiceEnabled(false);
    assert.equal(loadEduGameMuted(false), true);
    assert.equal(loadEduGameVoiceEnabled(true), false);

    // Switch to /demo -> must NOT see or overwrite production keys
    env.setPathname('/demo');
    assert.equal(loadEduGameMuted(false), false);
    assert.equal(loadEduGameVoiceEnabled(true), true);

    saveEduGameMuted(true);
    saveEduGameVoiceEnabled(false);
    saveRocketVoicePreferences({ enabled: false, gender: 'FEMALE', region: 'NAM' });

    const keys = env.storage.keys();
    assert.ok(
      keys.some((k) => k.startsWith(KHKT_DEMO_STORAGE_PREFIX) && k.includes('muted')),
      'Demo muted key should be prefixed with KHKT_DEMO_STORAGE_PREFIX'
    );
    assert.ok(
      keys.some((k) => k.startsWith(KHKT_DEMO_STORAGE_PREFIX) && k.includes('a07_voice_prefs')),
      'A07 demo prefs key should be prefixed with KHKT_DEMO_STORAGE_PREFIX'
    );
    assert.equal(loadRocketVoicePreferences().region, 'NAM');

    // Back to production -> A07 prefs remain default
    env.setPathname('/');
    assert.equal(loadRocketVoicePreferences().region, 'AUTO');
  } finally {
    env.restore();
  }
});

test('EduGameVoiceController strictly speaks Vietnamese only and NEVER falls back to English', async () => {
  // Case 1: Only English voices installed -> must NEVER call speechSynthesis.speak
  const envEnOnly = installBrowserMocks({
    voices: [
      { voiceURI: 'en-us', name: 'Microsoft David - English (United States)', lang: 'en-US', default: true },
      { voiceURI: 'en-gb-vi', name: 'Victoria English (Vietnam)', lang: 'en-GB' },
    ],
  });
  try {
    const voice = new EduGameVoiceController();
    const res = await voice.announceStudentOnce({
      turnId: 'turn-en-1',
      studentName: 'Nguyễn Minh Anh',
      isMuted: false,
      voiceEnabled: true,
    });
    assert.equal(res.spoken, false);
    assert.equal(res.reason, 'no_vietnamese_voice');
    assert.equal(envEnOnly.spokenUtterances.length, 0, 'Must NEVER speak with English voice');
    voice.dispose();
  } finally {
    envEnOnly.restore();
  }

  // Case 2: Vietnamese voice present -> speaks ONCE per turnId, fires onBeforeSpeak, respects mute/voiceEnabled
  const envVi = installBrowserMocks({
    voices: [
      { voiceURI: 'en-us', name: 'Microsoft David', lang: 'en-US', default: true },
      { voiceURI: 'vi-hoaimy', name: 'Microsoft HoaiMy Online (Natural)', lang: 'vi-VN' },
    ],
  });
  try {
    const voice = new EduGameVoiceController();
    let beforeSpeakCalls = 0;

    // Muted call -> does not speak and does NOT burn turnId dedupe
    const mutedRes = await voice.announceStudentOnce({
      turnId: 'turn-vi-1',
      studentName: 'Trần Quốc Bảo',
      isMuted: true,
      voiceEnabled: true,
      onBeforeSpeak: () => {
        beforeSpeakCalls++;
      },
    });
    assert.equal(mutedRes.spoken, false);
    assert.equal(mutedRes.reason, 'disabled_or_muted');
    assert.equal(envVi.spokenUtterances.length, 0);
    assert.equal(beforeSpeakCalls, 0);

    // Unmuted call with same turnId -> speaks once in vi-VN
    const okRes = await voice.announceStudentOnce({
      turnId: 'turn-vi-1',
      studentName: 'Trần Quốc Bảo',
      isMuted: false,
      voiceEnabled: true,
      onBeforeSpeak: () => {
        beforeSpeakCalls++;
      },
    });
    assert.equal(okRes.spoken, true);
    assert.equal(okRes.reason, 'spoken_vi_webspeech');
    assert.equal(beforeSpeakCalls, 1);
    assert.equal(envVi.spokenUtterances.length, 1);
    assert.equal(envVi.spokenUtterances[0].lang, 'vi-VN');
    assert.equal(envVi.spokenUtterances[0].voice?.voiceURI, 'vi-hoaimy');
    assert.match(envVi.spokenUtterances[0].text, /Trần Quốc Bảo/);

    // Duplicate call with same turnId -> suppressed!
    const dupRes = await voice.announceStudentOnce({
      turnId: 'turn-vi-1',
      studentName: 'Trần Quốc Bảo',
      isMuted: false,
      voiceEnabled: true,
    });
    assert.equal(dupRes.spoken, false);
    assert.equal(dupRes.reason, 'superseded');
    assert.equal(envVi.spokenUtterances.length, 1);

    // Explicit replay works & stopAllGlobalEduSpeech cancels speech
    const replayRes = await voice.replayText({
      text: 'Xin mời bạn Trần Quốc Bảo!',
      isMuted: false,
    });
    assert.equal(replayRes.spoken, true);
    assert.equal(envVi.spokenUtterances.length, 2);

    const beforeCancel = envVi.getCancelCount();
    stopAllGlobalEduSpeech();
    assert.ok(envVi.getCancelCount() > beforeCancel);

    voice.dispose();
  } finally {
    envVi.restore();
  }
});

test('EduGameSoundBank unlocks, gates by mute & turnToken, stops loops/nodes immediately, and degrades safely', () => {
  const env = installBrowserMocks();
  try {
    const bank = new EduGameSoundBank();
    bank.unlock();

    const ctx = env.getAudioCtx();
    assert.ok(ctx, 'AudioContext should be created on unlock');
    assert.equal(ctx.state, 'running');
    assert.equal(ctx.resumedCount, 1);

    bank.setActiveTurnToken('turn-A');

    // Muted calls create ZERO source nodes
    bank.playDuckStartSignal(true, 'turn-A');
    bank.playHorseStartBell(true, 'turn-A');
    bank.playBalloonPop(true, 'turn-A');
    bank.playDiceTableBounce(true, 1, 'turn-A');
    bank.playCardFlip(true, 'turn-A');
    bank.playWheelPegTick(true, 0.8, 'turn-A');
    bank.playRobotBoot(true, 'turn-A');
    assert.equal(ctx.createdSources.length, 0, 'Muted calls must not create any audio nodes');

    // Stale turn token calls create ZERO source nodes even when unmuted
    bank.playDuckStartSignal(false, 'turn-OLD');
    bank.playRevealChime(false, 'turn-OLD');
    bank.playRobotScanPulse(1, false, 'turn-OLD');
    assert.equal(ctx.createdSources.length, 0, 'Stale turn token must not emit sound');

    // Active unmuted A05–A12 cues create and start nodes cleanly
    bank.playDuckStartSignal(false, 'turn-A');
    bank.startWaterSwimLoop(false, 'turn-A');
    bank.playHorseStartBell(false, 'turn-A');
    bank.startHoofbeatLoop(() => false, 'turn-A');
    bank.updateHoofbeatProgress(0.6);
    bank.playBalloonMoveTick(false, 2, 'turn-A');
    bank.playBalloonInflate(false, 'turn-A');
    bank.playBalloonPop(false, 'turn-A');
    bank.playDiceRollTick(false, 'turn-A');
    bank.playDiceTableBounce(false, 0.85, 'turn-A');
    bank.playCardShuffle(false, 'turn-A');
    bank.playCardFlip(false, 'turn-A');
    bank.playSoftError(false, 'turn-A');
    bank.playWheelPegTick(false, 0.7, 'turn-A');
    bank.playRobotBoot(false, 'turn-A');
    bank.playRobotScanPulse(3, false, 'turn-A');
    bank.playRobotTargetFound(false, 'turn-A');
    bank.playTimerBell(false);

    const countBeforeStop = ctx.createdSources.length;
    assert.ok(countBeforeStop > 20, `Expected >20 audio source nodes, got ${countBeforeStop}`);
    assert.ok(ctx.createdSources.every((n) => n.started), 'All created nodes should be started');

    // stopAll() immediately stops every active node and clears loops
    bank.stopAll();
    assert.ok(ctx.createdSources.every((n) => n.stopped), 'stopAll() must stop all active nodes immediately');

    // After stopAll(), playing a new sound on valid token still works cleanly (no replay of old sounds)
    bank.playRevealChime(false, 'turn-A');
    assert.equal(ctx.createdSources.length, countBeforeStop + 4, 'Reveal chime should schedule 4 fresh arpeggio notes');

    bank.dispose();
    assert.equal(ctx.closedCount, 1);
  } finally {
    env.restore();
  }

  // Graceful degradation when AudioContext throws
  const envBroken = installBrowserMocks({
    audioCtxClass: class BrokenAudioContext {
      constructor() {
        throw new Error('Blocked by browser policy');
      }
    },
  });
  try {
    const bank = new EduGameSoundBank();
    assert.doesNotThrow(() => {
      bank.unlock();
      bank.playRevealChime(false);
      bank.stopAll();
      bank.dispose();
    });
  } finally {
    envBroken.restore();
  }
});

test('A07 SpaceRocketVoiceManager strictly rejects non-vi voices even with Vietnam in name and deduplicates turns', () => {
  assert.equal(
    isStrictlyVietnameseVoice({
      voiceURI: 'fake-en',
      name: 'English Vietnam Guide',
      lang: 'en-US',
      localService: true,
      default: false,
    }),
    false,
    'en-US voice with "Vietnam" in name MUST be rejected'
  );
  assert.equal(
    isStrictlyVietnameseVoice({
      voiceURI: 'real-vi',
      name: 'Microsoft HoaiMy Online',
      lang: 'vi-VN',
      localService: false,
      default: false,
    }),
    true
  );

  // Test speakVietnameseOnce deduplication with vi-VN voice
  const env = installBrowserMocks({
    voices: [
      { voiceURI: 'fake-en', name: 'English Vietnam Guide', lang: 'en-US' },
      { voiceURI: 'real-vi', name: 'Microsoft HoaiMy Online', lang: 'vi-VN' },
    ],
  });
  try {
    const mgr = new SpaceRocketVoiceManager({ enabled: true, gender: 'FEMALE', region: 'NAM' });
    const first = mgr.speakVietnameseOnce('mission-1', 'Xin chúc mừng bạn Lê Gia Huy!', false);
    assert.equal(first.spoken, true);
    assert.equal(env.spokenUtterances.length, 1);
    assert.equal(env.spokenUtterances[0].voice?.voiceURI, 'real-vi');

    const second = mgr.speakVietnameseOnce('mission-1', 'Xin chúc mừng bạn Lê Gia Huy!', false);
    assert.equal(second.spoken, false);
    assert.equal(env.spokenUtterances.length, 1, 'Same turnId must not speak twice');

    mgr.dispose();
  } finally {
    env.restore();
  }
});
