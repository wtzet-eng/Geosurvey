import { REPORT_LANGUAGES } from '../data/countries';
import type { ReportLanguage } from '../types';

const EXTRA_REPORT_LANGUAGES: ReportLanguage[] = [
  { code: 'fr', label: 'Français (French)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fi', label: 'Suomi (Finnish)' },
  { code: 'sk', label: 'Slovenčina (Slovak)' }
];

export const REPORT_LANGUAGE_OPTIONS: ReportLanguage[] = [
  ...REPORT_LANGUAGES,
  ...EXTRA_REPORT_LANGUAGES
].filter((item, index, all) => all.findIndex(other => other.code === item.code) === index);

export const SUPPORTED_REPORT_LANGUAGE_CODES = new Set(REPORT_LANGUAGE_OPTIONS.map(language => language.code));

const COUNTRY_SPECIFIC_LANGUAGE: Record<string, string> = {
  sk: 'SK',
  cs: 'CZ',
  da: 'DK',
  no: 'NO',
  sv: 'SE'
};

const normalizeCode = (language: string): string => {
  const code = String(language || '').toLowerCase().split('-')[0];
  return code === 'nb' ? 'no' : code;
};

export function normalizeReportLanguage(language: string, countryCode = ''): string {
  const code = normalizeCode(language);
  const requiredCountry = COUNTRY_SPECIFIC_LANGUAGE[code];
  if (requiredCountry && requiredCountry !== String(countryCode || '').toUpperCase()) return 'en';
  return SUPPORTED_REPORT_LANGUAGE_CODES.has(code) ? code : 'en';
}

export function getAvailableReportLanguages(countryCode: string, nativeLanguage: string): ReportLanguage[] {
  const country = String(countryCode || '').toUpperCase();
  const native = normalizeCode(nativeLanguage);

  return REPORT_LANGUAGE_OPTIONS
    .filter(language => {
      const requiredCountry = COUNTRY_SPECIFIC_LANGUAGE[language.code];
      return !requiredCountry || requiredCountry === country;
    })
    .sort((a, b) => {
      const rank = (language: ReportLanguage) => language.code === native ? 0 : language.code === 'en' ? 1 : 2;
      const rankDiff = rank(a) - rank(b);
      if (rankDiff) return rankDiff;
      return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });
    });
}
