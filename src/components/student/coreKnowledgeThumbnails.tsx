import React from 'react';
import { CoreKnowledgeLesson } from '../../types/coreKnowledge';

/**
 * Hệ thống Minh họa 3D (SVG Shading & Gradient Nghệ thuật cao) cho phân hệ KIẾN THỨC TRỌNG TÂM
 * - Đảm bảo 100% không bao giờ lỗi ảnh (zero broken image), tải tức thì (0ms latency)
 * - Ánh xạ chính xác theo ID bài học, tên bài học, chương học, môn học và loại mục (itemType)
 */

export const HeroKnowledgeIllustration3D: React.FC = () => {
  return (
    <div className="relative w-[220px] sm:w-[260px] h-[105px] sm:h-[118px] select-none pointer-events-none shrink-0 flex items-center justify-center">
      <svg
        viewBox="0 0 320 150"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_16px_rgba(16,42,82,0.14)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="heroBulbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF59D" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#FBBF24" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroBookBlue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3898FF" />
            <stop offset="50%" stopColor="#176BFF" />
            <stop offset="100%" stopColor="#0B47B8" />
          </linearGradient>
          <linearGradient id="heroBookOrange" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="heroBookTeal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="heroBulbBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="55%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="heroLeafGreen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#86EFAC" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
          <linearGradient id="heroPages" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
        </defs>

        {/* Đám mây nền mềm mại */}
        <path
          d="M28 118C16 118 8 110 8 99C8 89 15 81 25 80C29 66 42 56 58 56C76 56 90 69 92 86C101 87 108 94 108 103C108 112 100 118 90 118H28Z"
          fill="white"
          fillOpacity="0.78"
        />
        <path
          d="M210 120C200 120 192 113 192 104C192 96 198 89 206 88C210 76 221 68 235 68C250 68 262 79 264 93C272 94 278 100 278 108C278 115 271 120 263 120H210Z"
          fill="white"
          fillOpacity="0.7"
        />

        {/* Bóng đổ mặt sàn */}
        <ellipse cx="165" cy="136" rx="118" ry="10" fill="#176BFF" fillOpacity="0.14" />

        {/* Lá cây trang trí bên trái */}
        <path
          d="M78 132C62 126 52 108 56 92C68 94 82 108 86 126L78 132Z"
          fill="url(#heroLeafGreen)"
        />
        <path
          d="M65 135C48 133 36 120 36 106C49 105 63 115 69 130L65 135Z"
          fill="#22C55E"
        />

        {/* Lá cây trang trí bên phải */}
        <path
          d="M262 132C278 126 288 110 284 94C272 96 258 110 254 126L262 132Z"
          fill="url(#heroLeafGreen)"
        />

        {/* Sách tầng dưới (Cam/Vàng 3D) */}
        <g transform="translate(82, 98)">
          <path
            d="M0 14L18 4H128L114 14H0Z"
            fill="#F97316"
          />
          <rect x="0" y="14" width="114" height="20" rx="5" fill="url(#heroBookOrange)" />
          <rect x="6" y="17" width="102" height="14" rx="3" fill="url(#heroPages)" />
          <line x1="12" y1="21" x2="98" y2="21" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="12" y1="26" x2="94" y2="26" stroke="#CBD5E1" strokeWidth="1.5" />
          <rect x="0" y="14" width="16" height="20" rx="4" fill="#EA580C" />
        </g>

        {/* Sách tầng trên (Xanh dương 3D dày) */}
        <g transform="translate(74, 70)">
          <path
            d="M4 16L26 2H144L124 16H4Z"
            fill="#3B82F6"
          />
          <rect x="0" y="14" width="126" height="24" rx="6" fill="url(#heroBookBlue)" />
          <rect x="20" y="18" width="100" height="16" rx="3" fill="url(#heroPages)" />
          <line x1="26" y1="23" x2="112" y2="23" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="26" y1="28" x2="108" y2="28" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Dây ruy-băng đánh dấu trang */}
          <path d="M68 34V44L73 40L78 44V34H68Z" fill="#EF4444" />
        </g>

        {/* Cốc đựng bút & thước bên phải */}
        <g transform="translate(216, 62)">
          {/* Thước kẻ vàng */}
          <g transform="rotate(14 26 20)">
            <rect x="18" y="0" width="14" height="48" rx="2.5" fill="#FACC15" stroke="#CA8A04" strokeWidth="1" />
            <line x1="18" y1="8" x2="23" y2="8" stroke="#854D0E" strokeWidth="1.5" />
            <line x1="18" y1="15" x2="25" y2="15" stroke="#854D0E" strokeWidth="1.5" />
            <line x1="18" y1="22" x2="23" y2="22" stroke="#854D0E" strokeWidth="1.5" />
            <line x1="18" y1="29" x2="25" y2="29" stroke="#854D0E" strokeWidth="1.5" />
          </g>
          {/* Bút chì cam */}
          <g transform="rotate(-12 12 20)">
            <rect x="6" y="6" width="9" height="40" rx="2" fill="#FB923C" />
            <polygon points="6,6 10.5,-3 15,6" fill="#FDE68A" />
            <polygon points="9,0 10.5,-3 12,0" fill="#EA580C" />
          </g>
          {/* Thân cốc */}
          <path
            d="M2 34H38L34 68C33.5 71 31 73 28 73H12C9 73 6.5 71 6 68L2 34Z"
            fill="url(#heroBookOrange)"
          />
          <ellipse cx="20" cy="34" rx="18" ry="4" fill="#FDE047" />
        </g>

        {/* Bóng đèn tri thức 3D phát sáng trên đỉnh chồng sách */}
        <g transform="translate(115, 2)">
          <circle cx="40" cy="40" r="38" fill="url(#heroBulbGlow)" />
          {/* Tia sáng */}
          <line x1="40" y1="2" x2="40" y2="10" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <line x1="10" y1="16" x2="17" y2="21" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <line x1="70" y1="16" x2="63" y2="21" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <line x1="4" y1="42" x2="12" y2="42" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <line x1="76" y1="42" x2="68" y2="42" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />

          {/* Bầu bóng đèn 3D */}
          <path
            d="M40 16C27.8 16 18 25.6 18 37.5C18 45.2 22.2 51.8 28.4 55.5C30.4 56.7 31.5 58.9 31.8 61.2H48.2C48.5 58.9 49.6 56.7 51.6 55.5C57.8 51.8 62 45.2 62 37.5C62 25.6 52.2 16 40 16Z"
            fill="url(#heroBulbBody)"
          />
          {/* Phản quang bóng đèn */}
          <path
            d="M26 32C26 25.5 31 21 37 21"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          {/* Dây tóc */}
          <path
            d="M35 55V43C35 40 37 38 40 38C43 38 45 40 45 43V55"
            stroke="#FEF08A"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Đui đèn kim loại */}
          <rect x="31" y="61" width="18" height="5" rx="2.5" fill="#94A3B8" />
          <rect x="32.5" y="66" width="15" height="4.5" rx="2" fill="#64748B" />
          <path d="M35 70.5H45L42.5 74.5H37.5L35 70.5Z" fill="#475569" />
        </g>
      </svg>
    </div>
  );
};

