export function environmentalEvidenceSource(countryCode: string, compact = false): string {
  if (countryCode === 'PL') return compact ? 'EEA / General Directorate for Environmental Protection (GDOŚ)' : 'European Environment Agency (EEA Natura 2000) & General Directorate for Environmental Protection (GDOŚ)';
  if (countryCode === 'GB') return compact ? 'EEA / Joint Nature Conservation Committee (JNCC)' : 'European Environment Agency (EEA Natura 2000) & Joint Nature Conservation Committee (JNCC)';
  return compact ? 'EEA / competent national environmental authority' : 'European Environment Agency (EEA Natura 2000) & competent national environmental authority';
}
