import IdeaWheel from '@/components/IdeaWheel';
import PopitoShell from '@/components/popito/PopitoShell';

export const metadata = {
  title: 'Spin an Idea',
  description: 'Spin three reels to generate a startup idea and get a free market verdict.',
};

export default function WheelPage() {
  return (
    <PopitoShell yellowBg>
      <IdeaWheel />
    </PopitoShell>
  );
}
