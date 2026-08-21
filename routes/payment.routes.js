const express = require("express");
const auth = require("../middleware/auth");
const { stripe } = require("../config/stripe");
const { createPaymentDoc } = require("../models/Payment");
const { SEEKER_PLANS, RECRUITER_PLANS } = require("../utils/constants");

module.exports = (paymentCollection, userCollection, subscriptionCollection) => {
  const router = express.Router();

  // Stripe calls this endpoint asynchronously after checkout/subscription events.
  router.post("/webhook", async (req, res) => {
    try {
      if (!stripe) return res.status(503).json({ success: false, message: "Stripe is not configured" });
      const signature = req.headers["stripe-signature"];
      const event = signature && process.env.STRIPE_WEBHOOK_SECRET
        ? stripe.webhooks.constructEvent(req.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
        : req.body;
      const object = event.data?.object || event;
      const metadata = object.metadata || {};
      if (["checkout.session.completed", "customer.subscription.updated"].includes(event.type || "checkout.session.completed") && metadata.userId && metadata.plan) {
        await paymentCollection.updateOne({ stripeSessionId: object.id }, { $set: { status: "succeeded", updatedAt: new Date(), transactionId: object.payment_intent || object.id } });
        await userCollection.updateOne({ _id: metadata.userId }, { $set: { plan: metadata.plan.toUpperCase(), updatedAt: new Date() } });
        if (subscriptionCollection) await subscriptionCollection.updateOne({ userId: metadata.userId, role: metadata.role || "seeker" }, { $set: { userId: metadata.userId, role: metadata.role || "seeker", plan: metadata.plan.toUpperCase(), stripeCustomerId: object.customer || null, stripeSubscriptionId: object.subscription || object.id, status: "active", updatedAt: new Date() } }, { upsert: true });
      }
      res.json({ received: true });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
  });

  router.get("/my", auth, async (req, res) => {
    try {
      const payments = await paymentCollection
        .find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .toArray();
      res.json({ success: true, data: payments });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post("/create-checkout-session", auth, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({
          success: false,
          message: "Stripe is not configured. Set STRIPE_SECRET_KEY.",
        });
      }

      const { plan, role } = req.body;
      const plans = role === "recruiter" ? RECRUITER_PLANS : SEEKER_PLANS;
      const planConfig = plans[plan?.toUpperCase()];

      if (!planConfig || planConfig.price === 0) {
        return res.status(400).json({ success: false, message: "Invalid plan" });
      }

      const priceId = planConfig.priceId;
      const sessionParams = {
        mode: "subscription",
        success_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/dashboard/${role || "seeker"}/billing?success=1`,
        cancel_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/dashboard/${role || "seeker"}/billing?canceled=1`,
        client_reference_id: req.user.id,
        metadata: {
          userId: req.user.id,
          plan: plan.toUpperCase(),
          role: role || "seeker",
        },
      };

      if (priceId) {
        sessionParams.line_items = [{ price: priceId, quantity: 1 }];
      } else {
        sessionParams.line_items = [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `HireLoop ${planConfig.name}` },
              unit_amount: Math.round(planConfig.price * 100),
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      const paymentDoc = createPaymentDoc({
        userId: req.user.id,
        role: role || "seeker",
        plan: plan.toUpperCase(),
        amount: planConfig.price,
        stripeSessionId: session.id,
        status: "pending",
      });
      await paymentCollection.insertOne(paymentDoc);

      res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post("/confirm", auth, async (req, res) => {
    try {
      const { sessionId, plan } = req.body;
      if (sessionId) {
        await paymentCollection.updateOne(
          { stripeSessionId: sessionId, userId: req.user.id },
          { $set: { status: "succeeded", updatedAt: new Date() } },
        );
      }
      if (plan && userCollection) {
        await userCollection.updateOne(
          { _id: req.user.id },
          { $set: { plan: plan.toUpperCase(), updatedAt: new Date() } },
        );
      }
      res.json({ success: true, message: "Payment confirmed" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
