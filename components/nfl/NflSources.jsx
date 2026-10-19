'use client';

import Sources from '@/components/picks/Sources';
import { GROUP_LABEL } from '@/lib/nfl/markets';

export default function NflSources({ wk, onChange }) {
  const sport = {
    api: '/api/nfl', query: `season=${wk.season}&week=${wk.week}&type=${wk.type}`, fields: { season: wk.season, week: wk.week, type: wk.type },
    label: wk.type === 3 ? 'this playoff week' : `week ${wk.week}`, groupLabel: GROUP_LABEL, folder: '~/Desktop/NFL', nameHint: 'wk7, week-7, a date',
  };
  return <Sources sport={sport} onChange={onChange} />;
}
