// Supabase Auth session cookies: sb-<project>-auth-token (chunked as .0, .1 … when large).
// Shared by the middleware (edge) and the store, so both agree on what "signed in" looks like.
export const AUTH_COOKIE_RE = /^sb-.*-auth-token/;

// Who may use the NHL model. Comma-separated NHL_ADMIN_EMAILS overrides the default.
export const DEFAULT_ADMIN_EMAILS = ['vincentploum@gmail.com', 'sjlever@yahoo.com'];
export function nhlAdminEmails() {
  return (process.env.NHL_ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS.join(','))
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isNhlAdmin(user) {
  const email = (user?.email || '').toLowerCase();
  return !!email && nhlAdminEmails().includes(email);
}
