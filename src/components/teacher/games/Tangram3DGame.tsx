import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ArrowLeft,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  Undo2,
  CornerDownLeft,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Box,
  Grid2x2,
  Users,
  User,
  Clock,
  Mic,
  MessageSquare,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { MathView } from '../../MathView';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  saveEduGameMuted,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import { isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';
import {
  TangramPlayMode,
  TangramPieceId,
  TangramGameState,
  TangramHintResult,
  TangramSolutionSlot,
  TANGRAM_PIECE_ORDER,
  TANGRAM_PIECE_SPECS,
  TANGRAM_SAMPLE_PUZZLES,
  getTangramPuzzleById,
  transformLocalVertices,
  evaluateTangramBoard,
  createTangramGameState,
  placeOrMovePiece,
  rotatePiece,
  flipPiece,
  returnPieceToTray,
  returnAllPiecesToTray,
  undoTangramAction,
  computeTangramHint,
  applyTangramHintMove,
  saveTangramSession,
  loadTangramSession,
} from './tangram3dEngine';
import { Tangram3DScene } from './Tangram3DScene';

export interface Tangram3DGameProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Crisp miniature SVG preview of a Tangram piece in the side/bottom tray */
const TrayPiecePreview: React.FC<{
  pieceId: TangramPieceId;
  rotationDeg: number;
  flipped: boolean;
}> = ({ pieceId, rotationDeg, flipped }) => {
  const spec = TANGRAM_PIECE_SPECS[pieceId];
  const poly = useMemo(
    () => transformLocalVertices(spec.localVertices, 0, 0, rotationDeg, spec.canFlip ? flipped : false),
    [spec.localVertices, spec.canFlip, rotationDeg, flipped]
  );

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of poly) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const pad = 0.35;
  const w = Math.max(1.8, maxX - minX + pad * 2);
  const h = Math.max(1.8, maxY - minY + pad * 2);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const vbMinX = cx - w / 2;
  const vbMinY = -cy - h / 2;

  const pts = poly.map((v) => `${v.x.toFixed(3)},${(-v.y).toFixed(3)}`).join(' ');

  return (
    <svg
      viewBox={`${vbMinX} ${vbMinY} ${w} ${h}`}
      className="w-11 h-11 sm:w-12 sm:h-12 shrink-0"
      aria-hidden="true"
    >
      <polygon
        points={pts}
        fill={spec.color}
        stroke={spec.edgeColor}
        strokeWidth={0.14}
        strokeLinejoin="round"
      />
    </svg>
  );
};

