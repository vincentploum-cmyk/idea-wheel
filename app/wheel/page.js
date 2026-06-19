import { redirect } from 'next/navigation';
import IdeaWheel from '@/components/IdeaWheel';
import PopitoShell from '@/components/popito/PopitoShell';
import { createClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'Generate an Idea',
  description: 'Spin three reels to generate a startup idea and get a free market verdict.',
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
            <h3 className="fn__title">Generate an Idea</h3>
            <p className="fn__desc">Spin three reels, get a free market verdict. Unlock deep research or a full blueprint only when it earns it.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <IdeaWheel />
    </PopitoShell>
  );
}
