import React from 'react';
import { getStatusTheme, statusLabel } from '../../utils/formatters';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useT } from '../../i18n';

interface StatusBadgeProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

// A coloured word: green = good, amber = needs attention, red = stopped.
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, showDot = true }) => {
  const t = useT();
  const theme = getStatusTheme(status);

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-bold border whitespace-nowrap',
          theme.bg,
          theme.text,
          theme.border,
          className
        )
      )}
    >
      {showDot && <span className={clsx('w-2 h-2 rounded-full inline-block flex-shrink-0', theme.dot)} />}
      <span>{t(statusLabel(status))}</span>
    </span>
  );
};
