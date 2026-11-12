import React from 'react';

interface LectureCoverProps {
  title: string;
  grade: number | string;
  chapterLabel?: string;
  topicCategory?: string;
  className?: string;
}

export const LectureCoverSvg: React.FC<LectureCoverProps> = ({
  title,
  grade,
  chapterLabel = '',
  topicCategory = 'geometry',
  className = ''
}) => {
  const t = title.toLowerCase();

  // Detect specific cover theme based on title keywords and category
  if (t.includes('pythagore') || t.includes('pitago')) {
    // Style 1: Pythagorean Theorem chalkboard style (Matching Sample B Card 1)
    return (
      <div className={`w-full aspect-video rounded-xl overflow-hidden relative select-none shadow-inner ${className}`}>
        <svg viewBox="0 0 320 180" className="w-full h-full block">
          <defs>
            <linearGradient id="chalkboardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14532d" />
              <stop offset="50%" stopColor="#166534" />
              <stop offset="100%" stopColor="#0f3d23" />
            </linearGradient>
            <filter id="chalkGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#ffffff" floodOpacity="0.4" />
            </filter>
          </defs>
          <rect width="320" height="180" fill="url(#chalkboardGrad)" />
          {/* Subtle grid pattern */}
          <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
            <line x1="0" y1="45" x2="320" y2="45" />
            <line x1="0" y1="90" x2="320" y2="90" />
            <line x1="0" y1="135" x2="320" y2="135" />
            <line x1="80" y1="0" x2="80" y2="180" />
            <line x1="160" y1="0" x2="160" y2="180" />
            <line x1="240" y1="0" x2="240" y2="180" />
          </g>

          {/* Right triangle ABC */}
          <polygon points="50,140 180,140 50,45" fill="rgba(255,255,255,0.12)" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
          {/* Right angle marker at B */}
          <path d="M 50,126 L 64,126 L 64,140" fill="none" stroke="#ffffff" strokeWidth="2" />

          {/* Vertices */}
          <circle cx="50" cy="45" r="3.5" fill="#ffffff" />
          <circle cx="50" cy="140" r="3.5" fill="#ffffff" />
          <circle cx="180" cy="140" r="3.5" fill="#ffffff" />

          {/* Labels */}
          <text x="44" y="36" fill="#ffffff" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">A</text>
          <text x="32" y="152" fill="#ffffff" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">B</text>
          <text x="190" y="148" fill="#ffffff" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">C</text>

          {/* Pythagoras formula */}
          <g filter="url(#chalkGlow)">
            <text x="215" y="98" fill="#ffffff" fontSize="21" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold" textAnchor="middle">
              a² + b² = c²
            </text>
          </g>

          {/* Decorative botanical leaves on corners */}
          <path d="M 0,180 C 15,160 25,168 35,155 C 38,170 30,178 0,180 Z" fill="#22c55e" opacity="0.75" />
          <path d="M 320,180 C 300,165 292,175 285,160 C 280,175 295,178 320,180 Z" fill="#22c55e" opacity="0.8" />
        </svg>
      </div>
    );
  }

  if (t.includes('hệ thức') || t.includes('tam giác vuông') || t.includes('thực tiễn') || t.includes('lượng giác')) {
    // Style 2: Landscape with Lighthouse & Elevation angle (Matching Sample B Card 2)
    return (
      <div className={`w-full aspect-video rounded-xl overflow-hidden relative select-none shadow-inner ${className}`}>
        <svg viewBox="0 0 320 180" className="w-full h-full block">
          <defs>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="60%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>
            <linearGradient id="hillGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <linearGradient id="hillGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#skyGrad)" />

          {/* Distant mountains */}
          <path d="M 0,140 Q 60,110 120,135 T 240,120 Q 280,105 320,125 L 320,180 L 0,180 Z" fill="#93c5fd" opacity="0.45" />

          {/* Rolling green hills */}
          <path d="M 140,180 Q 200,90 280,105 Q 310,112 320,120 L 320,180 Z" fill="url(#hillGrad1)" />
          <path d="M 0,180 Q 80,140 180,155 Q 260,165 320,180 Z" fill="url(#hillGrad2)" opacity="0.9" />

          {/* Lighthouse on hill */}
          <g transform="translate(202, 65)">
            <rect x="0" y="24" width="14" height="42" fill="#ef4444" />
            <rect x="2" y="32" width="10" height="8" fill="#ffffff" />
            <rect x="2" y="48" width="10" height="8" fill="#ffffff" />
            <polygon points="-2,24 16,24 7,12" fill="#0f172a" />
            <circle cx="7" cy="18" r="4" fill="#fef08a" />
          </g>

          {/* Math elevation triangle overlay */}
          <line x1="35" y1="155" x2="209" y2="155" stroke="#0284c7" strokeWidth="2" strokeDasharray="4,4" />
          <line x1="209" y1="155" x2="209" y2="80" stroke="#0284c7" strokeWidth="2.5" />
          <line x1="35" y1="155" x2="209" y2="80" stroke="#0284c7" strokeWidth="2.5" strokeDasharray="3,3" />

          {/* Angle arc α */}
          <path d="M 65,155 A 30 30 0 0 0 58,142" fill="none" stroke="#0369a1" strokeWidth="2" />
          <text x="70" y="150" fill="#0369a1" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">α</text>

          {/* Height label h */}
          <text x="218" y="120" fill="#0369a1" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">h</text>
        </svg>
      </div>
    );
  }

  if (t.includes('trung bình') || t.includes('thalès') || t.includes('tam giác') || t.includes('đồng dạng')) {
    // Style 3: Midsegment of triangle (Matching Sample B Card 3)
    return (
      <div className={`w-full aspect-video rounded-xl overflow-hidden relative select-none shadow-inner ${className}`}>
        <svg viewBox="0 0 320 180" className="w-full h-full block">
          <defs>
            <linearGradient id="warmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="60%" stopColor="#ffedd5" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#warmGrad)" />

          {/* Subtle math grid */}
          <g stroke="rgba(217, 119, 6, 0.12)" strokeWidth="1">
            <line x1="0" y1="45" x2="320" y2="45" />
            <line x1="0" y1="90" x2="320" y2="90" />
            <line x1="0" y1="135" x2="320" y2="135" />
            <line x1="80" y1="0" x2="80" y2="180" />
            <line x1="160" y1="0" x2="160" y2="180" />
            <line x1="240" y1="0" x2="240" y2="180" />
          </g>

          {/* Outer triangle ABC */}
          <polygon points="160,30 65,145 255,145" fill="rgba(99, 102, 241, 0.08)" stroke="#4338ca" strokeWidth="3" strokeLinejoin="round" />

          {/* Midsegment MN */}
          <line x1="112" y1="88" x2="208" y2="88" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />

          {/* Midpoint ticks */}
          <line x1="132" y1="56" x2="138" y2="62" stroke="#4338ca" strokeWidth="2" />
          <line x1="84" y1="114" x2="90" y2="120" stroke="#4338ca" strokeWidth="2" />
          <line x1="182" y1="62" x2="188" y2="56" stroke="#4338ca" strokeWidth="2" />
          <line x1="230" y1="120" x2="236" y2="114" stroke="#4338ca" strokeWidth="2" />

          {/* Points */}
          <circle cx="160" cy="30" r="3.5" fill="#4338ca" />
          <circle cx="65" cy="145" r="3.5" fill="#4338ca" />
          <circle cx="255" cy="145" r="3.5" fill="#4338ca" />
          <circle cx="112" cy="88" r="3.5" fill="#dc2626" />
          <circle cx="208" cy="88" r="3.5" fill="#dc2626" />

          {/* Vertex Labels */}
          <text x="156" y="22" fill="#312e81" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">A</text>
          <text x="48" y="152" fill="#312e81" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">B</text>
          <text x="262" y="152" fill="#312e81" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">C</text>
          <text x="96" y="93" fill="#991b1b" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">M</text>
          <text x="216" y="93" fill="#991b1b" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">N</text>

          {/* Small decorative leaf */}
          <path d="M 0,165 C 16,155 20,162 26,150 C 30,165 18,172 0,180 Z" fill="#16a34a" opacity="0.75" />
        </svg>
      </div>
    );
  }

  if (t.includes('tứ giác') || t.includes('hình thang') || t.includes('hình chữ nhật') || t.includes('hình thoi') || t.includes('hình vuông') || t.includes('hình bình hành')) {
    // Style 4: Quadrilaterals & Polygons
    return (
      <div className={`w-full aspect-video rounded-xl overflow-hidden relative select-none shadow-inner ${className}`}>
        <svg viewBox="0 0 320 180" className="w-full h-full block">
          <defs>
            <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ede9fe" />
              <stop offset="100%" stopColor="#ddd6fe" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#purpleGrad)" />

          {/* Geometric Parallelogram / Trapezoid */}
          <polygon points="80,50 240,50 200,135 40,135" fill="rgba(109, 40, 217, 0.12)" stroke="#6d28d9" strokeWidth="2.8" strokeLinejoin="round" />
          <line x1="80" y1="50" x2="200" y2="135" stroke="#8b5cf6" strokeWidth="1.8" strokeDasharray="4,4" />
          <line x1="240" y1="50" x2="40" y2="135" stroke="#8b5cf6" strokeWidth="1.8" strokeDasharray="4,4" />

          {/* Vertices */}
          <circle cx="80" cy="50" r="3.5" fill="#6d28d9" />
          <circle cx="240" cy="50" r="3.5" fill="#6d28d9" />
          <circle cx="200" cy="135" r="3.5" fill="#6d28d9" />
          <circle cx="40" cy="135" r="3.5" fill="#6d28d9" />

          <text x="74" y="42" fill="#4c1d95" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">A</text>
          <text x="245" y="46" fill="#4c1d95" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">B</text>
          <text x="206" y="145" fill="#4c1d95" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">C</text>
          <text x="24" y="142" fill="#4c1d95" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">D</text>

          <text x="140" y="98" fill="#6d28d9" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold" textAnchor="middle">S = a · h</text>
        </svg>
      </div>
    );
  }

  if (t.includes('geogebra') || t.includes('trải nghiệm') || t.includes('thực hành') || t.includes('máy tính')) {
    // Style 5: Interactive GeoGebra & Digital Math Lab
    return (
      <div className={`w-full aspect-video rounded-xl overflow-hidden relative select-none shadow-inner ${className}`}>
        <svg viewBox="0 0 320 180" className="w-full h-full block">
          <defs>
            <linearGradient id="geoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f0fdf4" />
              <stop offset="100%" stopColor="#dcfce7" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#geoGrad)" />
          {/* Coordinate axes */}
          <line x1="30" y1="90" x2="290" y2="90" stroke="#059669" strokeWidth="2" />
          <line x1="160" y1="20" x2="160" y2="160" stroke="#059669" strokeWidth="2" />
          {/* Curve / Circle */}
          <circle cx="160" cy="90" r="50" fill="none" stroke="#0284c7" strokeWidth="2.5" />
          <path d="M 60,140 Q 160,20 260,140" fill="none" stroke="#16a34a" strokeWidth="2.5" />
          {/* GeoGebra badge icon */}
          <rect x="220" y="25" width="75" height="24" rx="12" fill="#0284c7" />
          <text x="257" y="41" fill="#ffffff" fontSize="11" fontFamily="system-ui, sans-serif" fontWeight="bold" textAnchor="middle">GeoGebra</text>
        </svg>
      </div>
    );
  }

  // Style 6: General Modern Mathematics (Set theory, Arithmetic, Functions, Science, Info)
  return (
    <div className={`w-full aspect-video rounded-xl overflow-hidden relative select-none shadow-inner ${className}`}>
      <svg viewBox="0 0 320 180" className="w-full h-full block">
        <defs>
          <linearGradient id="defaultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="50%" stopColor="#eef8ff" />
            <stop offset="100%" stopColor="#bae6fd" />
          </linearGradient>
        </defs>
        <rect width="320" height="180" fill="url(#defaultGrad)" />

        {/* Geometric patterns */}
        <circle cx="110" cy="90" r="45" fill="rgba(14, 165, 233, 0.18)" stroke="#0284c7" strokeWidth="2" />
        <circle cx="165" cy="90" r="45" fill="rgba(16, 185, 129, 0.18)" stroke="#059669" strokeWidth="2" />

        {/* Intersection marker */}
        <text x="138" y="95" fill="#082b52" fontSize="15" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold" textAnchor="middle">A ∩ B</text>

        <text x="65" y="95" fill="#0369a1" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">A</text>
        <text x="210" y="95" fill="#047857" fontSize="16" fontFamily="Times New Roman, serif" fontStyle="italic" fontWeight="bold">B</text>

        {/* Math formulas in background */}
        <text x="250" y="45" fill="#0284c7" opacity="0.35" fontSize="14" fontFamily="Times New Roman, serif" fontWeight="bold">f(x) = ax + b</text>
        <text x="35" y="150" fill="#0284c7" opacity="0.35" fontSize="14" fontFamily="Times New Roman, serif" fontWeight="bold">ℕ ⊂ ℤ ⊂ ℚ</text>
      </svg>
    </div>
  );
};
