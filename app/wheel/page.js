import { redirect } from 'next/navigation';
import IdeaWheel from '@/components/IdeaWheel';
import PopitoShell from '@/components/popito/PopitoShell';
import { createClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'Research and Blueprint an MVP',
  description: 'Out of ideas? Use IdeaReels to get back on track with a software concept, detailed market research, and the technical blueprint to build an MVP fast.',
};

export default async function WheelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/wheel');

  return (
    <PopitoShell noFooterCta>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">Find, research, and blueprint an MVP</h3>
            <p className="fn__desc">Out of ideas? Use IdeaReels to find a direction, pressure-test the market, and get the technical plan to build fast when the signal is there.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <IdeaWheel />
    </PopitoShell>
  );
}
