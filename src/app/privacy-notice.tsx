import Link from "next/link";
import type { Locale } from "@/lib/format";

const content = {
  fi: {
    title: "Tietosuojaseloste",
    updated: "Päivitetty 13.8.2026",
    back: "Takaisin varaamaan",
    switchLabel: "English",
    switchHref: "/en/privacy",
    sections: [
      {
        heading: "Rekisterinpitäjä ja yhteystiedot",
        paragraphs: ["Rekisterinpitäjä on METSÄNILO.", "Tietosuojaa koskevat pyynnöt: tranthanhtuan1410@gmail.com"],
      },
      {
        heading: "Käsiteltävät tiedot",
        paragraphs: [
          "Käsittelemme varauspyynnössä annettuja yhteys- ja tilaustietoja: nimi, matkapuhelinnumero, valinnainen sähköpostiosoite ja lisätiedot, tuote, pakkaus, päivä sekä nouto- tai toimitustapa. Toimituksessa käsittelemme myös katuosoitteen, postinumeron ja kaupungin.",
          "Lisäksi käsittelemme varauksen julkista tunnusta, tilaa, aikaleimoja, kapasiteettimuutoksia sekä rajattuja teknisiä ja auditointitietoja palvelun turvallisuuden ja toimintavarmuuden vuoksi.",
        ],
      },
      {
        heading: "Tarkoitukset ja oikeusperusteet",
        paragraphs: [
          "Käsittelemme tietoja varauspyynnön vastaanottamiseen, saatavuuden varaamiseen, yhteydenottoon sekä noudon tai toimituksen sopimiseen. Käsittely on tarpeen asiakkaan pyynnöstä ennen mahdollisen sopimuksen tekemistä.",
          "Väärinkäytösten estäminen, kapasiteetin johdonmukaisuus, tapahtumahistoria ja palvelun suojaaminen perustuvat METSÄNILOn oikeutettuun etuun ylläpitää turvallista ja luotettavaa varauspalvelua.",
        ],
      },
      {
        heading: "Vastaanottajat ja palveluntarjoajat",
        paragraphs: [
          "Tietoja käyttävät vain valtuutetut METSÄNILOn Manager-käyttäjät. Vercel käsittelee tietoja sovelluksen hosting-palvelun tarjoajana ja Turso/libSQL tietokantapalvelun tarjoajana. Palveluntarjoajat käsittelevät tietoja METSÄNILOn lukuun sopimusten ja soveltuvien tietosuojavelvoitteiden mukaisesti.",
          "Sovelluksen ensisijainen laskenta ja tietokanta sijaitsevat EU-alueella. Jos palveluntarjoaja tai sen alihankkija käsittelee tietoja Euroopan talousalueen ulkopuolella, siirrossa käytetään soveltuvaa hyväksyttyä siirtoperustetta, kuten Euroopan komission riittävyyspäätöstä tai vakiosopimuslausekkeita.",
        ],
      },
      {
        heading: "Säilytysaika",
        paragraphs: [
          "Varausten yhteys- ja osoitetietoja säilytetään enintään 24 kuukautta varauksen täyttämisestä tai peruuttamisesta. Tietoja voidaan säilyttää pidempään vain, jos laki, viranomaisvelvoite tai oikeusvaateen laatiminen, esittäminen tai puolustaminen sitä edellyttää. Tämän jälkeen henkilötiedot poistetaan tai anonymisoidaan.",
        ],
      },
      {
        heading: "Oikeutesi",
        paragraphs: [
          "Sinulla on soveltuvan lain mukaisesti oikeus saada pääsy tietoihisi, oikaista virheellisiä tietoja, pyytää tietojen poistamista tai käsittelyn rajoittamista sekä vastustaa oikeutettuun etuun perustuvaa käsittelyä. Voit käyttää oikeuksiasi ottamalla yhteyttä yllä olevaan osoitteeseen.",
          "Voit tehdä valituksen tietosuojavaltuutetun toimistolle, jos katsot henkilötietojesi käsittelyn rikkovan tietosuojasääntelyä.",
        ],
      },
      {
        heading: "Pilotissa pois käytöstä",
        paragraphs: [
          "Versiossa 0.0.1 tietoja ei käytetä markkinointiin tai automaattiseen päätöksentekoon. Palvelu ei käsittele verkkomaksuja eikä kutsu Google Address Validation- tai Routes-palveluita. Toimituksesta sovitaan aina erikseen.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy notice",
    updated: "Updated 13 August 2026",
    back: "Back to reservations",
    switchLabel: "Suomeksi",
    switchHref: "/fi/tietosuoja",
    sections: [
      {
        heading: "Controller and contact details",
        paragraphs: ["The data controller is METSÄNILO.", "Privacy requests: tranthanhtuan1410@gmail.com"],
      },
      {
        heading: "Data we process",
        paragraphs: [
          "We process the contact and reservation data submitted in a reservation request: name, mobile number, optional email and notes, product, package, date, and pickup or delivery method. For delivery, we also process the street address, postal code, and city.",
          "We also process the public reservation reference, status, timestamps, capacity changes, and limited technical and audit data to keep the service secure and reliable.",
        ],
      },
      {
        heading: "Purposes and legal bases",
        paragraphs: [
          "We process data to receive the reservation request, reserve availability, contact the customer, and arrange pickup or delivery. This processing is necessary to take steps at the customer’s request before entering into a possible contract.",
          "Abuse prevention, consistent capacity records, event history, and service security are based on METSÄNILO’s legitimate interest in operating a secure and reliable reservation service.",
        ],
      },
      {
        heading: "Recipients and service providers",
        paragraphs: [
          "Data is available only to authorized METSÄNILO Manager users. Vercel processes data as the application hosting provider, and Turso/libSQL as the database provider. These providers process data for METSÄNILO under contracts and applicable data-protection obligations.",
          "The application’s primary compute and database are located in the EU. If a provider or its subprocessor processes data outside the European Economic Area, an applicable approved transfer mechanism is used, such as a European Commission adequacy decision or Standard Contractual Clauses.",
        ],
      },
      {
        heading: "Retention",
        paragraphs: [
          "Reservation contact and address data is retained for no more than 24 months after fulfilment or cancellation. Data may be retained longer only when required by law, an authority obligation, or the establishment, exercise, or defence of legal claims. Personal data is then deleted or anonymized.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "Subject to applicable law, you may access your data, correct inaccurate data, request deletion or restriction, and object to processing based on legitimate interests. Contact the address above to exercise these rights.",
          "You may lodge a complaint with the Office of the Data Protection Ombudsman if you believe the processing of your personal data infringes data-protection law.",
        ],
      },
      {
        heading: "Disabled in this pilot",
        paragraphs: [
          "Version 0.0.1 does not use reservation data for marketing or automated decision-making. It does not process online payments and does not call Google Address Validation or Routes. Delivery is always agreed separately.",
        ],
      },
    ],
  },
} satisfies Record<Locale, {
  title: string;
  updated: string;
  back: string;
  switchLabel: string;
  switchHref: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
}>;

export function PrivacyNotice({ locale }: { locale: Locale }) {
  const notice = content[locale];
  return (
    <main className="shell py-8">
      <article className="card mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[.2em] text-[var(--forest)]">METSÄNILO</div>
            <h1 className="mt-2 text-3xl font-bold text-[var(--forest)]">{notice.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{notice.updated}</p>
          </div>
          <Link className="btn btn-secondary" href={notice.switchHref} hrefLang={locale === "fi" ? "en" : "fi"}>
            {notice.switchLabel}
          </Link>
        </div>
        <div className="mt-8 grid gap-7">
          {notice.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold text-[var(--forest)]">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => <p className="mt-2 leading-7" key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>
        <Link className="btn mt-8 inline-flex" href={`/${locale}`}>{notice.back}</Link>
      </article>
    </main>
  );
}
