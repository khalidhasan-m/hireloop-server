const Stripe = require("stripe");

const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";

// A real secret key is `sk_test_...` (Test Mode) or `sk_live_...` (Live Mode).
// The template copied from .env.example ("sk_test_YOUR_TEST_SECRET_KEY_HERE")
// must be replaced with a real key before Stripe can connect.
const isPlaceholder = (key) => !key || key.includes("YOUR_") || key.includes("HERE") || key.length < 20;

let stripe = null;
if (stripeSecret && !isPlaceholder(stripeSecret)) {
  stripe = new Stripe(stripeSecret);
} else {
  const log = console.warn || console.log;
  const reason = !stripeSecret
    ? "STRIPE_SECRET_KEY is not set"
    : "STRIPE_SECRET_KEY still contains the placeholder value";
  log(`Stripe is DISABLED. ${reason}.`);
  log("  Get a real Test Mode key from https://dashboard.stripe.com/test/apikeys and set STRIPE_SECRET_KEY in .env, then restart the server.");
}

const stripeMode = !stripeSecret
  ? "unset"
  : stripeSecret.startsWith("sk_live_")
    ? "live"
    : stripeSecret.startsWith("sk_test_")
      ? "test"
      : "invalid";

module.exports = {
  stripe,
  stripeConfigured: Boolean(stripe),
  stripeMode,
  stripePublishableKey,
};
