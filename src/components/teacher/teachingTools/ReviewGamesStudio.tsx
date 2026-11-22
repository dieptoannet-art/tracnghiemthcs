import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  Gamepad2,
  HeartHandshake,
  HelpCircle,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Puzzle,
  RotateCcw,
  Search,
  SkipForward,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { MathView } from '../../MathView';
import imgPuzzleMode from '../../../assets/images/game_mode_puzzle_tiles_3d_1795355622380.jpg';
import imgRaceMode from '../../../assets/images/game_mode_race_track_3d_1795355620540.jpg';
import imgGoldenBellMode from '../../../assets/images/game_mode_golden_bell_3d_1795355621613.jpg';
import imgPuzzleGeo from '../../../assets/images/puzzle_sample_geometry_3d_1795355620735.jpg';
import imgPuzzleOcean from '../../../assets/images/game_c10_clean_ocean_3d_1795310755840.jpg';
import imgPuzzleTreasure from '../../../assets/images/game_c06_treasure_hunt_3d_1795320312684.jpg';
import {
  ToolQuestionItem,
  ToolQuestionSet,
  evaluateShortAnswerSubmission,
  getMcqDisplayLabelForCorrectOption,
  makeStableId,
} from './questionBankEngine';
import {
  PuzzleGridPreset,
  ReviewGameConfig,
  ReviewGameMode,
  ReviewGameSessionState,
  ReviewParticipantSource,
  ReviewTurnRule,
  addTiebreakerQuestionAndContinue,
  batchGradeActiveGoldenBell,
  buildParticipantsFromSource,
  clearReviewGameSession,
  computeReviewStandings,
  computeReviewTimerRemainingMs,
  confirmAndAdvanceReviewQuestion,
  confirmPuzzlePictureGuess,
  createReviewGameSession,
  endReviewGameEarly,
  getPuzzleGridDimensions,
  getRaceLaneSteps,
  gradeParticipantOnCurrentQuestion,
  gradePuzzleTileAttempt,
  loadReviewGameSession,
  pauseReviewTimer,
  rescueGoldenBellParticipants,
  revealQuestionAnswer,
  saveReviewGameSession,
  selectPuzzleTile,
  startOrResumeReviewTimer,
} from './reviewGamesEngine';
import { StudentGroupItem, ToolStudentItem } from './teachingToolsEngine';
import { playTeachingToolBell, playTeachingToolScoreCue } from './teachingToolsAudio';

export interface ReviewGamesStudioProps {
  classId: string;
  classNameLabel: string;
  accountScopeId: string;
  presentStudents: ToolStudentItem[];
  dot1Groups: StudentGroupItem[];
  questionSets: ToolQuestionSet[];
  transferredReviewSessionIds: string[];
  isMutedGlobal: boolean;
  initialPrefill?: {
    questionSetId?: string | null;
    mode?: ReviewGameMode;
    secondsPerQuestion?: number;
    pointsPerCorrect?: number;
    turnRule?: ReviewTurnRule;
  } | null;
  onGoToQuestionBank: () => void;
  onGoToGroups: () => void;
  onGoToScoreboard: () => void;
  onOpenClassicEduGame: (gameId: string) => void;
  onTransferScoresToScoreboard: (reviewSession: ReviewGameSessionState) => {
    ok: boolean;
    alreadyTransferred: boolean;
    error?: string;
    nextReviewSession: ReviewGameSessionState;
    transferredTeamCount: number;
  };
}

interface BuiltinPuzzleArtwork {
  id: string;
  title: string;
  url: string;
  defaultKeyword: string;
}

const BUILTIN_PUZZLE_ARTWORKS: BuiltinPuzzleArtwork[] = [
  {
    id: 'sample_geo',
    title: 'Hình học 3D & Định lí Pythagore',
    url: imgPuzzleGeo,
    defaultKeyword: 'HÌNH HỌC KHÔNG GIAN',
  },
  {
    id: 'sample_ocean',
    title: 'Đại dương xanh & Môi trường',
    url: imgPuzzleOcean,
    defaultKeyword: 'BẢO VỆ ĐẠI DƯƠNG',
  },
  {
    id: 'sample_treasure',
    title: 'Hành trình khám phá kho báu',
    url: imgPuzzleTreasure,
    defaultKeyword: 'CHINH PHỤC TRI THỨC',
  },
];

const MODE_CARDS: {
  id: ReviewGameMode;
  title: string;
  subtitle: string;
  classicId: string;
  classicLabel: string;
  image: string;
  accentGradient: string;
}[] = [
  {
    id: 'puzzle',
    title: 'Mở mảnh ghép',
    subtitle: 'Chọn ô câu hỏi trên lưới 2×3, 3×3 hoặc 3×4 để lật từng mảnh ảnh bí mật và đoán từ khóa.',
    classicId: 'b02',
    classicLabel: 'B02 (Kho trò chơi)',
    image: imgPuzzleMode,
    accentGradient: 'from-[#0E4A6B] to-[#0284C7]',
  },
  {
    id: 'race',
    title: 'Đường đua',
    subtitle: 'Đội trả lời đúng tiến từng chặng về vạch đích; hỗ trợ giảm chuyển động và câu phụ tách điểm.',
    classicId: 'd02',
    classicLabel: 'D02 (Đua thuyền)',
    image: imgRaceMode,
    accentGradient: 'from-[#0F3C78] to-[#1D4ED8]',
  },
  {
    id: 'golden_bell',
    title: 'Rung chuông vàng',
    subtitle: 'Thi đấu loại trực tiếp, chấm nhanh tới 50 HS, ghi nhận cứu trợ và tự động luyện tập khi 1 HS.',
    classicId: 'c02',
    classicLabel: 'C02 (Chuông vàng)',
    image: imgGoldenBellMode,
    accentGradient: 'from-[#9A3412] to-[#D97706]',
  },
];

