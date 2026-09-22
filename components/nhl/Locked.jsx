import SiteHeader from './SiteHeader';
import SignOutButton from './SignOutButton';

export default function Locked({ email }) {
  return (
    <>
      <SiteHeader right={<SignOutButton />} />
      <main className="nhlx-center nhlx-glow">
        <div className="nhlx-panel">
          <span className="nhlx-eyebrow">Private model</span>
          <h1 style={{ marginTop: 14 }}>Access restricted</h1>
          <p>
            You&apos;re signed in as <b style={{ color: '#fff' }}>{email}</b>, which isn&apos;t on the access list for
            this model.
          </p>
          <div style={{ marginTop: 26 }}><SignOutButton label="Sign in with another account" /></div>
        </div>
      </main>
    </>
  );
}
