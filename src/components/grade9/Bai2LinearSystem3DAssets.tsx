import React from 'react';
import {
  LinearSystem2x2,
  solveLinearSystem2x2,
  formatRational,
  formatEquationDisplay,
  isZeroRat,
} from './bai2LinearSystemEngine';

// ============================================================================
// 1. 3D EXPLORER ROBOT MASCOT (Matching Reference Images 1 & 2)
// ============================================================================
export const ExplorerRobot3D: React.FC<{
  mood?: 'happy' | 'thinking' | 'celebrating';
  showCeramicTiles?: boolean;
  className?: string;
}> = ({ mood = 'happy', showCeramicTiles = false, className = 'w-40 h-48' }) => {
  return (
    <svg
      viewBox="0 0 220 250"
      className={className}
      role="img"
      aria-label="Robot khám phá Toán 9 Tây Đô Smart EDU"
    >
      <defs>
        <linearGradient id="robHelmet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6E5C4" />
          <stop offset="65%" stopColor="#DFC492" />
          <stop offset="100%" stopColor="#B89860" />
        </linearGradient>
        <linearGradient id="robBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#EAE6DC" />
          <stop offset="100%" stopColor="#C9C2B2" />
        </linearGradient>
        <linearGradient id="robScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14293A" />
          <stop offset="100%" stopColor="#091520" />
        </linearGradient>
        <linearGradient id="robScarf" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="robPack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#267347" />
          <stop offset="100%" stopColor="#164A2D" />
        </linearGradient>
        <linearGradient id="tileGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BCE3B5" />
          <stop offset="100%" stopColor="#84BE7A" />
        </linearGradient>
        <linearGradient id="tileCream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF6EA" />
          <stop offset="100%" stopColor="#DFD2B5" />
        </linearGradient>
        <filter id="softShadow3D" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#1A2E22" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Contact shadow on wooden desk */}
      <ellipse cx="98" cy="232" rx="64" ry="11" fill="#2A241B" opacity="0.22" />

      {/* Green Explorer Backpack */}
      <rect
        x="24"
        y="112"
        width="36"
        height="58"
        rx="10"
        fill="url(#robPack)"
        stroke="#0F351F"
        strokeWidth="2"
      />
      <rect x="28" y="122" width="22" height="12" rx="4" fill="#368F5B" />
      <rect x="28" y="140" width="22" height="22" rx="4" fill="#1E5B38" />

      {/* Left Arm (resting by side) */}
      <g>
        <path
          d="M 55 128 Q 36 145 42 168"
          fill="none"
          stroke="url(#robBody)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <circle cx="42" cy="171" r="8" fill="#D5CEC0" stroke="#8C8270" strokeWidth="1.5" />
      </g>

      {/* Legs & Boots */}
      <g>
        {/* Left Leg */}
        <rect x="66" y="178" width="18" height="34" rx="7" fill="url(#robBody)" stroke="#9E9585" strokeWidth="1.5" />
        <rect x="64" y="192" width="22" height="6" rx="2" fill="#267347" />
        <path
          d="M 58 212 Q 58 202 74 202 L 86 202 Q 92 202 92 214 L 92 224 Q 92 228 84 228 L 62 228 Q 56 228 58 212 Z"
          fill="url(#robBody)"
          stroke="#475569"
          strokeWidth="2"
        />
        <rect x="57" y="222" width="35" height="6" rx="3" fill="#1E4631" />

        {/* Right Leg */}
        <rect x="98" y="178" width="18" height="34" rx="7" fill="url(#robBody)" stroke="#9E9585" strokeWidth="1.5" />
        <rect x="96" y="192" width="22" height="6" rx="2" fill="#267347" />
        <path
          d="M 94 212 Q 94 202 108 202 L 122 202 Q 130 202 130 214 L 130 224 Q 130 228 122 228 L 98 228 Q 92 228 94 212 Z"
          fill="url(#robBody)"
          stroke="#475569"
          strokeWidth="2"
        />
        <rect x="94" y="222" width="36" height="6" rx="3" fill="#1E4631" />
      </g>

      {/* Torso */}
      <rect
        x="54"
        y="114"
        width="74"
        height="70"
        rx="20"
        fill="url(#robBody)"
        stroke="#B5AC9B"
        strokeWidth="2"
        filter="url(#softShadow3D)"
      />

      {/* Chest Book Emblem */}
      <rect
        x="73"
        y="132"
        width="36"
        height="30"
        rx="7"
        fill="#F8F5EC"
        stroke="#C5BBA8"
        strokeWidth="1.5"
      />
      <path d="M 81 142 L 91 145 L 101 142 L 101 154 L 91 157 L 81 154 Z" fill="#1E6B43" />
      <circle cx="91" cy="139" r="3" fill="#E67E22" />

      {/* Leather Utility Belt */}
      <rect x="54" y="165" width="74" height="11" rx="4" fill="#8C5828" stroke="#5A3514" strokeWidth="1.5" />
      <rect x="84" y="163" width="14" height="15" rx="3" fill="#D4A359" stroke="#5A3514" strokeWidth="1.5" />

      {/* Orange Scarf */}
      <path
        d="M 58 112 Q 91 124 124 112 L 118 126 Q 91 134 64 126 Z"
        fill="url(#robScarf)"
        stroke="#B45309"
        strokeWidth="1.5"
      />

      {/* Right Arm (Pointing toward the math board) */}
      <g>
        <path
          d="M 126 128 Q 154 118 172 98"
          fill="none"
          stroke="url(#robBody)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <circle cx="148" cy="115" r="6" fill="#267347" />
        {/* Pointing Hand */}
        <circle cx="176" cy="94" r="8" fill="#F6F3EB" stroke="#9E9585" strokeWidth="1.5" />
        <path
          d="M 180 91 L 194 82"
          stroke="#F6F3EB"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>

      {/* Robot Head */}
      <g filter="url(#softShadow3D)">
        {/* Ear pods */}
        <ellipse cx="38" cy="82" rx="7" ry="15" fill="#E67E22" stroke="#9A4E0E" strokeWidth="1.5" />
        <ellipse cx="38" cy="82" rx="3.5" ry="9" fill="#34D399" />
        <ellipse cx="144" cy="82" rx="7" ry="15" fill="#E67E22" stroke="#9A4E0E" strokeWidth="1.5" />
        <ellipse cx="144" cy="82" rx="3.5" ry="9" fill="#34D399" />

        {/* Head shell */}
        <rect
          x="42"
          y="44"
          width="98"
          height="72"
          rx="32"
          fill="url(#robBody)"
          stroke="#B5AC9B"
          strokeWidth="2"
        />

        {/* Face Visor Screen */}
        <rect
          x="52"
          y="56"
          width="78"
          height="48"
          rx="20"
          fill="url(#robScreen)"
          stroke="#2C4C64"
          strokeWidth="2"
        />

        {/* Glowing Cyan Eyes & Smile */}
        {mood === 'thinking' ? (
          <>
            <path d="M 66 76 Q 74 70 82 76" fill="none" stroke="#5EEAD4" strokeWidth="4" strokeLinecap="round" />
            <circle cx="108" cy="75" r="5" fill="#5EEAD4" />
            <path d="M 83 91 Q 91 89 99 91" fill="none" stroke="#5EEAD4" strokeWidth="3.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M 65 77 Q 73 67 81 77" fill="none" stroke="#67E8F9" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 101 77 Q 109 67 117 77" fill="none" stroke="#67E8F9" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 82 88 Q 91 96 100 88" fill="none" stroke="#67E8F9" strokeWidth="3.8" strokeLinecap="round" />
          </>
        )}

        {/* Explorer Pith Helmet */}
        <path
          d="M 28 54 Q 91 38 154 54 Q 144 62 91 58 Q 38 62 28 54 Z"
          fill="url(#robHelmet)"
          stroke="#9E7E46"
          strokeWidth="2"
        />
        <path
          d="M 42 51 Q 91 8 140 51 Z"
          fill="url(#robHelmet)"
          stroke="#9E7E46"
          strokeWidth="2"
        />
        {/* Compass Badge on Helmet */}
        <circle cx="91" cy="31" r="10" fill="#FBF6EA" stroke="#8C5828" strokeWidth="2" />
        <path d="M 91 23 L 93 31 L 91 39 L 89 31 Z" fill="#D97706" />
        <path d="M 83 31 L 91 29 L 99 31 L 91 33 Z" fill="#1E6B43" />
      </g>

      {/* Optional 3D Ceramic Math Tiles on Desk (x, y) */}
      {showCeramicTiles && (
        <g transform="translate(126, 194)">
          <rect
            x="0"
            y="6"
            width="40"
            height="34"
            rx="8"
            fill="url(#tileGreen)"
            stroke="#58944E"
            strokeWidth="2"
          />
          <text
            x="20"
            y="29"
            textAnchor="middle"
            fill="#144527"
            fontSize="21"
            fontWeight="800"
            fontFamily="Georgia, serif"
            fontStyle="italic"
          >
            x
          </text>
          <rect
            x="44"
            y="10"
            width="40"
            height="34"
            rx="8"
            fill="url(#tileCream)"
            stroke="#B8A682"
            strokeWidth="2"
          />
          <text
            x="64"
            y="33"
            textAnchor="middle"
            fill="#6B4419"
            fontSize="21"
            fontWeight="800"
            fontFamily="Georgia, serif"
            fontStyle="italic"
          >
            y
          </text>
        </g>
      )}
    </svg>
  );
};

