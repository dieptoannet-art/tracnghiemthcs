import React from 'react';

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: 'blue' | 'navy' | 'success' | 'warning';
  className?: string;
}

const ACCENT_ICON_BG: Record<NonNullable<StatTileProps['accent']>, string> = {
  blue: 'bg-[#EAF3FF] text-[#1769F4]',
  navy: 'bg-[#102C54]/10 text-[#102C54]',
  success: 'bg-[#ECFDF5] text-[#12A879]',
  warning: 'bg-[#FFFBEB] text-[#D97706]',
};

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  hint,
  icon,
  accent = 'blue',
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-[0_6px_18px_-8px_rgba(16,44,84,0.07)] flex items-start justify-between gap-3 ${className}`}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#64748B] truncate">{label}</p>
        <div className="text-xl sm:text-2xl font-extrabold text-[#102C54] td-tabular-nums mt-1 leading-tight">
          {value}
        </div>
        {hint && <p className="text-[11px] text-[#64748B] mt-1 truncate">{hint}</p>}
      </div>
      {icon && (
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ACCENT_ICON_BG[accent]}`}
        >
          {icon}
        </div>
      )}
    </div>
  );
};
