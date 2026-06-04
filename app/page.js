'use client';
import dynamic from 'next/dynamic';

const IdeaWheel = dynamic(() => import('@/components/IdeaWheel'), { ssr: false });

export default function Home() {
  return <IdeaWheel />;
}
