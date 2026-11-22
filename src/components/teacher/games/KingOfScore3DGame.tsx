import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Edit3,
  Eye,
  FastForward,
  Flag,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Square,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from 'lucide-react';
import { Question, UserRole } from '../../../types';
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
import {
  areAllTeamsGraded,
  buildBankBoardCandidate,
  clearD06Session,
  computeKingStandings,
  confirmTileSettlement,
  createDefaultKingConfig,
  createDefaultKingTeams,
  createKingOfScoreMatch,
  createSampleStudentList,
  D06_MAX_SCORE_PER_TEAM,
  D06_SAMPLE_BADGE,
  D06_SAMPLE_PACK_TITLE,
  DEFAULT_TIMER_BY_POINTS,
  editLastSettledTileVerdicts,
  finishMatchEarly,
  getActiveTile,
  getCurrentPickerTeam,
  getPreviewPointsByTeam,
  getTimerSecondsForTile,
  inspectMathFormulaErrors,
  KING_POINT_TIERS,
  KING_TEAM_PALETTES,
  KingBoardTile,
  KingMatchConfig,
  KingOfScoreMode,
  KingOfScorePointValue,
  KingOfScoreState,
  KingOfScoreVerdict,
  loadD06Session,
  openBoardTile,
  returnToBoardAfterSettlement,
  revealActiveAnswer,
  saveD06Session,
  setTeamDraftAnswerNote,
  setTeamDraftOptionChoice,
  setTeamDraftVerdict,
  stopAnsweringAndBeginGrading,
} from './kingOfScore3dEngine';
import {
  isWebglSupported,
  KingOfScore2DStage,
  KingOfScore3DScene,
} from './KingOfScore3DScene';

export interface KingOfScore3DGameProps {
  bankQuestions: Question[];
  userRole: UserRole;
  currentUserId?: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

function verdictLabel(verdict: KingOfScoreVerdict): string {
  switch (verdict) {
    case 'correct':
      return 'Đúng';
    case 'incorrect':
      return 'Chưa đúng';
    case 'no_answer':
      return 'Không trả lời';
    default:
      return 'Chưa chấm';
  }
}

function tileStatusLabel(status: 'unplayed' | 'playing' | 'played'): string {
  if (status === 'playing') return 'Đang chơi';
  if (status === 'played') return 'Đã chơi';
  return 'Chưa chơi';
}

function stripLatexForSpeech(raw: string): string {
  return raw
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'căn bậc hai của $1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\times/g, ' nhân ')
    .replace(/\\cdot/g, ' nhân ')
    .replace(/\\Leftrightarrow/g, ' tương đương ')
    .replace(/\\Rightarrow/g, ' suy ra ')
    .replace(/\\,|\\;|\\:|\\\(|\\\)|\\\[|\\\]|\$\$/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\^2/g, ' bình phương')
    .replace(/\s+/g, ' ')
    .trim();
}

export const KingOfScore3DGame: React.FC<KingOfScore3DGameProps> = ({
  bankQuestions,
  userRole,
  currentUserId,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Audio & voice controllers synced with A01/A02
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const turnTokenRef = useRef<string>('d06_init');
  const settleCommitLockRef = useRef<boolean>(false);

  if (!soundBankRef.current) {
    soundBankRef.current = new EduGameSoundBank();
  }
  if (!voiceRef.current) {
    voiceRef.current = new EduGameVoiceController(null);
  }

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [use3DStage, setUse3DStage] = useState<boolean>(() => isWebglSupported());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Setup state
  const [config, setConfig] = useState<KingMatchConfig>(() => createDefaultKingConfig('team'));
  const [manualBankOverrides, setManualBankOverrides] = useState<Record<string, string>>({});
  const [showSampleRosterPreview, setShowSampleRosterPreview] = useState<boolean>(false);

  // Active match state
  const [matchState, setMatchState] = useState<KingOfScoreState | null>(null);
  const [savedSessionNotice, setSavedSessionNotice] = useState<ReturnType<typeof loadD06Session>>(
    () => loadD06Session()
  );

  // Timer state (starts ONLY after question & math are rendered)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [timerPaused, setTimerPaused] = useState<boolean>(false);
  const [timerExpired, setTimerExpired] = useState<boolean>(false);
  const [contentReadyForTimer, setContentReadyForTimer] = useState<boolean>(false);

  // Visual / modal states
  const [scorePulseNonce, setScorePulseNonce] = useState<number>(0);
  const [skipAnimationNonce, setSkipAnimationNonce] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showStandingsModal, setShowStandingsModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewFocusTileId, setReviewFocusTileId] = useState<string | null>(null);
  const [zoomFormulaText, setZoomFormulaText] = useState<string | null>(null);

  // Edit-last-tile modal state
  const [editingLastTile, setEditingLastTile] = useState<boolean>(false);
  const [editVerdictsDraft, setEditVerdictsDraft] = useState<Record<string, KingOfScoreVerdict>>({});

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      soundBankRef.current?.dispose();
      voiceRef.current?.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const stopPendingTurnAudio = useCallback((nextToken: string) => {
    turnTokenRef.current = nextToken;
    soundBankRef.current?.setActiveTurnToken(nextToken);
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    saveEduGameMuted(next);
    if (next) {
      soundBankRef.current?.stopAll();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
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

  const handleSpeakText = useCallback(
    (text: string) => {
      if (isMuted || !voiceEnabled) {
        showToast('Âm thanh hoặc giọng đọc đang tắt.');
        return;
      }
      const clean = stripLatexForSpeech(text);
      if (!clean) return;
      voiceRef.current
        ?.replayText({
          text: clean,
          isMuted,
          voiceEnabled,
          onBeforeSpeak: () => {
            soundBankRef.current?.stopLoops();
          },
        })
        .then((res) => {
          if (!res.spoken && res.reason === 'no_vietnamese_voice') {
            showToast('Thiết bị chưa cài giọng tiếng Việt (vi-VN). Nội dung vẫn hiển thị đầy đủ.');
          }
        })
        .catch(() => {});
    },
    [isMuted, voiceEnabled, showToast]
  );

  // Derived Smart EDU bank candidate
  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const q of bankQuestions || []) {
      if (q.subject) set.add(q.subject);
    }
    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [bankQuestions]);

  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const q of bankQuestions || []) {
      if (q.grade) set.add(q.grade);
    }
    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [bankQuestions]);

  const bankCandidate = useMemo(
    () =>
      buildBankBoardCandidate({
        bankQuestions,
        userRole,
        currentUserId,
        subjectFilter: config.subjectFilter,
        gradeFilter: config.gradeFilter,
        manualOverrides: manualBankOverrides,
      }),
    [bankQuestions, userRole, currentUserId, config.subjectFilter, config.gradeFilter, manualBankOverrides]
  );

  const sampleStudents50 = useMemo(
    () => createSampleStudentList(config.classSizeHint),
    [config.classSizeHint]
  );

  // Persist active match session cleanly (auto-isolated on /demo)
  useEffect(() => {
    if (!matchState) return;
    saveD06Session(matchState, remainingSeconds, timerPaused);
  }, [matchState, remainingSeconds, timerPaused]);

  // Mark question content rendered before starting countdown timer
  const activeTile = useMemo(
    () => (matchState ? getActiveTile(matchState) : null),
    [matchState]
  );

