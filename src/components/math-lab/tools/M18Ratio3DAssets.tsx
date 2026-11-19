import React from 'react';
import { M18ActivityId } from '../mathEngine/ratioProportionEngine';

// ============================================================================
// 1. 3D GLASS BEAKER WITH HANDLE & LIQUID (Cốc thủy tinh chia vạch có tay cầm)
// ============================================================================

export const GlassBeaker3D: React.FC<{
  liquidColor: string;
  fillRatio?: number; // 0..1
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  highlight?: boolean;
  onClick?: () => void;
}> = ({
  liquidColor,
  fillRatio = 0.72,
  size = 'md',
  label,
  highlight = false,
  onClick,
}) => {
  const dims =
    size === 'sm'
      ? { w: 46, h: 52 }
      : size === 'lg'
        ? { w: 68, h: 76 }
        : { w: 56, h: 64 };

  const clampedFill = Math.max(0.15, Math.min(0.88, fillRatio));
  const bodyTop = 10;
  const bodyBottom = 64;
  const bodyHeight = bodyBottom - bodyTop;
  const liquidHeight = bodyHeight * clampedFill;
  const liquidTop = bodyBottom - liquidHeight;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex flex-col items-center select-none transition-transform duration-200 ${
        onClick ? 'cursor-pointer hover:-translate-y-1 active:scale-95' : ''
      } ${highlight ? 'scale-105 drop-shadow-[0_6px_14px_rgba(249,115,22,0.38)]' : 'drop-shadow-[0_6px_10px_rgba(15,23,42,0.16)]'}`}
    >
      <svg
        width={dims.w}
        height={dims.h}
        viewBox="0 0 74 74"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="m18-glass-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.78" />
            <stop offset="22%" stopColor="#F8FAFC" stopOpacity="0.32" />
            <stop offset="78%" stopColor="#E2E8F0" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.82" />
          </linearGradient>
          <linearGradient id="m18-glass-rim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
        </defs>

        {/* Ground Shadow */}
        <ellipse cx="32" cy="68" rx="22" ry="4.5" fill="rgba(15,23,42,0.18)" />

        {/* Glass Handle on Right */}
        <path
          d="M 52 20 C 66 20, 66 52, 52 52"
          fill="none"
          stroke="url(#m18-glass-rim)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M 52 22 C 63 22, 63 50, 52 50"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Back Glass Wall */}
        <path
          d="M 10 12 L 13 61 C 13.5 64.5, 50.5 64.5, 51 61 L 54 12 Z"
          fill="rgba(255,255,255,0.34)"
          stroke="#CBD5E1"
          strokeWidth="1.2"
        />

        {/* Liquid Volume */}
        <path
          d={`M 12.2 ${liquidTop} L 13.4 60.5 C 14 63.8, 50 63.8, 50.6 60.5 L 51.8 ${liquidTop} Z`}
          fill={liquidColor}
          fillOpacity="0.92"
        />

        {/* Liquid Meniscus Top Ellipse */}
        <ellipse
          cx="32"
          cy={liquidTop}
          rx="19.6"
          ry="3.6"
          fill={liquidColor}
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="1"
        />
        <ellipse
          cx="28"
          cy={liquidTop - 0.4}
          rx="11"
          ry="1.6"
          fill="rgba(255,255,255,0.36)"
        />

        {/* Glass Body Specular Overlay */}
        <path
          d="M 10 12 L 13 61 C 13.5 64.5, 50.5 64.5, 51 61 L 54 12 Z"
          fill="url(#m18-glass-body)"
          stroke={highlight ? '#F97316' : '#94A3B8'}
          strokeWidth={highlight ? '2.2' : '1.4'}
        />

        {/* Graduation Marks */}
        <line x1="22" y1="26" x2="30" y2="26" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3" />
        <line x1="22" y1="36" x2="28" y2="36" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3" />
        <line x1="22" y1="46" x2="30" y2="46" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3" />

        {/* Vertical Left Highlight */}
        <path
          d="M 15 16 L 17 58"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />

        {/* Top Spout & Rim */}
        <ellipse
          cx="32"
          cy="12"
          rx="22.5"
          ry="4.2"
          fill="rgba(255,255,255,0.55)"
          stroke="url(#m18-glass-rim)"
          strokeWidth="2.2"
        />
      </svg>
      {label && (
        <span className="mt-0.5 text-[10px] font-extrabold text-[#334155] bg-white/85 px-1.5 py-0.5 rounded-md border border-[#CBD5E1] shadow-2xs">
          {label}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// 2. LARGE MIXING PITCHER WITH STIRRING ROD (Cốc pha lớn có đũa khuấy kim loại)
// ============================================================================

export const MixingPitcherWithRod3D: React.FC<{
  mixedColorHex: string;
  totalParts: number;
  maxParts?: number;
  label?: string;
  isStirring?: boolean;
}> = ({
  mixedColorHex,
  totalParts,
  maxParts = 15,
  label,
  isStirring = false,
}) => {
  const fillRatio = totalParts <= 0 ? 0 : Math.max(0.24, Math.min(0.86, totalParts / maxParts));
  const bodyTop = 24;
  const bodyBottom = 114;
  const liquidTop = bodyBottom - (bodyBottom - bodyTop) * fillRatio;

  return (
    <div className="relative inline-flex flex-col items-center select-none drop-shadow-[0_12px_18px_rgba(15,23,42,0.22)]">
      <svg width="118" height="132" viewBox="0 0 124 132" className="overflow-visible">
        <defs>
          <linearGradient id="m18-rod-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="45%" stopColor="#94A3B8" />
            <stop offset="75%" stopColor="#334155" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="m18-pitcher-glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.82" />
            <stop offset="25%" stopColor="#F8FAFC" stopOpacity="0.28" />
            <stop offset="75%" stopColor="#CBD5E1" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.86" />
          </linearGradient>
        </defs>

        {/* Ground Shadow */}
        <ellipse cx="56" cy="120" rx="38" ry="7" fill="rgba(15,23,42,0.24)" />

        {/* Glass Handle */}
        <path
          d="M 88 38 C 110 38, 110 96, 86 96"
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M 88 40 C 106 40, 106 94, 86 94"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Metallic Stirring Rod (Đũa khuấy) */}
        <g
          className={
            isStirring ? 'origin-[56px_78px] animate-[wiggle_0.8s_ease-in-out_infinite]' : ''
          }
        >
          <line
            x1="92"
            y1="4"
            x2="48"
            y2="108"
            stroke="url(#m18-rod-metal)"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <line
            x1="91"
            y1="4"
            x2="47"
            y2="108"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>

        {/* Liquid Fill */}
        {totalParts > 0 && (
          <>
            <path
              d={`M 22 ${liquidTop} L 24 109 C 25 115, 87 115, 88 109 L 90 ${liquidTop} Z`}
              fill={mixedColorHex}
              fillOpacity="0.93"
            />
            <ellipse
              cx="56"
              cy={liquidTop}
              rx="34"
              ry="6"
              fill={mixedColorHex}
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="1.4"
            />
            <ellipse
              cx="49"
              cy={liquidTop - 0.8}
              rx="19"
              ry="2.5"
              fill="rgba(255,255,255,0.38)"
            />
          </>
        )}

        {/* Glass Body Overlay */}
        <path
          d="M 19 24 L 23 110 C 24 117, 88 117, 89 110 L 93 24 Z"
          fill="url(#m18-pitcher-glass)"
          stroke="#94A3B8"
          strokeWidth="2"
        />

        {/* Graduation Marks */}
        <line x1="36" y1="44" x2="48" y2="44" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" />
        <line x1="36" y1="60" x2="45" y2="60" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" />
        <line x1="36" y1="76" x2="48" y2="76" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" />
        <line x1="36" y1="92" x2="45" y2="92" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" />

        {/* Left Specular Highlight */}
        <path
          d="M 27 30 L 29 105"
          stroke="rgba(255,255,255,0.88)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Top Glass Rim */}
        <ellipse
          cx="56"
          cy="24"
          rx="37.5"
          ry="6.5"
          fill="rgba(255,255,255,0.45)"
          stroke="#CBD5E1"
          strokeWidth="2.6"
        />
      </svg>
      {label && (
        <span className="mt-1 px-2.5 py-0.5 rounded-lg bg-[#0F5132] text-white text-[11px] font-extrabold shadow-sm">
          {label}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// 3. 3D GLOSSY SPHERE (Hạt bi 3D Xanh lam / Vàng cam)
// ============================================================================

export const GlossySphere3D: React.FC<{
  colorType: 'blue' | 'yellow' | 'green';
  size?: number;
  badge?: string | number;
  onClick?: () => void;
}> = ({ colorType, size = 38, badge, onClick }) => {
  const gradId = `m18-sphere-${colorType}`;
  const colors =
    colorType === 'blue'
      ? { hi: '#93C5FD', mid: '#2563EB', lo: '#1E3A8A', rim: '#1D4ED8' }
      : colorType === 'yellow'
        ? { hi: '#FEF08A', mid: '#FACC15', lo: '#CA8A04', rim: '#D97706' }
        : { hi: '#86EFAC', mid: '#22C55E', lo: '#15803D', rim: '#166534' };

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none transition-transform ${
        onClick ? 'cursor-pointer hover:scale-110 active:scale-95' : ''
      }`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" className="overflow-visible">
        <defs>
          <radialGradient id={gradId} cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="22%" stopColor={colors.hi} />
            <stop offset="65%" stopColor={colors.mid} />
            <stop offset="100%" stopColor={colors.lo} />
          </radialGradient>
        </defs>
        <ellipse cx="24" cy="43" rx="15" ry="3.5" fill="rgba(15,23,42,0.22)" />
        <circle
          cx="24"
          cy="22"
          r="18"
          fill={`url(#${gradId})`}
          stroke={colors.rim}
          strokeWidth="1.2"
        />
        <ellipse
          cx="18"
          cy="15"
          rx="6"
          ry="3.4"
          transform="rotate(-24 18 15)"
          fill="rgba(255,255,255,0.72)"
        />
      </svg>
      {badge !== undefined && (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] pointer-events-none">
          {badge}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// 4. 3D RATIO EXPLORER ROBOT WITH LAB GOGGLES (Robot trợ giảng phòng thí nghiệm)
// ============================================================================

export const RatioLabRobot3D: React.FC<{
  mood?: 'happy' | 'thinking' | 'celebrating';
  speechText?: string;
}> = ({ mood = 'happy', speechText }) => {
  return (
    <div className="relative flex flex-col items-center select-none">
      {speechText && (
        <div className="mb-1.5 max-w-[185px] rounded-xl bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-[#1E293B] shadow-md border border-[#E2D6C3] text-center leading-tight">
          {speechText}
        </div>
      )}
      <svg
        width="136"
        height="168"
        viewBox="0 0 150 185"
        className="overflow-visible drop-shadow-[0_12px_18px_rgba(15,23,42,0.25)]"
      >
        <defs>
          <linearGradient id="m18-bot-white" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>
          <linearGradient id="m18-bot-orange" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="m18-bot-green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>
        </defs>

        {/* Floor Shadow */}
        <ellipse cx="72" cy="174" rx="42" ry="8" fill="rgba(15,23,42,0.24)" />

        {/* Backpack (Ba lô xanh lá) */}
        <rect
          x="26"
          y="88"
          width="24"
          height="42"
          rx="8"
          fill="url(#m18-bot-green)"
          stroke="#14532D"
          strokeWidth="1.8"
        />

        {/* Left & Right Legs */}
        <rect x="50" y="136" width="16" height="24" rx="7" fill="url(#m18-bot-white)" stroke="#94A3B8" strokeWidth="1.5" />
        <rect x="78" y="136" width="16" height="24" rx="7" fill="url(#m18-bot-white)" stroke="#94A3B8" strokeWidth="1.5" />

        {/* Boots */}
        <path
          d="M 44 158 Q 44 148 58 148 L 68 148 Q 72 158 68 168 L 44 168 Z"
          fill="url(#m18-bot-white)"
          stroke="#64748B"
          strokeWidth="1.5"
        />
        <path d="M 44 164 L 69 164" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M 74 158 Q 74 148 88 148 L 98 148 Q 104 158 100 168 L 74 168 Z"
          fill="url(#m18-bot-white)"
          stroke="#64748B"
          strokeWidth="1.5"
        />
        <path d="M 74 164 L 100 164" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />

        {/* Torso */}
        <rect
          x="44"
          y="86"
          width="56"
          height="54"
          rx="18"
          fill="url(#m18-bot-white)"
          stroke="#94A3B8"
          strokeWidth="1.8"
        />
        {/* Chest Book Emblem */}
        <rect
          x="56"
          y="98"
          width="32"
          height="24"
          rx="7"
          fill="#F0FDF4"
          stroke="#16A34A"
          strokeWidth="2"
        />
        <path
          d="M 64 114 L 72 116 L 80 114 L 80 104 L 72 106 L 64 104 Z"
          fill="#16A34A"
        />

        {/* Upper Arm Pointing to Upper Tier (Tay trái giơ chỉ tầng trên) */}
        <g className="origin-[96px_96px] transition-transform duration-300">
          <path
            d="M 96 96 L 132 72"
            stroke="url(#m18-bot-white)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <circle cx="114" cy="84" r="6" fill="url(#m18-bot-orange)" />
          <circle cx="136" cy="69" r="7.5" fill="url(#m18-bot-white)" stroke="#94A3B8" strokeWidth="1.5" />
        </g>

        {/* Lower Arm Pointing to Lower Tier (Tay phải chỉ tầng dưới) */}
        <g>
          <path
            d="M 46 102 L 82 118"
            stroke="url(#m18-bot-white)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <circle cx="46" cy="102" r="6.5" fill="url(#m18-bot-orange)" />
          <circle cx="88" cy="120" r="7" fill="url(#m18-bot-white)" stroke="#94A3B8" strokeWidth="1.5" />
        </g>

        {/* Head Helmet */}
        <rect
          x="30"
          y="22"
          width="84"
          height="64"
          rx="30"
          fill="url(#m18-bot-white)"
          stroke="#94A3B8"
          strokeWidth="2"
        />

        {/* Side Ear Caps */}
        <ellipse cx="28" cy="56" rx="6" ry="13" fill="url(#m18-bot-orange)" />
        <ellipse cx="116" cy="56" rx="6" ry="13" fill="url(#m18-bot-orange)" />

        {/* Lab Safety Goggles on Forehead (Kính bảo hộ phòng thí nghiệm) */}
        <path
          d="M 34 32 Q 72 18 110 32"
          fill="none"
          stroke="#15803D"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <rect
          x="42"
          y="16"
          width="26"
          height="16"
          rx="8"
          fill="#E0F2FE"
          stroke="#64748B"
          strokeWidth="3"
        />
        <rect
          x="76"
          y="16"
          width="26"
          height="16"
          rx="8"
          fill="#E0F2FE"
          stroke="#64748B"
          strokeWidth="3"
        />

        {/* Digital Face Screen */}
        <rect
          x="40"
          y="36"
          width="64"
          height="40"
          rx="18"
          fill="#0F172A"
          stroke="#334155"
          strokeWidth="2"
        />

        {/* Glowing Cyan Eyes & Smile */}
        {mood === 'thinking' ? (
          <>
            <circle cx="58" cy="52" r="5.5" fill="#38BDF8" />
            <rect x="80" y="49" width="12" height="5" rx="2.5" fill="#38BDF8" />
            <path d="M 64 66 Q 72 63 80 66" fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path
              d="M 50 53 Q 57 44 64 53"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 80 53 Q 87 44 94 53"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 63 63 Q 72 71 81 63"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </div>
  );
};

// ============================================================================
// 5. PARALLEL DOUBLE NUMBER LINE SVG (Trục số đôi song song cho Tỉ số bằng nhau)
// ============================================================================

export const DoubleNumberLineSVG: React.FC<{
  baseA: number;
  baseB: number;
  activeMultiplier: number;
  maxStep?: number;
  labelA?: string;
  labelB?: string;
}> = ({
  baseA,
  baseB,
  activeMultiplier,
  maxStep = 5,
  labelA = 'Xanh',
  labelB = 'Vàng',
}) => {
  const steps = Array.from({ length: maxStep + 1 }, (_, i) => i);
  const startX = 95;
  const endX = 560;
  const span = endX - startX;

  return (
    <svg viewBox="0 0 610 132" className="w-full h-auto select-none">
      {/* Background Card */}
      <rect
        x="4"
        y="4"
        width="602"
        height="124"
        rx="16"
        fill="#FFFDF9"
        stroke="#E2D6C3"
        strokeWidth="1.5"
      />

      {/* Top Line Label & Axis */}
      <text x="18" y="42" fill="#1D4ED8" fontSize="13" fontWeight="800">
        {labelA}
      </text>
      <line x1={startX} y1="38" x2={endX + 18} y2="38" stroke="#2563EB" strokeWidth="3.5" strokeLinecap="round" />
      <polygon points={`${endX + 24},38 ${endX + 14},33 ${endX + 14},43`} fill="#2563EB" />

      {/* Bottom Line Label & Axis */}
      <text x="18" y="96" fill="#D97706" fontSize="13" fontWeight="800">
        {labelB}
      </text>
      <line x1={startX} y1="92" x2={endX + 18} y2="92" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
      <polygon points={`${endX + 24},92 ${endX + 14},87 ${endX + 14},97`} fill="#F59E0B" />

      {steps.map((k) => {
        const x = startX + (k / maxStep) * span;
        const isBase = k === 1;
        const isActive = k === activeMultiplier;
        return (
          <g key={k}>
            {/* Vertical Connector */}
            <line
              x1={x}
              y1="38"
              x2={x}
              y2="92"
              stroke={isActive ? '#16A34A' : isBase ? '#2563EB' : '#CBD5E1'}
              strokeWidth={isActive ? '3' : '1.5'}
              strokeDasharray={isActive || isBase ? undefined : '4 3'}
            />
            {isActive && (
              <rect
                x={x - 24}
                y="12"
                width="48"
                height="108"
                rx="10"
                fill="rgba(22,163,74,0.10)"
                stroke="#16A34A"
                strokeWidth="1.5"
              />
            )}

            {/* Top Tick & Value */}
            <circle
              cx={x}
              cy="38"
              r={isActive ? 6.5 : 4.5}
              fill={isActive ? '#16A34A' : '#2563EB'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <text
              x={x}
              y="25"
              textAnchor="middle"
              fontSize={isActive ? '14' : '12'}
              fontWeight="900"
              fill={isActive ? '#15803D' : '#1E3A8A'}
            >
              {baseA * k}
            </text>

            {/* Bottom Tick & Value */}
            <circle
              cx={x}
              cy="92"
              r={isActive ? 6.5 : 4.5}
              fill={isActive ? '#16A34A' : '#D97706'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <text
              x={x}
              y="114"
              textAnchor="middle"
              fontSize={isActive ? '14' : '12'}
              fontWeight="900"
              fill={isActive ? '#15803D' : '#B45309'}
            >
              {baseB * k}
            </text>

            {/* Multiplier Badge */}
            {k >= 1 && (
              <text
                x={x}
                y="69"
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill={isActive ? '#15803D' : '#64748B'}
              >
                ×{k}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ============================================================================
// 6. BOTTOM 6 ACTIVITY 3D THUMBNAIL CARDS (Khớp ảnh mẫu đính kèm)
// ============================================================================

export const M18ActivityThumbnailCard3D: React.FC<{
  activityId: M18ActivityId;
}> = ({ activityId }) => {
  switch (activityId) {
    case 'CREATE_RATIO':
      return (
        <svg viewBox="0 0 180 76" className="w-full h-14 overflow-visible">
          <ellipse cx="90" cy="68" rx="68" ry="5" fill="rgba(15,23,42,0.12)" />
          {/* Top row: 3 Blue spheres */}
          {[56, 90, 124].map((cx, i) => (
            <g key={`b-${i}`}>
              <circle cx={cx} cy="24" r="12" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1" />
              <ellipse cx={cx - 4} cy="19" rx="4" ry="2.2" fill="rgba(255,255,255,0.75)" />
            </g>
          ))}
          {/* Bottom row: 4 Yellow spheres */}
          {[42, 74, 106, 138].map((cx, i) => (
            <g key={`y-${i}`}>
              <circle cx={cx} cy="52" r="12" fill="#FACC15" stroke="#D97706" strokeWidth="1" />
              <ellipse cx={cx - 4} cy="47" rx="4" ry="2.2" fill="rgba(255,255,255,0.75)" />
            </g>
          ))}
        </svg>
      );

    case 'MIX_COLOR_RATIO':
      return (
        <svg viewBox="0 0 180 76" className="w-full h-14 overflow-visible">
          <ellipse cx="90" cy="68" rx="68" ry="5" fill="rgba(15,23,42,0.14)" />
          {[
            { x: 34, color: '#2563EB' },
            { x: 78, color: '#FACC15' },
            { x: 122, color: '#38B000' },
          ].map((cup, idx) => (
            <g key={idx} transform={`translate(${cup.x}, 12)`}>
              <path d="M 28 14 C 35 14, 35 38, 28 38" fill="none" stroke="#94A3B8" strokeWidth="2.5" />
              <rect x="2" y="16" width="24" height="34" rx="3" fill={cup.color} opacity="0.92" />
              <rect
                x="0"
                y="6"
                width="28"
                height="46"
                rx="4"
                fill="rgba(255,255,255,0.34)"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              <line x1="5" y1="10" x2="5" y2="48" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
            </g>
          ))}
        </svg>
      );

    case 'EQUIVALENT_RATIOS':
      return (
        <svg viewBox="0 0 180 76" className="w-full h-14 overflow-visible">
          {/* Top Bar: 2 Blue + 2 Yellow */}
          {[28, 50].map((x, i) => (
            <rect key={`tb-${i}`} x={x} y="16" width="21" height="16" rx="3" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1" />
          ))}
          {[72, 94].map((x, i) => (
            <rect key={`ty-${i}`} x={x} y="16" width="21" height="16" rx="3" fill="#FACC15" stroke="#CA8A04" strokeWidth="1" />
          ))}
          {/* Bottom Bar: 3 Blue + 3 Yellow */}
          {[22, 44, 66].map((x, i) => (
            <rect key={`bb-${i}`} x={x} y="42" width="21" height="16" rx="3" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1" />
          ))}
          {[88, 110, 132].map((x, i) => (
            <rect key={`by-${i}`} x={x} y="42" width="21" height="16" rx="3" fill="#FACC15" stroke="#CA8A04" strokeWidth="1" />
          ))}
        </svg>
      );

    case 'DIVIDE_BY_RATIO':
      return (
        <svg viewBox="0 0 180 76" className="w-full h-14 overflow-visible">
          {/* Top 2 Blue segmented discs */}
          {[68, 112].map((cx, i) => (
            <g key={`db-${i}`}>
              <circle cx={cx} cy="22" r="14" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1.2" />
              <line x1={cx - 14} y1="22" x2={cx + 14} y2="22" stroke="#93C5FD" strokeWidth="1" />
              <line x1={cx} y1="8" x2={cx} y2="36" stroke="#93C5FD" strokeWidth="1" />
            </g>
          ))}
          {/* Bottom 3 Yellow segmented discs */}
          {[48, 90, 132].map((cx, i) => (
            <g key={`dy-${i}`}>
              <circle cx={cx} cy="52" r="14" fill="#FACC15" stroke="#CA8A04" strokeWidth="1.2" />
              <line x1={cx - 14} y1="52" x2={cx + 14} y2="52" stroke="#FEF08A" strokeWidth="1" />
              <line x1={cx} y1="38" x2={cx} y2="66" stroke="#FEF08A" strokeWidth="1" />
            </g>
          ))}
        </svg>
      );

    case 'PROPORTIONAL_QUANTITIES':
      return (
        <svg viewBox="0 0 180 76" className="w-full h-14 overflow-visible">
          {/* Brass Balance Scale */}
          <ellipse cx="90" cy="66" rx="26" ry="5" fill="#D97706" stroke="#92400E" strokeWidth="1.2" />
          <rect x="87" y="14" width="6" height="52" rx="2" fill="#F59E0B" stroke="#92400E" strokeWidth="1" />
          <line x1="42" y1="20" x2="138" y2="20" stroke="#D97706" strokeWidth="3.5" strokeLinecap="round" />
          {/* Left Pan & Weights */}
          <line x1="46" y1="20" x2="36" y2="48" stroke="#92400E" strokeWidth="1.2" />
          <line x1="46" y1="20" x2="56" y2="48" stroke="#92400E" strokeWidth="1.2" />
          <rect x="38" y="36" width="16" height="12" rx="2" fill="#64748B" stroke="#334155" strokeWidth="1" />
          <path d="M 32 48 Q 46 54 60 48 Z" fill="#F59E0B" stroke="#92400E" strokeWidth="1" />
          {/* Right Pan & Weights */}
          <line x1="134" y1="20" x2="124" y2="48" stroke="#92400E" strokeWidth="1.2" />
          <line x1="134" y1="20" x2="144" y2="48" stroke="#92400E" strokeWidth="1.2" />
          <rect x="126" y="36" width="16" height="12" rx="2" fill="#64748B" stroke="#334155" strokeWidth="1" />
          <path d="M 120 48 Q 134 54 148 48 Z" fill="#F59E0B" stroke="#92400E" strokeWidth="1" />
        </svg>
      );

    case 'REAL_WORLD_CHALLENGE':
    default:
      return (
        <svg viewBox="0 0 180 76" className="w-full h-14 overflow-visible">
          {/* Shopping Basket with Milk, Apple, Bananas */}
          <ellipse cx="90" cy="68" rx="54" ry="5" fill="rgba(15,23,42,0.15)" />
          {/* Milk Carton */}
          <rect x="52" y="16" width="24" height="36" rx="3" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1.4" />
          <polygon points="52,16 64,8 76,16" fill="#BFDBFE" stroke="#60A5FA" strokeWidth="1.2" />
          {/* Red Apple */}
          <circle cx="92" cy="38" r="14" fill="#EF4444" stroke="#B91C1C" strokeWidth="1.2" />
          <path d="M 92 22 Q 97 18 100 22" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" />
          {/* Yellow Bananas */}
          <path d="M 108 44 Q 126 36 124 18 Q 132 32 116 48 Z" fill="#FACC15" stroke="#CA8A04" strokeWidth="1.2" />
          {/* Basket Wire Frame */}
          <path
            d="M 40 38 L 48 64 L 132 64 L 140 38 Z"
            fill="rgba(255,255,255,0.45)"
            stroke="#16A34A"
            strokeWidth="2.5"
          />
          <line x1="44" y1="48" x2="136" y2="48" stroke="#16A34A" strokeWidth="1.5" />
          <line x1="68" y1="38" x2="70" y2="64" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="90" y1="38" x2="90" y2="64" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="112" y1="38" x2="110" y2="64" stroke="#CBD5E1" strokeWidth="1.5" />
        </svg>
      );
  }
};
