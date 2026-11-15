import React from 'react';
import {
  LayoutGrid,
  Dices,
  Rocket,
  BookOpen,
  Trophy,
  Activity,
  Brain,
} from 'lucide-react';

export const CATEGORY_META: Record<
  string,
  {
    label: string;
    count: number;
    color: string;
    iconBg: string;
    activeBg: string;
    border: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  all: {
    label: 'Tất cả trò chơi',
    count: 50,
    color: 'text-[#006BFF]',
    iconBg: 'text-[#006BFF]',
    activeBg: 'bg-[#006BFF] text-white',
    border: 'border-[#006BFF]',
    icon: LayoutGrid,
  },
  random: {
    label: 'Gọi học sinh ngẫu nhiên',
    count: 12,
    color: 'text-rose-500',
    iconBg: 'text-rose-500',
    activeBg: 'bg-[#006BFF] text-white',
    border: 'border-rose-200',
    icon: Dices,
  },
  warmup: {
    label: 'Khởi động tiết học',
    count: 10,
    color: 'text-orange-500',
    iconBg: 'text-orange-500',
    activeBg: 'bg-[#006BFF] text-white',
    border: 'border-orange-200',
    icon: Rocket,
  },
  reinforce: {
    label: 'Củng cố kiến thức',
    count: 10,
    color: 'text-sky-500',
    iconBg: 'text-sky-500',
    activeBg: 'bg-[#006BFF] text-white',
    border: 'border-sky-200',
    icon: BookOpen,
  },
  competition: {
    label: 'Thi đua cá nhân & nhóm',
    count: 8,
    color: 'text-amber-500',
    iconBg: 'text-amber-500',
    activeBg: 'bg-[#006BFF] text-white',
    border: 'border-amber-200',
    icon: Trophy,
  },
  movement: {
    label: 'Vận động & tương tác',
    count: 5,
    color: 'text-red-500',
    iconBg: 'text-red-500',
    activeBg: 'bg-[#006BFF] text-white',
    border: 'border-red-200',
    icon: Activity,
  },
  puzzle: {
    label: 'Thử thách trí tuệ',
    count: 5,
    color: 'text-purple-500',
    iconBg: 'text-purple-500',
    activeBg: 'bg-[#006BFF] text-white',
    border: 'border-purple-200',
    icon: Brain,
  },
};

export const BannerGamepadSVG: React.FC<{ className?: string }> = ({ className = 'w-28 h-24' }) => (
  <svg viewBox="0 0 160 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="padBody" x1="0" y1="0" x2="160" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="60%" stopColor="#E0E7FF" />
        <stop offset="100%" stopColor="#93C5FD" />
      </linearGradient>
      <linearGradient id="padGrip" x1="0" y1="40" x2="160" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
      <filter id="padShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.35" />
      </filter>
    </defs>
    {/* Glow & Sparkles */}
    <circle cx="80" cy="60" r="52" fill="#38BDF8" fillOpacity="0.2" />
    <circle cx="22" cy="24" r="4" fill="#FACC15" />
    <circle cx="140" cy="20" r="3" fill="#F472B6" />
    <circle cx="18" cy="95" r="3.5" fill="#34D399" />
    {/* Controller Body */}
    <g filter="url(#padShadow)" transform="rotate(-10 80 60)">
      <path
        d="M42 32 H118 C134 32 146 46 142 66 L136 92 C133 104 120 108 110 98 L98 84 H62 L50 98 C40 108 27 104 24 92 L18 66 C14 46 26 32 42 32 Z"
        fill="url(#padBody)"
        stroke="#FFFFFF"
        strokeWidth="2.5"
      />
      {/* Blue Grips */}
      <path d="M24 92 L18 68 C16 58 22 50 30 52 L42 84 L34 98 C29 102 25 98 24 92 Z" fill="url(#padGrip)" />
      <path d="M136 92 L142 68 C144 58 138 50 130 52 L118 84 L126 98 C131 102 135 98 136 92 Z" fill="url(#padGrip)" />
      {/* D-Pad */}
      <rect x="42" y="48" width="8" height="22" rx="2.5" fill="#2563EB" />
      <rect x="35" y="55" width="22" height="8" rx="2.5" fill="#2563EB" />
      {/* Action Buttons */}
      <circle cx="114" cy="49" r="4.5" fill="#FACC15" />
      <circle cx="123" cy="58" r="4.5" fill="#EF4444" />
      <circle cx="105" cy="58" r="4.5" fill="#3B82F6" />
      <circle cx="114" cy="67" r="4.5" fill="#10B981" />
      {/* Joysticks */}
      <circle cx="64" cy="70" r="8" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
      <circle cx="96" cy="70" r="8" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
      {/* Center Touchpad */}
      <rect x="68" y="38" width="24" height="12" rx="3" fill="#CBD5E1" />
    </g>
  </svg>
);