export const SubjectBookIllustration3D: React.FC<{
  subjectCode: string;
  grade: number | '';
}> = ({ subjectCode, grade }) => {
  const gradeLabel = grade || 6;
  const bookTitle =
    subjectCode === 'Tin'
      ? `TIN HỌC ${gradeLabel}`
      : subjectCode === 'KHTN'
        ? `KHTN ${gradeLabel}`
        : `TOÁN ${gradeLabel}`;

  return (
    <div className="relative w-[155px] sm:w-[175px] h-[112px] sm:h-[122px] select-none pointer-events-none shrink-0 flex items-center justify-center">
      <svg
        viewBox="0 0 210 150"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_16px_rgba(16,42,82,0.16)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="selBookCover" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B9EFF" />
            <stop offset="55%" stopColor="#1668F2" />
            <stop offset="100%" stopColor="#0A3FA8" />
          </linearGradient>
          <linearGradient id="selBookPink" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F472B6" />
            <stop offset="100%" stopColor="#DB2777" />
          </linearGradient>
          <linearGradient id="selCubeYellow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Bóng đổ */}
        <ellipse cx="105" cy="134" rx="86" ry="11" fill="#0D47A1" fillOpacity="0.16" />

        {/* Lá cây trang trí bên trái */}
        <path
          d="M36 116C18 110 10 92 14 74C28 77 40 92 44 110L36 116Z"
          fill="#22C55E"
        />
        <path
          d="M28 122C14 120 4 108 6 95C18 95 30 105 34 118L28 122Z"
          fill="#4ADE80"
        />

        {/* Quyển sổ hồng nghiêng phía sau */}
        <g transform="translate(36, 40) rotate(-18)">
          <rect x="0" y="0" width="52" height="72" rx="7" fill="url(#selBookPink)" />
          <rect x="6" y="4" width="44" height="64" rx="4" fill="#FCE7F3" fillOpacity="0.35" />
        </g>

        {/* Quyển sách giáo khoa chính 3D (TOÁN 6 / TIN HỌC / KHTN) */}
        <g transform="translate(56, 16) rotate(-7)">
          {/* Độ dày gáy & trang sách */}
          <rect x="6" y="6" width="84" height="104" rx="8" fill="#E2E8F0" />
          <rect x="3" y="3" width="84" height="104" rx="8" fill="#F8FAFC" />
          {/* Bìa chính */}
          <rect x="0" y="0" width="84" height="104" rx="8" fill="url(#selBookCover)" />
          {/* Gáy sách đậm */}
          <rect x="0" y="0" width="12" height="104" rx="5" fill="#0B3B91" />
          {/* Nhãn tên sách */}
          <rect x="16" y="14" width="58" height="22" rx="5" fill="white" fillOpacity="0.18" />
          <text
            x="45"
            y="29"
            textAnchor="middle"
            fill="white"
            fontSize="11.5"
            fontWeight="900"
            fontFamily="sans-serif"
            letterSpacing="0.4"
          >
            {bookTitle}
          </text>
          {/* Hình minh họa biểu đồ/hình học trên bìa sách */}
          <circle cx="45" cy="62" r="18" fill="#60A5FA" fillOpacity="0.28" stroke="#93C5FD" strokeWidth="1.5" />
          <polygon points="45,48 58,70 32,70" fill="#FDE047" fillOpacity="0.9" />
          <rect x="22" y="86" width="46" height="5" rx="2.5" fill="white" fillOpacity="0.5" />
        </g>

        {/* Khối lập phương vàng 3D bên trái */}
        <g transform="translate(34, 92)">
          <polygon points="18,0 36,8 18,16 0,8" fill="#FEF08A" />
          <polygon points="0,8 18,16 18,36 0,28" fill="#FACC15" />
          <polygon points="18,16 36,8 36,28 18,36" fill="#EA580C" fillOpacity="0.85" />
        </g>

        {/* Thước ê-ke tam giác vàng 3D */}
        <g transform="translate(106, 48)">
          <polygon
            points="44,0 68,66 0,66"
            fill="url(#selCubeYellow)"
            stroke="#CA8A04"
            strokeWidth="1.5"
             strokeLinejoin="round"
          />
          <polygon points="40,22 52,54 18,54" fill="#DBEAFE" stroke="#CA8A04" strokeWidth="1" />
        </g>

        {/* Bút chì cam 3D nằm ngang phía trước */}
        <g transform="translate(94, 114) rotate(-6)">
          <rect x="0" y="0" width="68" height="13" rx="3" fill="#FB923C" />
          <rect x="0" y="0" width="68" height="4" rx="2" fill="#FDBA74" />
          <rect x="0" y="0" width="11" height="13" rx="3" fill="#F43F5E" />
          <rect x="9" y="0" width="4" height="13" fill="#CBD5E1" />
          <polygon points="68,0 82,6.5 68,13" fill="#FDE68A" />
          <polygon points="77,4.2 82,6.5 77,8.8" fill="#1E293B" />
        </g>
      </svg>
    </div>
  );
};

