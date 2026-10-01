import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Supabase Auth cookies: sb-<project>-auth-token (possibly chunked: .0, .1 …).
const AUTH_COOKIE = /^sb-.*-auth-token/;

export async function middleware(request) {
  // Nothing to refresh for signed-out visitors, health checks and the token-
  // authenticated workflow calls: skip the Supabase client entirely.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name))) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // Keep the session cookie fresh (required by @supabase/ssr): getSession reads
  // the cookie locally and only calls Supabase when the access token is about
  // to expire, writing the rotated tokens back through setAll. Authorisation
  // never relies on this — every page and API route verifies the user with
  // getUser() in lib/nhl-store.js.
  try { await supabase.auth.getSession(); } catch {}
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
