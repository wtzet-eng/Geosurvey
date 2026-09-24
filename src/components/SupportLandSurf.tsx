import React from 'react';
import { Heart } from 'lucide-react';

type SupportCopy = { heading: string; body: string; button: string; thanks: string };

const SUPPORT_COPY: Record<string, SupportCopy> = {
  en: { heading:'Support LandSurf', body:'If this report was useful, you can support the continued development of LandSurf. Support is voluntary and does not provide extra access or services.', button:'Thank you for support', thanks:'Every supporter receives a personal thank-you.' },
  de: { heading:'LandSurf unterstützen', body:'Wenn dieser Bericht hilfreich war, können Sie die Weiterentwicklung von LandSurf unterstützen. Die Unterstützung ist freiwillig und bietet keinen zusätzlichen Zugang oder Service.', button:'Danke für Ihre Unterstützung', thanks:'Jede Unterstützung erhält ein persönliches Dankeschön.' },
  pl: { heading:'Wesprzyj LandSurf', body:'Jeśli ten raport był przydatny, możesz wesprzeć dalszy rozwój LandSurf. Wsparcie jest dobrowolne i nie zapewnia dodatkowego dostępu ani usług.', button:'Dziękuję za wsparcie', thanks:'Każda osoba wspierająca otrzymuje osobiste podziękowanie.' },
  nl: { heading:'Steun LandSurf', body:'Als dit rapport nuttig was, kunt u de verdere ontwikkeling van LandSurf steunen. Steun is vrijwillig en geeft geen extra toegang of diensten.', button:'Dank voor uw steun', thanks:'Elke supporter ontvangt een persoonlijk bedankje.' },
  cs: { heading:'Podpořte LandSurf', body:'Pokud pro vás byl tento report užitečný, můžete podpořit další vývoj LandSurf. Podpora je dobrovolná a neposkytuje žádný další přístup ani služby.', button:'Děkuji za podporu', thanks:'Každému podporovateli osobně poděkujeme.' },
  da: { heading:'Støt LandSurf', body:'Hvis rapporten var nyttig, kan du støtte den fortsatte udvikling af LandSurf. Støtten er frivillig og giver ikke ekstra adgang eller tjenester.', button:'Tak for støtten', thanks:'Alle støtter får en personlig tak.' },
  no: { heading:'Støtt LandSurf', body:'Hvis rapporten var nyttig, kan du støtte den videre utviklingen av LandSurf. Støtten er frivillig og gir ikke ekstra tilgang eller tjenester.', button:'Takk for støtten', thanks:'Alle som støtter får en personlig takk.' },
  sv: { heading:'Stöd LandSurf', body:'Om rapporten var till hjälp kan du stödja den fortsatta utvecklingen av LandSurf. Stödet är frivilligt och ger ingen extra åtkomst eller tjänst.', button:'Tack för stödet', thanks:'Alla som stödjer får ett personligt tack.' },
  sk: { heading:'Podporte LandSurf', body:'Ak bol report užitočný, môžete podporiť ďalší vývoj LandSurf. Podpora je dobrovoľná a neposkytuje dodatočný prístup ani služby.', button:'Ďakujem za podporu', thanks:'Každý podporovateľ dostane osobné poďakovanie.' },
  fr: { heading:'Soutenir LandSurf', body:'Si ce rapport vous a été utile, vous pouvez soutenir le développement continu de LandSurf. Le soutien est volontaire et ne donne pas accès à des services supplémentaires.', button:'Merci pour votre soutien', thanks:'Chaque soutien reçoit un remerciement personnel.' },
  es: { heading:'Apoyar LandSurf', body:'Si este informe le resultó útil, puede apoyar el desarrollo continuo de LandSurf. El apoyo es voluntario y no proporciona acceso ni servicios adicionales.', button:'Gracias por su apoyo', thanks:'Cada persona que apoya recibe un agradecimiento personal.' },
  fi: { heading:'Tue LandSurfia', body:'Jos raportti oli hyödyllinen, voit tukea LandSurfin jatkokehitystä. Tuki on vapaaehtoista eikä tuo lisäkäyttöoikeuksia tai palveluja.', button:'Kiitos tuesta', thanks:'Jokainen tukija saa henkilökohtaisen kiitoksen.' },
  hr: { heading:'Podržite LandSurf', body:'Ako vam je ovaj izvještaj bio koristan, možete podržati daljnji razvoj LandSurfa. Podrška je dobrovoljna i ne omogućuje dodatni pristup ni usluge.', button:'Hvala na podršci', thanks:'Svaka osoba koja podrži projekt dobiva osobnu zahvalu.' }
};

export const supportLandSurfCopy = (language = 'en'): SupportCopy => {
  const code = language.toLowerCase().split('-')[0] === 'nb' ? 'no' : language.toLowerCase().split('-')[0];
  return SUPPORT_COPY[code] || SUPPORT_COPY.en;
};

type Props = { language?: string };

export const SupportLandSurf: React.FC<Props> = ({ language = 'en' }) => {
  const copy = supportLandSurfCopy(language);
  return (
    <section className="mt-6 w-full bg-[#496931] px-4 py-8 sm:px-6" aria-label={copy.heading} data-testid="support-landsurf">
      <div className="mx-auto max-w-5xl text-center text-white">
        <h2 className="text-base font-semibold text-white">{copy.heading}</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-white/85">{copy.body}</p>
        <a
          href="https://ko-fi.com/groundsurf"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#496931] transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#496931]"
        >
          {copy.button}
        </a>
        <p className="mt-3 text-xs text-white/75">{copy.thanks}</p>
      </div>
    </section>
  );
};

export const FloatingSupportLandSurf: React.FC<Props> = ({ language = 'en' }) => {
  const copy = supportLandSurfCopy(language);
  return (
    <a
      href="https://ko-fi.com/groundsurf"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.heading}
      data-testid="floating-support-landsurf"
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#496931] px-4 py-3 text-sm font-bold text-white shadow-xl shadow-slate-950/15 transition hover:bg-[#3f5b2a] focus:outline-none focus:ring-2 focus:ring-[#496931]/40 focus:ring-offset-2 print:hidden sm:w-auto sm:px-4"
    >
      <Heart className="h-4 w-4" />
      <span>{copy.heading}</span>
    </a>
  );
};