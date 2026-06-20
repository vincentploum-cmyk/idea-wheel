import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/profile?welcome=1';

  // Always use the canonical site URL — never trust request.url origin
  // which can be localhost on Render's internal network
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(toSet) {
            try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
            catch {}
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${siteUrl}${next}`);
  }

  return NextResponse.redirect(`${siteUrl}/profile?error=auth`);
}