function formatClockSeconds(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const ReviewGamesStudio: React.FC<ReviewGamesStudioProps> = ({
  classId,
  classNameLabel,
  accountScopeId,
  presentStudents,
  dot1Groups,
  questionSets,
  transferredReviewSessionIds,
  isMutedGlobal,
  initialPrefill,
  onGoToQuestionBank,
  onGoToGroups,
  onGoToScoreboard,
  onOpenClassicEduGame,
  onTransferScoresToScoreboard,
}) => {
  // Saved mid-session recovery per classId + accountScopeId
  const [liveSession, setLiveSession] = useState<ReviewGameSessionState | null>(() =>
    loadReviewGameSession(classId, accountScopeId)
  );
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Setup state
  const [selectedSetId, setSelectedSetId] = useState<string>(
    () => initialPrefill?.questionSetId || questionSets[0]?.id || ''
  );
  const activeSet = useMemo(
    () => questionSets.find((s) => s.id === selectedSetId) || questionSets[0] || null,
    [questionSets, selectedSetId]
  );

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(() =>
    activeSet ? activeSet.questions.map((q) => q.id) : []
  );

  const [mode, setMode] = useState<ReviewGameMode>(
    () => initialPrefill?.mode || 'puzzle'
  );
  const [participantSource, setParticipantSource] = useState<ReviewParticipantSource>(() =>
    dot1Groups.length > 0 ? 'dot1_groups' : presentStudents.length > 0 ? 'individual_students' : 'manual_teams'
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    dot1Groups.map((g) => g.id)
  );
  const [manualTeamNames, setManualTeamNames] = useState<string[]>([
    'Đội Sao Xanh',
    'Đội Tia Chớp',
    'Đội Trí Tuệ',
    'Đội Bứt Phá',
  ]);

  const [secondsPerQuestion, setSecondsPerQuestion] = useState<number>(
    () => initialPrefill?.secondsPerQuestion ?? 30
  );
  const [pointsPerCorrect, setPointsPerCorrect] = useState<number>(
    () => initialPrefill?.pointsPerCorrect ?? 10
  );
  const [turnRule, setTurnRule] = useState<ReviewTurnRule>(
    () => initialPrefill?.turnRule || 'rotate_every_question'
  );

  // Mode A: Puzzle setup
  const [puzzleGridPreset, setPuzzleGridPreset] = useState<PuzzleGridPreset>('3x3');
  const [puzzleArtworkId, setPuzzleArtworkId] = useState<string>(BUILTIN_PUZZLE_ARTWORKS[0].id);
  const [customPuzzleImageUrl, setCustomPuzzleImageUrl] = useState<string>('');
  const [puzzleKeyword, setPuzzleKeyword] = useState<string>(
    BUILTIN_PUZZLE_ARTWORKS[0].defaultKeyword
  );
  const [puzzleBonusPoints, setPuzzleBonusPoints] = useState<number>(30);

  // Mode B: Race setup
  const [raceStepPerCorrect, setRaceStepPerCorrect] = useState<number>(1);
  const [raceFinishTarget, setRaceFinishTarget] = useState<number>(5);
  const [raceReducedMotion, setRaceReducedMotion] = useState<boolean>(false);

  // Mode C: Golden bell setup
  const [goldenBellPracticeSingle, setGoldenBellPracticeSingle] = useState<boolean>(true);

  // Live Play UI states
  const [isFullscreenProjector, setIsFullscreenProjector] = useState<boolean>(false);
  const [displayRemainingMs, setDisplayRemainingMs] = useState<number>(0);
  const [bellPlayedForQuestionKey, setBellPlayedForQuestionKey] = useState<string>('');
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [bellRosterFilter, setBellRosterFilter] = useState<'all' | 'active' | 'eliminated'>('all');
  const [shortAnswerInput, setShortAnswerInput] = useState<string>('');
  const [shortAnswerEvalMsg, setShortAnswerEvalMsg] = useState<{
    outcome: 'correct' | 'wrong' | 'needs_manual';
    reason: string;
  } | null>(null);
  const [showPictureGuessModal, setShowPictureGuessModal] = useState<boolean>(false);
  const [guessTeamId, setGuessTeamId] = useState<string>('');
  const [showRescueModal, setShowRescueModal] = useState<boolean>(false);
  const [rescueSelectedIds, setRescueSelectedIds] = useState<string[]>([]);
  const [rescueNote, setRescueNote] = useState<string>('Cứu trợ đồng đội vượt trạm');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Sync when switching classId or accountScopeId
  useEffect(() => {
    const saved = loadReviewGameSession(classId, accountScopeId);
    setLiveSession(saved);
    setStatusBanner(null);
  }, [classId, accountScopeId]);

  // Apply prefill changes when arriving from Question Bank or Lesson Package
  useEffect(() => {
    if (!initialPrefill) return;
    if (initialPrefill.questionSetId) {
      const found = questionSets.find((s) => s.id === initialPrefill.questionSetId);
      if (found) {
        setSelectedSetId(found.id);
        setSelectedQuestionIds(found.questions.map((q) => q.id));
      }
    }
    if (initialPrefill.mode) setMode(initialPrefill.mode);
    if (typeof initialPrefill.secondsPerQuestion === 'number') {
      setSecondsPerQuestion(initialPrefill.secondsPerQuestion);
    }
    if (typeof initialPrefill.pointsPerCorrect === 'number') {
      setPointsPerCorrect(initialPrefill.pointsPerCorrect);
    }
    if (initialPrefill.turnRule) setTurnRule(initialPrefill.turnRule);
  }, [initialPrefill, questionSets]);

  // Keep selected questions synced when choosing a different Question Set
  const handleSelectQuestionSet = (setId: string) => {
    setSelectedSetId(setId);
    const found = questionSets.find((s) => s.id === setId);
    setSelectedQuestionIds(found ? found.questions.map((q) => q.id) : []);
  };

  // Keep Đợt 1 groups checked when groups list updates
  useEffect(() => {
    if (dot1Groups.length > 0 && selectedGroupIds.length === 0) {
      setSelectedGroupIds(dot1Groups.map((g) => g.id));
    }
  }, [dot1Groups]);

  // Helper to commit & persist liveSession
  const commitLiveSession = (next: ReviewGameSessionState) => {
    setLiveSession(next);
    saveReviewGameSession(next, accountScopeId);
  };

  // Wall-clock timer tick for live session
  useEffect(() => {
    if (!liveSession || liveSession.phase !== 'playing') return;
    const syncTick = () => {
      const rem = computeReviewTimerRemainingMs(liveSession, Date.now());
      setDisplayRemainingMs(rem);
      const qKey = `${liveSession.sessionId}_${liveSession.currentQuestionIdx}`;
      if (
        liveSession.timerStatus === 'running' &&
        rem <= 0 &&
        liveSession.config.secondsPerQuestion > 0 &&
        bellPlayedForQuestionKey !== qKey
      ) {
        setBellPlayedForQuestionKey(qKey);
        playTeachingToolBell(isMutedGlobal);
        const expired = pauseReviewTimer(liveSession, Date.now());
        commitLiveSession(expired);
      }
    };
    syncTick();
    const id = window.setInterval(syncTick, 150);
    return () => window.clearInterval(id);
  }, [liveSession, isMutedGlobal, bellPlayedForQuestionKey]);

  const resolvedPuzzleArtwork = useMemo(() => {
    if (puzzleArtworkId === 'custom' && customPuzzleImageUrl) {
      return {
        id: 'custom',
        title: 'Ảnh tải lên bởi giáo viên',
        url: customPuzzleImageUrl,
      };
    }
    return (
      BUILTIN_PUZZLE_ARTWORKS.find((a) => a.id === puzzleArtworkId) ||
      BUILTIN_PUZZLE_ARTWORKS[0]
    );
  }, [puzzleArtworkId, customPuzzleImageUrl]);

  const handleUploadCustomPuzzleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl.startsWith('data:image/')) {
        setCustomPuzzleImageUrl(dataUrl);
        setPuzzleArtworkId('custom');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const previewParticipants = useMemo(
    () =>
      buildParticipantsFromSource({
        source: participantSource,
        dot1Groups,
        selectedGroupIds,
        manualTeamNames,
        presentStudents,
      }),
    [participantSource, dot1Groups, selectedGroupIds, manualTeamNames, presentStudents]
  );

  const handleStartNewGameSession = () => {
    if (!activeSet || selectedQuestionIds.length === 0) {
      setStatusBanner({
        type: 'error',
        text: 'Vui lòng chọn ít nhất 1 câu hỏi trước khi bắt đầu trò chơi.',
      });
      return;
    }
    if (previewParticipants.length === 0) {
      setStatusBanner({
        type: 'error',
        text: 'Chưa có đội hoặc học sinh tham gia. Hãy kiểm tra Bước 3.',
      });
      return;
    }

    const config: Partial<ReviewGameConfig> = {
      mode,
      participantSource,
      questionSetId: activeSet.id,
      questionSetTitle: activeSet.title,
      selectedQuestionIds,
      secondsPerQuestion,
      pointsPerCorrect,
      turnRule,
      puzzleGridPreset,
      puzzleImageId: resolvedPuzzleArtwork.id,
      puzzleImageUrl: resolvedPuzzleArtwork.url,
      puzzleImageTitle: resolvedPuzzleArtwork.title,
      puzzleSecretKeyword: puzzleKeyword.trim() || 'TỪ KHÓA BÍ MẬT',
      puzzleBonusPoints,
      raceStepPerCorrect,
      raceFinishTarget,
      raceReducedMotion,
      goldenBellAllowPracticeOnSingle: goldenBellPracticeSingle,
    };

    const created = createReviewGameSession({
      classId,
      className: classNameLabel,
      questionSet: activeSet,
      config,
      participants: previewParticipants,
    });
    setShortAnswerInput('');
    setShortAnswerEvalMsg(null);
    setStatusBanner(null);
    commitLiveSession(created);
  };

  const handleDiscardSavedSession = () => {
    clearReviewGameSession(classId, accountScopeId);
    setLiveSession(null);
    setIsFullscreenProjector(false);
    setStep(1);
    setStatusBanner({
      type: 'info',
      text: 'Đã kết thúc phiên cũ trên bộ nhớ tạm. Bảng điểm đội không bị thay đổi.',
    });
  };

  // ============================================================================
  // LIVE PLAY VIEW (PLAYING OR FINISHED)
  // ============================================================================
  if (liveSession) {
    const currentQ = liveSession.questions[liveSession.currentQuestionIdx] || null;
    const currentEntry = currentQ ? liveSession.ledger[currentQ.id] : null;
    const activeTurnParticipant =
      liveSession.participants[liveSession.currentTurnIdx] || liveSession.participants[0] || null;
    const standings = computeReviewStandings(liveSession.participants);
    const isPuzzleActiveTileSelected =
      liveSession.config.mode === 'puzzle' && liveSession.activePuzzleTileIdx !== null;
    const gridDims = getPuzzleGridDimensions(liveSession.config.puzzleGridPreset);
    const isSingleGoldenBellPractice =
      liveSession.config.mode === 'golden_bell' &&
      liveSession.participants.length === 1 &&
      liveSession.config.goldenBellAllowPracticeOnSingle;

    const alreadyTransferred =
      liveSession.transferredToScoreboardAtMs !== null ||
      transferredReviewSessionIds.includes(liveSession.sessionId);

    const activeParticipants = liveSession.participants.filter(
      (p) => p.bellStatus === 'active' || p.bellStatus === 'rescued'
    );
    const eliminatedParticipants = liveSession.participants.filter(
      (p) => p.bellStatus === 'eliminated'
    );

    const filteredRoster = liveSession.participants.filter((p) => {
      if (bellRosterFilter === 'active' && p.bellStatus === 'eliminated') return false;
      if (bellRosterFilter === 'eliminated' && p.bellStatus !== 'eliminated') return false;
      if (rosterSearch.trim()) {
        return p.name.toLowerCase().includes(rosterSearch.trim().toLowerCase());
      }
      return true;
    });

    const handleMarkParticipant = (participantId: string, isCorrect: boolean) => {
      playTeachingToolScoreCue(isMutedGlobal, isCorrect);
      if (liveSession.config.mode === 'puzzle') {
        const next = gradePuzzleTileAttempt({
          session: liveSession,
          participantId,
          isCorrect,
        });
        commitLiveSession(next);
        return;
      }
      const next = gradeParticipantOnCurrentQuestion({
        session: liveSession,
        participantId,
        isCorrect,
        submittedAnswerText: shortAnswerInput.trim() || undefined,
      });
      commitLiveSession(next);
    };

    const handleCheckShortAnswer = () => {
      if (!currentQ) return;
      const res = evaluateShortAnswerSubmission(currentQ, shortAnswerInput);
      setShortAnswerEvalMsg(res);
    };

    const handleAdvance = (action: 'next' | 'skip') => {
      setShortAnswerInput('');
      setShortAnswerEvalMsg(null);
      const next = confirmAndAdvanceReviewQuestion(liveSession, action);
      commitLiveSession(next);
    };

    const handleOpenTiebreakerQuestion = () => {
      // Try finding an unused question from the active set, or generate a quick tiebreaker
      const usedIds = new Set(liveSession.questions.map((q) => q.id));
      const candidate = activeSet?.questions.find((q) => !usedIds.has(q.id));
      const tiebreakerQ: ToolQuestionItem = candidate || {
        id: makeStableId('tie'),
        code: 'CAU-PHU',
        grade: activeSet?.grade || '8',
        subject: activeSet?.subject || 'Toán',
        lesson: 'Câu hỏi phụ tách điểm',
        level: 'apply',
        type: 'short_answer',
        stem: 'Câu hỏi phụ phân định ngôi đầu: Tính nhanh giá trị biểu thức $25^2 - 15^2$.',
        referenceAnswer: '400',
        acceptedAnswers: ['400'],
        shortAnswerRule: 'numeric_tolerance',
        numericTolerance: 0,
        explanation: '$25^2 - 15^2 = (25 - 15)(25 + 15) = 10 \\times 40 = 400$.',
      };
      const next = addTiebreakerQuestionAndContinue(liveSession, tiebreakerQ);
      commitLiveSession(next);
    };

    const handleAcceptTieAndClose = () => {
      commitLiveSession({
        ...liveSession,
        tiedLeaderIds: [],
        endReason: 'Giáo viên xác nhận giữ đồng hạng cho các đội dẫn đầu.',
      });
    };

    const handleSubmitScoreboardTransfer = () => {
      const res = onTransferScoresToScoreboard(liveSession);
      commitLiveSession(res.nextReviewSession);
      if (res.ok) {
        playTeachingToolBell(isMutedGlobal);
        setStatusBanner({
          type: 'success',
          text: `Đã chuyển điểm ${res.transferredTeamCount} đội sang Bảng điểm đội lớp ${classNameLabel} (chỉ thực hiện 1 lần cho phiên này).`,
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: res.error || 'Không thể chuyển điểm vào Bảng điểm đội.',
        });
      }
    };

    // Shared 16:9 Projector Stage renderer (STRICTLY respects `answerRevealed`)
    const renderProjectorStage = (fullscreen: boolean) => {
      const answerRevealed = Boolean(currentEntry?.answerRevealed);
      const showQuestionCard =
        liveSession.phase === 'playing' &&
        currentQ &&
        (liveSession.config.mode !== 'puzzle' || isPuzzleActiveTileSelected);

      return (
        <div
          className={`${
            fullscreen
              ? 'fixed inset-0 z-50 bg-[#061830] text-white p-4 sm:p-6 flex flex-col justify-between overflow-y-auto'
              : 'aspect-video w-full rounded-2xl bg-[#081E3D] text-white border border-[#1E406F] p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-md'
          }`}
        >
          {/* Top Stage Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-sky-300">
                Màn hình trình chiếu 16:9 · {liveSession.className} ·{' '}
                {liveSession.config.mode === 'puzzle'
                  ? 'Mở mảnh ghép'
                  : liveSession.config.mode === 'race'
                    ? 'Đường đua'
                    : 'Rung chuông vàng'}
              </div>
              <div className="text-sm sm:text-base font-extrabold text-white truncate">
                {liveSession.config.questionSetTitle}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {liveSession.config.secondsPerQuestion > 0 && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-base sm:text-xl font-black border ${
                    displayRemainingMs <= 5000 && liveSession.timerStatus === 'running'
                      ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                      : 'bg-white/10 border-white/20 text-amber-300'
                  }`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{formatClockSeconds(displayRemainingMs)}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsFullscreenProjector((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
              >
                {fullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    <span>Thu nhỏ</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    <span>Toàn màn hình</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Center Stage Body */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 py-3 min-h-0 overflow-y-auto">
            {/* Left/Main Visual & Question Zone (8 cols) */}
            <div className="lg:col-span-8 flex flex-col justify-center space-y-3 min-w-0">
              {liveSession.phase === 'finished' ? (
                <div className="p-6 rounded-2xl bg-white/10 border border-white/15 text-center space-y-3">
                  <Trophy className="w-12 h-12 text-amber-300 mx-auto" />
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Hoàn thành trò chơi ôn tập!
                  </h3>
                  <p className="text-sm text-sky-200">{liveSession.endReason}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                    {standings.slice(0, 3).map((row) => (
                      <div
                        key={row.participantId}
                        className="p-3 rounded-xl bg-white/10 border border-white/15"
                      >
                        <div className="text-xs font-bold text-amber-300">Hạng #{row.rank}</div>
                        <div className="text-base font-extrabold text-white truncate">
                          {row.name}
                        </div>
                        <div className="text-lg font-black text-emerald-300">
                          {row.score} điểm
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : liveSession.config.mode === 'puzzle' && !isPuzzleActiveTileSelected ? (
                /* Mode A Mosaic Board on Projector */
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm text-sky-200">
                    <span>
                      Chọn mảnh ghép để mở câu hỏi · Từ khóa gợi ý:{' '}
                      <strong className="text-amber-300">{liveSession.config.puzzleImageTitle}</strong>
                    </span>
                    {activeTurnParticipant && (
                      <span>
                        Lượt hiện tại: <strong className="text-white">{activeTurnParticipant.name}</strong>
                      </span>
                    )}
                  </div>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-white/25 bg-[#0F2D52]">
                    {!brokenImages['puzzle_bg'] && liveSession.config.puzzleImageUrl ? (
                      <img
                        src={liveSession.config.puzzleImageUrl}
                        alt={liveSession.config.puzzleImageTitle}
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenImages((prev) => ({ ...prev, puzzle_bg: true }))}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#1769F4] to-[#0EA5E9] flex items-center justify-center text-white font-black text-xl">
                        {liveSession.config.puzzleSecretKeyword}
                      </div>
                    )}
                    <div
                      className="relative z-10 grid w-full h-full"
                      style={{
                        gridTemplateColumns: `repeat(${gridDims.cols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${gridDims.rows}, minmax(0, 1fr))`,
                      }}
                    >
                      {liveSession.puzzleTiles.map((tile) => {
                        if (tile.status === 'opened') {
                          return <div key={tile.tileIndex} className="border border-white/20" />;
                        }
                        if (tile.status === 'unavailable') {
                          return (
                            <div
                              key={tile.tileIndex}
                              className="bg-slate-900/92 border border-white/20 flex flex-col items-center justify-center text-slate-400 text-xs font-semibold p-2"
                            >
                              <Lock className="w-4 h-4 mb-1 opacity-60" />
                              <span>Ô {tile.tileIndex + 1} (Không đủ câu)</span>
                            </div>
                          );
                        }
                        return (
                          <button
                            key={tile.tileIndex}
                            type="button"
                            onClick={() => commitLiveSession(selectPuzzleTile(liveSession, tile.tileIndex))}
                            className="bg-[#0F3C78]/95 hover:bg-[#1769F4]/95 border border-white/30 flex flex-col items-center justify-center text-white cursor-pointer transition-colors"
                          >
                            <span className="text-xl sm:text-2xl font-black">
                              {tile.tileIndex + 1}
                            </span>
                            <span className="text-[11px] font-bold text-sky-200">
                              Nhấn để mở câu hỏi
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : showQuestionCard && currentQ ? (
                /* Active Question Slide on Projector (NEVER shows answer before reveal!) */
                <div className="p-4 sm:p-5 rounded-2xl bg-white text-slate-900 space-y-3 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600 border-b border-slate-100 pb-2">
                    <span>
                      Câu {liveSession.currentQuestionIdx + 1}/{liveSession.questions.length} ·{' '}
                      {currentQ.code} ·{' '}
                      {currentQ.level === 'know'
                        ? 'Biết'
                        : currentQ.level === 'understand'
                          ? 'Hiểu'
                          : 'Vận dụng'}
                    </span>
                    {activeTurnParticipant && liveSession.config.mode !== 'golden_bell' && (
                      <span className="text-[#1769F4]">
                        Lượt trả lời: {activeTurnParticipant.name}
                      </span>
                    )}
                  </div>

                  <div className={`${fullscreen ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'} font-extrabold text-[#082B52] leading-snug`}>
                    <MathView content={currentQ.stem} />
                  </div>

                  {currentQ.imageDataUrl && (
                    <img
                      src={currentQ.imageDataUrl}
                      alt="Hình minh họa câu hỏi"
                      referrerPolicy="no-referrer"
                      className="max-h-36 rounded-xl border border-slate-200 object-contain"
                    />
                  )}

                  {currentQ.type === 'mcq' && currentQ.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {currentQ.options.map((opt, oIdx) => {
                        const letter = String.fromCharCode(65 + oIdx);
                        const isRight = answerRevealed && opt.id === currentQ.correctOptionId;
                        return (
                          <div
                            key={opt.id}
                            className={`px-3.5 py-2.5 rounded-xl border text-sm sm:text-base font-bold flex items-start gap-2 ${
                              isRight
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <span className="font-black text-[#1769F4] shrink-0">{letter}.</span>
                            <div className="min-w-0 flex-1">
                              <MathView content={opt.text} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {currentQ.type === 'true_false' && currentQ.statements && (
                    <div className="space-y-1.5 pt-1">
                      {currentQ.statements.map((st) => (
                        <div
                          key={st.id}
                          className={`px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 ${
                            answerRevealed
                              ? st.isCorrect
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                                : 'bg-rose-50 border-rose-300 text-rose-900'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="font-extrabold uppercase">{st.label})</span>
                            <MathView content={st.text} />
                          </div>
                          {answerRevealed && (
                            <span className="font-extrabold shrink-0">
                              {st.isCorrect ? 'ĐÚNG' : 'SAI'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {currentQ.type === 'short_answer' && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                      {answerRevealed ? (
                        <div className="font-extrabold text-emerald-800">
                          Đáp án tham chiếu: {currentQ.referenceAnswer || '—'}
                        </div>
                      ) : (
                        <div className="italic text-slate-500">
                          Học sinh/đội viết hoặc đọc câu trả lời ngắn (đáp án đang ẩn trước khi công bố).
                        </div>
                      )}
                    </div>
                  )}

                  {answerRevealed && currentQ.explanation && (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs sm:text-sm text-[#082B52]">
                      <span className="font-extrabold">Giải thích: </span>
                      <MathView content={currentQ.explanation} />
                    </div>
                  )}
                </div>
              ) : null}

              {/* Mode B Race Track Preview inside Projector */}
              {liveSession.config.mode === 'race' && liveSession.phase === 'playing' && (
                <div className="p-3 rounded-xl bg-white/10 border border-white/15 space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-sky-200">
                    Tiến độ đường đua (Đích: {liveSession.config.raceFinishTarget} bước)
                  </div>
                  <div className="space-y-1.5">
                    {liveSession.participants.slice(0, 6).map((p) => {
                      const steps = getRaceLaneSteps(liveSession, p.id);
                      const pct = Math.min(
                        100,
                        Math.round((steps / Math.max(1, liveSession.config.raceFinishTarget)) * 100)
                      );
                      return (
                        <div key={p.id} className="space-y-0.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span>{p.name}</span>
                            <span>
                              {steps}/{liveSession.config.raceFinishTarget} bước · {p.score} điểm
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-white/15 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                liveSession.config.raceReducedMotion ? '' : 'transition-all duration-300'
                              }`}
                              style={{ width: `${pct}%`, backgroundColor: p.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Standings / Arena Status Column (4 cols) */}
            <div className="lg:col-span-4 rounded-xl bg-white/10 border border-white/15 p-3 space-y-2.5 overflow-y-auto">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                Bảng xếp hạng phiên
              </div>
              {liveSession.config.mode === 'golden_bell' && (
                <div className="text-xs text-sky-200 pb-1 border-b border-white/10">
                  Còn thi đấu: <strong className="text-white">{activeParticipants.length}</strong> ·
                  Đã dừng: <strong className="text-rose-300">{eliminatedParticipants.length}</strong> ·
                  Cứu trợ: <strong className="text-emerald-300">{liveSession.rescueLogs.length} lượt</strong>
                </div>
              )}
              <div className="space-y-1.5">
                {standings.slice(0, 10).map((row) => (
                  <div
                    key={row.participantId}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-amber-300 shrink-0">#{row.rank}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="font-bold text-white truncate">{row.name}</span>
                    </div>
                    <span className="font-black text-emerald-300 shrink-0">{row.score}đ</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-4 font-edtech text-[#0F2D52]">
        {/* Fullscreen Overlay Modal if active */}
        {isFullscreenProjector && renderProjectorStage(true)}

        {/* Session Status Banner */}
        {statusBanner && (
          <div
            role={statusBanner.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border text-xs sm:text-sm font-bold ${
              statusBanner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : statusBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-start gap-2">
              {statusBanner.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{statusBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-xs underline cursor-pointer shrink-0"
            >
              Ẩn
            </button>
          </div>
        )}

        {/* Projector Stage (Inline 16:9) */}
        {renderProjectorStage(false)}

        {/* Teacher Control Deck */}
        {liveSession.phase === 'playing' && (
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#082B52]">
                  Bảng điều khiển giáo viên ·{' '}
                  {liveSession.config.mode === 'puzzle'
                    ? 'Mở mảnh ghép'
                    : liveSession.config.mode === 'race'
                      ? 'Đường đua'
                      : 'Rung chuông vàng'}
                </h3>
                <p className="text-xs text-slate-600">
                  Mỗi điểm cộng được ghi nhận tức thì vào phiên chơi (tách biệt Bảng điểm lớp cho tới khi bấm Chuyển điểm).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {liveSession.config.secondsPerQuestion > 0 && (
                  <>
                    {liveSession.timerStatus === 'running' ? (
                      <button
                        type="button"
                        onClick={() => commitLiveSession(pauseReviewTimer(liveSession))}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Tạm dừng đồng hồ</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => commitLiveSession(startOrResumeReviewTimer(liveSession))}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-bold cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Bắt đầu / Tiếp tục đếm giờ</span>
                      </button>
                    )}
                  </>
                )}

                {currentQ && currentEntry && !currentEntry.answerRevealed && (
                  <button
                    type="button"
                    onClick={() => commitLiveSession(revealQuestionAnswer(liveSession, currentQ.id))}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Công bố đáp án</span>
                  </button>
                )}

                {liveSession.config.mode === 'puzzle' && (
                  <button
                    type="button"
                    onClick={() => {
                      setGuessTeamId(activeTurnParticipant?.id || liveSession.participants[0]?.id || '');
                      setShowPictureGuessModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#082B52] text-xs font-extrabold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Đoán bức ảnh chủ đề</span>
                  </button>
                )}

                {liveSession.config.mode === 'golden_bell' && eliminatedParticipants.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRescueSelectedIds(eliminatedParticipants.map((p) => p.id));
                      setShowRescueModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    <span>Cứu trợ ({eliminatedParticipants.length})</span>
                  </button>
                )}

                {liveSession.config.mode !== 'puzzle' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAdvance('skip')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Bỏ qua câu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdvance('next')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#082B52] hover:bg-[#0F3C78] text-white text-xs font-bold cursor-pointer"
                    >
                      <span>Câu tiếp theo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => commitLiveSession(endReviewGameEarly(liveSession))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Kết thúc phiên</span>
                </button>
              </div>
            </div>

            {/* Teacher Cheat Sheet (visible ONLY to teacher panel, never on projector until reveal!) */}
            {currentQ && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-[#082B52]">
                    Ghi chú đáp án cho giáo viên ({currentQ.code}):
                  </span>
                  <span className="font-bold text-emerald-700">
                    {currentQ.type === 'mcq' && `Đáp án đúng: ${getMcqDisplayLabelForCorrectOption(currentQ)}`}
                    {currentQ.type === 'true_false' &&
                      `Đáp án: ${currentQ.statements?.map((s) => `${s.label}:${s.isCorrect ? 'Đ' : 'S'}`).join(' · ')}`}
                    {currentQ.type === 'short_answer' && `Tham chiếu: ${currentQ.referenceAnswer || '—'}`}
                  </span>
                </div>

                {currentQ.type === 'short_answer' && (
                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={shortAnswerInput}
                      onChange={(e) => setShortAnswerInput(e.target.value)}
                      placeholder="Nhập nhanh câu trả lời học sinh đọc để đối chiếu..."
                      className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handleCheckShortAnswer}
                      className="px-3 py-1.5 rounded-lg bg-[#1769F4] text-white text-xs font-bold cursor-pointer"
                    >
                      Kiểm tra quy tắc chấm
                    </button>
                    {shortAnswerEvalMsg && (
                      <span
                        className={`text-xs font-bold ${
                          shortAnswerEvalMsg.outcome === 'correct'
                            ? 'text-emerald-700'
                            : shortAnswerEvalMsg.outcome === 'wrong'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {shortAnswerEvalMsg.outcome === 'needs_manual'
                          ? `Cần giáo viên chấm trực tiếp: ${shortAnswerEvalMsg.reason}`
                          : shortAnswerEvalMsg.reason}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Golden Bell Single Practice / Large Class Controls */}
            {isSingleGoldenBellPractice && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                Chế độ luyện tập 1 học sinh: nếu học sinh trả lời sai vẫn được tiếp tục trả lời các câu tiếp theo.
              </div>
            )}

            {liveSession.config.mode === 'golden_bell' && liveSession.participants.length > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#F8FBFF] border border-[#DCE8F7]">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      placeholder="Tìm tên HS / đội..."
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'all', label: `Tất cả (${liveSession.participants.length})` },
                        { id: 'active', label: `Còn lượt (${activeParticipants.length})` },
                        { id: 'eliminated', label: `Hết lượt (${eliminatedParticipants.length})` },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setBellRosterFilter(f.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          bellRosterFilter === f.id
                            ? 'bg-[#1769F4] text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={activeParticipants.length === 0}
                    onClick={() => {
                      playTeachingToolScoreCue(isMutedGlobal, true);
                      commitLiveSession(
                        batchGradeActiveGoldenBell({
                          session: liveSession,
                          participantIds: activeParticipants.map((p) => p.id),
                          isCorrect: true,
                        })
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                  >
                    Chấm Đúng tất cả còn lượt ({activeParticipants.length})
                  </button>
                </div>
              </div>
            )}

            {/* Puzzle quick grid instruction when waiting for tile click */}
            {liveSession.config.mode === 'puzzle' && !isPuzzleActiveTileSelected && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-900 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Nhấn vào một mảnh ghép trên màn hình trình chiếu phía trên để mở câu hỏi cho lượt{' '}
                  <strong>{activeTurnParticipant?.name}</strong>.
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600">Đổi lượt thủ công:</span>
                  <select
                    value={liveSession.currentTurnIdx}
                    onChange={(e) =>
                      commitLiveSession({ ...liveSession, currentTurnIdx: Number(e.target.value) })
                    }
                    className="px-2 py-1 rounded-lg border border-blue-300 bg-white text-xs font-bold"
                  >
                    {liveSession.participants.map((p, idx) => (
                      <option key={p.id} value={idx}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Participant Grading List */}
            {(!currentQ ||
              (liveSession.config.mode === 'puzzle' && !isPuzzleActiveTileSelected)) ? null : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {filteredRoster.map((p) => {
                  const mark = currentEntry?.marksByParticipantId[p.id] ?? null;
                  const isActiveTurn = activeTurnParticipant?.id === p.id;
                  const isEliminated =
                    liveSession.config.mode === 'golden_bell' && p.bellStatus === 'eliminated';
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                        isEliminated
                          ? 'bg-slate-100 border-slate-200 opacity-70'
                          : isActiveTurn && liveSession.config.mode !== 'golden_bell'
                            ? 'bg-blue-50/70 border-[#1769F4]'
                            : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-xs sm:text-sm font-extrabold text-[#082B52] truncate">
                            {p.name}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500">
                          {p.score} điểm · Đúng {p.correctCount}
                          {liveSession.config.mode === 'golden_bell' &&
                            (p.bellStatus === 'eliminated'
                              ? ' · Hết lượt'
                              : p.bellStatus === 'rescued'
                                ? ' · Đã cứu trợ'
                                : ' · Còn lượt')}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isEliminated}
                          onClick={() => handleMarkParticipant(p.id, true)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 ${
                            mark === 'correct'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          Đúng +{liveSession.config.pointsPerCorrect}
                        </button>
                        <button
                          type="button"
                          disabled={isEliminated}
                          onClick={() => handleMarkParticipant(p.id, false)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 ${
                            mark === 'wrong'
                              ? 'bg-rose-600 text-white'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          Sai
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Finished Summary + Tiebreaker Choice + One-time Scoreboard Transfer */}
        {liveSession.phase === 'finished' && (
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 sm:p-5 space-y-5">
            {liveSession.config.mode === 'race' && liveSession.tiedLeaderIds.length > 1 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
                <div className="flex items-start gap-2 text-amber-950">
                  <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
                  <div>
                    <div className="text-sm font-extrabold">
                      Có {liveSession.tiedLeaderIds.length} đội đang bằng điểm dẫn đầu!
                    </div>
                    <p className="text-xs text-amber-800">
                      Giáo viên chọn giữ đồng hạng hoặc mở thêm 1 câu hỏi phụ để phân định ngôi nhất.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptTieAndClose}
                    className="px-3.5 py-2 rounded-xl bg-white border border-amber-400 text-amber-900 text-xs font-bold cursor-pointer"
                  >
                    Ghi nhận đồng hạng
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenTiebreakerQuestion}
                    className="px-3.5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-bold cursor-pointer"
                  >
                    Mở câu hỏi phụ tách điểm
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-[#082B52]">
                  Tổng kết phiên trò chơi ôn tập
                </h3>
                <p className="text-xs text-slate-600">{liveSession.endReason}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={alreadyTransferred}
                  onClick={handleSubmitScoreboardTransfer}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer ${
                    alreadyTransferred
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>
                    {alreadyTransferred
                      ? 'Đã chuyển vào Bảng điểm (1 lần duy nhất)'
                      : 'Chuyển vào Bảng điểm đội'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onGoToScoreboard}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Xem Bảng điểm lớp
                </button>

                <button
                  type="button"
                  onClick={handleDiscardSavedSession}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Tạo phiên trò chơi mới</span>
                </button>
              </div>
            </div>

            {/* Standings Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-3 font-bold">Hạng</th>
                    <th className="py-2 pr-3 font-bold">Đội / Học sinh</th>
                    <th className="py-2 pr-3 font-bold">Số câu đúng</th>
                    <th className="py-2 font-bold">Tổng điểm phiên</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => (
                    <tr key={row.participantId} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-black text-[#1769F4]">#{row.rank}</td>
                      <td className="py-2 pr-3 font-bold text-[#082B52]">{row.name}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.correctCount}</td>
                      <td className="py-2 font-black text-emerald-700">{row.score} điểm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Golden Bell Rescue Log Table */}
            {liveSession.config.mode === 'golden_bell' && liveSession.rescueLogs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="text-sm font-extrabold text-[#082B52]">
                  Nhật ký cứu trợ Rung chuông vàng ({liveSession.rescueLogs.length} lượt)
                </h4>
                <div className="space-y-1.5">
                  {liveSession.rescueLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200 text-xs text-rose-950"
                    >
                      <strong>Lượt câu {log.roundNumber} ({log.questionCode}):</strong> Cứu trợ{' '}
                      <strong>{log.rescuedNames.length}</strong> người ({log.rescuedNames.join(', ')}) ·{' '}
                      {log.note}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Đoán bức ảnh chủ đề (Mode A) */}
        {showPictureGuessModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-extrabold text-[#082B52]">
                  Xác nhận đoán từ khóa bức ảnh chủ đề
                </h4>
                <button
                  type="button"
                  onClick={() => setShowPictureGuessModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
                Từ khóa bí mật: <strong>{liveSession.config.puzzleSecretKeyword}</strong> · Thưởng{' '}
                <strong>+{liveSession.config.puzzleBonusPoints} điểm</strong>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Đội/Học sinh xin đoán:</label>
                <select
                  value={guessTeamId}
                  onChange={(e) => setGuessTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                >
                  {liveSession.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.score} điểm)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    playTeachingToolScoreCue(isMutedGlobal, false);
                    commitLiveSession(
                      confirmPuzzlePictureGuess({
                        session: liveSession,
                        participantId: guessTeamId,
                        isCorrect: false,
                      })
                    );
                    setShowPictureGuessModal(false);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                >
                  Đoán sai (chuyển lượt)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playTeachingToolBell(isMutedGlobal);
                    commitLiveSession(
                      confirmPuzzlePictureGuess({
                        session: liveSession,
                        participantId: guessTeamId,
                        isCorrect: true,
                      })
                    );
                    setShowPictureGuessModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  Xác nhận đoán ĐÚNG (+{liveSession.config.puzzleBonusPoints}đ)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Cứu trợ Rung chuông vàng (Mode C) */}
        {showRescueModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-extrabold text-[#082B52]">
                  Cứu trợ học sinh / đội đã dừng cuộc chơi
                </h4>
                <button
                  type="button"
                  onClick={() => setShowRescueModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Lý do / Ghi chú cứu trợ:</label>
                <input
                  type="text"
                  value={rescueNote}
                  onChange={(e) => setRescueNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold"
                />
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {eliminatedParticipants.map((p) => {
                  const checked = rescueSelectedIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 text-xs font-bold cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setRescueSelectedIds((prev) =>
                            e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                          );
                        }}
                      />
                      <span>{p.name}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRescueModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={rescueSelectedIds.length === 0}
                  onClick={() => {
                    playTeachingToolBell(isMutedGlobal);
                    commitLiveSession(
                      rescueGoldenBellParticipants({
                        session: liveSession,
                        participantIds: rescueSelectedIds,
                        note: rescueNote,
                      })
                    );
                    setShowRescueModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
                >
                  Cứu trợ {rescueSelectedIds.length} người đã chọn
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // SETUP FLOW (6 STEPS LEADING INTO PLAY)
  // ============================================================================
  const puzzleGridInfo = getPuzzleGridDimensions(puzzleGridPreset);
  const puzzleActiveTileCount = Math.min(puzzleGridInfo.totalTiles, selectedQuestionIds.length);

  return (
    <div className="space-y-5 font-edtech text-[#0F2D52]">
      {/* Mode Preview Cards + Legacy Game Center Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODE_CARDS.map((card) => {
          const isSelected = mode === card.id;
          return (
            <article
              key={card.id}
              className={`bg-white rounded-2xl border overflow-hidden flex flex-col transition-all ${
                isSelected
                  ? 'border-[#1769F4] ring-2 ring-[#1769F4]/20 shadow-sm'
                  : 'border-[#DCE8F7] hover:border-[#1769F4]/60'
              }`}
            >
              <div className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br ${card.accentGradient}`}>
                {!brokenImages[card.id] ? (
                  <img
                    src={card.image}
                    alt={card.title}
                    referrerPolicy="no-referrer"
                    onError={() => setBrokenImages((prev) => ({ ...prev, [card.id]: true }))}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <Gamepad2 className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#081A33]/75 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white text-xs font-extrabold">
                  <span>{card.title}</span>
                  <span>{isSelected ? 'Đang chọn' : 'Chế độ ôn tập'}</span>
                </div>
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                <p className="text-xs text-slate-600 leading-relaxed">{card.subtitle}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(card.id);
                      setStep(2);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      isSelected
                        ? 'bg-[#1769F4] text-white'
                        : 'bg-[#F0F7FF] text-[#1769F4] hover:bg-blue-100'
                    }`}
                  >
                    {isSelected ? 'Đang dùng chế độ này' : 'Chọn chế độ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenClassicEduGame(card.classicId)}
                    className="text-[11px] font-bold text-slate-500 hover:text-[#1769F4] underline cursor-pointer"
                  >
                    Mở bản {card.classicLabel}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Stepper Navigation */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { num: 1, label: '1. Bộ câu hỏi' },
                { num: 2, label: '2. Chế độ chơi' },
                { num: 3, label: '3. Chọn đội / HS' },
                { num: 4, label: '4. Luật & Ảnh/Đua' },
                { num: 5, label: '5. Tổng quan & Bắt đầu' },
              ] as const
            ).map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  step === s.num
                    ? 'bg-[#1769F4] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-xs font-bold text-slate-500">Bước 6: Trình chiếu &amp; Chấm điểm</span>
        </div>

        {statusBanner && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{statusBanner.text}</span>
          </div>
        )}

        {/* STEP 1: Pick Question Set & Questions */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-[240px]">
                <label className="block text-xs font-bold text-slate-700">
                  Chọn bộ câu hỏi dùng chung cho 3 chế độ chơi
                </label>
                <select
                  value={activeSet?.id || ''}
                  onChange={(e) => handleSelectQuestionSet(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-[#082B52]"
                >
                  {questionSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.questions.length} câu · Khối {s.grade} · {s.subject})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={onGoToQuestionBank}
                className="px-3.5 py-2.5 rounded-xl border border-[#DCE8F7] bg-[#F8FBFF] hover:border-[#1769F4] text-[#1769F4] text-xs font-bold cursor-pointer"
              >
                Quản lý / Nhập thêm tại Ngân hàng câu hỏi
              </button>
            </div>

            {activeSet && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
                  <span>
                    Đã chọn {selectedQuestionIds.length}/{activeSet.questions.length} câu hỏi
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionIds(activeSet.questions.map((q) => q.id))}
                      className="text-[#1769F4] hover:underline cursor-pointer"
                    >
                      Chọn tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionIds([])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Bỏ chọn hết
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {activeSet.questions.map((q, idx) => {
                    const checked = selectedQuestionIds.includes(q.id);
                    return (
                      <label
                        key={q.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs sm:text-sm ${
                          checked
                            ? 'bg-[#F8FBFF] border-[#1769F4]/40'
                            : 'bg-white border-slate-200 opacity-75'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedQuestionIds((prev) =>
                              e.target.checked ? [...prev, q.id] : prev.filter((id) => id !== q.id)
                            );
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#082B52]">
                            {idx + 1}. [{q.code}] ·{' '}
                            {q.level === 'know'
                              ? 'Biết'
                              : q.level === 'understand'
                                ? 'Hiểu'
                                : 'Vận dụng'}{' '}
                            ·{' '}
                            {q.type === 'mcq'
                              ? 'ABCD'
                              : q.type === 'true_false'
                                ? 'Đúng/Sai'
                                : 'Trả lời ngắn'}
                          </div>
                          <div className="text-slate-700 truncate">
                            <MathView content={q.stem} />
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Mode Choice */}
        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-[#082B52]">
              Chọn hình thức trò chơi dùng bộ câu hỏi "{activeSet?.title}"
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODE_CARDS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setMode(c.id)}
                  className={`p-4 rounded-xl border text-left space-y-1 cursor-pointer ${
                    mode === c.id
                      ? 'bg-blue-50 border-[#1769F4] text-[#082B52]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-extrabold">{c.title}</div>
                  <p className="text-xs text-slate-600">{c.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Participant Source (Đợt 1 Groups / Manual Teams / Present Students) */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setParticipantSource('dot1_groups')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                  participantSource === 'dot1_groups'
                    ? 'bg-[#1769F4] text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Nhóm đã chia ở Đợt 1 ({dot1Groups.length} nhóm)</span>
              </button>
              <button
                type="button"
                onClick={() => setParticipantSource('manual_teams')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                  participantSource === 'manual_teams'
                    ? 'bg-[#1769F4] text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Nhập đội thủ công
              </button>
              <button
                type="button"
                onClick={() => setParticipantSource('individual_students')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                  participantSource === 'individual_students'
                    ? 'bg-[#1769F4] text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Từng học sinh có mặt ({presentStudents.length} HS)
              </button>
            </div>

            {participantSource === 'dot1_groups' && (
              <div className="space-y-2">
                {dot1Groups.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                    <span>Lớp {classNameLabel} chưa chia nhóm ở Đợt 1.</span>
                    <button
                      type="button"
                      onClick={onGoToGroups}
                      className="px-3 py-1.5 rounded-lg bg-[#1769F4] text-white font-bold cursor-pointer"
                    >
                      Mở Chia nhóm học sinh
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {dot1Groups.map((g) => {
                      const checked = selectedGroupIds.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer text-xs font-bold"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedGroupIds((prev) =>
                                e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                              )
                            }
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: g.color }}
                          />
                          <span className="truncate">
                            {g.name} ({g.studentIds.length} HS)
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {participantSource === 'manual_teams' && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {manualTeamNames.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) =>
                          setManualTeamNames((prev) =>
                            prev.map((item, i) => (i === idx ? e.target.value : item))
                          )
                        }
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold"
                      />
                      {manualTeamNames.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setManualTeamNames((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setManualTeamNames((prev) => [...prev, `Đội ${prev.length + 1}`])
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#1769F4] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm đội</span>
                </button>
              </div>
            )}

            {participantSource === 'individual_students' && (
              <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#DCE8F7] text-xs sm:text-sm text-slate-700 space-y-1">
                <div>
                  Sử dụng <strong>{presentStudents.length} học sinh có mặt</strong> của {classNameLabel}.
                </div>
                {presentStudents.length === 1 && mode === 'golden_bell' && (
                  <div className="text-amber-800 font-bold">
                    Với 1 học sinh, Rung chuông vàng tự động kích hoạt chế độ Luyện tập để học sinh làm hết bộ câu hỏi.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Timing, Scoring & Mode Specifics */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Thời gian mỗi câu (giây, 0 = không giới hạn)
                </label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={secondsPerQuestion}
                  onChange={(e) => setSecondsPerQuestion(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Điểm mỗi câu đúng</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={pointsPerCorrect}
                  onChange={(e) => setPointsPerCorrect(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Quy tắc đổi lượt</label>
                <select
                  value={turnRule}
                  onChange={(e) => setTurnRule(e.target.value as ReviewTurnRule)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                >
                  <option value="rotate_every_question">Xoay vòng sau mỗi câu</option>
                  <option value="keep_on_correct">Đúng được giữ lượt tiếp</option>
                </select>
              </div>
            </div>

            {mode === 'puzzle' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#082B52]">
                    <Puzzle className="w-4 h-4 text-[#1769F4]" />
                    <span>Cấu hình Mở mảnh ghép</span>
                  </div>
                  <span className="text-xs font-bold text-[#1769F4]">
                    {puzzleActiveTileCount}/{puzzleGridInfo.totalTiles} mảnh ghép khả dụng theo {selectedQuestionIds.length} câu đã chọn
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Kích thước lưới</label>
                    <select
                      value={puzzleGridPreset}
                      onChange={(e) => setPuzzleGridPreset(e.target.value as PuzzleGridPreset)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold"
                    >
                      <option value="2x3">2 × 3 (6 mảnh)</option>
                      <option value="3x3">3 × 3 (9 mảnh)</option>
                      <option value="3x4">3 × 4 (12 mảnh)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Từ khóa bức ảnh chủ đề</label>
                    <input
                      type="text"
                      value={puzzleKeyword}
                      onChange={(e) => setPuzzleKeyword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Thưởng đoán đúng ảnh</label>
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={puzzleBonusPoints}
                      onChange={(e) => setPuzzleBonusPoints(Math.max(5, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Ảnh chủ đề nằm dưới mảnh ghép:</span>
                    <label className="inline-flex items-center gap-1 text-xs font-bold text-[#1769F4] cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải ảnh riêng</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadCustomPuzzleImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {BUILTIN_PUZZLE_ARTWORKS.map((art) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => {
                          setPuzzleArtworkId(art.id);
                          setPuzzleKeyword(art.defaultKeyword);
                        }}
                        className={`rounded-xl border overflow-hidden text-left cursor-pointer ${
                          puzzleArtworkId === art.id
                            ? 'border-[#1769F4] ring-2 ring-[#1769F4]/25'
                            : 'border-slate-200'
                        }`}
                      >
                        <img
                          src={art.url}
                          alt={art.title}
                          referrerPolicy="no-referrer"
                          className="w-full aspect-video object-cover"
                        />
                        <div className="p-1.5 text-[11px] font-bold text-[#082B52] truncate">
                          {art.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mode === 'race' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Số bước mỗi câu đúng</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={raceStepPerCorrect}
                    onChange={(e) => setRaceStepPerCorrect(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Mốc vạch đích (số bước)</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={raceFinishTarget}
                    onChange={(e) => setRaceFinishTarget(Math.max(2, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 pt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={raceReducedMotion}
                    onChange={(e) => setRaceReducedMotion(e.target.checked)}
                  />
                  <span>Giảm hiệu ứng chuyển động trên máy chiếu</span>
                </label>
              </div>
            )}

            {mode === 'golden_bell' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={goldenBellPracticeSingle}
                    onChange={(e) => setGoldenBellPracticeSingle(e.target.checked)}
                  />
                  <span>Khi lớp chỉ có 1 học sinh: cho phép đi tiếp ở chế độ Luyện tập kể cả khi trả lời sai</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Summary & Launch */}
        {step === 5 && (
          <div className="p-4 rounded-xl bg-[#F8FBFF] border border-[#DCE8F7] space-y-3">
            <h3 className="text-base font-extrabold text-[#082B52]">
              Sẵn sàng trình chiếu cho {classNameLabel}
            </h3>
            <ul className="text-xs sm:text-sm text-slate-700 space-y-1 list-disc pl-5">
              <li>
                Bộ câu hỏi: <strong>{activeSet?.title || 'Chưa chọn'}</strong> ({selectedQuestionIds.length} câu đã chọn)
              </li>
              <li>
                Chế độ: <strong>{MODE_CARDS.find((c) => c.id === mode)?.title}</strong> · {secondsPerQuestion}s/câu · +{pointsPerCorrect} điểm/câu đúng
              </li>
              <li>
                Người tham gia: <strong>{previewParticipants.length} đội / học sinh</strong>
              </li>
            </ul>
          </div>
        )}

        {/* Step Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4 | 5) : prev))}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white disabled:opacity-40 text-xs font-bold cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>

          <div className="flex items-center gap-2">
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev < 5 ? ((prev + 1) as 1 | 2 | 3 | 4 | 5) : prev))}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                <span>Bước tiếp theo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartNewGameSession}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold shadow-xs cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Bắt đầu chơi &amp; Mở trình chiếu 16:9</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