export const RecentLaptopIllustration3D: React.FC = () => {
  return (
    <div className="relative w-16 h-13 select-none pointer-events-none shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 96 76" className="w-full h-full overflow-visible" fill="none">
        <ellipse cx="48" cy="66" rx="38" ry="7" fill="#176BFF" fillOpacity="0.14" />
        {/* Lá cây nhỏ */}
        <path d="M16 58C8 54 4 44 7 36C14 38 20 46 22 55L16 58Z" fill="#22C55E" />
        <path d="M78 58C86 54 90 44 87 36C80 38 74 46 72 55L78 58Z" fill="#4ADE80" />
        {/* Màn hình Laptop 3D */}
        <rect x="22" y="12" width="50" height="34" rx="5" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="1.5" />
        <rect x="25" y="15" width="44" height="28" rx="3" fill="#DBEAFE" />
        {/* Nội dung màn hình */}
        <rect x="29" y="19" width="22" height="5" rx="2" fill="#2563EB" />
        <rect x="29" y="27" width="34" height="3.5" rx="1.5" fill="#93C5FD" />
        <rect x="29" y="33" width="28" height="3.5" rx="1.5" fill="#93C5FD" />
        {/* Bàn phím nghiêng 3D */}
        <path d="M14 54L22 46H72L80 54C81 56 79 58 76 58H18C15 58 13 56 14 54Z" fill="#93C5FD" stroke="#3B82F6" strokeWidth="1.2" />
        {/* Quyển sách nhỏ bên cạnh */}
        <rect x="54" y="48" width="24" height="10" rx="2.5" fill="#F97316" />
        <rect x="56" y="50" width="20" height="6" rx="1.5" fill="#FFF7ED" />
      </svg>
    </div>
  );
};

export const SidebarFooterBooks3D: React.FC = () => {
  return (
    <div className="relative w-full h-[126px] select-none pointer-events-none overflow-hidden flex items-end justify-center">
      <svg
        viewBox="0 0 260 150"
        className="w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sbCloudGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="sbOrangeBook" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="sbBlueBook" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="sbRedBook" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>

        {/* Hoa lá trang trí 2 bên */}
        <path d="M44 114C28 104 20 84 24 66C38 72 48 88 52 108L44 114Z" fill="#22C55E" />
        <path d="M214 114C230 104 238 84 234 66C220 72 210 88 206 108L214 114Z" fill="#16A34A" />
        <circle cx="34" cy="52" r="4" fill="#FACC15" />
        <circle cx="222" cy="56" r="3.5" fill="#FACC15" />

        {/* Chồng sách 3D */}
        {/* Sách dưới cùng (Đỏ cam) */}
        <g transform="translate(56, 94)">
          <rect x="0" y="8" width="144" height="22" rx="6" fill="url(#sbRedBook)" />
          <rect x="10" y="11" width="126" height="16" rx="3" fill="#FFF1F2" />
          <line x1="16" y1="16" x2="128" y2="16" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="16" y1="21" x2="124" y2="21" stroke="#CBD5E1" strokeWidth="1.5" />
        </g>

        {/* Sách giữa (Xanh lam) */}
        <g transform="translate(64, 72)">
          <rect x="0" y="6" width="128" height="21" rx="6" fill="url(#sbBlueBook)" />
          <rect x="8" y="9" width="112" height="15" rx="3" fill="#F0F9FF" />
          <line x1="14" y1="14" x2="112" y2="14" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="14" y1="19" x2="108" y2="19" stroke="#CBD5E1" strokeWidth="1.5" />
        </g>

        {/* Sách trên cùng (Vàng cam) */}
        <g transform="translate(70, 48)">
          <path d="M6 12L28 0H122L104 12H6Z" fill="#FDBA74" />
          <rect x="0" y="10" width="114" height="20" rx="5" fill="url(#sbOrangeBook)" />
          <rect x="10" y="13" width="96" height="14" rx="3" fill="#FFFBEB" />
          <path d="M58 24V34L63 30L68 34V24H58Z" fill="#EF4444" />
        </g>

        {/* Mũ tốt nghiệp 3D trên đỉnh */}
        <g transform="translate(88, 16)">
          <polygon points="42,0 84,14 42,28 0,14" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <path d="M18 20V34C18 39 29 43 42 43C55 43 66 39 66 34V20L42 28L18 20Z" fill="#334155" />
          {/* Tua rua vàng */}
          <path d="M42 14L72 22V36" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="72" cy="37" r="3.5" fill="#FACC15" />
        </g>

        {/* Đám mây chân sidebar */}
        <path
          d="M-10 152C-10 132 8 118 28 118C36 118 44 121 50 126C58 114 72 106 88 106C108 106 125 118 131 135C138 128 148 124 160 124C178 124 193 135 198 150H-10Z"
          fill="url(#sbCloudGrad)"
        />
        <path
          d="M140 152C145 136 160 125 178 125C192 125 204 132 211 142C218 134 228 129 240 129C256 129 270 140 272 152H140Z"
          fill="url(#sbCloudGrad)"
        />
      </svg>
    </div>
  );
};

/**
 * Phân loại chủ đề trực quan của bài học để chọn hình 3D phù hợp nhất
 */
type VisualArchetype =
  | 'venn_sets'
  | 'natural_digits_abacus'
  | 'number_line_steps'
  | 'exponents_powers'
  | 'divisibility_primes'
  | 'integers_thermometer'
  | 'fractions_decimals'
  | 'algebra_functions'
  | 'geometry_2d'
  | 'geometry_3d'
  | 'statistics_charts'
  | 'probability_dice'
  | 'informatics_coding'
  | 'science_lab'
  | 'practice_target'
  | 'chapter_review_trophy';

