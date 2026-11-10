import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface MetricBlockProps {
  label: string;
  value: string | number;
  subValue?: string;
  subtext?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
  action?: React.ReactNode;
}

// One number with a plain label above it.
export const MetricBlock: React.FC<MetricBlockProps> = ({ label, value, subValue, subtext, trend, className, action }) => {
  const displaySub = subtext || subValue;
  return (
    <div className={twMerge(clsx('card p-4 sm:p-5 flex flex-col justify-between', className))}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="label">{label}</span>
        {action && <div>{action}</div>}
      </div>

      <div>
        <div className="text-2xl sm:text-3xl font-black text-v26-ink break-words">{value}</div>

        {(displaySub || trend) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            {trend && (
              <span
                className={clsx(
                  'font-bold px-1.5 py-0.5 border',
                  trend.isPositive
                    ? 'bg-status-greenBg text-status-green border-status-greenBorder'
                    : 'bg-status-redBg text-status-red border-status-redBorder'
                )}
              >
                {trend.value}
              </span>
            )}
            {displaySub && <span className="text-v26-muted">{displaySub}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
