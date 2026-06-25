import PopitoShell from '@/components/popito/PopitoShell';
import ContactForm from '@/components/ContactForm';

export const metadata = {
  title: 'Contact | IdeaReels',
  description: 'Get in touch with the IdeaReels team. Report a bug, share feedback, or ask a question.',
  alternates: { canonical: 'https://ideareels.io/contact' },
};

export default function ContactPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, opacity: 0.5 }}>
              Get in touch
            </p>
            <h1 className="fn__title">
              We read every message.
            </h1>
            <p className="fn__desc" style={{ maxWidth: 440 }}>
              Bug to report, idea to share, or just want to talk startup validation — send it over.
            </p>
            <span className="wings" />
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page" style={{ padding: '0 0 80px' }}>
        <div className="container">
          <div style={{ maxWidth: 620, margin: '0 auto' }}>
            <ContactForm />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20, marginTop: 28 }}>
              <div className="fn__bold_item" style={{ padding: '22px 20px' }}>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, opacity: 0.5 }}>
                  Email
                </p>
                <a
                  href="mailto:hello@ideareels.io"
                  style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, color: '#111', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  hello@ideareels.io
                </a>
              </div>
              <div className="fn__bold_item" style={{ padding: '22px 20px' }}>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, opacity: 0.5 }}>
                  Response time
                </p>
                <p style={{ margin: 0, fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15 }}>1–2 business days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PopitoShell>
  );
}
