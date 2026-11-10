import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  helperText?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, prefix, suffix, className, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id || autoId;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {prefix && (
            <div className="absolute left-3 flex items-center pointer-events-none text-v26-muted">{prefix}</div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={twMerge(
              clsx(
                'w-full h-11 bg-v26-paper text-v26-ink placeholder:text-[#8A8A8A] text-base px-3.5 border border-v26-line focus:border-v26-ink focus:outline-none transition-colors rounded-none',
                prefix && 'pl-10',
                suffix && 'pr-10',
                error && 'border-status-red focus:border-status-red',
                className
              )
            )}
            {...props}
          />

          {suffix && (
            <div className="absolute right-3 flex items-center pointer-events-none text-v26-muted">{suffix}</div>
          )}
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

Input.displayName = 'Input';
