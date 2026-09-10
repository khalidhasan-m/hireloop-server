// Creates (or finds) Stripe Products + recurring monthly Prices for HireLoop plans.
// Run: node scripts/setup-stripe-prices.js
require("dotenv").config();
const { stripe } = require("../config/stripe");

const PLANS = [
  { key: "SEEKER_PRO", envName: "STRIPE_PRICE_SEEKER_PRO", name: "HireLoop Pro", amount: 1900 },
  { key: "SEEKER_PREMIUM", envName: "STRIPE_PRICE_SEEKER_PREMIUM", name: "HireLoop Premium", amount: 3900 },
  { key: "RECRUITER_GROWTH", envName: "STRIPE_PRICE_RECRUITER_GROWTH", name: "HireLoop Growth", amount: 4900 },
  { key: "RECRUITER_ENTERPRISE", envName: "STRIPE_PRICE_RECRUITER_ENTERPRISE", name: "HireLoop Enterprise", amount: 14900 },
];

(async () => {
  if (!stripe) { console.log("Stripe not configured."); process.exit(1); }

  // Find existing products/prices that already carry these names.
  const byName = new Map();
  for await (const price of stripe.prices.list({ limit: 100 })) {
    if (price.type === "recurring" && price.recurring && price.recurring.interval === "month") {
      byName.set(price.product, price);
    }
  }
  const productNames = {};
  for await (const product of stripe.products.list({ limit: 100 })) {
    productNames[product.id] = product.name;
  }

  const results = {};
  for (const plan of PLANS) {
    // Try to reuse an existing matching price (same name + amount).
    let found = null;
    for (const [productId, price] of byName) {
      if (productNames[productId] === plan.name && price.unit_amount === plan.amount) {
        found = price;
        break;
      }
    }
    if (found) {
      results[plan.envName] = found.id;
      console.log(`REUSED  ${plan.envName}=${found.id}  (${plan.name} $${(plan.amount / 100).toFixed(2)}/mo)`);
      continue;
    }
    const product = await stripe.products.create({ name: plan.name, metadata: { planKey: plan.key } });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { planKey: plan.key },
    });
    results[plan.envName] = price.id;
    console.log(`CREATED ${plan.envName}=${price.id}  (${plan.name} $${(plan.amount / 100).toFixed(2)}/mo)`);
  }

  console.log("\nAdd these to .env:\n");
  for (const [env, id] of Object.entries(results)) {
    console.log(`${env}=${id}`);
  }
})();