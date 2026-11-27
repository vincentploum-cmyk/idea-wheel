import { notFound } from 'next/navigation';
import { gateSport } from '@/lib/gate';
import { isSiteOwner } from '@/lib/nhl-admin';
import { listNames } from '@/lib/nhl-store';
import { accessReport } from '@/lib/site/access';
import Locked from '@/components/nhl/Locked';
import SiteHeader from '@/components/nhl/SiteHeader';
import SportNav from '@/components/site/SportNav';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SignOutButton from '@/components/nhl/SignOutButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Access log' };

function ago(iso, now) {
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 2) return 'now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });

export default async function AccessPage() {
  const { user, admin } = await gateSport('/access');
  if (!admin) return <Locked email={user.email} />;
  if (!isSiteOwner(user)) notFound();
  const report = await accessReport(listNames);
  const now = Date.parse(report.generatedAt);

  return (
    <>
      <SiteHeader nav={<SportNav />} right={<><span className="nhlx-user">{user.email}</span><ThemeToggle /><SignOutButton /></>} />
      <main className="ir-access nhlx-wrap">
        <span className="nhlx-eyebrow">Access log</span>
        <h1>Devices signed in</h1>
        <p className="ir-access-note">
          Each row is one sign-in on one browser. An account is flagged past {report.limit} devices in a week, from more
          than one country in a week, or on two devices at once from different addresses.
        </p>
        {!report.users.length ? <p className="ir-access-note">No sign-ins recorded yet. Devices appear here as people use the site.</p> : null}
        {report.users.map((u) => (
          <section key={u.email} className="ir-access-user">
            <header className="ir-access-head">
              <h2>{u.email}</h2>
              <span className="ir-access-figs">
                <span><b>{u.activeNow}</b> now</span>
                <span><b>{u.devices7d}</b> this week</span>
                <span><b>{u.devices30d}</b> in 30 days</span>
                <span><b>{u.ips7d}</b> addresses this week</span>
              </span>
            </header>
            {u.flags.length
              ? <p className="ir-access-flag">{u.flags.join(' · ')}</p>
              : <p className="ir-access-ok">Nothing unusual</p>}
            <div className="ir-access-scroll">
              <table className="ir-access-table">
                <thead>
                  <tr><th>Device</th><th>Last seen</th><th>Signed in</th><th>Where</th><th>Addresses</th></tr>
                </thead>
                <tbody>
                  {u.sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.device}</td>
                      <td>{ago(s.lastSeen, now)}</td>
                      <td>{day(s.firstSeen)}</td>
                      <td>{(s.places || []).slice(-3).join(' · ') || '—'}</td>
                      <td className="ir-access-ips">{(s.ips || []).slice(-3).join(' · ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
