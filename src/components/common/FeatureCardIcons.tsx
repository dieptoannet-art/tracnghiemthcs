import React from 'react';

interface IconProps {
  className?: string;
}

// 1. Kiến thức trọng tâm - Glowing open book with golden light
export const IconCoreKnowledge: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="30" r="14" fill="#FDE047" opacity="0.4" filter="blur(4px)" />
    {/* Sun rays */}
    <path d="M50 10V4M50 36V30M32 20L26 16M68 20L74 16M38 32L32 36M62 32L68 36" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="50" cy="20" r="6" fill="#FBBF24" />
    {/* Open book */}
    <path d="M50 42C42 38 28 38 18 42V68C28 64 42 64 50 68C58 64 72 64 82 68V42C72 38 58 38 50 42Z" fill="#2563EB" />
    {/* Pages */}
    <path d="M50 42C43 39 30 39 20 43V66C30 62 43 62 50 66V42Z" fill="#F8FAFC" />
    <path d="M50 42C57 39 70 39 80 43V66C70 62 57 62 50 66V42Z" fill="#EFF6FF" />
    {/* Text lines */}
    <path d="M26 49H44M26 55H40M56 49H74M56 55H70" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
    {/* Spine line */}
    <path d="M50 42V67" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 2. Luyện theo bài / chương - Cyan checklist clipboard & pencil
export const IconPractice: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 85" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Clipboard base */}
    <rect x="25" y="16" width="46" height="60" rx="7" fill="#60A5FA" />
    <rect x="28" y="20" width="40" height="52" rx="5" fill="#FFFFFF" />
    {/* Clip */}
    <rect x="40" y="11" width="16" height="9" rx="3" fill="#3B82F6" />
    <circle cx="48" cy="15" r="2" fill="#FFFFFF" />
    {/* Check items */}
    <rect x="33" y="29" width="7" height="7" rx="2" fill="#10B981" />
    <path d="M35 32.5L36.5 34L39 31" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="44" y1="32.5" x2="62" y2="32.5" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

    <rect x="33" y="41" width="7" height="7" rx="2" fill="#10B981" />
    <path d="M35 44.5L36.5 46L39 43" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="44" y1="44.5" x2="62" y2="44.5" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

    <rect x="33" y="53" width="7" height="7" rx="2" fill="#10B981" />
    <path d="M35 56.5L36.5 58L39 55" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="44" y1="56.5" x2="58" y2="56.5" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

    {/* Pencil leaning */}
    <g transform="rotate(35 68 45)">
      <rect x="66" y="20" width="6" height="32" rx="1.5" fill="#F59E0B" />
      <path d="M66 20L69 13L72 20Z" fill="#FDE68A" />
      <polygon points="68,13 69,13 70,16 68,16" fill="#1E293B" />
      <rect x="66" y="48" width="6" height="4" rx="1" fill="#EF4444" />
    </g>
  </svg>
);

// 3. Ôn tập học kỳ - Blue graduation cap (mortarboard)
export const IconSemesterReview: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Cap under cap */}
    <path d="M35 46V56C35 60.5 41.5 64 50 64C58.5 64 65 60.5 65 56V46" fill="#1D4ED8" />
    {/* Mortarboard Diamond */}
    <polygon points="50,18 84,33 50,47 16,33" fill="#2563EB" />
    <polygon points="50,18 84,33 50,35 16,33" fill="#3B82F6" />
    {/* Button on top */}
    <ellipse cx="50" cy="33" rx="3.5" ry="2.5" fill="#F59E0B" />
    {/* Tassel */}
    <path d="M50 33C58 35 66 42 70 47V60" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
    <polygon points="68,60 72,60 71,67 69,67" fill="#F59E0B" />
  </svg>
);

// 4. Bài được giao - Document sheet with green checkmark badge
export const IconAssignments: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Paper sheet */}
    <rect x="28" y="12" width="40" height="54" rx="6" fill="#3B82F6" />
    <rect x="31" y="15" width="34" height="48" rx="4" fill="#FFFFFF" />
    {/* Paper lines */}
    <rect x="37" y="24" width="22" height="3" rx="1.5" fill="#93C5FD" />
    <rect x="37" y="32" width="22" height="3" rx="1.5" fill="#CBD5E1" />
    <rect x="37" y="40" width="16" height="3" rx="1.5" fill="#CBD5E1" />
    {/* Green checkmark round seal */}
    <circle cx="62" cy="54" r="13" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
    <path d="M57 54L60.5 57.5L67 50.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 5. Kiểm tra trực tuyến - Computer monitor / tablet with play symbol
