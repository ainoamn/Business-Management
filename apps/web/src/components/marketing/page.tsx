import Head from 'next/head';
import Link from 'next/link';

interface Section {
  title: string;
  description: string;
}

interface MarketingPageProps {
  title: string;
  lead: string;
  sections?: Section[];
  cta?: { text: string; href: string };
  notice?: string;
  children?: React.ReactNode;
}

export function MarketingPage({ title, lead, sections, cta, notice, children }: MarketingPageProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={lead} />
      </Head>

      <div className="marketing-page">
        <div className="marketing-hero">
          <h1>{title}</h1>
          <p className="marketing-lead">{lead}</p>
        </div>

        {notice && (
          <div className="marketing-notice" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{notice}</span>
          </div>
        )}

        {sections && sections.length > 0 && (
          <div className="marketing-sections">
            {sections.map((section, index) => (
              <div key={index} className="marketing-section">
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>
            ))}
          </div>
        )}

        {children}

        {cta && (
          <div className="marketing-cta">
            <Link href={cta.href} className="button button-large">
              {cta.text}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
