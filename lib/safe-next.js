// Validate a post-auth redirect target: internal paths only, so ?next= can
// never become an open redirect ('//evil.com' parses as protocol-relative).
export function safeNextPath(raw) {
  if (typeof raw !== 'string') return '';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '';
  return raw;
}
