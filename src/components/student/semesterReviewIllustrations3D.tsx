import React, { useId } from 'react';

/**
 * Minh họa 3D bằng SVG gradient & shading cho trang "Ôn tập & Thi thử Học kỳ"
 * - Không phụ thuộc ảnh ngoài, 0ms latency, không bao giờ lỗi broken-image.
 * - Mọi gradient ID dùng useId() để tránh trùng lặp trong DOM.
 */

export const SemesterBannerIllustration3D: React.FC = () => {
  const uid = useId().replace(/:/g, '');
  const bookBlue = `sr-bblue-${uid}`;
  const bookAmber = `sr-bamber-${uid}`;
  const calHeader = `sr-calh-${uid}`;
  const badgeOrange = `sr-borange-${uid}`;
  const pencilBody = `sr-pencil-${uid}`;

  return (
    <div
      aria-hidden="true"
      className="relative w-[220px] sm:w-[270px] h-[94px] sm:h-[112px] select-none pointer-events-none shrink-0 flex items-center justify-center"
    >
      <svg
        viewBox="0 0 340 140"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_18px_rgba(16,42,86,0.14)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={bookBlue} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0866FF" />
          </linearGradient>
          <linearGradient id={bookAmber} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id={calHeader} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={badgeOrange} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id={pencilBody} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Bóng đổ nền */}
        <ellipse cx="176" cy="126" rx="142" ry="9" fill="#0866FF" fillOpacity="0.12" />

        {/* Chồng sách trái */}
        <g transform="translate(18, 74)">
          <rect x="0" y="24" width="84" height="19" rx="5" fill={`url(#${bookAmber})`} />
          <rect x="9" y="27" width="69" height="12" rx="2.5" fill="#FFFBEB" />
          <rect x="0" y="24" width="12" height="19" rx="3.5" fill="#D97706" />

          <path d="M5 10L18 2H85L74 10H5Z" fill="#7DD3FC" />
          <rect x="5" y="9" width="76" height="17" rx="4.5" fill={`url(#${bookBlue})`} />
          <rect x="13" y="12.5" width="62" height="9.5" rx="2" fill="#F0F9FF" />
          <rect x="5" y="9" width="11" height="17" rx="3" fill="#0369A1" />
        </g>

        {/* Quyển sách mở ở giữa */}
        <g transform="translate(92, 20)">
          <rect x="6" y="76" width="116" height="14" rx="5" fill="#1D4ED8" />
          <path
            d="M64 14C50 7 24 8 10 15V77C24 70 50 69 64 76C78 69 104 70 118 77V15C104 8 78 7 64 14Z"
            fill="#FFFFFF"
            stroke="#BFDBFE"
            strokeWidth="1.5"
          />
          <path d="M64 16C51 10 26 11 14 17V72C26 66 51 65 64 72V16Z" fill="#F8FAFC" />
          <path d="M64 16C77 10 102 11 114 17V72C102 66 77 65 64 72V16Z" fill="#EFF6FF" />
          <line x1="64" y1="15" x2="64" y2="75" stroke="#93C5FD" strokeWidth="2.5" />
          <line x1="23" y1="29" x2="52" y2="27" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <line x1="23" y1="39" x2="50" y2="37" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <line x1="23" y1="49" x2="46" y2="47" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <line x1="76" y1="27" x2="104" y2="29" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
          <line x1="76" y1="37" x2="101" y2="39" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
          <line x1="76" y1="47" x2="96" y2="49" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Lịch bàn bên phải + Dấu tick + Bút chì */}
        <g transform="translate(216, 18)">
          {/* Chân lịch */}
          <path d="M12 88L22 76H86L96 88H12Z" fill="#93C5FD" opacity="0.55" />
          {/* Thân lịch */}
          <rect x="8" y="12" width="84" height="78" rx="12" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="2" />
          {/* Đỉnh lịch xanh */}
          <path d="M8 24C8 17.3726 13.3726 12 20 12H80C86.6274 12 92 17.3726 92 24V31H8V24Z" fill={`url(#${calHeader})`} />
          {/* Khoen lịch */}
          <rect x="24" y="4" width="7" height="14" rx="3.5" fill="#1E3A8A" />
          <rect x="47" y="4" width="7" height="14" rx="3.5" fill="#1E3A8A" />
          <rect x="70" y="4" width="7" height="14" rx="3.5" fill="#1E3A8A" />
          {/* Lưới ô ngày */}
          <rect x="18" y="40" width="14" height="11" rx="3" fill="#E0ECFF" />
          <rect x="37" y="40" width="14" height="11" rx="3" fill="#E0ECFF" />
          <rect x="56" y="40" width="14" height="11" rx="3" fill="#E0ECFF" />
          <rect x="18" y="56" width="14" height="11" rx="3" fill="#E0ECFF" />
          <rect x="37" y="56" width="14" height="11" rx="3" fill="#DBEAFE" />
          {/* Huy hiệu tick cam */}
          <circle cx="64" cy="62" r="14" fill={`url(#${badgeOrange})`} />
          <path
            d="M58 62.5L62.2 66.8L70.5 58"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bút chì vàng nghiêng góc phải */}
          <g transform="translate(86, 36) rotate(36)">
            <rect x="0" y="10" width="13" height="50" rx="3" fill={`url(#${pencilBody})`} />
            <rect x="0" y="56" width="13" height="7" rx="2.5" fill="#FB7185" />
            <rect x="0" y="53" width="13" height="4" fill="#CBD5E1" />
            <polygon points="0,10 6.5,-4 13,10" fill="#FEF3C7" />
            <polygon points="4,1 6.5,-4 9,1" fill="#1E293B" />
          </g>
        </g>
      </svg>
    </div>
  );
};