  useEffect(() => {
    if (!matchState || matchState.phase !== 'thinking' || !activeTile) {
      setContentReadyForTimer(false);
      return;
    }
    let cancelled = false;
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        if (!cancelled) setContentReadyForTimer(true);
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, [matchState?.phase, activeTile?.tileId]);

  // Countdown tick effect (only while thinking, timerEnabled, content rendered, not paused)
  useEffect(() => {
    if (
      !matchState ||
      matchState.status !== 'playing' ||
      matchState.phase !== 'thinking' ||
      !matchState.config.timerEnabled ||
      !contentReadyForTimer ||
      timerPaused
    ) {
      return;
    }
    if (remainingSeconds <= 0) {
      return;
    }

    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setTimerExpired(true);
          soundBankRef.current?.playTimerBell(isMuted);
          setMatchState((cur) => (cur ? stopAnsweringAndBeginGrading(cur) : cur));
          return 0;
        }
        if (prev <= 4) {
          const step = (prev - 1) as 3 | 2 | 1;
          if (step === 3 || step === 2 || step === 1) {
            soundBankRef.current?.playCountdownBeep(step, isMuted, turnTokenRef.current);
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [
    matchState?.status,
    matchState?.phase,
    matchState?.config.timerEnabled,
    contentReadyForTimer,
    timerPaused,
    remainingSeconds > 0,
    isMuted,
  ]);

  // ============================================================================
  // SETUP HANDLERS
  // ============================================================================

  const handleModeChange = (nextMode: KingOfScoreMode) => {
    setConfig((prev) => ({
      ...prev,
      mode: nextMode,
      teams: createDefaultKingTeams(nextMode, nextMode === 'team' ? Math.max(2, Math.min(6, prev.teams.length || 3)) : 1),
    }));
  };

  const handleTeamCountChange = (count: number) => {
    const safe = Math.max(2, Math.min(6, count));
    setConfig((prev) => {
      const nextTeams = Array.from({ length: safe }, (_, idx) => {
        const existing = prev.teams[idx];
        return (
          existing || {
            id: `team_${idx + 1}`,
            teamNumber: idx + 1,
            name: `Đội ${String.fromCharCode(65 + idx)}`,
            paletteIndex: idx % KING_TEAM_PALETTES.length,
          }
        );
      });
      return { ...prev, teams: nextTeams };
    });
  };

  const handleStartMatch = () => {
    soundBankRef.current?.unlock();
    let customTiles: KingBoardTile[] | undefined;

    if (config.sourceKind === 'bank') {
      if (!bankCandidate.ready) {
        showToast(
          `Bộ câu tự chọn còn thiếu ${bankCandidate.missingSlots.length} ô. Hãy chọn bổ sung hoặc chuyển sang bộ mẫu.`
        );
        return;
      }
      customTiles = bankCandidate.slots.map((slot) => ({
        tileId: slot.tileId,
        colIndex: slot.colIndex,
        rowIndex: slot.rowIndex,
        topicTitle: slot.topicTitle,
        points: slot.points,
        question: slot.question!,
        status: 'unplayed',
        pickerTeamId: null,
      }));
    }

    const token = `d06_match_${Date.now()}`;
    stopPendingTurnAudio(token);
    const created = createKingOfScoreMatch({
      config: {
        ...config,
        topicTitles: customTiles ? bankCandidate.topicTitles : config.topicTitles,
      },
      customTiles,
    });
    settleCommitLockRef.current = false;
    setMatchState(created);
    setSavedSessionNotice(null);
    setRemainingSeconds(0);
    setTimerPaused(false);
    setTimerExpired(false);
    setEditingLastTile(false);
    setShowReviewModal(false);
    setShowStandingsModal(false);
  };

  const handleResumeSavedSession = () => {
    if (!savedSessionNotice) return;
    soundBankRef.current?.unlock();
    const token = `d06_resume_${Date.now()}`;
    stopPendingTurnAudio(token);
    setMatchState(savedSessionNotice.state);
    setConfig(savedSessionNotice.state.config);
    setRemainingSeconds(savedSessionNotice.remainingSeconds);
    setTimerPaused(savedSessionNotice.timerPaused);
    setTimerExpired(false);
    setSavedSessionNotice(null);
  };

  const handleDiscardSavedSession = () => {
    clearD06Session();
    setSavedSessionNotice(null);
  };

  // ============================================================================
  // MATCH FLOW HANDLERS
  // ============================================================================

  const handleOpenTile = useCallback(
    (tileId: string) => {
      if (!matchState) return;
      soundBankRef.current?.unlock();
      const res = openBoardTile(matchState, tileId);
      if (!res.opened) {
        if (res.reason) showToast(res.reason);
        return;
      }

      const token = `d06_tile_${tileId}_${Date.now()}`;
      stopPendingTurnAudio(token);
      soundBankRef.current?.playKingTileOpen(isMuted, token);

      const openedTile = res.state.tiles.find((t) => t.tileId === tileId);
      const seconds = openedTile
        ? getTimerSecondsForTile(res.state.config, openedTile.points)
        : 0;

      settleCommitLockRef.current = false;
      setMatchState(res.state);
      setRemainingSeconds(seconds);
      setTimerPaused(false);
      setTimerExpired(false);
      setEditingLastTile(false);
    },
    [matchState, isMuted, showToast, stopPendingTurnAudio]
  );

  const handleStopAnswering = () => {
    if (!matchState) return;
    setMatchState((cur) => (cur ? stopAnsweringAndBeginGrading(cur) : cur));
  };

  const handleRevealAnswer = () => {
    if (!matchState) return;
    setMatchState((cur) => (cur ? revealActiveAnswer(cur) : cur));
  };

  const handleConfirmSettlement = () => {
    if (!matchState || settleCommitLockRef.current) return;
    settleCommitLockRef.current = true;
    soundBankRef.current?.unlock();

    const res = confirmTileSettlement(matchState);
    if (!res.committed) {
      settleCommitLockRef.current = false;
      if (res.reason) showToast(res.reason);
      return;
    }

    setMatchState(res.state);
    setScorePulseNonce((n) => n + 1);
    if (res.scorersCount > 0) {
      // ONE unified scoring chime even if multiple teams scored simultaneously
      soundBankRef.current?.playKingScoreAward(isMuted, turnTokenRef.current);
    }
    window.setTimeout(() => {
      settleCommitLockRef.current = false;
    }, 180);
  };

  const handleReturnToBoard = () => {
    if (!matchState) return;
    const token = `d06_board_${Date.now()}`;
    stopPendingTurnAudio(token);
    const next = returnToBoardAfterSettlement(matchState);
    setMatchState(next);
    setRemainingSeconds(0);
    setTimerPaused(false);
    setTimerExpired(false);
    setEditingLastTile(false);
    if (next.status === 'finished') {
      soundBankRef.current?.playKingSummaryFanfare(isMuted, token);
    }
  };

  const handleOpenEditLastTile = () => {
    if (!matchState || !matchState.canEditLastTile || !matchState.lastSettledTileId) return;
    const rec = matchState.settledHistory.find((r) => r.tileId === matchState.lastSettledTileId);
    if (!rec) return;
    setEditVerdictsDraft({ ...rec.verdictsByTeam });
    setEditingLastTile(true);
  };

  const handleSaveEditLastTile = () => {
    if (!matchState) return;
    const res = editLastSettledTileVerdicts(matchState, editVerdictsDraft);
    if (!res.edited) {
      if (res.reason) showToast(res.reason);
      return;
    }
    setMatchState(res.state);
    setEditingLastTile(false);
    setScorePulseNonce((n) => n + 1);
    showToast('Đã cập nhật kết quả ô vừa chấm và tính lại tổng điểm (không đổi lượt chọn ô).');
  };

  const handleFinishEarly = () => {
    if (!matchState) return;
    const token = `d06_early_${Date.now()}`;
    stopPendingTurnAudio(token);
    const next = finishMatchEarly(matchState);
    setMatchState(next);
    setEditingLastTile(false);
    soundBankRef.current?.playKingSummaryFanfare(isMuted, token);
  };

  const handleReplaySameTeams = () => {
    if (!matchState) return;
    const token = `d06_replay_${Date.now()}`;
    stopPendingTurnAudio(token);
    const fresh = createKingOfScoreMatch({
      config: matchState.config,
      customTiles:
        matchState.config.sourceKind === 'bank'
          ? matchState.tiles.map((t) => ({ ...t, status: 'unplayed', pickerTeamId: null }))
          : undefined,
    });
    settleCommitLockRef.current = false;
    setMatchState(fresh);
    setRemainingSeconds(0);
    setTimerPaused(false);
    setTimerExpired(false);
    setEditingLastTile(false);
    setShowReviewModal(false);
    setShowStandingsModal(false);
  };

  const handleChangeTeams = () => {
    stopPendingTurnAudio(`d06_setup_${Date.now()}`);
    if (matchState) {
      setConfig(matchState.config);
    }
    clearD06Session();
    setMatchState(null);
    setEditingLastTile(false);
    setShowReviewModal(false);
    setShowStandingsModal(false);
  };

  const handleExitToLibrary = () => {
    stopPendingTurnAudio(`d06_exit_${Date.now()}`);
    onBackToLibrary();
  };

  // Derived standings & rank lookup (stable display order on grading cards!)
  const standings = useMemo(
    () => (matchState ? computeKingStandings(matchState) : []),
    [matchState]
  );

  const standingByTeamId = useMemo(() => {
    const map = new Map<string, (typeof standings)[number]>();
    for (const row of standings) {
      map.set(row.teamId, row);
    }
    return map;
  }, [standings]);

  const activeMathDiagnostics = useMemo(() => {
    if (!activeTile) return [];
    const stemErrs = inspectMathFormulaErrors(activeTile.question.stem).map((d) => ({
      ...d,
      where: 'Đề bài',
    }));
    const ansErrs = inspectMathFormulaErrors(activeTile.question.officialAnswerText).map((d) => ({
      ...d,
      where: 'Đáp án',
    }));
    const expErrs = inspectMathFormulaErrors(activeTile.question.explanation).map((d) => ({
      ...d,
      where: 'Lời giải',
    }));
    const optErrs = (activeTile.question.options || []).flatMap((opt) =>
      inspectMathFormulaErrors(opt.text).map((d) => ({
        ...d,
        where: `Phương án ${opt.label}`,
      }))
    );
    return [...stemErrs, ...optErrs, ...ansErrs, ...expErrs];
  }, [activeTile]);

  // ============================================================================
  // RENDER: SETUP SCREEN
  // ============================================================================
  if (!matchState) {
    return (
      <div
        className={`w-full ${
          isFullscreen ? 'h-full overflow-y-auto p-4 sm:p-6' : 'rounded-2xl p-4 sm:p-6'
        } bg-[#071226] text-slate-100 border border-teal-500/25 space-y-5`}
      >
        {/* Clean Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                D06 · Vua ghi điểm
              </h2>
              <p className="text-xs text-slate-400">
                Bảng chọn câu hỏi theo chủ đề & mức điểm 10 · 20 · 30 · Trình chiếu lớp 1–50 học sinh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleMute}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 hover:border-teal-400/60 flex items-center gap-1.5 whitespace-nowrap"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-teal-300" />}
              <span>{isMuted ? 'Đang tắt loa' : 'Âm thanh bật'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 hover:border-teal-400/60 flex items-center gap-1.5 whitespace-nowrap"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? 'Thu gọn' : 'Toàn màn hình'}</span>
            </button>
            <button
              type="button"
              onClick={handleExitToLibrary}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white whitespace-nowrap"
            >
              Về thư viện
            </button>
          </div>
        </div>

        {/* Saved Session Resume Banner */}
        {savedSessionNotice && (
          <div className="rounded-xl bg-teal-950/60 border border-teal-400/40 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-teal-100">
              <span className="font-semibold text-white">Có phiên Vua ghi điểm đang dở</span>
              <span className="mx-2 text-teal-400">·</span>
              <span>
                Đã chấm {savedSessionNotice.state.settledHistory.length}/9 ô ·{' '}
                {savedSessionNotice.state.config.teams.length} đội
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResumeSavedSession}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal-500 text-slate-950 hover:bg-teal-400 whitespace-nowrap"
              >
                Tiếp tục phiên cũ
              </button>
              <button
                type="button"
                onClick={handleDiscardSavedSession}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white whitespace-nowrap"
              >
                Bỏ phiên cũ
              </button>
            </div>
          </div>
        )}

        {toastMessage && (
          <div className="rounded-lg bg-amber-500/15 border border-amber-400/50 px-3.5 py-2.5 text-xs font-medium text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 7 cols: Mode, Teams, Timer & Question Source */}
          <div className="lg:col-span-7 space-y-5">
            {/* Mode Selector */}
            <section className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
              <h3 className="text-sm font-bold text-white">1. Hình thức tổ chức lớp</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { key: 'team', title: 'Thi đấu đội', desc: '2–6 đội, chấm đồng thời' },
                    { key: 'class_shared', title: 'Cả lớp cùng chơi', desc: '1 bảng điểm chung 1–50 HS' },
                    { key: 'solo', title: 'Tự luyện', desc: '1 học sinh, không đối thủ giả' },
                  ] as const
                ).map((item) => {
                  const active = config.mode === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleModeChange(item.key)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        active
                          ? 'bg-teal-500/15 border-teal-400 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-sm font-bold">{item.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>

              {config.mode === 'team' ? (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Số lượng đội (2–6 đội, không yêu cầu email):
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4, 5, 6].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => handleTeamCountChange(cnt)}
                          className={`w-9 h-9 rounded-lg text-xs font-bold font-mono transition-colors ${
                            config.teams.length === cnt
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-950 border border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {config.teams.map((team, idx) => {
                      const palette = KING_TEAM_PALETTES[team.paletteIndex % KING_TEAM_PALETTES.length];
                      return (
                        <div
                          key={team.id}
                          className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-2"
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: palette.hex }}
                            title={palette.label}
                          />
                          <span className="text-xs font-mono text-slate-400 shrink-0">#{idx + 1}</span>
                          <input
                            type="text"
                            value={team.name}
                            maxLength={28}
                            onChange={(e) => {
                              const val = e.target.value;
                              setConfig((prev) => ({
                                ...prev,
                                teams: prev.teams.map((t) =>
                                  t.id === team.id ? { ...t, name: val } : t
                                ),
                              }));
                            }}
                            placeholder={`Đội ${String.fromCharCode(65 + idx)}`}
                            className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={config.randomStarter}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, randomStarter: e.target.checked }))
                      }
                      className="rounded border-slate-600 text-teal-500 focus:ring-teal-500"
                    />
                    <Shuffle className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                    <span>
                      Chọn ngẫu nhiên đội mở đầu (chỉ xác định một lần khi tạo trận, sau đó xoay vòng theo thứ tự)
                    </span>
                  </label>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-3">
                  <label className="text-xs font-semibold text-slate-300">
                    Nhãn bảng điểm:
                  </label>
                  <input
                    type="text"
                    value={config.teams[0]?.name || ''}
                    maxLength={32}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig((prev) => ({
                        ...prev,
                        teams: prev.teams.map((t, i) => (i === 0 ? { ...t, name: val } : t)),
                      }));
                    }}
                    className="flex-1 min-w-[200px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              )}

              {/* Classroom size 1–50 & optional sample 50-student list helper */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-300" />
                  <span>Sĩ số lớp trình chiếu:</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={config.classSizeHint}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        classSizeHint: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                      }))
                    }
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white"
                  />
                  <span className="text-slate-400">học sinh (1–50)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSampleRosterPreview((v) => !v)}
                  className="text-teal-300 hover:text-teal-200 underline underline-offset-2 font-medium"
                >
                  {showSampleRosterPreview ? 'Ẩn danh sách mẫu' : `Xem danh sách mẫu (${config.classSizeHint} HS)`}
                </button>
              </div>

              {showSampleRosterPreview && (
                <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-3 max-h-36 overflow-y-auto">
                  <div className="text-xs font-semibold text-slate-400 mb-2">
                    Danh sách mẫu {config.classSizeHint} học sinh (chỉ để chia nhóm tại lớp, không cần email):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs text-slate-300 font-mono">
                    {sampleStudents50.map((name) => (
                      <div key={name} className="truncate">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Question Source Selector */}
            <section className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
              <h3 className="text-sm font-bold text-white">2. Nguồn bộ câu hỏi (3 chủ đề × 3 mức điểm)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'sample' }))}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    config.sourceKind === 'sample'
                      ? 'bg-amber-400/15 border-amber-400 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="text-sm font-bold">{D06_SAMPLE_PACK_TITLE}</div>
                  <div className="text-xs text-amber-200/80 mt-0.5">
                    {D06_SAMPLE_BADGE} · Đủ 9 ô chuẩn KaTeX · Bắt đầu ngay
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'bank' }))}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    config.sourceKind === 'bank'
                      ? 'bg-teal-500/15 border-teal-400 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="text-sm font-bold">Ngân hàng câu hỏi Smart EDU</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Theo quyền hiện có · Không tự lặp câu · Không suy đoán độ khó
                  </div>
                </button>
              </div>

              {config.sourceKind === 'bank' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Môn học</label>
                      <select
                        value={config.subjectFilter}
                        onChange={(e) => {
                          setManualBankOverrides({});
                          setConfig((prev) => ({ ...prev, subjectFilter: e.target.value }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                      >
                        {subjectOptions.map((s) => (
                          <option key={s} value={s}>
                            {s === 'ALL' ? 'Tất cả môn học' : s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Khối lớp</label>
                      <select
                        value={config.gradeFilter}
                        onChange={(e) => {
                          setManualBankOverrides({});
                          setConfig((prev) => ({ ...prev, gradeFilter: e.target.value }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                      >
                        {gradeOptions.map((g) => (
                          <option key={g} value={g}>
                            {g === 'ALL' ? 'Tất cả khối lớp' : g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Câu hợp lệ có phân loại mức độ:{' '}
                      <strong className="font-mono text-teal-300">
                        {bankCandidate.eligiblePool.length}
                      </strong>
                    </span>
                    {bankCandidate.unclassifiedCount > 0 && (
                      <span className="text-amber-300">
                        ({bankCandidate.unclassifiedCount} câu chưa phân loại độ khó — không tự suy đoán)
                      </span>
                    )}
                  </div>

                  {!bankCandidate.ready ? (
                    <div className="rounded-lg bg-rose-950/40 border border-rose-500/40 p-3 space-y-2 text-xs">
                      <div className="font-bold text-rose-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          Chưa đủ 9 câu hợp lệ phân loại rõ ràng. Còn thiếu {bankCandidate.missingSlots.length} ô:
                        </span>
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-rose-100/90">
                        {bankCandidate.missingSlots.map((slot) => (
                          <li key={slot.tileId}>
                            <strong>{slot.topicTitle}</strong> — mức{' '}
                            <strong>{slot.points} điểm</strong> ({slot.expectedLevelLabel})
                          </li>
                        ))}
                      </ul>
                      <div className="pt-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'sample' }))}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold hover:bg-amber-300"
                        >
                          Chuyển sang bộ mẫu “{D06_SAMPLE_PACK_TITLE}”
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/40 p-3 text-xs text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>
                        Đã ghép đủ 9 ô không trùng câu từ ngân hàng Smart EDU ({bankCandidate.topicTitles.join(' · ')}).
                      </span>
                    </div>
                  )}

                  {/* Per-slot swapper when bank has eligible questions */}
                  {bankCandidate.eligiblePool.length > 0 && (
                    <details className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5 text-xs">
                      <summary className="cursor-pointer font-semibold text-teal-300">
                        Đổi từng ô thủ công (tuỳ chọn)
                      </summary>
                      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {bankCandidate.slots.map((slot) => (
                          <div key={slot.tileId} className="space-y-1">
                            <div className="text-[11px] text-slate-400 truncate">
                              {slot.topicTitle} · {slot.points}đ
                            </div>
                            <select
                              value={slot.question?.id || ''}
                              onChange={(e) =>
                                setManualBankOverrides((prev) => ({
                                  ...prev,
                                  [slot.tileId]: e.target.value,
                                }))
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                            >
                              <option value="">-- Chưa có câu --</option>
                              {bankCandidate.eligiblePool.map((q) => (
                                <option key={q.id} value={q.id}>
                                  [{q.points}đ · {q.code}] {q.stem.slice(0, 42)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </section>

            {/* Timer & Display Options */}
            <section className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">3. Thời gian suy nghĩ theo mức điểm</h3>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.timerEnabled}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, timerEnabled: e.target.checked }))
                    }
                    className="rounded border-slate-600 text-teal-500"
                  />
                  <span>{config.timerEnabled ? 'Bật đếm ngược' : 'Không giới hạn thời gian'}</span>
                </label>
              </div>

              {config.timerEnabled && (
                <div className="grid grid-cols-3 gap-2.5">
                  {KING_POINT_TIERS.map((pts) => (
                    <div
                      key={pts}
                      className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5 space-y-1"
                    >
                      <label className="block text-xs font-semibold text-amber-300">
                        Ô {pts} điểm (giây)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={config.timerByPoints[pts]}
                        onChange={(e) => {
                          const v = Math.max(5, Math.min(300, Number(e.target.value) || DEFAULT_TIMER_BY_POINTS[pts]));
                          setConfig((prev) => ({
                            ...prev,
                            timerByPoints: { ...prev.timerByPoints, [pts]: v },
                          }));
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono font-bold text-white text-center"
                      />
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={config.showOptionsInTeamMode}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, showOptionsInTeamMode: e.target.checked }))
                  }
                  className="rounded border-slate-600 text-teal-500"
                />
                <span>Hiển thị 4 phương án A, B, C, D cùng đề bài (phù hợp giơ thẻ đáp án hoặc bảng con)</span>
              </label>
            </section>
          </div>

          {/* Right 5 cols: Clear Rules Summary + Start CTA */}
          <div className="lg:col-span-5 space-y-4">
            <section className="rounded-xl bg-slate-900/90 border border-teal-500/30 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Luật chơi Vua ghi điểm (D06)</span>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
                <li>
                  • Bảng gồm <strong>3 chủ đề × 3 mức điểm (10, 20, 30)</strong>, tổng <strong>9 ô</strong>. Điểm tối đa mỗi đội là <strong className="font-mono text-amber-300">{D06_MAX_SCORE_PER_TEAM}</strong>.
                </li>
                <li>
                  • Các đội <strong>luân phiên chọn ô</strong> theo thứ tự. Khi mở ô, <strong>tất cả các đội cùng trả lời</strong> câu hỏi đó trên bảng con, giấy hoặc thẻ đáp án.
                </li>
                <li>
                  • Đúng cộng đúng giá trị ô (<strong>+10 / +20 / +30</strong>); sai hoặc không trả lời nhận <strong>0 điểm</strong>. Quyền chọn ô không kèm điểm thưởng.
                </li>
                <li>
                  • Nhiều đội cùng đúng đều nhận đủ điểm. Ô đã chấm sẽ khóa, chỉ mở lại ở mục <strong>Xem lại lời giải</strong>.
                </li>
                <li>
                  • Xếp hạng theo tổng điểm, bằng điểm ghi <strong>Đồng hạng</strong> (không xét tốc độ bấm hay thứ tự nhập).
                </li>
                <li>
                  • Cho phép <strong>sửa kết quả ô vừa chấm</strong> trước khi mở ô tiếp theo (tính lại điểm từ lịch sử, không chuyển thêm lượt).
                </li>
              </ul>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartMatch}
                  disabled={config.sourceKind === 'bank' && !bankCandidate.ready}
                  className="w-full py-3.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Bắt đầu trận Vua ghi điểm</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: SUMMARY SCREEN (Finished or Ended Early)
  // ============================================================================
  if (matchState.status === 'finished' || matchState.status === 'ended_early') {
    const playedCount = matchState.settledHistory.length;
    const topScore = standings[0]?.totalScore ?? 0;
    const leaders = standings.filter((s) => s.totalScore === topScore);

    return (
      <div
        className={`w-full ${
          isFullscreen ? 'h-full overflow-y-auto p-4 sm:p-6' : 'rounded-2xl p-4 sm:p-6'
        } bg-[#071226] text-slate-100 border border-amber-400/35 space-y-5`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                {matchState.endedEarly
                  ? 'Tổng kết Vua ghi điểm · Kết thúc sớm'
                  : 'Tổng kết Vua ghi điểm'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Đã hoàn thành{' '}
                <strong className="font-mono text-amber-300">
                  {playedCount}/{matchState.tiles.length} ô
                </strong>
                {' · '}Điểm tối đa bảng:{' '}
                <strong className="font-mono text-teal-300">{matchState.maxPossibleScore}</strong>
                {matchState.endedEarly ? ' · Trạng thái: Kết thúc sớm' : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 flex items-center gap-1.5"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-teal-300" />}
              <span>{isMuted ? 'Tắt loa' : 'Loa bật'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 flex items-center gap-1.5"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? 'Thu gọn' : 'Toàn màn hình'}</span>
            </button>
          </div>
        </div>

        {/* Highlight Banner */}
        <div className="rounded-xl bg-slate-900/90 border border-amber-400/35 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-amber-300">
              {matchState.config.mode === 'team'
                ? leaders.length > 1
                  ? 'Đồng hạng nhất'
                  : 'Dẫn đầu bảng điểm'
                : 'Kết quả phiên học'}
            </div>
            <div className="text-lg sm:text-2xl font-extrabold text-white">
              {leaders.map((l) => l.name).join(' · ')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Tổng điểm cao nhất</div>
            <div className="text-3xl font-extrabold font-mono tabular-nums text-amber-300">
              {topScore} <span className="text-sm font-semibold text-slate-400">/ {matchState.maxPossibleScore}</span>
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-3 px-4 font-semibold">Thứ hạng</th>
                  <th className="py-3 px-4 font-semibold">Đội / Bảng điểm</th>
                  <th className="py-3 px-4 font-semibold text-right">Số câu đúng</th>
                  <th className="py-3 px-4 font-semibold text-right">Tổng điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {standings.map((row) => {
                  const palette = KING_TEAM_PALETTES[row.paletteIndex % KING_TEAM_PALETTES.length];
                  return (
                    <tr key={row.teamId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-amber-300 whitespace-nowrap">
                        {row.rankLabel}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: palette.hex }}
                          />
                          <span className="font-bold text-white">{row.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-300">
                        {row.correctCount}/{playedCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-lg font-extrabold text-white">
                        {row.totalScore}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setReviewFocusTileId(null);
              setShowReviewModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Xem lại lời giải ({playedCount} ô)</span>
          </button>
          <button
            type="button"
            onClick={handleReplaySameTeams}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Chơi lại</span>
          </button>
          <button
            type="button"
            onClick={handleChangeTeams}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>Đổi đội</span>
          </button>
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 font-semibold text-sm"
          >
            Về thư viện
          </button>
        </div>

        {/* Inline Review List on Summary */}
        {playedCount > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-teal-300">
              Lời giải chi tiết các ô đã chơi ({playedCount} ô)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matchState.settledHistory.map((rec, idx) => {
                const winners = matchState.config.teams.filter(
                  (t) => rec.verdictsByTeam[t.id] === 'correct'
                );
                return (
                  <div
                    key={rec.tileId}
                    className="rounded-xl bg-slate-900/85 border border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-amber-300">
                        Ô #{idx + 1} · {rec.topicTitle} · {rec.points} điểm
                      </span>
                      <span className="text-teal-300">
                        {winners.length > 0
                          ? `Ghi điểm: ${winners.map((w) => w.name).join(', ')}`
                          : 'Chưa có đội ghi điểm'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      <MathView content={rec.questionStem} block />
                    </div>
                    <div className="text-xs text-emerald-300">
                      <strong>Đáp án:</strong> <MathView content={rec.officialAnswerText} />
                    </div>
                    <div className="text-xs text-slate-300 border-t border-slate-800 pt-2">
                      <strong>Lời giải:</strong> <MathView content={rec.explanation} block />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Review Modal when triggered explicitly */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl max-h-[86vh] overflow-y-auto rounded-2xl bg-[#0B182F] border border-teal-400/40 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">Xem lại lời giải các ô đã chơi</h3>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  aria-label="Đóng xem lại lời giải"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {matchState.settledHistory.length === 0 ? (
                <p className="text-sm text-slate-400">Chưa có ô nào được chấm điểm.</p>
              ) : (
                <div className="space-y-3">
                  {matchState.settledHistory.map((rec, idx) => (
                    <div
                      key={rec.tileId}
                      className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2"
                    >
                      <div className="text-xs font-semibold text-amber-300">
                        Lượt {idx + 1} · {rec.topicTitle} · {rec.points} điểm
                      </div>
                      <div className="text-base font-bold text-white">
                        <MathView content={rec.questionStem} block />
                      </div>
                      <div className="text-sm text-emerald-300">
                        <strong>Đáp án:</strong> <MathView content={rec.officialAnswerText} />
                      </div>
                      <div className="text-sm text-slate-200">
                        <strong>Lời giải:</strong> <MathView content={rec.explanation} block />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER: ACTIVE PLAYING VIEW (Board Stage OR Active Question Stage)
  // ============================================================================
  const pickerTeam = getCurrentPickerTeam(matchState);
  const pickerPalette =
    KING_TEAM_PALETTES[pickerTeam.paletteIndex % KING_TEAM_PALETTES.length];
  const playedCount = matchState.tiles.filter((t) => t.status === 'played').length;
  const isQuestionOpen = matchState.phase !== 'board' && activeTile !== null;
  const allGraded = areAllTeamsGraded(matchState);
  const previewPoints = getPreviewPointsByTeam(matchState);

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-full overflow-y-auto p-3 sm:p-4' : 'rounded-2xl p-3 sm:p-4'
      } bg-[#071226] text-slate-100 border border-teal-500/25 space-y-3.5`}
    >
      {/* Top Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Crown className="w-5 h-5 text-amber-300 shrink-0" />
          <span className="text-base sm:text-lg font-extrabold text-white whitespace-nowrap">
            D06 · Vua ghi điểm
          </span>
          <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
            {playedCount}/{matchState.tiles.length} ô đã chơi
          </span>
          {matchState.config.sourceKind === 'sample' && (
            <span className="text-xs text-amber-300 font-medium whitespace-nowrap hidden sm:inline">
              · {D06_SAMPLE_BADGE}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleMute}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 hover:border-teal-400 flex items-center gap-1 whitespace-nowrap"
            title="Bật / tắt âm thanh"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-teal-300" />}
            <span className="hidden sm:inline">{isMuted ? 'Tắt loa' : 'Loa bật'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVoice}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
              voiceEnabled && !isMuted
                ? 'bg-slate-900 border-teal-500/40 text-teal-200'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title="Bật / tắt giọng đọc tiếng Việt (vi-VN)"
          >
            Giọng Việt: {voiceEnabled ? 'Bật' : 'Tắt'}
          </button>

          <button
            type="button"
            onClick={() => setUse3DStage((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 hover:border-teal-400 flex items-center gap-1 whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-teal-300" />
            <span>{use3DStage ? '3D' : '2D nhẹ'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSkipAnimationNonce((n) => n + 1)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 hover:border-amber-400 flex items-center gap-1 whitespace-nowrap"
            title="Bỏ qua hoạt ảnh hiện tại"
          >
            <FastForward className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden md:inline">Bỏ qua hoạt ảnh</span>
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
              reducedMotion
                ? 'bg-amber-400/15 border-amber-400/60 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {reducedMotion ? 'Giảm chuyển động: Bật' : 'Giảm chuyển động'}
          </button>

          {matchState.settledHistory.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setReviewFocusTileId(null);
                setShowReviewModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-teal-200 hover:border-teal-400 flex items-center gap-1 whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xem lại lời giải</span>
            </button>
          )}

          {matchState.config.mode === 'team' && (
            <button
              type="button"
              onClick={() => setShowStandingsModal(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-amber-200 hover:border-amber-400 flex items-center gap-1 whitespace-nowrap"
            >
              <Award className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Thứ hạng</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFinishEarly}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-rose-500/40 text-rose-200 hover:bg-rose-950/60 flex items-center gap-1 whitespace-nowrap"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Kết thúc sớm</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 hover:border-teal-400 flex items-center gap-1 whitespace-nowrap"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Thu gọn' : 'Toàn màn hình'}</span>
          </button>

          <button
            type="button"
            onClick={handleExitToLibrary}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white whitespace-nowrap"
          >
            Về thư viện
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="rounded-lg bg-amber-500/15 border border-amber-400/50 px-3.5 py-2 text-xs font-medium text-amber-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-amber-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MAIN AREA: EITHER BOARD VIEW OR FULL-FOCUS QUESTION & GRADING VIEW   */}
      {/* ==================================================================== */}
      {!isQuestionOpen ? (
        <div className="space-y-4">
          {/* Picker Turn Banner + Edit Last Tile Action */}
          <div className="rounded-xl bg-slate-900/90 border border-teal-500/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-4 h-4 rounded-sm shrink-0"
                style={{ backgroundColor: pickerPalette.hex }}
              />
              <div className="text-sm sm:text-base font-bold text-white">
                {matchState.config.mode === 'team' ? (
                  <>
                    Lượt chọn ô:{' '}
                    <span className="text-amber-300">{pickerTeam.name}</span>
                    <span className="text-xs font-normal text-slate-400 ml-2">
                      (Tất cả {matchState.config.teams.length} đội cùng trả lời câu hỏi được mở)
                    </span>
                  </>
                ) : (
                  <span>Chọn một ô điểm bất kỳ để bắt đầu câu hỏi</span>
                )}
              </div>
            </div>

            {matchState.canEditLastTile && matchState.lastSettledTileId && (
              <button
                type="button"
                onClick={handleOpenEditLastTile}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400/15 border border-amber-400/50 text-amber-200 hover:bg-amber-400/25 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Sửa kết quả ô vừa chấm</span>
              </button>
            )}
          </div>

          {/* 3D / 2D Stage + Crisp Semantic 3x3 Point Board */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            {/* Interactive 3x3 Semantic Tile Board (dominant focal anchor for classroom readability) */}
            <div className="xl:col-span-7 rounded-xl bg-slate-900/85 border border-slate-800 p-3.5 sm:p-4 flex flex-col justify-between gap-3">
              {/* 3 Topic Column Headers */}
              <div className="grid grid-cols-3 gap-2.5">
                {matchState.topicTitles.map((topic, colIdx) => (
                  <div
                    key={colIdx}
                    className="rounded-lg bg-[#0D2140] border border-teal-500/35 px-2.5 py-2.5 text-center flex items-center justify-center min-h-[54px]"
                  >
                    <span className="text-xs sm:text-sm font-extrabold text-teal-200 leading-snug">
                      {topic}
                    </span>
                  </div>
                ))}
              </div>

              {/* 3 Point Rows (10, 20, 30) x 3 Topic Columns */}
              <div className="space-y-2.5">
                {KING_POINT_TIERS.map((pts, rowIdx) => (
                  <div key={pts} className="grid grid-cols-3 gap-2.5">
                    {[0, 1, 2].map((colIdx) => {
                      const tile = matchState.tiles.find(
                        (t) => t.colIndex === colIdx && t.rowIndex === rowIdx
                      );
                      if (!tile) return null;
                      const isPlayed = tile.status === 'played';
                      const isPlaying = tile.status === 'playing';
                      return (
                        <button
                          key={tile.tileId}
                          type="button"
                          onClick={() => handleOpenTile(tile.tileId)}
                          className={`group relative rounded-xl p-3 sm:p-4 min-h-[82px] sm:min-h-[96px] border flex flex-col items-center justify-center gap-1 transition-transform ${
                            isPlaying
                              ? 'bg-amber-400 text-slate-950 border-amber-200 scale-[1.02]'
                              : isPlayed
                                ? 'bg-slate-950/70 text-slate-500 border-slate-800 cursor-not-allowed'
                                : 'bg-[#0C2944] hover:bg-[#11375A] text-white border-teal-400/45 hover:border-amber-300 active:scale-[0.98]'
                          }`}
                          aria-label={`${tile.topicTitle} ${tile.points} điểm — ${tileStatusLabel(tile.status)}`}
                        >
                          <span
                            className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${
                              isPlaying
                                ? 'text-slate-950'
                                : isPlayed
                                  ? 'text-slate-600 line-through'
                                  : 'text-amber-300'
                            }`}
                          >
                            {tile.points}
                          </span>
                          <span
                            className={`text-[11px] sm:text-xs font-semibold ${
                              isPlaying
                                ? 'text-slate-900'
                                : isPlayed
                                  ? 'text-slate-500'
                                  : 'text-teal-200'
                            }`}
                          >
                            {tileStatusLabel(tile.status)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 3D Arena & Rising Team Score Pillars */}
            <div className="xl:col-span-5 rounded-xl bg-slate-950/90 border border-slate-800 p-2.5 flex flex-col gap-2 min-h-[260px]">
              <div className="flex-1 min-h-[220px]">
                {use3DStage ? (
                  <KingOfScore3DScene
                    tiles={matchState.tiles}
                    teams={matchState.config.teams}
                    teamRuntime={matchState.teamRuntime}
                    activeTileId={matchState.activeTileId}
                    maxPossibleScore={matchState.maxPossibleScore}
                    isQuestionOpen={false}
                    isFinished={false}
                    scorePulseNonce={scorePulseNonce}
                    skipAnimationNonce={skipAnimationNonce}
                    reducedMotion={reducedMotion}
                    interactiveBoard={true}
                    onSelectTile={handleOpenTile}
                    onWebglFallback={() => setUse3DStage(false)}
                  />
                ) : (
                  <KingOfScore2DStage
                    tiles={matchState.tiles}
                    teams={matchState.config.teams}
                    teamRuntime={matchState.teamRuntime}
                    activeTileId={matchState.activeTileId}
                    maxPossibleScore={matchState.maxPossibleScore}
                    isQuestionOpen={false}
                    isFinished={false}
                    scorePulseNonce={scorePulseNonce}
                    skipAnimationNonce={skipAnimationNonce}
                    reducedMotion={reducedMotion}
                    interactiveBoard={true}
                    onSelectTile={handleOpenTile}
                  />
                )}
              </div>
              <div className="text-[11px] text-slate-400 text-center">
                Bấm trực tiếp ô trên bảng chữ hoặc khối 3D · Cột điểm tự nâng theo tổng điểm từng đội
              </div>
            </div>
          </div>

          {/* Stable Team Scoreboard Cards (Numeric score beside columns, fixed team order) */}
          <div
            className={`grid gap-2.5 ${
              matchState.config.teams.length <= 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : matchState.config.teams.length === 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
            }`}
          >
            {matchState.config.teams.map((team) => {
              const rt = matchState.teamRuntime[team.id];
              const st = standingByTeamId.get(team.id);
              const palette = KING_TEAM_PALETTES[team.paletteIndex % KING_TEAM_PALETTES.length];
              const isCurrentPicker =
                matchState.config.mode === 'team' && pickerTeam.id === team.id;

              return (
                <div
                  key={team.id}
                  className={`rounded-xl p-3 border bg-slate-900/90 flex items-center justify-between gap-2 ${
                    isCurrentPicker ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: palette.hex }}
                      />
                      <span className="text-sm font-bold text-white truncate">{team.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {matchState.config.mode === 'team' && st ? `${st.rankLabel} · ` : ''}
                      Đúng {rt?.correctCount ?? 0}/{playedCount}
                      {isCurrentPicker ? ' · Chọn ô' : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-amber-300">
                      {rt?.totalScore ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-400">điểm</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================================================================== */
        /* ACTIVE QUESTION STAGE — PRIORITIZES READING AREA & CLEAR GRADING   */
        /* ================================================================== */
        <div className="space-y-4">
          {/* Question Context Bar & Timer */}
          <div className="rounded-xl bg-slate-900/95 border border-amber-400/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="font-extrabold text-amber-300 font-mono">
                Ô {activeTile.points} ĐIỂM
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-bold text-teal-200">{activeTile.topicTitle}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">{activeTile.question.sourceBadge}</span>
              {matchState.config.mode === 'team' && (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-200">
                    Đội chọn ô: <strong className="text-white">{pickerTeam.name}</strong>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {matchState.config.timerEnabled ? (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5">
                  <Clock
                    className={`w-4 h-4 ${
                      remainingSeconds <= 5 && matchState.phase === 'thinking'
                        ? 'text-rose-400'
                        : 'text-amber-300'
                    }`}
                  />
                  <span className="font-mono tabular-nums text-base font-extrabold text-white">
                    {remainingSeconds}s
                  </span>
                  {matchState.phase === 'thinking' && (
                    <button
                      type="button"
                      onClick={() => setTimerPaused((p) => !p)}
                      className="ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-200 flex items-center gap-1"
                    >
                      {timerPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      <span>{timerPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-xs font-semibold text-slate-400">Không giới hạn giờ</span>
              )}

              <button
                type="button"
                onClick={() => handleSpeakText(activeTile.question.stem)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-700 text-teal-200 hover:border-teal-400 flex items-center gap-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Đọc đề</span>
              </button>

              <button
                type="button"
                onClick={() => setZoomFormulaText(activeTile.question.stem)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-700 text-slate-200 hover:border-amber-400 flex items-center gap-1"
                title="Phóng to đề bài & công thức"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Phóng to</span>
              </button>
            </div>
          </div>

          {/* Malformed LaTeX diagnostic notice (keeps game playable) */}
          {activeMathDiagnostics.length > 0 && (
            <div className="rounded-lg bg-amber-950/60 border border-amber-400/50 px-3.5 py-2.5 text-xs text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Phát hiện công thức lỗi cú pháp — đang hiển thị dạng chữ để tiếp tục chơi:</span>
              </div>
              {activeMathDiagnostics.map((d, i) => (
                <div key={i} className="font-mono text-[11px] text-amber-100/90">
                  • {d.where} (đoạn #{d.segmentIndex}, ký tự {d.startChar}): {d.rawExpression}
                </div>
              ))}
            </div>
          )}

          {/* Main High-Legibility Question Panel */}
          <div className="rounded-2xl bg-[#0D1E3A] border border-teal-400/35 p-5 sm:p-7 space-y-5">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-relaxed overflow-x-auto">
              <MathView content={activeTile.question.stem} block />
            </div>

            {activeTile.question.image && (
              <div className="max-w-md mx-auto">
                <img
                  src={activeTile.question.image}
                  alt="Hình minh họa câu hỏi"
                  referrerPolicy="no-referrer"
                  className="w-full rounded-xl border border-slate-700 object-contain max-h-56 bg-white/5"
                />
              </div>
            )}

            {/* Options Grid (shown when enabled or in solo mode) */}
            {activeTile.question.options &&
              activeTile.question.options.length > 0 &&
              (matchState.config.showOptionsInTeamMode || matchState.config.mode === 'solo') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {activeTile.question.options.map((opt) => {
                    const isCorrectOpt =
                      matchState.answerRevealed &&
                      activeTile.question.correctOptionId === opt.id;
                    const soloSelected =
                      matchState.config.mode === 'solo' &&
                      matchState.draftSelectedOptions[matchState.config.teams[0].id] === opt.id;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={
                          matchState.config.mode !== 'solo' || matchState.phase === 'settled'
                        }
                        onClick={() => {
                          if (matchState.config.mode !== 'solo' || matchState.phase === 'settled') {
                            return;
                          }
                          setMatchState((cur) => {
                            if (!cur) return cur;
                            const withChoice = setTeamDraftOptionChoice(
                              cur,
                              cur.config.teams[0].id,
                              opt.id
                            );
                            return stopAnsweringAndBeginGrading(withChoice);
                          });
                        }}
                        className={`text-left rounded-xl px-4 py-3.5 border flex items-center gap-3 transition-colors overflow-x-auto ${
                          isCorrectOpt
                            ? 'bg-emerald-500/20 border-emerald-400 text-white'
                            : soloSelected
                              ? 'bg-amber-400/20 border-amber-400 text-white'
                              : 'bg-slate-950/70 border-slate-700/80 text-slate-100 hover:border-teal-400/60'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg font-mono font-extrabold text-sm flex items-center justify-center shrink-0 ${
                            isCorrectOpt
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-slate-800 text-amber-300'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="text-base sm:text-lg font-semibold">
                          <MathView content={opt.text} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

            {/* Official Answer & Short Explanation (ONLY shown after reveal or settlement) */}
            {matchState.answerRevealed && (
              <div className="rounded-xl bg-emerald-950/45 border border-emerald-400/45 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm sm:text-base font-bold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>
                      Đáp án chính thức:{' '}
                      <span className="text-white">
                        <MathView content={activeTile.question.officialAnswerText} />
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setZoomFormulaText(activeTile.question.explanation)}
                    className="text-xs font-semibold text-teal-200 hover:text-white flex items-center gap-1"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Phóng to lời giải</span>
                  </button>
                </div>
                <div className="text-sm sm:text-base text-slate-100 leading-relaxed overflow-x-auto">
                  <strong className="text-teal-200">Lời giải ngắn: </strong>
                  <MathView content={activeTile.question.explanation} block />
                </div>
              </div>
            )}
          </div>

          {/* Step 3 Action Bar: Stop Answering -> Grading */}
          {matchState.phase === 'thinking' && (
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-slate-300">
                Các đội ghi đáp án vào bảng con, giấy hoặc chọn thẻ đáp án. Bấm{' '}
                <strong className="text-white">Dừng trả lời</strong> khi lớp đã chốt.
              </div>
              <button
                type="button"
                onClick={handleStopAnswering}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center gap-2 whitespace-nowrap"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Dừng trả lời → Chấm điểm</span>
              </button>
            </div>
          )}

          {/* Step 4 & 5: Grading Panel (All teams in STABLE order, Chưa chấm distinct) */}
          {(matchState.phase === 'grading' || matchState.phase === 'settled') && (
            <div className="rounded-xl bg-slate-900/95 border border-slate-800 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {matchState.phase === 'settled'
                      ? `Đã xác nhận chấm ô ${activeTile.points} điểm`
                      : `Chấm kết quả từng đội · Giá trị ô: +${activeTile.points} điểm`}
                  </h3>
                  {timerExpired && matchState.phase === 'grading' && (
                    <p className="text-xs text-amber-300 mt-0.5">
                      Đã hết thời gian suy nghĩ — giáo viên vẫn chấm bình thường các đáp án đã viết trước hạn.
                    </p>
                  )}
                </div>

                {matchState.phase === 'grading' && !matchState.answerRevealed && (
                  <button
                    type="button"
                    onClick={handleRevealAnswer}
                    className="px-3.5 py-2 rounded-lg bg-teal-500/20 border border-teal-400/60 text-teal-200 hover:bg-teal-500/30 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Công bố đáp án & lời giải</span>
                  </button>
                )}
              </div>

              {/* Stable-Order Team Grading Grid */}
              <div
                className={`grid gap-3 ${
                  matchState.config.teams.length === 1
                    ? 'grid-cols-1 max-w-xl'
                    : matchState.config.teams.length === 2
                      ? 'grid-cols-1 md:grid-cols-2'
                      : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {matchState.config.teams.map((team) => {
                  const palette = KING_TEAM_PALETTES[team.paletteIndex % KING_TEAM_PALETTES.length];
                  const verdict = matchState.draftVerdicts[team.id] ?? 'ungraded';
                  const delta = previewPoints[team.id] ?? 0;
                  const currentTotal = matchState.teamRuntime[team.id]?.totalScore ?? 0;
                  const selectedOptId = matchState.draftSelectedOptions[team.id] || '';
                  const isLocked = matchState.phase === 'settled';

                  return (
                    <div
                      key={team.id}
                      className={`rounded-xl p-3.5 border space-y-2.5 ${
                        verdict === 'correct'
                          ? 'bg-emerald-950/35 border-emerald-500/50'
                          : verdict === 'incorrect'
                            ? 'bg-rose-950/30 border-rose-500/40'
                            : verdict === 'no_answer'
                              ? 'bg-slate-950/80 border-slate-700'
                              : 'bg-slate-950/90 border-amber-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: palette.hex }}
                          />
                          <span className="text-sm font-bold text-white truncate">{team.name}</span>
                        </div>
                        <div className="text-right shrink-0 font-mono tabular-nums">
                          <span className="text-xs text-slate-400">
                            {isLocked ? 'Tổng: ' : 'Hiện có: '}
                            <strong className="text-white">{currentTotal}</strong>
                          </span>
                          <span
                            className={`ml-2 text-xs font-extrabold ${
                              delta > 0 ? 'text-emerald-300' : 'text-slate-400'
                            }`}
                          >
                            {isLocked ? `(+${delta})` : `Dự kiến +${delta}`}
                          </span>
                        </div>
                      </div>

                      {/* Optional quick option entry for MCQ questions */}
                      {!isLocked &&
                        activeTile.question.options &&
                        activeTile.question.options.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-400 shrink-0">Đáp án đội:</span>
                            {activeTile.question.options.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setMatchState((cur) =>
                                    cur ? setTeamDraftOptionChoice(cur, team.id, opt.id) : cur
                                  )
                                }
                                className={`px-2 py-1 rounded font-mono font-bold transition-colors ${
                                  selectedOptId === opt.id
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}

                      {/* Explicit Verdict Buttons */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { key: 'correct', label: 'Đúng', activeClass: 'bg-emerald-500 text-slate-950 border-emerald-400' },
                            { key: 'incorrect', label: 'Chưa đúng', activeClass: 'bg-rose-500 text-white border-rose-400' },
                            { key: 'no_answer', label: 'Không trả lời', activeClass: 'bg-slate-600 text-white border-slate-500' },
                          ] as const
                        ).map((btn) => {
                          const isSelected = verdict === btn.key;
                          return (
                            <button
                              key={btn.key}
                              type="button"
                              disabled={isLocked}
                              onClick={() =>
                                setMatchState((cur) =>
                                  cur ? setTeamDraftVerdict(cur, team.id, btn.key) : cur
                                )
                              }
                              className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ${
                                isSelected
                                  ? btn.activeClass
                                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 disabled:opacity-60'
                              }`}
                            >
                              {btn.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={
                            verdict === 'ungraded'
                              ? 'text-amber-300 font-semibold'
                              : 'text-slate-400'
                          }
                        >
                          Trạng thái: {verdictLabel(verdict)}
                        </span>
                        {!isLocked && (
                          <input
                            type="text"
                            value={matchState.draftAnswerNotes[team.id] || ''}
                            onChange={(e) =>
                              setMatchState((cur) =>
                                cur ? setTeamDraftAnswerNote(cur, team.id, e.target.value) : cur
                              )
                            }
                            placeholder="Ghi chú đáp án (tuỳ chọn)"
                            className="w-40 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-teal-500"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step 6 Commit OR Return-to-Board Controls */}
              {matchState.phase === 'grading' ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-300">
                    {allGraded ? (
                      <span className="text-emerald-300 font-semibold">
                        Đã chấm đủ tất cả đội — sẵn sàng xác nhận cộng điểm và khóa ô.
                      </span>
                    ) : (
                      <span className="text-amber-300 font-semibold">
                        Cần chấm đủ tất cả đội (không còn trạng thái “Chưa chấm”) mới có thể xác nhận.
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!allGraded}
                    onClick={handleConfirmSettlement}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    <Check className="w-4 h-4" />
                    <span>Xác nhận chấm ô & cộng điểm</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-300">
                      Ô đã khóa điểm. Giáo viên giải thích xong có thể quay về bảng chọn ô.
                    </span>
                    {matchState.canEditLastTile && (
                      <button
                        type="button"
                        onClick={handleOpenEditLastTile}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400/15 border border-amber-400/50 text-amber-200 hover:bg-amber-400/25 flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa kết quả ô vừa chấm</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleReturnToBoard}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {matchState.tiles.every((t) => t.status === 'played')
                        ? 'Xem tổng kết trận đấu'
                        : 'Quay về bảng chọn ô'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT LAST SETTLED TILE                                        */}
      {/* ==================================================================== */}
      {editingLastTile && matchState.lastSettledTileId && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#0B182F] border border-amber-400/50 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Sửa kết quả ô vừa chấm</h3>
                <p className="text-xs text-slate-400">
                  Hệ thống tự tính lại toàn bộ điểm từ lịch sử và giữ nguyên quyền chọn ô hiện tại.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLastTile(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto">
              {matchState.config.teams.map((team) => {
                const v = editVerdictsDraft[team.id] ?? 'no_answer';
                const palette = KING_TEAM_PALETTES[team.paletteIndex % KING_TEAM_PALETTES.length];
                return (
                  <div
                    key={team.id}
                    className="rounded-xl bg-slate-900 border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: palette.hex }}
                      />
                      <span className="text-sm font-bold text-white">{team.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          { key: 'correct', label: 'Đúng' },
                          { key: 'incorrect', label: 'Chưa đúng' },
                          { key: 'no_answer', label: 'Không trả lời' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() =>
                            setEditVerdictsDraft((prev) => ({ ...prev, [team.id]: opt.key }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            v === opt.key
                              ? opt.key === 'correct'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : opt.key === 'incorrect'
                                  ? 'bg-rose-500 text-white border-rose-400'
                                  : 'bg-slate-600 text-white border-slate-500'
                              : 'bg-slate-950 border-slate-700 text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingLastTile(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditLastTile}
                className="px-4 py-2 rounded-lg text-xs font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300"
              >
                Lưu chỉnh sửa & tính lại điểm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: STANDINGS VIEW (Never disrupts stable team grading cards!)    */}
      {/* ==================================================================== */}
      {showStandingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#0B182F] border border-teal-400/40 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>Bảng xếp hạng hiện tại ({playedCount}/9 ô)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowStandingsModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {standings.map((row) => {
                const palette = KING_TEAM_PALETTES[row.paletteIndex % KING_TEAM_PALETTES.length];
                return (
                  <div
                    key={row.teamId}
                    className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-extrabold text-amber-300 whitespace-nowrap">
                        {row.rankLabel}
                      </span>
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: palette.hex }}
                      />
                      <span className="text-sm font-bold text-white truncate">{row.name}</span>
                    </div>
                    <div className="font-mono tabular-nums text-right">
                      <span className="text-lg font-extrabold text-white">{row.totalScore}</span>
                      <span className="text-xs text-slate-400 ml-1">đ ({row.correctCount} đúng)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: REVIEW PLAYED TILES SOLUTIONS (Read-only, never re-scores)    */}
      {/* ==================================================================== */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#0B182F] border border-teal-400/40 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Xem lại lời giải các ô đã chơi</h3>
                <p className="text-xs text-slate-400">
                  Chỉ đọc đề và lời giải — không mở lại ô để ghi điểm.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {matchState.settledHistory
                .filter((r) => !reviewFocusTileId || r.tileId === reviewFocusTileId)
                .map((rec, idx) => (
                  <div
                    key={rec.tileId}
                    className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2"
                  >
                    <div className="text-xs font-semibold text-amber-300">
                      Ô #{idx + 1} · {rec.topicTitle} · {rec.points} điểm
                    </div>
                    <div className="text-base font-bold text-white overflow-x-auto">
                      <MathView content={rec.questionStem} block />
                    </div>
                    <div className="text-sm text-emerald-300">
                      <strong>Đáp án:</strong> <MathView content={rec.officialAnswerText} />
                    </div>
                    <div className="text-sm text-slate-200 overflow-x-auto">
                      <strong>Lời giải:</strong> <MathView content={rec.explanation} block />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: FORMULA ZOOM FOR PROJECTOR READABILITY                        */}
      {/* ==================================================================== */}
      {zoomFormulaText && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setZoomFormulaText(null)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-[#0D1E3A] border border-amber-400/50 p-6 sm:p-10 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <span className="text-sm font-bold text-amber-300">Phóng to công thức trình chiếu</span>
              <button
                type="button"
                onClick={() => setZoomFormulaText(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-relaxed overflow-x-auto py-4">
              <MathView content={zoomFormulaText} block />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KingOfScore3DGame;
