export type PortfolioLanguage = 'en' | 'hi' | 'gu';
export const portfolioLanguages: { value: PortfolioLanguage; label: string; htmlLang: string }[] = [
  { value: 'en', label: 'English', htmlLang: 'en' },
  { value: 'hi', label: 'हिन्दी', htmlLang: 'hi' },
  { value: 'gu', label: 'ગુજરાતી', htmlLang: 'gu' },
];
export const languageStorageKey = 'ketan-portfolio-language';

/** Returns a supported language code, or null when the value is not one of en/hi/gu. */
export function normalizeLanguage(value: string | null | undefined): PortfolioLanguage | null {
  const base = (value ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return base === 'en' || base === 'hi' || base === 'gu' ? base : null;
}

/** URL wins over stored preference; English is the default. */
export function resolveLanguage(search: string, stored?: string | null): PortfolioLanguage {
  return normalizeLanguage(new URLSearchParams(search).get('lang')) ?? normalizeLanguage(stored) ?? 'en';
}

/** Sets ?lang= while preserving every other query parameter and the hash. */
export function withLanguageParam(href: string, language: PortfolioLanguage, origin = 'https://local.invalid'): string {
  const url = new URL(href, origin);
  url.searchParams.set('lang', language);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** ASCII digit runs in a string; translations must keep these identical. */
export function numericTokens(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

export function preservesNumbers(english: string, translated: string): boolean {
  return numericTokens(english).join('|') === numericTokens(translated).join('|');
}
