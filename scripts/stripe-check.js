// Quick Stripe connectivity diagnostic.
// Usage: node scripts/stripe-check.js
require("dotenv").config();
const { stripe, stripeConfigured, stripeMode } = require("../config/stripe");

console.log("Stripe configuration check");
console.log("=========================");
console.log(`STRIPE_SECRET_KEY set:     ${Boolean(process.env.STRIPE_SECRET_KEY)}`);
console.log(`Mode detected:             ${stripeMode}`);
console.log(`Stripe client initialized: ${stripeConfigured ? "YES" : "NO"}`);

if (!stripeConfigured) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const hint = !key
    ? "STRIPE_SECRET_KEY is empty."
    : key.includes("YOUR_") || key.includes("HERE")
      ? "The .env still contains the placeholder — replace it with a REAL key from https://dashboard.stripe.com/test/apikeys."
      : "The key format looks wrong (expected sk_test_... or sk_live_...).";
  console.log(`Hint: ${hint}`);
  process.exit(1);
}

console.log("\nNext steps:");
console.log("  - Client-only confirm flow: no webhook required. The frontend success page calls POST /api/payments/confirm.");
console.log("  - Webhook flow (production): run 'stripe listen --forward-to localhost:5050/api/payments/webhook' and set STRIPE_WEBHOOK_SECRET.");