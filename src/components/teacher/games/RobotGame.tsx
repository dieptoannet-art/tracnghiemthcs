import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question, CognitiveLevel } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Bot,
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
  BookOpen,
  Mic,
  MicOff,
  Repeat,
  Cpu,
  ShieldCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Eye,
} from 'lucide-react';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameVoiceEnabled,
  saveEduGameVoiceEnabled,
} from '../../../utils/eduGameAudioController';

export type RobotGamePhase =
  | 'IDLE'
  | 'INITIALIZING'
  | 'SCANNING'
  | 'SELECTING'
  | 'REVEALING'
  | 'SPEAKING'
  | 'COMPLETED';

export type RobotExpression =
  | 'NORMAL'
  | 'HAPPY'
  | 'THINKING'
  | 'SCANNING'
  | 'CELEBRATING';

export type RobotGameMode = 'LUCKY_SCAN' | 'VOICE_CALL' | 'TASK_ASSIGN';

export interface RobotGameProps {
  availableCandidates: StudentCandidate[];
  onPick: (
    student: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string }
  ) => void;
  isMuted: boolean;
  allCandidates?: StudentCandidate[];
  absentIds?: Set<string>;
  calledSessionIds?: Set<string>;
  antiDuplicate?: boolean;
  onToggleAntiDuplicate?: () => void;
  onResetSession?: () => void;
  classes?: ClassRoom[];
  questions?: Question[];
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

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Toán học',
  literature: 'Ngữ văn',
  english: 'Tiếng Anh',
  science: 'Khoa học tự nhiên',
  history_geo: 'Lịch sử & Địa lí',
  informatics: 'Tin học',
  technology: 'Công nghệ',
  civics: 'Giáo dục công dân',
  other: 'Môn khác',
};

const LEVEL_LABELS: Record<CognitiveLevel, string> = {
  know: 'Nhận biết',
  understand: 'Thông hiểu',
  apply: 'Vận dụng',
};

/**
 * Unbiased cryptographic random integer in [0, max - 1] using rejection sampling.
 */
export function secureRandomInt(max: number): number {
  if (max <= 1) return 0;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const uint32Max = 0xffffffff;
    const limit = uint32Max - (uint32Max % max);
    const buf = new Uint32Array(1);
    let rand = 0;
    do {
      window.crypto.getRandomValues(buf);
      rand = buf[0];
    } while (rand >= limit);
    return rand % max;
  }
  return Math.floor(Math.random() * max);
}

// Web Audio & strict Vietnamese TTS are handled via shared EduGameSoundBank & EduGameVoiceController.

/**
 * High-detail 2.5D/3D SVG character component for EDU Bot.
 * Supports 5 expressions (NORMAL, HAPPY, THINKING, SCANNING, CELEBRATING),
 * eye blinking, head tilting, articulated waving/scanning/celebrating arms,
 * animated speaking mouth, chest screen telemetry, and hover thruster base.
 */
