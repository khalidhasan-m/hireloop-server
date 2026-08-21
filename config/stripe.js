const Stripe = require("stripe");

const stripeSecret = process.env.STRIPE_SECRET_KEY;

let stripe = null;
if (stripeSecret) {
  stripe = new Stripe(stripeSecret);
} else {
  console.warn("STRIPE_SECRET_KEY not set — Stripe features disabled");
}

module.exports = { stripe };
