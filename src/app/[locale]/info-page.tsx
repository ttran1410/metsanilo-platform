import Link from "next/link";
import { formatDecimal, isLocale, type Locale } from "@/lib/format";
import { LocaleDocument } from "./locale-document";
import { ReviewForm } from "./review-form";
import { MobileNav } from "./mobile-nav";

type InfoKind = "how-it-works" | "reviews" | "about";

const navCopy = {
  fi: { home: "Etusivu", how: "Miten varaus toimii", reviews: "Arvostelut", about: "Meistä", reserve: "Varaa marjat", contact: "Yhteys" },
  en: { home: "Home", how: "How it works", reviews: "Reviews", about: "About us", reserve: "Reserve products", contact: "Contact" },
} satisfies Record<Locale, Record<string, string>>;

const content = {
  fi: {
    "how-it-works": { eyebrow: "Näin se toimii", title: "Miten varaus toimii", intro: "Metsänilo yhdistää Satakunnan metsien puhtaan sadon helppoon paikalliseen toimitukseen.", ctaTitle: "Valmis nauttimaan tuoreesta sadosta?", cta: "Tee varaus nyt", steps: [["1", "Valitse marjat ja varaa", "Valitse marja, pakkauskoko ja nouto tai kotiinkuljetus."], ["2", "Saat vahvistusviestin", "Vahvistamme varauksesi WhatsAppilla, tekstiviestillä tai puhelimitse."], ["3", "Poimimme ja puhdistamme", "Oma poimijatiimimme poimii, puhdistaa ja pakkaa marjat saman päivän aikana."], ["4", "Nouda ja maksa", "Nouda sovittuna aikana tai vastaanota toimitus. Maksat vasta kun saat marjat."]] },
    reviews: { eyebrow: "Asiakasarvostelut", title: "Mitä asiakkaamme sanovat", intro: "Aito palaute auttaa meitä pitämään sadon ja palvelun hyvänä.", formTitle: "Jaa oma kokemuksesi", formText: "Otamme mielellämme palautetta vastaan. Lähetä meille viesti, niin voimme lisätä kokemuksesi seuraavaan arvostelukokoelmaan.", cta: "Varaa marjoja", reviews: [["Liisa K.", "Aivan mahtavan puhdasta ja makeaa mustikkaa! Pakastimeen meni heti 10 litraa.", "Puhdistettu metsämustikka"], ["Tero M.", "Kotiinkuljetus Porin keskustaan toimi täydellisesti ja marjat olivat ensiluokkaisia.", "Villivadelma"]] },
    about: { eyebrow: "Meidän tarinamme", title: "METSÄNILO — Satakunnan luonto & sato", quote: "METSÄNILO syntyi halusta tuoda Satakunnan metsien tuoreet marjat suoraan pöytään — saman päivän aikana poimittuina ja toimitettuina.", body: "Oma poimijatiimimme lähtee joka päivä Satakunnan metsiin. Poimimme marjat, puhdistamme ja pakkaamme ne huolellisesti ja toimitamme ne saman päivän aikana, jotta tuoreus säilyy matkalla metsästä asiakkaalle.", values: [["100 % kotimainen", "Poimimme marjat Satakunnan lähimetsistä ja toimitamme ne saman päivän aikana."], ["Valmiiksi perattu", "Marjat puhdistetaan ja tarkistetaan käsin lehtien ja roskien poistamiseksi, valmiina tuoreena tai pakkaseen."], ["Rehti ja luotettava", "Hinnat ovat selkeät ja maksat vasta noudon tai toimituksen yhteydessä."]] },
  },
  en: {
    "how-it-works": { eyebrow: "Simple steps", title: "How ordering works", intro: "METSÄNILO connects fresh forest berries with smooth local delivery in Satakunta.", ctaTitle: "Ready to enjoy fresh wild berries?", cta: "Make a reservation", steps: [["1", "Select berries & reserve", "Choose your berries, package size and pickup or local delivery."], ["2", "Get a confirmation message", "We confirm your reservation by WhatsApp, SMS or phone."], ["3", "Picked and cleaned the same day", "Our own picking team picks, cleans and packs the berries on the same day."], ["4", "Pickup and payment", "Collect your berries or receive delivery. Pay when you receive them."]] },
    reviews: { eyebrow: "Customer reviews", title: "What our customers say", intro: "Real feedback helps us keep both the harvest and service at their best.", formTitle: "Share your experience", formText: "We would love to hear from you. Send us a message and we can include your experience in our next review collection.", cta: "Reserve berries", reviews: [["Liisa K.", "Incredibly clean and sweet blueberries. Ten litres went straight into the freezer.", "Cleaned wild blueberries"], ["Tero M.", "Home delivery in central Pori worked perfectly and the berries were excellent.", "Wild raspberries"]] },
    about: { eyebrow: "Our story", title: "METSÄNILO — Satakunnan nature & harvest", quote: "METSÄNILO was born from a desire to bring fresh berries from Satakunta's forests straight to the table — picked and delivered on the very same day.", body: "Our own picking team heads into the forests of Satakunta every day. We pick, carefully clean and pack the berries, then deliver them on the same day so they stay fresh from the forest to your home.", values: [["100% Finnish harvest", "We pick from local forests in Satakunta and deliver on the same day."], ["Ready and cleaned", "Berries are cleaned and hand inspected, ready to enjoy fresh or freeze."], ["Fair and reliable", "Prices are clear and payment is made when you receive your berries."]] },
  },
} as const;

