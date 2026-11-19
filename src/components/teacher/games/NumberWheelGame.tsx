import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  RotateCw,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Timer as TimerIcon,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  Trophy,
  Award,
  EyeOff,
  History,
  RefreshCw,
  ListOrdered,
  X,
  Disc,
  Filter,
  Mic,
  MicOff,
} from 'lucide-react';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameVoiceEnabled,
  saveEduGameVoiceEnabled,
} from '../../../utils/eduGameAudioController';

export type WheelGamePhase =
  | 'IDLE'
  | 'PREPARING'
  | 'SPINNING'
  | 'SLOWING'
  | 'REVEALING'
  | 'COMPLETED';

export type WheelDisplayMode = 'ALL_NUMBERS' | 'REMAINING_ONLY';

export interface NumberedStudentItem {
  studentNumber: number; // 1..N (displayed as 01, 02, ..., 50)
  formattedNumber: string; // "01", "02", ...
  student: StudentCandidate;
  color: string;
}

const WHEEL_SLICE_PALETTE = [
  '#E11D48', // Crimson Rose
  '#2563EB', // Royal Blue
  '#D97706', // Golden Amber
  '#059669', // Emerald Green
  '#7C3AED', // Vivid Purple
  '#0284C7', // Sky Cyan
  '#EA580C', // Deep Orange
  '#4F46E5', // Indigo
  '#0D9488', // Teal
  '#DB2777', // Magenta Pink
];

export interface NumberWheelGameProps {
  availableCandidates: StudentCandidate[];
  onPick: (
    student: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string; studentNumber?: number }
  ) => void;
  isMuted: boolean;
  allCandidates?: StudentCandidate[];
  absentIds?: Set<string>;
  calledSessionIds?: Set<string>;
  antiDuplicate?: boolean;
  onToggleAntiDuplicate?: () => void;
  onResetSession?: () => void;
  classes?: ClassRoom[];
  selectedSourceKey?: string;
  onSelectSourceKey?: (key: string) => void;
  resolvedClassName?: string;
  teacherId?: string;
  teacherName?: string;
  userRole?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onToggleMute?: () => void;
  onOpenAbsentModal?: () => void;
  onOpenHistoryModal?: () => void;
  onUpdateLatestNote?: (note: string) => void;
}

/**
 * Unbiased cryptographic random integer in [0, max - 1] using rejection sampling.
 */
