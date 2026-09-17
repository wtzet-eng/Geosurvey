export interface ActionText {
  compare: string;
  compareReadyTitle: string;
  compareDisabledTitle: string;
  drive: string;
  driveTitle: string;
  embed: string;
  embedTitle: string;
  saved: string;
  interpretWithAi: string;
  interpretAria: string;
}

const en: ActionText = {
  compare: 'Compare sites with AI',
  compareReadyTitle: 'Compare saved sites with AI',
  compareDisabledTitle: 'Save at least two site reports to compare them',
  drive: 'Google Drive',
  driveTitle: 'Manage reports in Google Drive',
  embed: 'Embed Widget',
  embedTitle: 'Get embed code for your website',
  saved: 'Saved',
  interpretWithAi: 'Interpret with AI',
  interpretAria: 'Interpret report evidence with AI'
};

const translations: Record<string, ActionText> = {
  en,
  de: { compare: 'Standorte mit KI vergleichen', compareReadyTitle: 'Gespeicherte Standorte mit KI vergleichen', compareDisabledTitle: 'Speichern Sie mindestens zwei Standortberichte, um sie zu vergleichen', drive: 'Google Drive', driveTitle: 'Berichte in Google Drive verwalten', embed: 'Widget einbetten', embedTitle: 'Einbettungscode für Ihre Website abrufen', saved: 'Gespeichert', interpretWithAi: 'Mit KI interpretieren', interpretAria: 'Berichtsdaten mit KI interpretieren' },
  pl: { compare: 'Porównaj lokalizacje z AI', compareReadyTitle: 'Porównaj zapisane lokalizacje z AI', compareDisabledTitle: 'Zapisz co najmniej dwa raporty, aby je porównać', drive: 'Google Drive', driveTitle: 'Zarządzaj raportami w Google Drive', embed: 'Osadź widżet', embedTitle: 'Pobierz kod osadzania dla swojej strony', saved: 'Zapisane', interpretWithAi: 'Interpretuj z AI', interpretAria: 'Interpretuj dane raportu z AI' },
  nl: { compare: 'Locaties vergelijken met AI', compareReadyTitle: 'Opgeslagen locaties vergelijken met AI', compareDisabledTitle: 'Sla minstens twee locatierapporten op om ze te vergelijken', drive: 'Google Drive', driveTitle: 'Rapporten beheren in Google Drive', embed: 'Widget insluiten', embedTitle: 'Insluitcode voor uw website ophalen', saved: 'Opgeslagen', interpretWithAi: 'Interpreteren met AI', interpretAria: 'Rapportbewijs interpreteren met AI' },
  cs: { compare: 'Porovnat lokality pomocí AI', compareReadyTitle: 'Porovnat uložené lokality pomocí AI', compareDisabledTitle: 'Uložte alespoň dva reporty lokalit, abyste je mohli porovnat', drive: 'Google Drive', driveTitle: 'Spravovat reporty v Google Drive', embed: 'Vložit widget', embedTitle: 'Získat kód pro vložení na váš web', saved: 'Uložené', interpretWithAi: 'Interpretovat pomocí AI', interpretAria: 'Interpretovat podklady reportu pomocí AI' },
  da: { compare: 'Sammenlign lokaliteter med AI', compareReadyTitle: 'Sammenlign gemte lokaliteter med AI', compareDisabledTitle: 'Gem mindst to lokalitetsrapporter for at sammenligne dem', drive: 'Google Drive', driveTitle: 'Administrer rapporter i Google Drive', embed: 'Integrer widget', embedTitle: 'Hent integreringskode til dit website', saved: 'Gemte', interpretWithAi: 'Fortolk med AI', interpretAria: 'Fortolk rapportens evidens med AI' },
  no: { compare: 'Sammenlign områder med KI', compareReadyTitle: 'Sammenlign lagrede områder med KI', compareDisabledTitle: 'Lagre minst to områdrapporter for å sammenligne dem', drive: 'Google Drive', driveTitle: 'Administrer rapporter i Google Drive', embed: 'Bygg inn widget', embedTitle: 'Hent innbyggingskode for nettstedet ditt', saved: 'Lagret', interpretWithAi: 'Tolk med KI', interpretAria: 'Tolk rapportgrunnlaget med KI' },
  sv: { compare: 'Jämför platser med AI', compareReadyTitle: 'Jämför sparade platser med AI', compareDisabledTitle: 'Spara minst två platsrapporter för att jämföra dem', drive: 'Google Drive', driveTitle: 'Hantera rapporter i Google Drive', embed: 'Bädda in widget', embedTitle: 'Hämta inbäddningskod för din webbplats', saved: 'Sparat', interpretWithAi: 'Tolka med AI', interpretAria: 'Tolka rapportunderlaget med AI' },
  sk: { compare: 'Porovnať lokality pomocou AI', compareReadyTitle: 'Porovnať uložené lokality pomocou AI', compareDisabledTitle: 'Uložte aspoň dva reporty lokalít, aby ste ich mohli porovnať', drive: 'Google Drive', driveTitle: 'Spravovať reporty v Google Drive', embed: 'Vložiť widget', embedTitle: 'Získať kód na vloženie na váš web', saved: 'Uložené', interpretWithAi: 'Interpretovať pomocou AI', interpretAria: 'Interpretovať podklady reportu pomocou AI' },
  fr: { compare: 'Comparer les sites avec l’IA', compareReadyTitle: 'Comparer les sites enregistrés avec l’IA', compareDisabledTitle: 'Enregistrez au moins deux rapports de site pour les comparer', drive: 'Google Drive', driveTitle: 'Gérer les rapports dans Google Drive', embed: 'Intégrer le widget', embedTitle: 'Obtenir le code d’intégration pour votre site', saved: 'Enregistrés', interpretWithAi: 'Interpréter avec l’IA', interpretAria: 'Interpréter les éléments du rapport avec l’IA' },
  es: { compare: 'Comparar sitios con IA', compareReadyTitle: 'Comparar sitios guardados con IA', compareDisabledTitle: 'Guarde al menos dos informes de sitio para compararlos', drive: 'Google Drive', driveTitle: 'Gestionar informes en Google Drive', embed: 'Insertar widget', embedTitle: 'Obtener el código para insertar en su web', saved: 'Guardados', interpretWithAi: 'Interpretar con IA', interpretAria: 'Interpretar la evidencia del informe con IA' },
  fi: { compare: 'Vertaa kohteita tekoälyllä', compareReadyTitle: 'Vertaa tallennettuja kohteita tekoälyllä', compareDisabledTitle: 'Tallenna vähintään kaksi kohderaporttia vertailua varten', drive: 'Google Drive', driveTitle: 'Hallitse raportteja Google Drivessa', embed: 'Upota pienoisohjelma', embedTitle: 'Hae upotuskoodi verkkosivullesi', saved: 'Tallennetut', interpretWithAi: 'Tulkitse tekoälyllä', interpretAria: 'Tulkitse raportin näyttöä tekoälyllä' }
};

export const getActionText = (language?: string): ActionText => {
  const raw = String(language || 'en').toLowerCase().split('-')[0];
  const code = raw === 'nb' ? 'no' : raw;
  return translations[code] || en;
};
