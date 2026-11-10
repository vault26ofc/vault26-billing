import React from 'react';
import { clsx } from 'clsx';
import { setLang, useLang } from '../../i18n';

// English | తెలుగు - each choice is written in its own language so anyone
// can find theirs. The choice is remembered on this device.
export const LanguageSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const lang = useLang();
  // Short labels on phones so the top bar fits; full words from tablet size up.
  const option = (value: 'en' | 'te', label: string, short: string) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      aria-label={label}
      lang={value}
      className={clsx(
        'h-full px-2.5 sm:px-3 text-base transition-colors',
        lang === value ? 'bg-v26-ink text-white font-bold' : 'bg-v26-paper text-v26-ink hover:bg-v26-soft'
      )}
    >
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div role="group" aria-label="Language / భాష" className={clsx('h-11 flex border border-v26-ink shrink-0', className)}>
      {option('en', 'English', 'En')}
      {option('te', 'తెలుగు', 'తె')}
    </div>
  );
};
