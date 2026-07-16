import PopitoShell from '@/components/popito/PopitoShell';
import StatusClient from './status-client';

export const metadata = {
  title: 'System status',
  description: 'Live health of ideareels.io — web app, database, and recent commit.',
  alternates: { canonical: 'https://ideareels.io/status' },
};

export default function StatusPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">System status</h1>
            <p className="fn__desc">Live health of ideareels.io. Refreshes every 30 seconds.</p>
          </div>
        </div>
      </div>
      <StatusClient />
    </PopitoShell>
  );
}
