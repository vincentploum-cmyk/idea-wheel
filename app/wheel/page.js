import IdeaWheel from '@/components/IdeaWheel';
import PopitoShell from '@/components/popito/PopitoShell';

export const metadata = {
  title: 'Spin an Idea',
  description: 'Spin three reels to generate a startup idea and get a free market verdict.',
};

export default function WheelPage() {
  return (
    <>
      <style>{`
        .popito-fn-wrapper { background: #FFE000 !important; }
        .popito_fn_header { background: #FFE000 !important; border-bottom-color: #111 !important; }
        #popito_fn_header { background: #FFE000 !important; }
        .popito_fn_content { background: #FFE000 !important; }
        body { background: #FFE000 !important; }
      `}</style>
      <PopitoShell>
        <IdeaWheel />
      </PopitoShell>
    </>
  );
}
