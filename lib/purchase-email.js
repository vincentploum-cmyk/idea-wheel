import { logError } from './error-log';

/**
 * Send a branded purchase-confirmation email via Resend after a successful
 * credit-pack fulfillment. Best-effort — never throws, always no-ops safely
 * when Resend isn't configured. Fulfillment must not depend on this succeeding.
 *
 * Distinguishes first-ever purchase (welcome tone) from subsequent purchases
 * (short thank-you) using the count already in stripe_orders.
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function welcomeBody(credits) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#FFE000;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:3px solid #111;box-shadow:6px 6px 0 #111;">
      <tr><td style="padding:32px 32px 8px 32px;">
        <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.2;color:#111;font-weight:900;">You're in. Welcome to IdeaReels.</h1>
        <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#111;">
          Thanks for your first pack — <strong>${credits} credit${credits === 1 ? '' : 's'}</strong> are now in your account and ready to use.
        </p>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#333;">
          Here's the shape of what's next:
        </p>
        <ul style="margin:0 0 24px 0;padding-left:22px;font-size:15px;line-height:1.7;color:#333;">
          <li>Spin the wheel — <strong>free</strong>, unlimited.</li>
          <li>Get the first market verdict — <strong>free</strong>.</li>
          <li>Run deep market research — <strong>1 credit</strong>.</li>
          <li>Unlock the full MVP blueprint (only when the signal is strong) — <strong>2 credits</strong>.</li>
        </ul>
        <p style="margin:0 0 24px 0;">
          <a href="https://ideareels.io/wheel" style="display:inline-block;background:#111;color:#FFE000;padding:14px 24px;text-decoration:none;font-weight:900;border:2px solid #111;box-shadow:3px 3px 0 #FFE000;">Spin your first idea →</a>
        </p>
        <p style="margin:0 0 6px 0;font-size:13px;line-height:1.6;color:#555;">
          Credits never expire. Reply to this email if anything looks off — a real person reads these.
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#777;">
        IdeaReels · <a href="https://ideareels.io" style="color:#777;">ideareels.io</a> · <a href="https://ideareels.io/privacy" style="color:#777;">Privacy</a> · <a href="https://ideareels.io/terms" style="color:#777;">Terms</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

function thankYouBody(credits, newBalance) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#FFE000;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:3px solid #111;box-shadow:6px 6px 0 #111;">
      <tr><td style="padding:32px 32px 8px 32px;">
        <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.2;color:#111;font-weight:900;">Credits added.</h1>
        <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#111;">
          <strong>+${credits}</strong> credit${credits === 1 ? '' : 's'} — your balance is now <strong>${newBalance}</strong>.
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="https://ideareels.io/wheel" style="display:inline-block;background:#111;color:#FFE000;padding:12px 22px;text-decoration:none;font-weight:900;border:2px solid #111;box-shadow:3px 3px 0 #FFE000;">Back to spinning →</a>
        </p>
        <p style="margin:0 0 6px 0;font-size:13px;line-height:1.6;color:#555;">
          Credits never expire. Stripe receipt lives in your inbox separately.
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#777;">
        IdeaReels · <a href="https://ideareels.io" style="color:#777;">ideareels.io</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/**
 * @param {Object} opts
 * @param {string} opts.toEmail
 * @param {number} opts.credits          - credits granted in this purchase
 * @param {number} opts.newBalance       - post-grant total balance
 * @param {boolean} opts.isFirstPurchase - true if this is the user's first
 */
export async function sendPurchaseEmail({ toEmail, credits, newBalance, isFirstPurchase }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !toEmail) return; // silent no-op

  const from = process.env.PURCHASE_EMAIL_FROM || 'IdeaReels <noreply@ideareels.io>';
  const subject = isFirstPurchase
    ? `You're in. ${credits} credit${credits === 1 ? '' : 's'} ready on IdeaReels.`
    : `+${credits} credit${credits === 1 ? '' : 's'} added — you're at ${newBalance}.`;
  const html = isFirstPurchase ? welcomeBody(credits) : thankYouBody(credits, newBalance);
  const text = isFirstPurchase
    ? `Welcome to IdeaReels. Your ${credits} credit${credits === 1 ? '' : 's'} are ready.\n\nSpin: free. First market verdict: free. Deep research: 1 credit. Blueprint: 2 credits.\n\nGo spin: https://ideareels.io/wheel\n\nCredits never expire.`
    : `+${credits} credit${credits === 1 ? '' : 's'} added. New balance: ${newBalance}.\n\nBack to spinning: https://ideareels.io/wheel`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [toEmail], subject, html, text }),
    });
    if (!res.ok) {
      await logError({
        scope: 'purchase-email',
        error: `resend ${res.status}: ${(await res.text()).slice(0, 300)}`,
        severity: 'warning',
        meta: { toEmail, credits, isFirstPurchase },
      });
    }
  } catch (err) {
    await logError({ scope: 'purchase-email', error: err, severity: 'warning', meta: { toEmail } });
  }
}
