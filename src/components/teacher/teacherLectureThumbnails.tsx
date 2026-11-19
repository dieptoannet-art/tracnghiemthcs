import React from 'react';
import { LectureItem } from './TeacherLectures';

/**
 * Hệ thống minh họa 3D SVG đồng bộ phong cách "Kiến thức trọng tâm" cho Thư viện bài giảng:
 * - Tải tức thì (0ms), không phụ thuộc URL ngoài, không lỗi ảnh vỡ
 * - Phối màu pastel dịu mắt, ánh sáng mềm, không dùng emoji phóng to
 * - Ánh xạ ổn định theo item.id, sau đó mới xét từ khóa chủ đề / môn học / itemType
 */

export const LectureHeroBookBadge3D: React.FC = () => {
  return (
    <div
      className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#4BA9FF] via-[#1C74FF] to-[#0852D6] shadow-[0_10px_22px_-6px_rgba(8,102,255,0.45)] border border-white/70 flex items-center justify-center shrink-0 select-none pointer-events-none"
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-11 sm:h-11 overflow-visible" fill="none">
        <defs>
          <linearGradient id="tlHeroBookSide" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <g transform="rotate(-8 32 32)">
          {/* Độ dày trang sách */}
          <rect x="13" y="13" width="38" height="41" rx="6" fill="#E0F2FE" />
          <rect x="11" y="11" width="38" height="41" rx="6" fill="url(#tlHeroBookSide)" stroke="white" strokeOpacity="0.65" strokeWidth="1.5" />
          {/* Gáy sách */}
          <rect x="11" y="11" width="7" height="41" rx="3.5" fill="#1E40AF" />
          {/* Sách mở nhỏ bên trên bìa */}
          <path
            d="M23 23C27 21 31 22 33 24C35 22 39 21 43 23V37C39 35.5 35 36.5 33 38.5C31 36.5 27 35.5 23 37V23Z"
            stroke="white"
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill="white"
            fillOpacity="0.16"
          />
          <line x1="33" y1="24" x2="33" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* Dây ruy-băng vàng */}
          <path d="M22 49V56L25 53.5L28 56V49H22Z" fill="#FACC15" />
        </g>
      </svg>
    </div>
  );
};

export const LectureHeroIllustration3D: React.FC = () => {
  return (
    <div
      className="relative w-[240px] sm:w-[290px] lg:w-[330px] h-[112px] sm:h-[126px] select-none pointer-events-none shrink-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 380 156"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_18px_rgba(16,42,82,0.14)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="tlScreenFrame" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="tlCubeOrange" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <linearGradient id="tlConeMint" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
        </defs>

        {/* Bóng đổ mặt sàn */}
        <ellipse cx="195" cy="142" rx="160" ry="10" fill="#176BFF" fillOpacity="0.14" />

        {/* Lá cây trang trí bên trái */}
        <path d="M52 132C34 124 24 104 30 86C44 90 56 106 60 126L52 132Z" fill="#22C55E" />
        <path d="M40 136C22 132 12 118 14 103C28 104 42 116 46 131L40 136Z" fill="#4ADE80" />

        {/* Màn chiếu giảng dạy 3D trung tâm */}
        <g transform="translate(116, 12)">
          {/* Thanh treo trên */}
          <rect x="6" y="0" width="160" height="10" rx="5" fill="#94A3B8" />
          {/* Bảng màn chiếu */}
          <rect x="14" y="8" width="144" height="90" rx="10" fill="white" stroke="#BFDBFE" strokeWidth="2.5" />
          <rect x="20" y="14" width="132" height="78" rx="6" fill="#EFF6FF" />

          {/* Biểu đồ cột trên màn chiếu */}
          <rect x="32" y="54" width="13" height="26" rx="3.5" fill="#60A5FA" />
          <rect x="50" y="42" width="13" height="38" rx="3.5" fill="#3B82F6" />
          <rect x="68" y="30" width="13" height="50" rx="3.5" fill="#1D4ED8" />

          {/* Biểu đồ tròn trên màn chiếu */}
          <g transform="translate(116, 52)">
            <circle cx="0" cy="0" r="24" fill="#F59E0B" />
            <path d="M0 0V-24A24 24 0 0 1 22 10Z" fill="#3B82F6" />
            <path d="M0 0L22 10A24 24 0 0 1 -12 20Z" fill="#22C55E" />
          </g>

          {/* Chân đế màn chiếu */}
          <rect x="81" y="98" width="10" height="24" rx="3" fill="#64748B" />
          <rect x="64" y="118" width="44" height="8" rx="4" fill="#475569" />
        </g>

        {/* Sách mở 3D bên trái */}
        <g transform="translate(52, 74)">
          <path d="M0 16L48 6L96 16V62L48 54L0 62V16Z" fill="#2563EB" />
          <path d="M5 13C20 8 36 9 48 16V54C36 48 20 47 5 52V13Z" fill="#FFFBEB" stroke="#E2E8F0" strokeWidth="1.2" />
          <path d="M91 13C76 8 60 9 48 16V54C60 48 76 47 91 52V13Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.2" />
          <line x1="14" y1="24" x2="38" y2="27" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="14" y1="33" x2="38" y2="36" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="58" y1="27" x2="82" y2="24" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="58" y1="36" x2="82" y2="33" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Bút chì vàng 3D phía trước */}
        <g transform="translate(154, 122) rotate(-7)">
          <rect x="0" y="0" width="66" height="12" rx="3" fill="#FACC15" />
          <rect x="0" y="0" width="66" height="4" rx="2" fill="#FEF08A" />
          <rect x="0" y="0" width="11" height="12" rx="3" fill="#FB7185" />
          <rect x="10" y="0" width="4" height="12" fill="#CBD5E1" />
          <polygon points="66,0 80,6 66,12" fill="#FDE68A" />
          <polygon points="75,4 80,6 75,8" fill="#1E293B" />
        </g>

        {/* Khối lập phương cam & khối nón xanh mint bên phải */}
        <g transform="translate(274, 68)">
          {/* Khối lập phương cam */}
          <polygon points="24,0 48,11 24,22 0,11" fill="#FEF08A" />
          <polygon points="0,11 24,22 24,52 0,41" fill="#F59E0B" />
          <polygon points="24,22 48,11 48,41 24,52" fill="#EA580C" />
        </g>
        <g transform="translate(312, 74)">
          {/* Hình chóp / nón xanh mint */}
          <polygon points="26,0 52,54 0,54" fill="url(#tlConeMint)" />
          <polygon points="26,0 52,54 26,60" fill="#15803D" />
        </g>
        {/* Khối cầu xanh dương nhỏ phía trước */}
        <circle cx="288" cy="128" r="14" fill="#2563EB" />
        <circle cx="283" cy="123" r="4.5" fill="#93C5FD" fillOpacity="0.7" />
      </svg>
    </div>
  );
};

