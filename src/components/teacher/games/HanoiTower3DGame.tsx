import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Minimize2,
  RotateCcw,
  Undo2,
  Lightbulb,
  ArrowLeft,
  Box,
  Layers,
  Eye,
  EyeOff,
  BookOpen,
  Award,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  CheckCircle2,
  Clock,
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
  HanoiTower3DScene,
  HanoiTower2DBoard,
  HanoiAnimatedMove,
} from './HanoiTower3DScene';
import {
  HanoiPegId,
  HANOI_PEG_IDS,
  HANOI_PEG_META,
  HanoiGameMode,
  HanoiSessionState,
  HanoiHintResult,
  HANOI_FORMULA_BENCHMARKS,
  createInitialHanoiState,
  getHanoiMinMoves,
  getTopDisc,
  applyHanoiMove,
  undoHanoiMove,
  computeOptimalHintFromState,
  generateCanonicalSolutionSteps,
  buildCanonicalPreviewPegsAtStep,
  buildHanoiCompletionSummary,
  loadF03Session,
  saveF03Session,
} from './hanoiTower3dEngine';

export interface HanoiTower3DGameProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBackToLibrary?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const HanoiTower3DGame: React.FC<HanoiTower3DGameProps> = ({
  isFullscreen = false,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Hydrate persisted session (/demo isolated automatically)
  const [state, setState] = useState<HanoiSessionState>(
    () => loadF03Session() ?? createInitialHanoiState({ mode: 'guided', discCount: 3 })
  );

  const [selectedPeg, setSelectedPeg] = useState<HanoiPegId | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: 'info' | 'error' | 'success';
    text: string;
  } | null>(null);
  const [activeHint, setActiveHint] = useState<HanoiHintResult | null>(null);
  const [lastAnimatedMove, setLastAnimatedMove] = useState<HanoiAnimatedMove | null>(null);
  const animSeqRef = useRef<number>(1);

  // Separate isolated sample-solution viewer modal (NEVER mutates active board or history)
  const [sampleModalOpen, setSampleModalOpen] = useState<boolean>(false);
  const [sampleStepIndex, setSampleStepIndex] = useState<number>(0);
  const [sampleAutoPlaying, setSampleAutoPlaying] = useState<boolean>(false);

  // Audio, 3D/2D & Reduced Motion synced with A01/A02
  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted());
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled());
  const [hasVietnameseVoice, setHasVietnameseVoice] = useState<boolean>(true);
  const [force2D, setForce2D] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceControllerRef = useRef<EduGameVoiceController | null>(null);
  const turnTokenSeqRef = useRef<number>(1);
  const activeTurnTokenRef = useRef<string>('f03_tok_1');
  const lastGestureRef = useRef<{ sig: string; at: number }>({ sig: '', at: 0 });

  const stateRef = useRef<HanoiSessionState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const rotateTurnToken = useCallback(() => {
    turnTokenSeqRef.current += 1;
    const tok = `f03_tok_${turnTokenSeqRef.current}`;
    activeTurnTokenRef.current = tok;
    soundBankRef.current?.stopAll();
    soundBankRef.current?.setActiveTurnToken(tok);
    voiceControllerRef.current?.stop();
    stopAllGlobalEduSpeech();
    return tok;
  }, []);

  useEffect(() => {
    const bank = new EduGameSoundBank();
    bank.setActiveTurnToken(activeTurnTokenRef.current);
    const voice = new EduGameVoiceController(null);
    soundBankRef.current = bank;
    voiceControllerRef.current = voice;

    const unsub = voice.subscribe((snap) => {
      setHasVietnameseVoice(snap.vietnameseVoices.length > 0);
    });
    setHasVietnameseVoice(voice.getSnapshot().vietnameseVoices.length > 0);

    return () => {
      unsub();
      bank.stopAll();
      bank.dispose();
      voice.stop();
      voice.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        soundBankRef.current?.stopAll();
        voiceControllerRef.current?.stop();
        stopAllGlobalEduSpeech();
      } else {
        soundBankRef.current?.unlock();
      }
      return next;
    });
  }, []);

  const handleToggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      saveEduGameVoiceEnabled(next);
      if (!next) {
        voiceControllerRef.current?.stop();
        stopAllGlobalEduSpeech();
      }
      return next;
    });
  }, []);

  // Optional timer (strictly off unless toggled on)
  useEffect(() => {
    if (!state.timerEnabled || state.isCompleted) return;
    const id = window.setInterval(() => {
      setState((prev) =>
        prev.timerEnabled && !prev.isCompleted
          ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }
          : prev
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.timerEnabled, state.isCompleted]);

  // Persist session automatically (isolated in /demo)
  useEffect(() => {
    saveF03Session(state);
  }, [state]);

  // Execute a validated move (shared by Click-to-Select, Drag-and-Drop, Keyboard, and "Áp dụng gợi ý")
  const executeMove = useCallback(
    (from: HanoiPegId, to: HanoiPegId, appliedViaHint = false) => {
      // Anti-double-click / rapid duplicate gesture guard (within 90ms)
      const now = performance.now();
      const sig = `${from}->${to}`;
      if (!appliedViaHint && lastGestureRef.current.sig === sig && now - lastGestureRef.current.at < 90) {
        return;
      }
      lastGestureRef.current = { sig, at: now };

      const cur = stateRef.current;
      const fromSlot = cur.pegs[from].length - 1;
      const toSlot = cur.pegs[to].length;
      const res = applyHanoiMove(cur, from, to, { appliedViaHint });

      if (!res.moved) {
        setFeedback({
          kind: 'error',
          text: res.errorReason ?? 'Nước đi không hợp lệ.',
        });
        soundBankRef.current?.unlock();
        soundBankRef.current?.playHanoiInvalidMove(isMuted, activeTurnTokenRef.current);
        return;
      }

      // Cancel stale hint whenever board changes
      setActiveHint(null);
      setSelectedPeg(null);
      stateRef.current = res.nextState;
      setState(res.nextState);

      if (res.moveRecord) {
        animSeqRef.current += 1;
        setLastAnimatedMove({
          id: animSeqRef.current,
          disc: res.moveRecord.disc,
          from,
          to,
          fromSlot: Math.max(0, fromSlot),
          toSlot,
        });
      }

      soundBankRef.current?.unlock();
      const tok = activeTurnTokenRef.current;

      if (res.justCompleted) {
        const minSteps = getHanoiMinMoves(res.nextState.discCount);
        setFeedback({
          kind: 'success',
          text: `Hoàn thành tháp ${res.nextState.discCount} đĩa sau ${res.nextState.moveCount}/${minSteps} bước!`,
        });
        soundBankRef.current?.playHanoiCompleteFanfare(isMuted, tok);
        if (!isMuted && voiceEnabled && hasVietnameseVoice) {
          voiceControllerRef.current
            ?.replayText({
              text: `Chúc mừng! Đã hoàn thành Tháp Hà Nội ${res.nextState.discCount} đĩa sau ${res.nextState.moveCount} bước.`,
              isMuted,
              voiceEnabled,
            })
            .catch(() => {});
        }
      } else {
        setFeedback({
          kind: 'info',
          text: `Đã chuyển đĩa số ${res.moveRecord?.disc} từ ${HANOI_PEG_META[from].shortLabel} sang ${HANOI_PEG_META[to].shortLabel}.`,
        });
        soundBankRef.current?.playHanoiPlaceDisc(isMuted, res.moveRecord?.disc ?? 1, tok);
      }
    },
    [hasVietnameseVoice, isMuted, voiceEnabled]
  );

  // Default interaction: "Chọn cọc nguồn -> Chọn cọc đích"
  const handleSelectPeg = useCallback(
    (peg: HanoiPegId) => {
      const cur = stateRef.current;
      if (cur.isCompleted) return;

      if (selectedPeg === null) {
        const top = getTopDisc(cur.pegs, peg);
        if (top === null) {
          setFeedback({
            kind: 'error',
            text: `${HANOI_PEG_META[peg].fullLabel} đang trống — hãy chọn cọc có đĩa để nhấc.`,
          });
          soundBankRef.current?.unlock();
          soundBankRef.current?.playHanoiInvalidMove(isMuted, activeTurnTokenRef.current);
          return;
        }
        setSelectedPeg(peg);
        setFeedback({
          kind: 'info',
          text: `Đã nhấc đĩa số ${top} từ ${HANOI_PEG_META[peg].fullLabel}. Chọn cọc đích để đặt hoặc nhấn Esc để hủy.`,
        });
        soundBankRef.current?.unlock();
        soundBankRef.current?.playHanoiLiftDisc(isMuted, activeTurnTokenRef.current);
        return;
      }

      if (selectedPeg === peg) {
        setSelectedPeg(null);
        setFeedback({
          kind: 'info',
          text: `Đã bỏ chọn ${HANOI_PEG_META[peg].shortLabel}.`,
        });
        return;
      }

      executeMove(selectedPeg, peg, false);
    },
    [executeMove, isMuted, selectedPeg]
  );

  const handleDragMove = useCallback(
    (from: HanoiPegId, to: HanoiPegId) => {
      setSelectedPeg(null);
      executeMove(from, to, false);
    },
    [executeMove]
  );

  const handleUndo = useCallback(() => {
    const cur = stateRef.current;
    if (cur.history.length === 0) return;
    const res = undoHanoiMove(cur);
    if (!res.undone) return;

    setSelectedPeg(null);
    setActiveHint(null);
    setLastAnimatedMove(null);
    stateRef.current = res.nextState;
    setState(res.nextState);
    setFeedback({
      kind: 'info',
      text: res.revertedMove
        ? `Đã hoàn tác nước chuyển đĩa số ${res.revertedMove.disc} (${res.revertedMove.from} → ${res.revertedMove.to}).`
        : 'Đã hoàn tác bước gần nhất.',
    });
    soundBankRef.current?.unlock();
    soundBankRef.current?.playHanoiLiftDisc(isMuted, activeTurnTokenRef.current);
  }, [isMuted]);

  const handleRequestHint = useCallback(() => {
    const cur = stateRef.current;
    if (cur.isCompleted) return;
    setSelectedPeg(null);
    const hint = computeOptimalHintFromState(cur.pegs, cur.discCount);
    setActiveHint(hint);

    if (hint.status === 'found' && hint.move && !isMuted && voiceEnabled && hasVietnameseVoice) {
      voiceControllerRef.current
        ?.replayText({
          text: `Gợi ý: chuyển đĩa số ${hint.move.disc} từ cọc ${hint.move.from} sang cọc ${hint.move.to}.`,
          isMuted,
          voiceEnabled,
        })
        .catch(() => {});
    }
  }, [hasVietnameseVoice, isMuted, voiceEnabled]);

  const handleApplyHint = useCallback(() => {
    if (!activeHint || activeHint.status !== 'found' || !activeHint.move) return;
    executeMove(activeHint.move.from, activeHint.move.to, true);
  }, [activeHint, executeMove]);

  const handleResetGame = useCallback(
    (overrides?: {
      mode?: HanoiGameMode;
      discCount?: number;
      groupsCount?: number;
      timerEnabled?: boolean;
    }) => {
      rotateTurnToken();
      const cur = stateRef.current;
      const nextMode = overrides?.mode ?? cur.mode;
      const nextDiscs =
        overrides?.discCount ??
        (overrides?.mode === 'guided' && cur.mode !== 'guided' ? 3 : cur.discCount);
      const fresh = createInitialHanoiState({
        mode: nextMode,
        discCount: nextDiscs,
        groupsCount: overrides?.groupsCount ?? cur.groupsCount,
        timerEnabled: overrides?.timerEnabled ?? (nextMode === 'guided' ? false : cur.timerEnabled),
      });
      stateRef.current = fresh;
      setState(fresh);
      setSelectedPeg(null);
      setActiveHint(null);
      setLastAnimatedMove(null);
      setFeedback(null);
    },
    [rotateTurnToken]
  );

  // Separate Canonical Sample Viewer state (isolated from live board!)
  const canonicalSteps = useMemo(
    () => (sampleModalOpen ? generateCanonicalSolutionSteps(state.discCount) : []),
    [sampleModalOpen, state.discCount]
  );

  const canonicalPreviewPegs = useMemo(
    () =>
      sampleModalOpen
        ? buildCanonicalPreviewPegsAtStep(state.discCount, canonicalSteps, sampleStepIndex)
        : state.pegs,
    [canonicalSteps, sampleModalOpen, sampleStepIndex, state.discCount, state.pegs]
  );

  useEffect(() => {
    if (!sampleModalOpen || !sampleAutoPlaying) return;
    if (sampleStepIndex >= canonicalSteps.length) {
      setSampleAutoPlaying(false);
      return;
    }
    const timer = window.setInterval(() => {
      setSampleStepIndex((prev) => {
        if (prev + 1 >= canonicalSteps.length) {
          setSampleAutoPlaying(false);
          return canonicalSteps.length;
        }
        return prev + 1;
      });
    }, reducedMotion ? 1100 : 750);
    return () => window.clearInterval(timer);
  }, [canonicalSteps.length, reducedMotion, sampleAutoPlaying, sampleModalOpen, sampleStepIndex]);

  // Keyboard Controls: 1/2/3 or A/B/C for pegs, Esc to cancel, Ctrl+Z Undo, H Hint
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (sampleModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSampleAutoPlaying(false);
          setSampleModalOpen(false);
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (selectedPeg !== null) {
          e.preventDefault();
          setSelectedPeg(null);
          setFeedback({ kind: 'info', text: 'Đã bỏ chọn cọc nguồn.' });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.repeat) return;
      const lower = e.key.toLowerCase();
      if (lower === '1' || lower === 'a') {
        e.preventDefault();
        handleSelectPeg('A');
      } else if (lower === '2' || lower === 'b') {
        e.preventDefault();
        handleSelectPeg('B');
      } else if (lower === '3' || lower === 'c') {
        e.preventDefault();
        handleSelectPeg('C');
      } else if (lower === 'h') {
        e.preventDefault();
        handleRequestHint();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRequestHint, handleSelectPeg, handleUndo, sampleModalOpen, selectedPeg]);

  const minMoves = useMemo(() => getHanoiMinMoves(state.discCount), [state.discCount]);
  const completionSummary = useMemo(
    () => (state.isCompleted ? buildHanoiCompletionSummary(state) : null),
    [state]
  );

  const guidedInstruction = useMemo(() => {
    if (state.isCompleted) {
      return `Xuất sắc! Đã chuyển trọn vẹn ${state.discCount} đĩa sang Cọc C – Đích.`;
    }
    if (selectedPeg) {
      const top = getTopDisc(state.pegs, selectedPeg);
      return `Đang nhấc đĩa số ${top} từ ${HANOI_PEG_META[selectedPeg].shortLabel}. Chọn một cọc trống hoặc cọc có đĩa trên cùng lớn hơn ${top}.`;
    }
    if (state.moveCount === 0) {
      return `Bước 1: Chọn Cọc A – Xuất phát (phím 1/A) để nhấc đĩa số 1 trên cùng, rồi chọn cọc đích muốn đặt.`;
    }
    return `Chọn cọc nguồn có đĩa trên cùng muốn chuyển, sau đó chọn cọc đích hợp lệ. Mục tiêu: chuyển cả chồng ${state.discCount} đĩa sang Cọc C – Đích.`;
  }, [selectedPeg, state.discCount, state.isCompleted, state.moveCount, state.pegs]);

  const handleExit = useCallback(() => {
    rotateTurnToken();
    onBackToLibrary?.();
  }, [onBackToLibrary, rotateTurnToken]);

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-dvh overflow-y-auto' : 'min-h-[640px] rounded-2xl border border-slate-700/60'
      } bg-[#061024] text-white flex flex-col`}
    >
      {/* TOP BAR — Clean single-line controls, A01/A02 audio consistency */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0B172F] border-b border-slate-700/60">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToLibrary && (
            <button
              type="button"
              onClick={handleExit}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Thư viện</span>
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
              F03 · Tháp Hà Nội 3D
            </h2>
            <p className="text-xs text-slate-300 truncate tabular-nums">
              {state.discCount} đĩa · Tối thiểu {minMoves} bước · Bước hiện tại: {state.moveCount}
            </p>
          </div>
        </div>

        {/* 3 Modes Segmented Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#071124] border border-slate-700/70">
          {(
            [
              { key: 'guided' as HanoiGameMode, label: 'Làm quen' },
              { key: 'challenge' as HanoiGameMode, label: 'Thử thách ít bước' },
              { key: 'classroom' as HanoiGameMode, label: 'Cả lớp cùng giải' },
            ]
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => handleResetGame({ mode: m.key })}
              className={`px-3 py-2 min-h-[38px] rounded-lg text-xs sm:text-sm font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.mode === m.key
                  ? 'bg-amber-400 text-[#061024]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Utility Controls: Speaker (A01/A02), Voice, 3D/2D, Reduced Motion, Fullscreen */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
              isMuted
                ? 'bg-slate-800/90 text-slate-300 border-slate-600'
                : 'bg-teal-500/20 text-teal-200 border-teal-400/50 hover:bg-teal-500/30'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? 'Tắt loa' : 'Loa bật'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={!hasVietnameseVoice}
            title={
              hasVietnameseVoice
                ? 'Đọc hướng dẫn bằng giọng tiếng Việt'
                : 'Trình duyệt hiện không có giọng tiếng Việt'
            }
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
              !hasVietnameseVoice
                ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                : voiceEnabled && !isMuted
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 cursor-pointer'
                : 'bg-slate-800/90 text-slate-300 border-slate-600 cursor-pointer'
            }`}
          >
            <Volume1 className="w-4 h-4" />
            <span className="hidden xl:inline">{voiceEnabled ? 'Giọng Việt' : 'Tắt giọng'}</span>
          </button>

          <button
            type="button"
            onClick={() => setForce2D((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/80 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            {force2D ? <Layers className="w-4 h-4 text-teal-300" /> : <Box className="w-4 h-4 text-teal-300" />}
            <span>{force2D ? '2D' : '3D'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            title="Chế độ giảm chuyển động"
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold border whitespace-nowrap cursor-pointer ${
              reducedMotion
                ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                : 'bg-slate-800 text-slate-300 border-slate-600/80 hover:bg-slate-700'
            }`}
          >
            {reducedMotion ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden xl:inline">Giảm CĐ</span>
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600/80 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden lg:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN TWO-COLUMN LAYOUT (16:9 Projector & Mobile Friendly) */}
      <main className="flex-1 p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT / PRIMARY PLAY BOARD (8 cols on desktop) */}
        <section className="lg:col-span-8 flex flex-col gap-3.5">
          {/* Guided coaching or Classroom rotation banner */}
          {state.mode === 'guided' && (
            <div className="rounded-xl bg-[#0D1C38] border border-teal-400/35 px-4 py-2.5 text-xs sm:text-sm text-teal-100 font-medium">
              <strong className="text-teal-300 mr-1.5">Hướng dẫn Làm quen:</strong>
              {guidedInstruction}
            </div>
          )}

          {state.mode === 'classroom' && (
            <div className="rounded-xl bg-[#0D1C38] border border-amber-400/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-amber-100 font-bold">
                <Users className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  Lượt đề xuất & giải thích: <strong className="text-amber-300">Nhóm {state.activeGroupIndex + 1}/{state.groupsCount}</strong>
                </span>
              </div>
              <span className="text-slate-300 tabular-nums">
                Tiến độ chung cả lớp: <strong className="text-white">{state.moveCount}</strong> bước (mục tiêu {minMoves})
              </span>
            </div>
          )}

          {/* 3D / 2D Interactive Wooden Tower Board */}
          <div className="w-full h-[320px] sm:h-[395px] lg:h-[420px]">
            <HanoiTower3DScene
              discCount={state.discCount}
              pegs={state.pegs}
              selectedPeg={selectedPeg}
              hintMove={activeHint?.status === 'found' ? activeHint.move : null}
              lastAnimatedMove={lastAnimatedMove}
              reducedMotion={reducedMotion}
              force2D={force2D}
              disabled={state.isCompleted}
              onSelectPeg={handleSelectPeg}
              onDragMove={handleDragMove}
              onWebGLFallback={() => setForce2D(true)}
            />
          </div>

          {/* 3 Accessible Peg Action Buttons (Default "Chọn cọc nguồn -> Chọn cọc đích" — works smoothly for 8 discs on mobile!) */}
          <div className="grid grid-cols-3 gap-2.5">
            {HANOI_PEG_IDS.map((pegId, idx) => {
              const top = getTopDisc(state.pegs, pegId);
              const isSelected = selectedPeg === pegId;
              const isHintFrom = activeHint?.status === 'found' && activeHint.move?.from === pegId;
              const isHintTo = activeHint?.status === 'found' && activeHint.move?.to === pegId;

              let btnClass =
                'bg-[#0D1A33] border-slate-600/80 text-white hover:border-teal-400/70';
              let stateText = top !== null ? `Trên cùng: Đĩa ${top}` : 'Cọc trống';

              if (isSelected) {
                btnClass = 'bg-amber-400 text-[#061024] border-white shadow-md';
                stateText = `Đang nhấc Đĩa ${top} (chọn lại để hủy)`;
              } else if (selectedPeg !== null) {
                const movingDisc = getTopDisc(state.pegs, selectedPeg);
                const canPlace = movingDisc !== null && (top === null || movingDisc < top);
                if (canPlace) {
                  btnClass = 'bg-teal-500/20 border-teal-400 text-teal-100 hover:bg-teal-500/30';
                  stateText = `Đặt Đĩa ${movingDisc} vào đây`;
                } else {
                  btnClass = 'bg-[#081327] border-slate-700 text-slate-400';
                  stateText = `Đĩa ${top} nhỏ hơn Đĩa ${movingDisc}`;
                }
              } else if (isHintFrom) {
                btnClass = 'bg-amber-500/20 border-amber-400 text-amber-100';
                stateText = `Gợi ý: nhấc Đĩa ${top}`;
              } else if (isHintTo) {
                btnClass = 'bg-teal-500/20 border-teal-400 text-teal-100';
                stateText = 'Gợi ý: đặt sang đây';
              }

              return (
                <button
                  key={pegId}
                  type="button"
                  disabled={state.isCompleted}
                  onClick={() => handleSelectPeg(pegId)}
                  className={`rounded-xl border-2 px-2.5 py-3 min-h-[60px] flex flex-col items-center justify-center text-center transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default ${btnClass}`}
                >
                  <span className="text-xs sm:text-sm font-black leading-tight">
                    {HANOI_PEG_META[pegId].fullLabel}
                  </span>
                  <span className="text-[11px] font-semibold opacity-90 mt-0.5 leading-tight">
                    {stateText} · Phím {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Primary Action Toolbar */}
          <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={state.history.length === 0}
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-white text-xs sm:text-sm font-bold cursor-pointer disabled:cursor-default"
              >
                <Undo2 className="w-4 h-4" />
                <span>Hoàn tác</span>
              </button>

              <button
                type="button"
                disabled={state.isCompleted}
                onClick={handleRequestHint}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-teal-400 hover:bg-teal-300 disabled:opacity-45 text-[#061024] text-xs sm:text-sm font-black cursor-pointer disabled:cursor-default"
              >
                <Lightbulb className="w-4 h-4" />
                <span>Gợi ý</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSampleStepIndex(0);
                  setSampleAutoPlaying(false);
                  setSampleModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-400/35 text-xs sm:text-sm font-bold cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Xem lời giải mẫu</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleResetGame()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-bold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Chơi lại</span>
            </button>
          </div>

          {/* Inline Feedback Banner */}
          {feedback && (
            <div
              role="status"
              className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold border ${
                feedback.kind === 'error'
                  ? 'bg-rose-500/15 border-rose-400/50 text-rose-100'
                  : feedback.kind === 'success'
                  ? 'bg-teal-500/20 border-teal-400/60 text-teal-100'
                  : 'bg-[#0B172F] border-slate-700 text-slate-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Completion Summary Card */}
          {state.isCompleted && completionSummary && (
            <div className="rounded-2xl bg-teal-500/15 border-2 border-teal-400/60 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Award className="w-7 h-7 text-amber-300 shrink-0" />
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      {completionSummary.headline}
                    </h3>
                    <p className="text-xs sm:text-sm text-teal-100 tabular-nums">
                      Số bước: <strong>{completionSummary.actualMoves}/{completionSummary.minMoves}</strong>
                      {completionSummary.deltaMoves > 0
                        ? ` · Chênh lệch +${completionSummary.deltaMoves} bước`
                        : ' · Chênh lệch 0 bước'}
                      {state.timerEnabled ? ` · Thời gian ${formatDuration(state.elapsedSeconds)}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetGame()}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] font-black text-sm cursor-pointer"
                >
                  Chơi lại bàn mới
                </button>
              </div>

              {completionSummary.supportNote && (
                <p className="text-xs sm:text-sm text-amber-200 font-semibold">
                  {completionSummary.supportNote}
                </p>
              )}

              <div className="text-xs sm:text-sm text-slate-100 bg-[#071124]/80 rounded-xl p-3 border border-slate-700/70">
                Công thức tổng quát cho {state.discCount} đĩa từ trạng thái ban đầu:{' '}
                <MathView content={`\\(T(${state.discCount}) = 2^{${state.discCount}} - 1 = ${minMoves}\\)`} /> bước.
              </div>
            </div>
          )}
        </section>

        {/* RIGHT / SETTINGS, OPTIMAL HINT, FORMULA & HISTORY (4 cols on desktop) */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          {/* Counters & Configuration Card */}
          <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-4 space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
              <div className="rounded-xl bg-[#081327] border border-slate-700/60 p-2.5">
                <div className="text-[11px] text-slate-400 font-semibold">Số bước</div>
                <div className="text-xl font-black text-white">{state.moveCount}</div>
              </div>
              <div className="rounded-xl bg-[#081327] border border-slate-700/60 p-2.5">
                <div className="text-[11px] text-slate-400 font-semibold">Tối thiểu</div>
                <div className="text-xl font-black text-amber-300">{minMoves}</div>
              </div>
              <div className="rounded-xl bg-[#081327] border border-slate-700/60 p-2.5">
                <div className="text-[11px] text-slate-400 font-semibold">Hỗ trợ</div>
                <div className="text-sm font-extrabold text-teal-300 mt-1">
                  {state.undoCount} HT · {state.hintsAppliedCount} GY
                </div>
              </div>
            </div>

            {/* Disc Count Selector (3..8) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Số đĩa (3–8 đĩa)</span>
                <span className="text-slate-400">Đĩa 1 nhỏ nhất</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {[3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleResetGame({ discCount: n })}
                    className={`py-2 min-h-[40px] rounded-lg text-sm font-black transition-colors cursor-pointer ${
                      state.discCount === n
                        ? 'bg-teal-400 text-[#061024]'
                        : 'bg-[#081327] text-slate-200 border border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Classroom Group Count (2..6) */}
            {state.mode === 'classroom' && (
              <div className="space-y-1.5 pt-1 border-t border-slate-700/70">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Nhóm luân phiên (2–6 nhóm)</span>
                  <span className="text-slate-400">Không gán điểm giả</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[2, 3, 4, 5, 6].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          groupsCount: g,
                          activeGroupIndex: prev.activeGroupIndex % g,
                        }))
                      }
                      className={`py-2 min-h-[38px] rounded-lg text-xs font-black cursor-pointer ${
                        state.groupsCount === g
                          ? 'bg-amber-400 text-[#061024]'
                          : 'bg-[#081327] text-slate-200 border border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {g} nhóm
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Timer Toggle (off by default) */}
            {state.mode !== 'guided' && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-700/70 text-xs">
                <span className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Đồng hồ (tùy chọn)</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setState((prev) => ({ ...prev, timerEnabled: !prev.timerEnabled }))
                  }
                  className={`px-3 py-1.5 rounded-lg font-bold tabular-nums cursor-pointer ${
                    state.timerEnabled
                      ? 'bg-teal-400/20 text-teal-200 border border-teal-400/50'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {state.timerEnabled ? `Đang bật · ${formatDuration(state.elapsedSeconds)}` : 'Đang tắt'}
                </button>
              </div>
            )}
          </div>

          {/* Active Optimal Hint Panel (Only applies when player explicitly clicks "Áp dụng gợi ý") */}
          {activeHint && (
            <div className="rounded-2xl bg-teal-500/12 border-2 border-teal-400/55 p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold text-teal-300">
                    {activeHint.isProvenOptimal ? activeHint.label : 'Trạng thái gợi ý'}
                  </div>
                  {activeHint.move && (
                    <div className="text-base font-black text-white mt-0.5 tabular-nums">
                      Đĩa {activeHint.move.disc}: {activeHint.move.from} → {activeHint.move.to}
                      {activeHint.remainingOptimalMoves !== null && (
                        <span className="text-xs font-bold text-amber-300 ml-2">
                          (còn {activeHint.remainingOptimalMoves} bước)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveHint(null)}
                  aria-label="Đóng gợi ý"
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs leading-relaxed text-slate-200">{activeHint.explanation}</p>

              {activeHint.status === 'found' && activeHint.move && (
                <button
                  type="button"
                  onClick={handleApplyHint}
                  className="w-full py-2.5 min-h-[42px] rounded-xl bg-teal-400 hover:bg-teal-300 text-[#061024] font-black text-xs sm:text-sm cursor-pointer"
                >
                  Áp dụng gợi ý ({activeHint.move.from} → {activeHint.move.to})
                </button>
              )}
            </div>
          )}

          {/* Mathematical Formula & Recursive Explanation Card (Shared MathView) */}
          <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-4 space-y-3 text-xs leading-relaxed text-slate-200">
            <h3 className="text-sm font-extrabold text-white">
              Khám phá công thức số bước tối thiểu
            </h3>
            <p>
              Với bài chuẩn chuyển toàn bộ chồng <MathView content="\(n\)" /> đĩa từ cọc A sang cọc C trên ba cọc, số bước tối thiểu là{' '}
              <MathView content="\(T(n) = 2^n - 1\)" className="font-bold text-amber-300" />.
            </p>
            <div className="rounded-xl bg-[#081327] border border-slate-700/70 p-3 space-y-1.5">
              <div className="font-bold text-teal-300">Lập luận 3 bước đệ quy:</div>
              <div>1. Chuyển <MathView content="\(n-1\)" /> đĩa trên sang cọc phụ B: cần <MathView content="\(T(n-1)\)" /> bước.</div>
              <div>2. Chuyển đĩa lớn nhất (đĩa <MathView content="\(n\)" />) từ A sang đích C: cần <MathView content="\(1\)" /> bước.</div>
              <div>3. Chuyển <MathView content="\(n-1\)" /> đĩa từ cọc phụ B lên trên đĩa lớn nhất ở C: cần <MathView content="\(T(n-1)\)" /> bước.</div>
              <div className="pt-1 text-amber-200 font-semibold">
                Suy ra <MathView content="\(T(1) = 1\)" /> và <MathView content="\(T(n) = 2T(n-1) + 1\)" />.
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 tabular-nums">
              {HANOI_FORMULA_BENCHMARKS.slice(0, 6).map((b) => (
                <div
                  key={b.discs}
                  className={`rounded-lg px-2 py-1.5 border text-center ${
                    b.discs === state.discCount
                      ? 'bg-amber-400/20 border-amber-400 text-amber-200 font-bold'
                      : 'bg-[#081327] border-slate-700/60 text-slate-300'
                  }`}
                >
                  <div>{b.discs} đĩa</div>
                  <div className="font-black text-white">{b.minMoves} bước</div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400">
              Lưu ý: Công thức <MathView content="\(2^n - 1\)" /> áp dụng cho bài chuẩn từ trạng thái ban đầu. Số bước tối ưu còn lại giữa phiên phụ thuộc vị trí hiện tại của các đĩa.
            </p>
          </div>

          {/* Move History Log */}
          <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="text-white">Lịch sử nước đi</span>
              <span className="tabular-nums">{state.history.length} bước</span>
            </div>
            <div className="max-h-[140px] overflow-y-auto rounded-xl bg-[#071124] border border-slate-800 divide-y divide-slate-800/80 text-xs tabular-nums">
              {state.history.length === 0 ? (
                <div className="p-3 text-center text-slate-400">
                  Chưa có nước đi nào. Chọn Cọc A để bắt đầu!
                </div>
              ) : (
                [...state.history].reverse().map((m) => (
                  <div key={m.stepNumber} className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-300">
                      #{m.stepNumber} · Đĩa <strong className="text-white">{m.disc}</strong> ({m.from} → {m.to})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {m.appliedViaHint ? 'Gợi ý' : m.proposedByGroup ?? 'Tự đi'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* SEPARATE ISOLATED SAMPLE SOLUTION MODAL (Never modifies live game board or history!) */}
      {sampleModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Minh họa lời giải mẫu Tháp Hà Nội"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-[#0B172F] border border-slate-600 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-white">
                  Minh họa lời giải mẫu ({state.discCount} đĩa · {canonicalSteps.length} bước)
                </h3>
                <p className="text-xs text-slate-300">
                  Màn minh họa tách biệt — bàn đang chơi và lịch sử của bạn được giữ nguyên.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSampleAutoPlaying(false);
                  setSampleModalOpen(false);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                aria-label="Đóng minh họa"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-[260px] sm:h-[300px]">
              <HanoiTower2DBoard
                discCount={state.discCount}
                pegs={canonicalPreviewPegs}
                selectedPeg={null}
                hintMove={
                  sampleStepIndex < canonicalSteps.length
                    ? {
                        from: canonicalSteps[sampleStepIndex].from,
                        to: canonicalSteps[sampleStepIndex].to,
                        disc: canonicalSteps[sampleStepIndex].disc,
                      }
                    : null
                }
                lastAnimatedMove={null}
                disabled
                onSelectPeg={() => {}}
                onDragMove={() => {}}
              />
            </div>

            <div className="rounded-xl bg-[#071124] border border-slate-700 p-3 text-xs sm:text-sm text-slate-200 flex items-center justify-between gap-2">
              <span className="font-semibold">
                {sampleStepIndex === 0
                  ? `Trạng thái ban đầu: tất cả ${state.discCount} đĩa ở Cọc A.`
                  : canonicalSteps[sampleStepIndex - 1]
                  ? `Bước ${sampleStepIndex}/${canonicalSteps.length}: ${canonicalSteps[sampleStepIndex - 1].explanation}`
                  : 'Hoàn thành!'}
              </span>
              {sampleStepIndex === canonicalSteps.length && (
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sampleStepIndex <= 0}
                  onClick={() => {
                    setSampleAutoPlaying(false);
                    setSampleStepIndex((s) => Math.max(0, s - 1));
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Lùi</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sampleStepIndex >= canonicalSteps.length) {
                      setSampleStepIndex(0);
                      setSampleAutoPlaying(true);
                    } else {
                      setSampleAutoPlaying((v) => !v);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] text-xs font-black cursor-pointer"
                >
                  {sampleAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{sampleAutoPlaying ? 'Tạm dừng' : 'Chạy minh họa'}</span>
                </button>
                <button
                  type="button"
                  disabled={sampleStepIndex >= canonicalSteps.length}
                  onClick={() => {
                    setSampleAutoPlaying(false);
                    setSampleStepIndex((s) => Math.min(canonicalSteps.length, s + 1));
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold cursor-pointer"
                >
                  <span>Tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-xs font-bold text-slate-300 tabular-nums">
                Bước {sampleStepIndex} / {canonicalSteps.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HanoiTower3DGame;
