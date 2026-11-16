import React from 'react';
import { normalizeSubject } from '../teacher/QuestionBank';

/**
 * Hệ thống minh họa 3D SVG chất lượng cao cho trang "Luyện tập theo bài & chương"
 * Đồng bộ phong cách với coreKnowledgeThumbnails.tsx ("Kiến thức trọng tâm"):
 * - Nền trong suốt hòa hợp mượt mà với banner & thẻ pastel
 * - 0ms latency, không lỗi ảnh, sắc nét trên mọi độ phân giải
 */

export const PracticeHeroIllustration3D: React.FC = () => {
  return (
    <div
      className="relative w-[240px] sm:w-[295px] lg:w-[325px] h-[106px] sm:h-[120px] select-none pointer-events-none shrink-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 380 146"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_18px_rgba(16,42,82,0.14)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="pmHeroBookBlue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="pmHeroBookOrange" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="pmHeroLaptopLid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          <linearGradient id="pmHeroLaptopScreen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="pmHeroLaptopBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <linearGradient id="pmHeroCup" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="pmHeroLeaf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#86EFAC" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
        </defs>

        {/* Bóng đổ mặt nền mềm */}
        <ellipse cx="195" cy="134" rx="158" ry="10" fill="#176BFF" fillOpacity="0.13" />

        {/* Cụm lá xanh bên trái */}
        <path d="M52 124C34 116 24 96 30 78C44 82 56 98 60 118L52 124Z" fill="url(#pmHeroLeaf)" />
        <path d="M40 128C22 124 12 110 14 95C28 96 42 108 46 123L40 128Z" fill="#22C55E" />

        {/* Chồng sách 3D bên trái */}
        <g transform="translate(48, 84)">
          {/* Sách cam dưới */}
          <path d="M4 26L20 16H104L90 26H4Z" fill="#FB923C" />
          <rect x="0" y="24" width="90" height="19" rx="5" fill="url(#pmHeroBookOrange)" />
          <rect x="10" y="27" width="76" height="13" rx="2.5" fill="#FFF7ED" />
          <line x1="16" y1="31.5" x2="78" y2="31.5" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="16" y1="36" x2="74" y2="36" stroke="#CBD5E1" strokeWidth="1.5" />

          {/* Sách xanh trên */}
          <path d="M8 10L24 0H108L94 10H8Z" fill="#60A5FA" />
          <rect x="4" y="8" width="90" height="19" rx="5" fill="url(#pmHeroBookBlue)" />
          <rect x="14" y="11" width="76" height="13" rx="2.5" fill="#F8FAFC" />
          <line x1="20" y1="15.5" x2="82" y2="15.5" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="20" y1="20" x2="76" y2="20" stroke="#CBD5E1" strokeWidth="1.5" />
        </g>

        {/* Laptop 3D trung tâm với biểu tượng mũ tốt nghiệp */}
        <g transform="translate(122, 26)">
          {/* Thân màn hình */}
          <rect x="20" y="0" width="112" height="72" rx="10" fill="url(#pmHeroLaptopLid)" stroke="#DBEAFE" strokeWidth="1.5" />
          <rect x="27" y="7" width="98" height="58" rx="6" fill="url(#pmHeroLaptopScreen)" />
          {/* Phản sáng màn hình */}
          <path d="M31 11H82L45 61H31V11Z" fill="white" fillOpacity="0.16" />

          {/* Mũ tốt nghiệp 3D trắng nổi bật trên màn hình */}
          <g transform="translate(52, 18)">
            <polygon points="24,0 48,10 24,20 0,10" fill="white" />
            <path d="M10 15V24C10 28 16.5 31 24 31C31.5 31 38 28 38 24V15L24 21L10 15Z" fill="#E0F2FE" />
            <path d="M24 10L42 16V26" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="42" cy="27" r="2.6" fill="#FDE047" />
          </g>

          {/* Đế bàn phím laptop 3D */}
          <path d="M6 94L20 72H132L146 94C147 98 144 102 138 102H14C8 102 5 98 6 94Z" fill="url(#pmHeroLaptopBase)" />
          <path d="M22 76H130L138 89H14L22 76Z" fill="#CBD5E1" />
          <rect x="58" y="92" width="36" height="5" rx="2.5" fill="#94A3B8" />
        </g>

        {/* Cốc đựng bút vàng 3D */}
        <g transform="translate(262, 50)">
          {/* Thước/bút chì */}
          <g transform="rotate(-14 14 24)">
            <rect x="8" y="6" width="8" height="36" rx="2" fill="#3B82F6" />
            <polygon points="8,6 12,-3 16,6" fill="#FEF08A" />
            <polygon points="10.5,-0.5 12,-3 13.5,-0.5" fill="#1E3A8A" />
          </g>
          <g transform="rotate(8 24 24)">
            <rect x="19" y="0" width="9" height="42" rx="2" fill="#F97316" />
            <polygon points="19,0 23.5,-9 28,0" fill="#FDE68A" />
            <polygon points="22,-6 23.5,-9 25,-6" fill="#7C2D12" />
          </g>
          <g transform="rotate(20 32 28)">
            <rect x="27" y="10" width="8" height="34" rx="2" fill="#10B981" />
          </g>
          {/* Thân cốc */}
          <path d="M4 34H42L37 72C36.5 75.5 33.5 78 30 78H16C12.5 78 9.5 75.5 9 72L4 34Z" fill="url(#pmHeroCup)" />
          <ellipse cx="23" cy="34" rx="19" ry="4" fill="#FEF08A" />
        </g>

        {/* Bia mục tiêu 3D & Mũi tên vàng cam */}
        <g transform="translate(298, 42)">
          {/* Chân đế */}
          <path d="M22 74L14 88M50 74L58 88" stroke="#EA580C" strokeWidth="4.5" strokeLinecap="round" />
          {/* Vòng ngoài đỏ */}
          <circle cx="36" cy="48" r="34" fill="#EF4444" stroke="#FECACA" strokeWidth="2" />
          <circle cx="36" cy="48" r="24" fill="white" />
          <circle cx="36" cy="48" r="14" fill="#EF4444" />
          <circle cx="36" cy="48" r="6" fill="#FACC15" />
          {/* Mũi tên trúng tâm */}
          <line x1="36" y1="48" x2="68" y2="16" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
          <polygon points="34,50 38,39 45,46" fill="#B45309" />
          <polygon points="62,16 74,10 68,22" fill="#FBBF24" />
          <polygon points="56,22 68,16 62,28" fill="#EA580C" />
        </g>
      </svg>
    </div>
  );
};

