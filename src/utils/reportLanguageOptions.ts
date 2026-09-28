import { EUROPEAN_COUNTRIES, REPORT_LANGUAGES } from '../data/countries';
import type { ReportLanguage } from '../types';

const EXTRA_REPORT_LANGUAGES: ReportLanguage[] = [
  { code: 'fr', label: 'Français (French)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fi', label: 'Suomi (Finnish)' },
  { code: 'sk', label: 'Slovenčina (Slovak)' },
  { code: 'hr', label: 'Hrvatski (Croatian)' }
];

export const REPORT_LANGUAGE_OPTIONS: ReportLanguage[] = [
  ...REPORT_LANGUAGES,
  ...EXTRA_REPORT_LANGUAGES
].filter((item, index, all) => all.findIndex(other => other.code === item.code) === index);

export const SUPPORTED_REPORT_LANGUAGE_CODES = new Set(REPORT_LANGUAGE_OPTIONS.map(language => language.code));

const normalizeCode = (language: string): string => {
  const code = String(language || '').toLowerCase().split('-')[0];
  return code === 'nb' ? 'no' : code;
};

export function normalizeReportLanguage(language: string, _countryCode = ''): string {
  const code = normalizeCode(language);
  return SUPPORTED_REPORT_LANGUAGE_CODES.has(code) ? code : 'en';
}

export function getDefaultReportLanguageForCountry(countryCode: string, nativeLanguage?: string): string {
  const country = EUROPEAN_COUNTRIES.find(item => item.code === String(countryCode || '').toUpperCase());
  return normalizeReportLanguage(nativeLanguage || country?.language || 'en', country?.code || countryCode);
}

export function getAvailableReportLanguages(_countryCode: string, nativeLanguage: string): ReportLanguage[] {
  const native = normalizeCode(nativeLanguage);

  return REPORT_LANGUAGE_OPTIONS
    .sort((a, b) => {
      const rank = (language: ReportLanguage) => language.code === native ? 0 : language.code === 'en' ? 1 : 2;
      const rankDiff = rank(a) - rank(b);
      if (rankDiff) return rankDiff;
      return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });
    });
}
