import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useT } from '../../i18n';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children, footer, maxWidth = 'md' }) => {
  const t = useT();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:m-0 print:static print:block"
    >
      <div className="fixed inset-0 bg-v26-ink/60 transition-opacity no-print" onClick={onClose} />

      <div
        className={twMerge(
          clsx(
            'relative w-full bg-v26-paper border border-v26-ink shadow-modal z-10 my-6 flex flex-col max-h-[92vh] print:border-none print:shadow-none print:m-0 print:p-0 print:max-h-none print:bg-transparent',
            maxWidthStyles[maxWidth]
          )
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-v26-line no-print">
          <div className="min-w-0">
            <h3 className="font-display text-xl sm:text-2xl text-v26-ink break-words">{title}</h3>
            {subtitle && <p className="text-sm text-v26-muted mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-v26-muted hover:text-v26-ink hover:bg-v26-soft"
            aria-label={t('Close')}
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 print:p-0 print:overflow-visible">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-v26-line bg-v26-soft flex flex-wrap items-center justify-end gap-3 no-print">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
