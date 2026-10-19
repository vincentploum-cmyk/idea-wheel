'use client';

import Sources from '@/components/picks/Sources';
import { GROUP_LABEL } from '@/lib/nba/markets';

const pretty = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', timeZone: 'UTC' });

export default function NbaSources({ date, onChange }) {
  const sport = { api: '/api/nba', query: `date=${date}`, fields: { date }, label: pretty(date), groupLabel: GROUP_LABEL, folder: '~/Desktop/NBA', nameHint: 'a date, 2026-10-21 or 20261021' };
  return <Sources sport={sport} onChange={onChange} />;
}