export const BannerTrophyBooksSVG: React.FC<{ className?: string }> = ({ className = 'w-28 h-24' }) => (
  <svg viewBox="0 0 160 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldCup" x1="40" y1="15" x2="100" y2="95" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="45%" stopColor="#FACC15" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    {/* Floating Stars */}
    <path d="M22 30 L25 36 L32 37 L27 42 L28 48 L22 45 L16 48 L17 42 L12 37 L19 36 Z" fill="#FACC15" />
    <path d="M138 22 L140 27 L146 28 L142 32 L143 37 L138 34 L133 37 L134 32 L130 28 L136 27 Z" fill="#FACC15" />
    {/* Books Stack */}
    <g transform="translate(82, 62)">
      <rect x="0" y="30" width="58" height="12" rx="3" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.5" />
      <rect x="4" y="33" width="48" height="6" rx="1.5" fill="#F8FAFC" />
      <rect x="4" y="18" width="52" height="12" rx="3" fill="#10B981" stroke="#6EE7B7" strokeWidth="1.5" />
      <rect x="8" y="21" width="42" height="6" rx="1.5" fill="#F8FAFC" />
      <rect x="2" y="6" width="54" height="12" rx="3" fill="#EF4444" stroke="#FCA5A5" strokeWidth="1.5" />
      <rect x="6" y="9" width="44" height="6" rx="1.5" fill="#F8FAFC" />
    </g>
    {/* Golden Trophy */}
    <g transform="translate(26, 14)">
      {/* Handles */}
      <path d="M14 20 C2 20 2 44 16 46" stroke="#FACC15" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M62 20 C74 20 74 44 60 46" stroke="#FACC15" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Cup Body */}
      <path d="M14 12 H62 V34 C62 52 50 62 38 62 C26 62 14 52 14 34 V12 Z" fill="url(#goldCup)" stroke="#FEF08A" strokeWidth="2" />
      {/* Star on Cup */}
      <path d="M38 24 L41 31 L49 32 L43 37 L45 45 L38 41 L31 45 L33 37 L27 32 L35 31 Z" fill="#FFFFFF" fillOpacity="0.85" />
      {/* Stem & Base */}
      <rect x="33" y="62" width="10" height="16" rx="2" fill="url(#goldCup)" />
      <rect x="22" y="76" width="32" height="8" rx="3" fill="#B45309" stroke="#FDE047" strokeWidth="1.5" />
      <rect x="16" y="84" width="44" height="10" rx="3" fill="#78350F" stroke="#FACC15" strokeWidth="1.5" />
    </g>
  </svg>
);