export function InfoPage({
  locale,
  kind,
  contactEmail,
  contactPhone,
  publishedReviews = [],
  reviewsVisible = true,
  howItWorksVisible = true,
  aboutUsVisible = true,
  logoUrl,
}: {
  locale: Locale;
  kind: InfoKind;
  contactEmail?: string | null;
  contactPhone?: string | null;
  publishedReviews?: Array<{ id: string; displayName: string; rating: number; originalText: string; displayText: string | null; featured: boolean }>;
  reviewsVisible?: boolean;
  howItWorksVisible?: boolean;
  aboutUsVisible?: boolean;
  logoUrl?: string | null;
}) {
  const t = content[locale][kind];
  const nav = navCopy[locale];
  const other = locale === "fi" ? "en" : "fi";
  const whatsappNumber = contactPhone?.replace(/\D/g, "").replace(/^0/, "358");
  const navLink = (href: string, label: string, active: boolean) => <Link className={active ? "nav-link-active" : ""} href={href}>{label}</Link>;

  return (
    <main className="storefront info-page">
      <LocaleDocument locale={locale} />
      <header className="storefront-header">
        <div className="shell storefront-nav">
          <Link className="brand-lockup" href={`/${locale}`}>
            {logoUrl ? (
              <img src={logoUrl} alt="Metsänilo" className="h-7 w-auto object-contain" />
            ) : (
              <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            )}
            <span><strong>METSÄNILO</strong></span>
          </Link>
          <nav className="storefront-nav-links" aria-label={locale === "fi" ? "Päävalikko" : "Main navigation"}>
            {navLink(`/${locale}`, nav.home, false)}
            {navLink(`/${locale}/reserve`, nav.reserve, false)}
            {howItWorksVisible && navLink(`/${locale}/how-it-works`, nav.how, kind === "how-it-works")}
            {reviewsVisible && navLink(`/${locale}/reviews`, nav.reviews, kind === "reviews")}
            {aboutUsVisible && navLink(`/${locale}/about`, nav.about, kind === "about")}
          </nav>
          <MobileNav
            locale={locale}
            active={kind === "how-it-works" ? "how" : kind === "reviews" ? "reviews" : "about"}
            reviewsVisible={reviewsVisible}
            howItWorksVisible={howItWorksVisible}
            aboutUsVisible={aboutUsVisible}
          />
          <Link className="locale-switch" href={`/${other}/${kind}`} hrefLang={other}>
            {locale === "fi" ? "English" : "Suomeksi"}<span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      {kind === "how-it-works" && (
        <>
          <section className="shell info-hero" aria-labelledby="info-title">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 id="info-title">{t.title}</h1>
            <p>{content[locale]["how-it-works"].intro}</p>
          </section>
          <section className="shell info-trust-banner" aria-label={locale === "fi" ? "Maksutiedot" : "Payment information"}>
            <span className="trust-badge-icon" aria-hidden="true">🛡️</span>
            <div className="trust-banner-copy">
              <strong>{locale === "fi" ? "Ei ennakkomaksua" : "No prepayment"}</strong>
              <span>{locale === "fi" ? "Maksat vasta kun saat marjat noudon tai toimituksen yhteydessä." : "You pay when you receive your berries at pickup or delivery."}</span>
            </div>
          </section>
          <section className="shell info-grid" aria-label={t.title}>
            {content[locale]["how-it-works"].steps.map(([number, title, text]) => (
              <article className="info-step-card" key={number}>
                <span className="info-number">{number}</span>
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </section>
          <section className="shell info-faq" aria-labelledby="faq-title">
            <h2 id="faq-title">{locale === "fi" ? "Usein kysyttyä" : "Common questions"}</h2>
            <details>
              <summary>
                <span>{locale === "fi" ? "Voinko maksaa käteisellä?" : "Can I pay with cash?"}</span>
                <span className="faq-icon" aria-hidden="true">↓</span>
              </summary>
              <p>{locale === "fi" ? "Maksutavasta sovitaan noudon tai toimituksen yhteydessä." : "Payment is arranged at pickup or delivery."}</p>
            </details>
            <details>
              <summary>
                <span>{locale === "fi" ? "Mitä jos sää muuttaa poimintaa?" : "What if weather changes the harvest?"}</span>
                <span className="faq-icon" aria-hidden="true">↓</span>
              </summary>
              <p>{locale === "fi" ? "Ilmoitamme mahdollisesta päivämäärän muutoksesta viestillä." : "We will message you if the fulfillment date needs to change."}</p>
            </details>
          </section>
          <InfoCta locale={locale} title={content[locale]["how-it-works"].ctaTitle} label={content[locale]["how-it-works"].cta} />
        </>
      )}
      {kind === "reviews" && (
        <>
          <section className="shell info-hero" aria-labelledby="info-title">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 id="info-title">{t.title}</h1>
            <p>{content[locale].reviews.intro}</p>
          </section>
          <section className="shell review-trust-summary" aria-label={locale === "fi" ? "Luottamustiedot" : "Trust information"}>
            <strong>
              {publishedReviews.length
                ? `${formatDecimal(publishedReviews.reduce((sum, review) => sum + review.rating, 0) / publishedReviews.length, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`
                : locale === "fi" ? "Arvosteluja tulossa" : "Reviews coming soon"}
            </strong>
            <span>
              {publishedReviews.length
                ? `${publishedReviews.length} ${locale === "fi" ? "julkaistua asiakasarvostelua" : "published customer reviews"}`
                : locale === "fi" ? "Ensimmäiset kokemukset julkaistaan tarkistuksen jälkeen." : "The first experiences will be published after moderation."}
            </span>
          </section>
          <section className="shell review-grid" aria-label={t.title}>
            {publishedReviews.length === 0 ? (
              <p className="profile-muted">{locale === "fi" ? "Arvosteluja ei ole vielä julkaistu." : "No reviews have been published yet."}</p>
            ) : (
              publishedReviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <div className="review-card-head">
                    <h2>{review.displayName}</h2>
                    <span className="review-stars" aria-label={locale === "fi" ? `${review.rating} ${review.rating === 1 ? "tähti" : "tähteä"}` : `${review.rating} ${review.rating === 1 ? "star" : "stars"}`}>
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </span>
                  </div>
                  <p className="review-quote">“{review.displayText || review.originalText}”</p>
                </article>
              ))
            )}
          </section>
          <section className="shell review-invite">
            <p className="eyebrow">{locale === "fi" ? "Palaute" : "Your voice"}</p>
            <h2>{content[locale].reviews.formTitle}</h2>
            <p>{content[locale].reviews.formText}</p>
            <ReviewForm locale={locale} />
          </section>
        </>
      )}
      {kind === "about" && (
        <>
          <section className="shell info-hero" aria-labelledby="info-title">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 id="info-title">{t.title}</h1>
          </section>
          <section className="shell story-card">
            <p className="story-quote">“{content[locale].about.quote}”</p>
            <p className="story-body">{content[locale].about.body}</p>
            <div className="value-grid">
              {content[locale].about.values.map(([title, text], index) => (
                <article className={index === 0 ? "value-card value-card-green" : "value-card value-card-gold"} key={title}>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="shell info-contact-card">
            <p className="eyebrow">{locale === "fi" ? "Tarvitsetko apua?" : "Need a hand?"}</p>
            <h2>{locale === "fi" ? "Varaa mieluummin viestillä" : "Prefer to message us?"}</h2>
            <p>{locale === "fi" ? "Voit ottaa meihin yhteyttä WhatsAppilla, tekstiviestillä tai puhelimitse." : "Contact us by WhatsApp, SMS or phone if filling in the form feels difficult."}</p>
            <div className="info-contact-actions">
              {whatsappNumber && (
                <a className="btn btn-secondary" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              )}
              {contactPhone && (
                <>
                  <a className="btn btn-secondary" href={`sms:${contactPhone}`}>
                    {locale === "fi" ? "Lähetä tekstiviesti" : "Send SMS"}
                  </a>
                  <a className="btn btn-secondary" href={`tel:${contactPhone}`}>
                    {locale === "fi" ? "Soita meille" : "Call us"}
                  </a>
                </>
              )}
              {contactEmail && (
                <a className="text-link" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
              )}
            </div>
          </section>
        </>
      )}
      <footer className="storefront-footer">
        <div className="shell">
          <div className="footer-tier-top">
            <div className="footer-brand-summary">
              <strong>METSÄNILO</strong>
              <p>{locale === "fi" ? `Satakunnan metsästä pöytään · Kausi ${new Date().getFullYear()}` : `From Satakunta forest to table · Season ${new Date().getFullYear()}`}</p>
            </div>
            <div className="footer-contact-links">
              {contactPhone && (
                <a className="footer-contact-item" href={`tel:${contactPhone}`}>
                  <span>📞</span> {contactPhone}
                </a>
              )}
              {contactEmail && (
                <a className="footer-contact-item" href={`mailto:${contactEmail}`}>
                  <span>✉️</span> {contactEmail}
                </a>
              )}
            </div>
          </div>

          <div className="footer-tier-bottom">
            <nav className="footer-inline-nav" aria-label={locale === "fi" ? "Alatunnisteen valikko" : "Footer links"}>
              <Link href={`/${locale}`}>{nav.home}</Link>
              <Link href={`/${locale}/reserve`}>{nav.reserve}</Link>
              {howItWorksVisible && <Link href={`/${locale}/how-it-works`}>{nav.how}</Link>}
              {reviewsVisible && <Link href={`/${locale}/reviews`}>{nav.reviews}</Link>}
              {aboutUsVisible && <Link href={`/${locale}/about`}>{nav.about}</Link>}
              <Link href={locale === "fi" ? "/fi/tietosuoja" : "/en/privacy"}>{locale === "fi" ? "Tietosuojaseloste" : "Privacy notice"}</Link>
            </nav>
            <span className="footer-copy-note">© {new Date().getFullYear()} METSÄNILO</span>
          </div>
        </div>
      </footer>
      <Link className="mobile-reserve-cta" href={`/${locale}/reserve`}>
        {nav.reserve}<span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}

function InfoCta({ locale, title, label }: { locale: Locale; title: string; label: string }) { return <section className="shell info-cta"><h2>{title}</h2><p>{locale === "fi" ? "Varaa marjat ennen kuin päivän satokapasiteetti täyttyy." : "Reserve your berries before daily harvest capacity is full."}</p><Link className="btn btn-accent" href={`/${locale}/reserve`}>{label}<span aria-hidden="true">→</span></Link></section>; }

export function isInfoLocale(value: string): value is Locale { return isLocale(value); }
