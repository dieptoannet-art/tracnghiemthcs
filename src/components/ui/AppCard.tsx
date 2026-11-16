import React from 'react';

export interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'default' | 'soft-blue' | 'navy';
}

const PADDING_MAP: Record<NonNullable<AppCardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-7',
};

const TONE_MAP: Record<NonNullable<AppCardProps['tone']>, string> = {
  default: 'bg-white border-[#E2E8F0] text-[#172B4D]',
  'soft-blue': 'bg-[#EAF3FF]/70 border-[#C7DCFA] text-[#102C54]',
  navy: 'bg-gradient-to-br from-[#102C54] via-[#14376A] to-[#1769F4] border-[#1D4ED8]/40 text-white',
};

export const AppCard: React.FC<AppCardProps> = ({
  interactive = false,
  padding = 'md',
  tone = 'default',
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`rounded-2xl border shadow-[0_8px_24px_-10px_rgba(16,44,84,0.08)] transition-all duration-200 ${
        TONE_MAP[tone]
      } ${PADDING_MAP[padding]} ${
        interactive
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[#1769F4]/45 hover:shadow-[0_16px_34px_-12px_rgba(23,105,244,0.16)]'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
