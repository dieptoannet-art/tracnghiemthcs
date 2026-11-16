import React, { useId } from 'react';

/**
 * Minh họa 3D (SVG Shading & Gradient) cho trang "Luyện tập theo bài & chương"
 * - Không phụ thuộc mạng hay URL ngoài (zero broken image, 0ms latency)
 * - Dùng useId() cho toàn bộ gradient/filter để tránh trùng ID trong DOM
 */

export const PracticeBannerIllustration3D: React.FC = () => {
  const uid = useId().replace(/:/g, '');
  const screenGrad = `pban-screen-${uid}`;
  const laptopBase = `pban-base-${uid}`;
  const bookBlue = `pban-bblue-${uid}`;
  const bookAmber = `pban-bamber-${uid}`;
  const cupGrad = `pban-cup-${uid}`;

  return (
    <div
      aria-hidden="true"
      className="relative w-[210px] sm:w-[250px] h-[96px] sm:h-[112px] select-none pointer-events-none shrink-0 flex items-center justify-center"
    >
      <svg
        viewBox="0 0 320 140"
        className="w-full h-full overflow-visible drop-shadow-[0_8px_16px_rgba(15,45,82,0.14)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={screenGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={laptopBase} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <linearGradient id={bookBlue} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id={bookAmber} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id={cupGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3898FF" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>

        {/* Soft floor shadow */}
        <ellipse cx="165" cy="126" rx="128" ry="9" fill="#1769C2" fillOpacity="0.14" />

        {/* Stacked books on left */}
        <g transform="translate(26, 78)">
          {/* Bottom yellow book */}
          <rect x="0" y="22" width="76" height="17" rx="4.5" fill={`url(#${bookAmber})`} />
          <rect x="8" y="25" width="62" height="11" rx="2" fill="#FFFBEB" />
          <rect x="0" y="22" width="11" height="17" rx="3" fill="#D97706" />
          {/* Top blue book */}
          <path d="M4 10L16 2H78L68 10H4Z" fill="#7DD3FC" />
          <rect x="4" y="9" width="70" height="15" rx="4" fill={`url(#${bookBlue})`} />
          <rect x="12" y="12" width="56" height="9" rx="2" fill="#F0F9FF" />
          <rect x="4" y="9" width="10" height="15" rx="3" fill="#0369A1" />
        </g>

        {/* Laptop in center */}
        <g transform="translate(106, 18)">
          {/* Lid */}
          <rect x="10" y="4" width="118" height="78" rx="8" fill="#1E3A8A" />
          <rect x="14" y="8" width="110" height="70" rx="5" fill={`url(#${screenGrad})`} />
          {/* Open book on laptop screen */}
          <path
            d="M69 24C60 19 42 19 30 24V62C42 57 60 57 69 62C78 57 96 57 108 62V24C96 19 78 19 69 24Z"
            fill="#FFFFFF"
          />
          <path
            d="M69 24C61 20 44 20 33 25V59C44 55 61 55 69 59V24Z"
            fill="#F8FAFC"
          />
          <path
            d="M69 24C77 20 94 20 105 25V59C94 55 77 55 69 59V24Z"
            fill="#EFF6FF"
          />
          <line x1="69" y1="24" x2="69" y2="61" stroke="#93C5FD" strokeWidth="2" />
          <line x1="40" y1="33" x2="60" y2="33" stroke="#BFDBFE" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="40" y1="40" x2="57" y2="40" stroke="#BFDBFE" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="78" y1="33" x2="98" y2="33" stroke="#BFDBFE" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="78" y1="40" x2="94" y2="40" stroke="#BFDBFE" strokeWidth="2.2" strokeLinecap="round" />
          {/* Base */}
          <path d="M0 86L10 82H128L138 86C140 90 137 94 132 94H6C1 94 -2 90 0 86Z" fill={`url(#${laptopBase})`} />
          <rect x="52" y="87" width="34" height="3.5" rx="1.5" fill="#94A3B8" />
        </g>

        {/* Pencil cup on right */}
        <g transform="translate(248, 36)">
          {/* Pencils */}
          <g transform="rotate(-14 14 24)">
            <rect x="8" y="4" width="7" height="38" rx="2" fill="#F59E0B" />
            <polygon points="8,4 11.5,-5 15,4" fill="#FDE68A" />
            <polygon points="10.2,-1.5 11.5,-5 12.8,-1.5" fill="#1E293B" />
          </g>
          <g transform="rotate(8 24 22)">
            <rect x="20" y="0" width="7" height="42" rx="2" fill="#3B82F6" />
            <polygon points="20,0 23.5,-9 27,0" fill="#FDE68A" />
            <polygon points="22.2,-5.5 23.5,-9 24.8,-5.5" fill="#1E293B" />
          </g>
          <g transform="rotate(20 32 28)">
            <rect x="28" y="8" width="7" height="36" rx="2" fill="#FB7185" />
            <polygon points="28,8 31.5,0 35,8" fill="#FDE68A" />
          </g>
          {/* Cup body */}
          <path d="M4 34H42L38 78C37.5 82 34.5 84 30.5 84H15.5C11.5 84 8.5 82 8 78L4 34Z" fill={`url(#${cupGrad})`} />
          <ellipse cx="23" cy="34" rx="19" ry="4" fill="#60A5FA" />
        </g>
      </svg>
    </div>
  );
};

