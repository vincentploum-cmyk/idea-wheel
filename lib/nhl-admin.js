// Supabase Auth session cookies: sb-<project>-auth-token (chunked as .0, .1 … when large).
// Shared by the middleware (edge) and the store, so both agree on what "signed in" looks like.
export const AUTH_COOKIE_RE = /^sb-.*-auth-token/;

// Who may use the NHL model. Comma-separated NHL_ADMIN_EMAILS overrides the default.
export const DEFAULT_ADMIN_EMAILS = ['vincentploum@gmail.com', 'sjlever@yahoo.com', 'jbatista1129@gmail.com'];
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

// Who may read the access log (/access): the site's owner, not every admin.
// Comma-separated SITE_OWNER_EMAILS overrides the default.
export const DEFAULT_OWNER_EMAILS = ['vincentploum@gmail.com'];
export function isSiteOwner(user) {
  const email = (user?.email || '').toLowerCase();
  const owners = (process.env.SITE_OWNER_EMAILS || DEFAULT_OWNER_EMAILS.join(','))
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && owners.includes(email) && isNhlAdmin(user);
}
