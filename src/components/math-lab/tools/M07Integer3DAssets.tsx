import React from 'react';
import { M07ActivityId } from '../mathEngine/integerNumberLineEngine';

// ============================================================================
// M07 – 3D VISUAL ASSETS & THUMBNAILS MODULE
// Decoupled from math logic per Section 7. Crafted with matte ceramic, glass,
// brushed metal, and warm soft lighting gradients matching the reference image.
// ============================================================================

export const TayDoSmartMathLogo3D: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-10 h-10 shrink-0" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="m07LogoCap" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1B8A65" />
        <stop offset="100%" stopColor="#0E5A40" />
      </linearGradient>
      <linearGradient id="m07LogoBook" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D96B16" />
      </linearGradient>
    </defs>
    {/* Stacked Orange Book Base */}
    <path
      d="M8 29L24 37L40 29L24 21L8 29Z"
      fill="url(#m07LogoBook)"
      stroke="#FFFDF9"
      strokeWidth="1.2"
    />
    <path
      d="M8 29V34L24 42L40 34V29L24 37L8 29Z"
      fill="#C85A11"
    />
    <path
      d="M11 31.5L24 38L37 31.5"
      stroke="#FEF3C7"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {/* Emerald Mortarboard Cap */}
    <path
      d="M6 19L24 10L42 19L24 28L6 19Z"
      fill="url(#m07LogoCap)"
      stroke="#FFFFFF"
      strokeWidth="1.2"
    />
    <path
      d="M14 23V28.5C14 31 18.5 33.5 24 33.5C29.5 33.5 34 31 34 28.5V23"
      fill="#126E4F"
      stroke="#FFFFFF"
      strokeWidth="1"
    />
    {/* Gold Tassel */}
    <path d="M38 21V29" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="38" cy="29.5" r="2" fill="#F59E0B" />
  </svg>
);

