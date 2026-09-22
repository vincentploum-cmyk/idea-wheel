import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = await createClient();
  try { await supabase.auth.signOut(); } catch {}
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';
  return NextResponse.redirect(`${siteUrl}/`, { status: 303 });
}
