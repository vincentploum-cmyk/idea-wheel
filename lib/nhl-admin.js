// Who may use the NHL model. Comma-separated NHL_ADMIN_EMAILS overrides the default.
export function nhlAdminEmails() {
  return (process.env.NHL_ADMIN_EMAILS || 'vincentploum@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isNhlAdmin(user) {
  const email = (user?.email || '').toLowerCase();
  return !!email && nhlAdminEmails().includes(email);
}
