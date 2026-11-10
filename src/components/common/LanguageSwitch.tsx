import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { Lang, setLang, useLang } from '../../i18n';

// One globe button (same frame as Search / Home) showing the language in use.
// Tapping it opens a small list - English / తెలుగు - with a red tick on the
// current one. Each language is written in itself so anyone can find theirs.
// The choice is remembered on this device.
const LANGS: { value: Lang; label: string; short: string }[] = [
  { value: 'en', label: 'English', short: 'En' },
  { value: 'te', label: 'తెలుగు', short: 'తె' },
];

export const LanguageSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.value === lang) || LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    setTimeout(() => listRef.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openList = () => {
    setActive(Math.max(0, LANGS.findIndex((l) => l.value === lang)));
    setOpen(true);
  };

  const choose = (value: Lang) => {
    setLang(value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + 1) % LANGS.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(LANGS[active].value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={clsx('relative shrink-0', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language / భాష: ${current.label}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openList();
          }
        }}
        className={clsx(
          'h-11 flex items-center gap-2 px-3 border text-base transition-colors bg-v26-paper',
          open ? 'border-v26-ink' : 'border-v26-line hover:border-v26-ink'
        )}
      >
        <Globe size={20} className="text-v26-muted" />
        <span lang={current.value} className={current.value === 'te' ? 'text-[15px]' : undefined}>
          <span className="sm:hidden">{current.short}</span>
          <span className="hidden sm:inline">{current.label}</span>
        </span>
        <ChevronDown size={18} className={clsx('text-v26-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label="Language / భాష"
          aria-activedescendant={`lang-opt-${LANGS[active].value}`}
          onKeyDown={onListKey}
          className="absolute right-0 top-full mt-1 z-40 w-48 bg-v26-paper border border-v26-ink shadow-float py-1 focus:outline-none"
        >
          {LANGS.map((l, i) => {
            const on = l.value === lang;
            return (
              <div
                key={l.value}
                id={`lang-opt-${l.value}`}
                role="option"
                aria-selected={on}
                lang={l.value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(l.value)}
                className={clsx(
                  'min-h-[3rem] px-4 flex items-center justify-between gap-3 cursor-pointer select-none',
                  l.value === 'te' ? 'text-[15px]' : 'text-base',
                  i === active && 'bg-v26-soft',
                  on && 'font-bold'
                )}
              >
                <span>{l.label}</span>
                {on && <Check size={20} className="shrink-0 text-v26-red" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
