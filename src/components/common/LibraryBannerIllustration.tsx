import React from 'react';

export const LibraryBannerIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative w-full h-full flex items-center justify-end select-none ${className}`}>
      <svg
        viewBox="0 0 460 210"
        className="h-full w-auto max-h-[185px] object-contain drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="planeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="bookBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="bookOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="bookYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id="cupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="rulerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
          <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>

        {/* Paper airplane flight dashed trail */}
        <path
          d="M 120,185 C 130,120 180,95 240,110 C 290,120 310,75 350,55"
          stroke="#0284c7"
          strokeWidth="2.2"
          strokeDasharray="5,5"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Paper airplane */}
        <g transform="translate(345, 30) rotate(-18)">
          <polygon points="0,20 40,0 20,40" fill="url(#planeGrad)" />
          <polygon points="40,0 15,22 20,40" fill="#0369a1" opacity="0.4" />
          <polygon points="40,0 0,20 15,22" fill="#bae6fd" />
          <line x1="40" y1="0" x2="15" y2="22" stroke="#ffffff" strokeWidth="1" />
        </g>

        {/* Decorative background math doodle */}
        <path d="M 60,60 C 90,30 140,50 160,30" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="3,3" />
        <circle cx="90" cy="45" r="8" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="2,2" />

        {/* Foliage / Green plant leaves behind books */}
        <g transform="translate(400, 75)">
          <path d="M 0,80 C 15,40 45,35 60,10 C 65,45 35,70 0,80 Z" fill="url(#leafGrad)" />
          <path d="M -15,75 C -10,35 15,25 35,5 C 38,40 10,65 -15,75 Z" fill="#15803d" opacity="0.85" />
          <path d="M -25,85 C -20,50 0,45 15,25 C 20,55 0,75 -25,85 Z" fill="#22c55e" opacity="0.9" />
        </g>

        {/* Stack of books */}
        {/* Book 1 (Bottom, Blue) */}
        <g transform="translate(265, 148)">
          {/* Cover */}
          <polygon points="0,15 145,0 165,15 20,30" fill="url(#bookBlue)" />
          {/* Pages */}
          <polygon points="20,30 165,15 165,26 20,41" fill="#f8fafc" />
          {/* Bottom cover edge */}
          <polygon points="20,41 165,26 165,29 20,44" fill="#1e3a8a" />
          {/* Spine */}
          <polygon points="0,15 20,30 20,44 0,29" fill="#1e40af" />
          {/* Gold spine stripes */}
          <line x1="5" y1="21" x2="15" y2="29" stroke="#fbbf24" strokeWidth="2" />
          <line x1="7" y1="26" x2="17" y2="34" stroke="#fbbf24" strokeWidth="2" />
        </g>

        {/* Book 2 (Middle, Orange) */}
        <g transform="translate(275, 122)">
          {/* Cover */}
          <polygon points="0,12 135,0 150,12 15,24" fill="url(#bookOrange)" />
          {/* Pages */}
          <polygon points="15,24 150,12 150,22 15,34" fill="#fefce8" />
          {/* Spine */}
          <polygon points="0,12 15,24 15,34 0,22" fill="#c2410c" />
        </g>

        {/* Book 3 (Top, Yellow/Warm White) */}
        <g transform="translate(285, 98)">
          {/* Cover */}
          <polygon points="0,12 125,0 140,12 15,24" fill="url(#bookYellow)" />
          {/* Pages */}
          <polygon points="15,24 140,12 140,20 15,32" fill="#ffffff" />
          {/* Spine */}
          <polygon points="0,12 15,24 15,32 0,20" fill="#ca8a04" />
        </g>

        {/* Triangle Set Square Ruler (Thước ê-ke) in Foreground */}
        <g transform="translate(325, 95) rotate(15)">
          {/* Outer yellow triangle */}
          <polygon points="0,85 105,85 0,0" fill="url(#rulerGrad)" stroke="#ca8a04" strokeWidth="1.5" />
          {/* Inner cutout triangle */}
          <polygon points="18,72 75,72 18,25" fill="#eaf5ff" stroke="#ca8a04" strokeWidth="1" />
          {/* Measurement tick marks */}
          <line x1="10" y1="85" x2="10" y2="78" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="25" y1="85" x2="25" y2="79" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="40" y1="85" x2="40" y2="78" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="55" y1="85" x2="55" y2="79" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="70" y1="85" x2="70" y2="78" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="85" y1="85" x2="85" y2="79" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="0" y1="15" x2="7" y2="15" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="0" y1="30" x2="8" y2="30" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="0" y1="45" x2="7" y2="45" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="0" y1="60" x2="8" y2="60" stroke="#854d0e" strokeWidth="1.2" />
          <line x1="0" y1="75" x2="7" y2="75" stroke="#854d0e" strokeWidth="1.2" />
        </g>

        {/* Stationery Pen Cup */}
        <g transform="translate(230, 88)">
          {/* Pencils and ruler sticking out */}
          {/* Blue ruler */}
          <rect x="8" y="-30" width="10" height="60" rx="1" fill="#38bdf8" transform="rotate(-15 8 -30)" stroke="#0284c7" strokeWidth="1" />
          {/* Red pencil */}
          <rect x="22" y="-35" width="7" height="65" rx="1" fill="#ef4444" transform="rotate(8 22 -35)" />
          <polygon points="22,-35 25.5,-45 29,-35" fill="#fde047" transform="rotate(8 22 -35)" />
          <polygon points="24,-41 25.5,-45 27,-41" fill="#1e293b" transform="rotate(8 22 -35)" />
          {/* Yellow pencil */}
          <rect x="15" y="-28" width="6" height="58" rx="1" fill="#facc15" transform="rotate(-5 15 -28)" />
          {/* Compass metal arm */}
          <line x1="32" y1="-25" x2="38" y2="20" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="-25" r="3.5" fill="#64748b" />

          {/* Cup body */}
          <path d="M 5,20 L 45,20 L 40,78 L 10,78 Z" fill="url(#cupGrad)" stroke="#0284c7" strokeWidth="1.5" />
          <ellipse cx="25" cy="20" rx="20" ry="5" fill="#38bdf8" />
          {/* Cup decorative stripes */}
          <line x1="12" y1="42" x2="38" y2="42" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
          <line x1="14" y1="55" x2="36" y2="55" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
        </g>

        {/* Green leaves in foreground left */}
        <g transform="translate(205, 140)">
          <path d="M 15,35 C 0,15 -15,10 -25,-5 C -25,20 0,30 15,35 Z" fill="#22c55e" />
          <path d="M 12,38 C -5,28 -20,35 -30,25 C -22,40 -5,42 12,38 Z" fill="#16a34a" />
        </g>
      </svg>
    </div>
  );
};