function detectLessonVisualArchetype(lesson: CoreKnowledgeLesson): VisualArchetype {
  const id = (lesson.id || '').toLowerCase();
  const title = `${lesson.lessonLabel || ''} ${lesson.lessonTitle || ''}`.toLowerCase();
  const chapter = `${lesson.chapterLabel || ''} ${lesson.chapterTitle || ''}`.toLowerCase();

  // 1. Ưu tiên tuyệt đối cho 3 bài chuẩn trong ảnh thiết kế mẫu Toán 6 Chương I
  if (id === 'toan_6_c1_b1' || (title.includes('bài 1.') && title.includes('tập hợp'))) {
    return 'venn_sets';
  }
  if (id === 'toan_6_c1_b2' || title.includes('cách ghi số tự nhiên')) {
    return 'natural_digits_abacus';
  }
  if (id === 'toan_6_c1_b3' || title.includes('thứ tự trong tập hợp')) {
    return 'number_line_steps';
  }

  // 2. Phân loại theo loại bài đặc biệt (Luyện tập chung / Ôn tập chương / Trải nghiệm)
  if (lesson.itemType === 'chapter_review' || lesson.itemType === 'year_review' || title.includes('bài tập cuối') || title.includes('ôn tập')) {
    return 'chapter_review_trophy';
  }
  if (lesson.itemType === 'practice' || title.includes('luyện tập chung')) {
    return 'practice_target';
  }

  // 3. Môn Tin học
  if (lesson.subjectCode === 'Tin') {
    return 'informatics_coding';
  }

  // 4. Môn Khoa học tự nhiên (KHTN)
  if (lesson.subjectCode === 'KHTN') {
    return 'science_lab';
  }

  // 5. Môn Toán theo từ khóa nội dung bài học
  if (title.includes('lũy thừa') || title.includes('luỹ thừa') || title.includes('căn bậc')) {
    return 'exponents_powers';
  }
  if (
    title.includes('chia hết') ||
    title.includes('số nguyên tố') ||
    title.includes('ước') ||
    title.includes('bội') ||
    title.includes('phân tích một số')
  ) {
    return 'divisibility_primes';
  }
  if (title.includes('số nguyên') || title.includes('số hữu tỉ') || title.includes('số thực') || chapter.includes('số nguyên')) {
    return 'integers_thermometer';
  }
  if (title.includes('phân số') || title.includes('số thập phân') || title.includes('tỉ số') || title.includes('phần trăm')) {
    return 'fractions_decimals';
  }
  if (
    title.includes('xác suất') ||
    title.includes('ngẫu nhiên') ||
    title.includes('phép thử') ||
    chapter.includes('xác suất')
  ) {
    return 'probability_dice';
  }
  if (
    title.includes('thống kê') ||
    title.includes('biểu đồ') ||
    title.includes('dữ liệu') ||
    title.includes('bảng tần số') ||
    chapter.includes('thống kê') ||
    chapter.includes('dữ liệu')
  ) {
    return 'statistics_charts';
  }
  if (
    title.includes('hình trụ') ||
    title.includes('hình nón') ||
    title.includes('hình cầu') ||
    title.includes('lăng trụ') ||
    title.includes('hình chóp') ||
    title.includes('hình hộp') ||
    chapter.includes('trực quan')
  ) {
    return 'geometry_3d';
  }
  if (
    title.includes('tam giác') ||
    title.includes('tứ giác') ||
    title.includes('đường tròn') ||
    title.includes('góc') ||
    title.includes('đoạn thẳng') ||
    title.includes('đường thẳng') ||
    title.includes('hình bình hành') ||
    title.includes('hình chữ nhật') ||
    title.includes('hình thoi') ||
    title.includes('hình vuông') ||
    title.includes('đối xứng') ||
    title.includes('pythagore') ||
    title.includes('thalès') ||
    title.includes('đồng dạng') ||
    title.includes('lượng giác') ||
    chapter.includes('hình học')
  ) {
    return 'geometry_2d';
  }
  if (
    title.includes('đa thức') ||
    title.includes('đơn thức') ||
    title.includes('hằng đẳng thức') ||
    title.includes('phân thức') ||
    title.includes('phương trình') ||
    title.includes('hàm số') ||
    title.includes('bất đẳng thức') ||
    title.includes('biểu thức')
  ) {
    return 'algebra_functions';
  }

  // Mặc định cho các bài phép tính số tự nhiên (Bài 4, 5...)
  if ((lesson.lessonNumber || 1) % 3 === 1) return 'venn_sets';
  if ((lesson.lessonNumber || 1) % 3 === 2) return 'natural_digits_abacus';
  return 'number_line_steps';
}