const Tangram3DGame: React.FC<Tangram3DGameProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const isDemo = isKhktDemoRuntime();

  const [game, setGame] = useState<TangramGameState>(() => {
    const restored = loadTangramSession();
    if (restored) return restored;
    return createTangramGameState({ mode: 'guided', puzzleId: 'f02_square_master' });
  });

  const [selectedPieceId, setSelectedPieceId] = useState<TangramPieceId | null>('large_1');
  const [selectedGuidedSlot, setSelectedGuidedSlot] = useState<TangramSolutionSlot | null>(null);
  const [discussRegionMode, setDiscussRegionMode] = useState<boolean>(false);
  const [showSolutionOverlay, setShowSolutionOverlay] = useState<boolean>(false);
  const [activeHint, setActiveHint] = useState<TangramHintResult | null>(null);
  const [level1Cursor, setLevel1Cursor] = useState<number>(0);
  const [statusNotice, setStatusNotice] = useState<{ kind: 'info' | 'warn'; text: string } | null>(null);

  // Audio synced with A01/A02
  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted());
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [preferLightweight2D, setPreferLightweight2D] = useState<boolean>(false);
  const [webglAutoFallbackNotice, setWebglAutoFallbackNotice] = useState<boolean>(false);
  const [viVoiceAvailable, setViVoiceAvailable] = useState<boolean>(false);

  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const turnTokenRef = useRef<string>('f02_init');
  const celebratedTokenRef = useRef<number>(game.completionToken);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const bank = new EduGameSoundBank();
    const voice = new EduGameVoiceController();
    soundBankRef.current = bank;
    voiceRef.current = voice;
    const initToken = `f02_${Date.now()}`;
    turnTokenRef.current = initToken;
    bank.setActiveTurnToken(initToken);

    setViVoiceAvailable(voice.getSnapshot().hasVietnameseVoice);
    const unsub = voice.subscribe((snap) => setViVoiceAvailable(snap.hasVietnameseVoice));

    return () => {
      unsub();
      if (noticeTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(noticeTimerRef.current);
      }
      bank.stopAll();
      bank.dispose();
      voice.stop();
      voice.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  const stopPendingAudio = useCallback(() => {
    const bank = soundBankRef.current;
    if (bank) {
      bank.stopAll();
      const nextToken = `f02_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      turnTokenRef.current = nextToken;
      bank.setActiveTurnToken(nextToken);
    }
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const showNotice = useCallback((text: string, kind: 'info' | 'warn' = 'info') => {
    setStatusNotice({ kind, text });
    if (typeof window !== 'undefined') {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setStatusNotice(null), 3400);
    }
  }, []);

  // Auto-save session cleanly
  useEffect(() => {
    saveTangramSession(game);
  }, [game]);

  // Optional timer (OFF by default per prompt)
  useEffect(() => {
    if (!game.timerEnabled || game.isCompleted) return;
    const id = window.setInterval(() => {
      setGame((prev) => {
        if (!prev.timerEnabled || prev.isCompleted) return prev;
        return { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [game.timerEnabled, game.isCompleted]);

  const puzzle = useMemo(() => getTangramPuzzleById(game.puzzleId), [game.puzzleId]);

  const evaluation = useMemo(
    () => (game.mode === 'free' ? null : evaluateTangramBoard(game.pieces, puzzle)),
    [game.mode, game.pieces, puzzle]
  );

  const placedCount = useMemo(
    () => TANGRAM_PIECE_ORDER.filter((id) => game.pieces[id].onBoard).length,
    [game.pieces]
  );

  const outsidePieceIds = useMemo(
    () => new Set<TangramPieceId>((evaluation?.outsidePieces ?? []).map((o) => o.id)),
    [evaluation]
  );

  const blockingPieceIds = useMemo(
    () => new Set<TangramPieceId>(activeHint?.blockingPieceIds ?? []),
    [activeHint]
  );

  const triggerCompletionAudioOnce = useCallback((nextState: TangramGameState, justCompleted: boolean) => {
    if (!justCompleted) return;
    if (nextState.completionToken <= celebratedTokenRef.current) return;
    celebratedTokenRef.current = nextState.completionToken;
    const bank = soundBankRef.current;
    if (bank && !isMutedRef.current) {
      bank.unlock();
      bank.playTangramCompleteFanfare(false, turnTokenRef.current);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      saveEduGameMuted(next);
      if (next) {
        stopPendingAudio();
      } else {
        soundBankRef.current?.unlock();
      }
      return next;
    });
  }, [stopPendingAudio]);

  // Mode switching
  const handleSwitchMode = useCallback(
    (nextMode: TangramPlayMode) => {
      if (nextMode === game.mode) return;
      stopPendingAudio();
      const targetPuzzleId =
        nextMode === 'guided'
          ? 'f02_square_master'
          : nextMode === 'challenge' && game.puzzleId === 'f02_square_master'
          ? 'f02_big_triangle'
          : game.puzzleId;
      const nextState = createTangramGameState({
        mode: nextMode,
        puzzleId: targetPuzzleId,
        classroomEnabled: game.classroomEnabled,
        groupCount: game.groupCount,
        timerEnabled: game.timerEnabled,
      });
      celebratedTokenRef.current = nextState.completionToken;
      setGame(nextState);
      setSelectedPieceId('large_1');
      setSelectedGuidedSlot(null);
      setDiscussRegionMode(false);
      setShowSolutionOverlay(false);
      setActiveHint(null);
      setLevel1Cursor(0);
      setStatusNotice(null);
    },
    [game.mode, game.puzzleId, game.classroomEnabled, game.groupCount, game.timerEnabled, stopPendingAudio]
  );

  // Puzzle selection (in Challenge mode)
  const handleSelectPuzzle = useCallback(
    (nextPuzzleId: string) => {
      stopPendingAudio();
      const nextState = createTangramGameState({
        mode: game.mode === 'free' ? 'challenge' : game.mode,
        puzzleId: nextPuzzleId,
        classroomEnabled: game.classroomEnabled,
        groupCount: game.groupCount,
        timerEnabled: game.timerEnabled,
      });
      celebratedTokenRef.current = nextState.completionToken;
      setGame(nextState);
      setSelectedPieceId('large_1');
      setSelectedGuidedSlot(null);
      setShowSolutionOverlay(false);
      setActiveHint(null);
      setLevel1Cursor(0);
      setStatusNotice(null);
    },
    [game.mode, game.classroomEnabled, game.groupCount, game.timerEnabled, stopPendingAudio]
  );

  // Reset all 7 pieces back to tray
  const handleResetToTray = useCallback(() => {
    stopPendingAudio();
    setGame((prev) => {
      const reset = returnAllPiecesToTray(prev);
      celebratedTokenRef.current = reset.completionToken;
      return reset;
    });
    setSelectedPieceId('large_1');
    setSelectedGuidedSlot(null);
    setActiveHint(null);
    showNotice('Đã đưa toàn bộ 7 mảnh về khay.');
  }, [stopPendingAudio, showNotice]);

  // Place or move piece onto board coordinates (x, y)
  const handlePlaceOrMovePiece = useCallback(
    (pieceId: TangramPieceId, x: number, y: number) => {
      const res = placeOrMovePiece(game, pieceId, x, y, { enableSnap: true });
      const bank = soundBankRef.current;
      bank?.unlock();

      if (res.rejectedOverlapWith && res.rejectedOverlapWith.length > 0) {
        const names = res.rejectedOverlapWith.map((id) => TANGRAM_PIECE_SPECS[id].name).join(', ');
        bank?.playTangramRejectCue(isMutedRef.current, turnTokenRef.current);
        showNotice(
          `Mảnh ${TANGRAM_PIECE_SPECS[pieceId].name} bị chồng lên ${names} — đã trả về vị trí trước đó.`,
          'warn'
        );
        return;
      }

      if (res.changed) {
        setGame(res.state);
        setSelectedPieceId(pieceId);
        setActiveHint(null);
        setSelectedGuidedSlot(null);
        if (res.justCompleted) {
          triggerCompletionAudioOnce(res.state, true);
        } else {
          bank?.playTangramPlacePiece(isMutedRef.current, res.snapped, turnTokenRef.current);
        }
      }
    },
    [game, showNotice, triggerCompletionAudioOnce]
  );

  // Rotate selected piece ±45°
  const handleRotate = useCallback(
    (deltaDeg: 45 | -45) => {
      if (!selectedPieceId) return;
      const res = rotatePiece(game, selectedPieceId, deltaDeg);
      const bank = soundBankRef.current;
      bank?.unlock();
      if (res.rejectedOverlapWith && res.rejectedOverlapWith.length > 0) {
        const names = res.rejectedOverlapWith.map((id) => TANGRAM_PIECE_SPECS[id].name).join(', ');
        bank?.playTangramRejectCue(isMutedRef.current, turnTokenRef.current);
        showNotice(`Không thể xoay vì sẽ chồng lên ${names}. Hãy dịch mảnh ra chỗ trống rồi xoay.`, 'warn');
        return;
      }
      if (res.changed) {
        setGame(res.state);
        setActiveHint(null);
        if (res.justCompleted) {
          triggerCompletionAudioOnce(res.state, true);
        } else {
          bank?.playTangramPlacePiece(isMutedRef.current, res.snapped, turnTokenRef.current);
        }
      }
    },
    [selectedPieceId, game, showNotice, triggerCompletionAudioOnce]
  );

  // Flip parallelogram
  const handleFlip = useCallback(() => {
    if (!selectedPieceId) return;
    if (!TANGRAM_PIECE_SPECS[selectedPieceId].canFlip) {
      showNotice('Chỉ Hình bình hành mới đổi hình khi lật (các mảnh còn lại đều đối xứng trục).');
      return;
    }
    const res = flipPiece(game, selectedPieceId);
    const bank = soundBankRef.current;
    bank?.unlock();
    if (res.rejectedOverlapWith && res.rejectedOverlapWith.length > 0) {
      const names = res.rejectedOverlapWith.map((id) => TANGRAM_PIECE_SPECS[id].name).join(', ');
      bank?.playTangramRejectCue(isMutedRef.current, turnTokenRef.current);
      showNotice(`Không thể lật tại vị trí này vì chồng lên ${names}.`, 'warn');
      return;
    }
    if (res.changed) {
      setGame(res.state);
      setActiveHint(null);
      if (res.justCompleted) {
        triggerCompletionAudioOnce(res.state, true);
      } else {
        bank?.playTangramPlacePiece(isMutedRef.current, res.snapped, turnTokenRef.current);
      }
    }
  }, [selectedPieceId, game, showNotice, triggerCompletionAudioOnce]);

  // Return selected piece to tray
  const handleReturnSelectedToTray = useCallback(() => {
    if (!selectedPieceId) return;
    const res = returnPieceToTray(game, selectedPieceId);
    if (res.changed) {
      soundBankRef.current?.unlock();
      soundBankRef.current?.playTangramPlacePiece(isMutedRef.current, false, turnTokenRef.current);
      setGame(res.state);
      setActiveHint(null);
    }
  }, [selectedPieceId, game]);

  // Undo last move
  const handleUndo = useCallback(() => {
    const res = undoTangramAction(game);
    if (!res.undone) {
      showNotice('Chưa có thao tác nào để hoàn tác.');
      return;
    }
    soundBankRef.current?.unlock();
    soundBankRef.current?.playTangramPlacePiece(isMutedRef.current, false, turnTokenRef.current);
    setGame(res.state);
    setActiveHint(null);
  }, [game, showNotice]);

  // Level 1 & Level 2 Hints (never auto-applies!)
  const handleRequestHint = useCallback(
    (level: 1 | 2) => {
      const hint = computeTangramHint(game, level, level1Cursor);
      setActiveHint(hint);
      if (level === 1 && hint.status === 'ok') {
        setLevel1Cursor((prev) => prev + 1);
      }
      if (hint.level === 2 && hint.suggestedMove) {
        setSelectedPieceId(hint.suggestedMove.pieceId);
      }
      soundBankRef.current?.unlock();
      if (hint.status === 'blocked') {
        soundBankRef.current?.playTangramRejectCue(isMutedRef.current, turnTokenRef.current);
      } else {
        soundBankRef.current?.playTangramPlacePiece(isMutedRef.current, false, turnTokenRef.current);
      }
    },
    [game, level1Cursor]
  );

  // Explicit Apply Level-2 Hint
  const handleApplyHint = useCallback(() => {
    if (!activeHint || activeHint.status !== 'ok' || !activeHint.suggestedMove) return;
    const res = applyTangramHintMove(game, activeHint);
    if (res.changed) {
      setGame(res.state);
      setSelectedPieceId(activeHint.suggestedMove.pieceId);
      setActiveHint(null);
      soundBankRef.current?.unlock();
      if (res.justCompleted) {
        triggerCompletionAudioOnce(res.state, true);
      } else {
        soundBankRef.current?.playTangramPlacePiece(isMutedRef.current, true, turnTokenRef.current);
      }
    }
  }, [activeHint, game, triggerCompletionAudioOnce]);

  // Read hint aloud in strict Vietnamese
  const handleSpeakHint = useCallback(() => {
    if (!activeHint || isMutedRef.current) return;
    voiceRef.current?.replayText({
      text: activeHint.speechText,
      isMuted: isMutedRef.current,
      voiceEnabled: true,
    });
  }, [activeHint]);

  // Guided slot click handler (for teacher discussion in "Làm quen")
  const handleSelectGuidedSlot = useCallback((slot: TangramSolutionSlot) => {
    setSelectedGuidedSlot(slot);
    setActiveHint(null);
  }, []);

  // Exit to library — stop all audio immediately
  const handleExit = useCallback(() => {
    stopPendingAudio();
    onBackToLibrary();
  }, [stopPendingAudio, onBackToLibrary]);

  // Physical Keyboard Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // 1..7 select pieces
      if (/^[1-7]$/.test(e.key)) {
        e.preventDefault();
        const id = TANGRAM_PIECE_ORDER[Number(e.key) - 1];
        setSelectedPieceId(id);
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === 'q' || e.key === '[') {
        e.preventDefault();
        handleRotate(45);
        return;
      }
      if (lower === 'e' || e.key === ']') {
        e.preventDefault();
        handleRotate(-45);
        return;
      }
      if (lower === 'f') {
        e.preventDefault();
        handleFlip();
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleReturnSelectedToTray();
        return;
      }

      // Arrow keys nudge selected piece on board (or place tray piece at target center)
      if (
        selectedPieceId &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        const piece = game.pieces[selectedPieceId];
        const step = e.shiftKey ? 0.25 : 0.5;
        if (!piece.onBoard) {
          const cx = (puzzle.bounds.minX + puzzle.bounds.maxX) / 2;
          const cy = (puzzle.bounds.minY + puzzle.bounds.maxY) / 2;
          handlePlaceOrMovePiece(selectedPieceId, cx, cy);
          return;
        }
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
        handlePlaceOrMovePiece(selectedPieceId, piece.x + dx, piece.y + dy);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selectedPieceId,
    game.pieces,
    puzzle.bounds,
    handleUndo,
    handleRotate,
    handleFlip,
    handleReturnSelectedToTray,
    handlePlaceOrMovePiece,
  ]);

  const handleWebGLUnavailable = useCallback(() => {
    setWebglAutoFallbackNotice(true);
  }, []);

  const selectedPiece = selectedPieceId ? game.pieces[selectedPieceId] : null;
  const selectedSpec = selectedPieceId ? TANGRAM_PIECE_SPECS[selectedPieceId] : null;

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-dvh overflow-y-auto' : 'min-h-[650px] rounded-2xl border border-slate-800'
      } bg-[#061024] text-slate-100 flex flex-col`}
    >
      {/* Top Control Bar */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-5 py-3 border-b border-slate-800/90 bg-[#08152E]">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về thư viện</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white truncate">
              <span>F02 · Tangram</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="text-teal-300 font-semibold">
                {game.mode === 'guided'
                  ? 'Làm quen'
                  : game.mode === 'challenge'
                  ? 'Thử thách'
                  : 'Ghép tự do'}
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 truncate">
              <span>{game.mode === 'free' ? game.freeBuildName : puzzle.title}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Dữ liệu mẫu</span>
              {isDemo && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className="text-amber-300">Chế độ Demo tách biệt</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mode Tabs & Utility Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Three Modes Segmented Control */}
          <div
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700/80"
            role="group"
            aria-label="Ba cách chơi Tangram"
          >
            {(
              [
                { key: 'guided', label: 'Làm quen' },
                { key: 'challenge', label: 'Thử thách' },
                { key: 'free', label: 'Ghép tự do' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSwitchMode(item.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  game.mode === item.key
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Classroom Projector Mode Toggle (2-6 Groups) */}
          <button
            type="button"
            onClick={() => setGame((prev) => ({ ...prev, classroomEnabled: !prev.classroomEnabled }))}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              game.classroomEnabled
                ? 'bg-slate-100 text-slate-950 border-white'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {game.classroomEnabled ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span>{game.classroomEnabled ? 'Trình chiếu lớp' : 'Tự luyện'}</span>
          </button>

          {/* Optional Timer Toggle (OFF by default) */}
          <button
            type="button"
            onClick={() => setGame((prev) => ({ ...prev, timerEnabled: !prev.timerEnabled }))}
            title="Bật hoặc tắt đồng hồ đếm thời gian"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold tabular-nums transition-colors whitespace-nowrap cursor-pointer ${
              game.timerEnabled
                ? 'bg-slate-900 border-teal-500/45 text-teal-200'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{game.timerEnabled ? formatClock(game.elapsedSeconds) : 'Không giới hạn'}</span>
          </button>

          {/* 3D / 2D Toggle */}
          <button
            type="button"
            onClick={() => setPreferLightweight2D((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-teal-400/60 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            {preferLightweight2D ? (
              <Grid2x2 className="w-3.5 h-3.5 text-teal-300" />
            ) : (
              <Box className="w-3.5 h-3.5 text-teal-300" />
            )}
            <span>{preferLightweight2D ? 'Bản 2D' : 'Bản 3D'}</span>
          </button>

          {/* Reduced Motion Toggle */}
          <button
            type="button"
            onClick={() => setReducedMotion((prev) => !prev)}
            aria-pressed={reducedMotion}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              reducedMotion
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Giảm chuyển động</span>
          </button>

          {/* Audio Mute (synced A01/A02) */}
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              isMuted
                ? 'bg-rose-950/60 border-rose-500/45 text-rose-200'
                : 'bg-teal-950/60 border-teal-500/45 text-teal-200'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden md:inline">{isMuted ? 'Tắt tiếng' : 'Âm thanh'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-teal-400/60 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main 16:9 Workspace: Large Center/Left Board + Side/Bottom Tray & Controls */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 sm:p-4 lg:p-5 items-start max-w-[1640px] w-full mx-auto">
        {/* PRIMARY BOARD STAGE */}
        <section className="lg:col-span-8 flex flex-col gap-3">
          {/* Context / Progress / Puzzle Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B1833] border border-slate-800/90 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300">
              <span className="font-semibold text-white">
                {game.classroomEnabled ? 'Tiến độ chung cả lớp' : 'Tiến độ ghép hình'}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="tabular-nums">
                Trên bàn <strong className="text-teal-300">{placedCount}/7</strong> mảnh
              </span>
              {evaluation && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Phủ hình đích <strong className="text-white">{Math.round(evaluation.coverageRatio * 100)}%</strong>
                  </span>
                </>
              )}
              {game.mode !== 'free' && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Gợi ý <strong className="text-amber-300">{game.hintsUsed}</strong>
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {game.mode === 'challenge' && (
                <select
                  aria-label="Chọn hình thử thách"
                  value={game.puzzleId}
                  onChange={(e) => handleSelectPuzzle(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-teal-400 cursor-pointer"
                >
                  {TANGRAM_SAMPLE_PUZZLES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.difficultyLabel})
                    </option>
                  ))}
                </select>
              )}

              {game.mode === 'guided' && (
                <button
                  type="button"
                  onClick={() => {
                    setDiscussRegionMode((prev) => !prev);
                    if (!discussRegionMode) setSelectedPieceId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    discussRegionMode
                      ? 'bg-teal-500 text-slate-950 border-teal-400'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-teal-400/60'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{discussRegionMode ? 'Đang bấm vùng thảo luận' : 'Bấm vùng thảo luận'}</span>
                </button>
              )}

              {game.mode === 'challenge' && (
                <button
                  type="button"
                  onClick={() => setShowSolutionOverlay((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    showSolutionOverlay
                      ? 'bg-amber-400/20 border-amber-400/60 text-amber-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {showSolutionOverlay ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showSolutionOverlay ? 'Ẩn đường chia lời giải' : 'Xem lời giải'}</span>
                </button>
              )}

              {game.mode === 'free' && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="f02-free-name" className="text-slate-400 whitespace-nowrap">
                    Tên hình:
                  </label>
                  <input
                    id="f02-free-name"
                    type="text"
                    maxLength={60}
                    value={game.freeBuildName}
                    onChange={(e) => setGame((prev) => ({ ...prev, freeBuildName: e.target.value }))}
                    placeholder="Đặt tên hình ghép..."
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-teal-400 w-44 sm:w-52"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Classroom 2-6 Discussion Groups Strip */}
          {game.classroomEnabled && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-teal-950/35 border border-teal-500/35 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center gap-2 text-teal-100">
                <strong className="text-teal-300">
                  Lượt thảo luận: Nhóm {game.activeGroupIndex + 1}/{game.groupCount}
                </strong>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span>Mời nhóm đề xuất mảnh ghép và giải thích góc/cạnh trước khi giáo viên đặt mảnh.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label="Số nhóm thảo luận"
                  value={game.groupCount}
                  onChange={(e) => {
                    const count = Number(e.target.value);
                    setGame((prev) => ({
                      ...prev,
                      groupCount: count,
                      activeGroupIndex: prev.activeGroupIndex % count,
                    }));
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 cursor-pointer"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} nhóm
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setGame((prev) => ({
                      ...prev,
                      activeGroupIndex: (prev.activeGroupIndex + 1) % prev.groupCount,
                    }))
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Nhóm tiếp theo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {webglAutoFallbackNotice && !preferLightweight2D && (
            <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300">
              Thiết bị không hỗ trợ WebGL — hệ thống đã tự động chuyển sang bàn ghép hình 2D chính xác trên cùng hệ tọa độ.
            </div>
          )}

          {/* 3D / 2D Interactive Tangram Board */}
          <div className="w-full aspect-[16/10] max-h-[68vh] rounded-2xl border border-slate-800 bg-[#061024] overflow-hidden shadow-lg relative">
            <Tangram3DScene
              mode={game.mode}
              puzzle={puzzle}
              pieces={game.pieces}
              selectedPieceId={selectedPieceId}
              selectedGuidedSlotId={selectedGuidedSlot?.id ?? null}
              discussRegionMode={discussRegionMode}
              showSolutionOverlay={showSolutionOverlay}
              activeHint={activeHint}
              outsidePieceIds={outsidePieceIds}
              blockingPieceIds={blockingPieceIds}
              isCompleted={game.isCompleted}
              completionToken={game.completionToken}
              reducedMotion={reducedMotion}
              preferLightweight2D={preferLightweight2D}
              onSelectPiece={setSelectedPieceId}
              onPlaceOrMovePiece={handlePlaceOrMovePiece}
              onSelectGuidedSlot={handleSelectGuidedSlot}
              onWebGLUnavailable={handleWebGLUnavailable}
            />
          </div>

          {/* Guided Discussion Prompt Callout (in "Làm quen") */}
          {game.mode === 'guided' && selectedGuidedSlot && (
            <div className="p-3.5 rounded-xl bg-teal-950/45 border border-teal-400/45 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-teal-200">
                  Thảo luận vùng đã chọn
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedGuidedSlot(null)}
                  className="text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Đóng
                </button>
              </div>
              <div className="text-xs sm:text-sm text-slate-100 leading-relaxed overflow-x-auto">
                <MathView content={selectedGuidedSlot.discussionPrompt} />
              </div>
            </div>
          )}

          {/* Subtle keyboard & touch instruction footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B1833]/80 border border-slate-800/80 text-[11px] sm:text-xs text-slate-300">
            <span>
              Kéo mảnh trực tiếp trên bàn, hoặc <strong>Chọn mảnh ở khay → Chạm vị trí trên bàn</strong> để đặt không cần kéo.
            </span>
            <span className="hidden sm:inline text-slate-400">
              Phím 1–7 chọn mảnh · Mũi tên di chuyển · Q/E xoay 45° · F lật · Del về khay
            </span>
          </div>
        </section>

        {/* SIDE / MOBILE-BOTTOM TRAY & CONTROLS */}
        <aside className="lg:col-span-4 flex flex-col gap-3.5">
          {/* Completion Banner (Strictly NEVER shown in Free Build mode!) */}
          {game.mode !== 'free' && game.isCompleted && (
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-400/55 space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    Hoàn thành hình ghép “{puzzle.title}”!
                  </h2>
                  <p className="text-xs text-emerald-100/90 mt-0.5">
                    Đủ 7 mảnh trên bàn, không chồng lấn và phủ kín đúng đường bao hình đích.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/25 text-xs text-slate-100 leading-relaxed overflow-x-auto">
                <MathView content={puzzle.mathInsight} />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResetToTray}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Ghép lại bài này</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idx = TANGRAM_SAMPLE_PUZZLES.findIndex((p) => p.id === puzzle.id);
                    const next = TANGRAM_SAMPLE_PUZZLES[(idx + 1) % TANGRAM_SAMPLE_PUZZLES.length];
                    handleSelectPuzzle(next.id);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Bài tiếp theo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Selected Piece Transform Controls */}
          <div className="p-3.5 rounded-2xl bg-[#0B1833] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white truncate">
                  {selectedSpec ? selectedSpec.name : 'Chưa chọn mảnh'}
                </div>
                {selectedSpec && selectedPiece && (
                  <div className="text-[11px] text-slate-400">
                    Góc xoay {selectedPiece.rotationDeg}°
                    {selectedSpec.canFlip ? ` · ${selectedPiece.flipped ? 'Đã lật mặt' : 'Mặt chuẩn'}` : ''}
                    <span> · {selectedPiece.onBoard ? 'Đang trên bàn' : 'Trong khay (chạm bàn để đặt)'}</span>
                  </div>
                )}
              </div>
              {selectedSpec && (
                <div className="text-xs font-semibold text-teal-300 shrink-0">
                  <MathView content={`$S = ${selectedSpec.areaFractionLatex}$`} />
                </div>
              )}
            </div>

            {selectedSpec && (
              <div className="text-[11px] text-slate-300 bg-slate-900/80 rounded-lg px-2.5 py-1.5 border border-slate-800 overflow-x-auto">
                <span>Góc: {selectedSpec.anglesDesc} · </span>
                <MathView content={selectedSpec.edgesDesc} />
              </div>
            )}

            {/* Rotate / Flip / Undo / Tray Action Buttons (>= 44px touch targets) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!selectedPieceId}
                onClick={() => handleRotate(45)}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-teal-400/70 disabled:opacity-45 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-teal-300" />
                <span>Xoay trái 45°</span>
              </button>
              <button
                type="button"
                disabled={!selectedPieceId}
                onClick={() => handleRotate(-45)}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-teal-400/70 disabled:opacity-45 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCw className="w-4 h-4 text-teal-300" />
                <span>Xoay phải 45°</span>
              </button>
              <button
                type="button"
                disabled={!selectedSpec?.canFlip}
                onClick={handleFlip}
                className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedSpec?.canFlip
                    ? 'bg-violet-950/60 border-violet-400/60 hover:bg-violet-900/70 text-violet-100'
                    : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <FlipHorizontal2 className="w-4 h-4" />
                <span>Lật bình hành</span>
              </button>
              <button
                type="button"
                disabled={!selectedPiece?.onBoard}
                onClick={handleReturnSelectedToTray}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-rose-400/60 disabled:opacity-45 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <CornerDownLeft className="w-4 h-4 text-rose-300" />
                <span>Về khay</span>
              </button>
              <button
                type="button"
                disabled={game.undoStack.length === 0}
                onClick={handleUndo}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-teal-400/60 disabled:opacity-45 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <Undo2 className="w-4 h-4" />
                <span>Hoàn tác ({game.undoStack.length})</span>
              </button>
              <button
                type="button"
                onClick={handleResetToTray}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Đưa hết về khay</span>
              </button>
            </div>

            {statusNotice && (
              <div
                role="status"
                className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${
                  statusNotice.kind === 'warn'
                    ? 'bg-rose-950/50 border-rose-500/50 text-rose-100'
                    : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                {statusNotice.kind === 'warn' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                <span>{statusNotice.text}</span>
              </div>
            )}

            {/* Outside-target live geometric feedback */}
            {evaluation && evaluation.outsidePieces.length > 0 && !game.isCompleted && (
              <div className="px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-500/45 text-xs text-amber-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>
                  Mảnh vượt ra ngoài đường bao:{' '}
                  <strong>
                    {evaluation.outsidePieces.map((o) => TANGRAM_PIECE_SPECS[o.id].name).join(', ')}
                  </strong>
                  . Hãy xoay hoặc dịch vào trong hình đích.
                </span>
              </div>
            )}
          </div>

          {/* 7-Piece Tactile Tray */}
          <div className="p-3.5 rounded-2xl bg-[#0B1833] border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">Khay 7 mảnh Tangram</span>
              <span className="text-slate-400">Tổng diện tích = 16</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
              {TANGRAM_PIECE_ORDER.map((id, idx) => {
                const spec = TANGRAM_PIECE_SPECS[id];
                const st = game.pieces[id];
                const isSelected = selectedPieceId === id;
                const isWarn = outsidePieceIds.has(id) || blockingPieceIds.has(id);

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSelectedPieceId(id);
                      setDiscussRegionMode(false);
                    }}
                    className={`min-h-[58px] p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isWarn
                        ? 'bg-rose-950/45 border-rose-400/70 text-rose-100'
                        : isSelected
                        ? 'bg-teal-950/60 border-teal-300 ring-1 ring-teal-300/60 text-white'
                        : st.onBoard
                        ? 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-600'
                        : 'bg-[#102244] border-slate-700/80 text-slate-100 hover:border-teal-400/60'
                    }`}
                  >
                    <TrayPiecePreview
                      pieceId={id}
                      rotationDeg={st.rotationDeg}
                      flipped={st.flipped}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">
                        {idx + 1}. {spec.shortLabel}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {st.onBoard ? 'Trên bàn' : 'Trong khay'} · S={spec.area}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Two-Level Hint Panel (Only in Guided & Challenge modes) */}
          {game.mode !== 'free' && (
            <div className="p-3.5 rounded-2xl bg-[#0B1833] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-300" />
                  <span>Gợi ý giải thích cách ghép</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={game.isCompleted}
                  onClick={() => handleRequestHint(1)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400/70 disabled:opacity-45 text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Mức 1 · Cạnh & góc
                </button>
                <button
                  type="button"
                  disabled={game.isCompleted}
                  onClick={() => handleRequestHint(2)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-45 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  Mức 2 · Vị trí 1 mảnh
                </button>
              </div>

              {activeHint && (
                <div
                  className={`p-3 rounded-xl border space-y-2.5 ${
                    activeHint.status === 'blocked'
                      ? 'bg-rose-950/40 border-rose-500/50'
                      : 'bg-amber-950/35 border-amber-400/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>{activeHint.title}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveHint(null)}
                      className="text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="text-xs leading-relaxed text-slate-100 overflow-x-auto">
                    <MathView content={activeHint.explanation} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeHint.level === 2 && activeHint.status === 'ok' && activeHint.suggestedMove && (
                      <button
                        type="button"
                        onClick={handleApplyHint}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Áp dụng gợi ý</span>
                      </button>
                    )}

                    {viVoiceAvailable && !isMuted && (
                      <button
                        type="button"
                        onClick={handleSpeakHint}
                        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5 text-teal-300" />
                        <span>Đọc gợi ý</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Tangram3DGame;
