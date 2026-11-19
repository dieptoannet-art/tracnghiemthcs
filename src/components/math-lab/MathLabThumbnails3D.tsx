import React from 'react';
import { MathKnowledgeStrand, MathToolId } from './types';

/**
 * Hệ thống minh họa 3D SVG đồng bộ phong cách "Kiến thức trọng tâm" & "Thư viện bài giảng"
 * dành riêng cho Smart Math Lab (M01–M17):
 * - Ánh xạ 1-1 ổn định theo mã phòng ổn định (toolId: M01..M17)
 * - Tải tức thì (0ms), sắc nét ở mọi độ phân giải, không vỡ ảnh
 * - Mỗi minh họa sử dụng gradient ID riêng theo mã phòng để không xung đột SVG defs
 */

export const SmartMathLabHeroIllustration3D: React.FC = () => {
  return (
    <div
      className="relative w-[270px] sm:w-[340px] lg:w-[390px] h-[126px] sm:h-[146px] select-none pointer-events-none shrink-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 420 164"
        className="w-full h-full overflow-visible drop-shadow-[0_12px_20px_rgba(16,42,86,0.13)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="smlHeroGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#CBE3FF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="smlHeroPedestal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F5FAFF" />
            <stop offset="100%" stopColor="#CDE4FF" />
          </linearGradient>
          <linearGradient id="smlHeroCompassMetal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id="smlHeroCubeFront" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#BFDBFE" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.34" />
          </linearGradient>
          <linearGradient id="smlHeroCubeTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#EFF6FF" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.58" />
          </linearGradient>
          <linearGradient id="smlHeroSetSquare" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="55%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id="smlHeroDieFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#DCE8F8" />
          </linearGradient>
        </defs>

        {/* Hào quang nền */}
        <ellipse cx="220" cy="82" rx="185" ry="70" fill="url(#smlHeroGlow)" />

        {/* Đĩa bệ tròn 3D */}
        <ellipse cx="212" cy="144" rx="176" ry="14" fill="#93C5FD" fillOpacity="0.24" />
        <ellipse cx="145" cy="134" rx="68" ry="12" fill="url(#smlHeroPedestal)" stroke="#B8D7FF" strokeWidth="1.2" />
        <path d="M77 134V141C77 148 107 154 145 154C183 154 213 148 213 141V134" fill="#BBD9FF" fillOpacity="0.5" />

        {/* 1. Compa 3D bên trái */}
        <g transform="translate(88, 18) rotate(-4)">
          <circle cx="34" cy="12" r="7" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="1.5" />
          <rect x="30" y="2" width="8" height="9" rx="3" fill="#1D4ED8" />
          <path d="M31 18L11 114L17 116L34 24Z" fill="url(#smlHeroCompassMetal)" />
          <path d="M37 18L57 114L51 116L34 24Z" fill="url(#smlHeroCompassMetal)" />
          {/* Thanh chia cung trên compa */}
          <path d="M19 64C28 69 40 69 49 64" stroke="#93C5FD" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="34" cy="20" r="5" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="1.8" />
          {/* Đầu chì & kim */}
          <path d="M11 114L9 124L15 116Z" fill="#334155" />
          <path d="M57 114L59 124L53 116Z" fill="#0866FF" />
        </g>

        {/* 2. Khối lập phương trong suốt 3D */}
        <g transform="translate(152, 26)">
          {/* Cạnh khuất phía sau */}
          <path d="M30 8V68M30 68L4 86M30 68L82 78" stroke="#60A5FA" strokeWidth="1.3" strokeDasharray="3.5 3.5" strokeOpacity="0.65" />
          {/* Mặt trên */}
          <polygon points="30,6 82,16 56,34 4,24" fill="url(#smlHeroCubeTop)" stroke="#FFFFFF" strokeWidth="1.5" />
          {/* Mặt trái */}
          <polygon points="4,24 56,34 56,94 4,84" fill="url(#smlHeroCubeFront)" stroke="#FFFFFF" strokeWidth="1.4" />
          {/* Mặt phải */}
          <polygon points="56,34 82,16 82,76 56,94" fill="#93C5FD" fillOpacity="0.34" stroke="#FFFFFF" strokeWidth="1.4" />
          {/* Tia phản chiếu góc */}
          <line x1="12" y1="30" x2="26" y2="33" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.8" />
        </g>

        {/* 3. Mặt phẳng tọa độ Oxy + Parabol ở bên phải */}
        <g transform="translate(248, 12)">
          <rect
            x="4"
            y="4"
            width="136"
            height="108"
            rx="14"
            fill="#FFFFFF"
            fillOpacity="0.92"
            stroke="#B6D5FF"
            strokeWidth="2"
          />
          <rect x="12" y="12" width="120" height="92" rx="9" fill="#F4F9FF" />
          {/* Lưới tọa độ */}
          <path
            d="M32 16V98M52 16V98M72 16V98M92 16V98M112 16V98M16 32H128M16 52H128M16 72H128M16 90H128"
            stroke="#DCEBFF"
            strokeWidth="1"
          />
          {/* Trục Ox, Oy */}
          <line x1="18" y1="74" x2="124" y2="74" stroke="#334E73" strokeWidth="1.8" strokeLinecap="round" />
          <polygon points="126,74 120,70.5 120,77.5" fill="#334E73" />
          <line x1="72" y1="98" x2="72" y2="18" stroke="#334E73" strokeWidth="1.8" strokeLinecap="round" />
          <polygon points="72,15 68.5,21 75.5,21" fill="#334E73" />
          <text x="121" y="86" fontSize="10" fontWeight="800" fill="#102A56" fontFamily="Be Vietnam Pro, sans-serif">
            x
          </text>
          <text x="77" y="24" fontSize="10" fontWeight="800" fill="#102A56" fontFamily="Be Vietnam Pro, sans-serif">
            y
          </text>
          {/* Đường cong Parabol xanh dương */}
          <path
            d="M36 26C52 88 92 88 108 26"
            stroke="#0866FF"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="72" cy="73" r="3.6" fill="#0866FF" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="94" cy="52" r="3.2" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.2" />
        </g>

        {/* 4. Thước êke màu cam vàng ở tiền cảnh giữa */}
        <g transform="translate(188, 68)">
          <path
            d="M0 64L46 4L96 64H0Z"
            fill="url(#smlHeroSetSquare)"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M24 53L46 24L70 53H24Z" fill="#EAF4FF" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Vạch chia thước */}
          <path
            d="M14 64V58M24 64V59M34 64V58M44 64V59M54 64V58M64 64V59M74 64V58M84 64V59"
            stroke="#FFFBEB"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        {/* 5. Hai viên xúc xắc 3D ở phía trước phải */}
        <g transform="translate(292, 92)">
          <rect x="0" y="8" width="38" height="38" rx="9" fill="url(#smlHeroDieFace)" stroke="#BFDBFE" strokeWidth="1.5" />
          <circle cx="11" cy="18" r="2.8" fill="#0866FF" />
          <circle cx="27" cy="18" r="2.8" fill="#0866FF" />
          <circle cx="19" cy="27" r="2.8" fill="#0866FF" />
          <circle cx="11" cy="36" r="2.8" fill="#0866FF" />
          <circle cx="27" cy="36" r="2.8" fill="#0866FF" />
        </g>
        <g transform="translate(336, 102) rotate(12)">
          <rect x="0" y="0" width="34" height="34" rx="8" fill="url(#smlHeroDieFace)" stroke="#BFDBFE" strokeWidth="1.5" />
          <circle cx="10" cy="10" r="2.6" fill="#EF4444" />
          <circle cx="17" cy="17" r="2.6" fill="#EF4444" />
          <circle cx="24" cy="24" r="2.6" fill="#EF4444" />
        </g>
      </svg>
    </div>
  );
};

