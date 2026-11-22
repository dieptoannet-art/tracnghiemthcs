/**
 * D07 — THÁCH ĐẤU NHÓM 3D — TOURNAMENT ARENA STAGE & PODIUM 3D + 2D FALLBACK
 * - Deep navy (#071226), emerald teal (#0D9488/#14B8A6), crisp white (#F8FAFC), brushed metallic gold (#FACC15)
 * - Arena mode: curved/framed central question monument under golden arch + fixed left/right matchup podium stations
 * - Summary mode: 3-stepped championship podium (#1, #2, #3) with multi-part procedural golden trophy
 *   (trophy is strictly hidden when trophyAwarded === false, e.g., "Giải chưa hoàn tất" or solo mode)
 * - Software-WebGL guard, RoomEnvironment + PMREMGenerator, afterDraw fenceSync pacing,
 *   webglcontextlost fallback, zero backdrop-blur over WebGL, reduced-motion support, and crisp 2D fallback.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Trophy, ShieldCheck, Sparkles, PauseCircle, Award } from 'lucide-react';
import {
  CHALLENGE_TEAM_PALETTES,
  ChallengeMatchResult,
  ChallengeStandingRow,
  ChallengeTeamConfig,
  GroupChallengeMode,
} from './groupChallenge3dEngine';

export type ChallengeArenaPhase =
  | 'round_briefing'
  | 'answering'
  | 'judging'
  | 'question_done'
  | 'round_summary'
  | 'summary';

export interface ActiveMatchupVisual {
  matchId: string;
  pairIndex: number;
  teamA: ChallengeTeamConfig;
  teamB: ChallengeTeamConfig;
  scoreA: number;
  scoreB: number;
  pointsA: number;
  pointsB: number;
  outcome: ChallengeMatchResult['outcome'];
  isCompleted: boolean;
}

export interface GroupChallenge3DSceneProps {
  mode: GroupChallengeMode;
  phase: ChallengeArenaPhase;
  roundNumber: number;
  totalRounds: number;
  questionNumberInRound: number;
  questionsPerMatch: number;
  activeMatchups: ActiveMatchupVisual[];
  byeTeam: ChallengeTeamConfig | null;
  standings: ChallengeStandingRow[];
  trophyAwarded: boolean;
  endedEarly: boolean;
  soloCorrectCount?: number;
  soloTotalAnswered?: number;
  use3D: boolean;
  reducedMotion: boolean;
  revealPulseKey: number;
  onWebGLUnavailable?: () => void;
}

function getPalette(index: number) {
  return CHALLENGE_TEAM_PALETTES[index % CHALLENGE_TEAM_PALETTES.length];
}

function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
    return (
      rendererStr.includes('swiftshader') ||
      rendererStr.includes('llvmpipe') ||
      rendererStr.includes('software') ||
      rendererStr.includes('mesa offscreen')
    );
  } catch {
    return false;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateLabel(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 1)}…`;
}

function drawCentralBannerCanvas(
  canvas: HTMLCanvasElement,
  props: {
    mode: GroupChallengeMode;
    phase: ChallengeArenaPhase;
    roundNumber: number;
    totalRounds: number;
    questionNumberInRound: number;
    questionsPerMatch: number;
    byeTeam: ChallengeTeamConfig | null;
    trophyAwarded: boolean;
    endedEarly: boolean;
    standings: ChallengeStandingRow[];
    soloCorrectCount: number;
    soloTotalAnswered: number;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // Deep navy luminous stadium backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0B1D3A');
  bg.addColorStop(1, '#061022');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle emerald & gold horizon accents
  ctx.strokeStyle = '#14B8A6';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 14, 14, W - 28, H - 28, 20);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 24, 24, W - 48, H - 48, 14);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Top label
  ctx.fillStyle = '#5EEAD4';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  const topTitle =
    props.mode === 'solo_practice'
      ? 'THÁCH ĐẤU NHÓM 3D · TỰ LUYỆN CÁ NHÂN'
      : 'GIẢI ĐẤU VÒNG TRÒN · THÁCH ĐẤU NHÓM 3D';
  ctx.fillText(topTitle, W / 2, 62);

  if (props.phase === 'summary') {
    const headline = props.endedEarly
      ? 'GIẢI CHƯA HOÀN TẤT'
      : props.mode === 'solo_practice'
      ? `HOÀN THÀNH ${props.soloCorrectCount}/${props.soloTotalAnswered} CÂU ĐÚNG`
      : props.standings.length > 0 && props.standings[0].isTied
      ? 'ĐỒNG HẠNG NHẤT'
      : props.standings[0]
      ? `VÔ ĐỊCH: ${truncateLabel(props.standings[0].name.toUpperCase(), 24)}`
      : 'TỔNG KẾT GIẢI ĐẤU';

    ctx.fillStyle = props.endedEarly ? '#FDE68A' : '#FACC15';
    ctx.font = '800 42px system-ui, -apple-system, sans-serif';
    ctx.fillText(headline, W / 2, H / 2 + 2);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    const sub = props.endedEarly
      ? 'Đã lưu kết quả các trận đã đấu · Không trao cúp vô địch'
      : props.mode === 'solo_practice'
      ? 'Xem lại lời giải chi tiết để củng cố kiến thức'
      : 'Xếp hạng theo tổng điểm giải (Thắng 3 · Hòa 1 · Thua 0)';
    ctx.fillText(sub, W / 2, H - 62);
    return;
  }

  // Active arena headline
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 48px system-ui, -apple-system, sans-serif';
  const mainText =
    props.mode === 'solo_practice'
      ? `CÂU ${props.questionNumberInRound} / ${props.questionsPerMatch}`
      : `VÒNG ${props.roundNumber} / ${props.totalRounds}`;
  ctx.fillText(mainText, W / 2, H / 2 - 12);

  // Phase status bar
  const phaseLabel =
    props.phase === 'round_briefing'
      ? 'GIỚI THIỆU CẶP ĐẤU VÒNG MỚI'
      : props.phase === 'answering'
      ? `ĐANG GIẢI CÂU ${props.questionNumberInRound}/${props.questionsPerMatch}`
      : props.phase === 'judging'
      ? `CHẤM ĐIỂM CÂU ${props.questionNumberInRound}/${props.questionsPerMatch}`
      : props.phase === 'round_summary'
      ? `TỔNG KẾT VÒNG ${props.roundNumber}`
      : `CẬP NHẬT TỈ SỐ CÂU ${props.questionNumberInRound}/${props.questionsPerMatch}`;

  ctx.fillStyle = '#FACC15';
  ctx.font = '700 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(phaseLabel, W / 2, H / 2 + 44);

  if (props.byeTeam && props.mode === 'round_robin') {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `Đội nghỉ vòng này: ${truncateLabel(props.byeTeam.name, 26)} (không tính điểm thi đấu)`,
      W / 2,
      H - 46
    );
  }
}

function drawMatchupBoardCanvas(
  canvas: HTMLCanvasElement,
  matchup: ActiveMatchupVisual | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#09172E';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = matchup?.isCompleted ? '#FACC15' : '#14B8A6';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 8, 8, W - 16, H - 16, 16);
  ctx.stroke();

  if (!matchup) {
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillText('Sẵn sàng thi đấu', W / 2, H / 2);
    return;
  }

  const palA = getPalette(matchup.teamA.paletteIndex);
  const palB = getPalette(matchup.teamB.paletteIndex);

  // Pair badge header
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = matchup.isCompleted ? '#FACC15' : '#5EEAD4';
  ctx.font = '700 20px system-ui, sans-serif';
  const headerText = matchup.isCompleted
    ? `CẶP ${matchup.pairIndex + 1} · CHỐT TRẬN (+${matchup.pointsA} / +${matchup.pointsB} ĐIỂM)`
    : `CẶP ĐẤU ${matchup.pairIndex + 1}`;
  ctx.fillText(headerText, W / 2, 34);

  // Team A chip (left)
  ctx.fillStyle = palA.hex;
  drawRoundedRect(ctx, 20, 60, W / 2 - 66, 98, 12);
  ctx.fill();

  ctx.fillStyle = palA.textOnSolid;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(truncateLabel(matchup.teamA.name, 13), 20 + (W / 2 - 66) / 2, 109);

  // Team B chip (right)
  ctx.fillStyle = palB.hex;
  drawRoundedRect(ctx, W / 2 + 46, 60, W / 2 - 66, 98, 12);
  ctx.fill();

  ctx.fillStyle = palB.textOnSolid;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(truncateLabel(matchup.teamB.name, 13), W / 2 + 46 + (W / 2 - 66) / 2, 109);

  // Center score pill
  ctx.fillStyle = '#0F2547';
  drawRoundedRect(ctx, W / 2 - 42, 62, 84, 94, 12);
  ctx.fill();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 34px system-ui, sans-serif';
  ctx.fillText(`${matchup.scoreA}–${matchup.scoreB}`, W / 2, 110);
}

function drawPodiumPlaqueCanvas(
  canvas: HTMLCanvasElement,
  row: ChallengeStandingRow | undefined,
  stepRank: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#0A1931';
  ctx.fillRect(0, 0, W, H);

  const borderColor = stepRank === 1 ? '#FACC15' : stepRank === 2 ? '#CBD5E1' : '#F59E0B';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 5;
  drawRoundedRect(ctx, 8, 8, W - 16, H - 16, 14);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (!row) {
    ctx.fillStyle = '#475569';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText(`#${stepRank}`, W / 2, H / 2);
    return;
  }

  const pal = getPalette(row.paletteIndex);

  ctx.fillStyle = borderColor;
  ctx.font = '800 28px system-ui, sans-serif';
  ctx.fillText(row.isTied ? `ĐỒNG HẠNG #${row.rank}` : `HẠNG #${row.rank}`, W / 2, 42);

  // Color stripe
  ctx.fillStyle = pal.hex;
  drawRoundedRect(ctx, 26, 70, W - 52, 54, 10);
  ctx.fill();

  ctx.fillStyle = pal.textOnSolid;
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText(truncateLabel(row.name, 16), W / 2, 97);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText(`${row.tournamentPoints} điểm giải`, W / 2, 152);
}

// ============================================================================
// LIGHTWEIGHT 2D ARENA & PODIUM FALLBACK
// ============================================================================

const GroupChallenge2DFallback: React.FC<GroupChallenge3DSceneProps> = ({
  mode,
  phase,
  roundNumber,
  totalRounds,
  questionNumberInRound,
  questionsPerMatch,
  activeMatchups,
  byeTeam,
  standings,
  trophyAwarded,
  endedEarly,
  soloCorrectCount = 0,
  soloTotalAnswered = 0,
}) => {
  const isSummary = phase === 'summary';

  if (isSummary) {
    const top3 = standings.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]];
    const stepHeights = ['h-24', 'h-32', 'h-20'];
    const stepRanks = [2, 1, 3];

    return (
      <div className="relative w-full h-full min-h-[200px] bg-gradient-to-b from-[#071226] via-[#0B2242] to-[#071226] rounded-2xl border border-teal-500/30 p-4 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300">
            <ShieldCheck className="w-4 h-4 text-yellow-400" />
            <span>
              {endedEarly
                ? 'Giải chưa hoàn tất · Chế độ 2D nhẹ'
                : mode === 'solo_practice'
                ? 'Tổng kết tự luyện · Chế độ 2D nhẹ'
                : 'Bục vinh danh giải đấu · Chế độ 2D nhẹ'}
            </span>
          </div>
          {trophyAwarded && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-yellow-400/20 border border-yellow-400/50 text-yellow-300 text-xs font-bold">
              <Trophy className="w-3.5 h-3.5" />
              Trao cúp giải đấu
            </span>
          )}
        </div>

        {mode === 'solo_practice' ? (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-400/50 flex items-center justify-center mb-2">
              <Award className="w-8 h-8 text-teal-300" />
            </div>
            <p className="text-2xl font-black text-white">
              {soloCorrectCount} / {soloTotalAnswered} câu đúng
            </p>
            <p className="text-xs text-slate-300 mt-1">Chế độ tự luyện cá nhân (không đối thủ ảo)</p>
          </div>
        ) : (
          <div className="flex-1 flex items-end justify-center gap-3 pt-4 pb-1">
            {podiumOrder.map((row, idx) => {
              const rankSlot = stepRanks[idx];
              const pal = row ? getPalette(row.paletteIndex) : null;
              return (
                <div key={rankSlot} className="flex flex-col items-center w-1/3 max-w-[180px]">
                  {rankSlot === 1 && trophyAwarded && (
                    <div className="mb-1.5 w-10 h-10 rounded-full bg-yellow-400/20 border border-yellow-400 flex items-center justify-center text-yellow-300 shadow-lg">
                      <Trophy className="w-5 h-5" />
                    </div>
                  )}
                  {row ? (
                    <div className="text-center mb-1.5 px-1">
                      <div className="text-xs font-extrabold text-white truncate max-w-[140px]">
                        {row.name}
                      </div>
                      <div className="text-[11px] font-bold text-yellow-300">
                        {row.tournamentPoints} điểm giải
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={`w-full ${stepHeights[idx]} rounded-t-xl border-t-2 border-x flex flex-col items-center justify-center px-2 ${
                      rankSlot === 1
                        ? 'bg-gradient-to-b from-yellow-500/25 to-slate-900/90 border-yellow-400'
                        : 'bg-gradient-to-b from-teal-500/20 to-slate-900/90 border-teal-400/60'
                    }`}
                  >
                    <span className="text-lg font-black text-white">
                      {row?.isTied ? `=#${row.rank}` : `#${row?.rank ?? rankSlot}`}
                    </span>
                    {pal && (
                      <span
                        className="mt-1 w-8 h-1.5 rounded-full"
                        style={{ backgroundColor: pal.hex }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[170px] bg-gradient-to-b from-[#071226] via-[#0B2242] to-[#071226] rounded-2xl border border-teal-500/30 p-4 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-extrabold text-white">
            {mode === 'solo_practice'
              ? `Tự luyện cá nhân · Câu ${questionNumberInRound}/${questionsPerMatch}`
              : `Sân đấu vòng tròn · Vòng ${roundNumber}/${totalRounds} · Câu ${questionNumberInRound}/${questionsPerMatch}`}
          </span>
        </div>
        {byeTeam && mode === 'round_robin' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-600 text-xs font-semibold text-slate-200">
            <PauseCircle className="w-3.5 h-3.5 text-amber-300" />
            Nghỉ vòng này: {byeTeam.name}
          </span>
        )}
      </div>

      {mode === 'solo_practice' ? (
        <div className="flex-1 flex items-center justify-center py-3">
          <div className="px-5 py-3 rounded-xl bg-teal-500/15 border border-teal-400/40 text-center">
            <div className="text-xs uppercase tracking-wider font-bold text-teal-300">
              Tiến độ tự luyện
            </div>
            <div className="text-xl font-black text-white mt-0.5">
              {soloCorrectCount} đúng / {soloTotalAnswered} đã chốt
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-2.5 pt-2.5 ${
            activeMatchups.length === 1
              ? 'grid-cols-1 max-w-lg mx-auto w-full'
              : activeMatchups.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 md:grid-cols-3'
          }`}
        >
          {activeMatchups.map((m) => {
            const palA = getPalette(m.teamA.paletteIndex);
            const palB = getPalette(m.teamB.paletteIndex);
            return (
              <div
                key={m.matchId}
                className={`rounded-xl border px-3 py-2.5 bg-slate-900/85 ${
                  m.isCompleted ? 'border-yellow-400/60' : 'border-teal-500/35'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-teal-300 mb-1.5">
                  <span>Cặp {m.pairIndex + 1}</span>
                  {m.isCompleted && (
                    <span className="text-yellow-300">
                      +{m.pointsA} / +{m.pointsB} đ giải
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: palA.hex }}
                    />
                    <span className="text-xs font-bold text-white truncate">{m.teamA.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#071226] border border-yellow-400/40 text-sm font-black text-yellow-300 shrink-0">
                    {m.scoreA} – {m.scoreB}
                  </span>
                  <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1">
                    <span className="text-xs font-bold text-white truncate text-right">
                      {m.teamB.name}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: palB.hex }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN 3D ARENA & PODIUM COMPONENT
// ============================================================================

export const GroupChallenge3DScene: React.FC<GroupChallenge3DSceneProps> = (props) => {
  const {
    mode,
    phase,
    roundNumber,
    totalRounds,
    questionNumberInRound,
    questionsPerMatch,
    activeMatchups,
    byeTeam,
    standings,
    trophyAwarded,
    endedEarly,
    soloCorrectCount = 0,
    soloTotalAnswered = 0,
    use3D,
    reducedMotion,
    revealPulseKey,
    onWebGLUnavailable,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Refs for syncing React props cleanly into the Three.js scene without re-creating renderer
  const latestPropsRef = useRef(props);
  latestPropsRef.current = props;

  const pulseStartRef = useRef(0);
  useEffect(() => {
    if (revealPulseKey > 0) {
      pulseStartRef.current = performance.now();
    }
  }, [revealPulseKey]);

  const textureUpdatersRef = useRef<{
    syncScene: () => void;
  } | null>(null);

  // Sync dynamic canvas textures & visibility whenever tournament state updates
  useEffect(() => {
    textureUpdatersRef.current?.syncScene();
  }, [
    mode,
    phase,
    roundNumber,
    totalRounds,
    questionNumberInRound,
    questionsPerMatch,
    activeMatchups,
    byeTeam,
    standings,
    trophyAwarded,
    endedEarly,
    soloCorrectCount,
    soloTotalAnswered,
  ]);

  useEffect(() => {
    if (!use3D || webglFailed) return;
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      onWebGLUnavailable?.();
      return;
    }

    const gl = renderer.getContext();
    if (!gl || detectSoftwareWebGL(gl)) {
      renderer.dispose();
      setWebglFailed(true);
      onWebGLUnavailable?.();
      return;
    }

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(180, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvasEl = renderer.domElement;
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(canvasEl);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
      onWebGLUnavailable?.();
    };
    canvasEl.addEventListener('webglcontextlost', handleContextLost, false);

    // Scene & lighting
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071226');
    scene.fog = new THREE.FogExp2('#071226', 0.036);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 80);
    camera.position.set(0, 4.1, 10.6);
    camera.lookAt(0, 1.45, 0);

    const ambient = new THREE.AmbientLight(0xdbeafe, 0.6);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    keyLight.position.set(5, 9, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 28;
    keyLight.shadow.camera.left = -9;
    keyLight.shadow.camera.right = 9;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    scene.add(keyLight);

    const tealRim = new THREE.PointLight(0x14b8a6, 2.2, 18);
    tealRim.position.set(-5.5, 4.5, -2.5);
    scene.add(tealRim);

    const goldRim = new THREE.PointLight(0xfacc15, 1.8, 18);
    goldRim.position.set(5.5, 4.5, -2.5);
    scene.add(goldRim);

    // Shared materials (Navy, Emerald Teal, Crisp White, Brushed Gold)
    const navyStageMat = new THREE.MeshStandardMaterial({
      color: 0x0c1e3a,
      roughness: 0.42,
      metalness: 0.25,
    });
    const whiteTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.28,
      metalness: 0.12,
    });
    const goldMetalMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.24,
      metalness: 0.86,
    });
    const tealGlowMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0d9488,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.3,
    });
    const darkSlateMat = new THREE.MeshStandardMaterial({
      color: 0x091529,
      roughness: 0.55,
      metalness: 0.2,
    });

    // ---- ARENA FLOOR & TIERED PLINTH ----
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(11.5, 12.2, 0.3, 48),
      darkSlateMat
    );
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    scene.add(floor);

    const innerPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(6.6, 7.1, 0.26, 48),
      navyStageMat
    );
    innerPlinth.position.y = 0.13;
    innerPlinth.receiveShadow = true;
    scene.add(innerPlinth);

    const tealRing = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.06, 12, 64),
      tealGlowMat
    );
    tealRing.rotation.x = Math.PI / 2;
    tealRing.position.y = 0.27;
    scene.add(tealRing);

    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.045, 12, 64),
      goldMetalMat
    );
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = 0.27;
    scene.add(goldRing);

    // ---- CENTRAL MONUMENT + GOLDEN ARCH + DYNAMIC SCREEN ----
    const centralGroup = new THREE.Group();
    scene.add(centralGroup);

    const archMesh = new THREE.Mesh(
      new THREE.TorusGeometry(3.25, 0.12, 16, 48, Math.PI),
      goldMetalMat
    );
    archMesh.position.set(0, 0.3, -2.55);
    centralGroup.add(archMesh);

    const screenFrame = new THREE.Mesh(
      new THREE.BoxGeometry(5.55, 2.35, 0.18),
      navyStageMat
    );
    screenFrame.position.set(0, 2.05, -2.5);
    screenFrame.castShadow = true;
    centralGroup.add(screenFrame);

    const screenBezelTop = new THREE.Mesh(
      new THREE.BoxGeometry(5.68, 0.08, 0.22),
      goldMetalMat
    );
    screenBezelTop.position.set(0, 3.24, -2.48);
    centralGroup.add(screenBezelTop);

    const screenBezelBottom = new THREE.Mesh(
      new THREE.BoxGeometry(5.68, 0.08, 0.22),
      whiteTrimMat
    );
    screenBezelBottom.position.set(0, 0.86, -2.48);
    centralGroup.add(screenBezelBottom);

    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 420;
    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    bannerTex.colorSpace = THREE.SRGBColorSpace;
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const bannerPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.32, 2.14), bannerMat);
    bannerPlane.position.set(0, 2.05, -2.39);
    centralGroup.add(bannerPlane);

    // Twin framing pillars
    [-3.25, 3.25].forEach((px) => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, 3.1, 16),
        whiteTrimMat
      );
      pillar.position.set(px, 1.8, -2.55);
      pillar.castShadow = true;
      centralGroup.add(pillar);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.18, 16), goldMetalMat);
      cap.position.set(px, 3.35, -2.55);
      centralGroup.add(cap);
    });

    // ---- ACTIVE MATCHUP STATIONS (UP TO 3 FIXED STATIONS) ----
    const arenaGroup = new THREE.Group();
    scene.add(arenaGroup);

    const stationPositions: Array<[number, number, number, number]> = [
      [-3.7, 0.26, 1.1, 0.28],
      [0, 0.26, 2.15, 0],
      [3.7, 0.26, 1.1, -0.28],
    ];

    interface StationNode {
      root: THREE.Group;
      canvas: HTMLCanvasElement;
      tex: THREE.CanvasTexture;
      ledLeftMat: THREE.MeshStandardMaterial;
      ledRightMat: THREE.MeshStandardMaterial;
    }

    const stations: StationNode[] = stationPositions.map(([x, y, z, rotY]) => {
      const root = new THREE.Group();
      root.position.set(x, y, z);
      root.rotation.y = rotY;

      // Desk body
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.92, 0.72), navyStageMat);
      base.position.y = 0.46;
      base.castShadow = true;
      base.receiveShadow = true;
      root.add(base);

      const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.08, 0.84), whiteTrimMat);
      deskTop.position.y = 0.95;
      root.add(deskTop);

      // Left/Right team color accent pillars on the desk
      const ledLeftMat = new THREE.MeshStandardMaterial({
        color: 0x0d9488,
        emissive: 0x0d9488,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      });
      const ledRightMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        emissive: 0xeab308,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      });

      const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.86, 0.76), ledLeftMat);
      leftBar.position.set(-1.26, 0.46, 0);
      root.add(leftBar);

      const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.86, 0.76), ledRightMat);
      rightBar.position.set(1.26, 0.46, 0);
      root.add(rightBar);

      // Front scoreboard panel
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 192;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(2.34, 0.84),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      panel.position.set(0, 0.5, 0.37);
      root.add(panel);

      arenaGroup.add(root);
      return { root, canvas, tex, ledLeftMat, ledRightMat };
    });

    // ---- 3-STEPPED CHAMPIONSHIP PODIUM + PROCEDURAL GOLDEN TROPHY ----
    const podiumGroup = new THREE.Group();
    podiumGroup.visible = false;
    scene.add(podiumGroup);

    const podiumConfigs = [
      { rankSlot: 2, x: -2.35, h: 1.05, w: 2.05 },
      { rankSlot: 1, x: 0, h: 1.55, w: 2.35 },
      { rankSlot: 3, x: 2.35, h: 0.78, w: 2.05 },
    ];

    interface PodiumNode {
      rankSlot: number;
      canvas: HTMLCanvasElement;
      tex: THREE.CanvasTexture;
    }

    const podiumNodes: PodiumNode[] = podiumConfigs.map(({ rankSlot, x, h, w }) => {
      const stepGroup = new THREE.Group();
      stepGroup.position.set(x, 0.26, 0.85);

      const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.5), navyStageMat);
      block.position.y = h / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      stepGroup.add(block);

      const capMat = rankSlot === 1 ? goldMetalMat : whiteTrimMat;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.09, 1.6), capMat);
      cap.position.y = h + 0.045;
      stepGroup.add(cap);

      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 192;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;

      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(w - 0.18, Math.min(0.95, h - 0.12)),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      plaque.position.set(0, h / 2, 0.76);
      stepGroup.add(plaque);

      podiumGroup.add(stepGroup);
      return { rankSlot, canvas, tex };
    });

    // Multi-part procedural Golden Championship Trophy (strictly visible ONLY when trophyAwarded === true)
    const trophyGroup = new THREE.Group();
    trophyGroup.position.set(0, 1.86, 0.85);
    podiumGroup.add(trophyGroup);

    const trophyPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.44, 0.18, 24),
      darkSlateMat
    );
    trophyPlinth.position.y = 0.09;
    trophyGroup.add(trophyPlinth);

    const trophyStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.16, 0.36, 20),
      goldMetalMat
    );
    trophyStem.position.y = 0.34;
    trophyGroup.add(trophyStem);

    const trophyCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.16, 0.48, 24),
      goldMetalMat
    );
    trophyCup.position.y = 0.74;
    trophyCup.castShadow = true;
    trophyGroup.add(trophyCup);

    const trophyRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.035, 12, 32),
      goldMetalMat
    );
    trophyRim.rotation.x = Math.PI / 2;
    trophyRim.position.y = 0.98;
    trophyGroup.add(trophyRim);

    [-0.36, 0.36].forEach((hx) => {
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.028, 10, 24),
        goldMetalMat
      );
      handle.position.set(hx, 0.75, 0);
      trophyGroup.add(handle);
    });

    // Sync scene function called from React prop updates
    const syncScene = () => {
      const p = latestPropsRef.current;
      const isSummary = p.phase === 'summary';

      drawCentralBannerCanvas(bannerCanvas, {
        mode: p.mode,
        phase: p.phase,
        roundNumber: p.roundNumber,
        totalRounds: p.totalRounds,
        questionNumberInRound: p.questionNumberInRound,
        questionsPerMatch: p.questionsPerMatch,
        byeTeam: p.byeTeam,
        trophyAwarded: p.trophyAwarded,
        endedEarly: p.endedEarly,
        standings: p.standings,
        soloCorrectCount: p.soloCorrectCount ?? 0,
        soloTotalAnswered: p.soloTotalAnswered ?? 0,
      });
      bannerTex.needsUpdate = true;

      arenaGroup.visible = !isSummary && p.mode === 'round_robin';
      podiumGroup.visible = isSummary && p.mode === 'round_robin';
      trophyGroup.visible = isSummary && p.trophyAwarded;

      // Update matchup stations cleanly without reordering indices
      const matchups = p.activeMatchups;
      const slotMap =
        matchups.length === 1
          ? [null, matchups[0], null]
          : matchups.length === 2
          ? [matchups[0], null, matchups[1]]
          : [matchups[0] ?? null, matchups[1] ?? null, matchups[2] ?? null];

      stations.forEach((st, idx) => {
        const m = slotMap[idx];
        st.root.visible = Boolean(m);
        if (m) {
          const palA = getPalette(m.teamA.paletteIndex);
          const palB = getPalette(m.teamB.paletteIndex);
          st.ledLeftMat.color.setHex(palA.hexNum);
          st.ledLeftMat.emissive.setHex(palA.hexNum);
          st.ledRightMat.color.setHex(palB.hexNum);
          st.ledRightMat.emissive.setHex(palB.hexNum);
          drawMatchupBoardCanvas(st.canvas, m);
          st.tex.needsUpdate = true;
        }
      });

      // Update summary podium plaques
      if (isSummary && p.mode === 'round_robin') {
        const top3 = p.standings.slice(0, 3);
        const bySlot: Record<number, ChallengeStandingRow | undefined> = {
          1: top3[0],
          2: top3[1],
          3: top3[2],
        };
        podiumNodes.forEach((node) => {
          drawPodiumPlaqueCanvas(node.canvas, bySlot[node.rankSlot], node.rankSlot);
          node.tex.needsUpdate = true;
        });
      }
    };

    textureUpdatersRef.current = { syncScene };
    syncScene();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextW = Math.max(320, Math.floor(entry.contentRect.width));
        const nextH = Math.max(180, Math.floor(entry.contentRect.height));
        camera.aspect = nextW / nextH;
        camera.updateProjectionMatrix();
        renderer?.setSize(nextW, nextH);
      }
    });
    resizeObserver.observe(container);

    // Render loop with fenceSync GPU pacing
    let rafId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const animate = () => {
      if (disposed || !renderer) return;
      rafId = window.requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const p = latestPropsRef.current;

      // Subtle camera framing & gentle studio drift (disabled when reducedMotion)
      const isSummary = p.phase === 'summary';
      const targetCamZ = isSummary ? 9.4 : 10.6;
      const targetCamY = isSummary ? 3.8 : 4.15;
      const driftX = p.reducedMotion ? 0 : Math.sin(t * 0.35) * 0.45;
      camera.position.x += (driftX - camera.position.x) * 0.05;
      camera.position.y += (targetCamY - camera.position.y) * 0.06;
      camera.position.z += (targetCamZ - camera.position.z) * 0.06;
      camera.lookAt(0, isSummary ? 1.55 : 1.4, -0.5);

      // Score reveal light pulse
      const pulseElapsed = (performance.now() - pulseStartRef.current) / 1000;
      const pulseBoost =
        !p.reducedMotion && pulseElapsed >= 0 && pulseElapsed < 1.1
          ? Math.sin((pulseElapsed / 1.1) * Math.PI) * 1.4
          : 0;
      tealGlowMat.emissiveIntensity = 0.75 + pulseBoost * 0.7;
      goldRim.intensity = 1.8 + pulseBoost * 1.3;

      if (trophyGroup.visible && !p.reducedMotion) {
        trophyGroup.rotation.y = t * 0.65;
        trophyGroup.position.y = 1.86 + Math.sin(t * 2.2) * 0.05;
      }

      renderer.render(scene, camera);

      // WebGL2 fenceSync pacing
      if (gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl.flush();
          gl.deleteSync(sync);
        }
      }
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      textureUpdatersRef.current = null;
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      canvasEl.removeEventListener('webglcontextlost', handleContextLost);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      bannerTex.dispose();
      stations.forEach((s) => s.tex.dispose());
      podiumNodes.forEach((n) => n.tex.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer?.dispose();
    };
  }, [use3D, webglFailed, onWebGLUnavailable]);

  if (!use3D || webglFailed) {
    return <GroupChallenge2DFallback {...props} />;
  }

  return (
    <div className="relative w-full h-full min-h-[190px] rounded-2xl overflow-hidden border border-teal-500/35 bg-[#071226]">
      <div ref={containerRef} className="w-full h-full" />
      <div className="pointer-events-none absolute top-2.5 left-3 px-2.5 py-1 rounded-md bg-[#071226]/90 border border-teal-400/40 text-[11px] font-bold text-teal-200 tracking-wide">
        {phase === 'summary'
          ? endedEarly
            ? 'Giải chưa hoàn tất'
            : trophyAwarded
            ? 'Bục trao cúp giải đấu 3D'
            : 'Tổng kết tự luyện 3D'
          : mode === 'solo_practice'
          ? `Tự luyện cá nhân · Câu ${questionNumberInRound}/${questionsPerMatch}`
          : `Vòng ${roundNumber}/${totalRounds} · Câu ${questionNumberInRound}/${questionsPerMatch}`}
      </div>
      {byeTeam && mode === 'round_robin' && phase !== 'summary' && (
        <div className="pointer-events-none absolute top-2.5 right-3 px-2.5 py-1 rounded-md bg-[#071226]/90 border border-amber-400/45 text-[11px] font-semibold text-amber-200">
          Đội nghỉ vòng này: {byeTeam.name}
        </div>
      )}
    </div>
  );
};
