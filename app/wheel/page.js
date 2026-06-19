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
            <div className="fn__author_info">
              <div className="right_part">
                <h1 className="title">Generate an Idea</h1>
                <p className="desc">Spin three reels, get a free market verdict. Unlock deep research or a full blueprint only when it earns it.</p>
              </div>
            </div>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <IdeaWheel />
    </PopitoShell>
  );
}
