import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Eye,
  FastForward,
  Grid,
  HelpCircle,
  Keyboard,
  Lightbulb,
  Maximize2,
  Minimize2,
  Printer,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { ClassRoom, Question, UserRole } from '../../../types';
import { MathView } from '../../MathView';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  loadEduGameVoiceEnabled,
  saveEduGameMuted,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import imgC09Cover from '../../../assets/images/game_c09_bingo_3d_1795346186759.jpg';
import {
  C09BoardSize,
  C09GameState,
  C09GraphicsQuality,
  C09ParticipationMode,
  C09QuestionSource,
  C09SetupConfig,
  C09_BINGO_BONUS_POINTS,
  C09_QUESTION_POINTS,
  C09_SAMPLE_BADGE,
  adaptBankQuestionsForC09,
  advanceToNextC09Question,
  buildC09PrintableCardSpec,
  canHaveC09FreeCenter,
  clearC09Session,
  computeC09Summary,
  createC09SetupState,
  createDefaultC09SetupConfig,
  finishC09ToSummary,
  loadC09Session,
  markC09SolutionViewed,
  publishC09QuestionResult,
  revealC09Hint,
  saveC09Session,
  skipC09RevealAnimation,
  startC09Bingo,
  submitC09WhiteboardHold,
  toggleC09CardCellMark,
  verifyC09BingoClaims,
} from './bingoKnowledge3dEngine';
import { BingoKnowledge3DScene } from './BingoKnowledge3DScene';