export type ExamCardVisualVariant = 'check' | 'chart' | 'target';

export const ExamCardIllustration3D: React.FC<{ variant: ExamCardVisualVariant }> = ({ variant }) => {
  const uid = useId().replace(/:/g, '');
  const stageGrad = `ec-stage-${uid}`;
  const docHeader = `ec-doch-${uid}`;
  const greenGrad = `ec-green-${uid}`;
  const barBlue = `ec-barb-${uid}`;
  const targetGrad = `ec-targ-${uid}`;

  return (
    <div
      aria-hidden="true"
      className="relative w-full h-[108px] rounded-2xl overflow-hidden flex items-center justify-center select-none pointer-events-none"
      style={{
        background:
          variant === 'check'
            ? 'linear-gradient(135deg, #EAF3FF 0%, #DCEBFF 100%)'
            : variant === 'chart'
            ? 'linear-gradient(135deg, #EEF5FF 0%, #E0EFFF 100%)'
            : 'linear-gradient(135deg, #EDF4FF 0%, #FFEFE6 100%)'
      }}
    >
      <svg viewBox="0 0 220 110" className="w-full h-full max-w-[210px]" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={stageGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#CFE3FF" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id={docHeader} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#0866FF" />
          </linearGradient>
          <linearGradient id={greenGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id={barBlue} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={targetGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
        </defs>

        {/* Đế bóng mờ */}
        <ellipse cx="110" cy="95" rx="74" ry="8" fill="#1D4ED8" fillOpacity="0.12" />

        {/* Chồng sách nhỏ nền sau */}
        <g transform="translate(26, 52)">
          <rect x="0" y="20" width="60" height="14" rx="4" fill="#38BDF8" />
          <rect x="6" y="22.5" width="48" height="8" rx="2" fill="#F0F9FF" />
          <rect x="4" y="6" width="56" height="14" rx="4" fill="#FBBF24" />
          <rect x="10" y="8.5" width="44" height="8" rx="2" fill="#FFFBEB" />
        </g>

        {/* Tờ đề thi nghiêng nhẹ */}
        <g transform="translate(66, 12) rotate(-6 42 40)">
          <rect x="3" y="4" width="84" height="76" rx="10" fill="#CBD5E1" fillOpacity="0.4" />
          <rect x="0" y="0" width="84" height="76" rx="10" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.5" />
          <path d="M0 10C0 4.47715 4.47715 0 10 0H74C79.5228 0 84 4.47715 84 10V19H0V10Z" fill={`url(#${docHeader})`} />
          <text
            x="42"
            y="13"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="8.5"
            fontWeight="800"
            fontFamily="system-ui, sans-serif"
          >
            ĐỀ THI
          </text>
          <rect x="12" y="27" width="12" height="7" rx="2" fill="#93C5FD" />
          <line x1="29" y1="30.5" x2="70" y2="30.5" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <rect x="12" y="41" width="12" height="7" rx="2" fill="#BFDBFE" />
          <line x1="29" y1="44.5" x2="65" y2="44.5" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
          <rect x="12" y="55" width="12" height="7" rx="2" fill="#BFDBFE" />
          <line x1="29" y1="58.5" x2="58" y2="58.5" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Vật thể 3D đặc trưng ở tiền cảnh phải */}
        {variant === 'check' && (
          <g transform="translate(124, 48)">
            <rect x="0" y="0" width="38" height="38" rx="11" fill={`url(#${greenGrad})`} />
            <path
              d="M11 19.5L16.5 25L27.5 13.5"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {variant === 'chart' && (
          <g transform="translate(118, 34)">
            <rect x="0" y="34" width="12" height="20" rx="3.5" fill="#60A5FA" />
            <rect x="16" y="22" width="12" height="32" rx="3.5" fill="#3B82F6" />
            <rect x="32" y="10" width="12" height="44" rx="3.5" fill={`url(#${barBlue})`} />
            <rect x="48" y="0" width="12" height="54" rx="3.5" fill="#0866FF" />
          </g>
        )}

        {variant === 'target' && (
          <g transform="translate(128, 30)">
            <circle cx="26" cy="30" r="24" fill={`url(#${targetGrad})`} />
            <circle cx="26" cy="30" r="16" fill="#FFFFFF" />
            <circle cx="26" cy="30" r="9" fill="#F97316" />
            <circle cx="26" cy="30" r="4" fill="#FFFFFF" />
            {/* Mũi tên */}
            <line x1="26" y1="30" x2="52" y2="6" stroke="#1E3A8A" strokeWidth="3.5" strokeLinecap="round" />
            <polygon points="44,6 54,4 52,14" fill="#F59E0B" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const SelectedExamIllustration3D: React.FC = () => {
  const uid = useId().replace(/:/g, '');
  const clockGrad = `sel-clk-${uid}`;
  const docHeader = `sel-doch-${uid}`;

  return (
    <div aria-hidden="true" className="relative w-[132px] h-[108px] select-none pointer-events-none shrink-0">
      <svg viewBox="0 0 150 120" className="w-full h-full overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={clockGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#0866FF" />
          </linearGradient>
          <linearGradient id={docHeader} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>

        <ellipse cx="75" cy="108" rx="60" ry="7" fill="#0866FF" fillOpacity="0.12" />

        {/* Chồng sách nhỏ phải */}
        <g transform="translate(86, 58)">
          <rect x="0" y="24" width="52" height="14" rx="4" fill="#10B981" />
          <rect x="6" y="26.5" width="40" height="8" rx="2" fill="#ECFDF5" />
          <rect x="3" y="10" width="48" height="14" rx="4" fill="#38BDF8" />
          <rect x="9" y="12.5" width="36" height="8" rx="2" fill="#F0F9FF" />
        </g>

        {/* Bảng đề thi */}
        <g transform="translate(36, 12)">
          <rect x="0" y="0" width="76" height="86" rx="11" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.8" />
          <path d="M0 11C0 4.92487 4.92487 0 11 0H65C71.0751 0 76 4.92487 76 11V21H0V11Z" fill={`url(#${docHeader})`} />
          <text x="38" y="14.5" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="800" fontFamily="system-ui, sans-serif">
            ĐỀ THI
          </text>
          <rect x="11" y="30" width="12" height="10" rx="3" fill="#0866FF" />
          <path d="M14 35L16.2 37.2L20.5 32.8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="29" y1="35" x2="64" y2="35" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />

          <rect x="11" y="47" width="12" height="10" rx="3" fill="#0866FF" />
          <path d="M14 52L16.2 54.2L20.5 49.8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="29" y1="52" x2="60" y2="52" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />

          <rect x="11" y="64" width="12" height="10" rx="3" fill="#DBEAFE" />
          <line x1="29" y1="69" x2="54" y2="69" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Đồng hồ báo thức 3D bên trái */}
        <g transform="translate(6, 48)">
          <circle cx="10" cy="10" r="7" fill="#FBBF24" />
          <circle cx="42" cy="10" r="7" fill="#FBBF24" />
          <rect x="10" y="48" width="5" height="9" rx="2.5" transform="rotate(20 10 48)" fill="#1E3A8A" />
          <rect x="37" y="48" width="5" height="9" rx="2.5" transform="rotate(-20 37 48)" fill="#1E3A8A" />
          <circle cx="26" cy="30" r="22" fill={`url(#${clockGrad})`} />
          <circle cx="26" cy="30" r="16.5" fill="#FFFFFF" />
          <line x1="26" y1="30" x2="26" y2="19" stroke="#102A56" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="26" y1="30" x2="34" y2="33" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="26" cy="30" r="2.5" fill="#0866FF" />
        </g>
      </svg>
    </div>
  );
};

export const OutlineBooksIllustration3D: React.FC = () => {
  const uid = useId().replace(/:/g, '');
  const b1 = `ob-b1-${uid}`;
  const b2 = `ob-b2-${uid}`;
  const b3 = `ob-b3-${uid}`;

  return (
    <div aria-hidden="true" className="relative w-[92px] h-[78px] select-none pointer-events-none shrink-0">
      <svg viewBox="0 0 110 92" className="w-full h-full overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={b1} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#0866FF" />
          </linearGradient>
          <linearGradient id={b2} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id={b3} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        <ellipse cx="55" cy="82" rx="44" ry="6" fill="#059669" fillOpacity="0.14" />

        {/* Quyển dưới: Xanh lá */}
        <g transform="translate(8, 52)">
          <rect x="0" y="0" width="90" height="22" rx="6" fill={`url(#${b3})`} />
          <rect x="10" y="4" width="73" height="13" rx="3" fill="#ECFDF5" />
          <rect x="0" y="0" width="13" height="22" rx="4" fill="#047857" />
        </g>

        {/* Quyển giữa: Vàng cam */}
        <g transform="translate(12, 32)">
          <rect x="0" y="0" width="84" height="21" rx="6" fill={`url(#${b2})`} />
          <rect x="10" y="4" width="67" height="12" rx="3" fill="#FFFBEB" />
          <rect x="0" y="0" width="12" height="21" rx="4" fill="#D97706" />
        </g>

        {/* Quyển trên: Xanh dương */}
        <g transform="translate(15, 10)">
          <path d="M3 7L16 0H84L74 7H3Z" fill="#93C5FD" />
          <rect x="0" y="6" width="80" height="20" rx="5.5" fill={`url(#${b1})`} />
          <rect x="10" y="10" width="63" height="11" rx="2.5" fill="#EFF6FF" />
          <rect x="0" y="6" width="12" height="20" rx="4" fill="#1D4ED8" />
          {/* Dây đánh dấu trang */}
          <path d="M62 20V32L66 29L70 32V20H62Z" fill="#EF4444" />
        </g>
      </svg>
    </div>
  );
};
