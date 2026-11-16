import React from 'react';

export type ActionButtonVariant = 'primary' | 'navy' | 'soft' | 'outline' | 'success' | 'danger';
export type ActionButtonSize = 'sm' | 'md' | 'lg';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  primary:
    'bg-[#1769F4] hover:bg-[#0F56D3] text-white border border-transparent shadow-[0_6px_16px_-4px_rgba(23,105,244,0.38)]',
  navy: 'bg-[#102C54] hover:bg-[#15396B] text-white border border-transparent shadow-xs',
  soft: 'bg-[#EAF3FF] hover:bg-[#DCEBFF] text-[#1769F4] border border-[#C7DCFA]',
  outline:
    'bg-white hover:bg-[#F6F9FD] text-[#172B4D] border border-[#E2E8F0] hover:border-[#C7DCFA]',
  success: 'bg-[#12A879] hover:bg-[#0E8F67] text-white border border-transparent shadow-xs',
  danger: 'bg-[#EF4444] hover:bg-[#DC2626] text-white border border-transparent shadow-xs',
};

const SIZE_CLASSES: Record<ActionButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-xs rounded-xl gap-1.5',
  md: 'min-h-[40px] px-4 py-2 text-xs sm:text-sm rounded-xl gap-2',
  lg: 'min-h-[44px] px-5 py-2.5 text-sm rounded-xl gap-2',
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1769F4]/40 ${
        VARIANT_CLASSES[variant]
      } ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="shrink-0 inline-flex">{rightIcon}</span>}
    </button>
  );
};