type LectureArchetype =
  | 'venn_apples_stars'
  | 'digits_abacus'
  | 'number_line_staircase'
  | 'add_sub_cubes'
  | 'mul_div_arrays'
  | 'exponents_cubes'
  | 'order_of_operations'
  | 'divisibility_relation'
  | 'divisibility_signs'
  | 'prime_numbers_tree'
  | 'gcd_overlap'
  | 'lcm_jumps'
  | 'integers_thermometer'
  | 'integers_add_sub'
  | 'bracket_sign_rules'
  | 'integers_multiply'
  | 'integers_divisibility'
  | 'regular_polygons'
  | 'quadrilaterals_family'
  | 'perimeter_area_grid'
  | 'axial_symmetry'
  | 'central_symmetry'
  | 'activity_card_room'
  | 'activity_geogebra'
  | 'activity_calculator'
  | 'practice_notebook'
  | 'chapter_review_trophy'
  | 'informatics_screen'
  | 'science_experiment'
  | 'default_lesson';

const ID_TO_ARCHETYPE: Record<string, LectureArchetype> = {
  toan_6_c1_b1: 'venn_apples_stars',
  toan_6_c1_b2: 'digits_abacus',
  toan_6_c1_b3: 'number_line_staircase',
  toan_6_c1_b4: 'add_sub_cubes',
  toan_6_c1_b5: 'mul_div_arrays',
  toan_6_c1_b6: 'exponents_cubes',
  toan_6_c1_b7: 'order_of_operations',
  toan_6_c2_b8: 'divisibility_relation',
  toan_6_c2_b9: 'divisibility_signs',
  toan_6_c2_b10: 'prime_numbers_tree',
  toan_6_c2_b11: 'gcd_overlap',
  toan_6_c2_b12: 'lcm_jumps',
  toan_6_c3_b13: 'integers_thermometer',
  toan_6_c3_b14: 'integers_add_sub',
  toan_6_c3_b15: 'bracket_sign_rules',
  toan_6_c3_b16: 'integers_multiply',
  toan_6_c3_b17: 'integers_divisibility',
  toan_6_c4_b18: 'regular_polygons',
  toan_6_c4_b19: 'quadrilaterals_family',
  toan_6_c4_b20: 'perimeter_area_grid',
  toan_6_c5_b21: 'axial_symmetry',
  toan_6_c5_b22: 'central_symmetry',
  toan_6_hdtn_t1_hd1: 'activity_card_room',
  toan_6_hdtn_t1_hd2: 'activity_geogebra',
  toan_6_hdtn_t1_hd3: 'activity_calculator',
  toan_9_c1_b1: 'activity_geogebra',
  toan_9_c1_b2: 'add_sub_cubes',
  toan_9_c1_b3: 'mul_div_arrays',
  toan_9_c2_b4: 'bracket_sign_rules',
  toan_9_c2_b5: 'number_line_staircase'
};

function resolveLectureArchetype(item: LectureItem): LectureArchetype {
  // 1. Ánh xạ chính xác theo ID ổn định
  if (item.id && ID_TO_ARCHETYPE[item.id]) {
    return ID_TO_ARCHETYPE[item.id];
  }

  // 2. Loại học liệu đặc thù (Luyện tập / Cuối chương)
  if (item.itemType === 'practice') {
    return 'practice_notebook';
  }
  if (item.itemType === 'chapter_review') {
    return 'chapter_review_trophy';
  }

  // 3. Môn học khác ngoài Toán (dự phòng cho catalog mở rộng)
  const subj = (item.subjectCode || '').toLowerCase();
  if (subj.includes('tin')) return 'informatics_screen';
  if (subj.includes('khtn') || subj.includes('khoa')) return 'science_experiment';

  // 4. Dự phòng theo từ khóa tên bài / chương
  const title = `${item.lessonLabel || ''} ${item.lessonTitle || ''}`.toLowerCase();
  if (item.itemType === 'activity') {
    if (title.includes('geogebra')) return 'activity_geogebra';
    if (title.includes('máy tính')) return 'activity_calculator';
    return 'activity_card_room';
  }

  if (title.includes('tập hợp') && !title.includes('số nguyên') && !title.includes('thứ tự')) {
    return 'venn_apples_stars';
  }
  if (title.includes('cách ghi số')) return 'digits_abacus';
  if (title.includes('thứ tự trong tập hợp')) return 'number_line_staircase';
  if (title.includes('cộng') && title.includes('trừ')) {
    return title.includes('số nguyên') ? 'integers_add_sub' : 'add_sub_cubes';
  }
  if (title.includes('nhân') && title.includes('chia')) return 'mul_div_arrays';
  if (title.includes('lũy thừa') || title.includes('luỹ thừa')) return 'exponents_cubes';
  if (title.includes('thứ tự thực hiện')) return 'order_of_operations';
  if (title.includes('dấu hiệu chia hết')) return 'divisibility_signs';
  if (title.includes('số nguyên tố')) return 'prime_numbers_tree';
  if (title.includes('ước chung')) return 'gcd_overlap';
  if (title.includes('bội chung')) return 'lcm_jumps';
  if (title.includes('chia hết')) return 'divisibility_relation';
  if (title.includes('dấu ngoặc')) return 'bracket_sign_rules';
  if (title.includes('nhân số nguyên')) return 'integers_multiply';
  if (title.includes('số nguyên')) return 'integers_thermometer';
  if (title.includes('tam giác đều') || title.includes('lục giác')) return 'regular_polygons';
  if (title.includes('hình chữ nhật') || title.includes('hình thoi') || title.includes('hình bình hành')) {
    return 'quadrilaterals_family';
  }
  if (title.includes('chu vi') || title.includes('diện tích')) return 'perimeter_area_grid';
  if (title.includes('trục đối xứng')) return 'axial_symmetry';
  if (title.includes('tâm đối xứng')) return 'central_symmetry';

  return 'default_lesson';
}

