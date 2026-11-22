import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Crown,
  Eye,
  FastForward,
  HelpCircle,
  KeyRound,
  Keyboard,
  Lightbulb,
  Lock,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trophy,
  Unlock,
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
import imgC07Cover from '../../../assets/images/game_c07_rescue_princess_3d_1795334575679.jpg';
import {
  C07GameState,
  C07GraphicsQuality,
  C07ParticipationMode,
  C07QuestionSource,
  C07SetupConfig,
  C07ZoneId,
  C07_FINAL_GATE_POINTS,
  C07_MAX_TOTAL_POINTS,
  C07_SAMPLE_BADGE,
  C07_SAMPLE_FINAL_GATE_QUESTION,
  C07_ZONE_COUNT,
  C07_ZONE_POINTS,
  C07_ZONE_TEMPLATES,
  advanceInsideC07Zone,
  attemptOpenC07FinalGate,
  clearC07Session,
  computeC07Summary,
  createC07SetupState,
  createDefaultC07SetupConfig,
  enterC07Zone,
  finishC07ToSummary,
  getC07ActiveZone,
  getC07KeysCollectedCount,
  loadC07Session,
  markC07ZoneSolutionViewed,
  pickNextC07Student,
  returnToC07CastleMap,
  revealC07Hint,
  saveC07Session,
  skipC07RevealAnimation,
  startC07Rescue,
  submitC07FinalGateAnswer,
  submitC07TeamWhiteboard,
  submitC07ZoneChallenge,
} from './rescuePrincess3dEngine';
import { RescuePrincess3DScene } from './RescuePrincess3DScene';

export interface RescuePrincess3DGameProps {
  classes: ClassRoom[];
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const DEFAULT_TEAM_LABELS = [
  'Đội Hoàng Kim',
  'Đội Lam Ngọc',
  'Đội Phượng Hoàng',
  'Đội Pha Lê',
  'Đội Hộ Vệ',
  'Đội Tinh Tú',
];

function stripMathForSpeech(input: string): string {
  return input
    .replace(/\\\(|\\\)/g, ' ')
    .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]*)\}/g, 'căn bậc hai của $1')
    .replace(/\\times/g, ' nhân ')
    .replace(/\^\\circ/g, ' độ')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Interactive mathematical diagram for 4x6 rectangle:
 * Shows edge lengths 4 and 6; on explanation/reveal highlights each row/column factor (4 x 6 = 24 unit squares).
 */
const Rectangle4x6Diagram: React.FC<{ showFactorsGrid: boolean }> = ({ showFactorsGrid }) => {
  const cols = 6;
  const rows = 4;
  const cell = 28;
  const ox = 44;
  const oy = 26;
  const w = cols * cell;
  const h = rows * cell;

  return (
    <div className="p-3 rounded-xl bg-slate-950/95 border border-cyan-500/35 flex flex-col sm:flex-row items-center gap-3 overflow-x-auto">
      <svg
        viewBox={`0 0 ${ox + w + 24} ${oy + h + 32}`}
        className="w-[236px] h-[168px] shrink-0"
        role="img"
        aria-label="Hình chữ nhật hai cạnh 4 và 6"
      >
        {/* Column numbers along top edge */}
        {Array.from({ length: cols }).map((_, c) => (
          <text
            key={`col_lbl_${c}`}
            x={ox + c * cell + cell / 2}
            y={oy - 8}
            textAnchor="middle"
            fontSize="11"
            fontWeight="bold"
            fill={showFactorsGrid ? '#38bdf8' : '#94a3b8'}
          >
            {showFactorsGrid ? c + 1 : c === 2 ? '6' : ''}
          </text>
        ))}

        {/* Row numbers along left edge */}
        {Array.from({ length: rows }).map((_, r) => (
          <text
            key={`row_lbl_${r}`}
            x={ox - 14}
            y={oy + r * cell + cell / 2 + 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="bold"
            fill={showFactorsGrid ? '#fbbf24' : '#94a3b8'}
          >
            {showFactorsGrid ? r + 1 : r === 1 ? '4' : ''}
          </text>
        ))}

        {/* Grid squares */}
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((__, c) => (
            <rect
              key={`sq_${r}_${c}`}
              x={ox + c * cell}
              y={oy + r * cell}
              width={cell}
              height={cell}
              fill={showFactorsGrid ? (r % 2 === 0 ? '#0ea5e930' : '#f59e0b26') : '#1e293b'}
              stroke={showFactorsGrid ? '#38bdf8' : '#64748b'}
              strokeWidth={showFactorsGrid ? '1.2' : '0.8'}
            />
          ))
        )}

        {/* Outer bold rectangle */}
        <rect
          x={ox}
          y={oy}
          width={w}
          height={h}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2.4"
        />

        {/* Edge length summaries */}
        <text
          x={ox + w / 2}
          y={oy + h + 20}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="#fbbf24"
        >
          Cạnh ngang = 6
        </text>
        <text
          x={14}
          y={oy + h / 2}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="#38bdf8"
          transform={`rotate(-90, 14, ${oy + h / 2})`}
        >
          Cạnh đứng = 4
        </text>
      </svg>

      <div className="text-xs text-slate-200 space-y-1">
        <div className="font-black text-amber-200">
          {showFactorsGrid
            ? 'Phân tích từng thừa số trên hình (4 hàng × 6 cột):'
            : 'Hình minh họa kích thước hai cạnh:'}
        </div>
        {showFactorsGrid ? (
          <p className="leading-relaxed">
            Cạnh đứng dài <strong className="text-sky-300">4 đơn vị</strong> (4 hàng), cạnh ngang dài{' '}
            <strong className="text-amber-300">6 đơn vị</strong> (6 cột) tạo thành{' '}
            <strong className="text-emerald-300">4 × 6 = 24 ô vuông đơn vị</strong>.
          </p>
        ) : (
          <p className="leading-relaxed text-slate-300">
            Quan sát hai cạnh 4 và 6 trên hình chữ nhật để tính tổng số ô vuông đơn vị bên trong.
          </p>
        )}
      </div>
    </div>
  );
};