const PASTEL_BACKDROP_BY_ID: Record<MathToolId, string> = {
  M01: 'from-[#E8F6FF] via-[#F2F9FF] to-[#E5F7F2]',
  M02: 'from-[#EDF2FF] via-[#F4F6FF] to-[#E7ECFF]',
  M03: 'from-[#FFF4EB] via-[#FFF8F2] to-[#FFEDE0]',
  M04: 'from-[#E9F8FF] via-[#F2FBFF] to-[#ECF4FF]',
  M05: 'from-[#ECF4FF] via-[#F4F8FF] to-[#E5F0FF]',
  M06: 'from-[#EEF2FF] via-[#F5F7FF] to-[#E8ECFF]',
  M07: 'from-[#E8FBF5] via-[#F2FDF9] to-[#E6F4FF]',
  M08: 'from-[#E9F3FF] via-[#F3F8FF] to-[#ECEFFF]',
  M09: 'from-[#F1EFFF] via-[#F7F5FF] to-[#E9F1FF]',
  M10: 'from-[#ECF6FF] via-[#F5FAFF] to-[#FFF6E7]',
  M11: 'from-[#FFF1F3] via-[#FFF6F8] to-[#F1EEFF]',
  M12: 'from-[#EDF4FF] via-[#F5F9FF] to-[#E7F2FF]',
  M13: 'from-[#E8FBF2] via-[#F3FDF8] to-[#E6F6FF]',
  M14: 'from-[#F0EEFF] via-[#F7F6FF] to-[#EAF5FF]',
  M15: 'from-[#E9FAF6] via-[#F4FCFA] to-[#FFF5E7]',
  M16: 'from-[#E8F7FF] via-[#F4FAFF] to-[#FFF1F2]',
  M17: 'from-[#ECF6FF] via-[#F5F9FF] to-[#F1EEFF]',
  M18: 'from-[#F5EFE2] via-[#FAF6EE] to-[#E6F4EA]',
};

const FALLBACK_BY_STRAND: Record<MathKnowledgeStrand, string> = {
  geometry_measurement: 'from-[#E8F6FF] to-[#E5F7F2]',
  number_algebra: 'from-[#EDF2FF] to-[#E6ECFF]',
  statistics_prob: 'from-[#FFF4EB] to-[#FFEDE0]',
  practice_experience: 'from-[#ECF6FF] to-[#F1EEFF]',
};