export const IconExamOnline: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Monitor screen */}
    <rect x="22" y="14" width="56" height="40" rx="6" fill="#2563EB" />
    <rect x="26" y="18" width="48" height="32" rx="3" fill="#60A5FA" />
    {/* Stand */}
    <path d="M44 54L42 63H58L56 54" fill="#1D4ED8" />
    <rect x="36" y="62" width="28" height="4" rx="2" fill="#1E40AF" />
    {/* Play button */}
    <polygon points="46,27 58,34 46,41" fill="#FFFFFF" />
  </svg>
);

// 6. Sổ câu sai - Red circular badge with exclamation mark
export const IconWrongBook: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="40" r="24" fill="#FEE2E2" />
    <circle cx="50" cy="40" r="20" fill="#EF4444" />
    {/* White exclamation mark inside ring */}
    <circle cx="50" cy="40" r="16" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
    <line x1="50" y1="31" x2="50" y2="42" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <circle cx="50" cy="48" r="1.8" fill="#FFFFFF" />
  </svg>
);

// 7. Kết quả & tiến bộ - Growth bar chart with upward trend arrow
export const IconResults: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bars */}
    <rect x="24" y="46" width="11" height="20" rx="3" fill="#60A5FA" />
    <rect x="39" y="36" width="11" height="30" rx="3" fill="#3B82F6" />
    <rect x="54" y="26" width="11" height="40" rx="3" fill="#10B981" />
    <rect x="69" y="16" width="11" height="50" rx="3" fill="#F59E0B" />
    {/* Upward trend arrow */}
    <path d="M25 40L42 30L56 22L76 10" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <polygon points="76,6 82,10 74,15" fill="#2563EB" />
  </svg>
);

// 8. Tài liệu học tập - Golden 3D file folder
export const IconMaterials: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Back tab */}
    <path d="M22 25C22 22.8 23.8 21 26 21H40L45 26H74C76.2 26 78 27.8 78 30V36H22V25Z" fill="#D97706" />
    {/* Inner document */}
    <rect x="28" y="24" width="44" height="26" rx="2" fill="#F8FAFC" />
    <line x1="33" y1="29" x2="52" y2="29" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
    {/* Front folder body */}
    <path d="M20 33H80L74 65C73.6 66.7 72.1 68 70.3 68H27.7C25.9 68 24.4 66.7 24 65L20 33Z" fill="#FBBF24" />
    {/* Front flap gradient */}
    <path d="M20 33H80L77 50H23L20 33Z" fill="#FCD34D" opacity="0.6" />
  </svg>
);

// 9. Bài giảng - Teacher presentation screen with play icon
export const IconLectures: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Screen */}
    <rect x="20" y="16" width="60" height="42" rx="7" fill="#60A5FA" />
    <rect x="24" y="20" width="52" height="34" rx="4" fill="#FFFFFF" />
    {/* Play symbol */}
    <polygon points="46,29 59,37 46,45" fill="#2563EB" />
    {/* Wall/Stand hanging hook */}
    <circle cx="50" cy="11" r="3" fill="#2563EB" />
    <line x1="50" y1="13" x2="50" y2="16" stroke="#2563EB" strokeWidth="2" />
  </svg>
);

// 10. Lớp học & học sinh - Three student avatars (yellow, blue, green)
export const IconClasses: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Left avatar (Yellow) */}
    <circle cx="32" cy="36" r="8" fill="#FBBF24" />
    <path d="M20 58C20 51 25 48 32 48C39 48 44 51 44 58" fill="#F59E0B" />

    {/* Right avatar (Green) */}
    <circle cx="68" cy="36" r="8" fill="#34D399" />
    <path d="M56 58C56 51 61 48 68 48C75 48 80 51 80 58" fill="#10B981" />

    {/* Center front avatar (Blue) */}
    <circle cx="50" cy="32" r="10" fill="#60A5FA" />
    <path d="M35 62C35 53 41 50 50 50C59 50 65 53 65 62" fill="#2563EB" />
  </svg>
);

