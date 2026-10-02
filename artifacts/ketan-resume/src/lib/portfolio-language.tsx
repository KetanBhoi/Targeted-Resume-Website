import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import {
  languageStorageKey,
  portfolioLanguages,
  resolveLanguage,
  withLanguageParam,
  type PortfolioLanguage,
} from './portfolio-language-core';
import { localizePortfolio, translate, type LocalizedPortfolio } from './portfolio-translations';
import '@/styles/portfolio-language.css';

export type { PortfolioLanguage } from './portfolio-language-core';
export { portfolioLanguages } from './portfolio-language-core';

export interface PortfolioLanguageContextValue {
  language: PortfolioLanguage;
  setLanguage: (language: PortfolioLanguage) => void;
  /** Dictionary lookup by English original; falls back to the English original. */
  t: (englishText: string) => string;
  /** Localized portfolio data. The global English portfolio remains authoritative for PDFs and AI context. */
  portfolio: LocalizedPortfolio;
}

const Context = createContext<PortfolioLanguageContextValue | null>(null);

function readStored(): string | null {
  try { return window.localStorage.getItem(languageStorageKey); } catch { return null; }
}
function readLanguage(): PortfolioLanguage {
  return resolveLanguage(window.location.search, readStored());
}
const publicPaths = new Set(['', '/', '/portfolio']);

export function PortfolioLanguageProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [language, setLang] = useState<PortfolioLanguage>(readLanguage);

  // Back/forward and in-app navigation: URL wins.
  useEffect(() => {
    const sync = () => setLang(readLanguage());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => { setLang(readLanguage()); }, [location]);

  // Only the public portfolio is localized; private routes and the English brief stay en.
  const isPublic = publicPaths.has(location);
  useEffect(() => {
    document.documentElement.lang = isPublic ? language : 'en';
    return () => { document.documentElement.lang = 'en'; };
  }, [language, isPublic]);

  const setLanguage = useCallback((next: PortfolioLanguage) => {
    setLang(next);
    try { window.localStorage.setItem(languageStorageKey, next); } catch { /* storage unavailable */ }
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState(window.history.state, '', withLanguageParam(current, next, window.location.origin));
  }, []);

  const value = useMemo<PortfolioLanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (text) => translate(language, text),
    portfolio: localizePortfolio(language),
  }), [language, setLanguage]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

const englishFallback: PortfolioLanguageContextValue = {
  language: 'en',
  setLanguage: () => undefined,
  t: (text) => text,
  portfolio: localizePortfolio('en'),
};

export function usePortfolioLanguage(): PortfolioLanguageContextValue {
  return useContext(Context) ?? englishFallback;
}

export function languageOptions() { return portfolioLanguages; }