function getPastelBackdropClass(archetype: LectureArchetype): string {
  switch (archetype) {
    case 'venn_apples_stars':
      return 'bg-gradient-to-br from-[#D7EBFF] via-[#E9EEFF] to-[#F2E6FF]';
    case 'digits_abacus':
      return 'bg-gradient-to-br from-[#DDF6EE] via-[#E8FAF3] to-[#DCEEFF]';
    case 'number_line_staircase':
      return 'bg-gradient-to-br from-[#FFF4D9] via-[#FFF9EC] to-[#E8F2FF]';
    case 'add_sub_cubes':
      return 'bg-gradient-to-br from-[#EFE6FF] via-[#F5EEFF] to-[#E9EBFF]';
    case 'mul_div_arrays':
      return 'bg-gradient-to-br from-[#E2F0FF] via-[#ECF5FF] to-[#E8ECFF]';
    case 'practice_notebook':
      return 'bg-gradient-to-br from-[#FFEFE0] via-[#FFF6EC] to-[#FFECEB]';
    case 'chapter_review_trophy':
      return 'bg-gradient-to-br from-[#FEF3D8] via-[#FFF8E8] to-[#F3ECFF]';
    case 'exponents_cubes':
    case 'order_of_operations':
      return 'bg-gradient-to-br from-[#E0F2FE] via-[#EFF8FF] to-[#E6FAEE]';
    case 'divisibility_relation':
    case 'divisibility_signs':
    case 'prime_numbers_tree':
    case 'gcd_overlap':
    case 'lcm_jumps':
      return 'bg-gradient-to-br from-[#DCFCE7] via-[#ECFEF3] to-[#E0F2FE]';
    case 'integers_thermometer':
    case 'integers_add_sub':
    case 'bracket_sign_rules':
    case 'integers_multiply':
    case 'integers_divisibility':
      return 'bg-gradient-to-br from-[#E0F2FE] via-[#F2F6FF] to-[#FDECEF]';
    case 'regular_polygons':
    case 'quadrilaterals_family':
    case 'perimeter_area_grid':
      return 'bg-gradient-to-br from-[#FFF4E0] via-[#F8FAFF] to-[#E3F5EE]';
    case 'axial_symmetry':
    case 'central_symmetry':
      return 'bg-gradient-to-br from-[#FDE8F3] via-[#F8EEFF] to-[#E7F2FF]';
    case 'activity_card_room':
    case 'activity_geogebra':
    case 'activity_calculator':
      return 'bg-gradient-to-br from-[#FFF0DE] via-[#FFF9ED] to-[#E5F6EE]';
    case 'informatics_screen':
      return 'bg-gradient-to-br from-[#E0EEFF] via-[#EDF5FF] to-[#E0F7FA]';
    case 'science_experiment':
      return 'bg-gradient-to-br from-[#E6FAEE] via-[#F2FDF6] to-[#E0F2FE]';
    default:
      return 'bg-gradient-to-br from-[#E8F2FF] via-[#F4F8FF] to-[#EBF9F4]';
  }
}

