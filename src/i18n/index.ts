import { useSyncExternalStore } from 'react';
import { te } from './te';

// English / Telugu switch for every billing screen. The English sentence is
// its own key: tr('New bill') shows "New bill" in English and the Telugu
// from te.ts in Telugu. A sentence with no Telugu yet falls back to English,
// so the screen never shows a blank or a raw key.
//
// Printed documents (bills, GST invoices, monthly PDF, price tags) stay in
// English - they go to customers and to the GST records.

export type Lang = 'en' | 'te';

const STORAGE_KEY = 'v26-billing-lang';

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'te' ? 'te' : 'en';
  } catch {
    return 'en';
  }
}

let lang: Lang = readStoredLang();
const listeners = new Set<() => void>();

function applyDocumentLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
applyDocumentLang();

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private window or blocked storage: the switch still works until reload.
  }
  applyDocumentLang();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const warned = new Set<string>();

/** Translate one English sentence. `{name}` placeholders are filled from vars. */
export function tr(text: string, vars?: Record<string, string | number>): string {
  let out = text;
  if (lang === 'te') {
    const telugu = te[text];
    if (telugu) out = telugu;
    else if (import.meta.env.DEV && !warned.has(text)) {
      warned.add(text);
      console.warn('[i18n] No Telugu yet for:', text);
    }
  }
  return vars ? out.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined ? '' : String(vars[k]))) : out;
}

/** Re-renders the component when the language changes. */
export function useT(): typeof tr {
  useSyncExternalStore(subscribe, getLang, getLang);
  return tr;
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