/**
 * Minh họa 3D nhỏ cho từng thẻ môn học trong khối "2. Chọn môn học"
 */
export const SubjectCardIllustration3D: React.FC<{ subject: string; size?: 'sm' | 'lg' }> = ({
  subject,
  size = 'sm'
}) => {
  const norm = normalizeSubject(subject);
  const boxClass =
    size === 'lg'
      ? 'w-[210px] sm:w-[235px] h-[112px] sm:h-[124px]'
      : 'w-12 h-11 sm:w-[54px] sm:h-12';

  if (norm === 'tin_hoc') {
    return (
      <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
        <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(23,107,255,0.16)]" fill="none">
          <ellipse cx="90" cy="108" rx="72" ry="8" fill="#1D4ED8" fillOpacity="0.12" />
          {size === 'lg' && (
            <>
              {/* Lá & sách trang trí ở khung tóm tắt */}
              <path d="M22 98C10 92 4 78 8 66C18 68 26 80 28 94L22 98Z" fill="#22C55E" />
              <g transform="translate(18, 66)">
                <rect x="0" y="18" width="44" height="12" rx="3" fill="#EA580C" />
                <rect x="3" y="6" width="40" height="12" rx="3" fill="#3B82F6" />
                <rect x="8" y="8" width="30" height="8" rx="1.5" fill="#F8FAFC" />
              </g>
              <g transform="translate(136, 58)">
                <rect x="6" y="4" width="6" height="24" rx="2" fill="#3B82F6" />
                <rect x="14" y="0" width="6" height="28" rx="2" fill="#F59E0B" />
                <path d="M2 22H26L23 46H5L2 22Z" fill="#FBBF24" />
              </g>
            </>
          )}
          {/* Laptop 3D */}
          <g transform="translate(36, 14)">
            <rect x="14" y="0" width="80" height="54" rx="8" fill="#1E3A8A" stroke="#93C5FD" strokeWidth="1.5" />
            <rect x="20" y="6" width="68" height="42" rx="4.5" fill="#3B82F6" />
            <path d="M22 8H58L32 46H22V8Z" fill="white" fillOpacity="0.15" />
            <text x="54" y="33" textAnchor="middle" fill="white" fontSize="19" fontWeight="900" fontFamily="monospace">
              &lt;/&gt;
            </text>
            <path d="M2 74L14 54H94L106 74C107 78 104 82 99 82H9C4 82 1 78 2 74Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1.2" />
            <path d="M16 58H92L98 70H10L16 58Z" fill="#E2E8F0" />
            <rect x="42" y="73" width="24" height="4" rx="2" fill="#94A3B8" />
          </g>
        </svg>
      </div>
    );
  }

  if (norm === 'toan') {
    return (
      <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
        <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(16,185,129,0.16)]" fill="none">
          <ellipse cx="90" cy="108" rx="70" ry="8" fill="#059669" fillOpacity="0.12" />
          {/* Hình nón xanh dương 3D */}
          <path d="M74 14L40 90C40 96 55 101 74 101C93 101 108 96 108 90L74 14Z" fill="#2563EB" />
          <path d="M74 14L40 90C40 96 55 101 74 101V14Z" fill="#3B82F6" />
          {/* Hình trụ vàng 3D bên phải */}
          <g transform="translate(88, 36)">
            <rect x="0" y="10" width="44" height="48" fill="#FACC15" />
            <ellipse cx="22" cy="58" rx="22" ry="8" fill="#EAB308" />
            <ellipse cx="22" cy="10" rx="22" ry="8" fill="#FEF08A" />
          </g>
          {/* Khối cầu đỏ cam 3D phía trước */}
          <circle cx="116" cy="84" r="21" fill="#EF4444" />
          <circle cx="109" cy="76" r="7" fill="#FCA5A5" fillOpacity="0.65" />
          {/* Khối lập phương xanh ngọc nhỏ */}
          <g transform="translate(26, 68)">
            <polygon points="14,0 28,7 14,14 0,7" fill="#6EE7B7" />
            <polygon points="0,7 14,14 14,32 0,25" fill="#10B981" />
            <polygon points="14,14 28,7 28,25 14,32" fill="#047857" />
          </g>
        </svg>
      </div>
    );
  }

  if (norm === 'khtn') {
    return (
      <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
        <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(217,119,6,0.16)]" fill="none">
          <ellipse cx="90" cy="108" rx="68" ry="8" fill="#D97706" fillOpacity="0.12" />
          {/* Lá xanh 3D */}
          <path d="M46 98C30 92 24 76 30 62C42 66 50 78 52 94L46 98Z" fill="#22C55E" />
          {/* Kính hiển vi 3D */}
          <rect x="52" y="92" width="76" height="14" rx="7" fill="#1D4ED8" />
          <path d="M104 92C118 82 122 58 110 42C102 32 92 30 88 30" stroke="#3B82F6" strokeWidth="11" strokeLinecap="round" />
          {/* Ống kính */}
          <g transform="translate(64, 16) rotate(22)">
            <rect x="0" y="0" width="20" height="48" rx="5" fill="#60A5FA" stroke="#1E40AF" strokeWidth="1.5" />
            <rect x="3" y="-6" width="14" height="8" rx="3" fill="#1E3A8A" />
            <rect x="4" y="48" width="12" height="10" rx="2" fill="#94A3B8" />
          </g>
          {/* Bàn kính & núm xoay */}
          <rect x="54" y="72" width="44" height="6" rx="3" fill="#1E293B" />
          <circle cx="112" cy="64" r="7" fill="#FBBF24" stroke="#B45309" strokeWidth="1.5" />
          {/* Ống nghiệm nhỏ bên phải */}
          <g transform="translate(128, 46) rotate(12)">
            <rect x="0" y="0" width="14" height="46" rx="7" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.5" />
            <rect x="2" y="22" width="10" height="22" rx="5" fill="#34D399" />
          </g>
        </svg>
      </div>
    );
  }

  if (norm === 'ngu_van') {
    return (
      <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
        <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(124,58,237,0.16)]" fill="none">
          <ellipse cx="90" cy="108" rx="70" ry="8" fill="#7C3AED" fillOpacity="0.12" />
          {/* Bìa sách mở 3D */}
          <path d="M26 32C26 27 30 24 35 25L90 36L145 25C150 24 154 27 154 32V88C154 93 150 96 145 95L90 84L35 95C30 96 26 93 26 88V32Z" fill="#7C3AED" />
          {/* Trang trái */}
          <path d="M32 28C48 22 72 24 90 34V84C72 76 48 74 32 80V28Z" fill="#FFFBEB" stroke="#E2E8F0" strokeWidth="1.2" />
          {/* Trang phải */}
          <path d="M148 28C132 22 108 24 90 34V84C108 76 132 74 148 80V28Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.2" />
          {/* Dòng chữ trang trái */}
          <line x1="44" y1="42" x2="78" y2="46" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <line x1="44" y1="53" x2="78" y2="57" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <line x1="44" y1="64" x2="74" y2="68" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          {/* Dòng chữ trang phải */}
          <line x1="102" y1="46" x2="136" y2="42" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <line x1="102" y1="57" x2="136" y2="53" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <line x1="102" y1="68" x2="130" y2="64" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          {/* Ruy-băng đỏ đánh dấu trang */}
          <path d="M84 36V102L90 96L96 102V36H84Z" fill="#F43F5E" />
        </svg>
      </div>
    );
  }

  if (norm === 'tieng_anh') {
    return (
      <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
        <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(2,132,199,0.16)]" fill="none">
          <ellipse cx="90" cy="108" rx="68" ry="8" fill="#0284C7" fillOpacity="0.12" />
          {/* Quả địa cầu xanh */}
          <circle cx="72" cy="60" r="34" fill="#38BDF8" />
          <path d="M52 44C60 36 76 38 80 48C84 58 68 64 62 74C56 68 46 54 52 44Z" fill="#34D399" />
          <path d="M84 64C92 60 100 66 98 76C94 84 82 86 78 78C76 72 80 66 84 64Z" fill="#34D399" />
          <ellipse cx="72" cy="60" rx="34" ry="11" stroke="white" strokeOpacity="0.45" strokeWidth="2" />
          {/* Bong bóng thoại A-Z */}
          <g transform="translate(94, 20)">
            <rect x="0" y="0" width="54" height="36" rx="12" fill="#2563EB" />
            <polygon points="12,35 22,35 10,45" fill="#2563EB" />
            <text x="27" y="24" textAnchor="middle" fill="white" fontSize="15" fontWeight="900">ABC</text>
          </g>
        </svg>
      </div>
    );
  }

  if (norm === 'lich_su_dia_li') {
    return (
      <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
        <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(234,88,12,0.16)]" fill="none">
          <ellipse cx="90" cy="108" rx="68" ry="8" fill="#EA580C" fillOpacity="0.12" />
          {/* Cuộn bản đồ cổ */}
          <rect x="34" y="34" width="84" height="54" rx="8" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
          <rect x="28" y="28" width="12" height="66" rx="6" fill="#D97706" />
          <path d="M50 68C60 52 74 72 88 54C96 44 102 48 106 54" stroke="#EA580C" strokeWidth="3" strokeDasharray="4 3" strokeLinecap="round" />
          {/* La bàn 3D */}
          <circle cx="122" cy="66" r="24" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
          <circle cx="122" cy="66" r="18" fill="white" />
          <polygon points="122,52 127,66 117,66" fill="#EF4444" />
          <polygon points="122,80 127,66 117,66" fill="#2563EB" />
        </svg>
      </div>
    );
  }

  if (norm === 'cong_nghe') {
    return (
      <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
        <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(6,182,212,0.16)]" fill="none">
          <ellipse cx="90" cy="108" rx="68" ry="8" fill="#0891B2" fillOpacity="0.12" />
          {/* Bánh răng lớn */}
          <circle cx="78" cy="62" r="28" fill="#0EA5E9" stroke="#E0F2FE" strokeWidth="4" strokeDasharray="10 5" />
          <circle cx="78" cy="62" r="12" fill="white" />
          {/* Bánh răng nhỏ cam */}
          <circle cx="122" cy="48" r="18" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="3" strokeDasharray="7 4" />
          <circle cx="122" cy="48" r="7" fill="white" />
          {/* Bảng mạch nhỏ */}
          <rect x="94" y="68" width="46" height="28" rx="6" fill="#10B981" />
          <circle cx="106" cy="82" r="3.5" fill="#FEF08A" />
          <line x1="110" y1="82" x2="130" y2="82" stroke="#FEF08A" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (norm === 'gdcd') {
    return (
      <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
        <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(225,29,72,0.14)]" fill="none">
          <ellipse cx="90" cy="108" rx="68" ry="8" fill="#E11D48" fillOpacity="0.1" />
          {/* Cán cân & Khiên */}
          <path d="M90 20L128 34V62C128 82 110 96 90 102C70 96 52 82 52 62V34L90 20Z" fill="#FB7185" stroke="#FFE4E6" strokeWidth="2" />
          <polygon points="90,42 96,55 110,57 100,66 102,80 90,73 78,80 80,66 70,57 84,55" fill="#FEF08A" />
        </svg>
      </div>
    );
  }

  // Fallback chung cho môn học khác
  return (
    <div className={`${boxClass} select-none pointer-events-none shrink-0 flex items-center justify-center`} aria-hidden="true">
      <svg viewBox="0 0 180 120" className="w-full h-full overflow-visible drop-shadow-[0_6px_10px_rgba(23,107,255,0.14)]" fill="none">
        <ellipse cx="90" cy="108" rx="68" ry="8" fill="#2563EB" fillOpacity="0.12" />
        <rect x="44" y="28" width="92" height="62" rx="10" fill="#2563EB" />
        <rect x="52" y="34" width="76" height="50" rx="5" fill="#F8FAFC" />
        <line x1="64" y1="48" x2="116" y2="48" stroke="#93C5FD" strokeWidth="4" strokeLinecap="round" />
        <line x1="64" y1="60" x2="108" y2="60" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
        <line x1="64" y1="72" x2="96" y2="72" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
};
