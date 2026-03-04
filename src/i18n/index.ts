import is from './is.json';
import en from './en.json';

const translations = { is, en } as const;

export type Locale = keyof typeof translations;
export const locales: Locale[] = ['is', 'en'];
export const defaultLocale: Locale = 'is';

export function t(locale: Locale = 'is') {
  return translations[locale];
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/');
  if (lang && locales.includes(lang as Locale)) {
    return lang as Locale;
  }
  return defaultLocale;
}

export function getLocalizedPath(path: string, locale: Locale): string {
  return `/${locale}${path}`;
}