function renderThumbnailScene(toolId: MathToolId): React.ReactNode {
  switch (toolId) {
    case 'M01':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="m01Comp" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id="m01Tri" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <ellipse cx="140" cy="108" rx="108" ry="8" fill="#0866FF" fillOpacity="0.1" />
          {/* Tờ giấy vẽ tam giác ABC */}
          <g transform="translate(88, 18) rotate(-3)">
            <rect x="0" y="0" width="116" height="84" rx="10" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.6" />
            <path d="M18 16H98M18 32H98M18 48H98M18 64H98M34 10V74M56 10V74M78 10V74" stroke="#EFF6FF" strokeWidth="1" />
            <polygon points="32,68 58,20 88,68" fill="#0866FF" fillOpacity="0.12" stroke="#0866FF" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M40 68A10 10 0 0 0 36 60" stroke="#10B981" strokeWidth="2" />
            <circle cx="32" cy="68" r="3.5" fill="#0866FF" stroke="#FFFFFF" strokeWidth="1.2" />
            <circle cx="58" cy="20" r="3.5" fill="#0866FF" stroke="#FFFFFF" strokeWidth="1.2" />
            <circle cx="88" cy="68" r="3.5" fill="#0866FF" stroke="#FFFFFF" strokeWidth="1.2" />
          </g>
          {/* Compa 3D bên trái */}
          <g transform="translate(48, 12)">
            <circle cx="24" cy="12" r="5" fill="#1D4ED8" />
            <path d="M22 16L6 90L12 91L25 22Z" fill="url(#m01Comp)" />
            <path d="M26 16L42 90L36 91L23 22Z" fill="url(#m01Comp)" />
            <path d="M12 52C19 56 29 56 36 52" stroke="#93C5FD" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="24" cy="16" r="4" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="1.5" />
          </g>
          {/* Thước êke cam vàng bên phải */}
          <g transform="translate(166, 48)">
            <path d="M0 54L36 4L76 54H0Z" fill="url(#m01Tri)" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M20 44L36 22L54 44H20Z" fill="#E8F6FF" stroke="#F59E0B" strokeWidth="1.2" />
          </g>
        </svg>
      );

    case 'M02':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="m02Curve" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#0866FF" />
            </linearGradient>
          </defs>
          <ellipse cx="140" cy="110" rx="102" ry="7" fill="#4F46E5" fillOpacity="0.11" />
          <rect x="64" y="14" width="152" height="94" rx="14" fill="#FFFFFF" stroke="#C7D2FE" strokeWidth="1.8" />
          <rect x="74" y="22" width="132" height="78" rx="9" fill="#F8FAFF" />
          <path d="M96 24V98M118 24V98M140 24V98M162 24V98M184 24V98M78 38H202M78 56H202M78 74H202M78 90H202" stroke="#E0E7FF" strokeWidth="1" />
          {/* Trục tọa độ */}
          <line x1="80" y1="78" x2="198" y2="78" stroke="#1E3A8A" strokeWidth="1.8" />
          <polygon points="200,78 194,75 194,81" fill="#1E3A8A" />
          <line x1="140" y1="96" x2="140" y2="26" stroke="#1E3A8A" strokeWidth="1.8" />
          <polygon points="140,24 137,30 143,30" fill="#1E3A8A" />
          <text x="193" y="90" fontSize="9.5" fontWeight="800" fill="#102A56" fontFamily="Be Vietnam Pro, sans-serif">x</text>
          <text x="145" y="32" fontSize="9.5" fontWeight="800" fill="#102A56" fontFamily="Be Vietnam Pro, sans-serif">y</text>
          {/* Parabol & đường thẳng cát tuyến */}
          <path d="M96 28C116 94 164 94 184 28" stroke="url(#m02Curve)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <line x1="86" y1="86" x2="194" y2="34" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="111" cy="74" r="3.8" fill="#0866FF" stroke="#FFFFFF" strokeWidth="1.4" />
          <circle cx="171" cy="45" r="3.8" fill="#0866FF" stroke="#FFFFFF" strokeWidth="1.4" />
        </svg>
      );

    case 'M03':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="m03Coin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <radialGradient id="m03BlueBall" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#93C5FD" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </radialGradient>
            <radialGradient id="m03GreenBall" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#86EFAC" />
              <stop offset="100%" stopColor="#15803D" />
            </radialGradient>
            <radialGradient id="m03RedBall" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FCA5A5" />
              <stop offset="100%" stopColor="#DC2626" />
            </radialGradient>
          </defs>
          <ellipse cx="140" cy="108" rx="108" ry="8" fill="#EA580C" fillOpacity="0.11" />
          {/* Xúc xắc 1 */}
          <g transform="translate(46, 30) rotate(-10)">
            <rect x="0" y="0" width="42" height="42" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="3.2" fill="#0866FF" />
            <circle cx="30" cy="12" r="3.2" fill="#0866FF" />
            <circle cx="21" cy="21" r="3.2" fill="#0866FF" />
            <circle cx="12" cy="30" r="3.2" fill="#0866FF" />
            <circle cx="30" cy="30" r="3.2" fill="#0866FF" />
          </g>
          {/* Xúc xắc 2 */}
          <g transform="translate(94, 48) rotate(8)">
            <rect x="0" y="0" width="38" height="38" rx="9" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.6" />
            <circle cx="11" cy="11" r="2.8" fill="#EF4444" />
            <circle cx="27" cy="11" r="2.8" fill="#EF4444" />
            <circle cx="11" cy="27" r="2.8" fill="#EF4444" />
            <circle cx="27" cy="27" r="2.8" fill="#EF4444" />
          </g>
          {/* Đồng xu vàng 3D */}
          <circle cx="164" cy="54" r="23" fill="#B45309" />
          <circle cx="161" cy="52" r="22" fill="url(#m03Coin)" stroke="#FEF08A" strokeWidth="2" />
          <text x="161" y="59" textAnchor="middle" fontSize="18" fontWeight="900" fill="#FFFBEB" fontFamily="Be Vietnam Pro, sans-serif">N</text>
          {/* 3 quả bóng màu */}
          <circle cx="204" cy="70" r="14" fill="url(#m03BlueBall)" />
          <circle cx="222" cy="84" r="13" fill="url(#m03GreenBall)" />
          <circle cx="236" cy="65" r="11" fill="url(#m03RedBall)" />
        </svg>
      );

    case 'M04':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="108" rx="108" ry="8" fill="#0284C7" fillOpacity="0.1" />
          {/* Cột 3D */}
          <g transform="translate(46, 20)">
            <rect x="0" y="54" width="22" height="30" rx="5" fill="#60A5FA" />
            <rect x="28" y="34" width="22" height="50" rx="5" fill="#12A879" />
            <rect x="56" y="16" width="22" height="68" rx="5" fill="#F59E0B" />
            <rect x="84" y="40" width="22" height="44" rx="5" fill="#0866FF" />
            <line x1="-6" y1="86" x2="114" y2="86" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
          </g>
          {/* Biểu đồ tròn 3D bên phải */}
          <g transform="translate(206, 62)">
            <ellipse cx="0" cy="7" rx="34" ry="27" fill="#1E40AF" fillOpacity="0.22" />
            <circle cx="0" cy="0" r="32" fill="#3B82F6" />
            <path d="M0 0V-32A32 32 0 0 1 30 11Z" fill="#FACC15" />
            <path d="M0 0L30 11A32 32 0 0 1 -10 30Z" fill="#10B981" />
            <circle cx="0" cy="0" r="32" stroke="#FFFFFF" strokeWidth="1.8" />
          </g>
        </svg>
      );

    case 'M05':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <rect x="10" y="8" width="260" height="108" rx="16" fill="#F5EFE2" stroke="#DFD3BC" strokeWidth="1.5" />
          <ellipse cx="140" cy="108" rx="108" ry="7" fill="#136F50" fillOpacity="0.12" />
          {/* 3D Fraction Wheel on left */}
          <g transform="translate(48, 62)">
            <rect x="-16" y="34" width="32" height="6" rx="3" fill="#CBB693" />
            <circle cx="0" cy="0" r="30" fill="#EFE4CE" stroke="#C5B293" strokeWidth="2" />
            <path d="M0 0 L0 -26 A26 26 0 0 0 -26 0 Z" fill="#146C4E" stroke="#2C3E35" strokeWidth="1.2" />
            <path d="M0 0 L-26 0 A26 26 0 0 0 0 26 Z" fill="#146C4E" stroke="#2C3E35" strokeWidth="1.2" />
            <path d="M0 0 L26 0 A26 26 0 0 0 0 -26 Z" fill="#F3E7CE" stroke="#2C3E35" strokeWidth="1.2" />
            <path d="M0 0 L0 26 A26 26 0 0 0 26 0 Z" fill="#F3E7CE" stroke="#2C3E35" strokeWidth="1.2" />
          </g>
          {/* Headline 1/2 = 2/4 */}
          <rect x="94" y="14" width="112" height="22" rx="8" fill="#FAF4E8" stroke="#E07A1B" strokeWidth="1.4" />
          <text x="150" y="29" textAnchor="middle" fontSize="11.5" fontWeight="900" fill="#12382B" fontFamily="Be Vietnam Pro, sans-serif">
            1/2 = 2/4
          </text>
          {/* Top Bar 1/2 */}
          <rect x="90" y="44" width="60" height="20" rx="3.5" fill="#146C4E" />
          <rect x="150" y="44" width="60" height="20" rx="3.5" fill="#EFE4CE" stroke="#C8B89A" strokeWidth="1.2" />
          <rect x="216" y="42" width="28" height="24" rx="5" fill="#FAF5EA" stroke="#D1C3AA" strokeWidth="1.2" />
          <text x="230" y="58" textAnchor="middle" fontSize="10" fontWeight="900" fill="#12382B">1/2</text>
          {/* Bottom Bar 2/4 */}
          <rect x="90" y="72" width="29" height="20" rx="3" fill="#146C4E" />
          <rect x="121" y="72" width="29" height="20" rx="3" fill="#146C4E" />
          <rect x="150" y="72" width="29" height="20" rx="3" fill="#EFE4CE" stroke="#C8B89A" strokeWidth="1.2" />
          <rect x="181" y="72" width="29" height="20" rx="3" fill="#EFE4CE" stroke="#C8B89A" strokeWidth="1.2" />
          <rect x="216" y="70" width="28" height="24" rx="5" fill="#FAF5EA" stroke="#D1C3AA" strokeWidth="1.2" />
          <text x="230" y="86" textAnchor="middle" fontSize="10" fontWeight="900" fill="#12382B">2/4</text>
        </svg>
      );

    case 'M06':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="110" rx="102" ry="7" fill="#3B82F6" fillOpacity="0.1" />
          {/* Trụ cân */}
          <rect x="135" y="28" width="10" height="72" rx="4" fill="#64748B" />
          <rect x="108" y="96" width="64" height="10" rx="5" fill="#1E3A8A" />
          {/* Đòn cân */}
          <rect x="64" y="32" width="152" height="7" rx="3.5" fill="#2563EB" />
          <circle cx="140" cy="35" r="7" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
          {/* Đĩa trái + khối X */}
          <line x1="78" y1="38" x2="66" y2="74" stroke="#94A3B8" strokeWidth="2" />
          <line x1="78" y1="38" x2="90" y2="74" stroke="#94A3B8" strokeWidth="2" />
          <path d="M54 74H102C98 84 58 84 54 74Z" fill="#F59E0B" />
          <rect x="64" y="46" width="28" height="28" rx="6" fill="#0866FF" stroke="#FFFFFF" strokeWidth="1.5" />
          <text x="78" y="65" textAnchor="middle" fontSize="16" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">x</text>
          {/* Đĩa phải + 2 quả cân 3 + 3 */}
          <line x1="202" y1="38" x2="190" y2="74" stroke="#94A3B8" strokeWidth="2" />
          <line x1="202" y1="38" x2="214" y2="74" stroke="#94A3B8" strokeWidth="2" />
          <path d="M178 74H226C222 84 182 84 178 74Z" fill="#F59E0B" />
          <rect x="181" y="52" width="20" height="22" rx="4" fill="#475569" stroke="#CBD5E1" strokeWidth="1.2" />
          <text x="191" y="67" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">3</text>
          <rect x="204" y="52" width="20" height="22" rx="4" fill="#475569" stroke="#CBD5E1" strokeWidth="1.2" />
          <text x="214" y="67" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">3</text>
        </svg>
      );

    case 'M07':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <rect x="10" y="8" width="260" height="108" rx="16" fill="#F5EFE2" stroke="#DFD3BC" strokeWidth="1.5" />
          <ellipse cx="145" cy="106" rx="108" ry="8" fill="#136F50" fillOpacity="0.12" />
          {/* Mini 3D Thermometer on left */}
          <rect x="22" y="22" width="22" height="76" rx="11" fill="#E8E1D3" stroke="#C7BCA6" strokeWidth="1.4" />
          <rect x="30" y="34" width="6" height="46" rx="3" fill="#CBD5E1" />
          <rect x="30" y="54" width="6" height="26" rx="3" fill="#DC2626" />
          <circle cx="33" cy="84" r="6.5" fill="#DC2626" />
          {/* Formula Pill */}
          <rect x="64" y="14" width="166" height="22" rx="8" fill="#FAF6ED" stroke="#DCD0B9" strokeWidth="1.2" />
          <text x="147" y="29" textAnchor="middle" fontSize="11" fontWeight="900" fill="#12382B" fontFamily="Be Vietnam Pro, sans-serif">
            (-3) - (-5) = (-3) + 5 = 2
          </text>
          {/* Number line axis */}
          <line x1="58" y1="82" x2="254" y2="82" stroke="#0F1D2E" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="258,82 250,78 250,86" fill="#0F1D2E" />
          <polygon points="54,82 62,78 62,86" fill="#0F1D2E" />
          {[
            { x: 76, label: '-4' },
            { x: 100, label: '-3', highlight: '#D96B16' },
            { x: 124, label: '-2' },
            { x: 148, label: '-1' },
            { x: 172, label: '0', zero: true },
            { x: 196, label: '1' },
            { x: 220, label: '2', highlight: '#15803D' },
            { x: 244, label: '3' },
          ].map((t) => (
            <g key={t.label}>
              <line
                x1={t.x}
                y1="77"
                x2={t.x}
                y2="87"
                stroke={t.highlight || (t.zero ? '#0F766E' : '#334155')}
                strokeWidth={t.highlight || t.zero ? 2.4 : 1.5}
              />
              <text
                x={t.x}
                y="101"
                textAnchor="middle"
                fontSize="10"
                fontWeight={t.highlight || t.zero ? '900' : '700'}
                fill={t.highlight || (t.zero ? '#0F766E' : '#1E293B')}
                fontFamily="Be Vietnam Pro, sans-serif"
              >
                {t.label}
              </text>
            </g>
          ))}
          {/* Jump Arc from -3 (x=100) to 2 (x=220) */}
          <path d="M100 82 Q 160 36 220 82" stroke="#15803D" strokeWidth="3" fill="none" />
          <circle cx="100" cy="82" r="5.5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="220" cy="82" r="5.5" fill="#16A34A" stroke="#FFFFFF" strokeWidth="1.5" />
          <text x="160" y="53" textAnchor="middle" fontSize="12" fontWeight="900" fill="#15803D" fontFamily="Be Vietnam Pro, sans-serif">
            +5
          </text>
          {/* Mini Robot Head at x=220 */}
          <rect x="208" y="50" width="24" height="18" rx="6" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.3" />
          <rect x="212" y="54" width="16" height="10" rx="3.5" fill="#0F172A" />
          <circle cx="217" cy="59" r="1.5" fill="#38BDF8" />
          <circle cx="223" cy="59" r="1.5" fill="#38BDF8" />
        </svg>
      );

    case 'M08':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <defs>
            <radialGradient id="m08Sphere" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#F97316" />
            </radialGradient>
            <linearGradient id="m08Cone" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <ellipse cx="140" cy="108" rx="108" ry="8" fill="#1D4ED8" fillOpacity="0.1" />
          {/* Hình lập phương trong suốt */}
          <g transform="translate(50, 22)">
            <path d="M22 6V52M22 52L4 64M22 52L62 58" stroke="#60A5FA" strokeWidth="1.2" strokeDasharray="3 3" />
            <polygon points="22,6 62,12 44,24 4,18" fill="#DBEAFE" fillOpacity="0.7" stroke="#FFFFFF" strokeWidth="1.4" />
            <polygon points="4,18 44,24 44,70 4,64" fill="#93C5FD" fillOpacity="0.45" stroke="#FFFFFF" strokeWidth="1.4" />
            <polygon points="44,24 62,12 62,58 44,70" fill="#60A5FA" fillOpacity="0.35" stroke="#FFFFFF" strokeWidth="1.4" />
          </g>
          {/* Hình nón xanh ngọc */}
          <g transform="translate(128, 22)">
            <ellipse cx="26" cy="70" rx="22" ry="7" fill="#047857" />
            <path d="M4 70L26 6L48 70Z" fill="url(#m08Cone)" />
            <ellipse cx="26" cy="70" rx="22" ry="7" fill="#34D399" fillOpacity="0.55" />
          </g>
          {/* Hình cầu cam 3D */}
          <circle cx="212" cy="70" r="24" fill="url(#m08Sphere)" />
          <ellipse cx="204" cy="60" rx="7" ry="4" transform="rotate(-25 204 60)" fill="#FFFFFF" fillOpacity="0.45" />
        </svg>
      );

    case 'M09':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="108" rx="104" ry="8" fill="#4F46E5" fillOpacity="0.1" />
          {/* Mô hình hình học (a+b)^2 = a^2 + 2ab + b^2 */}
          <g transform="translate(88, 16)">
            <rect x="0" y="0" width="58" height="58" rx="7" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
            <text x="29" y="34" textAnchor="middle" fontSize="15" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">a²</text>

            <rect x="62" y="0" width="32" height="58" rx="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <text x="78" y="34" textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">ab</text>

            <rect x="0" y="62" width="58" height="28" rx="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <text x="29" y="80" textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">ab</text>

            <rect x="62" y="62" width="32" height="28" rx="7" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
            <text x="78" y="80" textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">b²</text>
          </g>
        </svg>
      );

    case 'M10':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="108" rx="106" ry="8" fill="#0866FF" fillOpacity="0.1" />
          {/* Thước đo góc bán nguyệt */}
          <g transform="translate(62, 24)">
            <path d="M12 68A66 66 0 0 1 144 68H12Z" fill="#FFFFFF" fillOpacity="0.9" stroke="#3B82F6" strokeWidth="2.2" />
            <path d="M36 68A42 42 0 0 1 120 68H36Z" fill="#EAF4FF" stroke="#93C5FD" strokeWidth="1.5" />
            <line x1="78" y1="68" x2="78" y2="6" stroke="#93C5FD" strokeWidth="1.5" />
            <line x1="78" y1="68" x2="124" y2="22" stroke="#F59E0B" strokeWidth="2.2" />
            <circle cx="78" cy="68" r="4" fill="#0866FF" />
          </g>
          {/* Thước kẻ vàng phía trước */}
          <g transform="translate(56, 78) rotate(-4)">
            <rect x="0" y="0" width="166" height="20" rx="5" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M18 0V7M34 0V5M50 0V7M66 0V5M82 0V7M98 0V5M114 0V7M130 0V5M146 0V7" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'M11':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="m11Trophy" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
          </defs>
          <ellipse cx="140" cy="108" rx="102" ry="8" fill="#8B5CF6" fillOpacity="0.11" />
          {/* Thẻ phép toán */}
          <rect x="44" y="34" width="38" height="38" rx="10" transform="rotate(-10 44 34)" fill="#3B82F6" />
          <text x="64" y="60" textAnchor="middle" fontSize="22" fontWeight="900" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">+</text>
          <rect x="194" y="30" width="38" height="38" rx="10" transform="rotate(10 194 30)" fill="#EC4899" />
          <text x="211" y="56" textAnchor="middle" fontSize="22" fontWeight="900" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">×</text>
          {/* Cúp vàng đấu trường */}
          <g transform="translate(106, 18)">
            <path d="M12 10H56V32C56 48 45 58 34 58C23 58 12 48 12 32V10Z" fill="url(#m11Trophy)" stroke="#FFFFFF" strokeWidth="1.6" />
            <path d="M12 16H4C4 30 8 36 14 36M56 16H64C64 30 60 36 54 36" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
            <rect x="29" y="58" width="10" height="16" fill="#D97706" />
            <rect x="18" y="74" width="32" height="10" rx="4" fill="#1E3A8A" />
          </g>
        </svg>
      );

    case 'M12':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="108" rx="106" ry="8" fill="#0866FF" fillOpacity="0.1" />
          {/* Bảng công thức trắng xanh */}
          <rect x="54" y="16" width="172" height="86" rx="14" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="2" />
          <rect x="64" y="25" width="152" height="68" rx="9" fill="#F4F8FF" />
          <text x="140" y="50" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0866FF" fontFamily="Be Vietnam Pro, sans-serif">Δ = b² − 4ac</text>
          <rect x="86" y="61" width="108" height="6" rx="3" fill="#CBD5E1" />
          <rect x="98" y="74" width="84" height="6" rx="3" fill="#93C5FD" />
          {/* Bút trình bày */}
          <g transform="translate(198, 42) rotate(28)">
            <rect x="0" y="0" width="11" height="54" rx="4" fill="#0866FF" stroke="#FFFFFF" strokeWidth="1.4" />
            <polygon points="0,54 11,54 5.5,64" fill="#F59E0B" />
          </g>
        </svg>
      );

    case 'M13':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="108" rx="104" ry="8" fill="#10B981" fillOpacity="0.1" />
          {/* Lưới Sàng Eratosthenes 3D */}
          <g transform="translate(66, 18)">
            {[
              { x: 0, y: 0, n: '2', prime: true },
              { x: 38, y: 0, n: '3', prime: true },
              { x: 76, y: 0, n: '4', prime: false },
              { x: 114, y: 0, n: '5', prime: true },
              { x: 0, y: 44, n: '6', prime: false },
              { x: 38, y: 44, n: '7', prime: true },
              { x: 76, y: 44, n: '8', prime: false },
              { x: 114, y: 44, n: '9', prime: false },
            ].map((cell) => (
              <g key={cell.n} transform={`translate(${cell.x}, ${cell.y})`}>
                <rect
                  x="0"
                  y="0"
                  width="32"
                  height="36"
                  rx="8"
                  fill={cell.prime ? '#12A879' : '#FFFFFF'}
                  stroke={cell.prime ? '#FFFFFF' : '#CBD5E1'}
                  strokeWidth="1.6"
                />
                <text
                  x="16"
                  y="23"
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="800"
                  fill={cell.prime ? '#FFFFFF' : '#94A3B8'}
                  fontFamily="Be Vietnam Pro, sans-serif"
                >
                  {cell.n}
                </text>
              </g>
            ))}
          </g>
        </svg>
      );

    case 'M14':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="108" rx="106" ry="8" fill="#6366F1" fillOpacity="0.1" />
          <rect x="52" y="16" width="176" height="88" rx="14" fill="#FFFFFF" stroke="#DDD6FE" strokeWidth="1.8" />
          {/* Trục đối xứng Oy */}
          <line x1="140" y1="22" x2="140" y2="98" stroke="#6366F1" strokeWidth="2.2" strokeDasharray="4 3" />
          {/* Hình gốc bên trái */}
          <polygon points="74,84 114,32 124,78" fill="#0866FF" fillOpacity="0.82" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Hình ảnh đối xứng bên phải */}
          <polygon points="206,84 166,32 156,78" fill="#06B6D4" fillOpacity="0.82" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Đường nối đối xứng */}
          <line x1="114" y1="32" x2="166" y2="32" stroke="#F59E0B" strokeWidth="1.6" strokeDasharray="3 3" />
          <circle cx="114" cy="32" r="3" fill="#F59E0B" />
          <circle cx="166" cy="32" r="3" fill="#F59E0B" />
        </svg>
      );

    case 'M15':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="110" rx="100" ry="7" fill="#0D9488" fillOpacity="0.1" />
          {/* Mô hình Pythagore 3 hình vuông */}
          <g transform="translate(88, 22)">
            {/* Tam giác vuông */}
            <polygon points="32,32 32,68 78,68" fill="#FFFFFF" stroke="#102A56" strokeWidth="2" strokeLinejoin="round" />
            {/* Hình vuông cạnh a = 3 (trái) */}
            <rect x="0" y="32" width="32" height="36" rx="4" fill="#0866FF" fillOpacity="0.86" stroke="#FFFFFF" strokeWidth="1.5" />
            <text x="16" y="54" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">a²</text>
            {/* Hình vuông cạnh b = 4 (dưới) */}
            <rect x="32" y="68" width="46" height="24" rx="4" fill="#12A879" fillOpacity="0.88" stroke="#FFFFFF" strokeWidth="1.5" />
            <text x="55" y="84" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">b²</text>
            {/* Hình vuông cạnh huyền c */}
            <polygon points="32,32 78,68 98,42 52,6" fill="#F59E0B" fillOpacity="0.9" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
            <text x="64" y="40" textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">c²</text>
          </g>
        </svg>
      );

    case 'M16':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="108" rx="104" ry="8" fill="#0284C7" fillOpacity="0.1" />
          {/* Tam giác ABC với đường song song MN // BC (Thalès) */}
          <g transform="translate(74, 16)">
            <polygon points="66,6 12,86 120,86" fill="#FFFFFF" stroke="#0866FF" strokeWidth="2.4" strokeLinejoin="round" />
            <polygon points="66,6 39,46 93,46" fill="#0866FF" fillOpacity="0.15" />
            <line x1="39" y1="46" x2="93" y2="46" stroke="#F43F5E" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="66" cy="6" r="3.5" fill="#0866FF" />
            <circle cx="39" cy="46" r="3.5" fill="#F43F5E" />
            <circle cx="93" cy="46" r="3.5" fill="#F43F5E" />
            <circle cx="12" cy="86" r="3.5" fill="#0866FF" />
            <circle cx="120" cy="86" r="3.5" fill="#0866FF" />
            <text x="27" y="48" fontSize="10" fontWeight="800" fill="#102A56" fontFamily="Be Vietnam Pro, sans-serif">M</text>
            <text x="99" y="48" fontSize="10" fontWeight="800" fill="#102A56" fontFamily="Be Vietnam Pro, sans-serif">N</text>
          </g>
        </svg>
      );

    case 'M17':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <ellipse cx="140" cy="108" rx="104" ry="8" fill="#6366F1" fillOpacity="0.1" />
          {/* Sơ đồ cây 2 tầng */}
          <g transform="translate(46, 16)">
            <path d="M24 44L92 22M24 44L92 66" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M92 22L166 10M92 22L166 34M92 66L166 54M92 66L166 78" stroke="#60A5FA" strokeWidth="2.2" strokeLinecap="round" />
            {/* Nút gốc */}
            <circle cx="24" cy="44" r="12" fill="#0866FF" stroke="#FFFFFF" strokeWidth="2" />
            <text x="24" y="48" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">Ω</text>
            {/* Tầng 1 */}
            <circle cx="92" cy="22" r="10" fill="#6366F1" stroke="#FFFFFF" strokeWidth="1.8" />
            <text x="92" y="26" textAnchor="middle" fontSize="10" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">S</text>
            <circle cx="92" cy="66" r="10" fill="#12A879" stroke="#FFFFFF" strokeWidth="1.8" />
            <text x="92" y="70" textAnchor="middle" fontSize="10" fontWeight="800" fill="#FFFFFF" fontFamily="Be Vietnam Pro, sans-serif">N</text>
            {/* Lá tầng 2 */}
            <rect x="160" y="2" width="24" height="16" rx="5" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.4" />
            <rect x="160" y="26" width="24" height="16" rx="5" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.4" />
            <rect x="160" y="46" width="24" height="16" rx="5" fill="#12A879" stroke="#FFFFFF" strokeWidth="1.4" />
            <rect x="160" y="70" width="24" height="16" rx="5" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.4" />
          </g>
        </svg>
      );

    case 'M18':
      return (
        <svg viewBox="0 0 280 124" className="w-full h-full" fill="none">
          <rect x="10" y="8" width="260" height="108" rx="16" fill="#F5EFE2" stroke="#DFD3BC" strokeWidth="1.5" />
          <ellipse cx="140" cy="108" rx="108" ry="7" fill="#0F5132" fillOpacity="0.14" />
          {/* Formula Pill 2 : 3 = 4 : 6 */}
          <rect x="74" y="14" width="132" height="22" rx="11" fill="#FAF6EE" stroke="#15803D" strokeWidth="1.4" />
          <text x="140" y="29" textAnchor="middle" fontSize="11.5" fontWeight="900" fill="#0F5132" fontFamily="Be Vietnam Pro, sans-serif">
            2 : 3 = 4 : 6
          </text>
          {/* 2-Tier Pedestal with Beakers */}
          <rect x="52" y="64" width="130" height="12" rx="5" fill="#E8DCC4" stroke="#CBB896" strokeWidth="1.2" />
          <rect x="38" y="92" width="158" height="14" rx="6" fill="#DFD1B5" stroke="#BFA984" strokeWidth="1.2" />
          {/* Top 2 Blue + 3 Yellow Mini Beakers */}
          {[66, 86].map((x) => (
            <rect key={`tb-${x}`} x={x} y="44" width="14" height="20" rx="2.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1" />
          ))}
          {[110, 130, 150].map((x) => (
            <rect key={`ty-${x}`} x={x} y="44" width="14" height="20" rx="2.5" fill="#FACC15" stroke="#CA8A04" strokeWidth="1" />
          ))}
          {/* Right Green Mixed Pitcher with Stirring Rod */}
          <g transform="translate(206, 42)">
            <line x1="34" y1="0" x2="14" y2="52" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
            <rect x="2" y="22" width="32" height="36" rx="4" fill="#38B000" />
            <rect x="0" y="10" width="36" height="50" rx="5" fill="rgba(255,255,255,0.38)" stroke="#94A3B8" strokeWidth="1.5" />
          </g>
        </svg>
      );
  }
}

