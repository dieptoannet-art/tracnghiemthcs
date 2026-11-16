import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  kicker?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  kicker,
  icon,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1 ${className}`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        {icon && (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1769F4] to-[#102C54] text-white shadow-[0_8px_18px_-4px_rgba(23,105,244,0.35)] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {kicker && (
            <p className="text-xs font-semibold text-[#1769F4] tracking-wide mb-0.5">
              {kicker}
            </p>
          )}
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#102C54] tracking-tight text-balance leading-snug">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 leading-relaxed max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>
      )}
    </div>
  );
};
