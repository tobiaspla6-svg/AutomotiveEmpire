// Localisation (English and Spanish).
//
// Only the interface is translated — gameplay data (manufacturers, technologies, historical events, segment names)
// stays in its source language and is not duplicated. The message catalogue is typed: `es` must provide every key of
// `en`, so a missing translation is a compile error. Components never hard-code UI strings; they call `t(key)`.
import { useSyncExternalStore } from 'react';
import { en, type MessageKey } from './en';
import { es } from './es';

export type Lang = 'en' | 'es';
export type { MessageKey };
export const LANGS: { id: Lang; name: string }[] = [{ id: 'en', name: 'English' }, { id: 'es', name: 'Español' }];
export const CATALOGUE: Record<Lang, Record<MessageKey, string>> = { en, es };

const STORAGE_KEY = 'ae.lang';
const isLang = (v: unknown): v is Lang => v === 'en' || v === 'es';

function initialLang(): Lang {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch { /* storage blocked */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() ?? '' : '';
  return nav.startsWith('es') ? 'es' : 'en';
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const getLang = () => current;
export function setLang(lang: Lang) {
  current = lang;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, lang); } catch { /* not persisted */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  for (const l of listeners) l();
}

export type Vars = Record<string, string | number>;
/** Translate a key in a given language; `{name}` placeholders are filled from `vars`. Falls back to English. */
export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const raw = CATALOGUE[lang][key] ?? en[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : raw;
}

type PluralBase = { [K in MessageKey]: K extends `${infer B}.one` ? B : never }[MessageKey];
/** Plural form: keys come in pairs `base.one` / `base.other`; `{count}` is filled in automatically. */
export function translatePlural(lang: Lang, base: PluralBase, count: number, vars?: Vars): string {
  const form = new Intl.PluralRules(lang).select(count) === 'one' ? 'one' : 'other';
  return translate(lang, `${base}.${form}` as MessageKey, { count, ...vars });
}

export const t = (key: MessageKey, vars?: Vars) => translate(current, key, vars);

/** The translator for components: re-renders when the language changes. */
export function useT() {
  const lang = useLang();
  return {
    lang,
    t: (key: MessageKey, vars?: Vars) => translate(lang, key, vars),
    tp: (base: PluralBase, count: number, vars?: Vars) => translatePlural(lang, base, count, vars),
  };
}
export function useLang(): Lang {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, getLang, getLang);
}
