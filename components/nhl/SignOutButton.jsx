export default function SignOutButton({ label = 'Sign out' }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm">{label}</button>
    </form>
  );
}
