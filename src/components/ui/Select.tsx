import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useT } from '../../i18n';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  // Options with the same group are listed under one heading.
  group?: string;
}

interface SelectProps {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  value: string;
  // Same shape as a native <select> change, so callers can keep e.target.value.
  onChange?: (e: { target: { value: string } }) => void;
  placeholder?: string;
  // Classes for the outer wrapper (width) and for the button (height etc.).
  className?: string;
  buttonClassName?: string;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  // Shows a search box at the top of the list. Default: on for long lists.
  searchable?: boolean;
}

type Place = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

// Vault 26 dropdown: big rows, black and white, a tick on the chosen one.
// The list is drawn in a portal so a scrolling box or a modal never cuts it off.
export const Select: React.FC<SelectProps> = ({
  label,
  helperText,
  error,
  options,
  value,
  onChange,
  placeholder,
  className,
  buttonClassName,
  id,
  disabled,
  searchable,
  'aria-label': ariaLabel,
}) => {
  const t = useT();
  const autoId = useId();
  const buttonId = id || autoId;
  const listId = `${buttonId}-list`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<Place | null>(null);

  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.group || '').toLowerCase().includes(q)) : options;
  }, [options, query]);

  const measure = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const wanted = Math.min(360, visible.length * 48 + (showSearch ? 64 : 8));
    const openUp = below < Math.min(wanted, 220) && above > below;
    const room = Math.max(140, Math.min(360, (openUp ? above : below) - 4));
    setPlace({
      left: r.left,
      width: Math.max(r.width, 220),
      maxHeight: room,
      ...(openUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  }, [visible.length, showSearch]);

  const openList = () => {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const choose = (opt: SelectOption | undefined) => {
    if (!opt || opt.disabled) return;
    if (opt.value !== value) onChange?.({ target: { value: opt.value } });
    close();
  };

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    const onMove = (e: Event) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      measure();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 0);
    else setTimeout(() => listRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, measure, showSearch]);

  // Keep the highlighted row in view while moving with the arrow keys.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const step = (dir: 1 | -1) => {
    if (visible.length === 0) return;
    let i = active;
    for (let n = 0; n < visible.length; n++) {
      i = (i + dir + visible.length) % visible.length;
      if (!visible[i].disabled) break;
    }
    setActive(i);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(visible[active]);
    } else if (e.key === 'Escape') {
      // Close only this list, not the box (Modal) it may be sitting in.
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openList();
    }
  };

  let lastGroup: string | undefined;

  return (
    <div className={twMerge(clsx('w-full flex flex-col gap-1.5', className))}>
      {label && (
        <label htmlFor={buttonId} className="label">
          {label}
        </label>
      )}

      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
        className={twMerge(
          clsx(
            'w-full h-11 flex items-center justify-between gap-2 bg-v26-paper text-v26-ink text-base px-3.5 border border-v26-line text-left transition-colors hover:border-v26-ink focus:outline-none focus-visible:border-v26-ink disabled:opacity-40 disabled:cursor-not-allowed',
            open && 'border-v26-ink',
            error && 'border-status-red',
            buttonClassName
          )
        )}
      >
        <span className={clsx('truncate', !selected && 'text-[#8A8A8A]')}>{selected ? selected.label : placeholder || t('Choose…')}</span>
        <ChevronDown size={20} className={clsx('shrink-0 text-v26-muted transition-transform', open && 'rotate-180')} />
      </button>

      {error ? (
        <span className="text-sm text-status-red font-bold">{error}</span>
      ) : helperText ? (
        <span className="text-sm text-v26-muted">{helperText}</span>
      ) : null}

      {open &&
        place &&
        createPortal(
          <div
            style={{ position: 'fixed', left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
            className="z-[70] bg-v26-paper border border-v26-ink shadow-float flex flex-col"
          >
            {showSearch && (
              <div className="p-2 border-b border-v26-line relative">
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-v26-muted" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onListKey}
                  placeholder={t('Search')}
                  aria-label={t('Search')}
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                  className="field h-11 pl-10"
                />
              </div>
            )}
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={label ? undefined : buttonId}
              aria-label={label || ariaLabel}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              onKeyDown={onListKey}
              className="overflow-y-auto py-1 focus:outline-none"
            >
              {visible.length === 0 && <div className="px-4 py-3 text-base text-v26-muted">{t('Nothing found.')}</div>}
              {visible.map((opt, i) => {
                const header = opt.group && opt.group !== lastGroup ? opt.group : null;
                lastGroup = opt.group;
                const isSel = opt.value === value;
                return (
                  <React.Fragment key={`${opt.group || ''}|${opt.value}`}>
                    {header && (
                      <div className="px-4 pt-3 pb-1 text-sm font-bold text-v26-muted border-t border-v26-line first:border-t-0">{header}</div>
                    )}
                    <div
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isSel}
                      aria-disabled={opt.disabled || undefined}
                      onMouseEnter={() => !opt.disabled && setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(opt)}
                      className={clsx(
                        'min-h-[3rem] px-4 py-2.5 flex items-center justify-between gap-3 text-base cursor-pointer select-none',
                        opt.disabled ? 'opacity-40 cursor-not-allowed' : i === active ? 'bg-v26-soft' : '',
                        isSel && 'font-bold'
                      )}
                    >
                      <span className="break-words">{opt.label}</span>
                      {isSel && <Check size={20} className="shrink-0 text-v26-red" />}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

Select.displayName = 'Select';