export const ActivityHeaderBadgeIcon3D: React.FC<{ activityId: M07ActivityId }> = ({
  activityId,
}) => (
  <div
    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_6px_14px_rgba(217,107,22,0.32)] border border-[#FCD39B]"
    style={{
      background: 'linear-gradient(145deg, #F59E0B 0%, #D96B16 100%)',
    }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 36 36" className="w-7 h-7" fill="none">
      {activityId === 'EXPLORE_NEGATIVE' && (
        <>
          <rect x="13" y="5" width="10" height="22" rx="5" fill="#FFFDF9" />
          <circle cx="18" cy="25" r="6" fill="#FFFDF9" />
          <rect x="16" y="11" width="4" height="12" rx="2" fill="#DC2626" />
          <circle cx="18" cy="25" r="3.8" fill="#DC2626" />
        </>
      )}
      {activityId === 'PLACE_ON_LINE' && (
        <>
          <line x1="5" y1="24" x2="31" y2="24" stroke="#FFFDF9" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M18 7C13.5 7 10 10.5 10 15C10 20 18 27 18 27C18 27 26 20 26 15C26 10.5 22.5 7 18 7Z" fill="#FFFDF9" />
          <circle cx="18" cy="14.5" r="3" fill="#D96B16" />
        </>
      )}
      {activityId === 'COMPARE_INTEGERS' && (
        <>
          <rect x="4" y="9" width="12" height="18" rx="3.5" fill="#FFFDF9" />
          <rect x="20" y="9" width="12" height="18" rx="3.5" fill="#FEF3C7" />
          <path d="M19 14L15 18L19 22" stroke="#D96B16" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {activityId === 'OPPOSITE_DISTANCE' && (
        <>
          <line x1="18" y1="6" x2="18" y2="30" stroke="#FEF3C7" strokeWidth="2.2" strokeDasharray="3 3" />
          <circle cx="9" cy="18" r="5" fill="#FFFDF9" />
          <circle cx="27" cy="18" r="5" fill="#FEF3C7" />
        </>
      )}
      {activityId === 'JUMP_ADD_SUB' && (
        <>
          <rect x="7" y="5" width="22" height="26" rx="5" fill="#FFFDF9" />
          <rect x="10" y="8" width="16" height="6" rx="2" fill="#D96B16" />
          <circle cx="12.5" cy="18.5" r="1.6" fill="#D96B16" />
          <circle cx="18" cy="18.5" r="1.6" fill="#D96B16" />
          <circle cx="23.5" cy="18.5" r="1.6" fill="#D96B16" />
          <circle cx="12.5" cy="24" r="1.6" fill="#D96B16" />
          <circle cx="18" cy="24" r="1.6" fill="#D96B16" />
          <circle cx="23.5" cy="24" r="1.6" fill="#15803D" />
        </>
      )}
      {activityId === 'RESCUE_MISSION' && (
        <>
          <rect x="6" y="13" width="24" height="16" rx="3.5" fill="#FFFDF9" />
          <path d="M6 17H30" stroke="#D96B16" strokeWidth="2.2" />
          <rect x="15" y="14" width="6" height="6" rx="1.5" fill="#F59E0B" stroke="#D96B16" strokeWidth="1.5" />
        </>
      )}
    </svg>
  </div>
);

/**
 * 3D Explorer Robot SVG (matches the reference character with safari pith helmet,
 * brass goggles, glowing cyan digital eyes, green backpack, and thumbs-up gesture).
 */
export const RobotExplorer3D: React.FC<{
  pose?: 'THUMBS_UP' | 'WALKING' | 'THINKING';
  facing?: 'LEFT' | 'RIGHT' | 'FRONT';
  scale?: number;
}> = ({ pose = 'THUMBS_UP', facing = 'FRONT', scale = 1 }) => {
  const flipX = facing === 'LEFT' ? -1 : 1;
  return (
    <g transform={`scale(${scale * flipX}, ${scale})`}>
      <defs>
        <linearGradient id="m07RobotCeramic" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#EDE6DA" />
          <stop offset="100%" stopColor="#C8BFAEE" />
        </linearGradient>
        <linearGradient id="m07RobotHelmet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5DFB8" />
          <stop offset="60%" stopColor="#D6B17A" />
          <stop offset="100%" stopColor="#9E743B" />
        </linearGradient>
        <linearGradient id="m07RobotBackpack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B8754" />
          <stop offset="100%" stopColor="#1B4D2E" />
        </linearGradient>
        <linearGradient id="m07RobotScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F2537" />
          <stop offset="100%" stopColor="#07121C" />
        </linearGradient>
      </defs>

      {/* Ground Shadow */}
      <ellipse cx="0" cy="2" rx="22" ry="5.5" fill="rgba(19, 42, 35, 0.25)" />

      {/* Green Explorer Backpack */}
      <rect
        x="-23"
        y="-56"
        width="14"
        height="26"
        rx="5"
        fill="url(#m07RobotBackpack)"
        stroke="#163F25"
        strokeWidth="1.2"
      />
      <rect x="-21" y="-52" width="10" height="6" rx="2.5" fill="#4EA269" />

      {/* Left & Right Legs + Explorer Boots */}
      <g>
        <rect x="-11" y="-25" width="7.5" height="15" rx="3.5" fill="#D5CBB8" stroke="#786855" strokeWidth="1" />
        <rect x="-12" y="-17" width="9.5" height="5" rx="2" fill="#8C6239" />
        <path d="M-13 -9C-13 -13 -4 -13 -3 -9V-3H-13V-9Z" fill="#593E25" stroke="#3B2816" strokeWidth="1" />

        <rect x="3.5" y="-25" width="7.5" height="15" rx="3.5" fill="#D5CBB8" stroke="#786855" strokeWidth="1" />
        <rect x="2.5" y="-17" width="9.5" height="5" rx="2" fill="#8C6239" />
        <path d="M2 -9C2 -13 12 -13 13 -9V-3H2V-9Z" fill="#593E25" stroke="#3B2816" strokeWidth="1" />
      </g>

      {/* Torso with Chest Core Ring */}
      <rect
        x="-14"
        y="-54"
        width="28"
        height="30"
        rx="9"
        fill="#F5F0E6"
        stroke="#8C7A65"
        strokeWidth="1.3"
      />
      {/* Backpack Straps on Chest */}
      <path d="M-10 -53V-28M10 -53V-28" stroke="#7C5632" strokeWidth="3" strokeLinecap="round" />
      <rect x="-13" y="-33" width="26" height="4.5" rx="2" fill="#634427" />
      <rect x="-3.5" y="-34" width="7" height="6.5" rx="1.5" fill="#D99B26" />
      {/* Glowing Emerald Core on Chest */}
      <circle cx="0" cy="-43" r="5" fill="#E2E8F0" stroke="#64748B" strokeWidth="1.2" />
      <circle cx="0" cy="-43" r="3" fill="#22C55E" />

      {/* Left Arm */}
      <g transform="translate(-16, -49) rotate(16)">
        <rect x="-6" y="0" width="6.5" height="18" rx="3" fill="#EDE6DA" stroke="#786855" strokeWidth="1" />
        <circle cx="-2.8" cy="19" r="4" fill="#593E25" />
      </g>

      {/* Right Arm (Thumbs-up or walking) */}
      {pose === 'THUMBS_UP' ? (
        <g transform="translate(15, -48) rotate(-28)">
          <rect x="0" y="-2" width="16" height="6.5" rx="3" fill="#EDE6DA" stroke="#786855" strokeWidth="1" />
          {/* Hand + Thumb Up */}
          <circle cx="17" cy="1" r="4.4" fill="#593E25" />
          <rect x="15.5" y="-6.5" width="3.5" height="5.5" rx="1.7" fill="#593E25" />
        </g>
      ) : (
        <g transform="translate(15, -49) rotate(-18)">
          <rect x="0" y="0" width="6.5" height="18" rx="3" fill="#EDE6DA" stroke="#786855" strokeWidth="1" />
          <circle cx="3.2" cy="19" r="4" fill="#593E25" />
        </g>
      )}

      {/* Robot Head */}
      <rect
        x="-21"
        y="-88"
        width="42"
        height="32"
        rx="13"
        fill="#F7F3EB"
        stroke="#8C7A65"
        strokeWidth="1.4"
      />
      {/* Ear Caps */}
      <rect x="-24" y="-77" width="3.5" height="11" rx="1.5" fill="#9E743B" />
      <rect x="20.5" y="-77" width="3.5" height="11" rx="1.5" fill="#9E743B" />

      {/* Face Screen */}
      <rect
        x="-16.5"
        y="-82"
        width="33"
        height="21"
        rx="8"
        fill="url(#m07RobotScreen)"
        stroke="#334155"
        strokeWidth="1.2"
      />
      {/* Glowing Cyan Happy Eyes & Smile */}
      <path
        d="M-10 -72C-8.5 -75.5 -5.5 -75.5 -4 -72"
        stroke="#38BDF8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M4 -72C5.5 -75.5 8.5 -75.5 10 -72"
        stroke="#38BDF8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M-5 -66.5C-2.5 -63.5 2.5 -63.5 5 -66.5"
        stroke="#38BDF8"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Explorer Safari Pith Helmet & Brass Goggles */}
      <path
        d="M-26 -83C-18 -89 18 -89 26 -83C29 -81 26 -79 21 -80C10 -82 -10 -82 -21 -80C-26 -79 -29 -81 -26 -83Z"
        fill="url(#m07RobotHelmet)"
        stroke="#7C5632"
        strokeWidth="1.1"
      />
      <path
        d="M-20 -83C-19 -99 19 -99 20 -83Z"
        fill="url(#m07RobotHelmet)"
        stroke="#7C5632"
        strokeWidth="1.2"
      />
      {/* Goggles Strap & Twin Lenses on Helmet */}
      <rect x="-19" y="-91" width="38" height="4" rx="1.5" fill="#593E25" />
      <circle cx="-7.5" cy="-90" r="5.5" fill="#D97706" stroke="#78350F" strokeWidth="1.3" />
      <circle cx="-7.5" cy="-90" r="3.6" fill="#E0F2FE" />
      <circle cx="7.5" cy="-90" r="5.5" fill="#D97706" stroke="#78350F" strokeWidth="1.3" />
      <circle cx="7.5" cy="-90" r="3.6" fill="#E0F2FE" />
    </g>
  );
};

/**
 * 3D Metallic Thermometer Prop (Left side of stage & Activity 1 interactive model)
 */
export const Thermometer3DProp: React.FC<{
  temperatureC: number;
  interactive?: boolean;
  onChangeTemp?: (newTemp: number) => void;
}> = ({ temperatureC, interactive = false, onChangeTemp }) => {
  // Clamp visual column between -30 and 50
  const clamped = Math.max(-30, Math.min(50, temperatureC));
  // -30 is at y=162, +50 is at y=42 (total 120px span for 80 degrees -> 1.5px per degree; 0°C is at y=117)
  const zeroY = 117;
  const mercuryTopY = zeroY - clamped * 1.5;
  const bulbCenterY = 178;

  const ticks = [50, 40, 30, 20, 10, 0, -10, -20, -30];

  return (
    <div className="relative select-none flex flex-col items-center">
      <svg
        viewBox="0 0 112 226"
        className={`w-24 sm:w-28 h-auto drop-shadow-[0_12px_18px_rgba(19,42,35,0.16)] ${
          interactive ? 'cursor-pointer' : ''
        }`}
        onClick={
          interactive && onChangeTemp
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relY = ((e.clientY - rect.top) / rect.height) * 226;
                const rawDeg = Math.round((zeroY - relY) / 1.5);
                const clampedDeg = Math.max(-30, Math.min(50, rawDeg));
                onChangeTemp(clampedDeg);
              }
            : undefined
        }
      >
        <defs>
          <linearGradient id="m07ThermoBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F5F3EE" />
            <stop offset="45%" stopColor="#FFFFFF" />
            <stop offset="85%" stopColor="#D6D1C7" />
            <stop offset="100%" stopColor="#B8B0A2" />
          </linearGradient>
          <linearGradient id="m07ThermoBase" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#C8C1B4" />
            <stop offset="50%" stopColor="#F4F1EA" />
            <stop offset="100%" stopColor="#8F8677" />
          </linearGradient>
          <linearGradient id="m07MercuryRed" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="40%" stopColor="#FCA5A5" />
            <stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>
        </defs>

        {/* Metallic Pedestal Base */}
        <ellipse cx="56" cy="212" rx="44" ry="8" fill="rgba(19,42,35,0.18)" />
        <path
          d="M16 202C16 196 96 196 96 202V208C96 214 16 214 16 208V202Z"
          fill="url(#m07ThermoBase)"
          stroke="#9E9587"
          strokeWidth="1"
        />
        <rect x="47" y="191" width="18" height="12" rx="3" fill="url(#m07ThermoBase)" />

        {/* Rounded Capsule Housing */}
        <rect
          x="22"
          y="8"
          width="68"
          height="186"
          rx="30"
          fill="url(#m07ThermoBody)"
          stroke="#C2B9AA"
          strokeWidth="2"
        />
        {/* Inner Recessed Face */}
        <rect
          x="29"
          y="15"
          width="54"
          height="172"
          rx="23"
          fill="#F7F4EC"
          stroke="#DED7C8"
          strokeWidth="1.2"
        />

        {/* °C Title */}
        <text
          x="56"
          y="31"
          textAnchor="middle"
          fontSize="13"
          fontWeight="800"
          fill="#1B2E28"
          fontFamily="Be Vietnam Pro, sans-serif"
        >
          °C
        </text>

        {/* Glass Capillary Tube */}
        <rect
          x="39"
          y="38"
          width="10"
          height="136"
          rx="5"
          fill="#E5E0D5"
          stroke="#B8B0A2"
          strokeWidth="1"
        />

        {/* Zero Benchmark Highlight Line */}
        <line
          x1="34"
          y1={zeroY}
          x2="66"
          y2={zeroY}
          stroke="#0D9488"
          strokeWidth="1.8"
          strokeDasharray="2 2"
        />

        {/* Dynamic Red Liquid Column */}
        <rect
          x="40.5"
          y={mercuryTopY}
          width="7"
          height={Math.max(4, bulbCenterY - mercuryTopY)}
          rx="3.5"
          fill="url(#m07MercuryRed)"
        />

        {/* Mercury Bulb */}
        <circle cx="44" cy={bulbCenterY} r="9.5" fill="url(#m07MercuryRed)" stroke="#991B1B" strokeWidth="1" />
        <circle cx="41.5" cy={bulbCenterY - 2.5} r="2.5" fill="#FECACA" fillOpacity="0.85" />

        {/* Scale Ticks & Numbers */}
        {ticks.map((t) => {
          const y = zeroY - t * 1.5;
          const isZero = t === 0;
          return (
            <g key={t}>
              <line
                x1="50"
                y1={y}
                x2="58"
                y2={y}
                stroke={isZero ? '#0F766E' : '#334155'}
                strokeWidth={isZero ? '2' : '1.3'}
              />
              <text
                x="62"
                y={y + 3.5}
                fontSize="9.5"
                fontWeight={isZero ? '900' : '700'}
                fill={isZero ? '#0F766E' : t < 0 ? '#B91C1C' : '#1E293B'}
                fontFamily="Be Vietnam Pro, sans-serif"
              >
                {t}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * 3D Brushed-Steel Glass Elevator Prop (Right side of stage & Activity 1 interactive model)
 * Explicitly displays "Tầng trệt: 0".
 */
export const Elevator3DProp: React.FC<{
  floor: number;
  minFloor?: number;
  maxFloor?: number;
}> = ({ floor, minFloor = -5, maxFloor = 5 }) => {
  const clamped = Math.max(minFloor, Math.min(maxFloor, floor));
  const ratio = (clamped - minFloor) / Math.max(1, maxFloor - minFloor);
  // Cabin vertical travel inside shaft (y from 136 at bottom to 48 at top)
  const cabinY = 136 - ratio * 88;
  const arrowChar = clamped > 0 ? '▲' : clamped < 0 ? '▼' : '●';

  return (
    <div className="relative select-none flex flex-col items-center">
      <svg
        viewBox="0 0 128 220"
        className="w-28 sm:w-32 h-auto drop-shadow-[0_12px_18px_rgba(19,42,35,0.16)]"
      >
        <defs>
          <linearGradient id="m07ElevSteel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D6D3CD" />
            <stop offset="25%" stopColor="#F5F3EF" />
            <stop offset="65%" stopColor="#B8B2A6" />
            <stop offset="100%" stopColor="#8C8579" />
          </linearGradient>
          <linearGradient id="m07ElevShaft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="m07ElevCabin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Base Floor Step */}
        <rect x="6" y="202" width="116" height="10" rx="3" fill="#9E9689" stroke="#787165" strokeWidth="1" />

        {/* Outer Brushed Steel Frame */}
        <rect
          x="12"
          y="12"
          width="104"
          height="190"
          rx="8"
          fill="url(#m07ElevSteel)"
          stroke="#8C8579"
          strokeWidth="1.8"
        />

        {/* Digital LED Header Display */}
        <rect x="42" y="20" width="44" height="17" rx="4" fill="#0F172A" stroke="#475569" strokeWidth="1.2" />
        <text
          x="64"
          y="32"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill={clamped < 0 ? '#F59E0B' : '#22C55E'}
          fontFamily="monospace"
        >
          {arrowChar} {clamped}
        </text>

        {/* Inner Glass Shaft */}
        <rect
          x="26"
          y="44"
          width="68"
          height="152"
          rx="3"
          fill="url(#m07ElevShaft)"
          stroke="#64748B"
          strokeWidth="1.5"
        />

        {/* Ground Floor 0 Benchmark Line across the Glass Shaft */}
        <line
          x1="26"
          y1={136 - ((0 - minFloor) / Math.max(1, maxFloor - minFloor)) * 88 + 26}
          x2="94"
          y2={136 - ((0 - minFloor) / Math.max(1, maxFloor - minFloor)) * 88 + 26}
          stroke="#22C55E"
          strokeWidth="1.8"
          strokeDasharray="3 2"
        />

        {/* Moving Illuminated Cabin */}
        <g transform={`translate(30, ${cabinY})`}>
          <rect
            x="0"
            y="0"
            width="60"
            height="52"
            rx="4"
            fill="url(#m07ElevCabin)"
            fillOpacity="0.88"
            stroke="#FDE68A"
            strokeWidth="1.8"
          />
          <line x1="30" y1="0" x2="30" y2="52" stroke="#92400E" strokeWidth="1.5" />
          <text
            x="30"
            y="30"
            textAnchor="middle"
            fontSize="12"
            fontWeight="900"
            fill="#0F172A"
            fontFamily="Be Vietnam Pro, sans-serif"
          >
            Tầng {clamped}
          </text>
        </g>

        {/* Glass Door Vertical Seam & Reflections */}
        <line x1="60" y1="44" x2="60" y2="196" stroke="#E2E8F0" strokeWidth="1.4" strokeOpacity="0.7" />
        <path d="M32 52L46 188" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.22" strokeLinecap="round" />

        {/* Up/Down Call Buttons on Right Pillar */}
        <rect x="99" y="106" width="11" height="26" rx="3" fill="#1E293B" stroke="#CBD5E1" strokeWidth="1" />
        <polygon points="104.5,110 101.5,116 107.5,116" fill="#22C55E" />
        <polygon points="104.5,128 101.5,122 107.5,122" fill="#E2E8F0" />
      </svg>
    </div>
  );
};

/**
 * 6 Dedicated 3D Thumbnail Illustrations for the bottom activity selector cards
 * (Faithfully matching the 6 cards at the bottom of /public/assets/aistudio/image_b64d5284.png)
 */
export const M07ActivityThumbnail3D: React.FC<{ activityId: M07ActivityId }> = ({
  activityId,
}) => {
  switch (activityId) {
    case 'EXPLORE_NEGATIVE':
      return (
        <svg viewBox="0 0 220 100" className="w-full h-full" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="m07Th1Bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E6F2F5" />
              <stop offset="50%" stopColor="#F5EFE4" />
              <stop offset="100%" stopColor="#FCEFD9" />
            </linearGradient>
          </defs>
          <rect width="220" height="100" rx="14" fill="url(#m07Th1Bg)" />
          {/* 3D Blue Snowflake on Left */}
          <g transform="translate(52, 50)" stroke="#38BDF8" strokeWidth="3.2" strokeLinecap="round">
            <line x1="0" y1="-18" x2="0" y2="18" />
            <line x1="-15.5" y1="-9" x2="15.5" y2="9" />
            <line x1="-15.5" y1="9" x2="15.5" y2="-9" />
            <circle cx="0" cy="0" r="4" fill="#BAE6FD" />
          </g>
          {/* 3D Golden Sun on Right */}
          <g transform="translate(168, 48)">
            <circle cx="0" cy="0" r="13" fill="#FACC15" stroke="#F59E0B" strokeWidth="2" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1="0"
                y1="-17"
                x2="0"
                y2="-22"
                stroke="#F59E0B"
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${deg})`}
              />
            ))}
          </g>
          {/* Center 3D Thermometer */}
          <rect x="88" y="8" width="44" height="84" rx="18" fill="#FFFFFF" stroke="#C8C1B4" strokeWidth="2.2" />
          <text x="110" y="21" textAnchor="middle" fontSize="9" fontWeight="900" fill="#1E293B">°C</text>
          <rect x="102" y="25" width="7" height="52" rx="3.5" fill="#E2E8F0" />
          <rect x="103" y="48" width="5" height="29" rx="2.5" fill="#DC2626" />
          <circle cx="105.5" cy="79" r="7.5" fill="#DC2626" />
          <line x1="112" y1="32" x2="118" y2="32" stroke="#475569" strokeWidth="1.5" />
          <line x1="112" y1="48" x2="120" y2="48" stroke="#0D9488" strokeWidth="2" />
          <line x1="112" y1="64" x2="118" y2="64" stroke="#B91C1C" strokeWidth="1.5" />
        </svg>
      );

    case 'PLACE_ON_LINE':
      return (
        <svg viewBox="0 0 220 100" className="w-full h-full" fill="none" aria-hidden="true">
          <rect width="220" height="100" rx="14" fill="#EFECE6" />
          {/* Axis */}
          <line x1="22" y1="70" x2="198" y2="70" stroke="#0F172A" strokeWidth="2.8" strokeLinecap="round" />
          <polygon points="18,70 26,65 26,75" fill="#0F172A" />
          <polygon points="202,70 194,65 194,75" fill="#0F172A" />
          {[42, 68, 94, 120, 146, 172].map((x, idx) => (
            <line key={idx} x1={x} y1="64" x2={x} y2="76" stroke="#0F172A" strokeWidth="2.2" />
          ))}
          {/* 3D Orange Pin -3 */}
          <g transform="translate(68, 70)">
            <circle cx="0" cy="0" r="4.5" fill="#EA580C" />
            <path d="M0 -4C-12 -18 -17 -26 -17 -35C-17 -44 -9 -51 0 -51C9 -51 17 -44 17 -35C17 -26 12 -18 0 -4Z" fill="#EA580C" stroke="#FFF7ED" strokeWidth="1.5" />
            <text x="0" y="-30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#FFFFFF">-3</text>
          </g>
          {/* 3D Green Pin 2 */}
          <g transform="translate(146, 70)">
            <circle cx="0" cy="0" r="4.5" fill="#15803D" />
            <path d="M0 -4C-12 -18 -17 -26 -17 -35C-17 -44 -9 -51 0 -51C9 -51 17 -44 17 -35C17 -26 12 -18 0 -4Z" fill="#15803D" stroke="#F0FDF4" strokeWidth="1.5" />
            <text x="0" y="-30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#FFFFFF">2</text>
          </g>
        </svg>
      );

    case 'COMPARE_INTEGERS':
      return (
        <svg viewBox="0 0 220 100" className="w-full h-full" fill="none" aria-hidden="true">
          <rect width="220" height="100" rx="14" fill="#EFECE6" />
          <ellipse cx="110" cy="82" rx="84" ry="7" fill="rgba(15,23,42,0.12)" />
          {/* Blue Block -4 */}
          <rect x="30" y="26" width="52" height="52" rx="11" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.5" />
          <text x="56" y="59" textAnchor="middle" fontSize="22" fontWeight="900" fill="#FFFFFF">-4</text>
          {/* Cream Block < */}
          <rect x="88" y="34" width="44" height="44" rx="9" fill="#FBF7EE" stroke="#D6CFC2" strokeWidth="1.8" />
          <text x="110" y="63" textAnchor="middle" fontSize="24" fontWeight="900" fill="#0F172A">&lt;</text>
          {/* Green Block -1 */}
          <rect x="138" y="26" width="52" height="52" rx="11" fill="#22C55E" stroke="#86EFAC" strokeWidth="1.5" />
          <text x="164" y="59" textAnchor="middle" fontSize="22" fontWeight="900" fill="#FFFFFF">-1</text>
        </svg>
      );

    case 'OPPOSITE_DISTANCE':
      return (
        <svg viewBox="0 0 220 100" className="w-full h-full" fill="none" aria-hidden="true">
          <rect width="220" height="100" rx="14" fill="#EFECE6" />
          <ellipse cx="110" cy="84" rx="84" ry="6" fill="rgba(15,23,42,0.12)" />
          {/* Orange Sphere -3 */}
          <circle cx="56" cy="58" r="22" fill="#EA580C" stroke="#FED7AA" strokeWidth="1.5" />
          <circle cx="49" cy="50" r="5" fill="#FFEDD5" fillOpacity="0.6" />
          <text x="56" y="65" textAnchor="middle" fontSize="18" fontWeight="900" fill="#FFFFFF">-3</text>
          {/* Center 3D Mirror at 0 */}
          <path d="M104 16C104 11 116 11 116 16V84H104V16Z" fill="#E0F2FE" stroke="#64748B" strokeWidth="2" />
          <line x1="110" y1="14" x2="110" y2="86" stroke="#0284C7" strokeWidth="1.5" strokeDasharray="3 3" />
          {/* Green Sphere 3 */}
          <circle cx="164" cy="58" r="22" fill="#16A34A" stroke="#BBF7D0" strokeWidth="1.5" />
          <circle cx="157" cy="50" r="5" fill="#DCFCE7" fillOpacity="0.6" />
          <text x="164" y="65" textAnchor="middle" fontSize="18" fontWeight="900" fill="#FFFFFF">3</text>
        </svg>
      );

    case 'JUMP_ADD_SUB':
      return (
        <svg viewBox="0 0 220 100" className="w-full h-full" fill="none" aria-hidden="true">
          <rect width="220" height="100" rx="14" fill="#EFECE6" />
          {/* Number line */}
          <line x1="22" y1="80" x2="198" y2="80" stroke="#0F172A" strokeWidth="2.6" />
          <polygon points="18,80 26,76 26,84" fill="#0F172A" />
          <polygon points="202,80 194,76 194,84" fill="#0F172A" />
          {/* Dashed Jump Arc */}
          <path
            d="M54 80 Q110 26 166 80"
            stroke="#15803D"
            strokeWidth="3.2"
            strokeDasharray="5 4"
            fill="none"
          />
          <circle cx="54" cy="80" r="6.5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="166" cy="80" r="6.5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="1.5" />
          {/* Mini Robot Jumping at Apex */}
          <g transform="translate(122, 46) scale(0.42)">
            <RobotExplorer3D pose="THUMBS_UP" />
          </g>
        </svg>
      );

    case 'RESCUE_MISSION':
      return (
        <svg viewBox="0 0 220 100" className="w-full h-full" fill="none" aria-hidden="true">
          <rect width="220" height="100" rx="14" fill="#EFECE6" />
          <ellipse cx="110" cy="84" rx="76" ry="8" fill="rgba(21,128,61,0.18)" />
          {/* Golden Glow */}
          <circle cx="110" cy="48" r="34" fill="#FDE047" fillOpacity="0.35" />
          {/* 3D Wooden & Gold Treasure Chest */}
          <rect x="68" y="42" width="84" height="38" rx="6" fill="#92400E" stroke="#F59E0B" strokeWidth="3" />
          <path d="M66 42C66 24 154 24 154 42Z" fill="#B45309" stroke="#F59E0B" strokeWidth="3" />
          <line x1="68" y1="54" x2="152" y2="54" stroke="#F59E0B" strokeWidth="3.5" />
          {/* Gold Coins inside */}
          <ellipse cx="110" cy="42" rx="34" ry="6" fill="#FACC15" />
          {/* Chest Lock */}
          <rect x="102" y="46" width="16" height="18" rx="4" fill="#FACC15" stroke="#78350F" strokeWidth="1.8" />
          <circle cx="110" cy="53" r="2.2" fill="#78350F" />
        </svg>
      );
  }
};