interface MathLabCardThumbnail3DProps {
  toolId: MathToolId;
  strand: MathKnowledgeStrand;
  grades: string[];
  code: string;
}

export const MathLabCardThumbnail3D: React.FC<MathLabCardThumbnail3DProps> = ({
  toolId,
  strand,
  grades,
  code,
}) => {
  const bgGradient = PASTEL_BACKDROP_BY_ID[toolId] || FALLBACK_BY_STRAND[strand];

  return (
    <div
      className={`relative h-[132px] sm:h-[138px] w-full rounded-[15px] bg-gradient-to-br ${bgGradient} border border-[#E2EDFF] overflow-hidden select-none`}
    >
      {/* Ánh sáng pastel dịu ở góc */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/60 blur-xl"
        aria-hidden="true"
      />

      {/* Hình minh họa 3D căn giữa */}
      <div className="relative z-0 w-full h-full flex items-center justify-center px-3 py-1.5 pointer-events-none" aria-hidden="true">
        {renderThumbnailScene(toolId)}
      </div>

      {/* Nhãn mã phòng góc trên trái */}
      <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#0866FF] text-white text-[11px] font-extrabold tracking-wide shadow-[0_3px_10px_rgba(8,102,255,0.28)] tabular-nums">
        {code}
      </span>

      {/* Nhãn các khối lớp hỗ trợ góc trên phải */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
        {grades.map((g) => (
          <span
            key={g}
            className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/95 border border-[#D4E4FF] text-[#102A56] text-[11px] font-bold shadow-2xs tabular-nums"
          >
            L{g}
          </span>
        ))}
      </div>
    </div>
  );
};
