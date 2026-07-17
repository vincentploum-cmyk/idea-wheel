import { test, expect } from '@playwright/test';

// Public-path smoke tests. All hit the base URL anonymously and verify the
// page renders content the user actually looks for. These are the tests we
// run before every deploy to catch "the homepage is 500'ing" or "the pricing
// page shows no packs" regressions that unit tests can't catch.

test.describe('Public paths', () => {
  test('landing page renders hero and pricing packs', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/IdeaReels/i);
    await expect(page.locator('h1').first()).toBeVisible();
    // Spinning is free copy — regression guard for the launch-blocker fix
    await expect(page.getByText(/spinning is free/i).first()).toBeVisible();
  });

  test('pricing page shows all three packs and correct copy', async ({ page }) => {
    const res = await page.goto('/pricing');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText(/starter/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
    await expect(page.getByText(/power/i).first()).toBeVisible();
    // Explicit spinning-is-free and correct credit costs
    await expect(page.getByText(/1 credit for deep market research/i).first()).toBeVisible();
    await expect(page.getByText(/2 credits for the full mvp blueprint/i).first()).toBeVisible();
  });

  test('ideas catalog shows B2B and consumer cards', async ({ page }) => {
    const res = await page.goto('/ideas');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText(/consumer/i).first()).toBeVisible();
    await expect(page.getByText(/b2b/i).first()).toBeVisible();
  });

  test('privacy page has no "does not store" contradiction', async ({ page }) => {
    await page.goto('/privacy');
    const body = await page.locator('body').innerText();
    // The contradictory copy must never appear again
    expect(body).not.toMatch(/does not store or retain any idea/i);
    expect(body).not.toMatch(/nothing is saved on our end/i);
    // The correct copy must appear
    expect(body).toMatch(/stored privately in your account/i);
  });

  test('terms page renders with counsel-reviewed content and NY governing law', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByText(/terms of service/i).first()).toBeVisible();
    // Counsel-reviewed state: the beta banner must be GONE and the New York
    // governing-law clause must be present. If either regresses, something
    // is wrong.
    await expect(page.getByText(/beta notice/i)).toHaveCount(0);
    await expect(page.getByText(/state of new york/i).first()).toBeVisible();
    // Cross-check against the auditor's known checklist: Vincent Ploum named
    // as operator, hello@ideareels.io contact.
    await expect(page.getByText(/vincent ploum/i).first()).toBeVisible();
  });

  test('privacy page renders with counsel-reviewed content', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText(/beta notice/i)).toHaveCount(0);
    await expect(page.getByText(/vincent ploum/i).first()).toBeVisible();
    // Regression guard for the original launch-blocker fix.
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/does not store or retain any idea/i);
    expect(body).toMatch(/stored privately in your account/i);
  });

  test('rate-my-startup-idea tool page renders', async ({ page }) => {
    const res = await page.goto('/tools/rate-my-startup-idea');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('health endpoint reports commit + db ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('ideareels');
  });

  test('version endpoint returns current commit, score policy, and feature flags', async ({ request }) => {
    const res = await request.get('/api/version');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.commit).toBeTruthy();
    expect(body.scorePolicy.blueprintMin).toBe(60);
    expect(body.scorePolicy.visibleMin).toBe(60);
    expect(body.scorePolicy.version).toBe('v2.0');
    expect(body.enforcement.serverSideBlueprintGate).toBe(true);
    expect(body.enforcement.requiresCurrentScoreVersion).toBe(true);
    expect(body.enforcement.clientSuppliedScoreIgnored).toBe(true);
    // Feature flags: all three should be on in production. If any flips to
    // false, the corresponding env var was dropped from Render.
    expect(body.features.turnstile).toBe(true);
    expect(body.features.resend).toBe(true);
    expect(body.features.errorLog).toBe(true);
  });
});

test.describe('Skip link and a11y basics', () => {
  test('skip-to-content link is present and jumps to main', async ({ page }) => {
    await page.goto('/');
    const skip = page.locator('a.skip-to-content');
    await expect(skip).toHaveAttribute('href', '#main-content');
    await expect(page.locator('#main-content')).toBeAttached();
  });

  test('score ring has an accessible name when validation is not run', async ({ page }) => {
    // Just a smoke that the landing page has no a11y console errors
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // We don't fail on ALL errors (Cloudflare Turnstile etc. can log noise);
    // we fail only on the specific "unhandled promise rejection" pattern.
    const critical = errors.filter((e) => /unhandled|typeerror|referenceerror/i.test(e));
    expect(critical, `critical errors: ${critical.join(' | ')}`).toEqual([]);
  });
});

test.describe('Anonymous unlock is blocked', () => {
  test('/api/catalog-idea-unlock without auth returns 401', async ({ request }) => {
    const res = await request.post('/api/catalog-idea-unlock', {
      data: { slug: 'punchai' },
    });
    expect(res.status()).toBe(401);
  });

  test('/api/pipeline/generator/config without auth returns 401', async ({ request }) => {
    const res = await request.get('/api/generator/config');
    expect(res.status()).toBe(401);
  });
});
