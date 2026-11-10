import React from 'react';
import { useStore, store } from '../../services/store';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useT } from '../../i18n';

export const ToastContainer: React.FC = () => {
  const { toasts } = useStore();
  const t = useT();

  if (toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle size={20} className="text-status-green flex-shrink-0" />,
    warning: <AlertTriangle size={20} className="text-status-amber flex-shrink-0" />,
    error: <AlertCircle size={20} className="text-status-red flex-shrink-0" />,
    info: <Info size={20} className="text-v26-ink flex-shrink-0" />,
  };

  const borders = {
    success: 'border-l-status-green',
    warning: 'border-l-status-amber',
    error: 'border-l-status-red',
    info: 'border-l-v26-ink',
  };

  return (
    <div
      aria-live="polite"
      className="toast-container fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2.5 sm:max-w-sm sm:w-full no-print"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={clsx(
            'p-4 bg-v26-paper border border-v26-line border-l-4 shadow-float flex items-start gap-3',
            borders[toast.type || 'info']
          )}
        >
          <div className="mt-0.5">{icons[toast.type || 'info']}</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-v26-ink">{toast.title}</div>
            {toast.message && <div className="text-sm text-v26-muted mt-0.5 break-words">{toast.message}</div>}
          </div>
          <button
            onClick={() => store.removeToast(toast.id)}
            className="text-v26-muted hover:text-v26-ink p-1"
            aria-label={t('Close')}
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
};