// ============================================================================
// 2. 3D TEXTBOOK TOÁN 9 BADGE (For Left Sidebar in Teacher & Student Views)
// ============================================================================
export const TextbookToan9Badge3D: React.FC = () => (
  <svg viewBox="0 0 84 100" className="w-14 h-16 shrink-0" role="img" aria-label="SGK Toán 9 Tập 1">
    <defs>
      <linearGradient id="sgkCover" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1B7A58" />
        <stop offset="55%" stopColor="#135A40" />
        <stop offset="100%" stopColor="#0C3B29" />
      </linearGradient>
      <linearGradient id="sgkGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    {/* Book pages depth */}
    <path d="M 16 12 L 72 6 L 76 84 L 20 92 Z" fill="#F8F5EC" stroke="#CBD5E1" strokeWidth="1.5" />
    {/* Spine */}
    <path d="M 10 14 L 16 12 L 16 90 L 10 92 Z" fill="#0B2E20" />
    {/* Front cover */}
    <path d="M 16 12 L 68 6 L 68 84 L 16 90 Z" fill="url(#sgkCover)" stroke="#34D399" strokeWidth="1" />
    {/* Yellow hill motif */}
    <path d="M 16 68 Q 42 52 68 64 L 68 84 L 16 90 Z" fill="url(#sgkGold)" opacity="0.88" />
    <text x="42" y="34" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800">
      TOÁN
    </text>
    <text x="42" y="52" textAnchor="middle" fill="#FDE68A" fontSize="16" fontWeight="900">
      9
    </text>
    <text x="42" y="81" textAnchor="middle" fill="#0C3B29" fontSize="7.5" fontWeight="800">
      TẬP MỘT
    </text>
  </svg>
);

