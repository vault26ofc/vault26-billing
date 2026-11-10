import React from 'react';
import { clsx } from 'clsx';
import { setLang, useLang } from '../../i18n';

// One small square button, same frame as the other top-bar buttons. It shows
// the letter of the OTHER language: అ while the app is in English (tap for
// Telugu), A while it is in Telugu (tap for English). The choice is
// remembered on this device.
export const LanguageSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const lang = useLang();
  const toTelugu = lang === 'en';
  const label = toTelugu ? 'తెలుగులో చూపించు · Switch to Telugu' : 'Switch to English · ఇంగ్లీష్‌లో చూపించు';

  return (
    <button
      type="button"
      onClick={() => setLang(toTelugu ? 'te' : 'en')}
      title={label}
      aria-label={label}
      lang={toTelugu ? 'te' : 'en'}
      className={clsx(
        'h-11 w-11 shrink-0 flex items-center justify-center border border-v26-line bg-v26-paper text-v26-ink font-bold transition-colors hover:border-v26-ink hover:bg-v26-soft',
        toTelugu ? 'text-[22px] leading-none pt-0.5' : 'text-xl leading-none',
        className
      )}
    >
      {toTelugu ? 'అ' : 'A'}
    </button>
  );
};
