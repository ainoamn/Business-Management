import { useEffect, useState } from 'react';
import Head from 'next/head';
import type { Locale } from '@work/shared-types';
import { Button } from '@work/ui';
import { MarketingShell } from '../components/marketing/shell';
import { marketingDictionary } from '../i18n/marketing';
import { requestApi } from '../services/api';

export default function ContactPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string>('');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(t.contactRequired);
      return;
    }

    setSending(true);
    setError('');
    setSuccess(false);

    try {
      await requestApi<{ ok: boolean }>('public/contact', { method: 'POST', body: { name: name.trim(), email: email.trim(), message: message.trim() } });
      setSuccess(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setError(t.contactError);
    } finally {
      setSending(false);
    }
  }

  return (
    <MarketingShell>
      <Head>
        <title>{t.contactTitle}</title>
        <meta name="description" content={t.contactLead} />
      </Head>

      <div className="marketing-page">
        <div className="marketing-hero">
          <h1>{t.contactTitle}</h1>
          <p className="marketing-lead">{t.contactLead}</p>
        </div>

        <div className="contact-form-wrapper">
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">{t.contactName}</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={sending} required />
            </div>

            <div className="form-group">
              <label htmlFor="email">{t.contactEmail}</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} required />
            </div>

            <div className="form-group">
              <label htmlFor="message">{t.contactMessage}</label>
              <textarea id="message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} disabled={sending} required />
            </div>

            {success && (
              <div className="form-success" role="status">
                <span>✓</span>
                <span>{t.contactSuccess}</span>
              </div>
            )}

            {error && (
              <div className="form-error" role="alert">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={sending}>
              {sending ? t.contactSending : t.contactSend}
            </Button>
          </form>
        </div>
      </div>
    </MarketingShell>
  );
}