export const PracticeReadyIllustration3D: React.FC = () => {
  const uid = useId().replace(/:/g, '');
  const screenGrad = `pready-screen-${uid}`;
  const baseGrad = `pready-base-${uid}`;
  const bookBlue = `pready-bblue-${uid}`;
  const bookAmber = `pready-bamber-${uid}`;

  return (
    <div
      aria-hidden="true"
      className="relative w-[190px] sm:w-[215px] h-[112px] sm:h-[124px] select-none pointer-events-none mx-auto flex items-center justify-center"
    >
      <svg
        viewBox="0 0 260 150"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_18px_rgba(15,45,82,0.14)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={screenGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={baseGrad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <linearGradient id={bookBlue} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id={bookAmber} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="132" cy="134" rx="108" ry="11" fill="#1769C2" fillOpacity="0.14" />

        {/* Stacked books left */}
        <g transform="translate(18, 74)">
          <rect x="0" y="28" width="84" height="20" rx="5" fill={`url(#${bookAmber})`} />
          <rect x="8" y="32" width="68" height="12" rx="2.5" fill="#FFFBEB" />
          <rect x="0" y="28" width="12" height="20" rx="4" fill="#D97706" />

          <path d="M4 12L18 2H86L74 12H4Z" fill="#7DD3FC" />
          <rect x="4" y="11" width="76" height="19" rx="5" fill={`url(#${bookBlue})`} />
          <rect x="12" y="14" width="60" height="12" rx="2.5" fill="#F0F9FF" />
          <rect x="4" y="11" width="11" height="19" rx="4" fill="#0369A1" />
        </g>

        {/* Laptop center-right */}
        <g transform="translate(86, 20) rotate(-3)">
          <rect x="12" y="6" width="126" height="84" rx="9" fill="#1E3A8A" />
          <rect x="16" y="10" width="118" height="76" rx="6" fill={`url(#${screenGrad})`} />
          {/* Open glowing book on screen */}
          <path
            d="M75 27C66 22 46 22 33 27V68C46 63 66 63 75 68C84 63 104 63 117 68V27C104 22 84 22 75 27Z"
            fill="#FFFFFF"
          />
          <path d="M75 27C67 23 48 23 36 28V65C48 61 67 61 75 65V27Z" fill="#F8FAFC" />
          <path d="M75 27C83 23 102 23 114 28V65C102 61 83 61 75 65V27Z" fill="#EFF6FF" />
          <line x1="75" y1="27" x2="75" y2="67" stroke="#93C5FD" strokeWidth="2" />
          <line x1="43" y1="36" x2="64" y2="36" stroke="#BFDBFE" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="43" y1="44" x2="61" y2="44" stroke="#BFDBFE" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="86" y1="36" x2="107" y2="36" stroke="#BFDBFE" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="86" y1="44" x2="103" y2="44" stroke="#BFDBFE" strokeWidth="2.5" strokeLinecap="round" />

          {/* Base */}
          <path d="M0 94L12 90H138L150 94C152 99 149 103 144 103H6C1 103 -2 99 0 94Z" fill={`url(#${baseGrad})`} />
          <rect x="56" y="95" width="38" height="4" rx="2" fill="#94A3B8" />
        </g>

        {/* Three subtle golden accent rays */}
        <path d="M232 42L242 36M236 55L248 54M232 68L243 73" stroke="#F59E0B" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export const SubjectThumbnail3D: React.FC<{ subjectKey: string; className?: string }> = ({
  subjectKey,
  className = 'w-16 h-12 sm:w-20 sm:h-14'
}) => {
  const uid = useId().replace(/:/g, '');

  if (subjectKey === 'tin_hoc') {
    return (
      <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
        <defs>
          <linearGradient id={`tin-scr-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <ellipse cx="55" cy="70" rx="40" ry="6" fill="#2563EB" fillOpacity="0.14" />
        <g transform="translate(12, 8) rotate(-5 44 30)">
          <rect x="14" y="6" width="60" height="40" rx="5" fill="#1E3A8A" />
          <rect x="17" y="9" width="54" height="34" rx="3" fill={`url(#tin-scr-${uid})`} />
          <text x="44" y="31" textAnchor="middle" fill="#FFFFFF" fontSize="15" fontWeight="800" fontFamily="monospace">
            &lt;/&gt;
          </text>
          <path d="M6 50L14 46H74L82 50C83 53 81 56 77 56H11C7 56 5 53 6 50Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
          <rect x="36" y="51" width="16" height="2.5" rx="1" fill="#94A3B8" />
        </g>
      </svg>
    );
  }

  if (subjectKey === 'toan') {
    return (
      <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
        <defs>
          <radialGradient id={`toan-sph-${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FDBA74" />
            <stop offset="60%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#C2410C" />
          </radialGradient>
        </defs>
        <ellipse cx="55" cy="70" rx="42" ry="6" fill="#2563EB" fillOpacity="0.13" />
        {/* Coral 3D sphere */}
        <circle cx="30" cy="48" r="14" fill={`url(#toan-sph-${uid})`} />
        <circle cx="25" cy="43" r="4" fill="#FFEDD5" fillOpacity="0.65" />
        {/* Golden 3D cube */}
        <g transform="translate(38, 12)">
          <polygon points="18,0 36,9 18,18 0,9" fill="#FEF08A" />
          <polygon points="0,9 18,18 18,40 0,31" fill="#FACC15" />
          <polygon points="18,18 36,9 36,31 18,40" fill="#EA580C" fillOpacity="0.85" />
        </g>
        {/* Blue 3D cone / pyramid */}
        <g transform="translate(56, 20)">
          <polygon points="22,0 44,44 22,49" fill="#1D4ED8" />
          <polygon points="22,0 22,49 0,44" fill="#3B82F6" />
        </g>
      </svg>
    );
  }

  if (subjectKey === 'khtn') {
    return (
      <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
        <ellipse cx="55" cy="71" rx="34" ry="5.5" fill="#1D4ED8" fillOpacity="0.14" />
        {/* Base */}
        <rect x="28" y="60" width="52" height="9" rx="4" fill="#1D4ED8" />
        <rect x="34" y="55" width="40" height="6" rx="2.5" fill="#60A5FA" />
        {/* Arm */}
        <path d="M62 24C74 28 76 48 64 56" stroke="#2563EB" strokeWidth="7" strokeLinecap="round" />
        {/* Stage */}
        <rect x="34" y="45" width="26" height="4" rx="2" fill="#0F172A" />
        {/* Body tube */}
        <g transform="rotate(-24 46 28)">
          <rect x="40" y="10" width="12" height="28" rx="3" fill="#3B82F6" />
          <rect x="41" y="6" width="10" height="6" rx="2" fill="#94A3B8" />
          <rect x="42" y="37" width="8" height="7" rx="1.5" fill="#1E293B" />
        </g>
        {/* Pivot knob */}
        <circle cx="67" cy="36" r="5" fill="#93C5FD" stroke="#1D4ED8" strokeWidth="1.5" />
      </svg>
    );
  }

  if (subjectKey === 'ngu_van') {
    return (
      <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
        <ellipse cx="55" cy="70" rx="40" ry="6" fill="#DC2626" fillOpacity="0.12" />
        {/* Red book cover */}
        <path d="M55 24C44 18 24 18 14 23V61C24 56 44 56 55 62C66 56 86 56 96 61V23C86 18 66 18 55 24Z" fill="#EF4444" />
        {/* Left & right pages */}
        <path d="M55 23C45 18 27 18 18 22V57C27 53 45 53 55 58V23Z" fill="#FFFFFF" />
        <path d="M55 23C65 18 83 18 92 22V57C83 53 65 53 55 58V23Z" fill="#F8FAFC" />
        <line x1="55" y1="23" x2="55" y2="59" stroke="#CBD5E1" strokeWidth="2" />
        {/* Lines */}
        <line x1="25" y1="30" x2="47" y2="30" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="25" y1="37" x2="45" y2="37" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="25" y1="44" x2="43" y2="44" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="63" y1="30" x2="85" y2="30" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="63" y1="37" x2="83" y2="37" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
        {/* Golden bookmark ribbon */}
        <path d="M76 17H86V42L81 37L76 42V17Z" fill="#F59E0B" />
      </svg>
    );
  }

  if (subjectKey === 'tieng_anh') {
    return (
      <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
        <ellipse cx="55" cy="70" rx="36" ry="5.5" fill="#0284C7" fillOpacity="0.14" />
        <circle cx="45" cy="40" r="22" fill="#38BDF8" />
        <ellipse cx="45" cy="40" rx="10" ry="22" stroke="#E0F2FE" strokeWidth="2" />
        <line x1="23" y1="40" x2="67" y2="40" stroke="#E0F2FE" strokeWidth="2" />
        <rect x="55" y="12" width="38" height="24" rx="8" fill="#2563EB" />
        <text x="74" y="29" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="800">
          A–Z
        </text>
      </svg>
    );
  }

  if (subjectKey === 'cong_nghe') {
    return (
      <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
        <ellipse cx="55" cy="70" rx="36" ry="5.5" fill="#2563EB" fillOpacity="0.14" />
        <circle cx="46" cy="42" r="18" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="4" strokeDasharray="7 4" />
        <circle cx="46" cy="42" r="7" fill="#EFF6FF" />
        <circle cx="72" cy="28" r="12" fill="#F59E0B" stroke="#D97706" strokeWidth="3.5" strokeDasharray="5 3" />
        <circle cx="72" cy="28" r="4.5" fill="#FFFBEB" />
      </svg>
    );
  }

  if (subjectKey === 'lich_su_dia_li') {
    return (
      <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
        <ellipse cx="55" cy="70" rx="36" ry="5.5" fill="#D97706" fillOpacity="0.14" />
        <rect x="24" y="18" width="54" height="40" rx="6" fill="#FDE68A" stroke="#D97706" strokeWidth="2" />
        <path d="M32 42C38 30 50 48 62 30" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="72" cy="46" r="14" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2.5" />
        <polygon points="72,36 75,46 72,56 69,46" fill="#EF4444" />
      </svg>
    );
  }

  if (subjectKey === 'gdcd') {
    return (
      <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
        <ellipse cx="55" cy="70" rx="34" ry="5.5" fill="#10B981" fillOpacity="0.14" />
        <path d="M55 12L78 21V39C78 52 68 62 55 67C42 62 32 52 32 39V21L55 12Z" fill="#2563EB" />
        <path d="M55 18L72 24.5V38C72 48 64.5 56 55 60C45.5 56 38 48 38 38V24.5L55 18Z" fill="#60A5FA" />
        <path d="M47 38L52.5 43.5L63.5 32.5" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Fallback for any custom subject
  return (
    <svg aria-hidden="true" viewBox="0 0 110 80" className={className} fill="none">
      <ellipse cx="55" cy="70" rx="36" ry="5.5" fill="#2563EB" fillOpacity="0.14" />
      <rect x="28" y="14" width="54" height="48" rx="7" fill="#3B82F6" />
      <rect x="28" y="14" width="10" height="48" rx="4" fill="#1D4ED8" />
      <rect x="44" y="24" width="28" height="5" rx="2.5" fill="#DBEAFE" />
      <rect x="44" y="34" width="22" height="4" rx="2" fill="#93C5FD" />
    </svg>
  );
};
