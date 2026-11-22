import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Undo2,
  Eraser,
  Pencil,
  Lightbulb,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Shuffle,
  CheckCircle2,
  Clock,
  Lock,
  Users,
  User,
  Sparkles,
  Box,
  Grid2x2,
  EyeOff,
  Mic,
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
  SudokuSize,
  SudokuPlayMode,
  SudokuGameState,
  SudokuHintStep,
  SudokuConflictReport,
  SudokuPuzzle,
  getDefaultSudokuPuzzle,
  getVerifiedPuzzlesBySize,
  generateValidatedSudokuPuzzle,
  createSudokuGameState,
  isCellGiven,
  setCellValue,
  toggleCellNote,
  clearCell,
  undoLastSudokuAction,
  detectSudokuConflicts,
  computeSudokuHint,
  applySudokuHint,
  replayCurrentSudokuPuzzle,
  countFilledCells,
  countUserFilledCells,
  saveSudokuSession,
  loadSudokuSession,
  cellKey,
} from './sudoku3dEngine';
import { Sudoku3DScene } from './Sudoku3DScene';

export interface Sudoku3DGameProps {
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

function findInitialSelectableCell(puzzle: SudokuPuzzle): { row: number; col: number } {
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      if (puzzle.givens[r][c] === 0) return { row: r, col: c };
    }
  }
  return { row: 0, col: 0 };
}

