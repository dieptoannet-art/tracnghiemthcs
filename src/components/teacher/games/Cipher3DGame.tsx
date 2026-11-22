import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Layers,
  Monitor,
  KeyRound,
  Lock,
  Unlock,
  Lightbulb,
  BookOpen,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  FastForward,
  Delete,
  Trash2,
  Award,
  Users,
  User,
  School,
} from 'lucide-react';
import { MathView } from '../../MathView';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  saveEduGameMuted,
  loadEduGameVoiceEnabled,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import {
  ALPHABET_AZ,
  F05_SAMPLE_BADGE,
  F05_SAMPLE_CHALLENGES,
  CipherGameState,
  CipherPlayMode,
  CipherChallengeStatus,
  getCipherChallengeById,
  createCipherGameState,
  createGroupDrafts,
  submitCipherAttempt,
  revealNextCipherHint,
  revealCipherSolution,
  evaluateSimultaneousGroups,
  computeCipherSummary,
  caesarShiftChar,
  saveF05Session,
  loadF05Session,
  clearF05Session,
} from './cipher3dEngine';
import { Vault3DScene, Vault2DFallback, VaultVisualState } from './Vault3DScene';

export interface Cipher3DGameProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const NUMERIC_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const ALPHA_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

function statusTextVi(status: CipherChallengeStatus): string {
  if (status === 'solved') return 'Đã giải';
  if (status === 'viewed_solution') return 'Đã xem lời giải';
  return 'Chưa giải';
}

