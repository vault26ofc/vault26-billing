import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: Option[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, options, children, className, id, ...props }, ref) => {
    const autoId = React.useId();
    const selectId = id || autoId;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="label">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            className={twMerge(
              clsx(
                'w-full h-11 appearance-none bg-v26-paper text-v26-ink text-base px-3.5 pr-10 border border-v26-line focus:border-v26-ink focus:outline-none transition-colors rounded-none cursor-pointer',
                error && 'border-status-red focus:border-status-red',
                className
              )
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3.5 pointer-events-none text-v26-muted">
            <ChevronDown size={18} />
          </div>
        </div>

        {error ? (
          <span className="text-sm text-status-red font-bold">{error}</span>
        ) : helperText ? (
          <span className="text-sm text-v26-muted">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
