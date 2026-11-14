import React from 'react';
import { CallGameMode } from './studentCallRules';

interface GameCardArtProps {
  mode: CallGameMode;
  className?: string;
}

/**
 * Custom illustrated artwork for each of the 10 classroom call-game cards
 * and stage graphics (Crisp SVG, zero external asset dependencies).
 */
export const GameCardArtwork: React.FC<GameCardArtProps> = ({ mode, className = 'w-16 h-16' }) => {
  switch (mode) {
    case 'wheel':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <circle cx="40" cy="42" r="30" fill="#F59E0B" />
          <circle cx="40" cy="42" r="26" fill="#082B52" />
          <path d="M40 42 L40 16 A26 26 0 0 1 62.5 29 Z" fill="#2563EB" />
          <path d="M40 42 L62.5 29 A26 26 0 0 1 62.5 55 Z" fill="#10B981" />
          <path d="M40 42 L62.5 55 A26 26 0 0 1 40 68 Z" fill="#F59E0B" />
          <path d="M40 42 L40 68 A26 26 0 0 1 17.5 55 Z" fill="#EF4444" />
          <path d="M40 42 L17.5 55 A26 26 0 0 1 17.5 29 Z" fill="#8B5CF6" />
          <path d="M40 42 L17.5 29 A26 26 0 0 1 40 16 Z" fill="#06B6D4" />
          <circle cx="40" cy="42" r="7" fill="#082B52" stroke="#FBBF24" strokeWidth="2.5" />
          <polygon points="40,19 34,7 46,7" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1.5" />
        </svg>
      );

    case 'gift_box':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <rect x="16" y="34" width="48" height="34" rx="5" fill="#EF4444" />
          <rect x="12" y="25" width="56" height="12" rx="4" fill="#F87171" />
          <rect x="36" y="25" width="8" height="43" fill="#FBBF24" />
          <rect x="16" y="45" width="48" height="7" fill="#FBBF24" />
          <path d="M40 25 C31 13, 21 18, 28 25 Z" fill="#FDE047" stroke="#D97706" strokeWidth="1.5" />
          <path d="M40 25 C49 13, 59 18, 52 25 Z" fill="#FDE047" stroke="#D97706" strokeWidth="1.5" />
          <circle cx="40" cy="25" r="4" fill="#F59E0B" />
        </svg>
      );

    case 'cards':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <g transform="rotate(-14 34 44)">
            <rect x="18" y="18" width="32" height="46" rx="5" fill="#1E40AF" stroke="#FFFFFF" strokeWidth="2" />
            <rect x="23" y="23" width="22" height="36" rx="3" fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeDasharray="3 2" />
          </g>
          <g transform="rotate(10 46 42)">
            <rect x="30" y="16" width="34" height="48" rx="5" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="2.5" />
            <polygon points="47,29 50,36 58,36 52,41 54,48 47,44 40,48 42,41 36,36 44,36" fill="#F59E0B" />
          </g>
        </svg>
      );

    case 'flying_envelope':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <path d="M14 27 C22 18, 34 19, 40 27 C34 29, 25 32, 14 27 Z" fill="#FFFFFF" stroke="#93C5FD" strokeWidth="1.5" />
          <path d="M66 24 C58 15, 46 17, 41 26 C47 28, 56 30, 66 24 Z" fill="#FFFFFF" stroke="#93C5FD" strokeWidth="1.5" />
          <rect x="16" y="30" width="48" height="33" rx="5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
          <path d="M16 32 L40 50 L64 32" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="40" cy="48" r="6" fill="#DC2626" />
          <circle cx="40" cy="48" r="2.5" fill="#FCA5A5" />
        </svg>
      );

    case 'rocket':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <circle cx="18" cy="20" r="2" fill="#FDE047" />
          <circle cx="62" cy="18" r="2.5" fill="#93C5FD" />
          <circle cx="64" cy="48" r="2" fill="#FDE047" />
          <path d="M40 12 C50 22, 53 38, 50 52 L30 52 C27 38, 30 22, 40 12 Z" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
          <path d="M40 12 C45 18, 48 24, 49 28 L31 28 C32 24, 35 18, 40 12 Z" fill="#EF4444" />
          <circle cx="40" cy="37" r="6" fill="#38BDF8" stroke="#1E3A8A" strokeWidth="2" />
          <path d="M30 42 L20 55 L30 52 Z" fill="#F59E0B" />
          <path d="M50 42 L60 55 L50 52 Z" fill="#F59E0B" />
          <path d="M34 52 L40 68 L46 52 Z" fill="#F97316" />
          <path d="M37 52 L40 63 L43 52 Z" fill="#FDE047" />
        </svg>
      );

    case 'magic_sphere':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <circle cx="40" cy="36" r="24" fill="#EFF6FF" stroke="#2563EB" strokeWidth="2.5" />
          <circle cx="32" cy="31" r="6" fill="#EF4444" />
          <circle cx="47" cy="29" r="6" fill="#10B981" />
          <circle cx="38" cy="43" r="6.5" fill="#F59E0B" />
          <circle cx="51" cy="42" r="5" fill="#8B5CF6" />
          <rect x="26" y="60" width="28" height="8" rx="3" fill="#082B52" />
        </svg>
      );

    case 'call_pair':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <circle cx="24" cy="30" r="9" fill="#2563EB" />
          <path d="M12 56 C12 45, 36 45, 36 56 Z" fill="#3B82F6" />
          <circle cx="56" cy="30" r="9" fill="#7C3AED" />
          <path d="M44 56 C44 45, 68 45, 68 56 Z" fill="#8B5CF6" />
          <circle cx="40" cy="42" r="10" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
          <text x="40" y="45.5" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">VS</text>
        </svg>
      );

    case 'call_trio':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <circle cx="21" cy="34" r="7.5" fill="#059669" />
          <path d="M11 56 C11 47, 31 47, 31 56 Z" fill="#10B981" />
          <circle cx="59" cy="34" r="7.5" fill="#D97706" />
          <path d="M49 56 C49 47, 69 47, 69 56 Z" fill="#F59E0B" />
          <circle cx="40" cy="26" r="9" fill="#006BFF" stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M27 56 C27 43, 53 43, 53 56 Z" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
        </svg>
      );

    case 'speed_timer':
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <rect x="34" y="11" width="12" height="5" rx="2" fill="#082B52" />
          <circle cx="40" cy="43" r="24" fill="#FFFBEB" stroke="#D97706" strokeWidth="3" />
          <circle cx="40" cy="43" r="18" fill="#FFFFFF" stroke="#FDE68A" strokeWidth="2" />
          <line x1="40" y1="43" x2="40" y2="29" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="43" x2="51" y2="47" stroke="#082B52" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="43" r="3" fill="#082B52" />
        </svg>
      );

    case 'star_of_hope':
    default:
      return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
          <circle cx="40" cy="40" r="26" fill="#FEF3C7" />
          <polygon
            points="40,14 47,30 65,32 51,44 55,62 40,53 25,62 29,44 15,32 33,30"
            fill="#F59E0B"
            stroke="#B45309"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polygon
            points="40,22 44,32 55,33 47,40 49,51 40,46 31,51 33,40 25,33 36,32"
            fill="#FDE047"
          />
        </svg>
      );
  }
};