// 11. Trò chơi gọi học sinh - Gamepad controller with sparkles
export const IconStudentCall: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Yellow sparks */}
    <path d="M50 14V8M38 18L34 13M62 18L66 13" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
    {/* Controller body */}
    <path d="M26 34C26 27 34 26 50 26C66 26 74 27 74 34C74 44 70 56 63 56C58 56 56 48 50 48C44 48 42 56 37 56C30 56 26 44 26 34Z" fill="#3B82F6" />
    {/* D-pad */}
    <path d="M38 34H34V38H38V42H42V38H46V34H42V30H38V34Z" fill="#FFFFFF" />
    {/* Action buttons */}
    <circle cx="60" cy="34" r="2.5" fill="#EF4444" />
    <circle cx="66" cy="38" r="2.5" fill="#FBBF24" />
    <circle cx="54" cy="38" r="2.5" fill="#10B981" />
    <circle cx="60" cy="42" r="2.5" fill="#93C5FD" />
  </svg>
);

// 12. Ngân hàng câu hỏi - Cylindrical database disk stack
export const IconQuestionBank: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bottom disk */}
    <path d="M30 46C30 51.5 39 56 50 56C61 56 70 51.5 70 46V54C70 59.5 61 64 50 64C39 64 30 59.5 30 54V46Z" fill="#1D4ED8" />
    <ellipse cx="50" cy="46" rx="20" ry="7" fill="#3B82F6" />

    {/* Middle disk */}
    <path d="M30 33C30 38.5 39 43 50 43C61 43 70 38.5 70 33V41C70 46.5 61 51 50 51C39 51 30 46.5 30 41V33Z" fill="#2563EB" />
    <ellipse cx="50" cy="33" rx="20" ry="7" fill="#60A5FA" />

    {/* Top disk */}
    <path d="M30 20C30 25.5 39 30 50 30C61 30 70 25.5 70 20V28C70 33.5 61 38 50 38C39 38 30 33.5 30 28V20Z" fill="#3B82F6" />
    <ellipse cx="50" cy="20" rx="20" ry="7" fill="#93C5FD" />
    <ellipse cx="50" cy="20" rx="16" ry="5" fill="#DBEAFE" />
  </svg>
);

// 13. Tạo đề & giao bài - Exam sheet with pencil
export const IconCreateExam: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Paper */}
    <rect x="25" y="14" width="42" height="54" rx="6" fill="#3B82F6" />
    <rect x="28" y="17" width="36" height="48" rx="4" fill="#FFFFFF" />
    <rect x="34" y="24" width="24" height="3" rx="1.5" fill="#93C5FD" />
    <rect x="34" y="32" width="24" height="3" rx="1.5" fill="#CBD5E1" />
    <rect x="34" y="40" width="18" height="3" rx="1.5" fill="#CBD5E1" />
    {/* Pencil */}
    <g transform="rotate(35 65 45)">
      <rect x="63" y="18" width="6" height="34" rx="1.5" fill="#F59E0B" />
      <path d="M63 18L66 11L69 18Z" fill="#FDE68A" />
      <polygon points="65,11 66,11 67,14 65,14" fill="#1E293B" />
      <rect x="63" y="48" width="6" height="4" rx="1" fill="#EF4444" />
    </g>
  </svg>
);

// 14. Ma trận & bản đặc tả - 2x2 matrix rounded tiles
export const IconMatrix: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="26" y="18" width="20" height="20" rx="5" fill="#3B82F6" />
    <rect x="54" y="18" width="20" height="20" rx="5" fill="#60A5FA" />
    <rect x="26" y="44" width="20" height="20" rx="5" fill="#93C5FD" />
    <rect x="54" y="44" width="20" height="20" rx="5" fill="#2563EB" />
  </svg>
);

// 15. Chấm bài & thống kê - 3 vertical colored evaluation metric bars
export const IconGrading: React.FC<IconProps> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="28" y="42" width="12" height="24" rx="4" fill="#3B82F6" />
    <rect x="44" y="26" width="12" height="40" rx="4" fill="#10B981" />
    <rect x="60" y="34" width="12" height="32" rx="4" fill="#F59E0B" />
  </svg>
);