export const LectureCardThumbnail3D: React.FC<{ item: LectureItem }> = ({ item }) => {
  const archetype = resolveLectureArchetype(item);
  const backdropClass = getPastelBackdropClass(archetype);

  return (
    <div
      className={`relative w-full h-[146px] sm:h-[154px] rounded-2xl border border-white/80 overflow-hidden select-none pointer-events-none flex items-center justify-center ${backdropClass}`}
      aria-hidden="true"
    >
      {/* Ánh sáng vòm mềm phía trên */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-56 h-20 rounded-full bg-white/45 blur-xl" />

      {archetype === 'venn_apples_stars' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="126" ry="9" fill="#3B82F6" fillOpacity="0.1" />
          {/* Ngôi sao & khối nhỏ trang trí bên ngoài */}
          <polygon points="34,54 37,61 44,62 39,67 40,74 34,70 28,74 29,67 24,62 31,61" fill="#FACC15" />
          <g transform="translate(22, 108)">
            <polygon points="10,0 20,5 10,10 0,5" fill="#C4B5FD" />
            <polygon points="0,5 10,10 10,20 0,15" fill="#8B5CF6" />
            <polygon points="10,10 20,5 20,15 10,20" fill="#6D28D9" />
          </g>
          <g transform="translate(292, 96)">
            <polygon points="12,0 24,6 12,12 0,6" fill="#FDE047" />
            <polygon points="0,6 12,12 12,24 0,18" fill="#FACC15" />
            <polygon points="12,12 24,6 24,18 12,24" fill="#EA580C" />
          </g>

          {/* Tập hợp trái (Xanh dương) */}
          <ellipse cx="136" cy="82" rx="64" ry="52" fill="#93C5FD" fillOpacity="0.45" stroke="#3B82F6" strokeWidth="4" />
          {/* Tập hợp phải (Tím hồng) */}
          <ellipse cx="204" cy="82" rx="64" ry="52" fill="#F5D0FE" fillOpacity="0.48" stroke="#C084FC" strokeWidth="4" />

          {/* 3 quả táo đỏ 3D */}
          {[
            { x: 118, y: 54 },
            { x: 108, y: 94 },
            { x: 144, y: 84 }
          ].map((pos, idx) => (
            <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
              <circle cx="0" cy="4" r="12" fill="#EF4444" />
              <circle cx="-3.5" cy="0" r="4" fill="#FCA5A5" fillOpacity="0.7" />
              <path d="M0 -8C2 -12 7 -13 10 -9C6 -6 3 -6 0 -8Z" fill="#22C55E" />
              <line x1="0" y1="-6" x2="0" y2="-11" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}

          {/* 4 ngôi sao vàng 3D */}
          {[
            { x: 204, y: 48 },
            { x: 236, y: 66 },
            { x: 196, y: 94 },
            { x: 232, y: 102 }
          ].map((pos, idx) => (
            <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
              <polygon
                points="0,-13 4,-4 13,-3 6,4 8,13 0,8 -8,13 -6,4 -13,-3 -4,-4"
                fill="#FACC15"
                stroke="#F59E0B"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </svg>
      )}

      {archetype === 'digits_abacus' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(16,185,129,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#059669" fillOpacity="0.1" />
          {/* Các khối chữ số 3D: Hàng 1 (1, 2, 3) & Hàng 2 (4, 5, 6) */}
          {[
            { label: '1', x: 34, y: 26, top: '#60A5FA', front: '#2563EB', side: '#1D4ED8' },
            { label: '2', x: 84, y: 26, top: '#6EE7B7', front: '#10B981', side: '#059669' },
            { label: '3', x: 134, y: 26, top: '#FDBA74', front: '#F97316', side: '#EA580C' },
            { label: '4', x: 54, y: 78, top: '#C4B5FD', front: '#8B5CF6', side: '#7C3AED' },
            { label: '5', x: 104, y: 78, top: '#FEF08A', front: '#FACC15', side: '#CA8A04' },
            { label: '6', x: 154, y: 78, top: '#93C5FD', front: '#3B82F6', side: '#1D4ED8' }
          ].map((b) => (
            <g key={b.label} transform={`translate(${b.x}, ${b.y})`}>
              <polygon points="0,8 8,0 48,0 40,8" fill={b.top} />
              <polygon points="40,8 48,0 48,40 40,48" fill={b.side} />
              <rect x="0" y="8" width="40" height="40" rx="6" fill={b.front} />
              <text x="20" y="36" textAnchor="middle" fill="white" fontSize="24" fontWeight="900">
                {b.label}
              </text>
            </g>
          ))}

          {/* Bàn tính 3D bên phải */}
          <g transform="translate(216, 30)">
            <rect x="0" y="0" width="96" height="96" rx="10" fill="#D97706" stroke="#92400E" strokeWidth="2" />
            <rect x="9" y="9" width="78" height="78" rx="5" fill="#FFFBEB" />
            {[24, 42, 60, 78].map((ry, rIdx) => (
              <g key={ry}>
                <line x1="9" y1={ry} x2="87" y2={ry} stroke="#78350F" strokeWidth="2.5" />
                {[21, 34, 47, 60, 74].map((cx, bIdx) => {
                  const colors = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#3B82F6'];
                  return (
                    <circle
                      key={bIdx}
                      cx={cx}
                      cy={ry}
                      r="6"
                      fill={colors[(rIdx + bIdx) % colors.length]}
                    />
                  );
                })}
              </g>
            ))}
          </g>
        </svg>
      )}

      {archetype === 'number_line_staircase' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(217,119,6,0.12)]" fill="none">
          <ellipse cx="170" cy="142" rx="138" ry="9" fill="#D97706" fillOpacity="0.1" />
          {/* Trục số 0 1 2 3 4 5 ... bên trái */}
          <g transform="translate(18, 66)">
            <line x1="8" y1="18" x2="176" y2="18" stroke="#1D4ED8" strokeWidth="4.5" strokeLinecap="round" />
            <polygon points="186,18 172,11 172,25" fill="#1D4ED8" />
            {[0, 1, 2, 3, 4, 5].map((num, idx) => {
              const x = 16 + idx * 27;
              return (
                <g key={num}>
                  <line x1={x} y1="10" x2={x} y2="26" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" />
                  <text x={x} y="44" textAnchor="middle" fill="#102A52" fontSize="15" fontWeight="900">
                    {num}
                  </text>
                </g>
              );
            })}
            <text x="174" y="42" textAnchor="middle" fill="#1D4ED8" fontSize="15" fontWeight="900">
              ...
            </text>
          </g>

          {/* Bậc thang số 1 -> 2 -> 3 bên phải */}
          <g transform="translate(212, 26)">
            <rect x="0" y="64" width="34" height="38" rx="6" fill="#FACC15" stroke="#EAB308" strokeWidth="1.5" />
            <text x="17" y="90" textAnchor="middle" fill="white" fontSize="20" fontWeight="900">1</text>

            <rect x="34" y="38" width="36" height="64" rx="6" fill="#22C55E" stroke="#16A34A" strokeWidth="1.5" />
            <text x="52" y="72" textAnchor="middle" fill="white" fontSize="22" fontWeight="900">2</text>

            <rect x="70" y="10" width="38" height="92" rx="6" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1.5" />
            <text x="89" y="54" textAnchor="middle" fill="white" fontSize="24" fontWeight="900">3</text>
          </g>
        </svg>
      )}

      {archetype === 'add_sub_cubes' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(124,58,237,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#7C3AED" fillOpacity="0.1" />
          {/* Dấu cộng (+) xanh dương 3D */}
          <g transform="translate(52, 20)">
            <rect x="20" y="0" width="22" height="62" rx="8" fill="#2563EB" />
            <rect x="0" y="20" width="62" height="22" rx="8" fill="#3B82F6" />
          </g>
          {/* 6 khối lập phương vàng (hàng 2x3) */}
          <g transform="translate(96, 86)">
            {[0, 1, 2].map((col) =>
              [0, 1].map((row) => (
                <g key={`${col}-${row}`} transform={`translate(${col * 22}, ${row * 19})`}>
                  <polygon points="8,0 16,4 8,8 0,4" fill="#FEF08A" />
                  <polygon points="0,4 8,8 8,18 0,14" fill="#FACC15" />
                  <polygon points="8,8 16,4 16,14 8,18" fill="#EA580C" />
                </g>
              ))
            )}
          </g>

          {/* Dấu trừ (−) đỏ cam 3D */}
          <g transform="translate(198, 36)">
            <rect x="0" y="4" width="62" height="22" rx="8" fill="#EF4444" />
            <rect x="0" y="0" width="62" height="22" rx="8" fill="#FB7185" />
          </g>
          {/* 3 khối lập phương tím */}
          <g transform="translate(226, 98)">
            {[0, 1, 2].map((col) => (
              <g key={col} transform={`translate(${col * 24}, 0)`}>
                <polygon points="9,0 18,4.5 9,9 0,4.5" fill="#DDD6FE" />
                <polygon points="0,4.5 9,9 9,20 0,15.5" fill="#8B5CF6" />
                <polygon points="9,9 18,4.5 18,15.5 9,20" fill="#6D28D9" />
              </g>
            ))}
          </g>
        </svg>
      )}

      {archetype === 'mul_div_arrays' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#2563EB" fillOpacity="0.1" />
          {/* Dấu nhân (×) xanh lá 3D */}
          <g transform="translate(52, 22)">
            <g transform="rotate(45 30 30)">
              <rect x="20" y="0" width="20" height="60" rx="8" fill="#22C55E" />
              <rect x="0" y="20" width="60" height="20" rx="8" fill="#4ADE80" />
            </g>
          </g>
          {/* Mảng 2x3 quả cầu đỏ */}
          <g transform="translate(106, 94)">
            {[0, 1, 2].map((c) =>
              [0, 1].map((r) => (
                <g key={`${c}-${r}`} transform={`translate(${c * 20}, ${r * 20})`}>
                  <circle cx="0" cy="0" r="8.5" fill="#EF4444" />
                  <circle cx="-2.5" cy="-2.5" r="2.5" fill="#FCA5A5" fillOpacity="0.7" />
                </g>
              ))
            )}
          </g>

          {/* Dấu chia (÷) tím 3D */}
          <g transform="translate(202, 22)">
            <circle cx="30" cy="8" r="9" fill="#8B5CF6" />
            <rect x="0" y="23" width="60" height="16" rx="8" fill="#A855F7" />
            <circle cx="30" cy="54" r="9" fill="#7C3AED" />
          </g>
          {/* Mảng 2x3 quả cầu xanh dương */}
          <g transform="translate(248, 94)">
            {[0, 1, 2].map((c) =>
              [0, 1].map((r) => (
                <g key={`${c}-${r}`} transform={`translate(${c * 20}, ${r * 20})`}>
                  <circle cx="0" cy="0" r="8.5" fill="#2563EB" />
                  <circle cx="-2.5" cy="-2.5" r="2.5" fill="#93C5FD" fillOpacity="0.7" />
                </g>
              ))
            )}
          </g>
        </svg>
      )}

      {archetype === 'exponents_cubes' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="130" ry="9" fill="#2563EB" fillOpacity="0.1" />
          <g transform="translate(46, 30)">
            <rect x="0" y="0" width="112" height="94" rx="18" fill="white" stroke="#93C5FD" strokeWidth="2.5" />
            <text x="56" y="54" textAnchor="middle" fill="#1D4ED8" fontSize="36" fontWeight="900">
              aⁿ
            </text>
            <text x="56" y="80" textAnchor="middle" fill="#0866FF" fontSize="14" fontWeight="800">
              2³ = 2 × 2 × 2 = 8
            </text>
          </g>
          <g transform="translate(186, 28)">
            {[
              { x: 0, y: 52, c1: '#60A5FA', c2: '#2563EB', c3: '#1D4ED8' },
              { x: 38, y: 52, c1: '#60A5FA', c2: '#2563EB', c3: '#1D4ED8' },
              { x: 19, y: 22, c1: '#FEF08A', c2: '#FACC15', c3: '#EA580C' },
              { x: 57, y: 22, c1: '#6EE7B7', c2: '#10B981', c3: '#059669' }
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

      {archetype === 'order_of_operations' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="142" rx="134" ry="9" fill="#0866FF" fillOpacity="0.1" />
          {[
            { label: '(  )', step: '1', bg: '#2563EB', x: 34, y: 38 },
            { label: 'aⁿ', step: '2', bg: '#8B5CF6', x: 106, y: 38 },
            { label: '×  ÷', step: '3', bg: '#10B981', x: 178, y: 38 },
            { label: '+  −', step: '4', bg: '#F59E0B', x: 250, y: 38 }
          ].map((b, i) => (
            <g key={b.step} transform={`translate(${b.x}, ${b.y})`}>
              <rect x="0" y="14" width="58" height="62" rx="14" fill={b.bg} />
              <text x="29" y="54" textAnchor="middle" fill="white" fontSize="20" fontWeight="900">
                {b.label}
              </text>
              <circle cx="29" cy="10" r="11" fill="white" stroke={b.bg} strokeWidth="2.5" />
              <text x="29" y="14" textAnchor="middle" fill={b.bg} fontSize="11" fontWeight="900">
                {b.step}
              </text>
              {i < 3 && (
                <path d="M62 45H69" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
              )}
            </g>
          ))}
        </svg>
      )}

      {archetype === 'divisibility_relation' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(5,150,105,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#059669" fillOpacity="0.1" />
          <g transform="translate(46, 26)">
            <rect x="0" y="0" width="248" height="44" rx="12" fill="#2563EB" />
            <text x="124" y="29" textAnchor="middle" fill="white" fontSize="22" fontWeight="900">
              12 = 3 × 4 (12 ⋮ 3)
            </text>
            {[0, 1, 2].map((idx) => (
              <g key={idx} transform={`translate(${idx * 84}, 58)`}>
                <rect x="0" y="0" width="80" height="40" rx="10" fill="#10B981" />
                <text x="40" y="26" textAnchor="middle" fill="white" fontSize="18" fontWeight="900">
                  4
                </text>
              </g>
            ))}
          </g>
        </svg>
      )}

      {archetype === 'divisibility_signs' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(5,150,105,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#059669" fillOpacity="0.1" />
          {[
            { label: '⋮ 2', sub: '0,2,4,6,8', bg: '#2563EB', x: 30 },
            { label: '⋮ 5', sub: '0 hoặc 5', bg: '#10B981', x: 102 },
            { label: '⋮ 3', sub: 'Tổng ⋮ 3', bg: '#F59E0B', x: 174 },
            { label: '⋮ 9', sub: 'Tổng ⋮ 9', bg: '#8B5CF6', x: 246 }
          ].map((c) => (
            <g key={c.label} transform={`translate(${c.x}, 28)`}>
              <rect x="0" y="0" width="64" height="96" rx="14" fill="white" stroke="#CBD5E1" strokeWidth="2" />
              <circle cx="32" cy="36" r="21" fill={c.bg} />
              <text x="32" y="42" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">
                {c.label}
              </text>
              <text x="32" y="79" textAnchor="middle" fill="#102A52" fontSize="10.5" fontWeight="800">
                {c.sub}
              </text>
            </g>
          ))}
        </svg>
      )}

      {archetype === 'prime_numbers_tree' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(5,150,105,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#059669" fillOpacity="0.1" />
          {/* Sơ đồ cây phân tích thừa số nguyên tố 12 = 2^2 * 3 */}
          <line x1="115" y1="36" x2="72" y2="80" stroke="#059669" strokeWidth="3.5" />
          <line x1="115" y1="36" x2="158" y2="80" stroke="#059669" strokeWidth="3.5" />
          <line x1="158" y1="80" x2="132" y2="122" stroke="#059669" strokeWidth="3" />
          <line x1="158" y1="80" x2="184" y2="122" stroke="#059669" strokeWidth="3" />
          <circle cx="115" cy="34" r="20" fill="#2563EB" stroke="white" strokeWidth="2.5" />
          <text x="115" y="40" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">12</text>
          <circle cx="72" cy="80" r="18" fill="#10B981" stroke="white" strokeWidth="2.5" />
          <text x="72" y="86" textAnchor="middle" fill="white" fontSize="15" fontWeight="900">3</text>
          <circle cx="158" cy="80" r="18" fill="#F59E0B" stroke="white" strokeWidth="2.5" />
          <text x="158" y="86" textAnchor="middle" fill="white" fontSize="15" fontWeight="900">4</text>
          <circle cx="132" cy="122" r="15" fill="#10B981" stroke="white" strokeWidth="2" />
          <text x="132" y="127" textAnchor="middle" fill="white" fontSize="14" fontWeight="900">2</text>
          <circle cx="184" cy="122" r="15" fill="#10B981" stroke="white" strokeWidth="2" />
          <text x="184" y="127" textAnchor="middle" fill="white" fontSize="14" fontWeight="900">2</text>
          {/* Huy hiệu số nguyên tố */}
          <g transform="translate(216, 36)">
            <rect x="0" y="0" width="94" height="84" rx="14" fill="white" stroke="#A7F3D0" strokeWidth="2" />
            <text x="47" y="28" textAnchor="middle" fill="#059669" fontSize="12" fontWeight="900">SỐ NGUYÊN TỐ</text>
            <text x="47" y="54" textAnchor="middle" fill="#102A52" fontSize="17" fontWeight="900">2, 3, 5, 7</text>
            <text x="47" y="74" textAnchor="middle" fill="#2563EB" fontSize="12" fontWeight="800">12 = 2² · 3</text>
          </g>
        </svg>
      )}

      {archetype === 'gcd_overlap' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#059669" fillOpacity="0.1" />
          <ellipse cx="130" cy="78" rx="68" ry="46" fill="#93C5FD" fillOpacity="0.45" stroke="#2563EB" strokeWidth="3.5" />
          <ellipse cx="210" cy="78" rx="68" ry="46" fill="#A7F3D0" fillOpacity="0.5" stroke="#059669" strokeWidth="3.5" />
          <text x="95" y="76" textAnchor="middle" fill="#1E3A8A" fontSize="15" fontWeight="900">4, 12</text>
          <text x="245" y="76" textAnchor="middle" fill="#065F46" fontSize="15" fontWeight="900">9, 18</text>
          <circle cx="170" cy="76" r="24" fill="#FACC15" stroke="white" strokeWidth="3" />
          <text x="170" y="82" textAnchor="middle" fill="#78350F" fontSize="18" fontWeight="900">6</text>
          <rect x="108" y="122" width="124" height="24" rx="12" fill="white" stroke="#BFDBFE" strokeWidth="1.5" />
          <text x="170" y="138" textAnchor="middle" fill="#0866FF" fontSize="12" fontWeight="900">ƯCLN(12, 18) = 6</text>
        </svg>
      )}

      {archetype === 'lcm_jumps' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#2563EB" fillOpacity="0.1" />
          <rect x="24" y="24" width="292" height="108" rx="16" fill="white" stroke="#CFE2FF" strokeWidth="2" />
          {/* Đường nhảy bội 4 và 6 gặp nhau ở 12 */}
          <path d="M52 94Q82 54 112 94" stroke="#3B82F6" strokeWidth="3.5" fill="none" />
          <path d="M112 94Q142 54 172 94" stroke="#3B82F6" strokeWidth="3.5" fill="none" />
          <path d="M172 94Q202 54 232 94" stroke="#3B82F6" strokeWidth="3.5" fill="none" />
          <path d="M52 94Q142 32 232 94" stroke="#10B981" strokeWidth="3.5" strokeDasharray="5 3" fill="none" />
          <line x1="40" y1="96" x2="294" y2="96" stroke="#102A52" strokeWidth="3" />
          {[
            { label: '0', x: 52 },
            { label: '4', x: 112 },
            { label: '8', x: 172 },
            { label: '12', x: 232 }
          ].map((p) => (
            <g key={p.label}>
              <circle cx={p.x} cy="96" r="5" fill={p.label === '12' ? '#F59E0B' : '#2563EB'} />
              <text x={p.x} y="116" textAnchor="middle" fill="#102A52" fontSize="13" fontWeight="900">
                {p.label}
              </text>
            </g>
          ))}
          <text x="170" y="42" textAnchor="middle" fill="#0866FF" fontSize="12" fontWeight="900">BCNN(4, 6) = 12</text>
        </svg>
      )}

      {archetype === 'integers_thermometer' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(2,132,199,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#0284C7" fillOpacity="0.1" />
          <rect x="28" y="84" width="284" height="48" rx="14" fill="white" stroke="#BAE6FD" strokeWidth="2" />
          <line x1="44" y1="104" x2="296" y2="104" stroke="#0284C7" strokeWidth="3" />
          {[-3, -2, -1, 0, 1, 2, 3].map((n, i) => {
            const x = 58 + i * 37;
            const color = n < 0 ? '#EF4444' : n === 0 ? '#102A52' : '#16A34A';
            return (
              <g key={n}>
                <circle cx={x} cy="104" r="4.5" fill={color} />
                <text x={x} y="124" textAnchor="middle" fill={color} fontSize="13.5" fontWeight="900">
                  {n > 0 ? `+${n}` : n}
                </text>
              </g>
            );
          })}
          <rect x="52" y="24" width="102" height="40" rx="12" fill="#FEE2E2" stroke="#FCA5A5" strokeWidth="1.5" />
          <text x="103" y="49" textAnchor="middle" fill="#DC2626" fontSize="14" fontWeight="900">Số âm (−)</text>
          <rect x="186" y="24" width="102" height="40" rx="12" fill="#DCFCE7" stroke="#86EFAC" strokeWidth="1.5" />
          <text x="237" y="49" textAnchor="middle" fill="#15803D" fontSize="14" fontWeight="900">Số dương (+)</text>
        </svg>
      )}

      {archetype === 'integers_add_sub' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#0284C7" fillOpacity="0.1" />
          <rect x="28" y="26" width="284" height="106" rx="16" fill="white" stroke="#CFE2FF" strokeWidth="2" />
          <path d="M170 86Q134 46 98 86" stroke="#EF4444" strokeWidth="3.5" fill="none" />
          <polygon points="94,88 104,80 107,90" fill="#EF4444" />
          <path d="M98 86Q170 36 242 86" stroke="#16A34A" strokeWidth="3.5" fill="none" />
          <polygon points="246,88 233,90 236,80" fill="#16A34A" />
          <line x1="46" y1="90" x2="294" y2="90" stroke="#102A52" strokeWidth="3" />
          {[-2, 0, 2].map((n, idx) => {
            const x = 98 + idx * 72;
            return (
              <g key={n}>
                <circle cx={x} cy="90" r="5" fill="#2563EB" />
                <text x={x} y="114" textAnchor="middle" fill="#102A52" fontSize="14" fontWeight="900">
                  {n > 0 ? `+${n}` : n}
                </text>
              </g>
            );
          })}
          <text x="170" y="48" textAnchor="middle" fill="#102A52" fontSize="13" fontWeight="900">(−2) + (+4) = +2</text>
        </svg>
      )}

      {archetype === 'bracket_sign_rules' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(124,58,237,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#7C3AED" fillOpacity="0.1" />
          <g transform="translate(30, 32)">
            <rect x="0" y="0" width="132" height="92" rx="16" fill="white" stroke="#BFDBFE" strokeWidth="2" />
            <text x="66" y="34" textAnchor="middle" fill="#16A34A" fontSize="13" fontWeight="900">GIỮ NGUYÊN DẤU</text>
            <text x="66" y="64" textAnchor="middle" fill="#1D4ED8" fontSize="18" fontWeight="900">+(a − b) = +a − b</text>
          </g>
          <g transform="translate(178, 32)">
            <rect x="0" y="0" width="132" height="92" rx="16" fill="white" stroke="#FBCFE8" strokeWidth="2" />
            <text x="66" y="34" textAnchor="middle" fill="#DC2626" fontSize="13" fontWeight="900">ĐỔI DẤU</text>
            <text x="66" y="64" textAnchor="middle" fill="#7C3AED" fontSize="18" fontWeight="900">−(a − b) = −a + b</text>
          </g>
        </svg>
      )}

      {archetype === 'integers_multiply' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#2563EB" fillOpacity="0.1" />
          <g transform="translate(36, 26)">
            <rect x="0" y="0" width="128" height="48" rx="12" fill="#22C55E" />
            <text x="64" y="30" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">(+) × (+) = (+)</text>
            <rect x="140" y="0" width="128" height="48" rx="12" fill="#3B82F6" />
            <text x="204" y="30" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">(−) × (−) = (+)</text>
            <rect x="0" y="58" width="128" height="48" rx="12" fill="#F97316" />
            <text x="64" y="88" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">(+) × (−) = (−)</text>
            <rect x="140" y="58" width="128" height="48" rx="12" fill="#EF4444" />
            <text x="204" y="88" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">(−) × (+) = (−)</text>
          </g>
        </svg>
      )}

      {archetype === 'integers_divisibility' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(16,185,129,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#10B981" fillOpacity="0.1" />
          <rect x="36" y="24" width="268" height="106" rx="16" fill="white" stroke="#A7F3D0" strokeWidth="2" />
          <text x="170" y="52" textAnchor="middle" fill="#059669" fontSize="14" fontWeight="900">ƯỚC CỦA 6 TRONG ℤ</text>
          {[-6, -3, -2, -1, 1, 2, 3, 6].map((n, i) => {
            const x = 56 + i * 32;
            const bg = n < 0 ? '#FEE2E2' : '#DCFCE7';
            const fg = n < 0 ? '#DC2626' : '#15803D';
            return (
              <g key={n} transform={`translate(${x}, 86)`}>
                <circle cx="0" cy="0" r="13" fill={bg} />
                <text x="0" y="4.5" textAnchor="middle" fill={fg} fontSize="11.5" fontWeight="900">
                  {n}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {archetype === 'regular_polygons' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="136" ry="9" fill="#0866FF" fillOpacity="0.1" />
          {/* Tam giác đều */}
          <polygon points="74,34 114,108 34,108" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="3" strokeLinejoin="round" />
          {/* Hình vuông */}
          <rect x="136" y="38" width="68" height="68" rx="6" fill="#FACC15" stroke="#CA8A04" strokeWidth="3" />
          {/* Hình lục giác đều */}
          <polygon
            points="266,34 300,53 300,91 266,110 232,91 232,53"
            fill="#34D399"
            stroke="#059669"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {archetype === 'quadrilaterals_family' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(16,185,129,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="136" ry="9" fill="#059669" fillOpacity="0.1" />
          {/* Hình chữ nhật */}
          <rect x="28" y="34" width="66" height="44" rx="4" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2.5" />
          {/* Hình thoi */}
          <polygon points="146,28 178,56 146,84 114,56" fill="#F472B6" stroke="#DB2777" strokeWidth="2.5" />
          {/* Hình bình hành */}
          <polygon points="208,34 268,34 252,78 192,78" fill="#FBBF24" stroke="#D97706" strokeWidth="2.5" />
          {/* Hình thang cân */}
          <polygon points="122,94 218,94 242,132 98,132" fill="#34D399" stroke="#059669" strokeWidth="2.5" />
        </svg>
      )}

      {archetype === 'perimeter_area_grid' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#2563EB" fillOpacity="0.1" />
          <g transform="translate(56, 30)">
            <rect x="0" y="0" width="168" height="96" rx="8" fill="#DBEAFE" stroke="#2563EB" strokeWidth="4" />
            {[1, 2, 3].map((r) => (
              <line key={r} x1="0" y1={r * 24} x2="168" y2={r * 24} stroke="#93C5FD" strokeWidth="1.5" />
            ))}
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <line key={c} x1={c * 24} y1="0" x2={c * 24} y2="96" stroke="#93C5FD" strokeWidth="1.5" />
            ))}
            <text x="84" y="54" textAnchor="middle" fill="#1E3A8A" fontSize="18" fontWeight="900">
              S = a × b
            </text>
          </g>
          {/* Thước kẻ vàng */}
          <g transform="translate(242, 30) rotate(12)">
            <rect x="0" y="0" width="26" height="96" rx="4" fill="#FACC15" stroke="#CA8A04" strokeWidth="1.5" />
            {[14, 28, 42, 56, 70, 84].map((y) => (
              <line key={y} x1="0" y1={y} x2="10" y2={y} stroke="#854D0E" strokeWidth="2" />
            ))}
          </g>
        </svg>
      )}

      {archetype === 'axial_symmetry' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(236,72,153,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#EC4899" fillOpacity="0.1" />
          {/* Cánh bướm đối xứng 2 bên trục d */}
          <path d="M170 60C138 22 74 28 74 68C74 96 128 96 170 84Z" fill="#3B82F6" />
          <path d="M170 84C138 96 96 116 112 132C132 146 158 122 170 96Z" fill="#60A5FA" />
          <path d="M170 60C202 22 266 28 266 68C266 96 212 96 170 84Z" fill="#EC4899" />
          <path d="M170 84C202 96 244 116 228 132C208 146 182 122 170 96Z" fill="#F472B6" />
          <line x1="170" y1="16" x2="170" y2="144" stroke="#102A52" strokeWidth="3" strokeDasharray="6 4" />
        </svg>
      )}

      {archetype === 'central_symmetry' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#2563EB" fillOpacity="0.1" />
          <polygon points="170,78 134,26 170,26" fill="#3B82F6" />
          <polygon points="170,78 222,42 222,78" fill="#10B981" />
          <polygon points="170,78 206,130 170,130" fill="#F59E0B" />
          <polygon points="170,78 118,114 118,78" fill="#EC4899" />
          <circle cx="170" cy="78" r="28" stroke="#102A52" strokeWidth="2" strokeDasharray="4 3" />
          <circle cx="170" cy="78" r="6" fill="#EF4444" stroke="white" strokeWidth="2" />
        </svg>
      )}

      {archetype === 'activity_card_room' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(234,88,12,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#EA580C" fillOpacity="0.1" />
          {/* Tấm thiệp mở 3D */}
          <g transform="translate(52, 28)">
            <rect x="0" y="0" width="96" height="96" rx="12" fill="#FB7185" />
            <rect x="88" y="0" width="96" height="96" rx="12" fill="#FFFBEB" stroke="#FDBA74" strokeWidth="2" />
            <polygon points="48,30 56,46 74,48 60,60 64,76 48,68 32,76 36,60 22,48 40,46" fill="#FACC15" />
            <line x1="108" y1="30" x2="164" y2="30" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
            <line x1="108" y1="48" x2="156" y2="48" stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="108" y1="64" x2="148" y2="64" stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          {/* Ê-ke xanh lá */}
          <polygon points="248,38 302,118 248,118" fill="#34D399" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )}

      {archetype === 'activity_geogebra' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#2563EB" fillOpacity="0.1" />
          <g transform="translate(76, 18)">
            <rect x="0" y="0" width="188" height="114" rx="14" fill="#1E3A8A" stroke="#93C5FD" strokeWidth="2" />
            <rect x="8" y="8" width="172" height="98" rx="8" fill="#FFFFFF" />
            <rect x="8" y="8" width="172" height="18" rx="4" fill="#EFF6FF" />
            <circle cx="20" cy="17" r="4" fill="#3B82F6" />
            <circle cx="34" cy="17" r="4" fill="#10B981" />
            <circle cx="48" cy="17" r="4" fill="#F59E0B" />
            <circle cx="94" cy="66" r="30" fill="#DBEAFE" fillOpacity="0.6" stroke="#2563EB" strokeWidth="2.5" />
            <polygon points="94,36 120,82 68,82" fill="#FEF08A" fillOpacity="0.8" stroke="#EA580C" strokeWidth="2.5" />
            <circle cx="94" cy="36" r="3.5" fill="#1D4ED8" />
            <circle cx="120" cy="82" r="3.5" fill="#1D4ED8" />
            <circle cx="68" cy="82" r="3.5" fill="#1D4ED8" />
          </g>
        </svg>
      )}

      {archetype === 'activity_calculator' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(16,185,129,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="124" ry="9" fill="#059669" fillOpacity="0.1" />
          <g transform="translate(116, 16)">
            <rect x="0" y="0" width="108" height="126" rx="16" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
            <rect x="12" y="12" width="84" height="30" rx="6" fill="#D1FAE5" />
            <text x="88" y="33" textAnchor="end" fill="#065F46" fontSize="16" fontWeight="900" fontFamily="monospace">
              123.45
            </text>
            {[0, 1, 2].map((r) =>
              [0, 1, 2, 3].map((c) => {
                const bg = c === 3 ? '#F97316' : r === 0 ? '#60A5FA' : '#475569';
                return (
                  <rect
                    key={`${r}-${c}`}
                    x={12 + c * 22}
                    y={54 + r * 22}
                    width="18"
                    height="16"
                    rx="4"
                    fill={bg}
                  />
                );
              })
            )}
          </g>
        </svg>
      )}

      {archetype === 'practice_notebook' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(234,88,12,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#EA580C" fillOpacity="0.1" />
          {/* Sổ luyện tập có gáy lò xo & dấu tích xanh */}
          <g transform="translate(76, 20) rotate(-6)">
            <rect x="0" y="0" width="94" height="114" rx="12" fill="#CBD5E1" />
            <rect x="4" y="0" width="90" height="110" rx="12" fill="white" stroke="#CBD5E1" strokeWidth="2" />
            {/* Gáy lò xo */}
            {[18, 36, 54, 72, 90].map((y) => (
              <rect key={y} x="-6" y={y} width="14" height="6" rx="3" fill="#64748B" />
            ))}
            {/* 3 dòng tích xanh */}
            {[24, 52, 80].map((y) => (
              <g key={y}>
                <rect x="18" y={y} width="16" height="16" rx="4" fill="#DCFCE7" stroke="#22C55E" strokeWidth="1.5" />
                <path d={`M21 ${y + 8}L25 ${y + 12}L31 ${y + 4}`} stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="42" y1={y + 6} x2="78" y2={y + 6} stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="42" y1={y + 13} x2="68" y2={y + 13} stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
              </g>
            ))}
          </g>
          {/* Bút chì vàng nghiêng */}
          <g transform="translate(158, 96) rotate(-42)">
            <rect x="0" y="0" width="66" height="13" rx="3" fill="#FACC15" />
            <rect x="0" y="0" width="12" height="13" rx="3" fill="#FB7185" />
            <polygon points="66,0 80,6.5 66,13" fill="#FDE68A" />
            <polygon points="75,4.2 80,6.5 75,8.8" fill="#1E293B" />
          </g>
          {/* Chồng khối lập phương màu bên phải */}
          <g transform="translate(226, 74)">
            <polygon points="18,0 36,8 18,16 0,8" fill="#6EE7B7" />
            <polygon points="0,8 18,16 18,40 0,32" fill="#10B981" />
            <polygon points="18,16 36,8 36,32 18,40" fill="#059669" />
          </g>
          <g transform="translate(262, 74)">
            <polygon points="18,0 36,8 18,16 0,8" fill="#93C5FD" />
            <polygon points="0,8 18,16 18,40 0,32" fill="#3B82F6" />
            <polygon points="18,16 36,8 36,32 18,40" fill="#1D4ED8" />
          </g>
          <g transform="translate(244, 44)">
            <polygon points="18,0 36,8 18,16 0,8" fill="#FDBA74" />
            <polygon points="0,8 18,16 18,40 0,32" fill="#F97316" />
            <polygon points="18,16 36,8 36,32 18,40" fill="#EA580C" />
          </g>
        </svg>
      )}

      {archetype === 'chapter_review_trophy' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(217,119,6,0.14)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#D97706" fillOpacity="0.12" />
          <g transform="translate(124, 20)">
            <path d="M10 22C0 22 0 48 16 48" stroke="#F59E0B" strokeWidth="5" strokeLinecap="round" />
            <path d="M82 22C92 22 92 48 76 48" stroke="#F59E0B" strokeWidth="5" strokeLinecap="round" />
            <path d="M16 10H76V46C76 68 62 82 46 82C30 82 16 68 16 46V10Z" fill="#FACC15" stroke="#D97706" strokeWidth="2.5" />
            <rect x="38" y="82" width="16" height="18" fill="#D97706" />
            <rect x="20" y="100" width="52" height="14" rx="5" fill="#92400E" />
            <polygon points="46,24 51,36 64,37 54,46 57,58 46,51 35,58 38,46 28,37 41,36" fill="#FFFBEB" />
          </g>
          <polygon points="72,46 76,55 86,56 78,63 80,73 72,68 64,73 66,63 58,56 68,55" fill="#F59E0B" />
          <polygon points="268,46 272,55 282,56 274,63 276,73 268,68 260,73 262,63 254,56 264,55" fill="#8B5CF6" />
        </svg>
      )}

      {archetype === 'informatics_screen' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.14)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#0284C7" fillOpacity="0.1" />
          <g transform="translate(88, 22)">
            <rect x="0" y="0" width="164" height="96" rx="14" fill="#1E3A8A" stroke="#93C5FD" strokeWidth="2" />
            <rect x="10" y="10" width="144" height="76" rx="8" fill="#0F172A" />
            <text x="82" y="56" textAnchor="middle" fill="#60A5FA" fontSize="28" fontWeight="900" fontFamily="monospace">
              &lt;/&gt;
            </text>
            <rect x="64" y="96" width="36" height="12" fill="#64748B" />
            <rect x="44" y="108" width="76" height="8" rx="4" fill="#475569" />
          </g>
        </svg>
      )}

      {archetype === 'science_experiment' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(16,185,129,0.14)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#10B981" fillOpacity="0.1" />
          <g transform="translate(82, 22)">
            <path d="M34 10H54V42L78 96C81 103 76 110 68 110H20C12 110 7 103 10 96L34 42V10Z" fill="#E0F2FE" stroke="#0284C7" strokeWidth="3" />
            <path d="M20 72H68L78 96C81 103 76 110 68 110H20C12 110 7 103 10 96L20 72Z" fill="#10B981" />
          </g>
          <g transform="translate(226, 78)">
            <ellipse cx="0" cy="0" rx="44" ry="17" stroke="#2563EB" strokeWidth="2.5" transform="rotate(30)" />
            <ellipse cx="0" cy="0" rx="44" ry="17" stroke="#8B5CF6" strokeWidth="2.5" transform="rotate(-30)" />
            <circle cx="0" cy="0" r="10" fill="#F59E0B" />
          </g>
        </svg>
      )}

      {archetype === 'default_lesson' && (
        <svg viewBox="0 0 340 160" className="w-full h-full drop-shadow-[0_6px_12px_rgba(37,99,235,0.12)]" fill="none">
          <ellipse cx="170" cy="144" rx="134" ry="9" fill="#2563EB" fillOpacity="0.1" />
          <g transform="translate(96, 26)">
            <path d="M0 18L74 4L148 18V96L74 84L0 96V18Z" fill="#2563EB" />
            <path d="M8 15C30 8 54 10 74 20V82C54 74 30 72 8 79V15Z" fill="#FFFBEB" />
            <path d="M140 15C118 8 94 10 74 20V82C94 74 118 72 140 79V15Z" fill="#FFFFFF" />
          </g>
        </svg>
      )}
    </div>
  );
};