const EDUSmartRobotSVG: React.FC<{
  expression: RobotExpression;
  phase: RobotGamePhase;
  isSpeaking: boolean;
  mouthFrame: number;
  isBlinking: boolean;
  reducedMotion: boolean;
  activeNumberLabel?: string;
}> = ({
  expression,
  phase,
  isSpeaking,
  mouthFrame,
  isBlinking,
  reducedMotion,
  activeNumberLabel,
}) => {
  // Determine head tilt & body bounce
  const headTransform = useMemo(() => {
    if (reducedMotion) return 'rotate(0 160 115)';
    if (expression === 'THINKING') return 'rotate(-6 160 115) translate(-3, -2)';
    if (expression === 'SCANNING') return 'rotate(3 160 115)';
    if (expression === 'CELEBRATING') return 'translate(0, -6)';
    return 'rotate(0 160 115)';
  }, [expression, reducedMotion]);

  // Left arm pose (viewer's left)
  const leftArmTransform = useMemo(() => {
    if (expression === 'CELEBRATING') return 'rotate(-135 88 188)';
    if (expression === 'HAPPY' || phase === 'IDLE') {
      return reducedMotion ? 'rotate(-20 88 188)' : 'rotate(-42 88 188)';
    }
    if (expression === 'THINKING') return 'rotate(-65 88 188)';
    if (expression === 'SCANNING') return 'rotate(-25 88 188)';
    return 'rotate(-15 88 188)';
  }, [expression, phase, reducedMotion]);

  // Right arm pose (viewer's right - points toward hologram screen during scanning)
  const rightArmTransform = useMemo(() => {
    if (expression === 'CELEBRATING') return 'rotate(135 232 188)';
    if (expression === 'SCANNING' || phase === 'INITIALIZING') return 'rotate(78 232 188)';
    if (expression === 'THINKING') return 'rotate(35 232 188)';
    return 'rotate(18 232 188)';
  }, [expression, phase]);

  // Eye glow color
  const eyeColor =
    expression === 'CELEBRATING'
      ? '#FBBF24'
      : expression === 'SCANNING'
      ? '#38BDF8'
      : expression === 'THINKING'
      ? '#A78BFA'
      : '#22D3EE';

  return (
    <svg
      viewBox="0 0 320 360"
      className="w-full h-full max-w-[290px] sm:max-w-[330px] max-h-[340px] select-none overflow-visible drop-shadow-[0_18px_32px_rgba(0,107,255,0.28)]"
      aria-label="Nhân vật EDU Bot 3D"
    >
      <defs>
        {/* 3D Metallic White-Silver Body Gradient */}
        <linearGradient id="eduBotShell" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>

        {/* Tech Blue Armor Accent */}
        <linearGradient id="eduBotBlueAccent" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#006BFF" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        {/* Visor Glass Screen */}
        <linearGradient id="eduBotVisor" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="50%" stopColor="#091326" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>

        {/* Golden Trim */}
        <linearGradient id="eduBotGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        {/* Cyan Glow Filter */}
        <filter id="eduBotNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Floor Hover Shadow & Energy Rings */}
      <g transform="translate(160, 332)">
        <ellipse
          cx="0"
          cy="0"
          rx={expression === 'CELEBRATING' ? 62 : 76}
          ry={expression === 'CELEBRATING' ? 11 : 14}
          fill="#020617"
          opacity="0.65"
        />
        <ellipse
          cx="0"
          cy="0"
          rx="58"
          ry="9"
          fill="none"
          stroke={expression === 'CELEBRATING' ? '#FBBF24' : '#38BDF8'}
          strokeWidth="2"
          strokeDasharray="8 6"
          opacity="0.75"
        />
        <ellipse
          cx="0"
          cy="-3"
          rx="36"
          ry="5"
          fill={expression === 'CELEBRATING' ? '#FBBF24' : '#006BFF'}
          opacity="0.35"
        />
      </g>

      {/* Whole Robot Floating Group */}
      <g
        style={{
          transform:
            !reducedMotion && expression === 'CELEBRATING'
              ? 'translateY(-8px)'
              : 'translateY(0px)',
          transition: 'transform 0.35s ease-in-out',
        }}
      >
        {/* Hover Thruster Base / Legs */}
        <g>
          <path
            d="M 124 278 L 196 278 L 182 312 C 180 318, 140 318, 138 312 Z"
            fill="url(#eduBotBlueAccent)"
            stroke="#BAE6FD"
            strokeWidth="1.5"
          />
          {/* Thruster Flame Glow */}
          <ellipse
            cx="160"
            cy="317"
            rx="24"
            ry="6"
            fill="#38BDF8"
            opacity="0.85"
            filter="url(#eduBotNeonGlow)"
          />
          <ellipse cx="160" cy="317" rx="14" ry="3.5" fill="#E0F2FE" />
        </g>

        {/* Left Articulated Arm (Viewer's Left) */}
        <g
          transform={leftArmTransform}
          style={{ transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {/* Shoulder Joint */}
          <circle cx="88" cy="188" r="13" fill="url(#eduBotBlueAccent)" stroke="#E2E8F0" strokeWidth="2" />
          {/* Upper & Forearm */}
          <rect
            x="56"
            y="182"
            width="32"
            height="58"
            rx="14"
            fill="url(#eduBotShell)"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          {/* Elbow Light Ring */}
          <line x1="59" y1="212" x2="85" y2="212" stroke="#38BDF8" strokeWidth="3" />
          {/* Robot Hand / Claws */}
          <circle cx="72" cy="244" r="11" fill="url(#eduBotBlueAccent)" stroke="#E0F2FE" strokeWidth="1.5" />
          <path
            d="M 63 246 C 59 255, 64 261, 68 258"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 81 246 C 85 255, 80 261, 76 258"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* Right Articulated Arm (Viewer's Right - Hologram Emitter Arm) */}
        <g
          transform={rightArmTransform}
          style={{ transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {/* Shoulder Joint */}
          <circle cx="232" cy="188" r="13" fill="url(#eduBotBlueAccent)" stroke="#E2E8F0" strokeWidth="2" />
          {/* Upper & Forearm */}
          <rect
            x="232"
            y="182"
            width="32"
            height="58"
            rx="14"
            fill="url(#eduBotShell)"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          {/* Elbow Light Ring */}
          <line x1="235" y1="212" x2="261" y2="212" stroke="#38BDF8" strokeWidth="3" />
          {/* Robot Hand / Emitter */}
          <circle
            cx="248"
            cy="244"
            r="11"
            fill={expression === 'SCANNING' ? '#38BDF8' : 'url(#eduBotBlueAccent)'}
            stroke="#E0F2FE"
            strokeWidth="1.5"
          />
          <path
            d="M 239 246 C 235 255, 240 261, 244 258"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 257 246 C 261 255, 256 261, 252 258"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* Robot Torso / Chest Chassis */}
        <g>
          {/* Neck Joint */}
          <rect
            x="142"
            y="146"
            width="36"
            height="20"
            rx="6"
            fill="#475569"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <line x1="146" y1="154" x2="174" y2="154" stroke="#38BDF8" strokeWidth="2" />

          {/* Main Torso Armor */}
          <rect
            x="92"
            y="162"
            width="136"
            height="122"
            rx="34"
            fill="url(#eduBotShell)"
            stroke="#CBD5E1"
            strokeWidth="3"
          />

          {/* Glowing Side Trim */}
          <path
            d="M 102 184 Q 98 222 106 264"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="M 218 184 Q 222 222 214 264"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Chest Collar Accent */}
          <path
            d="M 116 164 L 204 164 L 194 178 L 126 178 Z"
            fill="url(#eduBotBlueAccent)"
          />

          {/* Chest Interactive Core Display Screen */}
          <rect
            x="114"
            y="186"
            width="92"
            height="64"
            rx="14"
            fill="url(#eduBotVisor)"
            stroke={expression === 'CELEBRATING' ? '#FBBF24' : '#38BDF8'}
            strokeWidth="2.5"
          />

          {/* Chest Display Content */}
          <text
            x="160"
            y="204"
            textAnchor="middle"
            fill="#38BDF8"
            fontSize="9"
            fontWeight="800"
            letterSpacing="1.2"
          >
            TÂY ĐÔ EDU BOT
          </text>

          {expression === 'SCANNING' || phase === 'SELECTING' ? (
            <g>
              {/* Radar Pulse Bars on Chest */}
              <rect x="126" y="214" width="68" height="18" rx="4" fill="#0F172A" stroke="#0284C7" strokeWidth="1" />
              <text x="160" y="227" textAnchor="middle" fill="#38BDF8" fontSize="11" fontWeight="900">
                {activeNumberLabel || 'SCANNING...'}
              </text>
              <line x1="126" y1="240" x2="194" y2="240" stroke="#22D3EE" strokeWidth="2" strokeDasharray="6 4" />
            </g>
          ) : expression === 'CELEBRATING' ? (
            <g>
              <text x="160" y="226" textAnchor="middle" fill="#FBBF24" fontSize="13" fontWeight="900">
                ★ MATCHED ★
              </text>
              <text x="160" y="241" textAnchor="middle" fill="#FEF08A" fontSize="8.5" fontWeight="700">
                READY TO ANSWER
              </text>
            </g>
          ) : (
            <g>
              {/* AI Heartbeat Waveform */}
              <polyline
                points="124,224 138,224 144,213 152,235 160,216 168,230 174,224 196,224"
                fill="none"
                stroke="#22D3EE"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text x="160" y="242" textAnchor="middle" fill="#94A3B8" fontSize="8" fontWeight="700">
                AI CORE · ONLINE
              </text>
            </g>
          )}

          {/* Waist Belt */}
          <rect x="118" y="262" width="84" height="12" rx="6" fill="#334155" />
          <circle cx="160" cy="268" r="5" fill="url(#eduBotGold)" />
        </g>

        {/* Robot Head Assembly */}
        <g
          transform={headTransform}
          style={{ transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {/* Top Antenna */}
          <line x1="160" y1="44" x2="160" y2="20" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" />
          <circle
            cx="160"
            cy="16"
            r="9"
            fill={
              expression === 'CELEBRATING'
                ? '#FBBF24'
                : expression === 'SCANNING'
                ? '#38BDF8'
                : '#22D3EE'
            }
            filter="url(#eduBotNeonGlow)"
          />
          <circle cx="157" cy="13" r="3" fill="#FFFFFF" />

          {/* Side Ear Sensors */}
          <rect
            x="66"
            y="78"
            width="14"
            height="42"
            rx="6"
            fill="url(#eduBotBlueAccent)"
            stroke="#E2E8F0"
            strokeWidth="2"
          />
          <rect
            x="240"
            y="78"
            width="14"
            height="42"
            rx="6"
            fill="url(#eduBotBlueAccent)"
            stroke="#E2E8F0"
            strokeWidth="2"
          />

          {/* Outer Head Helmet */}
          <rect
            x="76"
            y="42"
            width="168"
            height="112"
            rx="38"
            fill="url(#eduBotShell)"
            stroke="#CBD5E1"
            strokeWidth="3.5"
          />

          {/* Forehead Badge */}
          <path
            d="M 134 44 L 186 44 L 178 56 L 142 56 Z"
            fill="url(#eduBotBlueAccent)"
          />
          <circle cx="160" cy="50" r="3" fill="#BAE6FD" />

          {/* Inner Electronic Face Visor */}
          <rect
            x="92"
            y="60"
            width="136"
            height="80"
            rx="26"
            fill="url(#eduBotVisor)"
            stroke="#38BDF8"
            strokeWidth="2.5"
          />

          {/* Visor Glass Reflection Highlight */}
          <path
            d="M 104 66 Q 160 62 212 68"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.22"
          />

          {/* LED EYES (5 distinct expressions + blinking) */}
          <g filter="url(#eduBotNeonGlow)">
            {isBlinking ? (
              <>
                <line
                  x1="114"
                  y1="92"
                  x2="144"
                  y2="92"
                  stroke={eyeColor}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
                <line
                  x1="176"
                  y1="92"
                  x2="206"
                  y2="92"
                  stroke={eyeColor}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </>
            ) : expression === 'HAPPY' || expression === 'CELEBRATING' ? (
              <>
                {/* Happy Arc Eyes */}
                <path
                  d="M 114 96 Q 129 78 144 96"
                  fill="none"
                  stroke={eyeColor}
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 176 96 Q 191 78 206 96"
                  fill="none"
                  stroke={eyeColor}
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />
              </>
            ) : expression === 'THINKING' ? (
              <>
                {/* Thinking Asymmetric Eyes Looking Up-Right */}
                <ellipse cx="129" cy="90" rx="14" ry="11" fill={eyeColor} opacity="0.25" />
                <circle cx="133" cy="86" r="7.5" fill={eyeColor} />
                <circle cx="135" cy="84" r="2.5" fill="#FFFFFF" />

                <ellipse cx="191" cy="88" rx="14" ry="13" fill={eyeColor} opacity="0.25" />
                <circle cx="195" cy="84" r="8.5" fill={eyeColor} />
                <circle cx="197" cy="82" r="2.5" fill="#FFFFFF" />
                {/* Eyebrow line */}
                <line x1="114" y1="74" x2="142" y2="78" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
                <line x1="176" y1="72" x2="206" y2="69" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
              </>
            ) : expression === 'SCANNING' ? (
              <>
                {/* Target Crosshair Scanning Eyes */}
                <rect
                  x="112"
                  y="79"
                  width="34"
                  height="24"
                  rx="8"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="3"
                />
                <circle cx="129" cy="91" r="6" fill="#E0F2FE" />
                <line x1="108" y1="91" x2="150" y2="91" stroke="#38BDF8" strokeWidth="1.5" />

                <rect
                  x="174"
                  y="79"
                  width="34"
                  height="24"
                  rx="8"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="3"
                />
                <circle cx="191" cy="91" r="6" fill="#E0F2FE" />
                <line x1="170" y1="91" x2="212" y2="91" stroke="#38BDF8" strokeWidth="1.5" />
              </>
            ) : (
              <>
                {/* Normal Friendly LED Eyes */}
                <rect x="114" y="78" width="30" height="24" rx="11" fill={eyeColor} />
                <circle cx="123" cy="85" r="3.5" fill="#FFFFFF" />
                <rect x="176" y="78" width="30" height="24" rx="11" fill={eyeColor} />
                <circle cx="185" cy="85" r="3.5" fill="#FFFFFF" />
              </>
            )}
          </g>

          {/* ELECTRONIC MOUTH (Synchronized with speaking state & expressions) */}
          <g transform="translate(160, 121)" filter="url(#eduBotNeonGlow)">
            {isSpeaking ? (
              /* Equalizer / Lip-sync LED bars while speaking */
              <g>
                {[-24, -16, -8, 0, 8, 16, 24].map((xOffset, idx) => {
                  const heights = [
                    [6, 14, 10, 18, 12, 15, 7],
                    [10, 8, 16, 10, 18, 8, 11],
                    [5, 16, 12, 20, 10, 14, 6],
                    [8, 10, 18, 14, 16, 12, 9],
                  ];
                  const h = heights[mouthFrame % heights.length][idx];
                  return (
                    <rect
                      key={xOffset}
                      x={xOffset - 2.5}
                      y={-h / 2}
                      width="5"
                      height={h}
                      rx="2.5"
                      fill={expression === 'CELEBRATING' ? '#FBBF24' : '#38BDF8'}
                    />
                  );
                })}
              </g>
            ) : expression === 'CELEBRATING' ? (
              /* Wide Open Happy Smile */
              <path
                d="M -22 -4 Q 0 18 22 -4 Z"
                fill="#FBBF24"
                stroke="#FEF08A"
                strokeWidth="2"
              />
            ) : expression === 'THINKING' ? (
              /* Thinking wavy/small oval mouth */
              <path
                d="M -14 2 Q -5 -4 4 2 Q 11 6 16 0"
                fill="none"
                stroke="#A78BFA"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            ) : expression === 'SCANNING' ? (
              /* Digital Telemetry Line Mouth */
              <g>
                <rect x="-24" y="-3" width="48" height="6" rx="3" fill="#0284C7" opacity="0.45" />
                <rect x="-14" y="-3" width="28" height="6" rx="3" fill="#38BDF8" />
              </g>
            ) : (
              /* Friendly Curved Smile */
              <path
                d="M -18 -2 Q 0 11 18 -2"
                fill="none"
                stroke="#22D3EE"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
          </g>
        </g>

        {/* Scanning Laser Beam emitted toward the Hologram on the right */}
        {(phase === 'SCANNING' || phase === 'SELECTING') && (
          <g className="pointer-events-none">
            <polygon
              points="206,91 320,30 320,175"
              fill="#38BDF8"
              opacity="0.16"
            />
            <line
              x1="206"
              y1="91"
              x2="318"
              y2="91"
              stroke="#38BDF8"
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
          </g>
        )}
      </g>
    </svg>
  );
};

export const RobotGame: React.FC<RobotGameProps> = ({
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
  questions = [],
  selectedSourceKey = '',
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  teacherId = '',
  userRole = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  onToggleMute,
  onOpenAbsentModal,
  onOpenHistoryModal,
  onUpdateLatestNote,
}) => {
  // Game State Machine: IDLE -> INITIALIZING -> SCANNING -> SELECTING -> REVEALING -> SPEAKING -> COMPLETED
  const [phase, setPhase] = useState<RobotGamePhase>('IDLE');
  const [robotMode, setRobotMode] = useState<RobotGameMode>('LUCKY_SCAN');
  const [expression, setExpression] = useState<RobotExpression>('NORMAL');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Selected Winner & Previous Result
  const [currentWinner, setCurrentWinner] = useState<StudentCandidate | null>(null);
  const [previousWinner, setPreviousWinner] = useState<StudentCandidate | null>(null);
  const [robotSpeechText, setRobotSpeechText] = useState<string>(
    'Xin chào! EDU Bot đã sẵn sàng chọn một bạn may mắn.'
  );

  // Hologram scanning visual state
  const [scanHighlightIndex, setScanHighlightIndex] = useState<number | null>(null);
  const [scanBeamPercent, setScanBeamPercent] = useState<number>(0);
  const [hologramPage, setHologramPage] = useState<number>(0);
  const CARDS_PER_PAGE = 12;

  // Eye Blinking & Speaking Mouth Animation
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [mouthFrame, setMouthFrame] = useState<number>(0);

  // Web Speech API (Strict Vietnamese TTS via EduGameVoiceController) State
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [vietnameseVoices, setVietnameseVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);

  // Mode 3: Task Assignment (Ngân hàng câu hỏi) Filters & State
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedChapter, setSelectedChapter] = useState<string>('ALL');
  const [selectedLesson, setSelectedLesson] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [assignedQuestion, setAssignedQuestion] = useState<Question | null>(null);
  const [selectedAnswerOption, setSelectedAnswerOption] = useState<string>('');
  const [showQuestionExplanation, setShowQuestionExplanation] = useState<boolean>(false);
  const [answerEvaluation, setAnswerEvaluation] = useState<'correct' | 'needs_improvement' | null>(null);

  // Answer Countdown Timer (15s, 30s default, 60s, Custom)
  const [answerDuration, setAnswerDuration] = useState<number>(30);
  const [customDurationInput, setCustomDurationInput] = useState<string>('45');
  const [isCustomTimer, setIsCustomTimer] = useState<boolean>(false);
  const [answerTimeLeft, setAnswerTimeLeft] = useState<number>(30);
  const [isAnswerTimerRunning, setIsAnswerTimerRunning] = useState<boolean>(false);

  // Evaluation Note & Bonus Points
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [teacherNote, setTeacherNote] = useState<string>('');

  // Session & Supabase Sync
  const [sessionId] = useState<string>(() => `A12_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const [turnCounter, setTurnCounter] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  // Refs for cleanup, live audio state & anti-double-click
  const isProcessingRef = useRef<boolean>(false);
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceControllerRef = useRef<EduGameVoiceController | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const selectedVoiceURIRef = useRef<string>(selectedVoiceURI);
  const activeTurnTokenRef = useRef<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const syncedTurnSetRef = useRef<Set<string>>(new Set());

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    intervalsRef.current.forEach((id) => window.clearInterval(id));
    intervalsRef.current = [];
  }, []);

  const stopSpeech = useCallback(() => {
    voiceControllerRef.current?.stop();
    setIsSpeaking(false);
  }, []);

  // Initialize shared SoundBank + strict Vietnamese VoiceController & cleanup on unmount
  useEffect(() => {
    const bank = new EduGameSoundBank();
    const voice = new EduGameVoiceController(selectedVoiceURIRef.current || null);
    soundBankRef.current = bank;
    voiceControllerRef.current = voice;

    const unsubscribe = voice.subscribe((snapshot) => {
      const supported = snapshot.status !== 'UNSUPPORTED_BROWSER';
      setSpeechSupported(supported);
      setVietnameseVoices(snapshot.vietnameseVoices.map((opt) => opt.voice));
      if (!supported) {
        setVoiceWarning(
          'Trình duyệt hiện tại không hỗ trợ Web Speech API. EDU Bot sẽ hiển thị lời thoại bằng văn bản.'
        );
      } else if (snapshot.hasVietnameseVoice && snapshot.vietnameseVoices.length > 0) {
        setSelectedVoiceURI(
          (prev) => prev || snapshot.selectedVoice?.voiceURI || snapshot.vietnameseVoices[0].voiceURI
        );
        setVoiceWarning(null);
      } else if (snapshot.status === 'UNAVAILABLE_NO_VI_VOICE') {
        setVoiceWarning(
          'Thiết bị/trình duyệt chưa cài đặt giọng đọc Tiếng Việt (vi-VN). EDU Bot sẽ tự động hiển thị tên và lời thoại trên màn hình (không đọc bằng giọng tiếng Anh).'
        );
      }
    });

    return () => {
      unsubscribe();
      clearAllTimers();
      activeTurnTokenRef.current = null;
      bank.dispose();
      voice.dispose();
      if (soundBankRef.current === bank) soundBankRef.current = null;
      if (voiceControllerRef.current === voice) voiceControllerRef.current = null;
    };
  }, [clearAllTimers]);

  // Immediately silence Web Audio & speech when muted
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      soundBankRef.current?.stopAll();
      voiceControllerRef.current?.stop();
      setIsSpeaking(false);
    }
  }, [isMuted]);

  // Persist voiceEnabled preference & stop speech immediately when disabled
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
    saveEduGameVoiceEnabled(voiceEnabled);
    if (!voiceEnabled) {
      voiceControllerRef.current?.stop();
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  useEffect(() => {
    selectedVoiceURIRef.current = selectedVoiceURI;
    voiceControllerRef.current?.setPreferredVoiceURI(selectedVoiceURI || null);
  }, [selectedVoiceURI]);

  // Periodic natural eye blinking
  useEffect(() => {
    if (reducedMotion) return;
    const blinkInterval = window.setInterval(() => {
      setIsBlinking(true);
      const t = window.setTimeout(() => setIsBlinking(false), 150);
      timersRef.current.push(t);
    }, 3400);
    return () => window.clearInterval(blinkInterval);
  }, [reducedMotion]);

  // Animated mouth frames while speaking
  useEffect(() => {
    if (!isSpeaking) {
      setMouthFrame(0);
      return;
    }
    const mouthInterval = window.setInterval(() => {
      setMouthFrame((prev) => (prev + 1) % 4);
    }, 110);
    return () => window.clearInterval(mouthInterval);
  }, [isSpeaking]);

  // Present students list (excluding absent students)
  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((s) => !absentIds.has(s.id));
  }, [allCandidates, availableCandidates, absentIds]);

  // Pagination for Hologram student cards
  const totalPages = Math.max(1, Math.ceil(presentStudents.length / CARDS_PER_PAGE));
  useEffect(() => {
    if (hologramPage >= totalPages) {
      setHologramPage(Math.max(0, totalPages - 1));
    }
  }, [hologramPage, totalPages]);

  const visibleHologramStudents = useMemo(() => {
    const start = hologramPage * CARDS_PER_PAGE;
    return presentStudents.slice(start, start + CARDS_PER_PAGE).map((student, idx) => ({
      student,
      globalIndex: start + idx,
      orderCode: String(start + idx + 1).padStart(2, '0'),
    }));
  }, [presentStudents, hologramPage]);

  // Approved & Authorized Questions for Mode 3 (Robot Giao Nhiệm Vụ)
  const authorizedQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.status === 'approved') return true;
      if (userRole === 'admin' || userRole === 'reviewer') return true;
      return false;
    });
  }, [questions, userRole]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    authorizedQuestions.forEach((q) => {
      if (q.subject) set.add(q.subject);
    });
    return Array.from(set);
  }, [authorizedQuestions]);

  const availableChapters = useMemo(() => {
    const set = new Set<string>();
    authorizedQuestions
      .filter((q) => selectedSubject === 'ALL' || q.subject === selectedSubject)
      .forEach((q) => {
        if (q.chapter) set.add(q.chapter);
      });
    return Array.from(set);
  }, [authorizedQuestions, selectedSubject]);

  const availableLessons = useMemo(() => {
    const set = new Set<string>();
    authorizedQuestions
      .filter(
        (q) =>
          (selectedSubject === 'ALL' || q.subject === selectedSubject) &&
          (selectedChapter === 'ALL' || q.chapter === selectedChapter)
      )
      .forEach((q) => {
        if (q.lesson) set.add(q.lesson);
      });
    return Array.from(set);
  }, [authorizedQuestions, selectedSubject, selectedChapter]);

  const filteredTaskQuestions = useMemo(() => {
    return authorizedQuestions.filter((q) => {
      if (selectedSubject !== 'ALL' && q.subject !== selectedSubject) return false;
      if (selectedChapter !== 'ALL' && q.chapter !== selectedChapter) return false;
      if (selectedLesson !== 'ALL' && q.lesson !== selectedLesson) return false;
      if (selectedLevel !== 'ALL' && q.level !== selectedLevel) return false;
      return true;
    });
  }, [authorizedQuestions, selectedSubject, selectedChapter, selectedLesson, selectedLevel]);

  // Independent Answer Countdown Timer
  useEffect(() => {
    if (!isAnswerTimerRunning) return;
    const interval = window.setInterval(() => {
      setAnswerTimeLeft((prev) => {
        if (prev <= 1) {
          setIsAnswerTimerRunning(false);
          soundBankRef.current?.playTimerBell(isMutedRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isAnswerTimerRunning]);

  // Speak Vietnamese announcement strictly (NEVER falls back to English) via EduGameVoiceController
  const speakVietnameseText = useCallback(
    (
      text: string,
      onDone?: () => void,
      options?: { turnId?: string; studentName?: string; isReplay?: boolean }
    ) => {
      const voice = voiceControllerRef.current;
      stopSpeech();

      if (!voice || isMutedRef.current || !voiceEnabledRef.current) {
        setIsSpeaking(false);
        onDone?.();
        return;
      }

      const snapshot = voice.getSnapshot();
      if (snapshot.status === 'UNSUPPORTED_BROWSER' || !snapshot.hasVietnameseVoice) {
        // Strict Vietnamese-only rule: skip TTS cleanly without blocking UI or speaking English
        setIsSpeaking(false);
        onDone?.();
        return;
      }

      const turnAtStart = activeTurnTokenRef.current;
      setIsSpeaking(true);
      const speakPromise =
        !options?.isReplay && options?.turnId
          ? voice.announceStudentOnce({
              turnId: options.turnId,
              studentName: options.studentName || '',
              customText: text,
              isMuted: isMutedRef.current,
              voiceEnabled: voiceEnabledRef.current,
              preferredVoiceURI: selectedVoiceURIRef.current || null,
            })
          : voice.replayText({
              text,
              isMuted: isMutedRef.current,
              voiceEnabled: voiceEnabledRef.current,
              preferredVoiceURI: selectedVoiceURIRef.current || null,
            });

      void speakPromise.then((result) => {
        if (activeTurnTokenRef.current !== turnAtStart || isMutedRef.current || !voiceEnabledRef.current) {
          setIsSpeaking(false);
          onDone?.();
          return;
        }
        if (!result.spoken) {
          setIsSpeaking(false);
          onDone?.();
          return;
        }
        // Keep mouth animation active briefly while Vietnamese utterance plays, then finish cleanly
        const finishTimer = window.setTimeout(() => {
          setIsSpeaking(false);
          onDone?.();
        }, Math.min(2600, Math.max(1100, text.length * 42)));
        timersRef.current.push(finishTimer);
      }).catch(() => {
        setIsSpeaking(false);
        onDone?.();
      });
    },
    [stopSpeech]
  );

  // Persist turn record to Supabase audit_logs without duplicate entries
  const persistTurnToSupabase = useCallback(
    async (
      student: StudentCandidate,
      turnIndex: number,
      points: number,
      noteText: string,
      questionCode?: string
    ) => {
      const turnKey = `${sessionId}_${turnIndex}_${student.id}`;
      if (syncedTurnSetRef.current.has(turnKey) && points === 0 && !noteText) {
        return;
      }
      syncedTurnSetRef.current.add(turnKey);

      if (!isSupabaseConfigured) {
        setSyncStatus('idle');
        return;
      }

      setSyncStatus('syncing');
      setLastSyncError(null);
      try {
        const { error } = await supabase.from('audit_logs').insert({
          actor_id: teacherId || null,
          actor_role: userRole || 'teacher',
          action_type: 'edu_game_robot_pick',
          entity_type: 'edu_game_session',
          entity_id: sessionId,
          metadata: {
            game_id: 'A12',
            game_title: 'Robot chọn bạn (EDU Smart Robot)',
            robot_mode: robotMode,
            session_id: sessionId,
            class_id: selectedSourceKey || resolvedClassName,
            class_name: resolvedClassName,
            student_id: student.id,
            student_code: student.code || null,
            student_name: student.fullName,
            selected_at: new Date().toISOString(),
            note: noteText || null,
            reward_points: points,
            question_code: questionCode || null,
          },
        });

        if (error) {
          setSyncStatus('error');
          setLastSyncError(error.message);
        } else {
          setSyncStatus('synced');
        }
      } catch (err) {
        setSyncStatus('error');
        setLastSyncError(err instanceof Error ? err.message : 'Lỗi kết nối CSDL');
      }
    },
    [sessionId, teacherId, userRole, robotMode, selectedSourceKey, resolvedClassName]
  );

  // Reset state when switching class
  useEffect(() => {
    clearAllTimers();
    activeTurnTokenRef.current = null;
    soundBankRef.current?.setActiveTurnToken(null);
    soundBankRef.current?.stopAll();
    stopSpeech();
    isProcessingRef.current = false;
    setPhase('IDLE');
    setExpression('NORMAL');
    setCurrentWinner(null);
    setPreviousWinner(null);
    setAssignedQuestion(null);
    setScanHighlightIndex(null);
    setRobotSpeechText('Xin chào! EDU Bot đã sẵn sàng chọn một bạn may mắn.');
  }, [selectedSourceKey, clearAllTimers, stopSpeech]);

  // Main action: Start EDU Bot Scan & Selection
  const handleStartRobotScan = () => {
    if (isProcessingRef.current) return;
    if (
      phase === 'INITIALIZING' ||
      phase === 'SCANNING' ||
      phase === 'SELECTING' ||
      phase === 'REVEALING' ||
      phase === 'SPEAKING'
    ) {
      return;
    }

    if (availableCandidates.length === 0) {
      setExpression('THINKING');
      setRobotSpeechText(
        'Tất cả học sinh hợp lệ trong lớp đã được gọi trong phiên này! Thầy/Cô hãy nhấn "Làm mới phiên" để tiếp tục.'
      );
      return;
    }

    // Unlock Web Audio synchronously inside user click & silence any prior sound/speech
    soundBankRef.current?.unlock();
    soundBankRef.current?.stopAll();
    stopSpeech();

    // Lock processing to prevent double-clicks
    isProcessingRef.current = true;
    clearAllTimers();

    const turnToken = `a12_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    activeTurnTokenRef.current = turnToken;
    soundBankRef.current?.setActiveTurnToken(turnToken);

    // Move previous winner to "Kết quả lượt trước"
    if (currentWinner) {
      setPreviousWinner(currentWinner);
    }
    setCurrentWinner(null);
    setBonusPoints(0);
    setTeacherNote('');
    setAnswerEvaluation(null);
    setSelectedAnswerOption('');
    setShowQuestionExplanation(false);
    setIsAnswerTimerRunning(false);
    setAnswerTimeLeft(answerDuration);

    // Fair 1/N selection UPFRONT before animation starts (never revealed until REVEALING phase)
    const winnerIdx = secureRandomInt(availableCandidates.length);
    const chosenStudent = availableCandidates[winnerIdx];
    const targetGlobalIdx = Math.max(
      0,
      presentStudents.findIndex((s) => s.id === chosenStudent.id)
    );
    const targetPage = Math.floor(targetGlobalIdx / CARDS_PER_PAGE);

    // If Mode 3 (TASK_ASSIGN), pick an approved question from the filtered pool upfront
    let chosenQuestion: Question | null = null;
    if (robotMode === 'TASK_ASSIGN') {
      if (filteredTaskQuestions.length > 0) {
        chosenQuestion = filteredTaskQuestions[secureRandomInt(filteredTaskQuestions.length)];
      }
    }

    const nextTurnNumber = turnCounter + 1;
    setTurnCounter(nextTurnNumber);

    // PHASE 1: INITIALIZING
    setPhase('INITIALIZING');
    setExpression('HAPPY');
    setRobotSpeechText('EDU Bot đang khởi động hệ thống radar hologram và nạp danh sách lớp...');
    soundBankRef.current?.playRobotBoot(isMutedRef.current, turnToken);

    const initDuration = reducedMotion ? 250 : 650;
    const scanDuration = reducedMotion ? 900 : 2100;
    const selectingDuration = reducedMotion ? 450 : 950;
    const revealDuration = reducedMotion ? 350 : 650;

    // PHASE 2: SCANNING
    const tScan = window.setTimeout(() => {
      if (activeTurnTokenRef.current !== turnToken) return;
      setPhase('SCANNING');
      setExpression('SCANNING');
      setRobotSpeechText('Đang quét tín hiệu ngẫu nhiên công bằng trên toàn bộ thẻ học sinh...');

      let step = 0;
      const scanInterval = window.setInterval(() => {
        if (activeTurnTokenRef.current !== turnToken) {
          window.clearInterval(scanInterval);
          return;
        }
        step += 1;
        setScanBeamPercent((step * 14) % 100);
        if (presentStudents.length > 0) {
          // Visual-only random highlight on current hologram page (does not leak winner early)
          const randomVisualIdx = secureRandomInt(presentStudents.length);
          setScanHighlightIndex(randomVisualIdx);
        }
        soundBankRef.current?.playRobotScanPulse(step, isMutedRef.current, turnToken);
      }, 135);
      intervalsRef.current.push(scanInterval);
    }, initDuration);

    // PHASE 3: SELECTING (Robot Thinking & Locking onto target page)
    const tSelect = window.setTimeout(() => {
      if (activeTurnTokenRef.current !== turnToken) return;
      intervalsRef.current.forEach((id) => window.clearInterval(id));
      intervalsRef.current = [];
      setPhase('SELECTING');
      setExpression('THINKING');
      setHologramPage(targetPage);
      setScanHighlightIndex(targetGlobalIdx);
      setScanBeamPercent(100);
      setRobotSpeechText('EDU Bot đang phân tích tín hiệu và khóa tọa độ bạn may mắn...');
      soundBankRef.current?.playRobotTargetFound(isMutedRef.current, turnToken);
    }, initDuration + scanDuration);

    // PHASE 4: REVEALING
    const tReveal = window.setTimeout(() => {
      if (activeTurnTokenRef.current !== turnToken) return;
      setPhase('REVEALING');
      setExpression('CELEBRATING');
      setCurrentWinner(chosenStudent);
      setAssignedQuestion(chosenQuestion);
      soundBankRef.current?.playRevealChime(isMutedRef.current, turnToken);

      const spokenAnnouncement =
        robotMode === 'VOICE_CALL'
          ? `Xin chào cả lớp! Bạn được mời trả lời câu hỏi tiếp theo là ${chosenStudent.fullName}. Mời bạn chuẩn bị!`
          : robotMode === 'TASK_ASSIGN'
          ? `Chúc mừng bạn ${chosenStudent.fullName}! EDU Bot đã chọn một nhiệm vụ học tập dành cho bạn.`
          : `Chúc mừng bạn ${chosenStudent.fullName} đã được EDU Bot lựa chọn!`;

      setRobotSpeechText(spokenAnnouncement);

      // Notify parent EDUGameCenter & persist to Supabase
      onPick(chosenStudent, {
        bonusPoints: 0,
        note: chosenQuestion ? `Nhiệm vụ: ${chosenQuestion.code}` : undefined,
        sessionId,
      });
      persistTurnToSupabase(chosenStudent, nextTurnNumber, 0, '', chosenQuestion?.code);
    }, initDuration + scanDuration + selectingDuration);

    // PHASE 5: SPEAKING -> PHASE 6: COMPLETED
    const tSpeak = window.setTimeout(() => {
      if (activeTurnTokenRef.current !== turnToken) return;
      setPhase('SPEAKING');
      const spokenAnnouncement =
        robotMode === 'VOICE_CALL'
          ? `Xin chào cả lớp! Bạn được mời trả lời câu hỏi tiếp theo là ${chosenStudent.fullName}. Mời bạn chuẩn bị!`
          : robotMode === 'TASK_ASSIGN'
          ? `Xin mời bạn ${chosenStudent.fullName} thực hiện nhiệm vụ trên màn hình!`
          : `Xin mời bạn ${chosenStudent.fullName}!`;

      speakVietnameseText(
        spokenAnnouncement,
        () => {
          if (activeTurnTokenRef.current !== turnToken) return;
          setPhase('COMPLETED');
          setExpression('HAPPY');
          isProcessingRef.current = false;
        },
        {
          turnId: `${sessionId}_${turnToken}_${chosenStudent.id}`,
          studentName: chosenStudent.fullName,
        }
      );
    }, initDuration + scanDuration + selectingDuration + revealDuration);

    timersRef.current.push(tScan, tSelect, tReveal, tSpeak);
  };

  // Replay Vietnamese voice for current winner
  const handleReplayVoice = () => {
    if (!currentWinner) return;
    soundBankRef.current?.unlock();
    const text =
      robotMode === 'VOICE_CALL'
        ? `Xin chào cả lớp! Bạn được mời trả lời câu hỏi tiếp theo là ${currentWinner.fullName}. Mời bạn chuẩn bị!`
        : `Xin mời bạn ${currentWinner.fullName}!`;
    setRobotSpeechText(text);
    speakVietnameseText(text, undefined, { isReplay: true });
  };

  // Apply bonus points or teacher note for the current winner
  const handleApplyBonusPoints = (delta: number) => {
    if (!currentWinner) return;
    const nextPoints = Math.max(0, bonusPoints + delta);
    setBonusPoints(nextPoints);
    const summaryNote = `${teacherNote ? teacherNote + ' · ' : ''}+${nextPoints} điểm thưởng`;
    onUpdateLatestNote?.(summaryNote);
    persistTurnToSupabase(
      currentWinner,
      turnCounter,
      nextPoints,
      teacherNote,
      assignedQuestion?.code
    );
  };

  const handleSaveTeacherNote = () => {
    if (!currentWinner) return;
    const summaryNote = `${teacherNote}${bonusPoints > 0 ? ` (+${bonusPoints}đ)` : ''}`;
    onUpdateLatestNote?.(summaryNote);
    persistTurnToSupabase(
      currentWinner,
      turnCounter,
      bonusPoints,
      teacherNote,
      assignedQuestion?.code
    );
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isBusy =
    phase === 'INITIALIZING' ||
    phase === 'SCANNING' ||
    phase === 'SELECTING' ||
    phase === 'REVEALING' ||
    phase === 'SPEAKING';

  return (
    <div className="w-full space-y-4">
      {/* Top Control Header Bar */}
      <div className="bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-3 sm:p-4 shadow-xl text-white flex flex-wrap items-center justify-between gap-3">
        {/* Left: Game Identity & Mode Selector */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 px-3 py-1.5 rounded-xl">
            <Bot className="w-5 h-5 text-cyan-300" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                A12 · EDU SMART ROBOT
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white">
                Robot Chọn Bạn Thông Minh
              </div>
            </div>
          </div>

          {/* 3 Modes Switcher */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setRobotMode('LUCKY_SCAN')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                robotMode === 'LUCKY_SCAN'
                  ? 'bg-[#006BFF] text-white shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>1. Quét may mắn</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setRobotMode('VOICE_CALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                robotMode === 'VOICE_CALL'
                  ? 'bg-[#006BFF] text-white shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>2. Robot gọi tên</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setRobotMode('TASK_ASSIGN')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                robotMode === 'TASK_ASSIGN'
                  ? 'bg-[#006BFF] text-white shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>3. Giao nhiệm vụ</span>
            </button>
          </div>
        </div>

        {/* Right: Class Selector, Anti-duplicate, Voice, Reduced Motion, Fullscreen */}
        <div className="flex flex-wrap items-center gap-2">
          {classes.length > 0 && onSelectSourceKey && (
            <select
              value={selectedSourceKey}
              disabled={isBusy}
              onChange={(e) => onSelectSourceKey(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  Lớp {cls.name} ({cls.studentCount} HS)
                </option>
              ))}
            </select>
          )}

          {/* Anti-duplicate Toggle */}
          {onToggleAntiDuplicate && (
            <button
              type="button"
              disabled={isBusy}
              onClick={onToggleAntiDuplicate}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                antiDuplicate
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Bật/Tắt chế độ không gọi lặp học sinh trong phiên"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Không lặp: {antiDuplicate ? 'BẬT' : 'TẮT'}</span>
            </button>
          )}

          {/* Voice Toggle */}
          <button
            type="button"
            onClick={() => {
              if (voiceEnabled) stopSpeech();
              setVoiceEnabled((v) => !v);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              voiceEnabled && !isMuted
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Bật/Tắt giọng đọc Tiếng Việt (Web Speech API)"
          >
            {voiceEnabled && !isMuted ? (
              <Mic className="w-3.5 h-3.5 text-cyan-300" />
            ) : (
              <MicOff className="w-3.5 h-3.5" />
            )}
            <span>Giọng đọc: {voiceEnabled && !isMuted ? 'BẬT' : 'TẮT'}</span>
          </button>

          {/* Reduced Motion Toggle */}
          <button
            type="button"
            onClick={() => setReducedMotion((r) => !r)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              reducedMotion
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Giảm hiệu ứng chuyển động cho máy tính cấu hình yếu"
          >
            {reducedMotion ? 'Giảm chuyển động: BẬT' : 'Hiệu ứng: Đầy đủ'}
          </button>

          {/* Sound Mute Button */}
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
            </button>
          )}

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình máy chiếu'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Mode 3 Question Bank Filters Bar */}
      {robotMode === 'TASK_ASSIGN' && (
        <div className="bg-indigo-950/90 border border-indigo-400/30 rounded-2xl p-3.5 text-white shadow-lg space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-200">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Bộ lọc nhiệm vụ từ Ngân hàng câu hỏi ({filteredTaskQuestions.length} câu hợp lệ)</span>
            </div>
            <span className="text-[11px] text-indigo-300">
              Chỉ sử dụng câu hỏi đã phê duyệt hoặc có quyền truy cập hợp lệ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase text-indigo-300 mb-1">
                1. Môn học
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedChapter('ALL');
                  setSelectedLesson('ALL');
                }}
                className="w-full bg-slate-900 border border-indigo-500/40 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white"
              >
                <option value="ALL">Tất cả môn ({availableSubjects.length})</option>
                {availableSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {SUBJECT_LABELS[sub] || sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-indigo-300 mb-1">
                2. Chương / Chủ đề
              </label>
              <select
                value={selectedChapter}
                onChange={(e) => {
                  setSelectedChapter(e.target.value);
                  setSelectedLesson('ALL');
                }}
                className="w-full bg-slate-900 border border-indigo-500/40 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white"
              >
                <option value="ALL">Tất cả chương ({availableChapters.length})</option>
                {availableChapters.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-indigo-300 mb-1">
                3. Bài học
              </label>
              <select
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/40 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white"
              >
                <option value="ALL">Tất cả bài học ({availableLessons.length})</option>
                {availableLessons.map((ls) => (
                  <option key={ls} value={ls}>
                    {ls}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-indigo-300 mb-1">
                4. Mức độ nhận thức
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/40 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white"
              >
                <option value="ALL">Mọi mức độ</option>
                <option value="know">{LEVEL_LABELS.know}</option>
                <option value="understand">{LEVEL_LABELS.understand}</option>
                <option value="apply">{LEVEL_LABELS.apply}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main 12-Column Responsive Layout (70-75% Stage Left, 25-30% Control & Result Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT STAGE: Futuristic AI Control Room + EDU Bot + Hologram Matrix */}
        <div
          className={`lg:col-span-8 xl:col-span-9 relative rounded-3xl border-2 border-cyan-400/40 bg-gradient-to-b from-[#071126] via-[#0B1D3A] to-[#09152B] shadow-2xl overflow-hidden flex flex-col justify-between p-4 sm:p-6 ${
            isFullscreen ? 'min-h-[640px]' : 'min-h-[540px]'
          }`}
        >
          {/* Futuristic Perspective Grid Floor & Ambient Tech Rings */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle at 28% 35%, rgba(56, 189, 248, 0.28), transparent 45%), radial-gradient(circle at 75% 50%, rgba(99, 102, 241, 0.22), transparent 50%), linear-gradient(to right, rgba(56, 189, 248, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.08) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 100% 100%, 36px 36px, 36px 36px',
            }}
          />

          {/* Stage Top Status Telemetry Bar */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-cyan-500/20">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-cyan-500/20 text-cyan-200 border border-cyan-400/40">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                PHÒNG ĐIỀU KHIỂN HOLOGRAM AI
              </span>
              <span className="text-xs font-bold text-slate-300">
                Lớp: <strong className="text-amber-300">{resolvedClassName}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-cyan-200 font-bold">
                Có mặt: {presentStudents.length} HS
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 font-bold">
                Hợp lệ còn lại: {availableCandidates.length} bạn
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-950/90 border border-purple-400/30 text-purple-200 font-bold">
                Biểu cảm: {expression}
              </span>
            </div>
          </div>

          {/* Center Interactive Stage: Robot Character (Left) + Hologram Screen (Right) */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-5 my-auto py-3 items-center">
            {/* EDU Bot Character Column */}
            <div className="md:col-span-5 flex flex-col items-center justify-center relative">
              {/* Speech Bubble Above Robot */}
              <div className="w-full max-w-xs mb-2 bg-slate-900/95 border-2 border-cyan-400/50 rounded-2xl p-3 shadow-lg relative">
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 mb-1">
                  <span>🤖 EDU BOT THÔNG BÁO</span>
                  {isSpeaking && (
                    <span className="text-amber-300 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 animate-bounce" /> Đang nói...
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                  “{robotSpeechText}”
                </p>
                {/* Speech pointer triangle */}
                <div className="w-3 h-3 bg-slate-900 border-r-2 border-b-2 border-cyan-400/50 rotate-45 absolute -bottom-2 left-1/2 -translate-x-1/2" />
              </div>

              {/* 2.5D/3D Multi-layer Animated Robot SVG */}
              <div className="w-full flex items-center justify-center">
                <EDUSmartRobotSVG
                  expression={expression}
                  phase={phase}
                  isSpeaking={isSpeaking}
                  mouthFrame={mouthFrame}
                  isBlinking={isBlinking}
                  reducedMotion={reducedMotion}
                  activeNumberLabel={
                    scanHighlightIndex !== null
                      ? `#${String(scanHighlightIndex + 1).padStart(2, '0')}`
                      : undefined
                  }
                />
              </div>

              {/* Expression Quick Preview Bar (5 states) */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                {(
                  [
                    { id: 'NORMAL', label: 'Bình thường' },
                    { id: 'HAPPY', label: 'Vui vẻ' },
                    { id: 'THINKING', label: 'Suy nghĩ' },
                    { id: 'SCANNING', label: 'Đang quét' },
                    { id: 'CELEBRATING', label: 'Chúc mừng' },
                  ] as { id: RobotExpression; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setExpression(item.id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                      expression === item.id
                        ? 'bg-cyan-500 text-slate-950 border-white shadow-xs'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hologram Projection Matrix Column */}
            <div className="md:col-span-7 flex flex-col justify-between h-full">
              <div className="relative rounded-2xl border-2 border-cyan-400/50 bg-slate-950/80 backdrop-blur-md p-4 shadow-[0_0_35px_rgba(56,189,248,0.18)] overflow-hidden min-h-[340px] flex flex-col justify-between">
                {/* Animated Laser Scan Beam across Hologram during SCANNING */}
                {(phase === 'SCANNING' || phase === 'SELECTING') && (
                  <div
                    className="
                      absolute left-0 right-0 h-2 bg-gradient-to-r from-transparent via-cyan-300 to-transparent
                      shadow-[0_0_20px_#38BDF8] pointer-events-none z-20 transition-all duration-150
                    "
                    style={{ top: `${scanBeamPercent}%` }}
                  />
                )}

                {/* Hologram Header */}
                <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-2.5 z-10">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                    <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-cyan-200">
                      MÀN HÌNH HOLOGRAM DANH SÁCH LỚP
                    </span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHologramPage((p) => Math.max(0, p - 1))}
                        disabled={hologramPage === 0}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-200 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-[11px] font-bold text-slate-300">
                        Trang {hologramPage + 1}/{totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHologramPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={hologramPage >= totalPages - 1}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-200 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Student Hologram Cards Grid */}
                {presentStudents.length === 0 ? (
                  <div className="my-auto text-center py-12 space-y-2">
                    <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                    <p className="text-sm font-bold text-white">
                      Chưa có học sinh có mặt trong lớp được chọn.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3 z-10">
                    {visibleHologramStudents.map(({ student, globalIndex, orderCode }) => {
                      const isAlreadyCalled =
                        antiDuplicate &&
                        calledSessionIds.has(student.id) &&
                        currentWinner?.id !== student.id;
                      const isScanningHighlight =
                        (phase === 'SCANNING' || phase === 'SELECTING') &&
                        scanHighlightIndex === globalIndex;
                      const isWinnerRevealed =
                        (phase === 'REVEALING' || phase === 'SPEAKING' || phase === 'COMPLETED') &&
                        currentWinner?.id === student.id;

                      return (
                        <div
                          key={student.id}
                          className={`relative rounded-xl p-2.5 border transition-all duration-200 flex flex-col justify-between ${
                            isWinnerRevealed
                              ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-slate-950 border-white scale-105 shadow-[0_0_25px_rgba(251,191,36,0.75)] z-20'
                              : isScanningHighlight
                              ? 'bg-cyan-500/30 border-cyan-300 text-white scale-[1.03] shadow-[0_0_16px_rgba(56,189,248,0.55)]'
                              : isAlreadyCalled
                              ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-50'
                              : 'bg-slate-900/85 border-cyan-500/30 text-cyan-100 hover:border-cyan-400/60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-extrabold">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                isWinnerRevealed
                                  ? 'bg-slate-950 text-amber-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              #{orderCode}
                            </span>
                            <span className="truncate opacity-80">
                              {student.code || 'HS'}
                            </span>
                          </div>

                          <div className="mt-1.5 font-extrabold text-xs sm:text-sm truncate">
                            {phase === 'SCANNING' || phase === 'INITIALIZING'
                              ? '••••••••••••'
                              : student.fullName}
                          </div>

                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            {isWinnerRevealed ? (
                              <span className="font-black uppercase tracking-wider flex items-center gap-1">
                                <Trophy className="w-3 h-3" /> ĐƯỢC CHỌN
                              </span>
                            ) : isAlreadyCalled ? (
                              <span>Đã gọi</span>
                            ) : (
                              <span className="text-cyan-300/80">Sẵn sàng</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Winner Big Spotlight Banner inside Hologram */}
                {(phase === 'REVEALING' || phase === 'SPEAKING' || phase === 'COMPLETED') &&
                  currentWinner && (
                    <div className="relative z-20 mt-2 bg-gradient-to-r from-amber-500/20 via-cyan-500/25 to-indigo-500/20 border-2 border-amber-400 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-md shrink-0">
                          {String(
                            Math.max(
                              1,
                              presentStudents.findIndex((s) => s.id === currentWinner.id) + 1
                            )
                          ).padStart(2, '0')}
                        </div>
                        <div>
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> HỌC SINH ĐƯỢC EDU BOT CHỌN
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-white">
                            {currentWinner.fullName}
                          </h3>
                          <p className="text-xs text-cyan-200 font-semibold">
                            Lớp: {resolvedClassName} · Mã HS:{' '}
                            {currentWinner.code || currentWinner.id}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleReplayVoice}
                          className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all"
                        >
                          <Repeat className="w-3.5 h-3.5" />
                          <span>Đọc lại tên</span>
                        </button>
                      </div>
                    </div>
                  )}

                {/* Hologram Footer Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-500/20 text-[11px] text-cyan-200/80 z-10">
                  <span>
                    Trạng thái máy trạng thái: <strong className="text-white">{phase}</strong>
                  </span>
                  <span>
                    Xác suất công bằng: <strong className="text-emerald-300">1/{Math.max(1, availableCandidates.length)}</strong> (Crypto RNG)
                  </span>
                </div>
              </div>

              {/* Mode 3 Assigned Question Panel inside Stage when a task is active */}
              {robotMode === 'TASK_ASSIGN' &&
                (phase === 'REVEALING' || phase === 'SPEAKING' || phase === 'COMPLETED') && (
                  <div className="mt-3 bg-slate-900/95 border-2 border-indigo-400/60 rounded-2xl p-4 text-white shadow-xl space-y-3">
                    {assignedQuestion ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-xs font-extrabold">
                            NHIỆM VỤ #{assignedQuestion.code} ·{' '}
                            {LEVEL_LABELS[assignedQuestion.level] || assignedQuestion.level}
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            {SUBJECT_LABELS[assignedQuestion.subject] || assignedQuestion.subject} ·{' '}
                            {assignedQuestion.chapter}
                          </span>
                        </div>

                        <div className="text-sm sm:text-base font-bold text-white bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                          {assignedQuestion.stem}
                        </div>

                        {/* Single Choice A, B, C, D */}
                        {assignedQuestion.type === 'single_choice' &&
                          assignedQuestion.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {assignedQuestion.options.map((opt) => {
                                const isSelected = selectedAnswerOption === opt.label;
                                const isCorrect =
                                  showQuestionExplanation &&
                                  (assignedQuestion.correctAnswer === opt.label ||
                                    assignedQuestion.correctAnswer === opt.id);
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setSelectedAnswerOption(opt.label)}
                                    className={`text-left p-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                                      isCorrect
                                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                                        : isSelected
                                        ? 'bg-cyan-500/30 border-cyan-300 text-white'
                                        : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-slate-500'
                                    }`}
                                  >
                                    <span className="w-6 h-6 rounded-lg bg-slate-950 text-cyan-300 font-black flex items-center justify-center shrink-0">
                                      {opt.label}
                                    </span>
                                    <span>{opt.text}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                        {/* True / False Group */}
                        {assignedQuestion.type === 'true_false_group' &&
                          assignedQuestion.subItems && (
                            <div className="space-y-1.5">
                              {assignedQuestion.subItems.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-2 text-xs"
                                >
                                  <span className="font-semibold text-slate-100">
                                    <strong className="text-cyan-300">{sub.label})</strong> {sub.text}
                                  </span>
                                  {showQuestionExplanation && (
                                    <span
                                      className={`px-2 py-0.5 rounded font-extrabold ${
                                        sub.isCorrect
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : 'bg-rose-500/20 text-rose-300'
                                      }`}
                                    >
                                      {sub.isCorrect ? 'ĐÚNG' : 'SAI'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                        {/* Answer Reveal & Teacher Evaluation */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => setShowQuestionExplanation((v) => !v)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>
                              {showQuestionExplanation ? 'Ẩn đáp án / gợi ý' : 'Xem đáp án & lời giải'}
                            </span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAnswerEvaluation('correct');
                                handleApplyBonusPoints(2);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                                answerEvaluation === 'correct'
                                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              <span>Trả lời Đúng (+2đ)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAnswerEvaluation('needs_improvement')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                                answerEvaluation === 'needs_improvement'
                                  ? 'bg-amber-500 text-slate-950 shadow-md'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                              <span>Cần cố gắng</span>
                            </button>
                          </div>
                        </div>

                        {showQuestionExplanation && (
                          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 space-y-1">
                            {assignedQuestion.correctAnswer && (
                              <div className="font-extrabold">
                                Đáp án đúng: {assignedQuestion.correctAnswer}
                              </div>
                            )}
                            {assignedQuestion.explanation && (
                              <div>Hướng dẫn/Lời giải: {assignedQuestion.explanation}</div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-amber-300 font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>
                          Không tìm thấy câu hỏi đã phê duyệt phù hợp với bộ lọc hiện tại. Giáo viên có thể đặt câu hỏi trực tiếp trên lớp!
                        </span>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Primary Action Bar at Bottom of Stage */}
          <div className="relative z-10 pt-3 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {onOpenAbsentModal && (
                <button
                  type="button"
                  onClick={onOpenAbsentModal}
                  className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vắng mặt ({absentIds.size})</span>
                </button>
              )}

              {onResetSession && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    clearAllTimers();
                    activeTurnTokenRef.current = null;
                    soundBankRef.current?.setActiveTurnToken(null);
                    soundBankRef.current?.stopAll();
                    voiceControllerRef.current?.stop();
                    voiceControllerRef.current?.resetTurnDedupe();
                    isProcessingRef.current = false;
                    onResetSession();
                    setPhase('IDLE');
                    setExpression('NORMAL');
                    setCurrentWinner(null);
                    setPreviousWinner(null);
                    setRobotSpeechText('Đã làm mới phiên! EDU Bot sẵn sàng cho lượt quét mới.');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Làm mới phiên</span>
                </button>
              )}

              {onOpenHistoryModal && (
                <button
                  type="button"
                  onClick={onOpenHistoryModal}
                  className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-purple-300" />
                  <span>Lịch sử gọi</span>
                </button>
              )}
            </div>

            {/* Main Trigger Button: BẮT ĐẦU QUÉT / QUÉT TIẾP */}
            <button
              type="button"
              onClick={handleStartRobotScan}
              disabled={isBusy || availableCandidates.length === 0}
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-[#006BFF] to-indigo-600 hover:opacity-95 text-white font-black text-sm sm:text-base shadow-[0_8px_25px_rgba(0,107,255,0.45)] transition-all disabled:opacity-50 flex items-center gap-2.5"
            >
              <Zap className={`w-5 h-5 ${isBusy ? 'animate-spin' : ''}`} />
              <span>
                {isBusy
                  ? 'ROBOT ĐANG QUÉT...'
                  : phase === 'COMPLETED'
                  ? 'QUÉT TIẾP ➔'
                  : 'BẮT ĐẦU QUÉT ➔'}
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Voice Config, Answer Timer, Bonus Points & Turn History (25-30%) */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col justify-between gap-4">
          {/* Card 1: Current Selected Student & Previous Turn Result */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Kết quả lượt quét
              </span>
              <span className="text-[11px] font-bold text-[#006BFF]">
                Lượt #{turnCounter}
              </span>
            </div>

            {currentWinner ? (
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-[#006BFF]/30 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-[#006BFF] text-white text-[10px] font-extrabold">
                    HỌC SINH ĐƯỢC CHỌN
                  </span>
                  <button
                    type="button"
                    onClick={handleReplayVoice}
                    className="text-xs font-bold text-[#006BFF] hover:underline flex items-center gap-1"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Đọc lại
                  </button>
                </div>
                <div className="text-lg font-black text-[#0F2D52]">
                  {currentWinner.fullName}
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  Lớp: <strong>{resolvedClassName}</strong> · Mã HS:{' '}
                  <strong>{currentWinner.code || currentWinner.id}</strong>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
                {isBusy
                  ? 'EDU Bot đang quét dữ liệu học sinh trên màn hình hologram...'
                  : 'Nhấn "BẮT ĐẦU QUÉT" để EDU Bot chọn ngẫu nhiên 1 học sinh.'}
              </div>
            )}

            {/* Previous Winner ("Kết quả lượt trước") */}
            {previousWinner && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Kết quả lượt trước
                  </span>
                  <strong className="text-slate-700">{previousWinner.fullName}</strong>
                </div>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {previousWinner.code || ''}
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Vietnamese Voice Configuration (Web Speech API) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#006BFF]" /> Cấu hình giọng nói Tiếng Việt
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  speechSupported
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {speechSupported ? 'Web Speech API' : 'Chỉ văn bản'}
              </span>
            </div>

            {speechSupported && vietnameseVoices.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Chọn giọng đọc Tiếng Việt ({vietnameseVoices.length}):
                </label>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  {vietnameseVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {voiceWarning && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">
                {voiceWarning}
              </p>
            )}

            <p className="text-[10px] text-slate-400 leading-relaxed">
              * Giọng đọc sử dụng bộ tổng hợp âm thanh nội bộ của trình duyệt/hệ điều hành, không gửi dữ liệu học sinh ra dịch vụ AI bên ngoài và không yêu cầu quyền micro.
            </p>
          </div>

          {/* Card 3: Answer Countdown Timer (15s, 30s default, 60s, Custom) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TimerIcon className="w-3.5 h-3.5 text-[#006BFF]" /> Đồng hồ trả lời
              </span>
              <span
                className={`text-lg font-black font-mono ${
                  answerTimeLeft <= 5 && isAnswerTimerRunning
                    ? 'text-rose-600 animate-pulse'
                    : 'text-[#0F2D52]'
                }`}
              >
                {formatTimer(answerTimeLeft)}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[15, 30, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setIsCustomTimer(false);
                    setAnswerDuration(sec);
                    setAnswerTimeLeft(sec);
                    setIsAnswerTimerRunning(false);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    !isCustomTimer && answerDuration === sec
                      ? 'bg-[#006BFF] text-white border-[#006BFF]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sec}s
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setIsCustomTimer(true);
                  const parsed = Math.max(5, parseInt(customDurationInput, 10) || 45);
                  setAnswerDuration(parsed);
                  setAnswerTimeLeft(parsed);
                  setIsAnswerTimerRunning(false);
                }}
                className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  isCustomTimer
                    ? 'bg-[#006BFF] text-white border-[#006BFF]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
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
                  value={customDurationInput}
                  onChange={(e) => setCustomDurationInput(e.target.value)}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = Math.max(5, parseInt(customDurationInput, 10) || 45);
                    setAnswerDuration(parsed);
                    setAnswerTimeLeft(parsed);
                    setIsAnswerTimerRunning(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-white text-xs font-bold"
                >
                  Áp dụng (giây)
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAnswerTimerRunning((r) => !r)}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  isAnswerTimerRunning
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isAnswerTimerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Tạm dừng
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />{' '}
                    {answerTimeLeft < answerDuration && answerTimeLeft > 0
                      ? 'Tiếp tục'
                      : 'Bắt đầu'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAnswerTimerRunning(false);
                  setAnswerTimeLeft(answerDuration);
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Đặt lại
              </button>
            </div>
          </div>

          {/* Card 4: Bonus Points & Teacher Note */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" /> Điểm thưởng & Ghi chú
              </span>
              <span className="text-xs font-extrabold text-amber-600">
                +{bonusPoints} điểm
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 5].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  disabled={!currentWinner}
                  onClick={() => handleApplyBonusPoints(pts)}
                  className="flex-1 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-extrabold disabled:opacity-40"
                >
                  +{pts} điểm
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                disabled={!currentWinner}
                value={teacherNote}
                onChange={(e) => setTeacherNote(e.target.value)}
                placeholder="Ghi chú nhận xét của giáo viên..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!currentWinner}
                onClick={handleSaveTeacherNote}
                className="px-3 py-1.5 rounded-xl bg-[#006BFF] text-white text-xs font-bold disabled:opacity-40"
              >
                Lưu
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
              <span>* Điểm thưởng lưu vào phiên chơi (không tự cộng vào sổ điểm chính thức).</span>
              {syncStatus === 'synced' && (
                <span className="text-emerald-600 font-bold flex items-center gap-0.5 shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Đã lưu
                </span>
              )}
              {syncStatus === 'error' && currentWinner && (
                <button
                  type="button"
                  onClick={() =>
                    persistTurnToSupabase(
                      currentWinner,
                      turnCounter,
                      bonusPoints,
                      teacherNote,
                      assignedQuestion?.code
                    )
                  }
                  className="text-rose-600 font-bold underline shrink-0"
                  title={lastSyncError || 'Thử lưu lại'}
                >
                  Lưu lại
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