export function secureRandomInt(max: number): number {
  if (max <= 1) return 0;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const uint32Max = 0xffffffff;
    const limit = uint32Max - (uint32Max % max);
    const buf = new Uint32Array(1);
    let val = 0;
    do {
      window.crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return val % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Compute piecewise smooth position in [0, 1] for time progress t in [0, 1]:
 * - [0.00, 0.14]: Quadratic acceleration (PREPARING -> SPINNING)
 * - [0.14, 0.36]: High-speed cruise (SPINNING)
 * - [0.36, 1.00]: Smooth quartic deceleration (SLOWING -> exact stop)
 *
 * Ensures C1 velocity continuity across all 3 segments.
 */
function evaluateWheelProgressCurve(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  // Using a smooth S-curve with fast initial ramp and long natural gameshow deceleration:
  // p(t) = 1 - (1 - t)^3.8 blended with initial ramp
  if (clamped <= 0.12) {
    // Smooth acceleration ramp
    const u = clamped / 0.12;
    const rampFactor = 0.5 * u * u; // 0 to 0.5 at u=1
    return rampFactor * 0.32;
  }
  const u = (clamped - 0.12) / 0.88;
  const easeOut = 1 - Math.pow(1 - u, 3.6);
  return 0.16 + 0.84 * easeOut;
}

/**
 * Given current wheel rotation (clockwise degrees) and total slice count M,
 * returns the index (0 .. M-1) of the slice currently under the 12 o'clock pointer.
 */
export function getSliceIndexAtTopPointer(rotationDeg: number, sliceCount: number): number {
  if (sliceCount <= 1) return 0;
  const sliceDeg = 360 / sliceCount;
  const localDeg = (((360 - (rotationDeg % 360)) % 360) + 360) % 360;
  return Math.floor(localDeg / sliceDeg) % sliceCount;
}

/**
 * Computes exact target clockwise rotation so `winnerSliceIndex` stops directly
 * beneath the 12 o'clock fixed pointer after `extraSpins` full revolutions.
 */
export function computeTargetWheelRotation(
  currentRotationDeg: number,
  winnerSliceIndex: number,
  sliceCount: number,
  extraSpins: number
): number {
  const safeCount = Math.max(sliceCount, 1);
  const sliceDeg = 360 / safeCount;
  const centerFromTop = (winnerSliceIndex + 0.5) * sliceDeg;
  // Subtle natural jitter within middle 36% of the winning slice so it never touches slice borders
  const jitter = ((secureRandomInt(1000) / 1000) - 0.5) * sliceDeg * 0.36;
  const desiredMod = (((360 - (centerFromTop + jitter)) % 360) + 360) % 360;
  const currentMod = ((currentRotationDeg % 360) + 360) % 360;
  const deltaMod = (((desiredMod - currentMod) % 360) + 360) % 360;
  return currentRotationDeg + extraSpins * 360 + deltaMod;
}

// Web Audio & strict Vietnamese TTS are handled via shared EduGameSoundBank & EduGameVoiceController.

/**
 * High-Precision Vector SVG Lucky Number Wheel
 * Renders 1..50 numbered slices, metallic gold LED bezel, boundary pegs,
 * center Tây Đô Smart EDU medallion, and top fixed pointer.
 */
const LuckyNumberWheelSVG: React.FC<{
  slices: NumberedStudentItem[];
  rotationDeg: number;
  calledIds: Set<string>;
  antiDuplicate: boolean;
  displayMode: WheelDisplayMode;
  activeSliceIndex: number;
  isSettled: boolean;
  pointerKick: boolean;
}> = ({
  slices,
  rotationDeg,
  calledIds,
  antiDuplicate,
  displayMode,
  activeSliceIndex,
  isSettled,
  pointerKick,
}) => {
  const cx = 270;
  const cy = 270;
  const outerBezelRadius = 248;
  const wheelRadius = 224;
  const count = slices.length;

  // Dynamic font size and radial label placement for 1 to 50 slices
  const fontSize = count <= 12 ? 20 : count <= 24 ? 15 : count <= 36 ? 12 : 10.2;
  const textRadius = count <= 16 ? 156 : count <= 32 ? 168 : 176;

  return (
    <div className="relative w-full max-w-[440px] sm:max-w-[490px] aspect-square flex items-center justify-center select-none">
      <svg
        viewBox="0 0 540 540"
        className="w-full h-full drop-shadow-[0_18px_38px_rgba(0,0,0,0.65)] overflow-visible"
      >
        <defs>
          <linearGradient id="a11_gold_bezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="35%" stopColor="#F59E0B" />
            <stop offset="70%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#FDE047" />
          </linearGradient>

          <radialGradient id="a11_hub_grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="70%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>

          <radialGradient id="a11_wheel_gloss" cx="35%" cy="25%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
          </radialGradient>
        </defs>

        {/* Pedestal Stand Legs at Bottom */}
        <path
          d="M 190 485 L 155 534 L 385 534 L 350 485 Z"
          fill="#1E293B"
          stroke="#F59E0B"
          strokeWidth="3"
        />
        <rect
          x="135"
          y="526"
          width="270"
          height="12"
          rx="6"
          fill="url(#a11_gold_bezel)"
        />

        {/* Outer Metallic Gold Rim */}
        <circle
          cx={cx}
          cy={cy}
          r={outerBezelRadius}
          fill="url(#a11_gold_bezel)"
          stroke="#FFFBEB"
          strokeWidth="3"
        />

        {/* Dark Inner Track for LED Bulbs */}
        <circle
          cx={cx}
          cy={cy}
          r={outerBezelRadius - 12}
          fill="none"
          stroke="#0F172A"
          strokeWidth="16"
        />

        {/* 24 Perimeter Gameshow LED Bulbs */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angleRad = ((i * 15 - 90) * Math.PI) / 180;
          const rLed = outerBezelRadius - 12;
          const lx = cx + rLed * Math.cos(angleRad);
          const ly = cy + rLed * Math.sin(angleRad);
          const isEven = i % 2 === 0;
          return (
            <circle
              key={i}
              cx={lx}
              cy={ly}
              r="4.8"
              fill={isEven ? '#FEF08A' : '#38BDF8'}
              stroke="#FFFFFF"
              strokeWidth="1"
              className="animate-pulse"
            />
          );
        })}

        {/* ROTATING WHEEL GROUP */}
        <g transform={`rotate(${rotationDeg} ${cx} ${cy})`}>
          {count === 0 ? (
            <circle cx={cx} cy={cy} r={wheelRadius} fill="#1E293B" />
          ) : count === 1 ? (
            /* Special case when exactly 1 slice is on the wheel */
            <g>
              <circle
                cx={cx}
                cy={cy}
                r={wheelRadius}
                fill={slices[0].color}
                stroke="#FEF08A"
                strokeWidth="4"
              />
              <text
                x={cx}
                y={cy - 115}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#FFFFFF"
                fontSize="28"
                fontWeight="900"
                fontFamily="sans-serif"
              >
                {slices[0].formattedNumber}
              </text>
            </g>
          ) : (
            slices.map((item, idx) => {
              const sliceDeg = 360 / count;
              // Slice 0 starts at -90 deg (12 o'clock top) and sweeps clockwise
              const startDeg = idx * sliceDeg - 90;
              const endDeg = (idx + 1) * sliceDeg - 90;
              const midDeg = (startDeg + endDeg) / 2;

              const startRad = (startDeg * Math.PI) / 180;
              const endRad = (endDeg * Math.PI) / 180;
              const midRad = (midDeg * Math.PI) / 180;

              const x1 = cx + wheelRadius * Math.cos(startRad);
              const y1 = cy + wheelRadius * Math.sin(startRad);
              const x2 = cx + wheelRadius * Math.cos(endRad);
              const y2 = cy + wheelRadius * Math.sin(endRad);

              const largeArcFlag = sliceDeg > 180 ? 1 : 0;
              const d = [
                `M ${cx} ${cy}`,
                `L ${x1} ${y1}`,
                `A ${wheelRadius} ${wheelRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z',
              ].join(' ');

              const isCalled =
                displayMode === 'ALL_NUMBERS' &&
                antiDuplicate &&
                calledIds.has(item.student.id);
              const isWinningHighlight = isSettled && idx === activeSliceIndex;

              // Position of the number text along the bisector ray
              const tx = cx + textRadius * Math.cos(midRad);
              const ty = cy + textRadius * Math.sin(midRad);
              // Rotate text so it reads upright radially toward the rim
              const textRot = midDeg + 90;

              // Boundary peg at the start edge of the slice
              const pegX = cx + (wheelRadius - 4) * Math.cos(startRad);
              const pegY = cy + (wheelRadius - 4) * Math.sin(startRad);

              return (
                <g key={`${item.studentNumber}_${item.student.id}`}>
                  <path
                    d={d}
                    fill={isCalled ? '#334155' : item.color}
                    fillOpacity={isCalled ? 0.55 : 1}
                    stroke={isWinningHighlight ? '#FEF08A' : '#FFFFFF'}
                    strokeWidth={isWinningHighlight ? '3.5' : count > 35 ? '1' : '1.8'}
                  />

                  {/* Winning Slice Golden Overlay */}
                  {isWinningHighlight && (
                    <path
                      d={d}
                      fill="#FEF08A"
                      fillOpacity="0.28"
                      stroke="#FEF08A"
                      strokeWidth="3"
                    />
                  )}

                  {/* Student Order Number (01, 02, ...) */}
                  <g transform={`translate(${tx}, ${ty}) rotate(${textRot})`}>
                    <text
                      x="0"
                      y="0"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={isCalled ? '#94A3B8' : '#FFFFFF'}
                      fontSize={fontSize}
                      fontWeight="900"
                      fontFamily="sans-serif"
                      style={{
                        textShadow: isCalled
                          ? 'none'
                          : '0px 1px 3px rgba(0, 0, 0, 0.75)',
                      }}
                    >
                      {item.formattedNumber}
                    </text>
                  </g>

                  {/* Metallic Rim Peg */}
                  <circle
                    cx={pegX}
                    cy={pegY}
                    r={count > 36 ? 2.2 : 3.2}
                    fill="#FEF08A"
                    stroke="#0F172A"
                    strokeWidth="1"
                  />
                </g>
              );
            })
          )}

          {/* Glossy Depth Lighting Overlay on Wheel Surface */}
          <circle
            cx={cx}
            cy={cy}
            r={wheelRadius}
            fill="url(#a11_wheel_gloss)"
            pointerEvents="none"
          />
        </g>

        {/* CENTER HUB MEDALLION (TÂY ĐÔ SMART EDU) */}
        <g>
          <circle
            cx={cx}
            cy={cy}
            r="54"
            fill="url(#a11_gold_bezel)"
            stroke="#FFFFFF"
            strokeWidth="3"
          />
          <circle
            cx={cx}
            cy={cy}
            r="44"
            fill="url(#a11_hub_grad)"
            stroke="#FDE047"
            strokeWidth="2"
          />
          {/* Gold Star in Center Hub */}
          <polygon
            points="270,235 276,251 293,251 279,261 284,277 270,267 256,277 261,261 247,251 264,251"
            fill="#FACC15"
          />
          <text
            x={cx}
            y={cy + 20}
            textAnchor="middle"
            fill="#FEF08A"
            fontSize="8.5"
            fontWeight="900"
            letterSpacing="0.8"
          >
            TÂY ĐÔ EDU
          </text>
        </g>

        {/* TOP 12 O'CLOCK FIXED POINTER / FLAPPER */}
        <g
          transform={`translate(${cx}, 22) rotate(${pointerKick ? -14 : 0})`}
          className="transition-transform duration-75"
        >
          {/* Pointer Mount Bracket */}
          <circle
            cx="0"
            cy="0"
            r="15"
            fill="#EF4444"
            stroke="#FEF08A"
            strokeWidth="3.5"
          />
          {/* Red & Gold Pointer Arrow pointing down at 12 o'clock slice */}
          <polygon
            points="-13,6 13,6 0,42"
            fill="#EF4444"
            stroke="#FEF08A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="0" r="5" fill="#FEF08A" />
        </g>
      </svg>
    </div>
  );
};

export const NumberWheelGame: React.FC<NumberWheelGameProps> = ({
  availableCandidates,
  onPick,
  isMuted,
  allCandidates,
  absentIds = new Set(),
  calledSessionIds = new Set(),
  antiDuplicate = true,
  onToggleAntiDuplicate,
  onResetSession,
  classes = [],
  selectedSourceKey = 'manual',
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  teacherName = 'Giáo viên',
  userRole = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  onToggleMute,
  onOpenAbsentModal,
  onOpenHistoryModal,
  onUpdateLatestNote,
}) => {
  // Wheel Mode A (All Students) vs Mode B (Remaining Students Only)
  const [displayMode, setDisplayMode] = useState<WheelDisplayMode>('ALL_NUMBERS');

  // Strict State Machine: IDLE -> PREPARING -> SPINNING -> SLOWING -> REVEALING -> COMPLETED
  const [phase, setPhase] = useState<WheelGamePhase>('IDLE');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // Spin Duration Options: 4s (Fast), 7s (Normal - default), 10s (Dramatic)
  const [spinDurationSec, setSpinDurationSec] = useState<number>(7);

  // Session ID & Wheel Rotation State
  const [sessionId, setSessionId] = useState<string>(() => `a11_sess_${Date.now().toString(36)}`);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [pointerKick, setPointerKick] = useState<boolean>(false);

  // Snapshot of slices on the wheel during the current spin (so Mode B doesn't shift slices mid-reveal!)
  const [frozenSpinSlices, setFrozenSpinSlices] = useState<NumberedStudentItem[] | null>(null);

  // Picked Result & Previous Result
  const [winningItem, setWinningItem] = useState<NumberedStudentItem | null>(null);
  const [previousWinningItem, setPreviousWinningItem] = useState<NumberedStudentItem | null>(null);
  const [showWinnerCelebration, setShowWinnerCelebration] = useState<boolean>(false);

  // Modal to view the complete 01..N student number mapping
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);

  // Independent Answer Timer (15s, 30s default, 60s, Custom)
  const [timerPreset, setTimerPreset] = useState<number>(30);
  const [customTimerInput, setCustomTimerInput] = useState<string>('45');
  const [isCustomTimer, setIsCustomTimer] = useState<boolean>(false);
  const [timerRemaining, setTimerRemaining] = useState<number>(30);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Bonus Points, Note & Supabase Sync
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [roundNote, setRoundNote] = useState<string>('');
  const [supabaseSyncState, setSupabaseSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string | null>(null);

  // Audio & Strict Vietnamese Voice State / Refs
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceControllerRef = useRef<EduGameVoiceController | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);

  // Animation & Idempotency Refs
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const kickTimeoutRef = useRef<number | null>(null);
  const savedTurnIdsRef = useRef<Set<string>>(new Set());
  const currentTurnIdRef = useRef<string | null>(null);

  const spinSpecRef = useRef<{
    turnToken: string;
    startTime: number;
    elapsedBeforePause: number;
    totalDurationMs: number;
    startRotation: number;
    targetRotation: number;
    slicesSnapshot: NumberedStudentItem[];
    winnerIndexInSlices: number;
    chosenItem: NumberedStudentItem;
    lastTickSliceIndex: number;
  } | null>(null);

  const stopAllTimers = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (kickTimeoutRef.current !== null) {
      window.clearTimeout(kickTimeoutRef.current);
      kickTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const bank = new EduGameSoundBank();
    const voice = new EduGameVoiceController();
    soundBankRef.current = bank;
    voiceControllerRef.current = voice;

    return () => {
      stopAllTimers();
      bank.dispose();
      voice.dispose();
      if (soundBankRef.current === bank) soundBankRef.current = null;
      if (voiceControllerRef.current === voice) voiceControllerRef.current = null;
    };
  }, [stopAllTimers]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      soundBankRef.current?.stopAll();
      voiceControllerRef.current?.stop();
    }
  }, [isMuted]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
    saveEduGameVoiceEnabled(voiceEnabled);
    if (!voiceEnabled) {
      voiceControllerRef.current?.stop();
    }
  }, [voiceEnabled]);

  // Build stable 01..N Student Number Mapping for the selected class
  const numberedStudents = useMemo<NumberedStudentItem[]>(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    const present = base.filter((st) => !absentIds.has(st.id));
    return present.map((student, idx) => {
      const num = idx + 1;
      return {
        studentNumber: num,
        formattedNumber: String(num).padStart(2, '0'),
        student,
        color: WHEEL_SLICE_PALETTE[idx % WHEEL_SLICE_PALETTE.length],
      };
    });
  }, [allCandidates, availableCandidates, absentIds]);

  // Eligible students who can be picked in the next spin
  const eligibleNumberedStudents = useMemo<NumberedStudentItem[]>(() => {
    if (!antiDuplicate) return numberedStudents;
    return numberedStudents.filter((item) => !calledSessionIds.has(item.student.id));
  }, [numberedStudents, antiDuplicate, calledSessionIds]);

  // Live slices for the wheel when IDLE, or frozen snapshot while spinning/revealing
  const liveSlices = useMemo<NumberedStudentItem[]>(() => {
    if (displayMode === 'REMAINING_ONLY' && antiDuplicate) {
      return eligibleNumberedStudents;
    }
    return numberedStudents;
  }, [displayMode, antiDuplicate, eligibleNumberedStudents, numberedStudents]);

  const activeWheelSlices = frozenSpinSlices || liveSlices;

  // Reset state when switching classes
  useEffect(() => {
    stopAllTimers();
    spinSpecRef.current = null;
    soundBankRef.current?.setActiveTurnToken(null);
    soundBankRef.current?.stopAll();
    voiceControllerRef.current?.stop();
    setPhase('IDLE');
    setIsPaused(false);
    setFrozenSpinSlices(null);
    setWinningItem(null);
    setPreviousWinningItem(null);
    setShowWinnerCelebration(false);
    setWheelRotation(0);
    setSupabaseSyncState('idle');
    setSupabaseErrorMsg(null);
  }, [selectedSourceKey, stopAllTimers]);

  // Clear frozenSpinSlices when switching displayMode while IDLE/COMPLETED
  const handleSwitchDisplayMode = (mode: WheelDisplayMode) => {
    if (phase === 'PREPARING' || phase === 'SPINNING' || phase === 'SLOWING') return;
    setDisplayMode(mode);
    setFrozenSpinSlices(null);
    setWheelRotation(0);
  };

  // Independent Answer Countdown Timer
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          soundBankRef.current?.playTimerBell(isMutedRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  // Persist turn result to Supabase public.audit_logs (with duplicate guard & retry)
  const syncTurnToSupabase = useCallback(
    async (
      item: NumberedStudentItem,
      points: number,
      noteText: string,
      forceRetry = false
    ) => {
      const turnId =
        currentTurnIdRef.current || `turn_${sessionId}_${item.student.id}_${item.studentNumber}`;
      const dedupeKey = `${turnId}_${points}_${noteText}`;
      if (!forceRetry && savedTurnIdsRef.current.has(dedupeKey)) {
        return;
      }

      if (!isSupabaseConfigured) {
        setSupabaseSyncState('saved');
        return;
      }

      setSupabaseSyncState('saving');
      setSupabaseErrorMsg(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData?.session?.user;
        if (!authUser) {
          savedTurnIdsRef.current.add(dedupeKey);
          setSupabaseSyncState('saved');
          return;
        }

        const detailsText = [
          `Trò chơi: A11 - Bánh xe số may mắn`,
          `Lớp: ${resolvedClassName}`,
          `Số thứ tự: #${item.formattedNumber}`,
          `HS: ${item.student.fullName} (Mã HS: ${item.student.code})`,
          `Chế độ bánh xe: ${displayMode === 'ALL_NUMBERS' ? 'Tất cả số' : 'Số còn lại'}`,
          points > 0 ? `Điểm thưởng: +${points}đ` : '',
          noteText.trim() ? `Ghi chú: ${noteText.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const { error } = await supabase.from('audit_logs').insert({
          actor_name: teacherName || 'Giáo viên',
          role: userRole || 'teacher',
          action: 'EDU_GAME_A11_NUMBER_WHEEL',
          target: `A11 (${resolvedClassName}) - Số #${item.formattedNumber} ${item.student.fullName}`,
          details: detailsText,
          actor_id: authUser.id,
          metadata: {
            game_id: 'A11',
            game_title: 'Bánh xe số may mắn',
            session_id: sessionId,
            class_id: selectedSourceKey,
            class_name: resolvedClassName,
            student_id: item.student.id,
            student_code: item.student.code,
            student_name: item.student.fullName,
            student_number: item.studentNumber,
            wheel_mode: displayMode,
            reward_points: points,
            note: noteText.trim(),
            selected_at: new Date().toISOString(),
          },
        });

        if (error) throw error;

        savedTurnIdsRef.current.add(dedupeKey);
        setSupabaseSyncState('saved');
      } catch (err: any) {
        console.warn('A11 Supabase sync warning:', err);
        setSupabaseSyncState('error');
        setSupabaseErrorMsg(
          err?.message || 'Chưa đồng bộ được lên đám mây Supabase. Lịch sử tại máy vẫn được giữ an toàn.'
        );
      }
    },
    [displayMode, resolvedClassName, selectedSourceKey, sessionId, teacherName, userRole]
  );

  // Core Frame-by-Frame Spin Loop
  const runWheelAnimationLoop = useCallback(() => {
    const stepFrame = (now: number) => {
      const spec = spinSpecRef.current;
      if (!spec) return;

      const elapsed = spec.elapsedBeforePause + (now - spec.startTime);
      const rawT = Math.min(Math.max(elapsed / spec.totalDurationMs, 0), 1);

      // Update State Machine Phase
      if (rawT < 0.08) {
        setPhase((p) => (p !== 'PREPARING' ? 'PREPARING' : p));
      } else if (rawT < 0.38) {
        setPhase((p) => (p !== 'SPINNING' ? 'SPINNING' : p));
      } else if (rawT < 1.0) {
        setPhase((p) => (p !== 'SLOWING' ? 'SLOWING' : p));
      }

      const curvedProgress = evaluateWheelProgressCurve(rawT);
      const currentDeg =
        spec.startRotation + (spec.targetRotation - spec.startRotation) * curvedProgress;

      setWheelRotation(currentDeg);

      // Detect slice boundary crossing under the top 12 o'clock pointer for peg tick sound & flapper kick
      const sliceIdxNow = getSliceIndexAtTopPointer(currentDeg, spec.slicesSnapshot.length);
      if (sliceIdxNow !== spec.lastTickSliceIndex) {
        spec.lastTickSliceIndex = sliceIdxNow;
        const velocityFactor = Math.max(0.18, 1 - rawT * 0.8);
        soundBankRef.current?.playWheelPegTick(isMutedRef.current, velocityFactor, spec.turnToken);
        if (!reduceMotion) {
          setPointerKick(true);
          if (kickTimeoutRef.current !== null) window.clearTimeout(kickTimeoutRef.current);
          kickTimeoutRef.current = window.setTimeout(() => setPointerKick(false), 55);
        }
      }

      if (rawT < 1.0) {
        rafRef.current = requestAnimationFrame(stepFrame);
      } else {
        // Spin complete: wheel is stopped at exact targetRotation!
        rafRef.current = null;
        setPointerKick(false);
        setWheelRotation(spec.targetRotation);
        setPhase('REVEALING');
        setWinningItem(spec.chosenItem);
        setShowWinnerCelebration(true);
        setBonusPoints(0);
        setRoundNote('');
        setTimerRunning(false);
        setTimerRemaining(timerPreset);

        const turnId = `turn_${sessionId}_${spec.turnToken}_${spec.chosenItem.student.id}`;
        soundBankRef.current?.playRevealChime(isMutedRef.current, spec.turnToken);
        void voiceControllerRef.current?.announceStudentOnce({
          turnId,
          studentName: spec.chosenItem.student.fullName,
          customText: `Số ${spec.chosenItem.formattedNumber}, xin chúc mừng bạn ${spec.chosenItem.student.fullName}!`,
          isMuted: isMutedRef.current,
          voiceEnabled: voiceEnabledRef.current,
        });

        timeoutRef.current = window.setTimeout(() => {
          if (!soundBankRef.current?.isTurnValid(spec.turnToken)) return;
          setPhase('COMPLETED');
          currentTurnIdRef.current = turnId;
          if (!savedTurnIdsRef.current.has(turnId)) {
            savedTurnIdsRef.current.add(turnId);
            onPick(spec.chosenItem.student, {
              bonusPoints: 0,
              note: '',
              sessionId,
              studentNumber: spec.chosenItem.studentNumber,
            });
            syncTurnToSupabase(spec.chosenItem, 0, '');
          }
        }, 260);
      }
    };

    rafRef.current = requestAnimationFrame(stepFrame);
  }, [onPick, reduceMotion, sessionId, syncTurnToSupabase, timerPreset]);

  // Start Spinning the Lucky Number Wheel
  const handleStartSpin = () => {
    if (
      phase === 'PREPARING' ||
      phase === 'SPINNING' ||
      phase === 'SLOWING' ||
      phase === 'REVEALING'
    ) {
      return;
    }
    if (eligibleNumberedStudents.length === 0) return;

    // Unlock Web Audio synchronously inside user gesture & cancel any prior sounds/speech
    soundBankRef.current?.unlock();
    soundBankRef.current?.stopAll();
    voiceControllerRef.current?.stop();

    stopAllTimers();
    setIsPaused(false);
    setShowWinnerCelebration(false);

    // Move current winningItem to previousWinningItem so right panel labels it "Kết quả lượt trước"
    if (winningItem) {
      setPreviousWinningItem(winningItem);
      setWinningItem(null);
    }

    // 1. Snapshot the slices for this spin (in Mode B, this removes the previously called student now!)
    const slicesForThisSpin =
      displayMode === 'REMAINING_ONLY' && antiDuplicate
        ? [...eligibleNumberedStudents]
        : [...numberedStudents];

    if (slicesForThisSpin.length === 0) return;
    setFrozenSpinSlices(slicesForThisSpin);

    // 2. Fair 1/N selection from eligibleNumberedStudents using cryptographic rejection sampling
    const winnerEligibleIdx = secureRandomInt(eligibleNumberedStudents.length);
    const chosenItem = eligibleNumberedStudents[winnerEligibleIdx];

    // 3. Find the exact index of `chosenItem` on `slicesForThisSpin`
    const winnerSliceIndex = slicesForThisSpin.findIndex(
      (s) => s.student.id === chosenItem.student.id
    );
    const safeWinnerIdx = winnerSliceIndex >= 0 ? winnerSliceIndex : 0;

    // 4. Compute exact target clockwise rotation so 12 o'clock pointer lands inside `safeWinnerIdx`
    const extraSpins = reduceMotion
      ? 2
      : spinDurationSec >= 10
      ? 9
      : spinDurationSec >= 7
      ? 7
      : 5;

    const targetRotation = computeTargetWheelRotation(
      wheelRotation,
      safeWinnerIdx,
      slicesForThisSpin.length,
      extraSpins
    );

    const turnToken = `a11_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    soundBankRef.current?.setActiveTurnToken(turnToken);

    spinSpecRef.current = {
      turnToken,
      startTime: performance.now(),
      elapsedBeforePause: 0,
      totalDurationMs: (reduceMotion ? 1.5 : spinDurationSec) * 1000,
      startRotation: wheelRotation,
      targetRotation,
      slicesSnapshot: slicesForThisSpin,
      winnerIndexInSlices: safeWinnerIdx,
      chosenItem,
      lastTickSliceIndex: getSliceIndexAtTopPointer(wheelRotation, slicesForThisSpin.length),
    };

    setPhase('PREPARING');
    runWheelAnimationLoop();
  };

  // Pause / Resume Spin
  const handleTogglePauseSpin = () => {
    const spec = spinSpecRef.current;
    if (!spec) return;

    if (!isPaused) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      soundBankRef.current?.stopAll();
      voiceControllerRef.current?.stop();
      spec.elapsedBeforePause += performance.now() - spec.startTime;
      setIsPaused(true);
    } else {
      soundBankRef.current?.unlock();
      spec.startTime = performance.now();
      setIsPaused(false);
      runWheelAnimationLoop();
    }
  };

  // Safe Emergency Complete without altering chosen student
  const handleSafeCompleteNow = () => {
    const spec = spinSpecRef.current;
    stopAllTimers();
    soundBankRef.current?.stopAll();
    voiceControllerRef.current?.stop();
    setIsPaused(false);
    setPointerKick(false);
    if (!spec) {
      setPhase('IDLE');
      return;
    }
    setWheelRotation(spec.targetRotation);
    setWinningItem(spec.chosenItem);
    setShowWinnerCelebration(true);
    setPhase('COMPLETED');
    const turnId = `turn_${sessionId}_${spec.turnToken}_${spec.chosenItem.student.id}`;
    currentTurnIdRef.current = turnId;

    soundBankRef.current?.playRevealChime(isMutedRef.current, spec.turnToken);
    void voiceControllerRef.current?.announceStudentOnce({
      turnId,
      studentName: spec.chosenItem.student.fullName,
      customText: `Số ${spec.chosenItem.formattedNumber}, xin chúc mừng bạn ${spec.chosenItem.student.fullName}!`,
      isMuted: isMutedRef.current,
      voiceEnabled: voiceEnabledRef.current,
    });

    if (!savedTurnIdsRef.current.has(turnId)) {
      savedTurnIdsRef.current.add(turnId);
      onPick(spec.chosenItem.student, {
        bonusPoints: 0,
        note: '',
        sessionId,
        studentNumber: spec.chosenItem.studentNumber,
      });
      syncTurnToSupabase(spec.chosenItem, 0, '');
    }
  };

  // Refresh Session
  const handleRefreshSession = () => {
    stopAllTimers();
    soundBankRef.current?.setActiveTurnToken(null);
    soundBankRef.current?.stopAll();
    voiceControllerRef.current?.stop();
    voiceControllerRef.current?.resetTurnDedupe();
    savedTurnIdsRef.current.clear();
    currentTurnIdRef.current = null;
    spinSpecRef.current = null;
    setSessionId(`a11_sess_${Date.now().toString(36)}`);
    setPhase('IDLE');
    setIsPaused(false);
    setFrozenSpinSlices(null);
    setWinningItem(null);
    setPreviousWinningItem(null);
    setShowWinnerCelebration(false);
    setWheelRotation(0);
    setBonusPoints(0);
    setRoundNote('');
    onResetSession?.();
  };

  // Save Bonus Points & Note
  const handleSaveScoreAndNote = () => {
    if (!winningItem) return;
    const combined = [
      `Số #${winningItem.formattedNumber}`,
      bonusPoints > 0 ? `+${bonusPoints} điểm thưởng` : '',
      roundNote.trim(),
    ]
      .filter(Boolean)
      .join(' - ');

    onUpdateLatestNote?.(combined);
    syncTurnToSupabase(winningItem, bonusPoints, roundNote, true);
  };

  const isSpinningActive =
    phase === 'PREPARING' ||
    phase === 'SPINNING' ||
    phase === 'SLOWING' ||
    phase === 'REVEALING';

  const isSettledOrCompleted = phase === 'REVEALING' || phase === 'COMPLETED';
  const allCalled = numberedStudents.length > 0 && eligibleNumberedStudents.length === 0;

  // Live slice currently under the 12 o'clock pointer
  const pointerSliceIndex = getSliceIndexAtTopPointer(wheelRotation, activeWheelSlices.length);
  const pointerSliceItem =
    activeWheelSlices.length > 0 ? activeWheelSlices[pointerSliceIndex] : null;

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* ===================================================================
          LEFT COLUMN (70% on Desktop): LUCKY NUMBER GAMESHOW WHEEL STAGE
         =================================================================== */}
      <div className="lg:col-span-8 xl:col-span-8 flex flex-col justify-between space-y-4">
        <div
          className={`relative w-full ${
            isFullscreen ? 'min-h-[75vh]' : 'min-h-[520px] sm:min-h-[580px]'
          } rounded-3xl border-4 border-amber-400/75 shadow-2xl overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#0A192F] via-[#112A4E] to-[#081226]`}
        >
          {/* 1. GAMESHOW STAGE SPOTLIGHTS & DECORATIVE STARS */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-20 left-1/4 w-80 h-60 bg-sky-500/20 rounded-full blur-3xl" />
            <div className="absolute -top-20 right-1/4 w-80 h-60 bg-amber-400/15 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" />
          </div>

          {/* 2. TOP STAGE BAR: Mode A / Mode B Switcher, Spin Speed & "Xem danh sách số" */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2 sm:px-6">
            {/* Mode A vs Mode B Switcher */}
            <div className="bg-slate-950/85 backdrop-blur-xs p-1 rounded-2xl border border-amber-400/40 flex flex-wrap items-center gap-1 shadow-lg">
              <button
                type="button"
                disabled={isSpinningActive}
                onClick={() => handleSwitchDisplayMode('ALL_NUMBERS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  displayMode === 'ALL_NUMBERS'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-xs'
                    : 'text-amber-100 hover:bg-white/10'
                }`}
              >
                <Disc className="w-3.5 h-3.5" />
                <span>Chế độ A: Tất cả số ({numberedStudents.length})</span>
              </button>

              <button
                type="button"
                disabled={isSpinningActive}
                onClick={() => handleSwitchDisplayMode('REMAINING_ONLY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  displayMode === 'REMAINING_ONLY'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-xs'
                    : 'text-amber-100 hover:bg-white/10'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Chế độ B: Chỉ số còn lại ({eligibleNumberedStudents.length})</span>
              </button>
            </div>

            {/* Spin Duration & View Mapping Button */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1.5 rounded-2xl border border-sky-400/35 text-xs">
                <span className="text-sky-200 font-bold">Tốc độ:</span>
                {[
                  { sec: 4, label: '4s' },
                  { sec: 7, label: '7s' },
                  { sec: 10, label: '10s' },
                ].map((opt) => (
                  <button
                    key={opt.sec}
                    type="button"
                    disabled={isSpinningActive}
                    onClick={() => setSpinDurationSec(opt.sec)}
                    className={`px-2 py-0.5 rounded-lg font-extrabold transition-all cursor-pointer ${
                      spinDurationSec === opt.sec
                        ? 'bg-sky-500 text-white'
                        : 'text-sky-200/80 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowMappingModal(true)}
                className="px-3.5 py-1.5 rounded-2xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/60 text-amber-200 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Xem danh sách số (01–{String(numberedStudents.length).padStart(2, '0')})</span>
              </button>
            </div>
          </div>

          {/* 3. ELECTRONIC DIGITAL NUMBER SCOREBOARD & POINTER MAGNIFIER */}
          <div className="relative z-20 px-4 flex items-center justify-center">
            <div className="bg-slate-950/90 backdrop-blur-md border-2 border-amber-400/70 rounded-2xl px-5 py-2 shadow-xl flex flex-wrap items-center justify-center gap-4 text-white">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                  Kim chỉ đỉnh 12 giờ:
                </span>
                <span
                  className="px-3 py-0.5 rounded-xl font-black text-lg sm:text-xl tabular-nums border border-white/30 shadow-inner"
                  style={{
                    backgroundColor: pointerSliceItem?.color || '#1E293B',
                  }}
                >
                  SỐ {pointerSliceItem ? pointerSliceItem.formattedNumber : '--'}
                </span>
              </div>

              {isSettledOrCompleted && winningItem && (
                <>
                  <div className="h-5 w-px bg-white/20 hidden sm:block" />
                  <div className="flex items-center gap-2 animate-fadeIn">
                    <span className="text-xs font-black text-amber-300 uppercase">
                      🎯 TRÚNG SỐ {winningItem.formattedNumber}:
                    </span>
                    <span className="text-sm sm:text-base font-black text-emerald-300">
                      {winningItem.student.fullName}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 4. CENTER WHEEL ARENA */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2">
            {numberedStudents.length === 0 ? (
              <div className="bg-white/95 rounded-3xl p-8 text-center max-w-md shadow-2xl space-y-3">
                <Users className="w-12 h-12 text-sky-600 mx-auto" />
                <h3 className="text-lg font-black text-[#0F2D52]">Lớp chưa có học sinh có mặt</h3>
                <p className="text-xs text-slate-600">
                  Vui lòng chọn lớp học khác hoặc kiểm tra lại danh sách học sinh vắng mặt.
                </p>
              </div>
            ) : allCalled && !isSpinningActive && !showWinnerCelebration ? (
              <div className="bg-white/95 rounded-3xl p-8 text-center max-w-lg shadow-2xl border-4 border-amber-400 space-y-4 animate-fadeIn">
                <Trophy className="w-14 h-14 text-amber-500 mx-auto" />
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase">
                  HOÀN THÀNH PHIÊN QUAY SỐ
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#0F2D52]">
                  ĐÃ GỌI HẾT LỚP ({numberedStudents.length} SỐ)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Tất cả các con số may mắn trong lớp đã được quay. Nhấn Làm mới phiên để bắt đầu lượt mới!
                </p>
                <button
                  type="button"
                  onClick={handleRefreshSession}
                  className="px-6 py-3 bg-[#006BFF] hover:bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>LÀM MỚI PHIÊN QUAY SỐ</span>
                </button>
              </div>
            ) : (
              <LuckyNumberWheelSVG
                slices={activeWheelSlices}
                rotationDeg={wheelRotation}
                calledIds={calledSessionIds}
                antiDuplicate={antiDuplicate}
                displayMode={displayMode}
                activeSliceIndex={pointerSliceIndex}
                isSettled={isSettledOrCompleted}
                pointerKick={pointerKick}
              />
            )}

            {/* 5. CELEBRATION WINNER REVEAL MODAL OVERLAY (Shown after wheel stops!) */}
            {showWinnerCelebration && winningItem && isSettledOrCompleted && (
              <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
                <div className="relative bg-gradient-to-b from-amber-300 via-yellow-100 to-white rounded-3xl border-4 border-white p-6 sm:p-8 max-w-lg w-full text-center shadow-[0_20px_60px_rgba(0,0,0,0.65)] space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-rose-600 text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-md">
                    <Sparkles className="w-4 h-4" />
                    <span>CHÚC MỪNG CON SỐ CHIẾN THẮNG!</span>
                  </div>

                  {/* Giant Lucky Number Medallion */}
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl mx-auto flex flex-col items-center justify-center text-white border-4 border-white shadow-xl"
                    style={{ backgroundColor: winningItem.color }}
                  >
                    <span className="text-[11px] font-extrabold uppercase opacity-90">
                      SỐ MAY MẮN
                    </span>
                    <span className="text-4xl sm:text-5xl font-black tabular-nums leading-none mt-0.5">
                      {winningItem.formattedNumber}
                    </span>
                  </div>

                  <div className="py-3 px-4 bg-white rounded-2xl border-2 border-amber-300 shadow-inner space-y-1">
                    <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Học sinh tương ứng với số #{winningItem.formattedNumber}
                    </p>
                    <h3 className="text-2xl sm:text-4xl font-black text-[#0F2D52] leading-tight break-words">
                      {winningItem.student.fullName}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1.5">
                      <span className="px-3 py-0.5 rounded-full bg-blue-100 text-[#006BFF] text-xs font-extrabold">
                        Mã HS: {winningItem.student.code}
                      </span>
                      <span className="px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                        Lớp: {resolvedClassName}
                      </span>
                    </div>
                  </div>

                  {/* Next Spin Actions */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    {eligibleNumberedStudents.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={handleStartSpin}
                          className="px-6 py-3 bg-gradient-to-r from-[#006BFF] to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg flex items-center gap-2 cursor-pointer"
                        >
                          <RotateCw className="w-4 h-4" />
                          <span>QUAY TIẾP SỐ MỚI ➔</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowWinnerCelebration(false);
                            if (displayMode === 'REMAINING_ONLY') {
                              setFrozenSpinSlices(null);
                              setWheelRotation(0);
                            }
                          }}
                          className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-extrabold cursor-pointer"
                        >
                          Xem mặt bánh xe
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRefreshSession}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg flex items-center gap-2 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>ĐÃ GỌI HẾT LỚP · LÀM MỚI PHIÊN</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. BOTTOM STAGE STATUS BAR */}
          <div className="relative z-20 px-4 py-3 sm:px-6 bg-slate-950/80 backdrop-blur-xs border-t border-amber-400/25 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200">
            <div className="flex items-center gap-2 font-bold">
              <span>Trạng thái:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-amber-300 font-extrabold">
                {phase}
                {isPaused ? ' (TẠM DỪNG)' : ''}
              </span>
              {isSpinningActive && (
                <button
                  type="button"
                  onClick={handleSafeCompleteNow}
                  className="text-[11px] text-amber-300 underline hover:text-amber-200 ml-2"
                >
                  Dừng nhanh
                </button>
              )}
            </div>

            <div className="font-bold tabular-nums">
              Số chưa gọi:{' '}
              <strong className="text-emerald-300">{eligibleNumberedStudents.length}</strong> /{' '}
              {numberedStudents.length} học sinh
            </div>
          </div>
        </div>

        {/* PRIMARY CONTROL BUTTONS BENEATH STAGE */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <button
            type="button"
            disabled={
              (isSpinningActive && !isPaused) ||
              allCalled ||
              numberedStudents.length === 0
            }
            onClick={handleStartSpin}
            className="sm:col-span-6 py-4 px-6 bg-gradient-to-r from-amber-500 via-[#006BFF] to-indigo-700 hover:opacity-95 text-white rounded-2xl text-base sm:text-lg font-black shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
          >
            <RotateCw
              className={`w-6 h-6 ${isSpinningActive && !isPaused ? 'animate-spin' : ''}`}
            />
            <span>
              {allCalled
                ? 'ĐÃ GỌI HẾT LỚP'
                : isSpinningActive
                ? '🎡 BÁNH XE ĐANG QUAY SỐ...'
                : phase === 'COMPLETED' || winningItem
                ? '🎡 QUAY TIẾP ➔'
                : '🎡 QUAY SỐ MAY MẮN ➔'}
            </span>
          </button>

          <button
            type="button"
            disabled={!isSpinningActive}
            onClick={handleTogglePauseSpin}
            className="sm:col-span-3 py-4 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-2xl text-xs sm:text-sm font-extrabold shadow-xs transition-all disabled:opacity-45 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4 fill-current text-emerald-600" />
                <span>TIẾP TỤC QUAY</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 text-amber-700" />
                <span>TẠM DỪNG</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isSpinningActive && !isPaused}
            onClick={handleRefreshSession}
            className="sm:col-span-3 py-4 px-4 bg-white hover:bg-slate-50 text-[#0F2D52] border-2 border-slate-200 rounded-2xl text-xs sm:text-sm font-extrabold shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#006BFF]" />
            <span>LÀM MỚI PHIÊN</span>
          </button>
        </div>
      </div>

      {/* ===================================================================
          RIGHT COLUMN (30% on Desktop): RESULTS, PREVIOUS TURN, TIMER & CONTROLS
         =================================================================== */}
      <div className="lg:col-span-4 xl:col-span-4 bg-slate-50 rounded-3xl border border-slate-200 p-5 flex flex-col justify-between space-y-5 shadow-xs">
        <div className="space-y-4">
          {/* 1. Class & Wheel Session Settings */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Lớp & Cấu hình bánh xe
              </span>
              <div className="flex items-center gap-2">
                {onOpenAbsentModal && (
                  <button
                    type="button"
                    onClick={onOpenAbsentModal}
                    className="text-[11px] font-extrabold text-[#006BFF] hover:underline"
                  >
                    Vắng ({absentIds.size})
                  </button>
                )}
                {onOpenHistoryModal && (
                  <button
                    type="button"
                    onClick={onOpenHistoryModal}
                    className="text-[11px] font-extrabold text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    <History className="w-3 h-3" /> Lịch sử
                  </button>
                )}
              </div>
            </div>

            {onSelectSourceKey && classes.length > 0 && (
              <select
                value={selectedSourceKey}
                disabled={isSpinningActive}
                onChange={(e) => onSelectSourceKey(e.target.value)}
                className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[#0F2D52] focus:outline-none focus:ring-2 focus:ring-[#006BFF]"
              >
                <option value="manual">-- Danh sách tự do --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.students?.length || 0} HS)
                  </option>
                ))}
              </select>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isSpinningActive}
                onClick={onToggleAntiDuplicate}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold border flex items-center justify-between transition-all ${
                  antiDuplicate
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <span>Chống trùng</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-black shadow-2xs">
                  {antiDuplicate ? 'BẬT' : 'TẮT'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReduceMotion((prev) => !prev)}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold border flex items-center justify-between transition-all ${
                  reduceMotion
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <span className="flex items-center gap-1">
                  <EyeOff className="w-3 h-3" /> Giảm động
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-black shadow-2xs">
                  {reduceMotion ? 'BẬT' : 'TẮT'}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {onToggleMute && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1.5"
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                      <span>Đang tắt âm</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Âm thanh: Bật</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setVoiceEnabled((v) => !v)}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border transition-all ${
                  voiceEnabled && !isMuted
                    ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                }`}
                title="Bật/Tắt đọc tên học sinh bằng giọng Tiếng Việt"
              >
                {voiceEnabled && !isMuted ? (
                  <Mic className="w-3.5 h-3.5 text-sky-600" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>Đọc tên: {voiceEnabled && !isMuted ? 'BẬT' : 'TẮT'}</span>
              </button>

              {onToggleFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isFullscreen ? 'Thu nhỏ' : 'Full màn hình'}</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Current & Previous Turn Results Box (Strictly hidden while wheel is spinning!) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-[#0F2D52] uppercase tracking-wider">
                Kết quả quay số
              </h4>
              <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                Đã gọi: {calledSessionIds.size}/{numberedStudents.length}
              </span>
            </div>

            {isSpinningActive ? (
              <div className="space-y-3">
                <div className="py-5 px-3 bg-sky-50 border border-sky-200 rounded-xl text-center space-y-2 animate-pulse">
                  <RotateCw className="w-8 h-8 text-[#006BFF] mx-auto animate-spin" />
                  <p className="text-xs font-extrabold text-[#0F2D52]">
                    Bánh xe đang quay qua Số #{pointerSliceItem?.formattedNumber || '--'}...
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Kết quả chỉ công bố khi bánh xe dừng hẳn dưới kim chỉ.
                  </p>
                </div>

                {/* Keep Previous Turn Result clearly labeled while spinning next turn */}
                {previousWinningItem && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 opacity-85 space-y-0.5">
                    <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-extrabold">
                      Kết quả lượt trước · Số #{previousWinningItem.formattedNumber}
                    </span>
                    <p className="text-xs font-bold text-slate-700 pt-0.5">
                      {previousWinningItem.student.fullName} ({previousWinningItem.student.code})
                    </p>
                  </div>
                )}
              </div>
            ) : winningItem && isSettledOrCompleted ? (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-400 flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl text-white flex flex-col items-center justify-center shrink-0 font-black shadow-md"
                    style={{ backgroundColor: winningItem.color }}
                  >
                    <span className="text-[9px] uppercase">SỐ</span>
                    <span className="text-lg leading-none">{winningItem.formattedNumber}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-700">
                        🎯 SỐ MAY MẮN: {winningItem.formattedNumber}
                      </span>
                      {supabaseSyncState === 'saved' && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Đã lưu
                        </span>
                      )}
                    </div>
                    <h5 className="text-base sm:text-lg font-black text-[#0F2D52] truncate">
                      {winningItem.student.fullName}
                    </h5>
                    <p className="text-[11px] font-bold text-slate-600">
                      Mã HS: {winningItem.student.code} · Lớp: {resolvedClassName}
                    </p>
                  </div>
                </div>

                {/* Bonus Points & Note Controls */}
                <div className="space-y-2 pt-1">
                  <label className="text-[11px] font-extrabold text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-500" /> Điểm thưởng & Ghi chú
                    </span>
                    {bonusPoints > 0 && (
                      <span className="text-emerald-600 font-black">+{bonusPoints}đ</span>
                    )}
                  </label>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 5, 10].map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setBonusPoints((prev) => (prev === pt ? 0 : pt))}
                        className={`py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
                          bonusPoints === pt
                            ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        +{pt}đ
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={roundNote}
                    onChange={(e) => setRoundNote(e.target.value)}
                    placeholder="Ghi chú lượt gọi..."
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006BFF]"
                  />

                  <button
                    type="button"
                    onClick={handleSaveScoreAndNote}
                    disabled={supabaseSyncState === 'saving'}
                    className="w-full py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {supabaseSyncState === 'saving' ? 'Đang lưu...' : 'Lưu điểm thưởng & ghi chú'}
                    </span>
                  </button>

                  {supabaseSyncState === 'error' && supabaseErrorMsg && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{supabaseErrorMsg}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          syncTurnToSupabase(winningItem, bonusPoints, roundNote, true)
                        }
                        className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Thử lưu lại
                      </button>
                    </div>
                  )}
                </div>

                {/* Previous Turn Result Labeled Clearly */}
                {previousWinningItem && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-extrabold">
                          Kết quả lượt trước
                        </span>
                        <p className="font-bold text-slate-700 mt-1">
                          Số #{previousWinningItem.formattedNumber} –{' '}
                          {previousWinningItem.student.fullName}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {previousWinningItem.student.code}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-5 px-3 text-center text-slate-400 space-y-1.5">
                <Disc className="w-9 h-9 mx-auto opacity-35" />
                <p className="text-xs font-bold text-slate-500">Chưa quay số nào</p>
                <p className="text-[11px]">
                  Nhấn nút <strong>QUAY SỐ MAY MẮN</strong> để bánh xe chọn ngẫu nhiên công bằng.
                </p>
              </div>
            )}
          </div>

          {/* 3. Independent Answer Countdown Timer */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#0F2D52] flex items-center gap-1.5">
                <TimerIcon className="w-4 h-4 text-amber-500" />
                <span>Đồng hồ trả lời</span>
              </span>
              <span
                className={`text-lg font-black tabular-nums ${
                  timerRemaining === 0
                    ? 'text-rose-600 animate-bounce'
                    : timerRemaining <= 5 && timerRunning
                    ? 'text-amber-600'
                    : 'text-[#006BFF]'
                }`}
              >
                {timerRemaining}s
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[15, 30, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setIsCustomTimer(false);
                    setTimerPreset(sec);
                    setTimerRemaining(sec);
                    setTimerRunning(false);
                  }}
                  className={`py-1.5 rounded-lg text-[11px] font-extrabold border transition-all ${
                    !isCustomTimer && timerPreset === sec
                      ? 'bg-[#006BFF] border-[#006BFF] text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {sec}s
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomTimer((v) => !v)}
                className={`py-1.5 rounded-lg text-[11px] font-extrabold border transition-all ${
                  isCustomTimer
                    ? 'bg-[#006BFF] border-[#006BFF] text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Tùy chỉnh
              </button>
            </div>

            {isCustomTimer && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={customTimerInput}
                  onChange={(e) => setCustomTimerInput(e.target.value)}
                  className="w-20 text-xs font-bold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = Math.min(Math.max(parseInt(customTimerInput, 10) || 30, 5), 600);
                    setTimerPreset(parsed);
                    setTimerRemaining(parsed);
                    setTimerRunning(false);
                  }}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[11px] font-bold"
                >
                  Áp dụng ({customTimerInput || 30}s)
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (timerRemaining === 0) setTimerRemaining(timerPreset);
                  setTimerRunning((r) => !r);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                  timerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {timerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Tạm dừng
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Bắt đầu đếm
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerRemaining(timerPreset);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                title="Đặt lại đồng hồ"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-bold">
          <span>Mã trò chơi: A11</span>
          <span>Xác suất: Đồng đều 1/{eligibleNumberedStudents.length || 1}</span>
        </div>
      </div>

      {/* ===================================================================
          MODAL: XEM DANH SÁCH SỐ THỨ TỰ (01..N) VÀ ÁNH XẠ HỌC SINH
         =================================================================== */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#0F2D52]">
                  Bảng ánh xạ Số thứ tự trên bánh xe – Lớp {resolvedClassName}
                </h3>
                <p className="text-xs text-slate-500">
                  Ánh xạ cố định trong suốt phiên chơi (phân biệt rõ Số thứ tự trên bánh xe và Mã học sinh).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMappingModal(false)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
              {numberedStudents.map((item) => {
                const isCalled = calledSessionIds.has(item.student.id);
                return (
                  <div
                    key={item.student.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      isCalled
                        ? 'bg-slate-100 border-slate-200 opacity-65'
                        : 'bg-slate-50 border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-8 h-8 rounded-lg text-white font-black flex items-center justify-center shrink-0 tabular-nums shadow-2xs"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.formattedNumber}
                      </span>
                      <div className="truncate">
                        <p className="font-extrabold text-[#0F2D52] truncate">
                          {item.student.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500">Mã HS: {item.student.code}</p>
                      </div>
                    </div>

                    {isCalled ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold shrink-0">
                        Đã quay
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#006BFF] text-[10px] font-bold shrink-0">
                        Sẵn sàng
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowMappingModal(false)}
                className="px-5 py-2.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-extrabold"
              >
                Đóng bảng tra cứu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
