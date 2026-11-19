import React from 'react';
import { M05ActivityId, RawFraction } from '../mathEngine/fractionDiscoveryEngine';

// ============================================================================
// 1. STACKED MATHEMATICAL FRACTION DISPLAY COMPONENT (ACCESSIBLE & CRISP)
// ============================================================================

export const StackedFractionBadge: React.FC<{
  fraction: RawFraction;
  wholePart?: number;
  isNegativeMixed?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'cream_tile' | 'emerald' | 'amber' | 'inline';
  highlightNum?: boolean;
  highlightDen?: boolean;
}> = ({
  fraction,
  wholePart,
  isNegativeMixed,
  size = 'md',
  variant = 'inline',
  highlightNum = false,
  highlightDen = false,
}) => {
  const sizeStyles = {
    sm: { numDen: 'text-sm leading-tight', bar: 'h-[2px] min-w-[18px]', whole: 'text-base' },
    md: { numDen: 'text-lg leading-tight', bar: 'h-[2.5px] min-w-[24px]', whole: 'text-xl' },
    lg: { numDen: 'text-2xl leading-none', bar: 'h-[3px] min-w-[30px]', whole: 'text-2xl' },
    xl: { numDen: 'text-3xl sm:text-4xl leading-none', bar: 'h-[3.5px] min-w-[38px]', whole: 'text-3xl sm:text-4xl' },
  }[size];

  const containerStyles = {
    cream_tile:
      'px-3.5 py-2 rounded-2xl bg-gradient-to-b from-[#FAF5EA] to-[#EAE0CC] border-2 border-[#D5C7AD] shadow-[0_5px_0_#C2B295,0_8px_16px_rgba(20,51,42,0.12)] text-[#12382B]',
    emerald:
      'px-3.5 py-2 rounded-2xl bg-gradient-to-b from-[#177E5A] to-[#0F5A40] border-2 border-[#23966E] shadow-[0_4px_12px_rgba(19,111,80,0.25)] text-white',
    amber:
      'px-3.5 py-2 rounded-2xl bg-gradient-to-b from-[#FFF9EB] to-[#F6E6C6] border-2 border-[#E07A1B] shadow-xs text-[#12382B]',
    inline: 'inline-flex items-center text-current',
  }[variant];

  const barColor = variant === 'emerald' ? 'bg-white' : 'bg-[#12382B]';

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 font-black tabular-nums select-none ${containerStyles}`}
      aria-label={
        wholePart !== undefined && wholePart > 0
          ? `${isNegativeMixed ? 'âm ' : ''}${wholePart} và ${fraction.num} phần ${fraction.den}`
          : `${fraction.num} phần ${fraction.den}`
      }
    >
      {isNegativeMixed && <span className={`${sizeStyles.whole} font-black mr-0.5`}>−(</span>}
      {wholePart !== undefined && wholePart !== 0 && (
        <span className={`${sizeStyles.whole} font-black`}>{wholePart}</span>
      )}
      <span className="inline-flex flex-col items-center justify-center">
        <span
          className={`${sizeStyles.numDen} pb-1 ${
            highlightNum ? 'text-[#D96B16]' : ''
          }`}
        >
          {fraction.num}
        </span>
        <span className={`w-full rounded-full ${sizeStyles.bar} ${barColor}`} />
        <span
          className={`${sizeStyles.numDen} pt-1 ${
            highlightDen ? 'text-[#0F766E]' : ''
          }`}
        >
          {fraction.den}
        </span>
      </span>
      {isNegativeMixed && <span className={`${sizeStyles.whole} font-black ml-0.5`}>)</span>}
    </span>
  );
};

// ============================================================================
// 2. HEADER BRAND LOCKUP & EMERALD RIBBON BANNER (MATCHING REFERENCE IMAGE)
// ============================================================================

export const TayDoFractionBrandLogo3D: React.FC = () => (
  <div className="inline-flex items-center gap-3 select-none">
    {/* Open Book + Warm Amber Sphere Logo */}
    <svg viewBox="0 0 48 44" className="w-10 h-9 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="m05SunGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="m05BookGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#19825D" />
          <stop offset="100%" stopColor="#0E523A" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="14" r="9.5" fill="url(#m05SunGrad)" />
      <path
        d="M6 20 C 14 20, 20 23, 24 27 C 28 23, 34 20, 42 20 L 42 36 C 34 36, 28 39, 24 42 C 20 39, 14 36, 6 36 Z"
        fill="url(#m05BookGrad)"
        stroke="#0A3D2B"
        strokeWidth="1.2"
      />
      <line x1="24" y1="27" x2="24" y2="42" stroke="#FAF5EA" strokeWidth="1.8" />
    </svg>

    <div className="flex items-center gap-3">
      <span className="text-base sm:text-xl font-black tracking-tight text-[#114B38]">
        TÂY ĐÔ SMART EDU
      </span>
      <span className="text-[#BDB29D] font-light text-xl hidden sm:inline">|</span>
      <div className="hidden sm:inline-flex items-center gap-1.5">
        {/* Lab Flask Icon */}
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#136F50]" fill="none" aria-hidden="true">
          <path
            d="M9 3H15M10 3V8.5L4.8 17.2C4.1 18.4 5 20 6.4 20H17.6C19 20 19.9 18.4 19.2 17.2L14 8.5V3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M6.5 15H17.5L18.5 17.5H5.5L6.5 15Z" fill="#136F50" fillOpacity="0.3" />
        </svg>
        <div className="leading-none">
          <div className="text-[11px] font-extrabold text-[#136F50] tracking-wider">SMART</div>
          <div className="text-[11px] font-extrabold text-[#136F50] tracking-wider">MATH LAB</div>
        </div>
      </div>
    </div>
  </div>
);

export const FractionRibbonBanner3D: React.FC<{ title?: string }> = ({
  title = 'Khám phá phân số',
}) => (
  <div className="inline-flex items-center justify-center relative select-none">
    <div className="px-7 sm:px-10 py-2 rounded-full bg-gradient-to-b from-[#177957] via-[#126347] to-[#0C4732] border-2 border-[#E7A640] shadow-[0_6px_18px_rgba(14,62,45,0.28),inset_0_2px_4px_rgba(255,255,255,0.28)] flex items-center gap-3">
      {/* Left Gold Laurel / Wheat Accent */}
      <svg viewBox="0 0 24 20" className="w-5 h-4 text-[#F59E0B] shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M20 16C14 16 8 12 4 4C8 5 12 8 14 11C13 7 15 4 18 2C17 6 18 10 20 16Z" />
      </svg>
      <h1 className="text-lg sm:text-2xl font-black text-[#FFFDF7] tracking-tight drop-shadow-xs">
        {title}
      </h1>
      {/* Right Gold Laurel / Wheat Accent */}
      <svg
        viewBox="0 0 24 20"
        className="w-5 h-4 text-[#F59E0B] shrink-0 scale-x-[-1]"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20 16C14 16 8 12 4 4C8 5 12 8 14 11C13 7 15 4 18 2C17 6 18 10 20 16Z" />
      </svg>
    </div>
  </div>
);

// ============================================================================
// 3. LEFT SIDEBAR ACTIVITY ICONS
// ============================================================================

export const ActivitySidebarIcon3D: React.FC<{
  activityId: M05ActivityId;
  active: boolean;
}> = ({ activityId, active }) => {
  const strokeColor = active ? '#FFFFFF' : '#E07A1B';

  switch (activityId) {
    case 'EQUAL_PARTS':
      return (
        <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="10" stroke={strokeColor} strokeWidth="2.2" />
          <line x1="14" y1="4" x2="14" y2="24" stroke={strokeColor} strokeWidth="2" />
          <line x1="4" y1="14" x2="24" y2="14" stroke={strokeColor} strokeWidth="2" />
          <circle cx="17.5" cy="10.5" r="1.3" fill={strokeColor} />
          <circle cx="10.5" cy="17.5" r="1.3" fill={strokeColor} />
        </svg>
      );
    case 'BUILD_READ_FRACTION':
      return (
        <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" fill="none" aria-hidden="true">
          <rect x="4" y="6" width="13" height="16" rx="2.5" stroke={strokeColor} strokeWidth="2.2" />
          <rect x="13" y="9" width="11" height="13" rx="2.5" fill={active ? '#136F50' : '#FAF5EA'} stroke={strokeColor} strokeWidth="2.2" />
          <line x1="13" y1="15.5" x2="24" y2="15.5" stroke={strokeColor} strokeWidth="1.8" />
        </svg>
      );
    case 'EQUIVALENT_FRACTIONS':
      return (
        <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" fill="none" aria-hidden="true">
          <line x1="6" y1="11" x2="22" y2="11" stroke={strokeColor} strokeWidth="2.8" strokeLinecap="round" />
          <line x1="6" y1="17" x2="22" y2="17" stroke={strokeColor} strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );
    case 'COMPARE_FRACTIONS':
      return (
        <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" fill="none" aria-hidden="true">
          <path d="M14 5V22M8 22H20M6 9H22" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M7 9L4 16H10L7 9ZM21 9L18 16H24L21 9Z" stroke={strokeColor} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case 'FRACTION_NUMBER_LINE':
      return (
        <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" fill="none" aria-hidden="true">
          <line x1="3" y1="14" x2="25" y2="14" stroke={active ? '#FFFFFF' : '#136F50'} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="7" cy="14" r="2.5" fill={active ? '#FFFFFF' : '#136F50'} />
          <circle cx="14" cy="14" r="3" fill={strokeColor} />
          <circle cx="21" cy="14" r="2.5" fill={active ? '#FFFFFF' : '#136F50'} />
        </svg>
      );
    case 'ADD_SUB_FRACTIONS':
      return (
        <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" fill="none" aria-hidden="true">
          <path d="M8 9V19M3 14H13M17 14H25" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
  }
};

// ============================================================================
// 4. 3D STAGE PROPS: FRACTION WHEEL ON WOODEN STAND & ROBOT GUIDE WITH POINTER
// ============================================================================

export const FractionWheelStand3D: React.FC<{
  totalParts: number;
  shadedParts: number;
  onToggleSlice?: (index: number) => void;
}> = ({ totalParts, shadedParts, onToggleSlice }) => {
  const b = Math.max(2, Math.min(12, totalParts));
  const a = Math.max(0, Math.min(b, shadedParts));
  const r = 46;
  const cx = 60;
  const cy = 58;

  const renderSectors = () => {
    const sectors: React.ReactNode[] = [];
    for (let i = 0; i < b; i++) {
      const startDeg = -90 + (i * 360) / b;
      const endDeg = -90 + ((i + 1) * 360) / b;
      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const largeArc = 360 / b > 180 ? 1 : 0;
      const isShaded = i < a;

      sectors.push(
        <path
          key={i}
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
          fill={isShaded ? '#146C4E' : '#F3E7CE'}
          stroke="#463A2B"
          strokeWidth="1.6"
          className={onToggleSlice ? 'cursor-pointer hover:opacity-90' : ''}
          onClick={() => onToggleSlice?.(i)}
        />
      );
    }
    return sectors;
  };

  return (
    <svg viewBox="0 0 120 138" className="w-28 sm:w-32 h-auto select-none drop-shadow-md" aria-hidden="true">
      {/* Wooden Stand Base */}
      <ellipse cx="60" cy="127" rx="36" ry="7" fill="#3E2F1D" fillOpacity="0.22" />
      <rect x="30" y="114" width="60" height="11" rx="5.5" fill="#DFCEB2" stroke="#B8A382" strokeWidth="1.5" />
      <rect x="52" y="102" width="16" height="14" rx="3" fill="#CBB693" />
      {/* 3D Ceramic Rim */}
      <circle cx="60" cy="60" r="53" fill="#C9B592" />
      <circle cx="60" cy="58" r="52" fill="#EFE4CE" stroke="#D5C4A6" strokeWidth="2" />
      {/* Orthographic Fraction Sectors */}
      {renderSectors()}
      {/* Subtle Gloss Highlight */}
      <path
        d="M 25 35 A 45 45 0 0 1 85 22"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeOpacity="0.45"
        fill="none"
      />
    </svg>
  );
};

export const FractionRobotGuide3D: React.FC<{
  mood?: 'happy' | 'thinking' | 'celebrate';
}> = ({ mood = 'happy' }) => (
  <svg viewBox="0 0 155 185" className="w-32 sm:w-36 h-auto select-none drop-shadow-md" aria-hidden="true">
    <defs>
      <linearGradient id="m05RobotShell" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFDF9" />
        <stop offset="65%" stopColor="#EAE0CD" />
        <stop offset="100%" stopColor="#CFC0A6" />
      </linearGradient>
      <linearGradient id="m05HatGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F5E9D3" />
        <stop offset="100%" stopColor="#D6C29F" />
      </linearGradient>
    </defs>

    {/* Floor Shadow */}
    <ellipse cx="86" cy="174" rx="42" ry="8" fill="#2A3B32" fillOpacity="0.22" />

    {/* Teacher Pointer Wand held in right hand pointing toward fraction bars */}
    <line
      x1="8"
      y1="62"
      x2="48"
      y2="112"
      stroke="#5C2D16"
      strokeWidth="3.6"
      strokeLinecap="round"
    />
    <circle cx="8" cy="62" r="3" fill="#EA580C" />

    {/* Backpack */}
    <rect x="112" y="92" width="18" height="36" rx="6" fill="#16654A" stroke="#0E4431" strokeWidth="1.5" />

    {/* Legs & Boots */}
    <rect x="64" y="138" width="15" height="24" rx="6" fill="url(#m05RobotShell)" stroke="#9C8D74" strokeWidth="1.4" />
    <rect x="93" y="138" width="15" height="24" rx="6" fill="url(#m05RobotShell)" stroke="#9C8D74" strokeWidth="1.4" />
    <rect x="59" y="156" width="22" height="13" rx="6.5" fill="#15684B" stroke="#E07A1B" strokeWidth="1.8" />
    <rect x="91" y="156" width="22" height="13" rx="6.5" fill="#15684B" stroke="#E07A1B" strokeWidth="1.8" />

    {/* Torso with Green Book Badge */}
    <rect x="58" y="90" width="56" height="52" rx="18" fill="url(#m05RobotShell)" stroke="#A89980" strokeWidth="1.6" />
    {/* Orange Explorer Scarf */}
    <path d="M62 90 Q86 102 110 90 L104 102 Q86 109 68 102 Z" fill="#E07A1B" />
    {/* Green Book Emblem on Chest */}
    <rect x="74" y="106" width="24" height="20" rx="5" fill="#136F50" />
    <path d="M79 111 H86 V121 H79 Z M86 111 H93 V121 H86 Z" fill="#FAF5EA" stroke="#136F50" strokeWidth="1.2" />

    {/* Left Arm holding Pointer & Right Arm */}
    <g>
      <rect x="40" y="96" width="18" height="13" rx="6.5" fill="url(#m05RobotShell)" stroke="#9C8D74" strokeWidth="1.4" />
      <circle cx="42" cy="106" r="6" fill="#57534E" />
    </g>
    <g>
      <rect x="114" y="98" width="14" height="26" rx="7" fill="url(#m05RobotShell)" stroke="#9C8D74" strokeWidth="1.4" />
      <circle cx="121" cy="126" r="5.5" fill="#57534E" />
    </g>

    {/* Robot Head & Glowing Visor */}
    <rect x="46" y="34" width="80" height="56" rx="26" fill="url(#m05RobotShell)" stroke="#A89980" strokeWidth="1.6" />
    {/* Glowing Earphones */}
    <ellipse cx="45" cy="64" rx="5" ry="11" fill="#F59E0B" stroke="#B45309" strokeWidth="1.4" />
    <ellipse cx="127" cy="64" rx="5" ry="11" fill="#F59E0B" stroke="#B45309" strokeWidth="1.4" />
    {/* Dark Glass Face Screen */}
    <rect x="55" y="45" width="62" height="36" rx="16" fill="#0F1D26" stroke="#334155" strokeWidth="1.5" />

    {/* Eyes & Smile */}
    {mood === 'thinking' ? (
      <>
        <circle cx="73" cy="60" r="5" fill="#7DD3FC" />
        <circle cx="99" cy="60" r="5" fill="#7DD3FC" />
        <line x1="79" y1="72" x2="93" y2="72" stroke="#7DD3FC" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ) : (
      <>
        <path d="M66 61 Q73 52 80 61" stroke="#7DD3FC" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M92 61 Q99 52 106 61" stroke="#7DD3FC" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M78 70 Q86 77 94 70" stroke="#7DD3FC" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      </>
    )}

    {/* Explorer Pith Helmet */}
    <path d="M36 42 Q86 26 136 42 Q86 48 36 42 Z" fill="#D5B88B" stroke="#B09060" strokeWidth="1.4" />
    <path d="M48 40 C50 12, 122 12, 124 40 Z" fill="url(#m05HatGrad)" stroke="#C2A77D" strokeWidth="1.5" />
    <path d="M50 35 Q86 29 122 35" stroke="#D97706" strokeWidth="4" fill="none" />
  </svg>
);

// ============================================================================
// 5. ORTHOGRAPHIC SVG FRACTION MODELS (BAR / STRIP / CIRCLE — ZERO DISTORTION)
// ============================================================================

/**
 * Orthographic Fraction Bar / Strip representing EXACTLY 1 Unit.
 * Width is constant so 1 unit never changes size regardless of denominator!
 */
export const OrthographicFractionBarSVG: React.FC<{
  totalParts: number;
  shadedCount: number;
  isUnequalDemo?: boolean;
  commonDenOverlay?: number; // Optional dashed subdivision lines for common denominator
  accentColor?: 'emerald' | 'amber' | 'blue';
  showPartLabels?: boolean;
  interactive?: boolean;
  onTogglePart?: (partIndex: number) => void;
  unitIndexLabel?: string;
}> = ({
  totalParts,
  shadedCount,
  isUnequalDemo = false,
  commonDenOverlay,
  accentColor = 'emerald',
  showPartLabels = false,
  interactive = false,
  onTogglePart,
  unitIndexLabel,
}) => {
  const b = Math.max(1, Math.min(24, totalParts));
  const a = Math.max(0, Math.min(b, shadedCount));
  const totalWidth = 420;
  const barHeight = 58;
  const startX = 10;
  const startY = 8;

  const fillPalette = {
    emerald: { shaded: '#146C4E', shadedTop: '#1E8763', stroke: '#0D4A35' },
    amber: { shaded: '#D96B16', shadedTop: '#EA812C', stroke: '#9A4406' },
    blue: { shaded: '#1D4ED8', shadedTop: '#3B82F6', stroke: '#1E3A8A' },
  }[accentColor];

  // For unequal demo in Activity 1, deliberately generate unequal widths summing to totalWidth
  const partBounds = React.useMemo(() => {
    if (!isUnequalDemo || b < 2) {
      return Array.from({ length: b }, (_, i) => ({
        x: startX + (i * totalWidth) / b,
        w: totalWidth / b,
      }));
    }
    // Unequal weights: e.g. [0.45, 0.25, 0.18, 0.12...]
    const weights = Array.from({ length: b }, (_, i) => (i === 0 ? 2.4 : i === 1 ? 1.4 : 0.6));
    const sumW = weights.reduce((s, v) => s + v, 0);
    let accX = startX;
    return weights.map((w) => {
      const pxW = (w / sumW) * totalWidth;
      const item = { x: accX, w: pxW };
      accX += pxW;
      return item;
    });
  }, [b, isUnequalDemo]);

  return (
    <div className="w-full flex flex-col items-center">
      {unitIndexLabel && (
        <div className="text-xs font-extrabold text-[#475E54] mb-0.5">{unitIndexLabel}</div>
      )}
      <svg
        viewBox="0 0 440 76"
        className="w-full max-w-[470px] h-auto select-none overflow-visible"
      >
        {/* Outer 3D Ceramic Tray Frame */}
        <rect
          x={startX - 4}
          y={startY - 4}
          width={totalWidth + 8}
          height={barHeight + 10}
          rx="8"
          fill="#C9BA9E"
        />
        <rect
          x={startX - 3}
          y={startY - 3}
          width={totalWidth + 6}
          height={barHeight + 6}
          rx="7"
          fill="#FAF4E6"
          stroke="#43544B"
          strokeWidth="2"
        />

        {/* Individual Ceramic Tiles inside the Unit Bar */}
        {partBounds.map((seg, idx) => {
          const isShaded = idx < a;
          return (
            <g
              key={idx}
              className={interactive ? 'cursor-pointer hover:opacity-90' : ''}
              onClick={() => interactive && onTogglePart?.(idx)}
            >
              <rect
                x={seg.x + 1.2}
                y={startY + 1.2}
                width={Math.max(2, seg.w - 2.4)}
                height={barHeight - 2.4}
                rx="3.5"
                fill={isShaded ? fillPalette.shaded : '#EFE4CE'}
                stroke={isShaded ? fillPalette.stroke : '#C8B89A'}
                strokeWidth="1.5"
              />
              {/* Subtle top bevel highlight for 3D ceramic feel */}
              <line
                x1={seg.x + 3}
                y1={startY + 4}
                x2={seg.x + Math.max(4, seg.w - 3)}
                y2={startY + 4}
                stroke="#FFFFFF"
                strokeOpacity={isShaded ? '0.28' : '0.65'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Non-color accessibility indicator + 1/b label */}
              {showPartLabels && b <= 12 && !isUnequalDemo && (
                <text
                  x={seg.x + seg.w / 2}
                  y={startY + barHeight / 2 + 5}
                  textAnchor="middle"
                  fontSize={b <= 8 ? '13' : '10.5'}
                  fontWeight="800"
                  fill={isShaded ? '#FFFFFF' : '#4A5D54'}
                  fontFamily="Be Vietnam Pro, sans-serif"
                >
                  1/{b}
                </text>
              )}
              {isUnequalDemo && (
                <text
                  x={seg.x + seg.w / 2}
                  y={startY + barHeight / 2 + 5}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="800"
                  fill={isShaded ? '#FFFFFF' : '#7C2D12'}
                >
                  ≠ 1/{b}
                </text>
              )}
            </g>
          );
        })}

        {/* Optional Common Denominator Overlay Grid (Dashed Lines) */}
        {commonDenOverlay && commonDenOverlay > b && commonDenOverlay <= 24 && (
          <g pointerEvents="none">
            {Array.from({ length: commonDenOverlay - 1 }, (_, i) => {
              const gx = startX + ((i + 1) * totalWidth) / commonDenOverlay;
              return (
                <line
                  key={i}
                  x1={gx}
                  y1={startY}
                  x2={gx}
                  y2={startY + barHeight}
                  stroke="#F59E0B"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
};

/**
 * Orthographic Fraction Circle representing EXACTLY 1 Unit.
 * Equal central angles (360° / b) when isUnequalDemo = false.
 * When isUnequalDemo = true, slices the circle with parallel vertical chords so students
 * see clearly why unequal areas do NOT represent 1/b!
 */
export const OrthographicFractionCircleSVG: React.FC<{
  totalParts: number;
  shadedCount: number;
  isUnequalDemo?: boolean;
  interactive?: boolean;
  onTogglePart?: (partIndex: number) => void;
  sizePx?: number;
}> = ({
  totalParts,
  shadedCount,
  isUnequalDemo = false,
  interactive = false,
  onTogglePart,
  sizePx = 176,
}) => {
  const b = Math.max(1, Math.min(16, totalParts));
  const a = Math.max(0, Math.min(b, shadedCount));
  const cx = 100;
  const cy = 100;
  const r = 82;

  return (
    <svg
      viewBox="0 0 200 204"
      style={{ width: sizePx, height: sizePx }}
      className="select-none overflow-visible drop-shadow-xs"
    >
      {/* 3D Ceramic Rim */}
      <circle cx={cx} cy={cy + 4} r={r + 8} fill="#C6B597" />
      <circle cx={cx} cy={cy} r={r + 8} fill="#F5EBDA" stroke="#CDBEA2" strokeWidth="2" />

      {isUnequalDemo ? (
        // Parallel vertical strips clipped inside the circle (Unequal area trap!)
        <>
          <defs>
            <clipPath id="m05CircleClip">
              <circle cx={cx} cy={cy} r={r} />
            </clipPath>
          </defs>
          <g clipPath="url(#m05CircleClip)">
            {Array.from({ length: b }, (_, i) => {
              const stripW = (2 * r) / b;
              const sx = cx - r + i * stripW;
              const isShaded = i < a;
              return (
                <rect
                  key={i}
                  x={sx}
                  y={cy - r}
                  width={stripW}
                  height={2 * r}
                  fill={isShaded ? '#D96B16' : '#EFE4CE'}
                  stroke="#463A2B"
                  strokeWidth="2"
                  className={interactive ? 'cursor-pointer' : ''}
                  onClick={() => interactive && onTogglePart?.(i)}
                />
              );
            })}
          </g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#463A2B" strokeWidth="2.4" />
        </>
      ) : b === 1 ? (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={a >= 1 ? '#146C4E' : '#EFE4CE'}
          stroke="#0D4A35"
          strokeWidth="2.2"
          className={interactive ? 'cursor-pointer' : ''}
          onClick={() => interactive && onTogglePart?.(0)}
        />
      ) : (
        Array.from({ length: b }, (_, i) => {
          const startDeg = -90 + (i * 360) / b;
          const endDeg = -90 + ((i + 1) * 360) / b;
          const startRad = (startDeg * Math.PI) / 180;
          const endRad = (endDeg * Math.PI) / 180;
          const x1 = cx + r * Math.cos(startRad);
          const y1 = cy + r * Math.sin(startRad);
          const x2 = cx + r * Math.cos(endRad);
          const y2 = cy + r * Math.sin(endRad);
          const largeArc = 360 / b > 180 ? 1 : 0;
          const isShaded = i < a;

          const midRad = (((startDeg + endDeg) / 2) * Math.PI) / 180;
          const lx = cx + r * 0.6 * Math.cos(midRad);
          const ly = cy + r * 0.6 * Math.sin(midRad);

          return (
            <g
              key={i}
              className={interactive ? 'cursor-pointer hover:opacity-90' : ''}
              onClick={() => interactive && onTogglePart?.(i)}
            >
              <path
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={isShaded ? '#146C4E' : '#EFE4CE'}
                stroke="#2C3E35"
                strokeWidth="2"
              />
              {b <= 8 && (
                <text
                  x={lx}
                  y={ly + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="800"
                  fill={isShaded ? '#FFFFFF' : '#3E5248'}
                >
                  1/{b}
                </text>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
};

// ============================================================================
// 6. BOTTOM 6 3D ACTIVITY THUMBNAIL CARDS (MATCHING REFERENCE IMAGE)
// ============================================================================

export const M05ActivityThumbnail3D: React.FC<{ activityId: M05ActivityId }> = ({
  activityId,
}) => {
  switch (activityId) {
    case 'EQUAL_PARTS':
      // "Hình tròn chia phần" - 3D terracotta/cream quartered circle
      return (
        <svg viewBox="0 0 220 96" className="w-full h-full select-none" aria-hidden="true">
          <rect width="220" height="96" rx="14" fill="#EAE0CE" />
          <ellipse cx="110" cy="84" rx="55" ry="7" fill="#463520" fillOpacity="0.18" />
          <circle cx="110" cy="48" r="35" fill="#C49A6C" />
          <path d="M110 48 L110 13 A35 35 0 0 0 75 48 Z" fill="#C86432" stroke="#5C3418" strokeWidth="1.5" />
          <path d="M110 48 L75 48 A35 35 0 0 0 110 83 Z" fill="#C86432" stroke="#5C3418" strokeWidth="1.5" />
          <path d="M110 48 L145 48 A35 35 0 0 0 110 13 Z" fill="#F2DEC1" stroke="#5C3418" strokeWidth="1.5" />
          <path d="M110 48 L110 83 A35 35 0 0 0 145 48 Z" fill="#F2DEC1" stroke="#5C3418" strokeWidth="1.5" />
        </svg>
      );

    case 'BUILD_READ_FRACTION':
      // "Các mảnh phân số" - Top bar 1/2 + bottom smaller tiles
      return (
        <svg viewBox="0 0 220 96" className="w-full h-full select-none" aria-hidden="true">
          <rect width="220" height="96" rx="14" fill="#EAE0CE" />
          <rect x="44" y="22" width="66" height="24" rx="4" fill="#146C4E" stroke="#0D4A35" strokeWidth="1.4" />
          <rect x="110" y="22" width="66" height="24" rx="4" fill="#F5EBDA" stroke="#C5B496" strokeWidth="1.4" />
          <rect x="48" y="56" width="26" height="22" rx="4" fill="#146C4E" />
          <rect x="76" y="56" width="26" height="22" rx="4" fill="#146C4E" />
          <rect x="118" y="56" width="26" height="22" rx="4" fill="#F5EBDA" stroke="#C5B496" strokeWidth="1.2" />
          <rect x="146" y="56" width="26" height="22" rx="4" fill="#F5EBDA" stroke="#C5B496" strokeWidth="1.2" />
        </svg>
      );

    case 'EQUIVALENT_FRACTIONS':
      // "Các thanh bằng nhau" - 3 stacked emerald bars
      return (
        <svg viewBox="0 0 220 96" className="w-full h-full select-none" aria-hidden="true">
          <rect width="220" height="96" rx="14" fill="#EAE0CE" />
          <rect x="42" y="16" width="136" height="17" rx="4" fill="#146C4E" stroke="#0D4A35" strokeWidth="1.2" />
          <rect x="42" y="39" width="136" height="17" rx="4" fill="#146C4E" stroke="#0D4A35" strokeWidth="1.2" />
          <line x1="110" y1="39" x2="110" y2="56" stroke="#FAF5EA" strokeWidth="1.5" />
          <rect x="42" y="62" width="136" height="17" rx="4" fill="#146C4E" stroke="#0D4A35" strokeWidth="1.2" />
          <line x1="76" y1="62" x2="76" y2="79" stroke="#FAF5EA" strokeWidth="1.5" />
          <line x1="110" y1="62" x2="110" y2="79" stroke="#FAF5EA" strokeWidth="1.5" />
          <line x1="144" y1="62" x2="144" y2="79" stroke="#FAF5EA" strokeWidth="1.5" />
        </svg>
      );

    case 'COMPARE_FRACTIONS':
      // "So sánh phân số" - Two aligned bars with 1/2 and 2/4 badges
      return (
        <svg viewBox="0 0 220 96" className="w-full h-full select-none" aria-hidden="true">
          <rect width="220" height="96" rx="14" fill="#EAE0CE" />
          <rect x="24" y="20" width="64" height="22" rx="3" fill="#146C4E" />
          <rect x="88" y="20" width="64" height="22" rx="3" fill="#F5EBDA" stroke="#BFAEA0" strokeWidth="1.2" />
          <rect x="162" y="17" width="32" height="28" rx="6" fill="#FAF5EA" stroke="#D1C3AA" strokeWidth="1.2" />
          <text x="178" y="29" textAnchor="middle" fontSize="10" fontWeight="900" fill="#12382B">1/2</text>

          <rect x="24" y="54" width="32" height="22" rx="3" fill="#146C4E" />
          <rect x="56" y="54" width="32" height="22" rx="3" fill="#146C4E" stroke="#FAF5EA" strokeWidth="1" />
          <rect x="88" y="54" width="32" height="22" rx="3" fill="#F5EBDA" stroke="#BFAEA0" strokeWidth="1.2" />
          <rect x="120" y="54" width="32" height="22" rx="3" fill="#F5EBDA" stroke="#BFAEA0" strokeWidth="1.2" />
          <rect x="162" y="51" width="32" height="28" rx="6" fill="#FAF5EA" stroke="#D1C3AA" strokeWidth="1.2" />
          <text x="178" y="63" textAnchor="middle" fontSize="10" fontWeight="900" fill="#12382B">2/4</text>
        </svg>
      );

    case 'FRACTION_NUMBER_LINE':
      // "Trục số" - 0 to 1 with orange dot at 1/2
      return (
        <svg viewBox="0 0 220 96" className="w-full h-full select-none" aria-hidden="true">
          <rect width="220" height="96" rx="14" fill="#EAE0CE" />
          <line x1="36" y1="42" x2="184" y2="42" stroke="#134E3A" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="36" y1="33" x2="36" y2="51" stroke="#134E3A" strokeWidth="3" />
          <line x1="184" y1="33" x2="184" y2="51" stroke="#134E3A" strokeWidth="3" />
          <circle cx="110" cy="42" r="6.5" fill="#E07A1B" stroke="#FFFFFF" strokeWidth="1.8" />
          <text x="36" y="70" textAnchor="middle" fontSize="16" fontWeight="900" fill="#12382B">0</text>
          <text x="110" y="64" textAnchor="middle" fontSize="13" fontWeight="900" fill="#12382B">1</text>
          <line x1="102" y1="68" x2="118" y2="68" stroke="#12382B" strokeWidth="2" />
          <text x="110" y="82" textAnchor="middle" fontSize="13" fontWeight="900" fill="#12382B">2</text>
          <text x="184" y="70" textAnchor="middle" fontSize="16" fontWeight="900" fill="#12382B">1</text>
        </svg>
      );

    case 'ADD_SUB_FRACTIONS':
      // "Các dải phân số ghép lại" - Combined strip on wooden tray
      return (
        <svg viewBox="0 0 220 96" className="w-full h-full select-none" aria-hidden="true">
          <rect width="220" height="96" rx="14" fill="#EAE0CE" />
          <rect x="26" y="34" width="168" height="32" rx="5" fill="#FAF4E6" stroke="#C5B293" strokeWidth="2" />
          <rect x="30" y="38" width="40" height="24" rx="3" fill="#146C4E" />
          <rect x="71" y="38" width="40" height="24" rx="3" fill="#146C4E" />
          <rect x="112" y="38" width="40" height="24" rx="3" fill="#F5EBDA" stroke="#C5B293" />
          <rect x="153" y="38" width="37" height="24" rx="3" fill="#F5EBDA" stroke="#C5B293" />
        </svg>
      );
  }
};
