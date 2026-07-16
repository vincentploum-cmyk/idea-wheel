import OverviewClient from './overview-client';

export const metadata = {
  title: 'Admin overview',
  description: 'Owner-only operations dashboard.',
  robots: 'noindex,nofollow',
};

export default function AdminOverviewPage() {
  return <OverviewClient />;
}
