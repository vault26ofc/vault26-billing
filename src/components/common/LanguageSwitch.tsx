import React from 'react';
import { clsx } from 'clsx';
import { Lang, setLang, useLang } from '../../i18n';

// Two small squares side by side: A (English) | అ (Telugu). The language in
// use is filled black; tap the other letter to switch. Same height and frame
// as the other top-bar buttons. The choice is remembered on this device.
const OPTIONS: { value: Lang; letter: string; label: string }[] = [
  { value: 'en', letter: 'A', label: 'English' },
  { value: 'te', letter: 'అ', label: 'తెలుగు · Telugu' },
];

export const LanguageSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const lang = useLang();

  return (
    <div role="group" aria-label="Language / భాష" className={clsx('h-11 flex shrink-0 border border-v26-line bg-v26-paper', className)}>
      {OPTIONS.map((o, i) => {
        const on = lang === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setLang(o.value)}
            aria-pressed={on}
            aria-label={o.label}
            title={o.label}
            lang={o.value}
            className={clsx(
              'h-full w-11 flex items-center justify-center font-bold leading-none transition-colors',
              o.value === 'te' ? 'text-[21px] pt-0.5' : 'text-lg',
              i > 0 && 'border-l border-v26-line',
              on ? 'bg-v26-ink text-white' : 'text-v26-muted hover:bg-v26-soft hover:text-v26-ink'
            )}
          >
            {o.letter}
          </button>
        );
      })}
    </div>
  );
};
