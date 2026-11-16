import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#EAF3FF] text-[#1769F4] flex items-center justify-center">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className="text-sm sm:text-base font-bold text-[#102C54]">{title}</h3>
        {description && (
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
};
