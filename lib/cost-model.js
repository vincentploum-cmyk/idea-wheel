// lib/cost-model.js
// Operating-cost math done in CODE, not by the model. The audit's flagship
// defect: the model returned Stripe as quantity 100 × unitCost 0.029 → "$2.90",
// but 0.029 is a PERCENTAGE — real Stripe is 2.9% + $0.30 per charge, so on a
// $300/mo product with 100 customers it's ~$900/mo. A blind qty×unitCost can't
// know that. So for payment processors the code owns the formula and recomputes
// from the product's own price, and it enforces hosting + database floors that
// models routinely omit. Everything is labelled an estimate with its notes.

const CARD_PERCENT = 0.029; // standard US card rate
const CARD_FIXED = 0.30;    // + $0.30 per successful charge
const HOSTING_BASELINE = 25; // Render Pro workspace floor
const DB_BASELINE = 20;      // managed Postgres floor

const PAYMENT_RE = /stripe|paypal|braintree|adyen|square|payment/i;
const HOSTING_RE = /render|vercel|fly\b|railway|heroku|aws|host/i;
const DB_RE = /postgres|database|supabase|neon|planetscale|mysql|mongo|rds|firestore/i;

export function parseMoney(value) {
  const m = String(value ?? '').match(/([\d][\d,]*\.?\d*)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Build the operating-cost model from the infra line items.
 * @param infra the infrastructure stage result (costItems, usageAssumptions)
 * @param opts.monthlyPrice the product's monthly price (from GTM) — used to price
 *   percentage-based payment fees correctly.
 */
export function computeCostModel(infra, { monthlyPrice = null } = {}) {
  const ua = infra?.usageAssumptions && typeof infra.usageAssumptions === 'object' ? infra.usageAssumptions : {};
  const customers = Number(ua.customers) || null;
  const price = Number.isFinite(Number(monthlyPrice)) ? Number(monthlyPrice) : parseMoney(monthlyPrice);
  const items = Array.isArray(infra?.costItems) ? infra.costItems : [];
  const priced = [];
  const notes = [];

  for (const it of items) {
    const service = String(it?.service || '').slice(0, 60);
    // Payment processors: recompute deterministically as % of revenue + fixed.
    if (PAYMENT_RE.test(service) && customers && Number.isFinite(price)) {
      const perCharge = price * CARD_PERCENT + CARD_FIXED;
      priced.push({
        service,
        quantity: customers,
        unit: `charges × (${(CARD_PERCENT * 100).toFixed(1)}% + $${CARD_FIXED.toFixed(2)})`,
        unitCost: round2(perCharge),
        monthlyCost: round2(customers * perCharge),
      });
      notes.push(`${service} recomputed as ${(CARD_PERCENT * 100).toFixed(1)}% + $${CARD_FIXED.toFixed(2)} per charge on $${price} × ${customers} customers (a percentage fee, not a flat per-unit cost).`);
      continue;
    }
    const quantity = Number(it?.quantity);
    const unitCost = Number(it?.unitCost);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) continue;
    priced.push({ service, quantity, unit: String(it?.unit || '').slice(0, 40), unitCost, monthlyCost: round2(quantity * unitCost) });
  }

  if (!priced.length) return null;

  // Payment processing is ALWAYS a real cost when the product charges money, and
  // it is the line models most often understate or omit. If there's no payment
  // line, add one computed from the product's own price (the audit's flagship: a
  // $300/mo product with 100 customers is ~$900/mo in Stripe fees, not $0).
  if (!priced.some((p) => PAYMENT_RE.test(p.service)) && customers && Number.isFinite(price) && price > 0) {
    const perCharge = price * CARD_PERCENT + CARD_FIXED;
    priced.push({
      service: 'Payment processing (Stripe)',
      quantity: customers,
      unit: `charges × (${(CARD_PERCENT * 100).toFixed(1)}% + $${CARD_FIXED.toFixed(2)})`,
      unitCost: round2(perCharge),
      monthlyCost: round2(customers * perCharge),
    });
    notes.push(`Added payment processing — the model omitted it. Computed as ${(CARD_PERCENT * 100).toFixed(1)}% + $${CARD_FIXED.toFixed(2)} per charge on $${price} × ${customers} customers.`);
  }

  // Enforce nonzero hosting + database floors. At real customer scale the free
  // tiers models assume ($0) don't hold, so add the line if missing OR bump a
  // $0 line up to the baseline.
  const ensureFloor = (re, label, baseline, unit) => {
    const existing = priced.find((p) => re.test(p.service));
    if (!existing) {
      priced.push({ service: label, quantity: 1, unit, unitCost: baseline, monthlyCost: baseline });
      notes.push(`Added a ${unit === 'workspace' ? 'hosting' : 'database'} baseline — the model omitted it.`);
    } else if (existing.monthlyCost < baseline) {
      existing.monthlyCost = baseline;
      existing.unitCost = baseline;
      notes.push(`${existing.service} raised to a $${baseline}/mo paid-tier baseline — a $0 free tier won't hold at ${customers || 'this'} customers.`);
    }
  };
  ensureFloor(HOSTING_RE, 'Hosting (Render Pro baseline)', HOSTING_BASELINE, 'workspace');
  ensureFloor(DB_RE, 'Database (managed Postgres baseline)', DB_BASELINE, 'instance');

  return {
    usageAssumptions: ua,
    items: priced,
    monthlyTotal: round2(priced.reduce((sum, it) => sum + it.monthlyCost, 0)),
    notes,
    isEstimate: true,
  };
}