// ============================================================================
// 3. 3D CABBAGE GARDEN INTERACTIVE MODEL (Activity 1 & Vận dụng 1)
// ============================================================================
export const CabbageGarden3DVisual: React.FC<{
  scenario: 'initial' | 'change1' | 'change2';
  showSolvedVerification?: boolean;
}> = ({ scenario, showSolvedVerification = false }) => {
  const rows = scenario === 'initial' ? 4 : scenario === 'change1' ? 5 : 3;
  const cols = scenario === 'initial' ? 5 : scenario === 'change1' ? 4 : 6;

  const badgeText =
    scenario === 'initial'
      ? 'Ban đầu: x luống, mỗi luống y cây ⇒ Tổng số cây: x·y'
      : scenario === 'change1'
        ? 'Thay đổi 1: Tăng 8 luống (x + 8), mỗi luống bớt 3 cây (y − 3) ⇒ Giảm 108 cây'
        : 'Thay đổi 2: Giảm 4 luống (x − 4), mỗi luống thêm 2 cây (y + 2) ⇒ Tăng 64 cây';

  return (
    <div className="relative rounded-2xl border border-[#C8D8C0] bg-gradient-to-b from-[#EAF5E4] via-[#F5F9F1] to-[#E2EFE0] p-4 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#195E3E] text-white text-xs sm:text-sm font-bold shadow-xs">
          <span>🌱 Mô hình 3D Vườn cải bắp nhà bác Đạt</span>
        </span>
        <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
          Điều kiện: x, y ∈ ℕ*, x &gt; 4, y &gt; 3
        </span>
      </div>

      <svg
        viewBox="0 0 620 220"
        className="w-full h-auto max-h-[220px] rounded-xl bg-gradient-to-b from-[#D9F0FF] via-[#EEFAEC] to-[#D5E8C8] border border-[#BFD6B8]"
        role="img"
        aria-label={badgeText}
      >
        <defs>
          <linearGradient id="soilBed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8D5B34" />
            <stop offset="100%" stopColor="#5C381B" />
          </linearGradient>
          <radialGradient id="cabbageLeaf" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#86EFAC" />
            <stop offset="55%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#15803D" />
          </radialGradient>
        </defs>

        {/* Sun & clouds */}
        <circle cx="565" cy="36" r="20" fill="#FDE047" opacity="0.85" />
        <ellipse cx="95" cy="34" rx="34" ry="12" fill="#FFFFFF" opacity="0.85" />
        <ellipse cx="118" cy="31" rx="24" ry="10" fill="#FFFFFF" opacity="0.85" />

        {/* Wooden fence in background */}
        {Array.from({ length: 14 }).map((_, idx) => (
          <rect
            key={idx}
            x={30 + idx * 42}
            y={52}
            width={10}
            height={28}
            rx={2}
            fill="#C89D66"
            stroke="#8C6239"
            strokeWidth="1"
          />
        ))}
        <rect x="24" y="60" width="570" height="5" fill="#B5854B" />
        <rect x="24" y="70" width="570" height="5" fill="#B5854B" />

        {/* Raised Soil Beds (Luống cải bắp) & 3D Cabbages */}
        {Array.from({ length: rows }).map((_, rIdx) => {
          const yPos = 90 + rIdx * (115 / rows);
          return (
            <g key={rIdx}>
              {/* 3D soil ridge */}
              <rect
                x={58}
                y={yPos}
                width={365}
                height={18}
                rx={8}
                fill="url(#soilBed)"
                stroke="#472911"
                strokeWidth="1"
              />
              {/* Cabbages along the ridge */}
              {Array.from({ length: cols }).map((__, cIdx) => {
                const xPos = 88 + cIdx * (305 / Math.max(1, cols - 1));
                return (
                  <g key={cIdx} transform={`translate(${xPos}, ${yPos + 4})`}>
                    <ellipse cx="0" cy="4" rx="13" ry="6" fill="#166534" opacity="0.45" />
                    <circle cx="-5" cy="-2" r="8" fill="#16A34A" />
                    <circle cx="5" cy="-2" r="8" fill="#16A34A" />
                    <circle cx="0" cy="-4" r="9.5" fill="url(#cabbageLeaf)" stroke="#14532D" strokeWidth="1" />
                    <path d="M -4 -6 Q 0 -10 4 -6" fill="none" stroke="#DCFCE7" strokeWidth="1.4" />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 3D Wooden Signboard on the Right */}
        <g transform="translate(442, 78)">
          <rect x="74" y="95" width="12" height="42" fill="#784721" />
          <rect
            x="0"
            y="0"
            width="162"
            height="104"
            rx="12"
            fill="#FFFBEB"
            stroke="#B45309"
            strokeWidth="3"
          />
          <text x="81" y="24" textAnchor="middle" fill="#195E3E" fontSize="12" fontWeight="800">
            {scenario === 'initial'
              ? 'TRẠNG THÁI BAN ĐẦU'
              : scenario === 'change1'
                ? 'THAY ĐỔI 1 (SGK tr. 11)'
                : 'THAY ĐỔI 2 (SGK tr. 11)'}
          </text>
          <text x="81" y="46" textAnchor="middle" fill="#1E293B" fontSize="12.5" fontWeight="700">
            {scenario === 'initial'
              ? 'Số luống: x (luống)'
              : scenario === 'change1'
                ? 'Số luống: x + 8 (luống)'
                : 'Số luống: x − 4 (luống)'}
          </text>
          <text x="81" y="66" textAnchor="middle" fill="#1E293B" fontSize="12.5" fontWeight="700">
            {scenario === 'initial'
              ? 'Mỗi luống: y (cây)'
              : scenario === 'change1'
                ? 'Mỗi luống: y − 3 (cây)'
                : 'Mỗi luống: y + 2 (cây)'}
          </text>
          <text x="81" y="88" textAnchor="middle" fill="#D97706" fontSize="12.5" fontWeight="800">
            {showSolvedVerification
              ? scenario === 'initial'
                ? '60 × 12 = 720 cây'
                : scenario === 'change1'
                  ? '68 × 9 = 612 (giảm 108)'
                  : '56 × 14 = 784 (tăng 64)'
              : scenario === 'initial'
                ? 'Tổng số cây: x·y'
                : scenario === 'change1'
                  ? 'Tổng cây: xy − 108'
                  : 'Tổng cây: xy + 64'}
          </text>
        </g>
      </svg>

      <div className="mt-2.5 text-xs sm:text-sm font-semibold text-[#163628] bg-white/90 rounded-xl px-3.5 py-2 border border-[#CDE0C5]">
        {badgeText}
      </div>
    </div>
  );
};

// ============================================================================
// 4. INTERACTIVE COORDINATE GEOMETRY GRAPH (Activity 4 & "Em có biết?" tr. 17–18)
// ============================================================================
export const ThreeCasesCoordinateGraphSVG: React.FC<{
  system: LinearSystem2x2;
  title?: string;
}> = ({ system, title }) => {
  const sol = solveLinearSystem2x2(system);
  const width = 380;
  const height = 270;
  const originX = width / 2;
  const originY = height / 2;
  const scale = 22; // pixels per unit

  const toScreenX = (x: number) => originX + x * scale;
  const toScreenY = (y: number) => originY - y * scale;

  // Compute segment endpoints for a*x + b*y = c across [-8, 8]
  const computeLinePoints = (eq: { a: { num: number; den: number }; b: { num: number; den: number }; c: { num: number; den: number } }) => {
    const a = eq.a.num / eq.a.den;
    const b = eq.b.num / eq.b.den;
    const c = eq.c.num / eq.c.den;
    if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) return null;
    if (Math.abs(b) > 1e-6) {
      const x1 = -8;
      const y1 = (c - a * x1) / b;
      const x2 = 8;
      const y2 = (c - a * x2) / b;
      return { x1: toScreenX(x1), y1: toScreenY(y1), x2: toScreenX(x2), y2: toScreenY(y2) };
    } else {
      const xConst = c / a;
      return {
        x1: toScreenX(xConst),
        y1: toScreenY(-6),
        x2: toScreenX(xConst),
        y2: toScreenY(6),
      };
    }
  };

  const line1 = computeLinePoints(system.eq1);
  const line2 = computeLinePoints(system.eq2);

  const intX = sol.status === 'unique' && sol.x ? sol.x.num / sol.x.den : null;
  const intY = sol.status === 'unique' && sol.y ? sol.y.num / sol.y.den : null;

  return (
    <div className="rounded-2xl border border-[#D5CFC0] bg-white p-3.5 shadow-xs">
      {title && (
        <div className="text-xs font-extrabold text-[#195E3E] uppercase tracking-wider mb-2">
          {title}
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto max-h-[250px] rounded-xl bg-[#F8FAFC] border border-slate-200"
        role="img"
        aria-label="Biểu diễn hình học tập nghiệm của hệ hai phương trình bậc nhất hai ẩn"
      >
        <defs>
          <clipPath id="coordClip">
            <rect x="10" y="10" width={width - 20} height={height - 20} rx="8" />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: 15 }).map((_, idx) => {
          const u = idx - 7;
          return (
            <g key={u}>
              <line
                x1={toScreenX(u)}
                y1={10}
                x2={toScreenX(u)}
                y2={height - 10}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <line
                x1={10}
                y1={toScreenY(u)}
                x2={width - 10}
                y2={toScreenY(u)}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
            </g>
          );
        })}

        {/* Coordinate Axes Ox, Oy */}
        <line x1={12} y1={originY} x2={width - 12} y2={originY} stroke="#475569" strokeWidth="1.8" />
        <line x1={originX} y1={12} x2={originX} y2={height - 12} stroke="#475569" strokeWidth="1.8" />
        <text x={width - 22} y={originY - 6} fontSize="11" fontWeight="700" fill="#334155">
          x
        </text>
        <text x={originX + 8} y={22} fontSize="11" fontWeight="700" fill="#334155">
          y
        </text>
        <text x={originX - 12} y={originY + 14} fontSize="10" fontWeight="700" fill="#64748B">
          O
        </text>

        {/* Plotted Lines d1 and d2 */}
        <g clipPath="url(#coordClip)">
          {line1 && (
            <line
              x1={line1.x1}
              y1={line1.y1}
              x2={line1.x2}
              y2={line1.y2}
              stroke="#195E3E"
              strokeWidth="3.5"
            />
          )}
          {line2 && (
            <line
              x1={line2.x1}
              y1={line2.y1}
              x2={line2.x2}
              y2={line2.y2}
              stroke="#EA580C"
              strokeWidth={sol.status === 'infinite_solutions' ? '2.5' : '3'}
              strokeDasharray={sol.status === 'infinite_solutions' ? '7 5' : undefined}
            />
          )}

          {/* Intersection Point if Unique Solution */}
          {intX !== null && intY !== null && Math.abs(intX) <= 8 && Math.abs(intY) <= 6 && (
            <g>
              <circle
                cx={toScreenX(intX)}
                cy={toScreenY(intY)}
                r="6.5"
                fill="#DC2626"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <rect
                x={toScreenX(intX) + 8}
                y={toScreenY(intY) - 24}
                width="74"
                height="20"
                rx="5"
                fill="#FEF2F2"
                stroke="#FCA5A5"
              />
              <text
                x={toScreenX(intX) + 45}
                y={toScreenY(intY) - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="800"
                fill="#991B1B"
              >
                M({formatRational(sol.x!)}; {formatRational(sol.y!)})
              </text>
            </g>
          )}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#195E3E]">
            <span className="w-3.5 h-1 rounded-full bg-[#195E3E] inline-block" />
            d₁: {formatEquationDisplay(system.eq1)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-[#EA580C]">
            <span className="w-3.5 h-1 rounded-full bg-[#EA580C] inline-block" />
            d₂: {formatEquationDisplay(system.eq2)}
          </span>
        </div>
        <span className="font-extrabold text-[#102A43]">
          {sol.geometricRelation === 'intersecting' && !isZeroRat(sol.D)
            ? '⚡ Hai đường thẳng cắt nhau (1 nghiệm)'
            : sol.geometricRelation === 'parallel_distinct'
              ? '⏸ Hai đường thẳng song song (Vô nghiệm)'
              : '♾ Hai đường thẳng trùng nhau (Vô số nghiệm)'}
        </span>
      </div>
    </div>
  );
};