const Sudoku3DGame: React.FC<Sudoku3DGameProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const isDemo = isKhktDemoRuntime();

  // Restore saved session if available, otherwise start immediately on the default 4x4 sample puzzle
  const [game, setGame] = useState<SudokuGameState>(() => {
    const restored = loadSudokuSession();
    if (restored) return restored;
    return createSudokuGameState(getDefaultSudokuPuzzle(4), {
      mode: 'solo',
      timerEnabled: true,
    });
  });

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>(() =>
    findInitialSelectableCell(game.puzzle)
  );
  const [noteMode, setNoteMode] = useState<boolean>(false);
  const [activeHint, setActiveHint] = useState<SudokuHintStep | null>(null);
  const [conflictCheckBanner, setConflictCheckBanner] = useState<{
    checkedAt: number;
    report: SudokuConflictReport;
  } | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Audio state synchronized with A01/A02 global preference
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
  const turnTokenRef = useRef<string>('f01_init');
  const celebratedCompletionTokenRef = useRef<number>(game.completionToken);
  const noticeTimerRef = useRef<number | null>(null);

  // Initialize audio & strict Vietnamese voice controllers
  useEffect(() => {
    const bank = new EduGameSoundBank();
    const voice = new EduGameVoiceController();
    soundBankRef.current = bank;
    voiceRef.current = voice;
    const initToken = `f01_${Date.now()}`;
    turnTokenRef.current = initToken;
    bank.setActiveTurnToken(initToken);

    setViVoiceAvailable(voice.getSnapshot().hasVietnameseVoice);
    const unsub = voice.subscribe((snap) => {
      setViVoiceAvailable(snap.hasVietnameseVoice);
    });

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
      const nextToken = `f01_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      turnTokenRef.current = nextToken;
      bank.setActiveTurnToken(nextToken);
    }
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const showTransientNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    if (typeof window !== 'undefined') {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      noticeTimerRef.current = window.setTimeout(() => {
        setStatusNotice(null);
      }, 2800);
    }
  }, []);

  // Persist session automatically whenever board progress changes
  useEffect(() => {
    saveSudokuSession(game);
  }, [game]);

  // Live timer (runs only when timerEnabled && !isCompleted)
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

  // Derived board metrics & live conflict detection
  const liveConflicts = useMemo(
    () => detectSudokuConflicts(game.values, game.puzzle.size),
    [game.values, game.puzzle.size]
  );
  const conflictCellKeySet = useMemo(
    () => new Set(liveConflicts.conflictCellKeys),
    [liveConflicts.conflictCellKeys]
  );
  const filledStats = useMemo(
    () => countFilledCells(game.values, game.puzzle.size),
    [game.values, game.puzzle.size]
  );
  const userStats = useMemo(
    () => countUserFilledCells(game.values, game.puzzle.givens, game.puzzle.size),
    [game.values, game.puzzle.givens, game.puzzle.size]
  );
  const puzzlesForCurrentSize = useMemo(
    () => getVerifiedPuzzlesBySize(game.puzzle.size),
    [game.puzzle.size]
  );

  // Trigger completion fanfare AT MOST ONCE per completionToken
  const handleVictoryAudioOnce = useCallback((nextState: SudokuGameState, justCompleted: boolean) => {
    if (!justCompleted) return;
    if (nextState.completionToken <= celebratedCompletionTokenRef.current) return;
    celebratedCompletionTokenRef.current = nextState.completionToken;
    const bank = soundBankRef.current;
    if (bank && !isMutedRef.current) {
      bank.unlock();
      bank.playSudokuCompleteFanfare(false, turnTokenRef.current);
    }
  }, []);

  // Toggle global mute (consistent with A01/A02)
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

  // Select cell on board
  const handleSelectCell = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  // Switch board size (4x4 <-> 9x9)
  const handleSwitchSize = useCallback(
    (nextSize: SudokuSize) => {
      if (nextSize === game.puzzle.size) return;
      stopPendingAudio();
      const nextPuzzle = getDefaultSudokuPuzzle(nextSize);
      const nextState = createSudokuGameState(nextPuzzle, {
        mode: game.mode,
        timerEnabled: game.timerEnabled,
      });
      celebratedCompletionTokenRef.current = nextState.completionToken;
      setGame(nextState);
      setSelectedCell(findInitialSelectableCell(nextPuzzle));
      setActiveHint(null);
      setConflictCheckBanner(null);
      setStatusNotice(null);
    },
    [game.puzzle.size, game.mode, game.timerEnabled, stopPendingAudio]
  );

  // Switch play mode (Solo <-> Class Projector)
  const handleSwitchMode = useCallback((nextMode: SudokuPlayMode) => {
    setGame((prev) => ({ ...prev, mode: nextMode }));
  }, []);

  // Select a specific built-in verified puzzle
  const handleSelectPuzzleById = useCallback(
    (puzzleId: string) => {
      const found = getVerifiedPuzzlesBySize(game.puzzle.size).find((p) => p.id === puzzleId);
      if (!found) return;
      stopPendingAudio();
      const nextState = createSudokuGameState(found, {
        mode: game.mode,
        timerEnabled: game.timerEnabled,
      });
      celebratedCompletionTokenRef.current = nextState.completionToken;
      setGame(nextState);
      setSelectedCell(findInitialSelectableCell(found));
      setActiveHint(null);
      setConflictCheckBanner(null);
      setStatusNotice(null);
    },
    [game.puzzle.size, game.mode, game.timerEnabled, stopPendingAudio]
  );

  // "Đổi đề" — cycle verified puzzles or create a fresh validated unique puzzle
  const handleChangePuzzle = useCallback(() => {
    stopPendingAudio();
    const list = getVerifiedPuzzlesBySize(game.puzzle.size);
    const currentIdx = list.findIndex((p) => p.id === game.puzzle.id);
    let nextPuzzle: SudokuPuzzle;
    if (currentIdx >= 0 && currentIdx < list.length - 1) {
      nextPuzzle = list[currentIdx + 1];
    } else {
      const generated = generateValidatedSudokuPuzzle(game.puzzle.size, {
        excludeId: game.puzzle.id,
        timeBudgetMs: 120,
      });
      nextPuzzle = generated.puzzle;
    }
    const nextState = createSudokuGameState(nextPuzzle, {
      mode: game.mode,
      timerEnabled: game.timerEnabled,
    });
    celebratedCompletionTokenRef.current = nextState.completionToken;
    setGame(nextState);
    setSelectedCell(findInitialSelectableCell(nextPuzzle));
    setActiveHint(null);
    setConflictCheckBanner(null);
    showTransientNotice(`Đã chuyển sang ${nextPuzzle.title} (${nextPuzzle.difficultyLabel}).`);
  }, [game.puzzle.id, game.puzzle.size, game.mode, game.timerEnabled, stopPendingAudio, showTransientNotice]);

  // "Chơi lại đề này"
  const handleReplayPuzzle = useCallback(() => {
    stopPendingAudio();
    setGame((prev) => {
      const reset = replayCurrentSudokuPuzzle(prev);
      celebratedCompletionTokenRef.current = reset.completionToken;
      return reset;
    });
    setSelectedCell(findInitialSelectableCell(game.puzzle));
    setActiveHint(null);
    setConflictCheckBanner(null);
    showTransientNotice('Đã đặt lại đề hiện tại.');
  }, [game.puzzle, stopPendingAudio, showTransientNotice]);

  // Input a digit (or toggle candidate note)
  const handleDigitInput = useCallback(
    (digit: number) => {
      if (!selectedCell) return;
      const { row, col } = selectedCell;
      if (digit < 1 || digit > game.puzzle.size) return;

      if (game.isCompleted) return;
      if (isCellGiven(game, row, col)) {
        showTransientNotice('Ô cho sẵn đã được khóa, không thể chỉnh sửa.');
        return;
      }

      const bank = soundBankRef.current;
      bank?.unlock();

      if (noteMode) {
        if (game.values[row][col] !== 0) {
          showTransientNotice('Hãy xóa số trong ô trước khi ghi chú số ứng viên.');
          return;
        }
        const res = toggleCellNote(game, row, col, digit);
        if (res.changed) {
          setGame(res.state);
          bank?.playSudokuPlaceTile(isMutedRef.current, true, turnTokenRef.current);
        }
      } else {
        const res = setCellValue(game, row, col, digit);
        if (res.changed) {
          setGame(res.state);
          setActiveHint(null);
          setConflictCheckBanner(null);
          if (res.justCompleted) {
            handleVictoryAudioOnce(res.state, true);
          } else {
            bank?.playSudokuPlaceTile(isMutedRef.current, false, turnTokenRef.current);
          }
        }
      }
    },
    [selectedCell, game, noteMode, showTransientNotice, handleVictoryAudioOnce]
  );

  // Erase editable cell
  const handleEraseSelected = useCallback(() => {
    if (!selectedCell || game.isCompleted) return;
    const { row, col } = selectedCell;
    if (isCellGiven(game, row, col)) {
      showTransientNotice('Ô cho sẵn đã được khóa, không thể xóa.');
      return;
    }
    const res = clearCell(game, row, col);
    if (res.changed) {
      soundBankRef.current?.unlock();
      soundBankRef.current?.playSudokuPlaceTile(isMutedRef.current, true, turnTokenRef.current);
      setGame(res.state);
      setActiveHint(null);
      setConflictCheckBanner(null);
    }
  }, [selectedCell, game, showTransientNotice]);

  // Undo (restores BOTH digits and candidate notes)
  const handleUndo = useCallback(() => {
    const res = undoLastSudokuAction(game);
    if (!res.undone) {
      showTransientNotice('Chưa có thao tác nào để hoàn tác.');
      return;
    }
    soundBankRef.current?.unlock();
    soundBankRef.current?.playSudokuPlaceTile(isMutedRef.current, true, turnTokenRef.current);
    setGame(res.state);
    setActiveHint(null);
    setConflictCheckBanner(null);
  }, [game, showTransientNotice]);

  // "Kiểm tra xung đột"
  const handleCheckConflicts = useCallback(() => {
    const report = detectSudokuConflicts(game.values, game.puzzle.size);
    setConflictCheckBanner({ checkedAt: Date.now(), report });
    setActiveHint(null);
    soundBankRef.current?.unlock();
    if (report.hasConflicts) {
      soundBankRef.current?.playSudokuConflictCue(isMutedRef.current, turnTokenRef.current);
    } else {
      soundBankRef.current?.playSudokuPlaceTile(isMutedRef.current, false, turnTokenRef.current);
    }
  }, [game.values, game.puzzle.size]);

  // "Gợi ý từng bước" (analyzes current board ONLY; does NOT fill until "Áp dụng gợi ý")
  const handleRequestHint = useCallback(() => {
    const hint = computeSudokuHint(game.values, game.puzzle.givens, game.puzzle.size, selectedCell);
    setActiveHint(hint);
    if (hint.status === 'found' && hint.targetCell) {
      setSelectedCell(hint.targetCell);
      soundBankRef.current?.unlock();
      soundBankRef.current?.playSudokuPlaceTile(isMutedRef.current, true, turnTokenRef.current);
    } else if (hint.status === 'has_conflicts') {
      if (hint.conflictReport) {
        setConflictCheckBanner({ checkedAt: Date.now(), report: hint.conflictReport });
      }
      soundBankRef.current?.unlock();
      soundBankRef.current?.playSudokuConflictCue(isMutedRef.current, turnTokenRef.current);
    }
  }, [game.values, game.puzzle.givens, game.puzzle.size, selectedCell]);

  // "Áp dụng gợi ý" — only fills the suggested number upon explicit click
  const handleApplyHint = useCallback(() => {
    if (!activeHint || activeHint.status !== 'found' || !activeHint.targetCell) return;
    const res = applySudokuHint(game, activeHint);
    if (res.changed) {
      setGame(res.state);
      setSelectedCell(activeHint.targetCell);
      setActiveHint(null);
      setConflictCheckBanner(null);
      soundBankRef.current?.unlock();
      if (res.justCompleted) {
        handleVictoryAudioOnce(res.state, true);
      } else {
        soundBankRef.current?.playSudokuPlaceTile(isMutedRef.current, false, turnTokenRef.current);
      }
    }
  }, [activeHint, game, handleVictoryAudioOnce]);

  // Optional strict-Vietnamese read-aloud of the current hint explanation
  const handleSpeakHint = useCallback(() => {
    if (!activeHint || isMutedRef.current) return;
    voiceRef.current?.replayText({
      text: activeHint.speechText,
      isMuted: isMutedRef.current,
      voiceEnabled: true,
    });
  }, [activeHint]);

  // Back to library — cancel all pending audio immediately
  const handleExitToLibrary = useCallback(() => {
    stopPendingAudio();
    onBackToLibrary();
  }, [stopPendingAudio, onBackToLibrary]);

  // Physical keyboard support: Arrows, 1-9, Backspace/Delete, N (Notes), Ctrl+Z/U (Undo), H (Hint), K (Conflicts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }

      const size = game.puzzle.size;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCell((prev) => ({ row: (prev.row - 1 + size) % size, col: prev.col }));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCell((prev) => ({ row: (prev.row + 1) % size, col: prev.col }));
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCell((prev) => ({ row: prev.row, col: (prev.col - 1 + size) % size }));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCell((prev) => ({ row: prev.row, col: (prev.col + 1) % size }));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        handleEraseSelected();
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        const digit = Number(e.key);
        if (digit >= 1 && digit <= size) {
          e.preventDefault();
          handleDigitInput(digit);
        }
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === 'n') {
        e.preventDefault();
        setNoteMode((prev) => !prev);
      } else if (lower === 'u') {
        e.preventDefault();
        handleUndo();
      } else if (lower === 'h') {
        e.preventDefault();
        handleRequestHint();
      } else if (lower === 'k') {
        e.preventDefault();
        handleCheckConflicts();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game.puzzle.size, handleDigitInput, handleEraseSelected, handleUndo, handleRequestHint, handleCheckConflicts]);

  const handleWebGLUnavailable = useCallback(() => {
    setWebglAutoFallbackNotice(true);
  }, []);

  const selectedKey = cellKey(selectedCell.row, selectedCell.col);
  const selectedIsGiven = isCellGiven(game, selectedCell.row, selectedCell.col);
  const selectedNotes = game.notes[selectedKey] ?? [];
  const digits = useMemo(
    () => Array.from({ length: game.puzzle.size }, (_, idx) => idx + 1),
    [game.puzzle.size]
  );

  // Highlight conflict units on board when conflict banner is active OR hint reports conflict
  const conflictUnitsHighlight = useMemo(() => {
    if (conflictCheckBanner?.report.hasConflicts) {
      return {
        rows: conflictCheckBanner.report.highlightRows,
        cols: conflictCheckBanner.report.highlightCols,
        boxes: conflictCheckBanner.report.highlightBoxes,
      };
    }
    if (activeHint?.status === 'has_conflicts' && activeHint.conflictReport) {
      return {
        rows: activeHint.conflictReport.highlightRows,
        cols: activeHint.conflictReport.highlightCols,
        boxes: activeHint.conflictReport.highlightBoxes,
      };
    }
    return null;
  }, [conflictCheckBanner, activeHint]);

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-dvh overflow-y-auto' : 'min-h-[640px] rounded-2xl border border-slate-800'
      } bg-[#061024] text-slate-100 flex flex-col`}
    >
      {/* Top Control Header */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-5 py-3 border-b border-slate-800/90 bg-[#08152E]">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về thư viện</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white truncate">
              <span>F01 · Sudoku</span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-teal-300 font-semibold">{game.puzzle.size}×{game.puzzle.size}</span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 truncate">
              <span>{game.puzzle.title}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="text-slate-300">{game.puzzle.difficultyLabel}</span>
              {isDemo && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className="text-amber-300">Chế độ Demo tách biệt</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mode, Size, Timer, Display & Audio Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Size Segmented Control */}
          <div
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700/80"
            role="group"
            aria-label="Kích thước bảng Sudoku"
          >
            <button
              type="button"
              onClick={() => handleSwitchSize(4)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                game.puzzle.size === 4
                  ? 'bg-teal-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              4×4
            </button>
            <button
              type="button"
              onClick={() => handleSwitchSize(9)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                game.puzzle.size === 9
                  ? 'bg-teal-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              9×9
            </button>
          </div>

          {/* Play Mode Segmented Control */}
          <div
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700/80"
            role="group"
            aria-label="Chế độ chơi"
          >
            <button
              type="button"
              onClick={() => handleSwitchMode('solo')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                game.mode === 'solo'
                  ? 'bg-slate-100 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Tự luyện</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('class')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                game.mode === 'class'
                  ? 'bg-slate-100 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Trình chiếu lớp</span>
            </button>
          </div>

          {/* Timer Toggle */}
          <button
            type="button"
            onClick={() => setGame((prev) => ({ ...prev, timerEnabled: !prev.timerEnabled }))}
            title={game.timerEnabled ? 'Đang bật đồng hồ (nhấn để tắt)' : 'Đồng hồ đang tắt (nhấn để bật)'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold tabular-nums transition-colors whitespace-nowrap cursor-pointer ${
              game.timerEnabled
                ? 'bg-slate-900 border-teal-500/40 text-teal-200'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{game.timerEnabled ? formatClock(game.elapsedSeconds) : 'Tắt giờ'}</span>
          </button>

          {/* 3D / 2D Lightweight Toggle */}
          <button
            type="button"
            onClick={() => setPreferLightweight2D((prev) => !prev)}
            title={preferLightweight2D ? 'Chuyển sang bảng gốm 3D' : 'Chuyển sang giao diện nhẹ 2D'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-teal-400/60 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            {preferLightweight2D ? <Grid2x2 className="w-3.5 h-3.5 text-teal-300" /> : <Box className="w-3.5 h-3.5 text-teal-300" />}
            <span>{preferLightweight2D ? 'Nhẹ 2D' : 'Bảng 3D'}</span>
          </button>

          {/* Reduced Motion Toggle */}
          <button
            type="button"
            onClick={() => setReducedMotion((prev) => !prev)}
            aria-pressed={reducedMotion}
            title="Bật hoặc tắt chế độ giảm chuyển động"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              reducedMotion
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Giảm chuyển động</span>
          </button>

          {/* Audio Mute Button (synced with A01/A02) */}
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            title={isMuted ? 'Âm thanh đang tắt (nhấn để bật)' : 'Âm thanh đang bật (nhấn để tắt)'}
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

      {/* Main Two-Zone Workspace (Optimized for 1366x768, 1920x1080 & Mobile) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 sm:p-4 lg:p-5 items-start max-w-[1600px] w-full mx-auto">
        {/* LEFT / TOP ZONE: 3D Ceramic Sudoku Board + Compact Progress Strip */}
        <section className="lg:col-span-7 flex flex-col gap-3">
          {/* Quiet contextual bar (Class Projector vs Solo + Puzzle selector) */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B1833] border border-slate-800/90 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300">
              <span className="font-semibold text-white">
                {game.mode === 'class' ? 'Tiến độ chung cả lớp' : 'Tiến độ tự luyện'}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="tabular-nums">
                Đã điền <strong className="text-teal-300">{filledStats.filledCells}/{filledStats.totalCells}</strong> ô
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="tabular-nums">
                Tự giải <strong className="text-white">{userStats.userFilled}/{userStats.editableTotal}</strong>
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="tabular-nums">
                Gợi ý <strong className="text-amber-300">{game.hintsUsed}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="f01-puzzle-select" className="sr-only">
                Chọn đề mẫu
              </label>
              <select
                id="f01-puzzle-select"
                value={
                  puzzlesForCurrentSize.some((p) => p.id === game.puzzle.id)
                    ? game.puzzle.id
                    : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value !== 'custom') handleSelectPuzzleById(e.target.value);
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                {puzzlesForCurrentSize.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.difficultyLabel})
                  </option>
                ))}
                {!puzzlesForCurrentSize.some((p) => p.id === game.puzzle.id) && (
                  <option value="custom">{game.puzzle.title}</option>
                )}
              </select>
            </div>
          </div>

          {game.mode === 'class' && (
            <div className="px-3.5 py-2 rounded-xl bg-teal-950/35 border border-teal-500/30 text-xs sm:text-sm text-teal-100">
              <strong className="text-teal-300">Chế độ trình chiếu (1–50 HS):</strong> Giáo viên chọn ô, nhập số theo đề xuất của lớp và mời học sinh giải thích lý do trước khi chốt.
            </div>
          )}

          {webglAutoFallbackNotice && !preferLightweight2D && (
            <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300">
              Thiết bị hiện không hỗ trợ WebGL — hệ thống đã tự động chuyển sang bảng gốm 2D sắc nét để đảm bảo thao tác mượt mà.
            </div>
          )}

          {/* Primary Ceramic Board Stage */}
          <div className="w-full aspect-square max-h-[68vh] lg:max-h-[72vh] mx-auto rounded-2xl border border-slate-800 bg-[#061024] overflow-hidden shadow-lg">
            <Sudoku3DScene
              size={game.puzzle.size}
              givens={game.puzzle.givens}
              values={game.values}
              notes={game.notes}
              selectedCell={selectedCell}
              conflictCellKeys={conflictCellKeySet}
              conflictUnitsHighlight={conflictUnitsHighlight}
              activeHint={activeHint}
              isCompleted={game.isCompleted}
              completionToken={game.completionToken}
              reducedMotion={reducedMotion}
              preferLightweight2D={preferLightweight2D}
              onSelectCell={handleSelectCell}
              onWebGLUnavailable={handleWebGLUnavailable}
            />
          </div>

          {/* Non-Hue Visual Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B1833]/80 border border-slate-800/80 text-[11px] sm:text-xs text-slate-300">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Ô cho sẵn (khóa)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-1 rounded-full bg-teal-300 inline-block" aria-hidden="true" />
                <span>Ô bạn điền</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded border-2 border-teal-300 inline-block" aria-hidden="true" />
                <span>Ô đang chọn (H{selectedCell.row + 1}C{selectedCell.col + 1})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Xung đột ({liveConflicts.conflictCellKeys.length})</span>
              </span>
            </div>
            <span className="hidden sm:inline text-slate-400">
              Phím mũi tên · 1–{game.puzzle.size} · Del xóa · N ghi chú · Ctrl+Z hoàn tác
            </span>
          </div>
        </section>

        {/* RIGHT / BOTTOM ZONE: Keypad (directly under board on mobile!), Actions, Conflict Check & Explainable Hint */}
        <aside className="lg:col-span-5 flex flex-col gap-3.5">
          {/* Completion Celebration Summary Card */}
          {game.isCompleted && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/50 border border-emerald-400/50 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    Hoàn thành bảng Sudoku {game.puzzle.size}×{game.puzzle.size}!
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
                    Mọi hàng, cột và vùng đều hợp lệ; toàn bộ ô cho sẵn được giữ nguyên vẹn.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/25">
                  <div className="text-[11px] text-slate-400">Số ô đã điền</div>
                  <div className="text-base sm:text-lg font-extrabold text-white tabular-nums">
                    {filledStats.filledCells}/{filledStats.totalCells}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/25">
                  <div className="text-[11px] text-slate-400">Thời gian</div>
                  <div className="text-base sm:text-lg font-extrabold text-teal-200 tabular-nums">
                    {game.timerEnabled ? formatClock(game.elapsedSeconds) : 'Không bật'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/25">
                  <div className="text-[11px] text-slate-400">Gợi ý đã dùng</div>
                  <div className="text-base sm:text-lg font-extrabold text-amber-300 tabular-nums">
                    {game.hintsUsed}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleReplayPuzzle}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Chơi lại đề này</span>
                </button>
                <button
                  type="button"
                  onClick={handleChangePuzzle}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Đổi đề</span>
                </button>
                <button
                  type="button"
                  onClick={handleExitToLibrary}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Về thư viện</span>
                </button>
              </div>
            </div>
          )}

          {/* On-Screen Number Pad (Placed first in aside -> immediately below board on mobile!) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0B1833] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-bold text-white">
                Ô đang chọn: <span className="text-teal-300">Hàng {selectedCell.row + 1}, Cột {selectedCell.col + 1}</span>
                {selectedIsGiven && (
                  <span className="ml-2 text-slate-400 font-medium">(Khóa – cho sẵn)</span>
                )}
              </div>

              {/* Notes Mode Toggle */}
              <button
                type="button"
                onClick={() => setNoteMode((prev) => !prev)}
                aria-pressed={noteMode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  noteMode
                    ? 'bg-sky-400 text-slate-950 border-sky-300'
                    : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-sky-400/60'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Ghi chú: {noteMode ? 'BẬT' : 'Tắt'}</span>
              </button>
            </div>

            {noteMode && (
              <p className="text-xs text-sky-200/90">
                Đang ở chế độ <strong>Ghi chú số ứng viên</strong> — nhấn số để bật/tắt ghi chú nhỏ trong ô trống (không tính là đáp án).
              </p>
            )}

            {/* Digit Buttons */}
            <div
              className={`grid gap-2 ${
                game.puzzle.size === 4 ? 'grid-cols-4' : 'grid-cols-5 sm:grid-cols-9 lg:grid-cols-5'
              }`}
            >
              {digits.map((digit) => {
                const isNotedInSelected = selectedNotes.includes(digit);
                return (
                  <button
                    key={digit}
                    type="button"
                    disabled={game.isCompleted || selectedIsGiven}
                    onClick={() => handleDigitInput(digit)}
                    className={`min-h-[48px] sm:min-h-[52px] rounded-xl font-extrabold text-xl sm:text-2xl tabular-nums transition-all cursor-pointer flex flex-col items-center justify-center border ${
                      game.isCompleted || selectedIsGiven
                        ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                        : noteMode
                        ? isNotedInSelected
                          ? 'bg-sky-500/25 border-sky-300 text-sky-100'
                          : 'bg-[#102447] border-slate-700 hover:border-sky-400 text-sky-200 active:scale-95'
                        : 'bg-[#132C57] border-teal-500/35 hover:bg-[#193B72] hover:border-teal-300 text-white active:scale-95'
                    }`}
                  >
                    <span>{digit}</span>
                    {noteMode && isNotedInSelected && (
                      <span className="text-[10px] font-semibold text-sky-300 leading-none">đã ghi</span>
                    )}
                  </button>
                );
              })}

              {/* Quick Erase button fits cleanly on 9x9 grid's 10th slot */}
              {game.puzzle.size === 9 && (
                <button
                  type="button"
                  disabled={game.isCompleted || selectedIsGiven}
                  onClick={handleEraseSelected}
                  className={`min-h-[48px] sm:min-h-[52px] rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    game.isCompleted || selectedIsGiven
                      ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-900 border-slate-700 hover:border-rose-400/70 text-slate-200 hover:text-rose-200 active:scale-95'
                  }`}
                >
                  <Eraser className="w-4 h-4" />
                  <span>Xóa</span>
                </button>
              )}
            </div>

            {/* Action Toolbar: Erase (for 4x4), Undo, Check Conflicts, Step Hint */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {game.puzzle.size === 4 && (
                <button
                  type="button"
                  disabled={game.isCompleted || selectedIsGiven}
                  onClick={handleEraseSelected}
                  className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    game.isCompleted || selectedIsGiven
                      ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-900 border-slate-700 hover:border-rose-400/60 text-slate-100'
                  }`}
                >
                  <Eraser className="w-4 h-4" />
                  <span>Xóa ô</span>
                </button>
              )}

              <button
                type="button"
                disabled={game.undoStack.length === 0}
                onClick={handleUndo}
                className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  game.undoStack.length === 0
                    ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-900 border-slate-700 hover:border-teal-400/60 text-slate-100'
                }`}
              >
                <Undo2 className="w-4 h-4" />
                <span>Hoàn tác ({game.undoStack.length})</span>
              </button>

              <button
                type="button"
                onClick={handleCheckConflicts}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-teal-400/70 text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-teal-300" />
                <span>Kiểm tra xung đột</span>
              </button>

              <button
                type="button"
                disabled={game.isCompleted}
                onClick={handleRequestHint}
                className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  game.isCompleted
                    ? 'bg-slate-900/50 border border-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                } ${game.puzzle.size === 9 ? 'col-span-2' : ''}`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>Gợi ý từng bước</span>
              </button>
            </div>

            {statusNotice && (
              <div
                role="status"
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
              >
                {statusNotice}
              </div>
            )}
          </div>

          {/* Conflict Check Result Panel */}
          {conflictCheckBanner && (
            <div
              role="status"
              className={`p-3.5 sm:p-4 rounded-2xl border space-y-2 ${
                conflictCheckBanner.report.hasConflicts
                  ? 'bg-rose-950/45 border-rose-500/55 text-rose-100'
                  : 'bg-emerald-950/40 border-emerald-500/45 text-emerald-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold">
                  {conflictCheckBanner.report.hasConflicts ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Phát hiện xung đột trên bảng</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Chưa phát hiện xung đột</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConflictCheckBanner(null)}
                  className="text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Đóng
                </button>
              </div>

              {conflictCheckBanner.report.hasConflicts ? (
                <ul className="space-y-1 text-xs sm:text-sm list-disc pl-5 text-rose-100/95">
                  {conflictCheckBanner.report.conflictUnits.map((unit, idx) => (
                    <li key={`${unit.type}-${unit.index}-${unit.digit}-${idx}`}>{unit.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs sm:text-sm text-emerald-100/90">
                  {filledStats.emptyCells > 0
                    ? `Hiện chưa có số trùng theo hàng, cột hay vùng. Còn ${filledStats.emptyCells} ô trống — bạn có thể tiếp tục giải.`
                    : 'Toàn bộ các hàng, cột và vùng đều hợp lệ.'}
                </p>
              )}
            </div>
          )}

          {/* Explainable Step-by-Step Hint Panel */}
          {activeHint && (
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border space-y-3 ${
                activeHint.status === 'found'
                  ? 'bg-amber-950/35 border-amber-400/55'
                  : activeHint.status === 'has_conflicts'
                  ? 'bg-rose-950/40 border-rose-500/55'
                  : 'bg-slate-900 border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sparkles
                    className={`w-4 h-4 shrink-0 ${
                      activeHint.status === 'found'
                        ? 'text-amber-300'
                        : activeHint.status === 'has_conflicts'
                        ? 'text-rose-400'
                        : 'text-teal-300'
                    }`}
                  />
                  <span>
                    {activeHint.status === 'found'
                      ? activeHint.techniqueLabel || 'Gợi ý suy luận'
                      : activeHint.status === 'has_conflicts'
                      ? 'Cần xử lý xung đột trước'
                      : activeHint.status === 'already_complete'
                      ? 'Bảng đã hoàn thành'
                      : 'Chưa tìm được bước suy luận trực tiếp'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveHint(null)}
                  className="text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Đóng
                </button>
              </div>

              <div className="text-xs sm:text-sm leading-relaxed text-slate-100 overflow-x-auto">
                <MathView content={activeHint.explanation} />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {activeHint.status === 'found' && (
                  <button
                    type="button"
                    onClick={handleApplyHint}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Áp dụng gợi ý (điền số {activeHint.suggestedDigit})</span>
                  </button>
                )}

                {viVoiceAvailable && !isMuted && (
                  <button
                    type="button"
                    onClick={handleSpeakHint}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 text-teal-300" />
                    <span>Đọc gợi ý</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Puzzle Controls Footer Card (Always reachable without hiding board) */}
          <div className="p-3.5 rounded-2xl bg-[#0B1833] border border-slate-800 space-y-2.5">
            <div className="text-xs text-slate-400">
              <strong className="text-slate-200">Kỹ thuật đề này:</strong> {game.puzzle.techniqueSummary}.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleReplayPuzzle}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-teal-400/60 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Chơi lại đề này</span>
              </button>
              <button
                type="button"
                onClick={handleChangePuzzle}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-teal-400/60 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Đổi đề</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Sudoku3DGame;