export const RescuePrincess3DGame: React.FC<RescuePrincess3DGameProps> = ({
  classes,
  bankQuestions,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const hasUserGestureRef = useRef(false);
  const playedKeyZonesRef = useRef<Set<string>>(new Set());
  const lastSoundTurnRef = useRef<string>('');

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [isVoiceReading, setIsVoiceReading] = useState(false);
  const [voiceSnapshot, setVoiceSnapshot] = useState(() => ({
    hasVietnameseVoice: false,
    statusMessage: '',
  }));

  const [quality, setQuality] = useState<C07GraphicsQuality>('high');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showSamplePreview, setShowSamplePreview] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});
  const [focusedOptionIdx, setFocusedOptionIdx] = useState<number>(0);

  // Setup configuration state
  const [participationMode, setParticipationMode] = useState<C07ParticipationMode>('solo');
  const [questionSource, setQuestionSource] = useState<C07QuestionSource>('sample_pack');
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [whiteboardHoldMode, setWhiteboardHoldMode] = useState<boolean>(false);
  const [teamCount, setTeamCount] = useState<number>(2);
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAM_LABELS);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const [savedSession, setSavedSession] = useState<C07GameState | null>(() => {
    const loaded = loadC07Session();
    return loaded && loaded.phase !== 'setup' ? loaded : null;
  });

  const [gameState, setGameState] = useState<C07GameState>(() => createC07SetupState());

  const activeZone = useMemo(() => getC07ActiveZone(gameState), [gameState]);
  const keysEarned = useMemo(() => getC07KeysCollectedCount(gameState), [gameState]);
  const summary = useMemo(() => computeC07Summary(gameState), [gameState]);

  const activeZoneChallenge = useMemo(() => {
    if (!activeZone) return null;
    return activeZone.challenges[activeZone.activeChallengeIndex] ?? null;
  }, [activeZone]);

  const activeChallengeProgress = useMemo(() => {
    if (gameState.phase === 'final_gate_challenge' || gameState.phase === 'final_gate_revealed') {
      return gameState.finalGate;
    }
    if (gameState.phase === 'zone_challenge' || gameState.phase === 'zone_revealed') {
      return activeZoneChallenge;
    }
    return null;
  }, [gameState.phase, gameState.finalGate, activeZoneChallenge]);

  const availableBankCount = useMemo(() => {
    return bankQuestions.filter((q) => {
      if (userRole === 'student' && q.status !== 'approved') return false;
      return q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2;
    }).length;
  }, [bankQuestions, userRole]);

  const selectedClassStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const found = classes.find((c) => c.id === selectedClassId);
    if (!found || !Array.isArray(found.students)) return [];
    return found.students.slice(0, 50).map((s) => ({
      id: s.id,
      fullName: s.fullName || 'Học sinh',
    }));
  }, [classes, selectedClassId]);

  useEffect(() => {
    const sb = new EduGameSoundBank();
    const vc = new EduGameVoiceController();
    soundBankRef.current = sb;
    voiceRef.current = vc;
    const unsub = vc.subscribe((snap) => {
      setVoiceSnapshot({
        hasVietnameseVoice: snap.hasVietnameseVoice,
        statusMessage: snap.statusMessage,
      });
    });

    return () => {
      unsub();
      sb.stopAll();
      sb.dispose();
      vc.stop();
      vc.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  const markUserGesture = useCallback(() => {
    hasUserGestureRef.current = true;
    soundBankRef.current?.unlock();
  }, []);

  const handleToggleMute = useCallback(() => {
    markUserGesture();
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        soundBankRef.current?.stopAll();
        voiceRef.current?.stop();
        stopAllGlobalEduSpeech();
        setIsVoiceReading(false);
      }
      return next;
    });
  }, [markUserGesture]);

  const handleToggleVoice = useCallback(() => {
    markUserGesture();
    setVoiceEnabled((prev) => {
      const next = !prev;
      saveEduGameVoiceEnabled(next);
      if (!next) {
        voiceRef.current?.stop();
        stopAllGlobalEduSpeech();
        setIsVoiceReading(false);
      }
      return next;
    });
  }, [markUserGesture]);

  useEffect(() => {
    if (gameState.phase === 'setup') return;
    saveC07Session(gameState, Date.now());
  }, [gameState]);

  useEffect(() => {
    soundBankRef.current?.setActiveTurnToken(gameState.turnToken);
    if (lastSoundTurnRef.current !== gameState.turnToken) {
      lastSoundTurnRef.current = gameState.turnToken;
      setFocusedOptionIdx(0);
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
      setIsVoiceReading(false);
    }
  }, [gameState.turnToken]);

  // Play key awarded chime strictly ONCE per newly unlocked zone key
  useEffect(() => {
    const newlyAwardedZone = gameState.zones.find((z) => z.keyAwarded && z.keyNewlyAwarded);
    if (!newlyAwardedZone) return;
    if (playedKeyZonesRef.current.has(newlyAwardedZone.zoneId)) return;
    if (gameState.lastKeySoundZoneId === newlyAwardedZone.zoneId) {
      playedKeyZonesRef.current.add(newlyAwardedZone.zoneId);
      return;
    }
    playedKeyZonesRef.current.add(newlyAwardedZone.zoneId);
    if (!isMuted && hasUserGestureRef.current) {
      soundBankRef.current?.playPrincessKeyAwarded(isMuted, gameState.turnToken);
    }
    setGameState((prev) => ({
      ...prev,
      lastKeySoundZoneId: newlyAwardedZone.zoneId,
    }));
  }, [gameState.zones, gameState.lastKeySoundZoneId, gameState.turnToken, isMuted]);

  const handleSpeakActiveQuestion = useCallback(() => {
    markUserGesture();
    if (!activeChallengeProgress || isMuted || !voiceEnabled || !voiceRef.current) return;
    const text = stripMathForSpeech(activeChallengeProgress.question.stem);
    if (!text) return;
    setIsVoiceReading(true);
    voiceRef.current
      .replayText({ text, isMuted, voiceEnabled })
      .finally(() => setIsVoiceReading(false));
  }, [activeChallengeProgress, isMuted, voiceEnabled, markUserGesture]);

  const buildCurrentSetupConfig = useCallback((): C07SetupConfig => {
    return createDefaultC07SetupConfig({
      participationMode,
      questionSource,
      shuffleOptions,
      whiteboardHoldMode,
      teamCount,
      teamNames,
      classStudents: selectedClassStudents,
      selectedClassId,
    });
  }, [
    participationMode,
    questionSource,
    shuffleOptions,
    whiteboardHoldMode,
    teamCount,
    teamNames,
    selectedClassStudents,
    selectedClassId,
  ]);

  const handleStartRescue = useCallback(() => {
    markUserGesture();
    setSetupError(null);
    playedKeyZonesRef.current = new Set();
    const res = startC07Rescue({
      config: buildCurrentSetupConfig(),
      bankQuestions,
      userRole,
      nowMs: Date.now(),
    });
    if (!res.ok || !res.state) {
      setSetupError(res.error || 'Không thể khởi tạo Lâu đài Giải cứu.');
      return;
    }
    setSavedSession(null);
    setGameState(res.state);
    if (!isMuted) {
      soundBankRef.current?.playPrincessEnterZone(isMuted, res.state.turnToken);
    }
  }, [markUserGesture, buildCurrentSetupConfig, bankQuestions, userRole, isMuted]);

  const handleResumeSavedSession = useCallback(() => {
    markUserGesture();
    if (!savedSession) return;
    const restoredSet = new Set<string>();
    savedSession.zones.forEach((z) => {
      if (z.keyAwarded) restoredSet.add(z.zoneId);
    });
    playedKeyZonesRef.current = restoredSet;
    setGameState({
      ...savedSession,
      zones: savedSession.zones.map((z) => ({ ...z, keyNewlyAwarded: false })) as [
        (typeof savedSession.zones)[0],
        (typeof savedSession.zones)[1],
        (typeof savedSession.zones)[2],
      ],
    });
    setSavedSession(null);
  }, [markUserGesture, savedSession]);

  const handleDiscardSavedSession = useCallback(() => {
    clearC07Session();
    setSavedSession(null);
  }, []);

  const handleSelectZone = useCallback(
    (zoneId: C07ZoneId) => {
      markUserGesture();
      setGameState((prev) => {
        const next = enterC07Zone(prev, zoneId, Date.now());
        if (!isMuted && next.turnToken !== prev.turnToken) {
          soundBankRef.current?.playPrincessEnterZone(isMuted, next.turnToken);
        }
        return next;
      });
    },
    [markUserGesture, isMuted]
  );

  const handleSelectFinalGate = useCallback(() => {
    markUserGesture();
    setGameState((prev) => {
      const next = attemptOpenC07FinalGate(prev, Date.now());
      if (!isMuted) {
        soundBankRef.current?.playPrincessEnterZone(isMuted, next.turnToken);
      }
      return next;
    });
  }, [markUserGesture, isMuted]);

  const handleReturnToCastleMap = useCallback(() => {
    markUserGesture();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
    setIsVoiceReading(false);
    setGameState((prev) => {
      const next = returnToC07CastleMap(prev, Date.now());
      if (!isMuted) {
        soundBankRef.current?.playPrincessEnterZone(isMuted, next.turnToken);
      }
      return next;
    });
  }, [markUserGesture, isMuted]);

  const handleSelectOption = useCallback(
    (optionId: string) => {
      markUserGesture();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
      setIsVoiceReading(false);

      setGameState((prev) => {
        const useHold =
          prev.config.participationMode === 'class_teams' && prev.config.whiteboardHoldMode;
        const activeTeam = prev.teams[prev.activeTeamIndex];

        if (useHold && activeTeam) {
          return submitC07TeamWhiteboard({
            state: prev,
            teamId: activeTeam.id,
            optionId,
          });
        }

        if (prev.phase === 'zone_challenge') {
          const next = submitC07ZoneChallenge({
            state: prev,
            turnToken: prev.turnToken,
            optionId,
          });
          if (!isMuted && next !== prev) {
            soundBankRef.current?.playPrincessEnterZone(isMuted, next.turnToken);
          }
          return next;
        }
        if (prev.phase === 'final_gate_challenge') {
          const next = submitC07FinalGateAnswer({
            state: prev,
            turnToken: prev.turnToken,
            optionId,
          });
          if (!isMuted && next !== prev) {
            soundBankRef.current?.playPrincessGateRescue(
              isMuted,
              next.finalGate.pointsAwarded > 0,
              next.turnToken
            );
          }
          return next;
        }
        return prev;
      });
    },
    [markUserGesture, isMuted]
  );

  const handleTeacherOralConfirm = useCallback(
    (isCorrect: boolean) => {
      markUserGesture();
      setGameState((prev) => {
        const useHold =
          prev.config.participationMode === 'class_teams' && prev.config.whiteboardHoldMode;
        const activeTeam = prev.teams[prev.activeTeamIndex];

        if (useHold && activeTeam) {
          return submitC07TeamWhiteboard({
            state: prev,
            teamId: activeTeam.id,
            teacherConfirmCorrect: isCorrect,
          });
        }

        if (prev.phase === 'zone_challenge') {
          const next = submitC07ZoneChallenge({
            state: prev,
            turnToken: prev.turnToken,
            teacherConfirmCorrect: isCorrect,
          });
          if (!isMuted && next !== prev) {
            soundBankRef.current?.playPrincessEnterZone(isMuted, next.turnToken);
          }
          return next;
        }
        if (prev.phase === 'final_gate_challenge') {
          const next = submitC07FinalGateAnswer({
            state: prev,
            turnToken: prev.turnToken,
            teacherConfirmCorrect: isCorrect,
          });
          if (!isMuted && next !== prev) {
            soundBankRef.current?.playPrincessGateRescue(isMuted, isCorrect, next.turnToken);
          }
          return next;
        }
        return prev;
      });
    },
    [markUserGesture, isMuted]
  );

  const handleCommitWhiteboardHold = useCallback(() => {
    markUserGesture();
    setGameState((prev) => {
      if (prev.phase === 'zone_challenge') {
        const next = submitC07ZoneChallenge({
          state: prev,
          turnToken: prev.turnToken,
          commitHeldWhiteboard: true,
        });
        if (!isMuted && next !== prev) {
          soundBankRef.current?.playPrincessEnterZone(isMuted, next.turnToken);
        }
        return next;
      }
      if (prev.phase === 'final_gate_challenge') {
        const next = submitC07FinalGateAnswer({
          state: prev,
          turnToken: prev.turnToken,
          commitHeldWhiteboard: true,
        });
        if (!isMuted && next !== prev) {
          soundBankRef.current?.playPrincessGateRescue(
            isMuted,
            next.finalGate.pointsAwarded > 0,
            next.turnToken
          );
        }
        return next;
      }
      return prev;
    });
  }, [markUserGesture, isMuted]);

  const handleSkipChallenge = useCallback(() => {
    markUserGesture();
    setGameState((prev) => {
      if (prev.phase === 'zone_challenge') {
        return submitC07ZoneChallenge({
          state: prev,
          turnToken: prev.turnToken,
          skip: true,
        });
      }
      if (prev.phase === 'final_gate_challenge') {
        const next = submitC07FinalGateAnswer({
          state: prev,
          turnToken: prev.turnToken,
          skip: true,
        });
        if (!isMuted && next !== prev) {
          soundBankRef.current?.playPrincessGateRescue(isMuted, false, next.turnToken);
        }
        return next;
      }
      return prev;
    });
  }, [markUserGesture, isMuted]);

  const handleRevealHint = useCallback(() => {
    markUserGesture();
    setGameState((prev) => revealC07Hint(prev));
  }, [markUserGesture]);

  const handleMarkSolutionViewed = useCallback(() => {
    markUserGesture();
    setGameState((prev) => markC07ZoneSolutionViewed(prev));
  }, [markUserGesture]);

  const handleAdvanceZone = useCallback(() => {
    markUserGesture();
    setGameState((prev) => advanceInsideC07Zone(prev, Date.now()));
  }, [markUserGesture]);

  const handleSkipRevealAnimation = useCallback(() => {
    markUserGesture();
    setGameState((prev) => skipC07RevealAnimation(prev));
  }, [markUserGesture]);

  const handleSwitchTeam = useCallback((idx: number) => {
    setGameState((prev) => ({
      ...prev,
      activeTeamIndex: idx,
    }));
  }, []);

  const handlePickNextStudent = useCallback(() => {
    markUserGesture();
    setGameState((prev) => pickNextC07Student(prev));
  }, [markUserGesture]);

  const handleGoToSummary = useCallback(() => {
    markUserGesture();
    setGameState((prev) => finishC07ToSummary(prev));
  }, [markUserGesture]);

  const handleRestartSameConfig = useCallback(() => {
    markUserGesture();
    playedKeyZonesRef.current = new Set();
    const res = startC07Rescue({
      config: gameState.config,
      bankQuestions,
      userRole,
      nowMs: Date.now(),
    });
    if (res.ok && res.state) {
      setGameState(res.state);
    }
  }, [markUserGesture, gameState.config, bankQuestions, userRole]);

  const handleBackToSetup = useCallback(() => {
    clearC07Session();
    playedKeyZonesRef.current = new Set();
    setGameState(createC07SetupState(buildCurrentSetupConfig()));
  }, [buildCurrentSetupConfig]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      const key = e.key.toLowerCase();
      if (gameState.phase === 'zone_challenge' || gameState.phase === 'final_gate_challenge') {
        const opts = activeChallengeProgress?.question.options || [];
        if (key === '1' || key === 'a') {
          if (opts[0]) handleSelectOption(opts[0].optionId);
          return;
        }
        if (key === '2' || key === 'b') {
          if (opts[1]) handleSelectOption(opts[1].optionId);
          return;
        }
        if (key === '3' || key === 'c') {
          if (opts[2]) handleSelectOption(opts[2].optionId);
          return;
        }
        if (key === '4' || key === 'd') {
          if (opts[3]) handleSelectOption(opts[3].optionId);
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          if (opts.length > 0) setFocusedOptionIdx((i) => (i + 1) % opts.length);
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          if (opts.length > 0) setFocusedOptionIdx((i) => (i - 1 + opts.length) % opts.length);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (opts[focusedOptionIdx]) handleSelectOption(opts[focusedOptionIdx].optionId);
          return;
        }
        if (key === 'h') {
          handleRevealHint();
          return;
        }
        if (key === 's') {
          handleSkipChallenge();
          return;
        }
        if (key === 'm' || e.key === 'Escape') {
          if (gameState.phase === 'zone_challenge') handleReturnToCastleMap();
        }
      } else if (gameState.phase === 'zone_revealed') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAdvanceZone();
        } else if (key === 'm' || e.key === 'Escape') {
          handleReturnToCastleMap();
        }
      } else if (gameState.phase === 'final_gate_revealed') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleGoToSummary();
        }
      } else if (gameState.phase === 'final_gate_locked') {
        if (key === 'm' || e.key === 'Escape') {
          handleReturnToCastleMap();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState.phase,
    activeChallengeProgress,
    focusedOptionIdx,
    handleSelectOption,
    handleRevealHint,
    handleSkipChallenge,
    handleReturnToCastleMap,
    handleAdvanceZone,
    handleGoToSummary,
  ]);

  const projectorStatusBadge = useMemo(() => {
    if (gameState.phase === 'zone_revealed' || gameState.phase === 'final_gate_revealed') {
      return { text: 'Đã công bố', cls: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200' };
    }
    if (activeChallengeProgress?.status === 'submitted') {
      return { text: 'Đã nộp (Chờ chốt)', cls: 'bg-amber-500/20 border-amber-400/60 text-amber-200' };
    }
    if (gameState.phase === 'zone_challenge' || gameState.phase === 'final_gate_challenge') {
      return { text: 'Đang làm', cls: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200' };
    }
    return { text: 'Chưa làm', cls: 'bg-slate-800 border-slate-600 text-slate-300' };
  }, [gameState.phase, activeChallengeProgress]);

  const useHoldWhiteboard =
    gameState.config.participationMode === 'class_teams' && gameState.config.whiteboardHoldMode;
  const heldCount = activeChallengeProgress
    ? Object.keys(activeChallengeProgress.teamSubmissions).length
    : 0;

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-full overflow-y-auto' : 'rounded-2xl border border-amber-400/25'
      } bg-[#050d1e] text-slate-100 p-3 sm:p-4 space-y-3`}
    >
      {/* Top Unified Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundBankRef.current?.stopAll();
              voiceRef.current?.stop();
              stopAllGlobalEduSpeech();
              onBackToLibrary();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về thư viện</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[11px] font-black">
              C07
            </span>
            <h2 className="text-sm sm:text-base font-black text-white">
              Giải cứu công chúa 3D
            </h2>
            {gameState.phase !== 'setup' && (
              <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[11px] font-bold text-sky-200">
                {gameState.config.questionSource === 'sample_pack'
                  ? C07_SAMPLE_BADGE
                  : 'Ngân hàng Smart EDU'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {gameState.phase !== 'setup' && (
            <>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/50 text-xs font-black text-amber-200 tabular-nums">
                {gameState.score} / {C07_MAX_TOTAL_POINTS} điểm
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/50 text-xs font-black text-sky-200 tabular-nums">
                {keysEarned}/{C07_ZONE_COUNT} chìa khóa
              </span>
              <span className={`px-2.5 py-1 rounded-lg border text-xs font-black ${projectorStatusBadge.cls}`}>
                {projectorStatusBadge.text}
              </span>
            </>
          )}

          <button
            type="button"
            onClick={() => setQuality((q) => (q === 'high' ? '2d' : 'high'))}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-cyan-200 cursor-pointer"
          >
            {quality === 'high' ? '3D' : '2D Nhẹ'}
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              reducedMotion
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            {reducedMotion ? 'Giảm chuyển động: BẬT' : 'Giảm chuyển động'}
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'Tắt tiếng' : 'Âm thanh'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVoice}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              voiceEnabled && !isMuted
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={voiceSnapshot.statusMessage || 'Đọc tiếng Việt (vi-VN)'}
          >
            {voiceEnabled ? 'Giọng vi-VN: BẬT' : 'Giọng đọc: TẮT'}
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        </div>
      </div>

      {/* SETUP PHASE */}
      {gameState.phase === 'setup' && (
        <div className="space-y-4">
          {savedSession && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-bold text-amber-100">
                Có hành trình Giải cứu đang lưu ({getC07KeysCollectedCount(savedSession)}/3 chìa · {savedSession.score} điểm). Tiếp tục giữ nguyên ván chơi?
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeSavedSession}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Tiếp tục hành trình
                </button>
                <button
                  type="button"
                  onClick={handleDiscardSavedSession}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Bỏ phiên cũ
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 rounded-2xl bg-[#091836] border border-amber-400/30 p-3.5 space-y-3">
              <div className="relative rounded-xl overflow-hidden aspect-video border border-amber-400/25">
                <img
                  src={imgC07Cover}
                  alt="Lâu đài Giải cứu Công chúa 3D Tây Đô Smart EDU"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-amber-400/50 text-[11px] font-black text-amber-200">
                  {C07_SAMPLE_BADGE} · 3 Khu + Cửa cuối 30đ
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                <p className="font-black text-white text-sm">
                  C07 – Giải cứu công chúa 3D · Ôn tập Phân số, Thống kê & Hình học
                </p>
                <p>
                  Vượt qua <strong className="text-amber-300">3 khu lâu đài</strong> (mỗi khu 3 thử thách, +10đ/câu) để nhận 3 Chìa khóa, mở <strong className="text-cyan-300">Cửa cuối (30đ)</strong> đưa Công chúa trở thành bạn đồng hành (tối đa <strong className="text-white">120đ</strong>).
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                  <span>Hướng dẫn luật chơi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSamplePreview(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-cyan-200 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Xem trước 10 câu Toán mẫu</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl bg-[#091836] border border-cyan-500/30 p-4 space-y-4">
              {setupError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-xs font-bold text-rose-100">
                  {setupError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-extrabold text-amber-200 uppercase tracking-wide">
                  1. Cách tổ chức (Tự luyện / Lớp 1–50 HS / Chia đội)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setParticipationMode('solo')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      participationMode === 'solo'
                        ? 'bg-sky-500/20 border-sky-300 text-white'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Tự luyện / Cá nhân</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Phân biệt rõ Tự làm, Có gợi ý hỗ trợ và Đã xem lời giải.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setParticipationMode('class_teams')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      participationMode === 'class_teams'
                        ? 'bg-sky-500/20 border-sky-300 text-white'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Lớp học 1–50 HS · Chia 2–6 đội</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Cho phép các nhóm giải trên bảng con rồi GV nhập, giữ đáp án đến lúc chốt.
                    </div>
                  </button>
                </div>
              </div>

              {participationMode === 'class_teams' && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-cyan-200">Số nhóm (2–6):</span>
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4, 5, 6].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTeamCount(cnt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black border cursor-pointer ${
                            teamCount === cnt
                              ? 'bg-amber-400 text-slate-950 border-amber-200'
                              : 'bg-slate-800 border-slate-600 text-slate-200'
                          }`}
                        >
                          {cnt} nhóm
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Array.from({ length: teamCount }).map((_, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={teamNames[idx] || ''}
                        onChange={(e) => {
                          const next = [...teamNames];
                          next[idx] = e.target.value;
                          setTeamNames(next);
                        }}
                        placeholder={`Đội ${idx + 1}`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:border-amber-400 focus:outline-none"
                      />
                    ))}
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whiteboardHoldMode}
                      onChange={(e) => setWhiteboardHoldMode(e.target.checked)}
                      className="accent-amber-400"
                    />
                    <span>Giữ đáp án bảng con từng nhóm ("Đã nộp") đến khi GV nhấn Chốt & Công bố</span>
                  </label>

                  {classes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">Danh sách lớp (1–50 HS):</span>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                      >
                        <option value="">-- Không chọn lớp (chơi ngay) --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} ({Math.min(50, cls.students?.length || 0)} HS)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-extrabold text-amber-200 uppercase tracking-wide">
                  2. Gói câu hỏi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionSource('sample_pack')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      questionSource === 'sample_pack'
                        ? 'bg-emerald-500/20 border-emerald-300 text-white'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Gói Toán mẫu C07 ({C07_SAMPLE_BADGE})</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Phân số, Thống kê, Hình học (4×6=24) & Cửa cuối 30đ · Mở ngay không cần đăng nhập.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionSource('bank')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      questionSource === 'bank'
                        ? 'bg-emerald-500/20 border-emerald-300 text-white'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Ngân hàng Smart EDU ({availableBankCount} câu)</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Lọc theo quyền tài khoản, tự động bổ sung câu mẫu nếu ngân hàng chưa đủ.
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="accent-amber-400"
                  />
                  <span>Xáo trộn phương án A–D (chấm theo optionId)</span>
                </label>

                <button
                  type="button"
                  onClick={handleStartRescue}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black shadow-lg cursor-pointer"
                >
                  Tiến vào lâu đài →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEAM / CLASS BAR */}
      {gameState.phase !== 'setup' && gameState.phase !== 'summary' && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#091836] border border-slate-700/80">
          <div className="flex flex-wrap items-center gap-2">
            {gameState.config.participationMode === 'class_teams' ? (
              gameState.teams.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSwitchTeam(idx)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-black cursor-pointer transition-colors ${
                    idx === gameState.activeTeamIndex
                      ? 'bg-amber-400/20 border-amber-300 text-amber-100'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span style={{ color: t.color }}>●</span> {t.name}: <span className="tabular-nums">{t.score}đ</span>
                </button>
              ))
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200">
                <Users className="w-3.5 h-3.5" />
                <span>Chế độ Tự luyện cá nhân · Mục tiêu 3/3 Chìa khóa</span>
              </span>
            )}

            {gameState.config.classStudents.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                <span className="text-xs font-bold text-emerald-200">
                  HS lượt này: {gameState.activeCallerStudent?.fullName || 'Chưa chọn'}
                </span>
                <button
                  type="button"
                  onClick={handlePickNextStudent}
                  className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-[11px] font-black text-emerald-100 cursor-pointer"
                >
                  Đổi HS
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleGoToSummary}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
          >
            Xem tổng kết
          </button>
        </div>
      )}

      {/* PHASE: CASTLE MAP OR LOCKED FINAL GATE NOTICE */}
      {(gameState.phase === 'castle_map' || gameState.phase === 'final_gate_locked') && (
        <div className="space-y-3">
          {gameState.phase === 'final_gate_locked' && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/60 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-200 text-xs sm:text-sm font-black">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>{gameState.lastActionNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={handleReturnToCastleMap}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Đóng thông báo
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-300">Mở ngay khu còn thiếu chìa:</span>
                {gameState.zones
                  .filter((z) => !z.keyAwarded)
                  .map((z) => (
                    <button
                      key={z.zoneId}
                      type="button"
                      onClick={() => handleSelectZone(z.zoneId)}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      {z.title}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <RescuePrincess3DScene
            zones={gameState.zones}
            activeZoneId={gameState.activeZoneId}
            phase={gameState.phase}
            finalGateOpened={gameState.finalGateOpened}
            princessRescued={gameState.princessRescued}
            quality={quality}
            reducedMotion={reducedMotion}
            onSelectZone={handleSelectZone}
            onSelectFinalGate={handleSelectFinalGate}
            onWebGLFallback={() => setQuality('2d')}
          />
        </div>
      )}

      {/* PHASE: ZONE CHALLENGE / REVEAL */}
      {(gameState.phase === 'zone_challenge' || gameState.phase === 'zone_revealed') &&
        activeZone &&
        activeZoneChallenge && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left Zone Mission & Key Criteria Card */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="rounded-xl bg-[#091836] border border-amber-400/35 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-200">{activeZone.title}</span>
                  <button
                    type="button"
                    onClick={handleReturnToCastleMap}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    ← Về lâu đài (M)
                  </button>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-[11px] space-y-1">
                  <div className="font-black text-cyan-200">
                    Nhiệm vụ hiện tại: Thử thách {activeZone.activeChallengeIndex + 1}/3 (+{C07_ZONE_POINTS}đ)
                  </div>
                  <div className="text-slate-300">
                    Tiêu chí nhận <strong className="text-amber-300">{activeZone.keyName}</strong>: hoàn thành cả 3 thử thách của khu (câu sai/bỏ qua cần xem lời giải để tiếp tục).
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {activeZone.challenges.map((ch, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border text-center text-[11px] font-black ${
                        idx === activeZone.activeChallengeIndex
                          ? 'bg-amber-400/20 border-amber-300 text-amber-100'
                          : ch.status === 'correct_independent'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                            : ch.status === 'correct_with_hint'
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      Câu {idx + 1}/3 · {ch.pointsAwarded}đ
                    </div>
                  ))}
                </div>
              </div>

              {/* 3-Key Progress Column */}
              <div className="rounded-xl bg-[#091836] border border-cyan-500/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-cyan-200">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Cột tiến độ 3 chìa khóa</span>
                  </span>
                  <span className="tabular-nums">{keysEarned}/3</span>
                </div>
                {gameState.zones.map((z) => (
                  <div
                    key={z.zoneId}
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[11px] font-bold ${
                      z.keyAwarded
                        ? 'bg-amber-400/20 border-amber-300 text-amber-100'
                        : 'bg-slate-950/80 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className="truncate">{z.keyName}</span>
                    <span>{z.keyAwarded ? 'Đã có' : 'Chưa có'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right High-Contrast Question & Reveal Area */}
            <div className="lg:col-span-7 rounded-2xl bg-[#0b1b3d] border border-cyan-400/35 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-xs font-black text-cyan-200">
                  {activeZoneChallenge.question.topicLabel} · +{C07_ZONE_POINTS}đ
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSpeakActiveQuestion}
                    disabled={isMuted || !voiceEnabled}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{isVoiceReading ? 'Đang đọc...' : 'Đọc đề'}</span>
                  </button>
                  {gameState.phase === 'zone_challenge' && (
                    <button
                      type="button"
                      onClick={handleRevealHint}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-bold text-amber-200 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Gợi ý (H)</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-700 text-base sm:text-lg font-bold text-white overflow-x-auto leading-relaxed">
                <MathView content={activeZoneChallenge.question.stem} />
              </div>

              {activeZoneChallenge.question.visualDiagram === 'rect_4x6' && (
                <Rectangle4x6Diagram showFactorsGrid={gameState.phase === 'zone_revealed'} />
              )}

              {activeZoneChallenge.question.image && (
                <div className="rounded-xl overflow-hidden border border-slate-700 max-h-48 bg-slate-950 flex justify-center">
                  <img
                    src={activeZoneChallenge.question.image}
                    alt="Minh họa câu hỏi"
                    className="max-h-48 object-contain"
                  />
                </div>
              )}

              {gameState.activeHintRevealed && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs sm:text-sm text-amber-100 overflow-x-auto">
                  <strong className="text-amber-300">Gợi ý hỗ trợ: </strong>
                  <MathView content={activeZoneChallenge.question.hintText} />
                </div>
              )}

              {useHoldWhiteboard && gameState.phase === 'zone_challenge' && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-amber-200 font-bold">
                    Chế độ Bảng con: đang chọn cho <strong className="text-white">{gameState.teams[gameState.activeTeamIndex]?.name}</strong> · Đã nộp: {heldCount}/{gameState.teams.length} đội
                  </div>
                  <button
                    type="button"
                    disabled={heldCount === 0}
                    onClick={handleCommitWhiteboardHold}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black cursor-pointer"
                  >
                    Chốt đáp án & Công bố
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeZoneChallenge.question.options.map((opt, idx) => {
                  const activeTeamId = gameState.teams[gameState.activeTeamIndex]?.id;
                  const teamPicked = activeTeamId
                    ? activeZoneChallenge.teamSubmissions[activeTeamId]?.selectedOptionId === opt.optionId
                    : false;
                  const isSelected = activeZoneChallenge.selectedOptionId === opt.optionId || teamPicked;
                  const isCorrectOpt = opt.optionId === activeZoneChallenge.question.correctOptionId;
                  const isRevealed = gameState.phase === 'zone_revealed';

                  let cls = 'bg-slate-900 border-slate-700 text-slate-100 hover:border-amber-400';
                  if (isRevealed) {
                    if (isCorrectOpt) cls = 'bg-emerald-500/25 border-emerald-400 text-emerald-100';
                    else if (isSelected && !isCorrectOpt) cls = 'bg-rose-500/25 border-rose-400 text-rose-100';
                    else cls = 'bg-slate-950/70 border-slate-800 text-slate-400';
                  } else if (isSelected && useHoldWhiteboard) {
                    cls = 'bg-amber-500/25 border-amber-400 text-amber-100';
                  } else if (idx === focusedOptionIdx) {
                    cls = 'bg-slate-800 border-amber-400 text-white ring-2 ring-amber-400/50';
                  }

                  return (
                    <button
                      key={opt.optionId}
                      type="button"
                      disabled={isRevealed}
                      onClick={() => handleSelectOption(opt.optionId)}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 overflow-x-auto ${
                        isRevealed ? 'cursor-default' : 'cursor-pointer'
                      } ${cls}`}
                    >
                      <span className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-600 flex items-center justify-center text-xs font-black shrink-0">
                        {opt.labelKey}
                      </span>
                      <div className="text-sm sm:text-base font-bold overflow-x-auto">
                        <MathView content={opt.text} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {gameState.phase === 'zone_challenge' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTeacherOralConfirm(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-xs font-black text-emerald-200 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>GV Xác nhận Đúng (+{C07_ZONE_POINTS}đ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTeacherOralConfirm(false)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/60 text-xs font-black text-rose-200 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Chưa đúng (0đ)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSkipChallenge}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Bỏ qua (S)</span>
                  </button>
                </div>
              )}

              {gameState.phase === 'zone_revealed' && (
                <div className="p-3.5 rounded-xl bg-slate-950/95 border border-emerald-400/35 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs sm:text-sm font-black text-amber-200">
                      {gameState.lastActionNotice}
                    </div>
                    {!gameState.revealAnimDone && (
                      <button
                        type="button"
                        onClick={handleSkipRevealAnimation}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        <span>Bỏ qua hoạt ảnh</span>
                      </button>
                    )}
                  </div>

                  <div className="text-xs sm:text-sm text-slate-100 leading-relaxed overflow-x-auto">
                    <strong className="text-cyan-300">Lời giải chi tiết: </strong>
                    <MathView content={activeZoneChallenge.question.explanationText} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {(activeZoneChallenge.status === 'wrong' ||
                      activeZoneChallenge.status === 'skipped') &&
                    !activeZoneChallenge.viewedSolution ? (
                      <button
                        type="button"
                        onClick={handleMarkSolutionViewed}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-xs font-black text-cyan-100 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Đã xem lời giải (giữ 0đ, mở điều kiện chìa)</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        {activeZoneChallenge.status === 'correct_independent'
                          ? 'Phân loại: Đúng tự làm (+10đ)'
                          : activeZoneChallenge.status === 'correct_with_hint'
                            ? 'Phân loại: Đúng có hỗ trợ gợi ý (+10đ)'
                            : activeZoneChallenge.viewedSolution
                              ? 'Phân loại: Đã xem lời giải (0đ)'
                              : ''}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleAdvanceZone}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black cursor-pointer"
                    >
                      {activeZone.activeChallengeIndex < 2
                        ? `Sang Thử thách ${activeZone.activeChallengeIndex + 2}/3 →`
                        : activeZone.keyAwarded
                          ? 'Về sân lâu đài (M) →'
                          : 'Hoàn thành khu & Nhận Chìa →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* PHASE: FINAL ROYAL GATE CHALLENGE / REVEAL */}
      {(gameState.phase === 'final_gate_challenge' || gameState.phase === 'final_gate_revealed') && (
        <div className="rounded-2xl bg-gradient-to-br from-[#0b1e42] via-[#091836] to-[#111827] border-2 border-amber-400/60 p-4 sm:p-5 space-y-3.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400/20 border border-amber-300/60 text-amber-300">
                <Crown className="w-5 h-5" />
              </span>
              <div>
                <div className="text-xs font-black text-amber-300 uppercase">
                  Đã đủ 3/3 Chìa khóa · Cửa Cuối Hoàng Gia
                </div>
                <h3 className="text-base font-black text-white">
                  {gameState.finalGate.question.topicLabel}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSpeakActiveQuestion}
                disabled={isMuted || !voiceEnabled}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>Đọc đề</span>
              </button>
              {gameState.phase === 'final_gate_challenge' && (
                <button
                  type="button"
                  onClick={handleRevealHint}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-bold text-amber-200 cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Gợi ý (H)</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-400/35 text-base sm:text-lg font-bold text-white overflow-x-auto leading-relaxed">
            <MathView content={gameState.finalGate.question.stem} />
          </div>

          {gameState.finalGate.question.visualDiagram === 'rect_4x6' && (
            <Rectangle4x6Diagram showFactorsGrid={gameState.phase === 'final_gate_revealed'} />
          )}

          {gameState.activeHintRevealed && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs sm:text-sm text-amber-100 overflow-x-auto">
              <strong className="text-amber-300">Gợi ý hỗ trợ: </strong>
              <MathView content={gameState.finalGate.question.hintText} />
            </div>
          )}

          {useHoldWhiteboard && gameState.phase === 'final_gate_challenge' && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-amber-200 font-bold">
                Bảng con Cửa cuối: {heldCount}/{gameState.teams.length} đội đã nộp
              </span>
              <button
                type="button"
                disabled={heldCount === 0}
                onClick={handleCommitWhiteboardHold}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black cursor-pointer"
              >
                Chốt đáp án & Công bố
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {gameState.finalGate.question.options.map((opt, idx) => {
              const isSelected = gameState.finalGate.selectedOptionId === opt.optionId;
              const isCorrectOpt = opt.optionId === gameState.finalGate.question.correctOptionId;
              const isRevealed = gameState.phase === 'final_gate_revealed';

              let cls = 'bg-slate-900 border-slate-700 text-slate-100 hover:border-amber-400';
              if (isRevealed) {
                if (isCorrectOpt) cls = 'bg-emerald-500/25 border-emerald-400 text-emerald-100';
                else if (isSelected && !isCorrectOpt) cls = 'bg-rose-500/25 border-rose-400 text-rose-100';
                else cls = 'bg-slate-950/70 border-slate-800 text-slate-400';
              } else if (idx === focusedOptionIdx) {
                cls = 'bg-slate-800 border-amber-400 text-white ring-2 ring-amber-400/50';
              }

              return (
                <button
                  key={opt.optionId}
                  type="button"
                  disabled={isRevealed}
                  onClick={() => handleSelectOption(opt.optionId)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 overflow-x-auto ${
                    isRevealed ? 'cursor-default' : 'cursor-pointer'
                  } ${cls}`}
                >
                  <span className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-600 flex items-center justify-center text-xs font-black shrink-0">
                    {opt.labelKey}
                  </span>
                  <div className="text-sm sm:text-base font-bold overflow-x-auto">
                    <MathView content={opt.text} />
                  </div>
                </button>
              );
            })}
          </div>

          {gameState.phase === 'final_gate_challenge' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTeacherOralConfirm(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-xs font-black text-emerald-200 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>GV Xác nhận Đúng (+{C07_FINAL_GATE_POINTS}đ)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTeacherOralConfirm(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/60 text-xs font-black text-rose-200 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Chưa đúng (0đ)</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleSkipChallenge}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Bỏ qua (S)</span>
              </button>
            </div>
          )}

          {gameState.phase === 'final_gate_revealed' && (
            <div className="p-4 rounded-xl bg-slate-950/95 border border-amber-400/45 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-black text-amber-200">{gameState.lastActionNotice}</div>
                {!gameState.revealAnimDone && (
                  <button
                    type="button"
                    onClick={handleSkipRevealAnimation}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Bỏ qua hoạt ảnh</span>
                  </button>
                )}
              </div>

              <div className="text-xs sm:text-sm text-slate-100 leading-relaxed overflow-x-auto">
                <strong className="text-cyan-300">Lời giải tổng hợp: </strong>
                <MathView content={gameState.finalGate.question.explanationText} />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGoToSummary}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black cursor-pointer"
                >
                  Xem tổng kết hành trình →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY SCREEN */}
      {gameState.phase === 'summary' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#0c1f45] via-[#091836] to-[#0b132b] border border-amber-400/45 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-400/20 border border-amber-300/60 text-amber-300">
                  <Trophy className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-amber-300 uppercase">
                    {gameState.princessRescued
                      ? 'Đã giải cứu thành công — Công chúa đồng hành!'
                      : 'Tổng kết hành trình Giải cứu Công chúa 3D'}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tabular-nums">
                    Tổng điểm: {summary.totalScore} / {summary.maxScore} điểm
                  </h3>
                  <div className="text-xs text-slate-300">
                    Điểm 3 khu: {summary.zoneScore}/90 · Điểm Cửa cuối: {summary.finalGateScore}/30 · Chìa khóa: {summary.keysCollected}/3
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestartSameConfig}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Chơi lại</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackToSetup}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100 cursor-pointer"
                >
                  Đổi cấu hình
                </button>
                <button
                  type="button"
                  onClick={onBackToLibrary}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Về thư viện
                </button>
              </div>
            </div>

            {/* Distinct Question Outcome Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-center">
                <div className="text-lg font-black text-emerald-200 tabular-nums">
                  {summary.independentCorrectCount}
                </div>
                <div className="text-[11px] font-bold text-emerald-100">Đúng tự làm</div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-center">
                <div className="text-lg font-black text-cyan-200 tabular-nums">
                  {summary.assistedCorrectCount}
                </div>
                <div className="text-[11px] font-bold text-cyan-100">Đúng có hỗ trợ</div>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-400/50 text-center">
                <div className="text-lg font-black text-sky-200 tabular-nums">
                  {summary.viewedSolutionCount}
                </div>
                <div className="text-[11px] font-bold text-sky-100">Đã xem lời giải (0đ)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/50 text-center">
                <div className="text-lg font-black text-rose-200 tabular-nums">
                  {summary.wrongCount + summary.skippedCount}
                </div>
                <div className="text-[11px] font-bold text-rose-100">Sai / Bỏ qua</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                <div className="text-lg font-black text-slate-200 tabular-nums">
                  {summary.unattemptedCount}
                </div>
                <div className="text-[11px] font-bold text-slate-300">Chưa làm</div>
              </div>
            </div>

            {gameState.config.participationMode === 'class_teams' && (
              <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-200">
                  <Award className="w-4 h-4" />
                  <span>Bảng điểm các đội</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[...gameState.teams]
                    .sort((a, b) => b.score - a.score)
                    .map((team, idx) => (
                      <div
                        key={team.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-between gap-2"
                      >
                        <div className="text-xs font-black text-white truncate">
                          #{idx + 1} · {team.name}
                        </div>
                        <span className="text-xs font-black text-amber-300 tabular-nums">
                          {team.score}đ
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Full 10-Challenge Review */}
            <div className="space-y-2">
              <div className="text-xs font-black text-cyan-200 uppercase">
                Xem lại toàn bộ 9 thử thách 3 khu & Câu tổng hợp Cửa cuối
              </div>
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {gameState.zones.flatMap((z) =>
                  z.challenges.map((ch, cIdx) => {
                    const key = `${z.zoneId}_${cIdx}`;
                    const open = Boolean(expandedReviewIds[key]);
                    const tag =
                      ch.status === 'correct_independent'
                        ? 'Đúng tự làm (+10đ)'
                        : ch.status === 'correct_with_hint'
                          ? 'Đúng có hỗ trợ (+10đ)'
                          : ch.status === 'wrong_viewed_solution' || ch.status === 'skipped_viewed_solution'
                            ? 'Đã xem lời giải (0đ)'
                            : ch.status === 'wrong'
                              ? 'Sai (0đ)'
                              : ch.status === 'skipped'
                                ? 'Bỏ qua (0đ)'
                                : 'Chưa làm';

                    return (
                      <div key={key} className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black text-white">
                            {z.title} · Thử thách {cIdx + 1}/3
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-amber-200">{tag}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedReviewIds((prev) => ({ ...prev, [key]: !open }))
                              }
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-cyan-200 cursor-pointer"
                            >
                              {open ? 'Ẩn lời giải' : 'Xem lời giải'}
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-200 overflow-x-auto">
                          <MathView content={ch.question.stem} />
                        </div>
                        {open && (
                          <div className="space-y-2">
                            {ch.question.visualDiagram === 'rect_4x6' && (
                              <Rectangle4x6Diagram showFactorsGrid />
                            )}
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-cyan-500/30 text-xs text-cyan-100 overflow-x-auto">
                              <MathView content={ch.question.explanationText} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/50 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-200">
                      Cửa Cuối Hoàng Gia (30 điểm)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-white">
                        {gameState.finalGate.status === 'correct_independent'
                          ? 'Đúng tự làm (+30đ)'
                          : gameState.finalGate.status === 'correct_with_hint'
                            ? 'Đúng có hỗ trợ (+30đ)'
                            : gameState.finalGate.status === 'unattempted'
                              ? 'Chưa mở'
                              : 'Chưa đúng / Bỏ qua (0đ)'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedReviewIds((prev) => ({ ...prev, fg: !prev.fg }))
                        }
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-cyan-200 cursor-pointer"
                      >
                        {expandedReviewIds.fg ? 'Ẩn lời giải' : 'Xem lời giải'}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-100 overflow-x-auto">
                    <MathView content={gameState.finalGate.question.stem} />
                  </div>
                  {expandedReviewIds.fg && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-400/40 text-xs text-amber-100 overflow-x-auto">
                      <MathView content={gameState.finalGate.question.explanationText} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-[#091836] border border-amber-400/50 p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-amber-200">
                <Crown className="w-4 h-4" />
                <span>Luật chơi C07 – Giải cứu công chúa 3D</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-slate-200 list-disc pl-5 leading-relaxed">
              <li>Lâu đài gồm <strong>3 khu thử thách</strong> và <strong>1 Cửa Cuối Hoàng Gia</strong>. Mỗi khu có 3 thử thách (+10đ/câu).</li>
              <li>Hoàn thành cả 3 thử thách trong mỗi khu (câu sai/bỏ qua cần xem lời giải để tiếp tục) sẽ mở khóa <strong>1 Chìa khóa khu</strong> trên cột tiến độ.</li>
              <li>Hệ thống ghi nhận riêng <strong>Đúng tự làm</strong>, <strong>Đúng có hỗ trợ</strong> (nếu đã bấm Gợi ý) và <strong>Đã xem lời giải</strong> (0đ).</li>
              <li>Thu thập đủ <strong>3/3 Chìa khóa</strong> sẽ mở khóa <strong>Câu tổng hợp Cửa cuối (30 điểm)</strong>. Tổng điểm tối đa là <strong>120 điểm</strong> và nhân vật Công chúa xuất hiện đồng hành trên sân khấu 3D/2D.</li>
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAMPLE PREVIEW MODAL */}
      {showSamplePreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full rounded-2xl bg-[#091836] border border-cyan-400/50 p-5 space-y-3 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-cyan-200">
                <Sparkles className="w-4 h-4" />
                <span>Xem trước 10 câu Toán mẫu C07 ({C07_SAMPLE_BADGE})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSamplePreview(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto space-y-2 pr-1 text-xs">
              {C07_ZONE_TEMPLATES.map((tpl) => (
                <div key={tpl.zoneId} className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1.5">
                  <div className="font-black text-amber-300">
                    {tpl.title} ({tpl.subtitle})
                  </div>
                  {tpl.sampleQuestions.map((q, qIdx) => (
                    <div key={q.questionId} className="text-slate-200 overflow-x-auto">
                      <strong>Thử thách {qIdx + 1}: </strong>
                      <MathView content={q.stem} />
                    </div>
                  ))}
                </div>
              ))}
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 space-y-1">
                <div className="font-black text-amber-200">Cửa Cuối Hoàng Gia (30đ)</div>
                <div className="text-slate-100 overflow-x-auto">
                  <MathView content={C07_SAMPLE_FINAL_GATE_QUESTION.stem} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RescuePrincess3DGame;