export const GameCardIllustration: React.FC<{ code: string; category: string }> = ({ code, category }) => {
  switch (code) {
    case 'A01': // Vòng quay may mắn
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgA01" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="50%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgA01)" />
          {/* Clouds & Rays */}
          <circle cx="160" cy="95" r="85" fill="#FFFFFF" fillOpacity="0.08" />
          <circle cx="160" cy="95" r="68" fill="#FFFFFF" fillOpacity="0.12" />
          <ellipse cx="50" cy="165" rx="55" ry="22" fill="#FFFFFF" fillOpacity="0.25" />
          <ellipse cx="270" cy="165" rx="60" ry="24" fill="#FFFFFF" fillOpacity="0.25" />
          {/* Stand */}
          <path d="M135 175 L160 120 L185 175 Z" fill="#F59E0B" stroke="#FEF08A" strokeWidth="3" />
          {/* Wheel */}
          <g transform="translate(160, 92)">
            <circle r="58" fill="#FACC15" stroke="#FFFFFF" strokeWidth="4" />
            <path d="M0 0 L0 -52 A52 52 0 0 1 45 -26 Z" fill="#EF4444" />
            <path d="M0 0 L45 -26 A52 52 0 0 1 45 26 Z" fill="#3B82F6" />
            <path d="M0 0 L45 26 A52 52 0 0 1 0 52 Z" fill="#10B981" />
            <path d="M0 0 L0 52 A52 52 0 0 1 -45 26 Z" fill="#F59E0B" />
            <path d="M0 0 L-45 26 A52 52 0 0 1 -45 -26 Z" fill="#8B5CF6" />
            <path d="M0 0 L-45 -26 A52 52 0 0 1 0 -52 Z" fill="#EC4899" />
            {/* Pegs */}
            <circle cx="0" cy="-54" r="3" fill="#FFF" />
            <circle cx="47" cy="-27" r="3" fill="#FFF" />
            <circle cx="47" cy="27" r="3" fill="#FFF" />
            <circle cx="0" cy="54" r="3" fill="#FFF" />
            <circle cx="-47" cy="27" r="3" fill="#FFF" />
            <circle cx="-47" cy="-27" r="3" fill="#FFF" />
            {/* Center Star */}
            <circle r="16" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="4" />
            <path d="M0 -9 L2.5 -3 L9 -2 L4 2.5 L5.5 9 L0 5.5 L-5.5 9 L-4 2.5 L-9 -2 L-2.5 -3 Z" fill="#F59E0B" />
          </g>
          {/* Pointer */}
          <path d="M152 24 H168 L160 42 Z" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
          {/* Sparkles */}
          <circle cx="75" cy="45" r="4" fill="#FDE047" />
          <circle cx="245" cy="50" r="5" fill="#FDE047" />
          <circle cx="90" cy="125" r="3" fill="#FFF" />
        </svg>
      );

    case 'A02': // Máy gắp thú
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgA02" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="55%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgA02)" />
          {/* Green Hills & Clouds */}
          <ellipse cx="70" cy="170" rx="90" ry="30" fill="#10B981" />
          <ellipse cx="250" cy="170" rx="95" ry="32" fill="#059669" />
          <circle cx="55" cy="50" r="18" fill="#FFF" fillOpacity="0.6" />
          <circle cx="265" cy="45" r="20" fill="#FFF" fillOpacity="0.6" />
          {/* Arcade Cabinet */}
          <rect x="95" y="18" width="130" height="148" rx="14" fill="#EC4899" stroke="#FFFFFF" strokeWidth="3" />
          <rect x="103" y="34" width="114" height="96" rx="8" fill="#E0F2FE" stroke="#F472B6" strokeWidth="2" />
          {/* Claw */}
          <line x1="160" y1="34" x2="160" y2="54" stroke="#475569" strokeWidth="4" />
          <path d="M144 68 C144 54 176 54 176 68" stroke="#64748B" strokeWidth="4" fill="none" />
          <circle cx="160" cy="54" r="6" fill="#F59E0B" />
          {/* Cute Teddy Bear inside */}
          <g transform="translate(160, 96)">
            <circle cx="-14" cy="-16" r="8" fill="#D97706" />
            <circle cx="14" cy="-16" r="8" fill="#D97706" />
            <circle cx="0" cy="-6" r="16" fill="#F59E0B" />
            <ellipse cx="0" cy="16" rx="18" ry="15" fill="#F59E0B" />
            <circle cx="-6" cy="-9" r="2.5" fill="#1E293B" />
            <circle cx="6" cy="-9" r="2.5" fill="#1E293B" />
            <ellipse cx="0" cy="-3" rx="6" ry="4" fill="#FEF3C7" />
            <circle cx="0" cy="-4" r="2" fill="#1E293B" />
          </g>
          {/* Colorful plush balls */}
          <circle cx="122" cy="118" r="10" fill="#F43F5E" />
          <circle cx="138" cy="122" r="9" fill="#FACC15" />
          <circle cx="185" cy="120" r="10" fill="#8B5CF6" />
          <circle cx="202" cy="118" r="9" fill="#10B981" />
          {/* Cabinet Bottom Controls */}
          <rect x="103" y="136" width="114" height="22" rx="6" fill="#DB2777" />
          <circle cx="135" cy="147" r="6" fill="#FACC15" />
          <rect x="165" y="142" width="28" height="10" rx="4" fill="#38BDF8" />
        </svg>
      );

    case 'A03': // Hộp quà bí ẩn
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgA03" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6D28D9" />
              <stop offset="55%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgA03)" />
          {/* Radial Glow */}
          <circle cx="160" cy="95" r="78" fill="#FDE047" fillOpacity="0.22" />
          <circle cx="160" cy="95" r="55" fill="#FEF08A" fillOpacity="0.28" />
          {/* 3D Gift Box */}
          <g transform="translate(112, 46)">
            {/* Box Body */}
            <rect x="8" y="34" width="80" height="66" rx="8" fill="#EF4444" stroke="#FCA5A5" strokeWidth="2" />
            <rect x="40" y="34" width="16" height="66" fill="#FACC15" />
            <rect x="8" y="60" width="80" height="14" fill="#FACC15" />
            {/* Box Lid */}
            <rect x="2" y="18" width="92" height="20" rx="6" fill="#DC2626" stroke="#FDE047" strokeWidth="2" />
            <rect x="40" y="18" width="16" height="20" fill="#FDE047" />
            {/* Ribbon Bow */}
            <path d="M48 18 C30 -4 14 10 34 20 Z" fill="#FACC15" stroke="#FEF08A" strokeWidth="2" />
            <path d="M48 18 C66 -4 82 10 62 20 Z" fill="#FACC15" stroke="#FEF08A" strokeWidth="2" />
            <circle cx="48" cy="16" r="6" fill="#F59E0B" />
          </g>
          {/* Floating Stars & Sparkles */}
          <circle cx="75" cy="50" r="5" fill="#FDE047" />
          <circle cx="245" cy="45" r="6" fill="#FDE047" />
          <circle cx="65" cy="120" r="4" fill="#F9A8D4" />
          <circle cx="250" cy="125" r="5" fill="#FDE047" />
        </svg>
      );

    case 'A04': // Bốc thăm thần kỳ
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgA04" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="55%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgA04)" />
          <circle cx="160" cy="84" r="70" fill="#38BDF8" fillOpacity="0.2" />
          {/* Base Stand */}
          <path d="M116 164 H204 L192 134 H128 Z" fill="#F59E0B" stroke="#FEF08A" strokeWidth="2.5" />
          <rect x="148" y="142" width="24" height="16" rx="4" fill="#1E293B" stroke="#FDE047" strokeWidth="2" />
          {/* Glass Sphere */}
          <circle cx="160" cy="80" r="54" fill="#E0F2FE" fillOpacity="0.28" stroke="#BAE6FD" strokeWidth="4" />
          {/* Lottery Balls Inside */}
          <circle cx="138" cy="98" r="11" fill="#EF4444" />
          <circle cx="160" cy="104" r="11" fill="#FACC15" />
          <circle cx="182" cy="96" r="11" fill="#10B981" />
          <circle cx="128" cy="78" r="11" fill="#EC4899" />
          <circle cx="150" cy="82" r="11" fill="#3B82F6" />
          <circle cx="172" cy="80" r="11" fill="#A855F7" />
          <circle cx="192" cy="76" r="10" fill="#F97316" />
          <circle cx="144" cy="60" r="10" fill="#34D399" />
          <circle cx="168" cy="58" r="11" fill="#FDE047" />
          {/* Glass Highlight */}
          <path d="M122 52 A42 42 0 0 1 175 36" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
      );

    case 'A05': // Vịt đua
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skyA05" x1="0" y1="0" x2="0" y2="95" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#BAE6FD" />
            </linearGradient>
            <linearGradient id="waterA05" x1="0" y1="85" x2="0" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
          </defs>
          <rect width="320" height="95" fill="url(#skyA05)" />
          <rect y="85" width="320" height="95" fill="url(#waterA05)" />
          {/* Distant Bank */}
          <path d="M0 88 Q80 68 160 86 T320 84 V96 H0 Z" fill="#10B981" />
          {/* Water Waves */}
          <path d="M20 148 Q50 140 80 148 T140 148 T200 148 T260 148" stroke="#7DD3FC" strokeWidth="3" fill="none" />
          {/* Lead Yellow Duck */}
          <g transform="translate(115, 65)">
            {/* Body */}
            <ellipse cx="36" cy="56" rx="34" ry="22" fill="#FACC15" stroke="#F59E0B" strokeWidth="2" />
            <path d="M8 46 Q2 32 16 42 Z" fill="#FACC15" />
            {/* Wing */}
            <ellipse cx="34" cy="56" rx="16" ry="10" fill="#EAB308" />
            {/* Head */}
            <circle cx="56" cy="26" r="20" fill="#FACC15" stroke="#F59E0B" strokeWidth="2" />
            {/* Cool Goggles */}
            <rect x="44" y="16" width="24" height="10" rx="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
            {/* Beak */}
            <path d="M72 24 C86 24 86 34 72 34 Z" fill="#F97316" />
          </g>
          {/* Second Duck */}
          <g transform="translate(215, 78) scale(0.7)">
            <ellipse cx="36" cy="56" rx="34" ry="22" fill="#FACC15" />
            <circle cx="56" cy="26" r="20" fill="#FACC15" />
            <path d="M72 24 C86 24 86 34 72 34 Z" fill="#F97316" />
            <circle cx="60" cy="22" r="3" fill="#1E293B" />
          </g>
        </svg>
      );

    case 'A06': // Đua ngựa
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="105" fill="#60A5FA" />
          <rect y="100" width="320" height="45" fill="#22C55E" />
          <rect y="140" width="320" height="40" fill="#D97706" />
          {/* White Fence */}
          <g stroke="#FFFFFF" strokeWidth="3">
            <line x1="0" y1="108" x2="320" y2="108" />
            <line x1="0" y1="122" x2="320" y2="122" />
            <line x1="30" y1="98" x2="30" y2="132" />
            <line x1="80" y1="98" x2="80" y2="132" />
            <line x1="130" y1="98" x2="130" y2="132" />
            <line x1="180" y1="98" x2="180" y2="132" />
            <line x1="230" y1="98" x2="230" y2="132" />
            <line x1="280" y1="98" x2="280" y2="132" />
          </g>
          {/* Racing Horse & Jockey */}
          <g transform="translate(88, 42)">
            {/* Tail */}
            <path d="M18 58 Q-5 65 4 80" stroke="#451A03" strokeWidth="7" strokeLinecap="round" fill="none" />
            {/* Legs */}
            <line x1="28" y1="78" x2="10" y2="108" stroke="#92400E" strokeWidth="6" strokeLinecap="round" />
            <line x1="42" y1="78" x2="34" y2="110" stroke="#78350F" strokeWidth="6" strokeLinecap="round" />
            <line x1="88" y1="76" x2="112" y2="104" stroke="#92400E" strokeWidth="6" strokeLinecap="round" />
            <line x1="98" y1="76" x2="126" y2="96" stroke="#78350F" strokeWidth="6" strokeLinecap="round" />
            {/* Horse Body */}
            <ellipse cx="64" cy="68" rx="44" ry="20" fill="#B45309" />
            {/* Horse Neck & Head */}
            <path d="M92 60 L118 28 L136 36 L128 48 L104 72 Z" fill="#B45309" />
            {/* Jockey */}
            <circle cx="76" cy="24" r="9" fill="#FDE047" />
            <path d="M68 20 C68 12 86 12 86 20 Z" fill="#EF4444" />
            <path d="M58 48 L74 32 L92 44 L74 58 Z" fill="#EF4444" />
          </g>
        </svg>
      );

    case 'A07': // Tên lửa chọn bạn
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="spaceA07" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="55%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#4338CA" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#spaceA07)" />
          {/* Stars & Planet */}
          <circle cx="55" cy="42" r="2" fill="#FFF" />
          <circle cx="95" cy="28" r="3" fill="#FDE047" />
          <circle cx="265" cy="115" r="24" fill="#F59E0B" />
          <ellipse cx="265" cy="115" rx="38" ry="8" transform="rotate(-20 265 115)" stroke="#FEF08A" strokeWidth="3" fill="none" />
          {/* Rocket Launching */}
          <g transform="translate(155, 88) rotate(35)">
            {/* Flame */}
            <path d="M-14 42 L0 82 L14 42 Z" fill="#F97316" />
            <path d="M-8 42 L0 68 L8 42 Z" fill="#FDE047" />
            {/* Fins */}
            <path d="M-18 22 L-34 44 L-14 40 Z" fill="#EF4444" />
            <path d="M18 22 L34 44 L14 40 Z" fill="#EF4444" />
            {/* Rocket Body */}
            <path d="M0 -52 C22 -24 22 20 16 42 H-16 C-22 20 -22 -24 0 -52 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
            <path d="M0 -52 C11 -36 15 -22 16 -14 H-16 C-15 -22 -11 -36 0 -52 Z" fill="#EF4444" />
            {/* Window */}
            <circle cx="0" cy="4" r="10" fill="#38BDF8" stroke="#1D4ED8" strokeWidth="3" />
          </g>
        </svg>
      );

    case 'A08': // Bóng bay may mắn
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skyA08" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="55%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#skyA08)" />
          <ellipse cx="60" cy="155" rx="65" ry="25" fill="#FFF" fillOpacity="0.35" />
          <ellipse cx="260" cy="155" rx="70" ry="26" fill="#FFF" fillOpacity="0.35" />
          {/* Balloon Strings */}
          <path d="M115 112 Q125 145 145 175" stroke="#FFF" strokeWidth="2" fill="none" />
          <path d="M160 96 Q160 135 160 175" stroke="#FFF" strokeWidth="2" fill="none" />
          <path d="M205 110 Q195 145 175 175" stroke="#FFF" strokeWidth="2" fill="none" />
          {/* Red Balloon */}
          <ellipse cx="115" cy="76" rx="26" ry="32" fill="#EF4444" />
          <circle cx="106" cy="64" r="5" fill="#FFF" fillOpacity="0.45" />
          {/* Yellow Center Balloon */}
          <ellipse cx="160" cy="58" rx="28" ry="35" fill="#FACC15" />
          <circle cx="150" cy="45" r="6" fill="#FFF" fillOpacity="0.5" />
          {/* Green/Cyan Balloon */}
          <ellipse cx="205" cy="74" rx="26" ry="32" fill="#10B981" />
          <circle cx="196" cy="62" r="5" fill="#FFF" fillOpacity="0.45" />
        </svg>
      );

    case 'A09': // Xúc xắc chọn tên
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgA09" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E1B4B" />
              <stop offset="55%" stopColor="#312E81" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgA09)" />
          <circle cx="160" cy="90" r="70" fill="#818CF8" fillOpacity="0.18" />
          {/* Die 1 */}
          <g transform="translate(88, 42) rotate(-14)">
            <rect width="68" height="68" rx="14" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="3" />
            <circle cx="20" cy="20" r="6" fill="#EF4444" />
            <circle cx="48" cy="20" r="6" fill="#EF4444" />
            <circle cx="34" cy="34" r="6" fill="#EF4444" />
            <circle cx="20" cy="48" r="6" fill="#EF4444" />
            <circle cx="48" cy="48" r="6" fill="#EF4444" />
          </g>
          {/* Die 2 */}
          <g transform="translate(166, 56) rotate(16)">
            <rect width="68" height="68" rx="14" fill="#FACC15" stroke="#FEF08A" strokeWidth="3" />
            <circle cx="20" cy="20" r="6" fill="#1E293B" />
            <circle cx="48" cy="20" r="6" fill="#1E293B" />
            <circle cx="20" cy="34" r="6" fill="#1E293B" />
            <circle cx="48" cy="34" r="6" fill="#1E293B" />
            <circle cx="20" cy="48" r="6" fill="#1E293B" />
            <circle cx="48" cy="48" r="6" fill="#1E293B" />
          </g>
        </svg>
      );

    case 'A10': // Thẻ bài bí mật
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgA10" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B0764" />
              <stop offset="50%" stopColor="#6B21A8" />
              <stop offset="100%" stopColor="#9333EA" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgA10)" />
          {/* Left Card */}
          <g transform="translate(82, 36) rotate(-16)">
            <rect width="64" height="96" rx="8" fill="#2563EB" stroke="#FDE047" strokeWidth="3" />
            <circle cx="32" cy="48" r="14" fill="#60A5FA" fillOpacity="0.4" />
          </g>
          {/* Right Card */}
          <g transform="translate(174, 36) rotate(16)">
            <rect width="64" height="96" rx="8" fill="#EC4899" stroke="#FDE047" strokeWidth="3" />
            <circle cx="32" cy="48" r="14" fill="#F472B6" fillOpacity="0.4" />
          </g>
          {/* Center Glowing Card */}
          <g transform="translate(126, 26)">
            <rect width="68" height="104" rx="10" fill="#FACC15" stroke="#FFFFFF" strokeWidth="3" />
            <rect x="6" y="6" width="56" height="92" rx="6" fill="#7C3AED" />
            <path d="M34 30 L39 43 L53 44 L42 53 L45 67 L34 59 L23 67 L26 53 L15 44 L29 43 Z" fill="#FDE047" />
          </g>
        </svg>
      );

    case 'A11': // Bánh xe số
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgA11" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F766E" />
              <stop offset="50%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgA11)" />
          <g transform="translate(160, 92)">
            <circle r="60" fill="#1E293B" stroke="#FACC15" strokeWidth="5" />
            <circle r="46" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="2" />
            <text x="0" y="-26" textAnchor="middle" fill="#FFF" fontSize="13" fontWeight="bold">01</text>
            <text x="30" y="5" textAnchor="middle" fill="#FFF" fontSize="13" fontWeight="bold">08</text>
            <text x="0" y="36" textAnchor="middle" fill="#FFF" fontSize="13" fontWeight="bold">15</text>
            <text x="-30" y="5" textAnchor="middle" fill="#FFF" fontSize="13" fontWeight="bold">24</text>
            <circle r="16" fill="#FACC15" stroke="#FFFFFF" strokeWidth="3" />
          </g>
          <path d="M152 20 H168 L160 38 Z" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
        </svg>
      );

    case 'A12': // Robot chọn bạn
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgA12" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="55%" stopColor="#0369A1" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgA12)" />
          {/* Cute AI Robot */}
          <g transform="translate(116, 26)">
            <line x1="44" y1="0" x2="44" y2="16" stroke="#38BDF8" strokeWidth="4" />
            <circle cx="44" cy="0" r="6" fill="#FACC15" />
            {/* Head */}
            <rect x="12" y="16" width="64" height="50" rx="16" fill="#F8FAFC" stroke="#38BDF8" strokeWidth="3" />
            {/* Screen Face */}
            <rect x="20" y="26" width="48" height="30" rx="8" fill="#0F172A" />
            <circle cx="34" cy="41" r="5" fill="#38BDF8" />
            <circle cx="54" cy="41" r="5" fill="#38BDF8" />
            <path d="M36 49 Q44 54 52 49" stroke="#34D399" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Body */}
            <rect x="16" y="72" width="56" height="52" rx="14" fill="#E2E8F0" stroke="#38BDF8" strokeWidth="3" />
            <rect x="26" y="84" width="36" height="24" rx="4" fill="#0284C7" />
            <text x="44" y="100" textAnchor="middle" fill="#FEF08A" fontSize="10" fontWeight="bold">SCAN</text>
          </g>
        </svg>
      );

    case 'B01': // Ai nhanh hơn (EDU Speed Challenge)
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgB01" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E1B4B" />
              <stop offset="50%" stopColor="#1D4ED8" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
            <linearGradient id="buzzerRedB01" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="50%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgB01)" />
          {/* Speed Rays */}
          <circle cx="160" cy="105" r="78" fill="#38BDF8" fillOpacity="0.12" />
          <circle cx="160" cy="105" r="54" fill="#FACC15" fillOpacity="0.16" />
          {/* Stopwatch Badge Top Left */}
          <g transform="translate(56, 46)">
            <circle r="22" fill="#0F172A" stroke="#38BDF8" strokeWidth="3" />
            <text x="0" y="5" textAnchor="middle" fill="#FDE047" fontSize="12" fontWeight="900">15s</text>
          </g>
          {/* Scoreboard Badge Top Right */}
          <g transform="translate(230, 30)">
            <rect x="0" y="0" width="56" height="32" rx="8" fill="#0F172A" stroke="#FACC15" strokeWidth="2.5" />
            <text x="28" y="20" textAnchor="middle" fill="#34D399" fontSize="12" fontWeight="900">+10Đ</text>
          </g>
          {/* Central 3D Game Show Buzzer Podium */}
          <g transform="translate(160, 122)">
            <path d="M-54 44 L-40 6 L40 6 L54 44 Z" fill="#1E293B" stroke="#38BDF8" strokeWidth="2.5" />
            <ellipse cx="0" cy="6" rx="44" ry="12" fill="#CBD5E1" stroke="#FFFFFF" strokeWidth="2" />
            {/* Glowing Red Buzzer Dome */}
            <path d="M-32 4 C-32 -24 32 -24 32 4 Z" fill="url(#buzzerRedB01)" stroke="#FEF08A" strokeWidth="2.5" />
            <ellipse cx="-10" cy="-8" rx="10" ry="4" fill="#FFFFFF" fillOpacity="0.45" />
            {/* Lightning Bolt Icon */}
            <path d="M4 -54 L-12 -26 L0 -26 L-6 -4 L16 -34 L2 -34 Z" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1.5" />
          </g>
        </svg>
      );

    case 'B02': // Đoán hình bí mật (EDU Mystery Picture)
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgB02" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="50%" stopColor="#0369A1" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgB02)" />
          {/* Picture Frame */}
          <rect x="64" y="20" width="192" height="140" rx="14" fill="#1E293B" stroke="#FACC15" strokeWidth="4" />
          {/* Revealed Landscape behind opened tiles */}
          <rect x="74" y="30" width="172" height="120" rx="8" fill="#38BDF8" />
          <circle cx="195" cy="60" r="18" fill="#FDE047" />
          <path d="M74 135 L125 85 L168 125 L205 95 L246 135 V150 H74 Z" fill="#10B981" />
          {/* Numbered Cover Tiles (Some closed, some flipping open) */}
          <rect x="74" y="30" width="56" height="58" rx="6" fill="#1E3A8A" stroke="#93C5FD" strokeWidth="2" />
          <text x="102" y="65" textAnchor="middle" fill="#FFF" fontSize="18" fontWeight="900">1</text>
          <rect x="132" y="30" width="56" height="58" rx="6" fill="#3B82F6" stroke="#93C5FD" strokeWidth="2" />
          <text x="160" y="65" textAnchor="middle" fill="#FFF" fontSize="18" fontWeight="900">2</text>
          <rect x="74" y="92" width="56" height="58" rx="6" fill="#2563EB" stroke="#93C5FD" strokeWidth="2" />
          <text x="102" y="127" textAnchor="middle" fill="#FFF" fontSize="18" fontWeight="900">4</text>
          <rect x="190" y="92" width="56" height="58" rx="6" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="2" />
          <text x="218" y="127" textAnchor="middle" fill="#FFF" fontSize="18" fontWeight="900">6</text>
          {/* Magnifying Glass & Question Mark Badge */}
          <g transform="translate(238, 46)">
            <circle cx="0" cy="0" r="22" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="3" />
            <text x="0" y="7" textAnchor="middle" fill="#FFF" fontSize="22" fontWeight="900">?</text>
          </g>
        </svg>
      );

    case 'B03': // Lật ô chữ bí mật (EDU Crossword Challenge)
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgB03" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#09152B" />
              <stop offset="55%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgB03)" />
          {/* Crossword Rows & Golden Vertical Keyword Column */}
          <g transform="translate(52, 26)">
            {/* Row 1 */}
            <rect x="28" y="0" width="28" height="28" rx="5" fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
            <rect x="60" y="0" width="28" height="28" rx="5" fill="#2563EB" stroke="#93C5FD" strokeWidth="2" />
            <rect x="92" y="0" width="28" height="28" rx="5" fill="#FACC15" stroke="#FEF08A" strokeWidth="2.5" />
            <rect x="124" y="0" width="28" height="28" rx="5" fill="#2563EB" stroke="#93C5FD" strokeWidth="2" />
            <rect x="156" y="0" width="28" height="28" rx="5" fill="#2563EB" stroke="#93C5FD" strokeWidth="2" />
            <text x="74" y="19" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="900">M</text>
            <text x="106" y="19" textAnchor="middle" fill="#0F172A" fontSize="14" fontWeight="900">A</text>
            <text x="138" y="19" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="900">N</text>
            <text x="170" y="19" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="900">G</text>
            {/* Row 2 */}
            <rect x="0" y="34" width="28" height="28" rx="5" fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
            <rect x="32" y="34" width="28" height="28" rx="5" fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
            <rect x="64" y="34" width="28" height="28" rx="5" fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
            <rect x="92" y="34" width="28" height="28" rx="5" fill="#F59E0B" stroke="#FEF08A" strokeWidth="2.5" />
            <rect x="124" y="34" width="28" height="28" rx="5" fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
            <text x="106" y="53" textAnchor="middle" fill="#0F172A" fontSize="14" fontWeight="900">I</text>
            {/* Row 3 */}
            <rect x="28" y="68" width="28" height="28" rx="5" fill="#059669" stroke="#6EE7B7" strokeWidth="2" />
            <rect x="60" y="68" width="28" height="28" rx="5" fill="#059669" stroke="#6EE7B7" strokeWidth="2" />
            <rect x="92" y="68" width="28" height="28" rx="5" fill="#FACC15" stroke="#FEF08A" strokeWidth="2.5" />
            <rect x="124" y="68" width="28" height="28" rx="5" fill="#059669" stroke="#6EE7B7" strokeWidth="2" />
            <rect x="156" y="68" width="28" height="28" rx="5" fill="#059669" stroke="#6EE7B7" strokeWidth="2" />
            <rect x="188" y="68" width="28" height="28" rx="5" fill="#059669" stroke="#6EE7B7" strokeWidth="2" />
            <text x="42" y="87" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="900">T</text>
            <text x="74" y="87" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="900">R</text>
            <text x="106" y="87" textAnchor="middle" fill="#0F172A" fontSize="14" fontWeight="900">I</text>
            <text x="138" y="87" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="900">T</text>
            <text x="170" y="87" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="900">U</text>
            <text x="202" y="87" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="900">E</text>
            {/* Row 4 */}
            <rect x="60" y="102" width="28" height="28" rx="5" fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
            <rect x="92" y="102" width="28" height="28" rx="5" fill="#F59E0B" stroke="#FEF08A" strokeWidth="2.5" />
            <rect x="124" y="102" width="28" height="28" rx="5" fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
            <rect x="156" y="102" width="28" height="28" rx="5" fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
            <text x="106" y="121" textAnchor="middle" fill="#0F172A" fontSize="14" fontWeight="900">?</text>
          </g>
        </svg>
      );

    case 'B04': // Giải mã bí mật (EDU Secret Code Adventure)
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgB04" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#09152B" />
              <stop offset="50%" stopColor="#1E1B4B" />
              <stop offset="100%" stopColor="#0F766E" />
            </linearGradient>
            <linearGradient id="goldB04" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#CA8A04" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgB04)" />
          {/* Glowing Portal Halo */}
          <circle cx="160" cy="95" r="72" fill="#14B8A6" fillOpacity="0.14" />
          <circle cx="160" cy="95" r="50" fill="#FACC15" fillOpacity="0.16" />
          {/* Treasure Chest Base */}
          <g transform="translate(86, 44)">
            {/* Chest Lid */}
            <path d="M8 38 C8 14 140 14 140 38 Z" fill="#78350F" stroke="url(#goldB04)" strokeWidth="4" />
            {/* Chest Body */}
            <rect x="8" y="38" width="132" height="68" rx="10" fill="#451A03" stroke="url(#goldB04)" strokeWidth="4" />
            {/* Gold Straps */}
            <rect x="34" y="20" width="12" height="86" fill="url(#goldB04)" />
            <rect x="102" y="20" width="12" height="86" fill="url(#goldB04)" />
            {/* Rotary Code Lock Panel */}
            <rect x="24" y="48" width="100" height="42" rx="8" fill="#0F172A" stroke="#38BDF8" strokeWidth="2.5" />
            {/* 4 Code Dials */}
            <rect x="31" y="54" width="19" height="30" rx="4" fill="#1E293B" stroke="#FACC15" strokeWidth="1.5" />
            <text x="40.5" y="74" textAnchor="middle" fill="#FEF08A" fontSize="15" fontWeight="900">2</text>
            <rect x="54" y="54" width="19" height="30" rx="4" fill="#1E293B" stroke="#FACC15" strokeWidth="1.5" />
            <text x="63.5" y="74" textAnchor="middle" fill="#FEF08A" fontSize="15" fontWeight="900">5</text>
            <rect x="77" y="54" width="19" height="30" rx="4" fill="#1E293B" stroke="#FACC15" strokeWidth="1.5" />
            <text x="86.5" y="74" textAnchor="middle" fill="#FEF08A" fontSize="15" fontWeight="900">1</text>
            <rect x="100" y="54" width="19" height="30" rx="4" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="1.5" />
            <text x="109.5" y="74" textAnchor="middle" fill="#0F172A" fontSize="15" fontWeight="900">8</text>
          </g>
          {/* Floating Rune Clue Stones */}
          <g transform="translate(32, 42)">
            <polygon points="18,0 36,12 30,34 6,34 0,12" fill="#0F766E" stroke="#5EEAD4" strokeWidth="2" />
            <text x="18" y="23" textAnchor="middle" fill="#FEF08A" fontSize="13" fontWeight="900">#1</text>
          </g>
          <g transform="translate(252, 42)">
            <polygon points="18,0 36,12 30,34 6,34 0,12" fill="#6D28D9" stroke="#C4B5FD" strokeWidth="2" />
            <text x="18" y="23" textAnchor="middle" fill="#FEF08A" fontSize="13" fontWeight="900">#4</text>
          </g>
        </svg>
      );

    case 'B05': // Đúng hay sai (EDU True or False Challenge)
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgB05" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#09152B" />
              <stop offset="50%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="trueGreenB05" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="falseRedB05" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgB05)" />
          {/* Split Arena Glow */}
          <circle cx="92" cy="95" r="68" fill="#10B981" fillOpacity="0.16" />
          <circle cx="228" cy="95" r="68" fill="#F43F5E" fillOpacity="0.16" />
          {/* Top Statement Banner */}
          <rect x="44" y="18" width="232" height="36" rx="10" fill="#1E293B" stroke="#38BDF8" strokeWidth="2" />
          <text x="160" y="40" textAnchor="middle" fill="#F8FAFC" fontSize="12" fontWeight="900">
            NHẬN ĐỊNH: a) ĐÚNG · b) SAI
          </text>
          {/* Left TRUE Podium Button */}
          <g transform="translate(34, 66)">
            <rect width="114" height="88" rx="16" fill="url(#trueGreenB05)" stroke="#A7F3D0" strokeWidth="3" />
            <circle cx="57" cy="34" r="18" fill="#064E3B" fillOpacity="0.35" />
            <path d="M48 34 L54 40 L67 27" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <text x="57" y="72" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="900">
              ĐÚNG
            </text>
          </g>
          {/* Right FALSE Podium Button */}
          <g transform="translate(172, 66)">
            <rect width="114" height="88" rx="16" fill="url(#falseRedB05)" stroke="#FECDD3" strokeWidth="3" />
            <circle cx="57" cy="34" r="18" fill="#881337" fillOpacity="0.35" />
            <path d="M49 26 L65 42 M65 26 L49 42" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
            <text x="57" y="72" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="900">
              SAI
            </text>
          </g>
          {/* Center VS / Timer Badge */}
          <g transform="translate(160, 110)">
            <circle r="20" fill="#0F172A" stroke="#FACC15" strokeWidth="3" />
            <text x="0" y="5" textAnchor="middle" fill="#FEF08A" fontSize="12" fontWeight="900">10s</text>
          </g>
        </svg>
      );

    case 'B06': // Đuổi hình bắt chữ (EDU Picture Word Challenge)
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgB06" x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="50%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#4C1D95" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#bgB06)" />
          {/* Left Visual Clue Card (Fire / Nhiệt) */}
          <g transform="translate(36, 22)">
            <rect width="102" height="84" rx="14" fill="#1E293B" stroke="#38BDF8" strokeWidth="3" />
            <circle cx="51" cy="42" r="26" fill="#FEF08A" fillOpacity="0.18" />
            <path d="M51 16 C65 32 72 44 64 58 C59 66 43 66 38 58 C30 44 37 32 51 16 Z" fill="#F97316" stroke="#FACC15" strokeWidth="2" />
            <path d="M51 30 C58 40 60 48 56 55 C53 60 49 60 46 55 C42 48 44 40 51 30 Z" fill="#FEF08A" />
          </g>
          {/* Plus Sign Badge */}
          <g transform="translate(160, 64)">
            <circle r="15" fill="#FACC15" stroke="#FFFFFF" strokeWidth="2.5" />
            <path d="M-6 0 H6 M0 -6 V6" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          {/* Right Visual Clue Card (Ruler / Độ) */}
          <g transform="translate(182, 22)">
            <rect width="102" height="84" rx="14" fill="#1E293B" stroke="#C084FC" strokeWidth="3" />
            <rect x="20" y="32" width="62" height="22" rx="4" fill="#FACC15" stroke="#FEF08A" strokeWidth="2" />
            <line x1="30" y1="32" x2="30" y2="42" stroke="#0F172A" strokeWidth="2" />
            <line x1="42" y1="32" x2="42" y2="46" stroke="#0F172A" strokeWidth="2" />
            <line x1="54" y1="32" x2="54" y2="42" stroke="#0F172A" strokeWidth="2" />
            <line x1="66" y1="32" x2="66" y2="46" stroke="#0F172A" strokeWidth="2" />
          </g>
          {/* Bottom Letter Tiles Row */}
          <g transform="translate(46, 122)">
            {['N', 'H', 'I', 'Ệ', 'T', 'Đ', 'Ộ'].map((ch, idx) => (
              <g key={idx} transform={`translate(${idx * 33}, 0)`}>
                <rect width="29" height="36" rx="7" fill="#FACC15" stroke="#FFFFFF" strokeWidth="2" />
                <text x="14.5" y="24" textAnchor="middle" fill="#0F172A" fontSize="15" fontWeight="900">
                  {ch}
                </text>
              </g>
            ))}
          </g>
        </svg>
      );

    default: {
      // Rich thematic illustrations for B, C, D, E, F categories
      const palettes: Record<string, { c1: string; c2: string; accent: string }> = {
        warmup: { c1: '#059669', c2: '#10B981', accent: '#FDE047' },
        reinforce: { c1: '#D97706', c2: '#F59E0B', accent: '#FEF08A' },
        competition: { c1: '#DC2626', c2: '#F97316', accent: '#FACC15' },
        movement: { c1: '#DB2777', c2: '#EC4899', accent: '#FDE047' },
        puzzle: { c1: '#6D28D9', c2: '#8B5CF6', accent: '#38BDF8' },
      };
      const pal = palettes[category] || { c1: '#1D4ED8', c2: '#3B82F6', accent: '#FACC15' };
      return (
        <svg viewBox="0 0 320 180" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`grad_${code}`} x1="0" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={pal.c1} />
              <stop offset="100%" stopColor={pal.c2} />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill={`url(#grad_${code})`} />
          <circle cx="160" cy="90" r="68" fill="#FFFFFF" fillOpacity="0.12" />
          <circle cx="160" cy="90" r="46" fill="#FFFFFF" fillOpacity="0.18" />
          <rect x="122" y="54" width="76" height="72" rx="18" fill="#FFFFFF" fillOpacity="0.92" />
          <text x="160" y="98" textAnchor="middle" fill={pal.c1} fontSize="24" fontWeight="900">
            {code}
          </text>
          <circle cx="80" cy="48" r="5" fill={pal.accent} />
          <circle cx="245" cy="132" r="6" fill={pal.accent} />
        </svg>
      );
    }
  }
};
