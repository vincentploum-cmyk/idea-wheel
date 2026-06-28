import { redirect } from 'next/navigation';
import IdeaWheel from '@/components/IdeaWheel';
import PopitoShell from '@/components/popito/PopitoShell';
import { createClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'Spin for Startup Ideas — IdeaReels AI Concept Validator',
  description: 'Use IdeaReels to evaluate a startup concept, run AI market research, and generate a technical MVP blueprint. Research from $3.99.',
  alternates: { canonical: 'https://ideareels.io/wheel' },
  robots: { index: false, follow: false },
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
            <h3 className="fn__title">Validate the idea. Get the dev brief.</h3>
            <p className="fn__desc">Spin an idea, run the market research, and walk away with a technical MVP blueprint you can hand to a developer tonight.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <IdeaWheel />
    </PopitoShell>
  );
}
