import React from 'react';
import { clsx } from 'clsx';
import { setLang, useLang } from '../../i18n';

// English | తెలుగు - each choice is written in its own language so anyone
// can find theirs. Same light frame as the other top-bar buttons; the
// language in use is bold with a short red underline (like the open tab).
// The choice is remembered on this device.
export const LanguageSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const lang = useLang();

  const option = (value: 'en' | 'te', label: string, short: string) => {
    const on = lang === value;
    return (
      <button
        type="button"
        onClick={() => setLang(value)}
        aria-pressed={on}
        aria-label={label}
        lang={value}
        className={clsx(
          'relative h-full px-2.5 sm:px-3.5 flex items-center transition-colors',
          value === 'te' ? 'text-[15px] leading-none border-l border-v26-line' : 'text-base',
          on ? 'font-bold text-v26-ink' : 'text-v26-muted hover:text-v26-ink hover:bg-v26-soft'
        )}
      >
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{label}</span>
        {on && <span aria-hidden="true" className="absolute left-2.5 right-2.5 bottom-1.5 h-[3px] bg-v26-red" />}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="Language / భాష"
      className={clsx('h-11 flex border border-v26-line bg-v26-paper shrink-0 hover:border-v26-ink transition-colors', className)}
    >
      {option('en', 'English', 'En')}
      {option('te', 'తెలుగు', 'తె')}
    </div>
  );
};
