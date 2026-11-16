import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Clock } from 'lucide-react';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  tone?: StatusTone;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

const TONE_MAP: Record<StatusTone, { cls: string; defaultIcon: React.ReactNode }> = {
  success: {
    cls: 'bg-[#ECFDF5] text-[#0F766E] border-[#A7F3D0]',
    defaultIcon: <CheckCircle2 className="w-3.5 h-3.5 text-[#12A879] shrink-0" />,
  },
  warning: {
    cls: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
    defaultIcon: <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />,
  },
  danger: {
    cls: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
    defaultIcon: <XCircle className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />,
  },
  info: {
    cls: 'bg-[#EAF3FF] text-[#102C54] border-[#C7DCFA]',
    defaultIcon: <Info className="w-3.5 h-3.5 text-[#1769F4] shrink-0" />,
  },
  neutral: {
    cls: 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]',
    defaultIcon: <Clock className="w-3.5 h-3.5 text-[#64748B] shrink-0" />,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone = 'neutral',
  label,
  icon,
  className = '',
}) => {
  const cfg = TONE_MAP[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${cfg.cls} ${className}`}
    >
      {icon !== undefined ? icon : cfg.defaultIcon}
      <span>{label}</span>
    </span>
  );
};