const Cipher3DGame: React.FC<Cipher3DGameProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Restore persisted session safely without replaying unlock animation
  const restoredSession = useMemo(() => loadF05Session(), []);

  const [gameState, setGameState] = useState<CipherGameState>(() =>
    restoredSession ? restoredSession.state : createCipherGameState()
  );
  const [inputCode, setInputCode] = useState<string>('');
  const [renderMode, setRenderMode] = useState<'3d' | '2d'>('3d');
  const [webglAutoFallback, setWebglAutoFallback] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Vault animation state: initialized directly to 'open' (with instantOpen=true) if restored already unlocked
  const initialChallengeProg =
    gameState.progressById[gameState.activeChallengeId] ||
    Object.values(gameState.progressById)[0];
  const initialIsOpen =
    initialChallengeProg?.status === 'solved' || initialChallengeProg?.solutionRevealed;

  const [vaultState, setVaultState] = useState<VaultVisualState>(() =>
    initialIsOpen ? 'open' : 'locked'
  );
  const [instantOpen, setInstantOpen] = useState<boolean>(() => Boolean(initialIsOpen));
  const [dialStepCount, setDialStepCount] = useState<number>(0);
  const [wrongPulseId, setWrongPulseId] = useState<number>(0);

  // Interactive Caesar helper selection (Màn 3)
  const [caesarInspectChar, setCaesarInspectChar] = useState<string>('W');
  const [caesarHelperOpen, setCaesarHelperOpen] = useState<boolean>(true);

  // Groups mode: masked inputs by default on shared classroom projector screen
  const [showGroupCodes, setShowGroupCodes] = useState<boolean>(false);

  // Summary modal visibility
  const [showSummary, setShowSummary] = useState<boolean>(false);

  // Audio & strict vi-VN voice synced with A01/A02
  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));

  // Refs for audio, timers, IME guard, and anti-double-click guard
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const submitLockRef = useRef<boolean>(false);
  const isComposingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(isMuted);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const solutionSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    soundBankRef.current = new EduGameSoundBank();
    voiceRef.current = new EduGameVoiceController();
    return () => {
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
      soundBankRef.current?.stopAll();
      soundBankRef.current?.dispose();
      voiceRef.current?.stop();
      voiceRef.current?.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  // Persist session changes automatically
  useEffect(() => {
    saveF05Session(gameState);
  }, [gameState]);

  const activeChallenge = useMemo(
    () => getCipherChallengeById(gameState.activeChallengeId),
    [gameState.activeChallengeId]
  );
  const activeProgress = gameState.progressById[activeChallenge.id];
  const summary = useMemo(() => computeCipherSummary(gameState), [gameState]);

  const cancelUnlockTimer = useCallback(() => {
    if (unlockTimerRef.current !== null) {
      window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    submitLockRef.current = false;
  }, []);

  const stopAllAudio = useCallback(() => {
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    saveEduGameMuted(next);
    if (next) {
      stopAllAudio();
    } else {
      soundBankRef.current?.unlock();
    }
  };

  const handleToggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    saveEduGameVoiceEnabled(next);
    if (!next) {
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
    }
  };

  const handleWebGLFallback = useCallback(() => {
    setWebglAutoFallback(true);
    setRenderMode('2d');
  }, []);

  // Trigger vault unlock animation (skippable via "Bỏ qua hoạt ảnh")
  const triggerVaultUnlock = useCallback(
    (skipImmediately = false) => {
      cancelUnlockTimer();
      if (skipImmediately || reducedMotion) {
        setInstantOpen(true);
        setVaultState('open');
        return;
      }
      setInstantOpen(false);
      setVaultState('unlocking');
      unlockTimerRef.current = window.setTimeout(() => {
        unlockTimerRef.current = null;
        setVaultState('open');
        submitLockRef.current = false;
      }, 1250);
    },
    [cancelUnlockTimer, reducedMotion]
  );

  const handleSkipAnimation = () => {
    cancelUnlockTimer();
    setInstantOpen(true);
    setVaultState('open');
    solutionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Switch active challenge (cancels pending timers & audio; restores saved open state without replaying anim)
  const handleSelectChallenge = (challengeId: string) => {
    cancelUnlockTimer();
    stopAllAudio();
    setShowSummary(false);
    setInputCode('');
    setShowGroupCodes(false);
    voiceRef.current?.resetTurnDedupe();

    const targetProg = gameState.progressById[challengeId];
    const alreadyOpen = targetProg?.status === 'solved' || targetProg?.solutionRevealed;
    setInstantOpen(Boolean(alreadyOpen));
    setVaultState(alreadyOpen ? 'open' : 'locked');

    setGameState((prev) => ({
      ...prev,
      activeChallengeId: challengeId,
      groupDrafts: createGroupDrafts(prev.groupCount),
      lastFeedback: {
        type: 'idle',
        message: alreadyOpen
          ? 'Thử thách này đã mở lời giải — bạn có thể xem lại cách giải bên dưới.'
          : 'Đọc bảng manh mối, nhập mã rồi bấm “Thử mở khóa”.',
      },
    }));
  };

  const handleChangePlayMode = (mode: CipherPlayMode) => {
    if (mode === gameState.playMode) return;
    cancelUnlockTimer();
    stopAllAudio();
    setShowGroupCodes(false);
    setGameState((prev) => ({
      ...prev,
      playMode: mode,
      groupDrafts: createGroupDrafts(prev.groupCount),
    }));
  };

  // Reset entire session ("Chơi lại")
  const handleReplayAll = () => {
    cancelUnlockTimer();
    stopAllAudio();
    clearF05Session();
    setShowSummary(false);
    setInputCode('');
    setShowGroupCodes(false);
    setInstantOpen(false);
    setVaultState('locked');
    setDialStepCount(0);
    voiceRef.current?.resetTurnDedupe();
    setGameState((prev) =>
      createCipherGameState({
        activeChallengeId: prev.activeChallengeId,
        playMode: prev.playMode,
        classSizeHint: prev.classSizeHint,
        groupCount: prev.groupCount,
      })
    );
  };

  // Keypad press (fixed layout, never jumps while typing)
  const handleKeypadInsert = (char: string) => {
    if (activeProgress.status === 'solved') return;
    soundBankRef.current?.unlock();
    soundBankRef.current?.playCipherKeyTap(isMutedRef.current);
    setDialStepCount((c) => c + 1);

    const maxLen = activeChallenge.kind === 'caesar_text' ? 18 : activeChallenge.expectedLength;
    setInputCode((prev) => (prev.length >= maxLen ? prev : prev + char));
  };

  const handleKeypadBackspace = () => {
    if (activeProgress.status === 'solved') return;
    soundBankRef.current?.unlock();
    soundBankRef.current?.playCipherKeyTap(isMutedRef.current);
    setInputCode((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (activeProgress.status === 'solved') return;
    soundBankRef.current?.unlock();
    setInputCode('');
  };

  // Submit code in Solo or Whole-Class mode (with double-click guard)
  const handleSubmitCode = () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    soundBankRef.current?.unlock();

    const res = submitCipherAttempt(gameState, inputCode);
    setGameState(res.state);

    if (res.outcome === 'format_error' || res.outcome === 'already_unlocked') {
      submitLockRef.current = false;
      return;
    }

    if (res.outcome === 'wrong') {
      soundBankRef.current?.playCipherSubmit(isMutedRef.current, false);
      setWrongPulseId((n) => n + 1);
      window.setTimeout(() => {
        submitLockRef.current = false;
      }, 220);
      return;
    }

    // Correct! Unlock vault
    soundBankRef.current?.playCipherSubmit(isMutedRef.current, true);
    soundBankRef.current?.playCipherVaultOpen(isMutedRef.current);
    triggerVaultUnlock(false);
  };

  // Simultaneous 2–6 groups submit
  const handleEvaluateGroups = () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    soundBankRef.current?.unlock();

    const res = evaluateSimultaneousGroups(gameState);
    setGameState(res.state);

    if (res.evaluatedCount === 0) {
      submitLockRef.current = false;
      return;
    }

    if (res.winningGroups.length > 0) {
      setShowGroupCodes(true);
      soundBankRef.current?.playCipherSubmit(isMutedRef.current, true);
      soundBankRef.current?.playCipherVaultOpen(isMutedRef.current);
      triggerVaultUnlock(false);
    } else {
      soundBankRef.current?.playCipherSubmit(isMutedRef.current, false);
      setWrongPulseId((n) => n + 1);
      window.setTimeout(() => {
        submitLockRef.current = false;
      }, 220);
    }
  };

  // Progressive Hints (Level 1 -> Level 2)
  const handleRequestHint = () => {
    soundBankRef.current?.unlock();
    const res = revealNextCipherHint(gameState);
    if (res.revealedLevel !== null) {
      setGameState(res.state);
      soundBankRef.current?.playCipherKeyTap(isMutedRef.current);
    }
  };

  // View full step-by-step solution (records 'viewed_solution' if not solved beforehand)
  const handleRevealSolution = () => {
    cancelUnlockTimer();
    soundBankRef.current?.unlock();
    setGameState((prev) => revealCipherSolution(prev));
    setInstantOpen(true);
    setVaultState('open');
  };

  // Strict vi-VN voice readout of currently visible clues ONLY
  const handleReadClues = () => {
    if (isMuted || !voiceEnabled) return;
    soundBankRef.current?.unlock();
    const text = `${activeChallenge.title}. ${activeChallenge.clues
      .map((c) => c.plainReadText)
      .join(' ')}`;
    voiceRef.current
      ?.replayText({
        text,
        isMuted,
        voiceEnabled,
      })
      .catch(() => {});
  };

  const handleExitToLibrary = () => {
    cancelUnlockTimer();
    stopAllAudio();
    onBackToLibrary();
  };

  const vaultStatusLabel =
    vaultState === 'open'
      ? activeProgress.status === 'solved'
        ? 'Két đã mở khóa'
        : 'Đang xem lời giải'
      : vaultState === 'unlocking'
        ? 'Đang mở chốt két...'
        : 'Két đang khóa';

  return (
    <div
      className={`w-full ${
        isFullscreen
          ? 'h-full p-3 sm:p-4'
          : 'rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-2xl'
      } bg-[#050C1C] text-slate-100 flex flex-col gap-4 overflow-y-auto`}
    >
      {/* HEADER BAR — Clean unboxed metadata + single-line functional controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Thư viện</span>
          </button>

          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight whitespace-nowrap">
              F05 · Giải mật mã 3D
            </h1>
            <span className="text-xs text-slate-400 whitespace-nowrap" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-medium text-teal-300 whitespace-nowrap">
              {F05_SAMPLE_BADGE}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRenderMode((m) => (m === '3d' ? '2d' : '3d'))}
            disabled={webglAutoFallback}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
            title={
              webglAutoFallback
                ? 'Đang tự động dùng chế độ 2D vì thiếu WebGL'
                : 'Chuyển giữa phòng két 3D và 2D nhẹ'
            }
          >
            {renderMode === '3d' ? <Layers className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
            <span>{renderMode === '3d' ? '3D' : '2D nhẹ'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              reducedMotion
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            {reducedMotion ? 'Ít động: Bật' : 'Ít động'}
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              isMuted
                ? 'bg-rose-950 border-rose-500/60 text-rose-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Tắt loa' : 'Âm thanh'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVoice}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              voiceEnabled && !isMuted
                ? 'bg-teal-950 border-teal-500/60 text-teal-200'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {voiceEnabled && !isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Giọng Việt</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Tổng kết</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 cursor-pointer"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* CHALLENGE TABS + CLASSROOM MODE BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0A162E] border border-slate-800 rounded-xl px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {F05_SAMPLE_CHALLENGES.map((ch) => {
            const prog = gameState.progressById[ch.id];
            const isActive = ch.id === activeChallenge.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSelectChallenge(ch.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span>
                  Màn {ch.order}: {ch.shortTitle}
                </span>
                <span className="ml-1.5 opacity-80 font-normal">
                  ({statusTextVi(prog.status)})
                </span>
              </button>
            );
          })}
        </div>

        {/* Organization Mode Segmented Control */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => handleChangePlayMode('solo')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
                gameState.playMode === 'solo'
                  ? 'bg-slate-100 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Tự luyện</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangePlayMode('class')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
                gameState.playMode === 'class'
                  ? 'bg-slate-100 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <School className="w-3.5 h-3.5" />
              <span>Cả lớp</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangePlayMode('groups')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
                gameState.playMode === 'groups'
                  ? 'bg-slate-100 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>2–6 Nhóm</span>
            </button>
          </div>
        </div>
      </div>

      {/* CLASSROOM SETTINGS STRIP (for Cả lớp / 2–6 Nhóm) */}
      {(gameState.playMode === 'class' || gameState.playMode === 'groups') && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#091832] border border-teal-500/35 rounded-xl px-4 py-2 text-xs text-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-teal-300">
              {gameState.playMode === 'class'
                ? 'Trình chiếu cả lớp (tiến độ chung):'
                : 'Thi giải mã theo nhóm (chốt đồng thời trên 1 máy):'}
            </span>
            <span className="text-slate-300">
              {gameState.playMode === 'class'
                ? 'Học sinh cả lớp thảo luận rồi giáo viên nhập mã chốt mở két.'
                : 'Các nhóm viết mã ra bảng con, giáo viên nhập kín cho từng nhóm rồi bấm Chốt đồng thời.'}
            </span>
          </div>

          <div className="flex items-center gap-3 tabular-nums">
            {gameState.playMode === 'groups' && (
              <label className="inline-flex items-center gap-1.5 font-semibold">
                <span className="text-slate-300">Số nhóm:</span>
                <select
                  value={gameState.groupCount}
                  onChange={(e) => {
                    const count = Number(e.target.value);
                    setGameState((prev) => ({
                      ...prev,
                      groupCount: count,
                      groupDrafts: createGroupDrafts(count),
                    }));
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} nhóm
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 font-semibold">
              <span className="text-slate-300">Sĩ số (1–50):</span>
              <input
                type="number"
                min={1}
                max={50}
                value={gameState.classSizeHint}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                  setGameState((prev) => ({ ...prev, classSizeHint: val }));
                }}
                className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-center font-bold"
              />
            </label>
          </div>
        </div>
      )}

      {/* MAIN 2-COLUMN SPLIT (16:9 desktop balanced; vertical stack on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start flex-1">
        {/* LEFT COLUMN: 3D VAULT STAGE + SKIP ANIMATION + CAESAR RULER */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="relative h-[300px] sm:h-[360px] lg:h-[390px]">
            {renderMode === '3d' && !webglAutoFallback ? (
              <Vault3DScene
                vaultState={vaultState}
                instantOpen={instantOpen}
                dialStepCount={dialStepCount}
                wrongPulseId={wrongPulseId}
                reducedMotion={reducedMotion}
                statusLabel={vaultStatusLabel}
                onWebGLFallback={handleWebGLFallback}
              />
            ) : (
              <Vault2DFallback
                vaultState={vaultState}
                instantOpen={instantOpen}
                dialStepCount={dialStepCount}
                wrongPulseId={wrongPulseId}
                reducedMotion={reducedMotion}
                statusLabel={vaultStatusLabel}
              />
            )}

            {/* Skip Animation Button — visible during unlock transition */}
            {vaultState === 'unlocking' && (
              <button
                type="button"
                onClick={handleSkipAnimation}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shadow-lg cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Bỏ qua hoạt ảnh</span>
              </button>
            )}
          </div>

          {/* Compact Progress Readout (clean unboxed metadata + tabular numerals) */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#0A162E] border border-slate-800 text-xs tabular-nums">
            <div className="flex items-center gap-2 text-slate-300">
              <span>Trạng thái:</span>
              <strong
                className={
                  activeProgress.status === 'solved'
                    ? 'text-amber-300'
                    : activeProgress.status === 'viewed_solution'
                      ? 'text-sky-300'
                      : 'text-white'
                }
              >
                {statusTextVi(activeProgress.status)}
              </strong>
              <span aria-hidden="true">·</span>
              <span>
                Lần thử: <strong className="text-white">{activeProgress.attempts}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Gợi ý: <strong className="text-white">{activeProgress.hintsUsed}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleReplayAll}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Chơi lại</span>
            </button>
          </div>

          {/* INTERACTIVE CAESAR TWO-ROW ALPHABET RULER (only for Challenge 3) */}
          {activeChallenge.kind === 'caesar_text' && (
            <div className="rounded-xl bg-[#0A162E] border border-slate-800 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-teal-300">
                  Bảng tra dịch vòng A–Z (mã hóa +3 · giải mã −3)
                </h3>
                <button
                  type="button"
                  onClick={() => setCaesarHelperOpen((v) => !v)}
                  className="text-xs text-slate-400 hover:text-white font-semibold cursor-pointer"
                >
                  {caesarHelperOpen ? 'Thu gọn' : 'Mở bảng tra'}
                </button>
              </div>

              <p className="text-xs text-amber-200 font-medium">
                {activeChallenge.samplePairText}
              </p>

              {caesarHelperOpen && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-300">
                    Bấm một chữ cái đã mã hóa bên dưới để xem chữ gốc khi lùi 3 vị trí:
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-[repeat(13,minmax(0,1fr))] gap-1 text-center font-mono text-[11px] tabular-nums">
                    {Array.from(ALPHABET_AZ).map((ch) => {
                      const selected = ch === caesarInspectChar;
                      const decoded = caesarShiftChar(ch, -(activeChallenge.caesarShift ?? 3));
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setCaesarInspectChar(ch)}
                          className={`py-1 rounded border flex flex-col items-center leading-tight cursor-pointer ${
                            selected
                              ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                              : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-teal-400'
                          }`}
                          title={`Mã hóa ${ch} → giải mã lùi 3 thành ${decoded}`}
                        >
                          <span>{ch}</span>
                          <span className={selected ? 'text-slate-900' : 'text-teal-400'}>
                            {decoded}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-slate-200 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 font-medium">
                    Chữ mã hóa <strong className="text-amber-300 font-mono">{caesarInspectChar}</strong>{' '}
                    khi dịch lùi 3 vị trí → chữ gốc{' '}
                    <strong className="text-teal-300 font-mono">
                      {caesarShiftChar(caesarInspectChar, -(activeChallenge.caesarShift ?? 3))}
                    </strong>{' '}
                    <span className="text-slate-400">
                      (ngược lại: dịch tiến 3 từ{' '}
                      {caesarShiftChar(caesarInspectChar, -(activeChallenge.caesarShift ?? 3))} →{' '}
                      {caesarInspectChar}).
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: CLUE BOARD + FIXED CODE INPUT & KEYPAD + HINTS + SOLUTION */}
        <div className="lg:col-span-7 flex flex-col gap-3.5">
          {/* CLUE BOARD */}
          <div className="rounded-xl bg-[#0A162E] border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs text-teal-300 font-semibold">
                  {activeChallenge.categoryLabel} · {activeChallenge.sourceBadge}
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">{activeChallenge.title}</h2>
              </div>
              <button
                type="button"
                onClick={handleReadClues}
                disabled={isMuted || !voiceEnabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 disabled:opacity-45 cursor-pointer"
                title="Đọc to bảng manh mối bằng giọng tiếng Việt"
              >
                <Volume2 className="w-3.5 h-3.5 text-teal-300" />
                <span>Đọc manh mối</span>
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{activeChallenge.instructionText}</p>

            {/* Clues List — Crisp high-contrast math rendering via shared MathView */}
            <div className="space-y-2 pt-1">
              {activeChallenge.clues.map((clue, idx) => (
                <div
                  key={clue.id}
                  className="flex items-start gap-3 px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-800"
                >
                  <span className="text-xs font-bold text-teal-300 tabular-nums shrink-0 pt-0.5 min-w-[78px]">
                    {idx + 1}. {clue.label}
                  </span>
                  <div className="text-sm sm:text-base text-white leading-relaxed flex-1">
                    <MathView content={clue.contentLatex} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CODE INPUT & FIXED KEYPAD (Solo / Whole Class) OR SIMULTANEOUS GROUPS PANEL */}
          <div className="rounded-xl bg-[#0A162E] border border-slate-800 p-4 space-y-3.5">
            {gameState.playMode !== 'groups' ? (
              <>
                {/* Input row + Fixed Submit button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="flex-1">
                    <label htmlFor="f05-code-input" className="sr-only">
                      Nhập mật mã mở két
                    </label>
                    <input
                      id="f05-code-input"
                      type="text"
                      inputMode={activeChallenge.kind === 'caesar_text' ? 'text' : 'numeric'}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={activeProgress.status === 'solved'}
                      value={inputCode}
                      onCompositionStart={() => {
                        isComposingRef.current = true;
                      }}
                      onCompositionEnd={() => {
                        isComposingRef.current = false;
                      }}
                      onChange={(e) => {
                        setInputCode(e.target.value);
                        setDialStepCount((c) => c + 1);
                      }}
                      onKeyDown={(e) => {
                        // CRITICAL: Do NOT submit on Enter while Vietnamese IME is composing!
                        if (
                          e.key === 'Enter' &&
                          !isComposingRef.current &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          handleSubmitCode();
                        }
                      }}
                      placeholder={
                        activeChallenge.kind === 'caesar_text'
                          ? 'Nhập mã chữ (A–Z, ví dụ: ...)'
                          : `Nhập đủ ${activeChallenge.expectedLength} chữ số (giữ cả số 0 đầu)`
                      }
                      className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:border-teal-400 focus:outline-none text-white font-mono text-lg sm:text-xl tracking-widest uppercase tabular-nums disabled:opacity-60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmitCode}
                    disabled={activeProgress.status === 'solved'}
                    className="h-12 px-5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-45 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Thử mở khóa</span>
                  </button>
                </div>

                {/* Fixed On-Screen Keypad (stays rock-steady while reading or typing) */}
                {activeChallenge.kind !== 'caesar_text' ? (
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                    {NUMERIC_KEYS.map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        disabled={activeProgress.status === 'solved'}
                        onClick={() => handleKeypadInsert(digit)}
                        className="h-11 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-white font-mono font-bold text-base tabular-nums disabled:opacity-40 cursor-pointer"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={activeProgress.status === 'solved' || inputCode.length === 0}
                      onClick={handleKeypadBackspace}
                      className="h-11 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-35 cursor-pointer"
                      title="Xóa 1 ký tự"
                      aria-label="Xóa 1 ký tự"
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={activeProgress.status === 'solved' || inputCode.length === 0}
                      onClick={handleKeypadClear}
                      className="h-11 rounded-lg bg-slate-800 hover:bg-rose-900 border border-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-35 cursor-pointer"
                      title="Xóa hết"
                      aria-label="Xóa hết"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {ALPHA_ROWS.map((row, rIdx) => (
                      <div key={rIdx} className="flex justify-center gap-1 flex-wrap">
                        {row.map((letter) => (
                          <button
                            key={letter}
                            type="button"
                            disabled={activeProgress.status === 'solved'}
                            onClick={() => handleKeypadInsert(letter)}
                            className="w-8 sm:w-9 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-white font-mono font-bold text-sm disabled:opacity-40 cursor-pointer"
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    ))}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={activeProgress.status === 'solved'}
                        onClick={() => handleKeypadInsert(' ')}
                        className="px-6 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        Khoảng trắng
                      </button>
                      <button
                        type="button"
                        disabled={activeProgress.status === 'solved' || inputCode.length === 0}
                        onClick={handleKeypadBackspace}
                        className="px-3.5 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer"
                      >
                        <Delete className="w-3.5 h-3.5" />
                        <span>Xóa 1</span>
                      </button>
                      <button
                        type="button"
                        disabled={activeProgress.status === 'solved' || inputCode.length === 0}
                        onClick={handleKeypadClear}
                        className="px-3.5 h-10 rounded-lg bg-slate-800 hover:bg-rose-900 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa hết</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* SIMULTANEOUS 2–6 GROUPS MASKED INPUT PANEL */
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-300">
                    Nhập mã của từng nhóm (tự động che ký tự trên màn chiếu chung):
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGroupCodes((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    {showGroupCodes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showGroupCodes ? 'Che mã nhóm' : 'Hiện mã đã nhập'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {gameState.groupDrafts.map((draft) => {
                    const isWinner = activeProgress.solvedGroupIndices.includes(draft.groupIndex);
                    return (
                      <div
                        key={draft.groupIndex}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                          isWinner
                            ? 'bg-emerald-950/45 border-emerald-500/60'
                            : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-200 whitespace-nowrap min-w-[60px]">
                          Nhóm {draft.groupIndex + 1}
                        </span>
                        <input
                          type={showGroupCodes ? 'text' : 'password'}
                          autoComplete="off"
                          value={draft.code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGameState((prev) => ({
                              ...prev,
                              groupDrafts: prev.groupDrafts.map((g) =>
                                g.groupIndex === draft.groupIndex ? { ...g, code: val } : g
                              ),
                            }));
                            setDialStepCount((c) => c + 1);
                          }}
                          placeholder="Nhập mã kín..."
                          className="flex-1 h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 focus:border-teal-400 focus:outline-none text-white font-mono text-sm"
                        />
                        {isWinner && (
                          <span className="text-xs font-bold text-emerald-300 whitespace-nowrap">
                            Đúng
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleEvaluateGroups}
                  className="w-full h-11 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Chốt đồng thời & mở khóa</span>
                </button>
              </div>
            )}

            {/* FEEDBACK BAR (Never color-only; pairs icon + explicit Vietnamese text) */}
            {gameState.lastFeedback.message && (
              <div
                className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border text-xs sm:text-sm font-medium ${
                  gameState.lastFeedback.type === 'correct'
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : gameState.lastFeedback.type === 'wrong' ||
                        gameState.lastFeedback.type === 'format_error'
                      ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                      : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                {gameState.lastFeedback.type === 'correct' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : gameState.lastFeedback.type === 'wrong' ||
                  gameState.lastFeedback.type === 'format_error' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Lock className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                )}
                <span>{gameState.lastFeedback.message}</span>
              </div>
            )}

            {/* HINTS & VIEW SOLUTION ACTION ROW (Fixed position) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestHint}
                  disabled={activeProgress.revealedHintLevel >= 2}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-200 disabled:opacity-40 cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>
                    {activeProgress.revealedHintLevel === 0
                      ? 'Gợi ý mức 1'
                      : activeProgress.revealedHintLevel === 1
                        ? 'Gợi ý mức 2'
                        : 'Đã mở hết gợi ý'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleRevealSolution}
                  disabled={activeProgress.solutionRevealed}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    {activeProgress.solutionRevealed ? 'Đang hiện lời giải' : 'Xem lời giải'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const idx = F05_SAMPLE_CHALLENGES.findIndex((c) => c.id === activeChallenge.id);
                  const next = F05_SAMPLE_CHALLENGES[(idx + 1) % F05_SAMPLE_CHALLENGES.length];
                  handleSelectChallenge(next.id);
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-200 cursor-pointer"
              >
                Đổi thử thách →
              </button>
            </div>
          </div>

          {/* PROGRESSIVE HINTS BOX (shown only when explicitly requested) */}
          {activeProgress.revealedHintLevel >= 1 && (
            <div className="rounded-xl bg-[#0F1B33] border border-amber-400/40 p-4 space-y-2.5 text-sm">
              <div className="font-bold text-amber-300 text-xs">Gợi ý mức 1 · Hướng suy nghĩ</div>
              <div className="text-slate-100 leading-relaxed">
                <MathView content={activeChallenge.hintLevel1Latex} />
              </div>

              {activeProgress.revealedHintLevel >= 2 && (
                <div className="pt-2.5 border-t border-slate-700/80 space-y-1.5">
                  <div className="font-bold text-amber-300 text-xs">
                    Gợi ý mức 2 · Phân tích bước cụ thể
                  </div>
                  <div className="text-slate-100 leading-relaxed">
                    <MathView content={activeChallenge.hintLevel2Latex} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP-BY-STEP SOLUTION PANEL (shown when solved or "Xem lời giải" clicked) */}
          {activeProgress.solutionRevealed && (
            <div
              ref={solutionSectionRef}
              className="rounded-xl bg-[#0B1B34] border border-amber-400/55 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-amber-300">
                    Lời giải chi tiết từng bước · Mã mở két: {activeChallenge.answer}
                    {activeChallenge.displayVietnameseAnswer
                      ? ` (${activeChallenge.displayVietnameseAnswer})`
                      : ''}
                  </h3>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Kết quả ghi nhận: <strong>{statusTextVi(activeProgress.status)}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSummary(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Xem tổng kết phiên
                </button>
              </div>

              <div className="text-sm text-slate-100 leading-relaxed">
                <MathView content={activeChallenge.solutionSummaryLatex} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeChallenge.solutionSteps.map((st, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-teal-300">{st.label}</span>
                      <span className="font-mono font-bold text-amber-300 tabular-nums">
                        {st.resultToken}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      <MathView content={st.detailLatex} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SESSION SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0A162E] border border-amber-400/60 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Tổng kết Giải mật mã 3D (F05)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {F05_SAMPLE_BADGE} · 3 thử thách Toán học, Suy luận & Dịch vòng chữ cái
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {/* 4-column KPI strip (tabular numerals) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center tabular-nums">
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div className="text-xs text-slate-400">Đã giải</div>
                <div className="text-xl font-bold text-amber-300">
                  {summary.solvedCount}/{summary.totalChallenges}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div className="text-xs text-slate-400">Đã xem lời giải</div>
                <div className="text-xl font-bold text-sky-300">
                  {summary.viewedSolutionCount}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div className="text-xs text-slate-400">Tổng lượt thử</div>
                <div className="text-xl font-bold text-white">{summary.totalAttempts}</div>
              </div>
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div className="text-xs text-slate-400">Gợi ý đã dùng</div>
                <div className="text-xl font-bold text-teal-300">{summary.totalHintsUsed}</div>
              </div>
            </div>

            {/* Per-challenge breakdown */}
            <div className="space-y-2">
              {summary.items.map(({ challenge, progress }) => (
                <div
                  key={challenge.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs tabular-nums"
                >
                  <div>
                    <div className="font-bold text-white">{challenge.title}</div>
                    <div className="text-slate-400">
                      {progress.attempts} lượt thử · {progress.hintsUsed} gợi ý
                      {progress.solvedGroupIndices.length > 0
                        ? ` · Nhóm đúng: ${progress.solvedGroupIndices
                            .map((g) => `Nhóm ${g + 1}`)
                            .join(', ')}`
                        : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold ${
                        progress.status === 'solved'
                          ? 'text-emerald-300'
                          : progress.status === 'viewed_solution'
                            ? 'text-sky-300'
                            : 'text-slate-400'
                      }`}
                    >
                      {statusTextVi(progress.status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectChallenge(challenge.id);
                        setShowSummary(false);
                      }}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold cursor-pointer"
                    >
                      Mở màn
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Required 4 Summary Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSummary(false);
                  if (!activeProgress.solutionRevealed) {
                    handleRevealSolution();
                  }
                  solutionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className="px-3 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 text-xs font-bold cursor-pointer"
              >
                Xem lại cách giải
              </button>
              <button
                type="button"
                onClick={handleReplayAll}
                className="px-3 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Chơi lại
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = F05_SAMPLE_CHALLENGES.findIndex((c) => c.id === activeChallenge.id);
                  const next = F05_SAMPLE_CHALLENGES[(idx + 1) % F05_SAMPLE_CHALLENGES.length];
                  handleSelectChallenge(next.id);
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Đổi thử thách
              </button>
              <button
                type="button"
                onClick={handleExitToLibrary}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Về thư viện
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cipher3DGame;