export const LessonCardIllustration3D: React.FC<{
  lesson: CoreKnowledgeLesson;
}> = ({ lesson }) => {
  const archetype = detectLessonVisualArchetype(lesson);

  return (
    <div className="relative w-full h-[142px] sm:h-[150px] flex items-center justify-center select-none pointer-events-none overflow-hidden rounded-xl">
      {archetype === 'venn_sets' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          {/* Bóng mặt bàn */}
          <ellipse cx="170" cy="148" rx="135" ry="12" fill="#1D4ED8" fillOpacity="0.12" />
          {/* Lá cây & Khối lập phương vàng bên trái */}
          <path d="M40 132C24 122 16 102 22 84C36 88 46 104 48 124L40 132Z" fill="#22C55E" />
          <path d="M30 136C16 132 8 118 10 104C22 106 32 118 36 132L30 136Z" fill="#4ADE80" />
          <g transform="translate(22, 114)">
            <polygon points="16,0 32,7 16,14 0,7" fill="#FEF08A" />
            <polygon points="0,7 16,14 16,32 0,25" fill="#FACC15" />
            <polygon points="16,14 32,7 32,25 16,32" fill="#EA580C" fillOpacity="0.85" />
          </g>
          {/* Lá cây bên phải */}
          <path d="M300 134C314 124 322 106 318 88C304 92 294 108 292 126L300 134Z" fill="#22C55E" />

          {/* Biểu đồ Venn 3D: Tập A và Tập B */}
          {/* Vòng Tập A */}
          <ellipse
            cx="140"
            cy="86"
            rx="66"
            ry="50"
            fill="#93C5FD"
            fillOpacity="0.38"
            stroke="#3B82F6"
            strokeWidth="5"
          />
          {/* Vòng Tập B */}
          <ellipse
            cx="204"
            cy="86"
            rx="66"
            ry="50"
            fill="#F5D0FE"
            fillOpacity="0.45"
            stroke="#C084FC"
            strokeWidth="5"
          />

          {/* Nhãn A (Xanh 3D) */}
          <g transform="translate(68, 22)">
            <rect x="0" y="0" width="32" height="30" rx="8" fill="#1D4ED8" />
            <rect x="0" y="0" width="32" height="27" rx="8" fill="#2563EB" />
            <text x="16" y="19" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">
              A
            </text>
          </g>

          {/* Nhãn B (Tím 3D) */}
          <g transform="translate(242, 22)">
            <rect x="0" y="0" width="32" height="30" rx="8" fill="#7E22CE" />
            <rect x="0" y="0" width="32" height="27" rx="8" fill="#9333EA" />
            <text x="16" y="19" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">
              B
            </text>
          </g>

          {/* 3 Quả táo đỏ 3D trong tập A */}
          {[
            { x: 118, y: 64 },
            { x: 104, y: 98 },
            { x: 138, y: 98 }
          ].map((pos, idx) => (
            <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
              <circle cx="0" cy="4" r="12" fill="#DC2626" />
              <circle cx="-3" cy="1" r="4" fill="#FCA5A5" fillOpacity="0.65" />
              <path d="M0 -8C2 -12 6 -13 9 -10C6 -6 3 -6 0 -8Z" fill="#16A34A" />
              <line x1="0" y1="-6" x2="0" y2="-11" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}

          {/* 3 Ngôi sao vàng 3D trong tập B */}
          {[
            { x: 222, y: 64 },
            { x: 204, y: 96 },
            { x: 238, y: 98 }
          ].map((pos, idx) => (
            <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
              <polygon
                points="0,-13 4,-4 13,-3 6,4 8,13 0,8 -8,13 -6,4 -13,-3 -4,-4"
                fill="#FACC15"
                stroke="#EA580C"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {/* Nhãn A ∪ B nổi 3D ở đáy */}
          <g transform="translate(132, 122)">
            <rect x="0" y="3" width="80" height="28" rx="14" fill="#94A3B8" />
            <rect x="0" y="0" width="80" height="28" rx="14" fill="white" stroke="#CBD5E1" strokeWidth="1.5" />
            <text
              x="40"
              y="19"
              textAnchor="middle"
              fill="#1E3A8A"
              fontSize="15"
              fontWeight="900"
              letterSpacing="1"
            >
              A ∪ B
            </text>
          </g>
        </svg>
      )}

      {archetype === 'natural_digits_abacus' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="150" rx="142" ry="11" fill="#059669" fillOpacity="0.13" />
          {/* Chồng sách góc trái */}
          <g transform="translate(12, 114)">
            <rect x="0" y="14" width="48" height="12" rx="3" fill="#F97316" />
            <rect x="4" y="4" width="44" height="11" rx="3" fill="#2563EB" />
            <rect x="8" y="6" width="36" height="7" rx="1.5" fill="white" />
          </g>

          {/* Dãy chữ số 3D bóng bẩy: Hàng trên 0 1 2 3 4 */}
          <g transform="translate(56, 22)">
            <text x="0" y="42" fill="#16A34A" fontSize="42" fontWeight="900" stroke="white" strokeWidth="2">0</text>
            <text x="32" y="40" fill="#2563EB" fontSize="42" fontWeight="900" stroke="white" strokeWidth="2">1</text>
            <text x="58" y="40" fill="#EA580C" fontSize="42" fontWeight="900" stroke="white" strokeWidth="2">2</text>
            <text x="88" y="40" fill="#0284C7" fontSize="42" fontWeight="900" stroke="white" strokeWidth="2">3</text>
            <text x="118" y="40" fill="#EAB308" fontSize="42" fontWeight="900" stroke="white" strokeWidth="2">4</text>
          </g>

          {/* Dãy chữ số 3D bóng bẩy: Hàng dưới 5 6 7 8 9 */}
          <g transform="translate(60, 74)">
            <text x="0" y="46" fill="#EF4444" fontSize="44" fontWeight="900" stroke="white" strokeWidth="2">5</text>
            <text x="32" y="46" fill="#F59E0B" fontSize="44" fontWeight="900" stroke="white" strokeWidth="2">6</text>
            <text x="62" y="46" fill="#10B981" fontSize="44" fontWeight="900" stroke="white" strokeWidth="2">7</text>
            <text x="90" y="46" fill="#3B82F6" fontSize="44" fontWeight="900" stroke="white" strokeWidth="2">8</text>
            <text x="120" y="46" fill="#A855F7" fontSize="44" fontWeight="900" stroke="white" strokeWidth="2">9</text>
          </g>

          {/* Bàn tính gỗ 3D bên phải */}
          <g transform="translate(220, 26) rotate(4)">
            {/* Khung gỗ */}
            <rect x="0" y="0" width="96" height="112" rx="10" fill="#D97706" stroke="#92400E" strokeWidth="2" />
            <rect x="10" y="10" width="76" height="92" rx="5" fill="#FEF3C7" />
            {/* 4 Thanh ngang bàn tính */}
            {[26, 48, 70, 90].map((ry, rIdx) => (
              <g key={rIdx}>
                <line x1="10" y1={ry} x2="86" y2={ry} stroke="#92400E" strokeWidth="2.5" />
                {[22, 35, 48, 61, 74].map((cx, bIdx) => {
                  const colors = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#3B82F6'];
                  return (
                    <ellipse
                      key={bIdx}
                      cx={cx}
                      cy={ry}
                      rx="5.5"
                      ry="6.5"
                      fill={colors[(rIdx + bIdx) % colors.length]}
                    />
                  );
                })}
              </g>
            ))}
          </g>
        </svg>
      )}

      {archetype === 'number_line_steps' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="150" rx="142" ry="11" fill="#D97706" fillOpacity="0.14" />

          {/* Mũi tên vàng đi lên biểu thị thứ tự tăng dần */}
          <path
            d="M78 76C106 66 132 50 156 26"
            stroke="#F59E0B"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <polygon points="164,18 145,24 159,37" fill="#F59E0B" />

          {/* Ba bậc thang 3D: 1 (Cam) -> 2 (Vàng) -> 3 (Xanh lá) */}
          {/* Bậc 1 */}
          <g transform="translate(120, 62)">
            <rect x="0" y="0" width="42" height="38" rx="6" fill="#F97316" />
            <text x="21" y="26" textAnchor="middle" fill="white" fontSize="22" fontWeight="900">1</text>
          </g>
          {/* Bậc 2 */}
          <g transform="translate(162, 42)">
            <rect x="0" y="0" width="42" height="58" rx="6" fill="#F59E0B" />
            <text x="21" y="34" textAnchor="middle" fill="white" fontSize="24" fontWeight="900">2</text>
          </g>
          {/* Bậc 3 */}
          <g transform="translate(204, 22)">
            <rect x="0" y="0" width="44" height="78" rx="6" fill="#22C55E" />
            <text x="22" y="42" textAnchor="middle" fill="white" fontSize="26" fontWeight="900">3</text>
          </g>

          {/* Trục số tia số tự nhiên 3D phía dưới */}
          <g transform="translate(28, 96)">
            <rect x="0" y="0" width="260" height="48" rx="12" fill="white" stroke="#CBD5E1" strokeWidth="2" />
            {/* Trục mũi tên xanh */}
            <line x1="18" y1="18" x2="236" y2="18" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
            <polygon points="246,18 232,11 232,25" fill="#2563EB" />
            {/* Các vạch chia 0, 1, 2, 3, 4, 5, ... */}
            {[0, 1, 2, 3, 4, 5].map((num, idx) => {
              const xPos = 26 + idx * 36;
              return (
                <g key={num}>
                  <line x1={xPos} y1="11" x2={xPos} y2="25" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" />
                  <text x={xPos} y="41" textAnchor="middle" fill="#0F172A" fontSize="15" fontWeight="900">
                    {num}
                  </text>
                </g>
              );
            })}
            <text x="230" y="40" textAnchor="middle" fill="#1D4ED8" fontSize="15" fontWeight="900">
              ...
            </text>
          </g>

          {/* Chồng sách góc phải */}
          <g transform="translate(292, 108)">
            <rect x="0" y="18" width="42" height="12" rx="3" fill="#EC4899" />
            <rect x="2" y="6" width="38" height="12" rx="3" fill="#F59E0B" />
          </g>
        </svg>
      )}

      {archetype === 'exponents_powers' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#2563EB" fillOpacity="0.14" />
          {/* Khối lập phương 2^3 = 8 */}
          <g transform="translate(52, 34)">
            <rect x="0" y="0" width="96" height="86" rx="16" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="2" />
            <text x="48" y="54" textAnchor="middle" fill="#1D4ED8" fontSize="34" fontWeight="900">
              aⁿ
            </text>
            <text x="48" y="76" textAnchor="middle" fill="#1E40AF" fontSize="13" fontWeight="800">
              2³ = 8
            </text>
          </g>
          {/* Các khối lập phương 3D xếp tầng bên phải */}
          <g transform="translate(176, 30)">
            {[
              { x: 0, y: 54, c1: '#60A5FA', c2: '#2563EB', c3: '#1D4ED8' },
              { x: 38, y: 54, c1: '#60A5FA', c2: '#2563EB', c3: '#1D4ED8' },
              { x: 19, y: 24, c1: '#FDE047', c2: '#FACC15', c3: '#EA580C' },
              { x: 57, y: 24, c1: '#4ADE80', c2: '#22C55E', c3: '#15803D' }
            ].map((cube, i) => (
              <g key={i} transform={`translate(${cube.x}, ${cube.y})`}>
                <polygon points="22,0 44,10 22,20 0,10" fill={cube.c1} />
                <polygon points="0,10 22,20 22,44 0,34" fill={cube.c2} />
                <polygon points="22,20 44,10 44,34 22,44" fill={cube.c3} />
              </g>
            ))}
          </g>
        </svg>
      )}

      {archetype === 'divisibility_primes' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#059669" fillOpacity="0.14" />
          {/* Sơ đồ cây phân tích thừa số nguyên tố */}
          <line x1="170" y1="42" x2="115" y2="88" stroke="#059669" strokeWidth="4" />
          <line x1="170" y1="42" x2="225" y2="88" stroke="#059669" strokeWidth="4" />
          <line x1="225" y1="88" x2="195" y2="128" stroke="#059669" strokeWidth="3.5" />
          <line x1="225" y1="88" x2="255" y2="128" stroke="#059669" strokeWidth="3.5" />

          {/* Đỉnh 12 */}
          <circle cx="170" cy="36" r="22" fill="#2563EB" stroke="white" strokeWidth="3" />
          <text x="170" y="42" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">12</text>

          {/* Nhánh trái: Số nguyên tố 3 */}
          <circle cx="115" cy="90" r="20" fill="#10B981" stroke="white" strokeWidth="3" />
          <text x="115" y="96" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">3</text>

          {/* Nhánh phải: Hợp số 4 */}
          <circle cx="225" cy="90" r="20" fill="#F59E0B" stroke="white" strokeWidth="3" />
          <text x="225" y="96" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">4</text>

          {/* Lá nguyên tố 2 và 2 */}
          <circle cx="195" cy="128" r="16" fill="#10B981" stroke="white" strokeWidth="2.5" />
          <text x="195" y="133" textAnchor="middle" fill="white" fontSize="14" fontWeight="900">2</text>
          <circle cx="255" cy="128" r="16" fill="#10B981" stroke="white" strokeWidth="2.5" />
          <text x="255" y="133" textAnchor="middle" fill="white" fontSize="14" fontWeight="900">2</text>
        </svg>
      )}

      {archetype === 'integers_thermometer' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="138" ry="11" fill="#0284C7" fillOpacity="0.14" />
          {/* Trục số nguyên âm - dương */}
          <g transform="translate(26, 78)">
            <rect x="0" y="0" width="288" height="52" rx="14" fill="white" stroke="#BAE6FD" strokeWidth="2" />
            <line x1="18" y1="22" x2="270" y2="22" stroke="#0284C7" strokeWidth="3.5" />
            {[-3, -2, -1, 0, 1, 2, 3].map((n, i) => {
              const x = 36 + i * 36;
              const color = n < 0 ? '#EF4444' : n === 0 ? '#0F172A' : '#16A34A';
              return (
                <g key={n}>
                  <circle cx={x} cy="22" r="4.5" fill={color} />
                  <text x={x} y="42" textAnchor="middle" fill={color} fontSize="14" fontWeight="900">
                    {n > 0 ? `+${n}` : n}
                  </text>
                </g>
              );
            })}
          </g>
          {/* Huy hiệu Âm & Dương phía trên */}
          <rect x="64" y="24" width="86" height="36" rx="10" fill="#FEE2E2" stroke="#FCA5A5" strokeWidth="1.5" />
          <text x="107" y="47" textAnchor="middle" fill="#DC2626" fontSize="15" fontWeight="900">Số âm (-)</text>
          <rect x="190" y="24" width="86" height="36" rx="10" fill="#DCFCE7" stroke="#86EFAC" strokeWidth="1.5" />
          <text x="233" y="47" textAnchor="middle" fill="#15803D" fontSize="15" fontWeight="900">Số dương (+)</text>
        </svg>
      )}

      {archetype === 'fractions_decimals' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#EA580C" fillOpacity="0.14" />
          {/* Biểu đồ tròn phân số 3/4 */}
          <g transform="translate(95, 82)">
            <circle cx="0" cy="0" r="46" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="3" />
            <path d="M0 0V-46A46 46 0 1 1 -46 0Z" fill="#2563EB" />
            <path d="M6 -6V-52A46 46 0 0 0 -40 -6Z" fill="#F97316" />
          </g>
          {/* Thẻ phân số a/b = 0,75 */}
          <g transform="translate(174, 34)">
            <rect x="0" y="0" width="122" height="94" rx="16" fill="white" stroke="#CBD5E1" strokeWidth="2" />
            <text x="36" y="40" textAnchor="middle" fill="#2563EB" fontSize="24" fontWeight="900">3</text>
            <line x1="20" y1="48" x2="52" y2="48" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
            <text x="36" y="74" textAnchor="middle" fill="#EA580C" fontSize="24" fontWeight="900">4</text>
            <text x="86" y="55" textAnchor="middle" fill="#059669" fontSize="19" fontWeight="900">= 75%</text>
          </g>
        </svg>
      )}

      {archetype === 'algebra_functions' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#2563EB" fillOpacity="0.14" />
          {/* Mặt phẳng tọa độ Oxy & Đồ thị Parabol / Đường thẳng */}
          <g transform="translate(46, 18)">
            <rect x="0" y="0" width="136" height="116" rx="14" fill="white" stroke="#BFDBFE" strokeWidth="2" />
            <line x1="18" y1="94" x2="122" y2="94" stroke="#64748B" strokeWidth="2" />
            <line x1="68" y1="14" x2="68" y2="104" stroke="#64748B" strokeWidth="2" />
            <path d="M26 86Q68 18 112 30" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="68" cy="52" r="5" fill="#EF4444" />
          </g>
          {/* Khối công thức đại số */}
          <g transform="translate(196, 36)">
            <rect x="0" y="0" width="108" height="40" rx="10" fill="#2563EB" />
            <text x="54" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">y = ax + b</text>
            <rect x="0" y="50" width="108" height="40" rx="10" fill="#10B981" />
            <text x="54" y="76" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">(a + b)²</text>
          </g>
        </svg>
      )}

      {archetype === 'geometry_2d' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#0284C7" fillOpacity="0.14" />
          {/* Tam giác, Đường tròn & Thước đo độ */}
          <circle cx="110" cy="84" r="44" fill="#E0F2FE" stroke="#0284C7" strokeWidth="3.5" />
          <polygon
            points="175,28 232,126 118,126"
            fill="#FEF08A"
            fillOpacity="0.88"
            stroke="#EA580C"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Ký hiệu góc vuông */}
          <rect x="170" y="112" width="14" height="14" stroke="#2563EB" strokeWidth="2" />
          {/* Compa 3D bên phải */}
          <g transform="translate(248, 30)">
            <line x1="20" y1="10" x2="4" y2="96" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
            <line x1="20" y1="10" x2="38" y2="96" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" />
            <circle cx="20" cy="10" r="8" fill="#F59E0B" />
          </g>
        </svg>
      )}

      {archetype === 'geometry_3d' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="138" ry="11" fill="#7C3AED" fillOpacity="0.14" />
          {/* Hình trụ 3D */}
          <g transform="translate(52, 36)">
            <rect x="0" y="14" width="58" height="74" fill="#60A5FA" />
            <ellipse cx="29" cy="14" rx="29" ry="10" fill="#93C5FD" stroke="#2563EB" strokeWidth="2" />
            <ellipse cx="29" cy="88" rx="29" ry="10" fill="#2563EB" />
          </g>
          {/* Hình chóp / Nón 3D */}
          <g transform="translate(138, 28)">
            <polygon points="36,0 72,92 0,92" fill="#FBBF24" />
            <polygon points="36,0 72,92 36,102" fill="#D97706" />
          </g>
          {/* Hình cầu 3D */}
          <g transform="translate(232, 46)">
            <circle cx="38" cy="38" r="38" fill="#EC4899" />
            <ellipse cx="38" cy="38" rx="38" ry="12" stroke="white" strokeWidth="2" strokeDasharray="4 3" />
            <circle cx="26" cy="24" r="10" fill="#FBCFE8" fillOpacity="0.6" />
          </g>
        </svg>
      )}

      {archetype === 'statistics_charts' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#10B981" fillOpacity="0.14" />
          {/* Biểu đồ cột 3D */}
          <g transform="translate(56, 26)">
            <rect x="0" y="64" width="32" height="46" rx="5" fill="#3B82F6" />
            <rect x="44" y="38" width="32" height="72" rx="5" fill="#10B981" />
            <rect x="88" y="18" width="32" height="92" rx="5" fill="#F59E0B" />
            <rect x="132" y="48" width="32" height="62" rx="5" fill="#8B5CF6" />
            <line x1="-10" y1="110" x2="180" y2="110" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            {/* Đường xu hướng */}
            <polyline points="16,56 60,30 104,10 148,40" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          {/* Biểu đồ quạt tròn bên phải */}
          <g transform="translate(268, 82)">
            <circle cx="0" cy="0" r="36" fill="#3B82F6" />
            <path d="M0 0V-36A36 36 0 0 1 34 12Z" fill="#FACC15" />
            <path d="M0 0L34 12A36 36 0 0 1 -24 26Z" fill="#10B981" />
          </g>
        </svg>
      )}

      {archetype === 'probability_dice' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#EA580C" fillOpacity="0.14" />
          {/* Xúc xắc 3D */}
          <g transform="translate(74, 34) rotate(-8)">
            <rect x="0" y="0" width="74" height="74" rx="16" fill="white" stroke="#CBD5E1" strokeWidth="2.5" />
            <circle cx="22" cy="22" r="6" fill="#EF4444" />
            <circle cx="52" cy="22" r="6" fill="#1E293B" />
            <circle cx="37" cy="37" r="6.5" fill="#EF4444" />
            <circle cx="22" cy="52" r="6" fill="#1E293B" />
            <circle cx="52" cy="52" r="6" fill="#EF4444" />
          </g>
          {/* Vòng quay xác suất */}
          <g transform="translate(218, 78)">
            <circle cx="0" cy="0" r="44" fill="#FDE047" stroke="#CA8A04" strokeWidth="3" />
            <path d="M0 0V-44A44 44 0 0 1 44 0Z" fill="#3B82F6" />
            <path d="M0 0H44A44 44 0 0 1 0 44Z" fill="#10B981" />
            <path d="M0 0V44A44 44 0 0 1 -44 0Z" fill="#EC4899" />
            <circle cx="0" cy="0" r="8" fill="white" />
          </g>
        </svg>
      )}

      {archetype === 'informatics_coding' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="138" ry="11" fill="#0284C7" fillOpacity="0.14" />
          {/* Màn hình máy tính & Khối thuật toán */}
          <g transform="translate(78, 22)">
            <rect x="0" y="0" width="144" height="92" rx="12" fill="#0F172A" stroke="#38BDF8" strokeWidth="3" />
            <rect x="10" y="10" width="124" height="72" rx="6" fill="#1E293B" />
            {/* Code lines */}
            <rect x="20" y="20" width="46" height="7" rx="3.5" fill="#38BDF8" />
            <rect x="20" y="34" width="84" height="7" rx="3.5" fill="#4ADE80" />
            <rect x="32" y="48" width="68" height="7" rx="3.5" fill="#FACC15" />
            <rect x="20" y="62" width="52" height="7" rx="3.5" fill="#F472B6" />
            {/* Chân đế màn hình */}
            <rect x="58" y="92" width="28" height="14" fill="#64748B" />
            <rect x="38" y="106" width="68" height="8" rx="4" fill="#475569" />
          </g>
          {/* Biểu tượng AI / Nhị phân */}
          <g transform="translate(238, 42)">
            <rect x="0" y="0" width="66" height="52" rx="12" fill="#2563EB" />
            <text x="33" y="32" textAnchor="middle" fill="white" fontSize="18" fontWeight="900">
              {'</>'}
            </text>
          </g>
        </svg>
      )}

      {archetype === 'science_lab' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="138" ry="11" fill="#10B981" fillOpacity="0.14" />
          {/* Bình tam giác thí nghiệm Hóa - Sinh */}
          <g transform="translate(76, 24)">
            <path
              d="M34 10H54V40L80 96C83 103 78 110 70 110H18C10 110 5 103 8 96L34 40V10Z"
              fill="#E0F2FE"
              stroke="#0284C7"
              strokeWidth="3"
            />
            <path
              d="M19 72H69L80 96C83 103 78 110 70 110H18C10 110 5 103 8 96L19 72Z"
              fill="#10B981"
            />
            <circle cx="44" cy="56" r="5" fill="#34D399" />
            <circle cx="52" cy="40" r="3.5" fill="#34D399" />
          </g>
          {/* Mô hình nguyên tử Vật lý / Hóa học */}
          <g transform="translate(226, 80)">
            <ellipse cx="0" cy="0" rx="46" ry="18" stroke="#2563EB" strokeWidth="2.5" transform="rotate(30)" />
            <ellipse cx="0" cy="0" rx="46" ry="18" stroke="#8B5CF6" strokeWidth="2.5" transform="rotate(-30)" />
            <circle cx="0" cy="0" r="11" fill="#F59E0B" />
            <circle cx="34" cy="-18" r="5" fill="#38BDF8" />
            <circle cx="-34" cy="18" r="5" fill="#C084FC" />
          </g>
        </svg>
      )}

      {archetype === 'practice_target' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#2563EB" fillOpacity="0.14" />
          {/* Bia mục tiêu 3D & Phiếu luyện tập */}
          <g transform="translate(115, 82)">
            <circle cx="0" cy="0" r="46" fill="#EF4444" />
            <circle cx="0" cy="0" r="33" fill="white" />
            <circle cx="0" cy="0" r="20" fill="#EF4444" />
            <circle cx="0" cy="0" r="8" fill="#FACC15" />
          </g>
          {/* Bảng tích xanh hoàn thành bài tập */}
          <g transform="translate(188, 30)">
            <rect x="0" y="0" width="84" height="96" rx="12" fill="white" stroke="#93C5FD" strokeWidth="2.5" />
            <circle cx="22" cy="28" r="8" fill="#22C55E" />
            <rect x="36" y="24" width="36" height="7" rx="3.5" fill="#3B82F6" />
            <circle cx="22" cy="52" r="8" fill="#22C55E" />
            <rect x="36" y="48" width="36" height="7" rx="3.5" fill="#3B82F6" />
            <circle cx="22" cy="76" r="8" fill="#F59E0B" />
            <rect x="36" y="72" width="30" height="7" rx="3.5" fill="#94A3B8" />
          </g>
        </svg>
      )}

      {archetype === 'chapter_review_trophy' && (
        <svg viewBox="0 0 340 165" className="w-full h-full overflow-visible" fill="none">
          <ellipse cx="170" cy="148" rx="135" ry="11" fill="#D97706" fillOpacity="0.16" />
          {/* Cúp vàng tổng kết chương */}
          <g transform="translate(128, 22)">
            <path d="M16 12H68V46C68 66 56 80 42 80C28 80 16 66 16 46V12Z" fill="#FACC15" stroke="#CA8A04" strokeWidth="2" />
            <rect x="34" y="80" width="16" height="20" fill="#D97706" />
            <rect x="18" y="100" width="48" height="14" rx="4" fill="#92400E" />
            <polygon points="42,24 47,36 60,37 50,46 53,58 42,51 31,58 34,46 24,37 37,36" fill="#FFFBEB" />
          </g>
        </svg>
      )}
    </div>
  );
};
