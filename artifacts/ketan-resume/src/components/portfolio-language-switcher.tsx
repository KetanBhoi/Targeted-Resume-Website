import { Languages } from 'lucide-react';
import { normalizeLanguage } from '@/lib/portfolio-language-core';
import { portfolioLanguages, usePortfolioLanguage } from '@/lib/portfolio-language';

export default function PortfolioLanguageSwitcher() {
  const { language, setLanguage, t } = usePortfolioLanguage();
  return (
    <label className="inline-flex items-center gap-1.5 border border-border bg-card/70 px-2 py-1.5 font-mono-custom text-[10px] text-foreground">
      <Languages className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{t('Language')}</span>
      <select
        value={language}
        onChange={(e) => { const next = normalizeLanguage(e.target.value); if (next) setLanguage(next); }}
        className="bg-transparent text-[11px] focus:outline-none"
        data-testid="select-portfolio-language"
        aria-label={t('Language')}
      >
        {portfolioLanguages.map((l) => <option key={l.value} value={l.value} lang={l.htmlLang}>{l.label}</option>)}
      </select>
    </label>
  );
}