export interface BingoKnowledge3DGameProps {
  classes: ClassRoom[];
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

function stripMathForSpeech(input: string): string {
  return input
    .replace(/\\\(|\\\)|\\\[|\\\]/g, ' ')
    .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]*)\}/g, 'căn bậc hai của $1')
    .replace(/\^\\circ/g, ' độ')
    .replace(/\^2/g, ' bình phương')
    .replace(/\^3/g, ' lập phương')
    .replace(/\\times|\\cdot/g, ' nhân ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const BingoKnowledge3DGame: React.FC<BingoKnowledge3DGameProps> = ({
  classes,
  bankQuestions,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const [setupConfig, setSetupConfig] = useState<C09SetupConfig>(() =>
    createDefaultC09SetupConfig()
  );
  const [gameState, setGameState] = useState<C09GameState>(() =>
    createC09SetupState()
  );
  const [restoredBanner, setRestoredBanner] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string>('');
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const [quality, setQuality] = useState<C09GraphicsQuality>('high');
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted());
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() =>
    loadEduGameVoiceEnabled()
  );
  const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false);

  const [selectedHoldCardId, setSelectedHoldCardId] = useState<string>('card_1');
  const [claimingCardIds, setClaimingCardIds] = useState<string[]>(['card_1']);
  const [focusedCellIndex, setFocusedCellIndex] = useState<number>(0);
  const [keyboardZone, setKeyboardZone] = useState<'question' | 'board'>('question');

  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);

  if (!soundBankRef.current) {
    soundBankRef.current = new EduGameSoundBank();
  }
  if (!voiceRef.current) {
    voiceRef.current = new EduGameVoiceController(null);
  }

  // Restore saved session cleanly on mount
  useEffect(() => {
    const saved = loadC09Session();
    if (saved && saved.phase !== 'setup' && saved.cards.length > 0) {
      setGameState(saved);
      setSetupConfig(saved.config);
      setClaimingCardIds([saved.cards[0].cardId]);
      setSelectedHoldCardId(saved.cards[0].cardId);
      setRestoredBanner(true);
    }
  }, []);

  // Persist active game session
  useEffect(() => {
    if (gameState.phase !== 'setup') {
      saveC09Session(gameState);
    }
  }, [gameState]);

  // Dispose audio & voice cleanly on unmount
  useEffect(() => {
    return () => {
      soundBankRef.current?.stopAll();
      soundBankRef.current?.dispose();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
    };
  }, []);

  // Keep turn token synced on sound bank & clear pending speech on turn transitions
  useEffect(() => {
    soundBankRef.current?.setActiveTurnToken(gameState.turnToken);
  }, [gameState.turnToken]);

  const cancelPendingAudioAndSpeech = useCallback(() => {
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const adaptedBankCount = useMemo(
    () => adaptBankQuestionsForC09(bankQuestions, userRole).length,
    [bankQuestions, userRole]
  );

  const activeQuestionProgress =
    gameState.activeQuestionIndex !== null
      ? gameState.deck[gameState.activeQuestionIndex] ?? null
      : null;

  const focusedCard =
    gameState.cards[gameState.focusedCardIndex] ?? gameState.cards[0] ?? null;

  const summaryStats = useMemo(
    () => computeC09Summary(gameState),
    [gameState]
  );

  const handleToggleMute = useCallback(() => {
    setHasUserInteracted(true);
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        cancelPendingAudioAndSpeech();
      }
      return next;
    });
  }, [cancelPendingAudioAndSpeech]);

  const handleToggleVoice = useCallback(() => {
    setHasUserInteracted(true);
    setVoiceEnabled((prev) => {
      const next = !prev;
      saveEduGameVoiceEnabled(next);
      if (!next) {
        voiceRef.current?.stop();
        stopAllGlobalEduSpeech();
      }
      return next;
    });
  }, []);

  const speakVietnamese = useCallback(
    (text: string) => {
      if (!hasUserInteracted || isMuted || !voiceEnabled) return;
      voiceRef.current?.replayText({
        text: stripMathForSpeech(text),
        isMuted,
        voiceEnabled,
      });
    },
    [hasUserInteracted, isMuted, voiceEnabled]
  );

  const handleStartGame = useCallback(() => {
    setHasUserInteracted(true);
    cancelPendingAudioAndSpeech();
    setSetupError('');

    const result = startC09Bingo({
      config: setupConfig,
      bankQuestions,
      userRole,
    });
    if (!result.ok || !result.state) {
      setSetupError(result.error || 'Không thể khởi tạo bàn Bingo.');
      return;
    }

    setGameState(result.state);
    setRestoredBanner(false);
    setFocusedCellIndex(0);
    setSelectedHoldCardId(result.state.cards[0]?.cardId || 'card_1');
    setClaimingCardIds(result.state.cards[0] ? [result.state.cards[0].cardId] : []);
    soundBankRef.current?.setActiveTurnToken(result.state.turnToken);
    soundBankRef.current?.playBingoOpenQuestion(isMuted, result.state.turnToken);
  }, [
    setupConfig,
    bankQuestions,
    userRole,
    isMuted,
    cancelPendingAudioAndSpeech,
  ]);

  const handleAnswerOption = useCallback(
    (optionId: string) => {
      setHasUserInteracted(true);
      if (!activeQuestionProgress || gameState.phase !== 'playing') return;

      if (gameState.config.whiteboardHoldMode) {
        const next = submitC09WhiteboardHold({
          state: gameState,
          cardId: selectedHoldCardId,
          optionId,
        });
        setGameState(next);
        soundBankRef.current?.playBingoMarkCell(isMuted, true, next.turnToken);
        return;
      }

      const next = publishC09QuestionResult({
        state: gameState,
        turnToken: gameState.turnToken,
        optionId,
      });
      setGameState(next);
      const qRes =
        next.activeQuestionIndex !== null
          ? next.deck[next.activeQuestionIndex]
          : null;
      const isOk =
        qRes?.outcome === 'correct_independent' ||
        qRes?.outcome === 'correct_with_hint';
      soundBankRef.current?.playBingoMarkCell(isMuted, isOk, next.turnToken);
      if (qRes) {
        speakVietnamese(
          `${isOk ? 'Chính xác.' : 'Chưa đúng.'} Đáp án là ${qRes.question.answerPlainText}. ${qRes.question.explanationText}`
        );
      }
    },
    [
      activeQuestionProgress,
      gameState,
      selectedHoldCardId,
      isMuted,
      speakVietnamese,
    ]
  );

  const handleCommitHeldWhiteboard = useCallback(() => {
    setHasUserInteracted(true);
    const next = publishC09QuestionResult({
      state: gameState,
      turnToken: gameState.turnToken,
      commitHeldWhiteboard: true,
    });
    setGameState(next);
    soundBankRef.current?.playBingoMarkCell(isMuted, true, next.turnToken);
  }, [gameState, isMuted]);

  const handleTeacherOralConfirm = useCallback(
    (isCorrect: boolean) => {
      setHasUserInteracted(true);
      const next = publishC09QuestionResult({
        state: gameState,
        turnToken: gameState.turnToken,
        teacherConfirmCorrect: isCorrect,
      });
      setGameState(next);
      soundBankRef.current?.playBingoMarkCell(isMuted, isCorrect, next.turnToken);
    },
    [gameState, isMuted]
  );

  const handleSkipQuestion = useCallback(() => {
    setHasUserInteracted(true);
    cancelPendingAudioAndSpeech();
    const next = publishC09QuestionResult({
      state: gameState,
      turnToken: gameState.turnToken,
      skip: true,
    });
    setGameState(next);
  }, [gameState, cancelPendingAudioAndSpeech]);

  const handleToggleCell = useCallback(
    (cellIndex: number) => {
      setHasUserInteracted(true);
      if (!focusedCard) return;
      setFocusedCellIndex(cellIndex);
      const next = toggleC09CardCellMark(gameState, focusedCard.cardId, cellIndex);
      setGameState(next);
      const updatedCell = next.cards[next.focusedCardIndex]?.cells[cellIndex];
      const validMark =
        Boolean(updatedCell?.marked) &&
        updatedCell?.answerId !== null &&
        updatedCell?.answerId !== undefined &&
        next.publishedAnswerIds.includes(updatedCell.answerId);
      soundBankRef.current?.playBingoMarkCell(isMuted, validMark, next.turnToken);
    },
    [focusedCard, gameState, isMuted]
  );

  const handleVerifyBingoClaims = useCallback(() => {
    setHasUserInteracted(true);
    const next = verifyC09BingoClaims(gameState, claimingCardIds);
    setGameState(next);
    if (next.lastVerificationStatus === 'verified') {
      soundBankRef.current?.playBingoVerifiedWin(isMuted, next.turnToken);
      speakVietnamese(
        `Chúc mừng! Xác nhận Bingo hợp lệ cho ${next.lastClaimResults
          .filter((r) => r.valid)
          .map((r) => r.holderLabel)
          .join(' và ')}.`
      );
    } else {
      // Never play celebratory fanfare for pending or rejected claims!
      soundBankRef.current?.playBingoMarkCell(isMuted, false, next.turnToken);
    }
  }, [gameState, claimingCardIds, isMuted, speakVietnamese]);

  const handleNextQuestion = useCallback(() => {
    setHasUserInteracted(true);
    cancelPendingAudioAndSpeech();
    const next = advanceToNextC09Question(gameState);
    setGameState(next);
    soundBankRef.current?.setActiveTurnToken(next.turnToken);
    if (next.phase === 'playing') {
      soundBankRef.current?.playBingoOpenQuestion(isMuted, next.turnToken);
    }
  }, [gameState, isMuted, cancelPendingAudioAndSpeech]);

  const handleResetGame = useCallback(() => {
    setHasUserInteracted(true);
    cancelPendingAudioAndSpeech();
    clearC09Session();
    setRestoredBanner(false);
    setGameState(createC09SetupState(setupConfig));
  }, [cancelPendingAudioAndSpeech, setupConfig]);

  const handleExitToLibrary = useCallback(() => {
    cancelPendingAudioAndSpeech();
    onBackToLibrary();
  }, [cancelPendingAudioAndSpeech, onBackToLibrary]);

  // Keyboard navigation handler (1-4/A-D for answers, arrows + Space for board cells, H hint, S skip anim, M mute)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showGuideModal || showPrintModal) {
        if (e.key === 'Escape') {
          setShowGuideModal(false);
          setShowPrintModal(false);
        }
        return;
      }
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'm') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (gameState.phase === 'setup') return;

      if (key === 'h' && gameState.phase === 'playing') {
        e.preventDefault();
        setGameState((prev) => revealC09Hint(prev));
        return;
      }

      if (key === 's' && (gameState.phase === 'question_revealed' || gameState.phase === 'bingo_check')) {
        e.preventDefault();
        setGameState((prev) => skipC09RevealAnimation(prev));
        return;
      }

      if (key === 'tab' && (gameState.phase === 'playing' || gameState.phase === 'question_revealed')) {
        setKeyboardZone((prev) => (prev === 'question' ? 'board' : 'question'));
      }

      if (gameState.phase === 'playing' && activeQuestionProgress) {
        const idxMap: Record<string, number> = {
          '1': 0,
          a: 0,
          '2': 1,
          b: 1,
          '3': 2,
          c: 2,
          '4': 3,
          d: 3,
        };
        if (key in idxMap) {
          const opt = activeQuestionProgress.question.options[idxMap[key]];
          if (opt) {
            e.preventDefault();
            setKeyboardZone('question');
            handleAnswerOption(opt.optionId);
          }
          return;
        }
      }

      // Arrow keys move focused cell on active Bingo card; Space toggles mark
      const d = gameState.dimension;
      const total = d * d;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setKeyboardZone('board');
        setFocusedCellIndex((i) => (i + 1) % total);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setKeyboardZone('board');
        setFocusedCellIndex((i) => (i - 1 + total) % total);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setKeyboardZone('board');
        setFocusedCellIndex((i) => (i + d) % total);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setKeyboardZone('board');
        setFocusedCellIndex((i) => (i - d + total) % total);
      } else if (e.key === ' ' && keyboardZone === 'board') {
        e.preventDefault();
        handleToggleCell(focusedCellIndex);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showGuideModal,
    showPrintModal,
    gameState.phase,
    gameState.dimension,
    activeQuestionProgress,
    keyboardZone,
    focusedCellIndex,
    handleToggleMute,
    handleAnswerOption,
    handleToggleCell,
  ]);

  const questionStatusLabel = useMemo(() => {
    if (!activeQuestionProgress) return '';
    switch (activeQuestionProgress.status) {
      case 'open':
        return 'Đang mở — Chưa làm';
      case 'submitted':
        return 'Đã nộp bảng con — Chờ chốt';
      case 'published':
        return 'Đã công bố';
      case 'skipped':
        return 'Đã bỏ qua';
      default:
        return 'Chưa mở';
    }
  }, [activeQuestionProgress]);

  const printableSpecs = useMemo(() => {
    return gameState.cards.slice(0, 12).map((card) =>
      buildC09PrintableCardSpec(card, gameState.dimension, gameState.config.winPatterns)
    );
  }, [gameState.cards, gameState.dimension, gameState.config.winPatterns]);

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-dvh rounded-none' : 'min-h-[680px] rounded-2xl'
      } bg-[#061026] text-slate-100 border border-slate-700/80 flex flex-col overflow-hidden`}
    >
      {/* Clean 3-zone Top Header Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#091836] border-b border-slate-700/80 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Về thư viện
          </button>
          <span className="text-sm sm:text-base font-bold text-white truncate">
            C09 · Bingo kiến thức 3D
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          {gameState.phase !== 'setup' && (
            <>
              <span className="font-mono tabular-nums text-amber-300 font-semibold">
                {gameState.dimension}×{gameState.dimension} · Đã công bố {gameState.publishedAnswerIds.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-300 font-semibold">
                Điểm câu: {gameState.totalQuestionScore}đ
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Keyboard className="w-3.5 h-3.5 text-amber-300" />
                Vùng phím: {keyboardZone === 'board' ? 'Bảng Bingo' : 'Câu hỏi'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5 inline mr-1" />
            Hướng dẫn
          </button>
          <button
            type="button"
            onClick={() => setQuality((q) => (q === 'high' ? '2d' : 'high'))}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
              quality === '2d'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {quality === '2d' ? 'Bản 2D nhẹ' : 'Chế độ 3D'}
          </button>
          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              reducedMotion
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {reducedMotion ? 'Giảm CĐ: Bật' : 'Giảm CĐ'}
          </button>
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
              isMuted
                ? 'bg-rose-900/70 text-rose-200 border border-rose-500/40'
                : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 inline mr-1" /> : <Volume2 className="w-3.5 h-3.5 inline mr-1" />}
            {isMuted ? 'Tắt loa' : 'Âm thanh'}
          </button>
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              voiceEnabled && !isMuted
                ? 'bg-sky-800 text-sky-100'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Giọng Việt: {voiceEnabled ? 'Bật' : 'Tắt'}
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label="Toàn màn hình"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Restored Session Notice */}
      {restoredBanner && gameState.phase !== 'setup' && (
        <div className="px-4 py-2 bg-amber-950/70 border-b border-amber-500/40 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100">
          <span>
            Đã khôi phục phiên Bingo Kiến thức trước đó (bảng {gameState.dimension}×{gameState.dimension}, đã công bố {gameState.publishedAnswerIds.length} đáp án).
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetGame}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
            >
              Làm ván mới
            </button>
            <button
              type="button"
              onClick={() => setRestoredBanner(false)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              Ẩn
            </button>
          </div>
        </div>
      )}

      {/* SETUP PHASE */}
      {gameState.phase === 'setup' && (
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Cover Preview & Overview */}
            <section className="lg:col-span-5 bg-[#0C1B3B] border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-video w-full bg-slate-900 relative overflow-hidden">
                <img
                  src={imgC09Cover}
                  alt="Ảnh bìa C09 Bingo kiến thức 3D"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0C1B3B] via-transparent to-transparent" />
              </div>
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-xs text-amber-300 font-semibold mb-1">
                    C09 · Củng cố kiến thức · Trình chiếu 1 máy
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Bingo kiến thức 3D
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    Mở câu hỏi Toán trên máy chiếu, công bố đáp án chuẩn KaTeX, kiểm tra phiếu in A4 đen trắng hoặc bảng tương tác theo đúng lượt công bố — hỗ trợ đồng thắng nhiều phiếu cùng lúc.
                  </p>
                </div>
                <div className="border-t border-slate-700/80 pt-3 text-xs text-slate-300 space-y-1.5">
                  <div>• Gói Toán mẫu 25 câu duy nhất (gồm hàng mẫu 4, 7, 9 từ 2², √49, 3²)</div>
                  <div>• Tự luyện 1 HS hoặc Cả lớp / Đội (1–50 phiếu in A4 đen trắng)</div>
                  <div>• Ô miễn phí chỉ đặt tại tâm bảng lẻ (3×3, 5×5); bảng 4×4 tự tắt</div>
                </div>
              </div>
            </section>

            {/* Setup Controls */}
            <section className="lg:col-span-7 bg-[#0C1B3B] border border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4">
              {/* Board Size */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  1. Kích thước bảng trình chiếu & phiếu Bingo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['3x3', '4x4', '5x5'] as C09BoardSize[]).map((sz) => {
                    const active = setupConfig.boardSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() =>
                          setSetupConfig((prev) => ({
                            ...prev,
                            boardSize: sz,
                            freeCenterEnabled: canHaveC09FreeCenter(sz)
                              ? prev.freeCenterEnabled
                              : false,
                          }))
                        }
                        className={`py-2.5 px-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {sz.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Win Patterns & Free Center */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    2. Quy tắc thắng Bingo (chọn trước khi chơi)
                  </label>
                  <div className="space-y-1.5 text-xs">
                    {(
                      [
                        ['allowRows', 'Đủ 1 Hàng ngang'],
                        ['allowCols', 'Đủ 1 Cột dọc'],
                        ['allowDiagonals', 'Đủ 1 Đường chéo'],
                      ] as const
                    ).map(([field, label]) => (
                      <label
                        key={field}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/70 border border-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={setupConfig.winPatterns[field]}
                          onChange={(e) =>
                            setSetupConfig((prev) => ({
                              ...prev,
                              winPatterns: {
                                ...prev.winPatterns,
                                [field]: e.target.checked,
                              },
                            }))
                          }
                          className="accent-amber-500"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    3. Tùy chọn Ô miễn phí & Trình chiếu
                  </label>
                  <div className="space-y-1.5 text-xs">
                    <label
                      className={`flex items-start gap-2 p-2 rounded-lg border ${
                        canHaveC09FreeCenter(setupConfig.boardSize)
                          ? 'bg-slate-800/70 border-slate-700 cursor-pointer'
                          : 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!canHaveC09FreeCenter(setupConfig.boardSize)}
                        checked={
                          canHaveC09FreeCenter(setupConfig.boardSize) &&
                          setupConfig.freeCenterEnabled
                        }
                        onChange={(e) =>
                          setSetupConfig((prev) => ({
                            ...prev,
                            freeCenterEnabled: e.target.checked,
                          }))
                        }
                        className="mt-0.5 accent-amber-500"
                      />
                      <span>
                        Bật Ô miễn phí ở tâm (chỉ cho bảng lẻ 3×3, 5×5)
                      </span>
                    </label>
                    <label className="flex items-start gap-2 p-2 rounded-lg bg-slate-800/70 border border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setupConfig.whiteboardHoldMode}
                        onChange={(e) =>
                          setSetupConfig((prev) => ({
                            ...prev,
                            whiteboardHoldMode: e.target.checked,
                          }))
                        }
                        className="mt-0.5 accent-amber-500"
                      />
                      <span>
                        Giữ đáp án bảng con (hiện trạng thái Đã nộp trước khi chốt)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Participation Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  4. Hình thức tổ chức (Không cần đăng nhập hay thiết bị HS riêng)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['solo', 'Tự luyện / Bảng trình chiếu (1 phiếu #01)'],
                      ['class_cards', 'Cả lớp / Nhóm (Tạo 1–50 phiếu in A4)'],
                    ] as Array<[C09ParticipationMode, string]>
                  ).map(([mode, title]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        setSetupConfig((prev) => ({
                          ...prev,
                          participationMode: mode,
                          cardCount: mode === 'solo' ? 1 : Math.max(4, prev.cardCount),
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold cursor-pointer ${
                        setupConfig.participationMode === mode
                          ? 'bg-sky-600/25 border-sky-400 text-sky-100'
                          : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {title}
                    </button>
                  ))}
                </div>

                {setupConfig.participationMode === 'class_cards' && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-700/80 text-xs">
                    <div>
                      <label className="block text-slate-300 mb-1">
                        Số phiếu in phát lớp (1–50)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={50}
                        value={setupConfig.cardCount}
                        onChange={(e) =>
                          setSetupConfig((prev) => ({
                            ...prev,
                            cardCount: Math.max(
                              2,
                              Math.min(50, Number(e.target.value) || 2)
                            ),
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">
                        Lớp Smart EDU (tùy chọn)
                      </label>
                      <select
                        value={setupConfig.selectedClassId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          const cls = classes.find((c) => c.id === cid);
                          setSetupConfig((prev) => ({
                            ...prev,
                            selectedClassId: cid,
                            classStudents: cls
                              ? cls.students.map((s) => ({
                                  id: s.id,
                                  fullName: s.fullName,
                                }))
                              : [],
                            cardCount: cls
                              ? Math.max(2, Math.min(50, cls.students.length || 6))
                              : prev.cardCount,
                          }));
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white"
                      >
                        <option value="">Đánh số phiếu #01..#50 (Không cần danh sách)</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} ({cls.students.length} HS)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Question Source */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  5. Nguồn câu hỏi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['sample_pack', `Gói Toán mẫu C09 (${C09_SAMPLE_BADGE})`],
                      [
                        'bank',
                        `Ngân hàng Smart EDU (${adaptedBankCount} câu hợp lệ)`,
                      ],
                    ] as Array<[C09QuestionSource, string]>
                  ).map(([src, label]) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() =>
                        setSetupConfig((prev) => ({ ...prev, questionSource: src }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold cursor-pointer ${
                        setupConfig.questionSource === src
                          ? 'bg-emerald-600/25 border-emerald-400 text-emerald-100'
                          : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {setupError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200">
                  {setupError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  Xem hướng dẫn luật chơi
                </button>
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold cursor-pointer transition-colors"
                >
                  Bắt đầu Bingo Kiến Thức 3D
                </button>
              </div>
            </section>
          </div>
        </main>
      )}

      {/* GAMEPLAY & CHECK PHASE */}
      {(gameState.phase === 'playing' ||
        gameState.phase === 'question_revealed' ||
        gameState.phase === 'bingo_check') && (
        <main className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* LEFT 7 COLS: 3D/2D Board Stage + Card Switcher + Announced Pool */}
            <section className="lg:col-span-7 flex flex-col gap-3">
              {/* Card Selector & Print A4 Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0C1B3B] border border-slate-700 rounded-xl p-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <Users className="w-4 h-4 text-amber-300" />
                  <span className="font-semibold text-slate-200">Phiếu đang xem:</span>
                  <select
                    value={gameState.focusedCardIndex}
                    onChange={(e) =>
                      setGameState((prev) => ({
                        ...prev,
                        focusedCardIndex: Number(e.target.value) || 0,
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-600 text-white text-xs font-semibold"
                  >
                    {gameState.cards.map((c, idx) => (
                      <option key={c.cardId} value={idx}>
                        {c.holderLabel} {c.hasVerifiedBingo ? '★ BINGO' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-100 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-300" />
                    Phiếu A4 đen trắng ({gameState.cards.length})
                  </button>
                </div>
              </div>

              {/* Main 3D / 2D Stage */}
              <div className="flex-1 min-h-[340px] rounded-2xl border border-slate-700 overflow-hidden bg-[#061026]">
                <BingoKnowledge3DScene
                  card={focusedCard}
                  dimension={gameState.dimension}
                  publishedAnswerIds={gameState.publishedAnswerIds}
                  winPatterns={gameState.config.winPatterns}
                  phase={gameState.phase}
                  verificationStatus={gameState.lastVerificationStatus}
                  quality={quality}
                  reducedMotion={reducedMotion}
                  focusedCellIndex={focusedCellIndex}
                  onToggleCell={handleToggleCell}
                  onWebGLFallback={() => setQuality('2d')}
                />
              </div>

              {/* Announced Answer Pool */}
              <div className="bg-[#0C1B3B] border border-slate-700 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                  <span className="font-semibold text-amber-300">
                    Đáp án đã công bố hợp lệ ({gameState.publishedAnswerIds.length}):
                  </span>
                  <span className="text-slate-400">
                    {gameState.lastActionNotice}
                  </span>
                </div>
                {gameState.publishedAnswerIds.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Chưa có đáp án nào được công bố. Hãy giải và chốt câu đầu tiên!
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {gameState.deck
                      .filter((d) =>
                        gameState.publishedAnswerIds.includes(d.question.answerId)
                      )
                      .map((d) => (
                        <span
                          key={d.question.answerId}
                          className="px-2.5 py-1 rounded-lg bg-sky-900/70 border border-sky-500/40 text-xs font-bold text-sky-100"
                        >
                          <MathView content={d.question.answerText} />
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT 5 COLS: Active Question, Whiteboard Hold, Reveal, & Multi-Claim Verification */}
            <section className="lg:col-span-5 flex flex-col gap-3">
              {/* Active Question & Reveal Card */}
              {activeQuestionProgress && (
                <div className="bg-[#0C1B3B] border border-slate-700 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-700/80 text-xs">
                    <span className="font-semibold text-amber-300">
                      Câu {(gameState.activeQuestionIndex ?? 0) + 1}/{gameState.deck.length} ·{' '}
                      {activeQuestionProgress.question.topicLabel} ·{' '}
                      {activeQuestionProgress.question.sourceTag}
                    </span>
                    <span className="font-bold text-sky-300">{questionStatusLabel}</span>
                  </div>

                  {/* Question Stem */}
                  <div className="p-3 rounded-xl bg-slate-900/85 border border-slate-700 text-base sm:text-lg font-semibold text-white max-h-[160px] overflow-y-auto">
                    <MathView content={activeQuestionProgress.question.stem} block />
                  </div>

                  {/* Hint Box */}
                  {gameState.activeHintRevealed && (
                    <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-xs text-amber-100">
                      <span className="font-bold block mb-0.5">Gợi ý hỗ trợ:</span>
                      <MathView content={activeQuestionProgress.question.hintText} />
                    </div>
                  )}

                  {/* Options A-D */}
                  {gameState.phase === 'playing' && (
                    <>
                      {gameState.config.whiteboardHoldMode && (
                        <div className="flex items-center justify-between gap-2 text-xs bg-slate-900/70 p-2 rounded-lg border border-slate-700">
                          <span className="text-slate-300">Nhập bảng con cho:</span>
                          <select
                            value={selectedHoldCardId}
                            onChange={(e) => setSelectedHoldCardId(e.target.value)}
                            className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-white"
                          >
                            {gameState.cards.map((c) => (
                              <option key={c.cardId} value={c.cardId}>
                                {c.holderLabel}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {activeQuestionProgress.question.options.map((opt) => (
                          <button
                            key={opt.optionId}
                            type="button"
                            onClick={() => handleAnswerOption(opt.optionId)}
                            className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600 hover:border-amber-400 text-left text-sm font-semibold text-white transition-colors cursor-pointer"
                          >
                            <span className="text-amber-300 font-mono mr-1.5">
                              {opt.labelKey}.
                            </span>
                            <MathView content={opt.text} />
                          </button>
                        ))}
                      </div>

                      {/* Held whiteboard entries summary */}
                      {gameState.config.whiteboardHoldMode &&
                        Object.keys(activeQuestionProgress.cardSubmissions).length > 0 && (
                          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/40 text-xs space-y-2">
                            <div className="font-semibold text-amber-300">
                              Đang giữ trạng thái Đã nộp ({Object.keys(activeQuestionProgress.cardSubmissions).length} phiếu):
                            </div>
                            <button
                              type="button"
                              onClick={handleCommitHeldWhiteboard}
                              className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
                            >
                              Chốt đáp án & Công bố
                            </button>
                          </div>
                        )}

                      {/* Teacher / Hint / Skip Action Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setGameState((prev) => revealC09Hint(prev))}
                          disabled={gameState.activeHintRevealed}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-amber-300 cursor-pointer"
                        >
                          <Lightbulb className="w-3.5 h-3.5 inline mr-1" />
                          Gợi ý (H)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTeacherOralConfirm(true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                          GV chốt Đúng
                        </button>
                        <button
                          type="button"
                          onClick={handleSkipQuestion}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer ml-auto"
                        >
                          <SkipForward className="w-3.5 h-3.5 inline mr-1" />
                          Bỏ qua
                        </button>
                      </div>
                    </>
                  )}

                  {/* REVEALED / SOLUTION VIEW */}
                  {(gameState.phase === 'question_revealed' ||
                    gameState.phase === 'bingo_check') && (
                    <div className="space-y-2.5">
                      <div
                        className={`p-3 rounded-xl border text-xs sm:text-sm ${
                          activeQuestionProgress.status === 'skipped'
                            ? 'bg-slate-800/80 border-slate-600 text-slate-200'
                            : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold">
                            {activeQuestionProgress.status === 'skipped'
                              ? 'Câu đã bỏ qua (chưa công bố vào bảng Bingo)'
                              : `Đáp án đã công bố: ${activeQuestionProgress.question.answerPlainText} (+${activeQuestionProgress.pointsAwarded}đ)`}
                          </span>
                          {!gameState.revealAnimDone && (
                            <button
                              type="button"
                              onClick={() =>
                                setGameState((prev) => skipC09RevealAnimation(prev))
                              }
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-amber-300 cursor-pointer"
                            >
                              <FastForward className="w-3 h-3 inline mr-1" />
                              Bỏ qua hoạt ảnh (S)
                            </button>
                          )}
                        </div>
                        {activeQuestionProgress.status === 'published' && (
                          <div className="text-xs text-slate-200 mt-1 max-h-[120px] overflow-y-auto">
                            <MathView
                              content={activeQuestionProgress.question.explanationText}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleNextQuestion}
                          className="flex-1 py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold cursor-pointer"
                        >
                          Chuyển câu tiếp theo
                        </button>
                        <button
                          type="button"
                          onClick={() => setGameState((prev) => finishC09ToSummary(prev))}
                          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                        >
                          Tổng kết
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* BINGO CLAIM VERIFIER (Check 1 or MULTIPLE cards BEFORE advancing turn!) */}
              <div className="bg-[#0C1B3B] border border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-300" />
                    Kiểm tra & Xác nhận Bingo (Hỗ trợ đồng thắng)
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    +{C09_BINGO_BONUS_POINTS}đ Bingo
                  </span>
                </div>

                {/* Pick cards claiming Bingo in this turn */}
                <div className="flex flex-wrap gap-1.5 max-h-[84px] overflow-y-auto">
                  {gameState.cards.map((c) => {
                    const selected = claimingCardIds.includes(c.cardId);
                    return (
                      <button
                        key={c.cardId}
                        type="button"
                        onClick={() =>
                          setClaimingCardIds((prev) =>
                            prev.includes(c.cardId)
                              ? prev.filter((id) => id !== c.cardId)
                              : [...prev, c.cardId]
                          )
                        }
                        className={`px-2 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                          selected
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        #{String(c.cardNumber).padStart(2, '0')}
                        {c.hasVerifiedBingo ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleVerifyBingoClaims}
                  className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors"
                >
                  Kiểm phiếu đã chọn theo đáp án đã công bố
                </button>

                {/* Verification Outcome Details */}
                {gameState.lastClaimResults.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    {gameState.lastClaimResults.map((res) => (
                      <div
                        key={res.cardId}
                        className={`p-2 rounded-lg border ${
                          res.valid
                            ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-100'
                            : 'bg-rose-950/70 border-rose-500/60 text-rose-100'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1">
                          {res.valid ? (
                            <Award className="w-3.5 h-3.5 text-amber-300" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-300" />
                          )}
                          {res.holderLabel}: {res.valid ? 'BINGO HỢP LỆ' : 'CHƯA HỢP LỆ'}
                        </div>
                        <p className="text-[11px] opacity-90 mt-0.5">{res.reasonText}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      )}

      {/* SUMMARY PHASE */}
      {gameState.phase === 'summary' && (
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-5">
            <section className="bg-[#0C1B3B] border border-slate-700 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-amber-300 mb-1">
                  TỔNG KẾT VÒNG BINGO KIẾN THỨC 3D ({gameState.dimension}×{gameState.dimension})
                </div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  {summaryStats.verifiedWinnerCount === 0
                    ? 'Hoàn thành ôn tập · Chưa có phiếu Bingo hợp lệ'
                    : summaryStats.isCoWinners
                      ? `Đồng thắng: ${summaryStats.winnerLabels.join(' & ')}`
                      : `Chiến thắng: ${summaryStats.winnerLabels[0]}`}
                </h2>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300 font-mono tabular-nums">
                  <span>Điểm câu hỏi: {summaryStats.totalQuestionScore}đ</span>
                  <span>·</span>
                  <span>Tổng điểm ván: {summaryStats.totalClassOrSoloScore}đ</span>
                  <span>·</span>
                  <span>Đúng tự làm: {summaryStats.independentCorrectCount}</span>
                  <span>·</span>
                  <span>Đúng có hỗ trợ: {summaryStats.assistedCorrectCount}</span>
                  <span>·</span>
                  <span>Đã xem lời giải: {summaryStats.viewedSolutionCount}</span>
                  <span>·</span>
                  <span>Bỏ qua: {summaryStats.skippedCount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetGame}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Chơi ván mới
                </button>
                <button
                  type="button"
                  onClick={handleExitToLibrary}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 cursor-pointer"
                >
                  Về thư viện
                </button>
              </div>
            </section>

            {/* Full Review of Questions & Step-by-Step Explanations */}
            <section className="bg-[#0C1B3B] border border-slate-700 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-300" />
                Xem lại câu hỏi đã mở & lời giải chi tiết
              </h3>
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {gameState.deck
                  .filter((d) => d.status !== 'unasked')
                  .map((d, idx) => (
                    <div
                      key={d.question.questionId}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-1.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-amber-300">
                          Câu {idx + 1} · {d.question.topicLabel} · Đáp án:{' '}
                          <MathView content={d.question.answerText} />
                        </span>
                        <span className="font-mono text-slate-300">
                          {d.outcome === 'correct_independent'
                            ? `Đúng tự làm (+${d.pointsAwarded}đ)`
                            : d.outcome === 'correct_with_hint'
                              ? `Đúng có hỗ trợ (+${d.pointsAwarded}đ)`
                              : d.outcome === 'skipped'
                                ? 'Bỏ qua (0đ)'
                                : 'Đã xem lời giải (0đ)'}
                        </span>
                      </div>
                      <div className="text-slate-100 font-medium">
                        <MathView content={d.question.stem} />
                      </div>
                      <div className="text-slate-300">
                        Lời giải: <MathView content={d.question.explanationText} />
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        </main>
      )}

      {/* GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0C1B3B] border border-slate-600 rounded-2xl p-5 space-y-3 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <h3 className="text-base font-bold text-amber-300">
                Hướng dẫn C09 · Bingo Kiến thức 3D
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs sm:text-sm text-slate-200 space-y-2 leading-relaxed">
              <p>1. Chọn kích thước bảng (3×3, 4×4 hoặc 5×5) và quy tắc thắng (Hàng / Cột / Chéo). Ô miễn phí chỉ xuất hiện ở tâm bảng lẻ (3×3, 5×5).</p>
              <p>2. Giáo viên mở từng câu trên một máy chiếu. Đáp án chỉ được dùng để đánh dấu Bingo sau khi đã Chốt & Công bố.</p>
              <p>3. Nếu có học sinh hô Bingo, giáo viên nhập các số phiếu đang hô để kiểm tra đồng thời trước khi sang câu mới. Nhiều phiếu cùng đạt sẽ được ghi nhận Đồng thắng.</p>
              <p>4. Phím tắt: 1–4 / A–D chọn phương án; Mũi tên + Space đánh dấu ô trên bảng; H mở gợi ý; S bỏ qua hoạt ảnh; M tắt/bật loa.</p>
            </div>
          </div>
        </div>
      )}

      {/* A4 BLACK-AND-WHITE PRINTABLE CARDS PREVIEW MODAL (Zero window.open) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[88vh] bg-white text-black rounded-2xl border-2 border-slate-900 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-slate-100 print:hidden">
              <div className="text-sm font-bold text-black">
                Xem trước Phiếu Bingo A4 In Đen Trắng (Ký hiệu sắc nét không cần mực màu)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In trang A4
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-black text-xs font-bold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white">
              {printableSpecs.map((spec) => (
                <div
                  key={spec.cardId}
                  className="border-2 border-black p-3 rounded-lg bg-white text-black break-inside-avoid"
                >
                  <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2 text-xs font-bold">
                    <span>TÂY ĐÔ SMART EDU · {spec.holderLabel}</span>
                    <span>{spec.ruleSummary}</span>
                  </div>
                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${spec.dimension}, minmax(0, 1fr))`,
                    }}
                  >
                    {spec.cells.map((c, i) => (
                      <div
                        key={i}
                        className={`min-h-[54px] p-1 flex flex-col items-center justify-center text-center ${
                          c.isFreeCenter
                            ? 'border-4 border-double border-black font-extrabold'
                            : 'border border-black'
                        }`}
                      >
                        <span className="text-[9px] font-mono leading-none mb-0.5">
                          [{c.codeBadge}]
                        </span>
                        <span className="text-xs font-bold leading-tight">
                          {c.isFreeCenter ? '★ MIỄN PHÍ' : c.primaryText}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BingoKnowledge3DGame;
