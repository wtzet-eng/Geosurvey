const LABELS: Record<'cs' | 'sk' | 'da' | 'sv', Record<string, string>> = {
  cs: {
    N: 'Sever', NE: 'Severovýchod', E: 'Východ', SE: 'Jihovýchod', S: 'Jih', SW: 'Jihozápad', W: 'Západ', NW: 'Severozápad',
    North: 'Sever', Northeast: 'Severovýchod', 'North-East': 'Severovýchod', East: 'Východ', Southeast: 'Jihovýchod', 'South-East': 'Jihovýchod',
    South: 'Jih', Southwest: 'Jihozápad', 'South-West': 'Jihozápad', West: 'Západ', Northwest: 'Severozápad', 'North-West': 'Severozápad'
  },
  sk: {
    N: 'Sever', NE: 'Severovýchod', E: 'Východ', SE: 'Juhovýchod', S: 'Juh', SW: 'Juhozápad', W: 'Západ', NW: 'Severozápad',
    North: 'Sever', Northeast: 'Severovýchod', 'North-East': 'Severovýchod', East: 'Východ', Southeast: 'Juhovýchod', 'South-East': 'Juhovýchod',
    South: 'Juh', Southwest: 'Juhozápad', 'South-West': 'Juhozápad', West: 'Západ', Northwest: 'Severozápad', 'North-West': 'Severozápad'
  },
  da: {
    N: 'Nord', NE: 'Nordøst', E: 'Øst', SE: 'Sydøst', S: 'Syd', SW: 'Sydvest', W: 'Vest', NW: 'Nordvest',
    North: 'Nord', Northeast: 'Nordøst', 'North-East': 'Nordøst', East: 'Øst', Southeast: 'Sydøst', 'South-East': 'Sydøst',
    South: 'Syd', Southwest: 'Sydvest', 'South-West': 'Sydvest', West: 'Vest', Northwest: 'Nordvest', 'North-West': 'Nordvest'
  },
  sv: {
    N: 'Norr', NE: 'Nordost', E: 'Öster', SE: 'Sydost', S: 'Söder', SW: 'Sydväst', W: 'Väster', NW: 'Nordväst',
    North: 'Norr', Northeast: 'Nordost', 'North-East': 'Nordost', East: 'Öster', Southeast: 'Sydost', 'South-East': 'Sydost',
    South: 'Söder', Southwest: 'Sydväst', 'South-West': 'Sydväst', West: 'Väster', Northwest: 'Nordväst', 'North-West': 'Nordväst'
  }
};

export function localizeAspect(value: unknown, language: 'cs' | 'sk' | 'da' | 'sv', fallback: string): string {
  const raw = value === null || value === undefined || value === '' || Number.isNaN(value) ? fallback : String(value);
  const labels = LABELS[language];
  for (const key of Object.keys(labels).sort((a, b) => b.length - a.length)) {
    if (raw === key) return labels[key];
    if (raw.startsWith(`${key} (`)) return `${labels[key]}${raw.slice(key.length)}`;
  }
  return raw;
}

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]