import { redirect } from 'next/navigation';
import { getSessionUser } from './nhl-store';
import { isNhlAdmin } from './nhl-admin';

/** The signed-in admin for a sport page, or a redirect to sign in / the locked panel. */
export async function gateSport(path) {
  const user = await getSessionUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(path)}`);
  return { user, admin: isNhlAdmin(user) };
}
