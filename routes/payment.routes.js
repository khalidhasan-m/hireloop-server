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
      if (!process.env.STRIPE_WEBHOOK_SECRET || !signature || !req.rawBody) {
        return res.status(503).json({ success: false, message: "Stripe webhook verification is not configured" });
      }
      const event = stripe.webhooks.constructEvent(req.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
      const object = event.data?.object || event;
      const metadata = object.metadata || {};
      if (event.type === "checkout.session.completed" && metadata.userId && metadata.plan) {
        await paymentCollection.updateOne({ stripeSessionId: object.id, userId: metadata.userId }, { $set: { status: "succeeded", updatedAt: new Date(), transactionId: object.payment_intent || object.id } });
        await userCollection.updateOne({ _id: metadata.userId }, { $set: { plan: metadata.plan.toUpperCase(), updatedAt: new Date() } });
        if (subscriptionCollection) await subscriptionCollection.updateOne({ userId: metadata.userId }, { $set: { userId: metadata.userId, role: metadata.role || "seeker", plan: metadata.plan.toUpperCase(), stripeCustomerId: object.customer || null, stripeSubscriptionId: object.subscription || null, status: "active", cancelAtPeriodEnd: false, updatedAt: new Date() } }, { upsert: true });
      }
      if (["customer.subscription.updated", "customer.subscription.deleted"].includes(event.type) && subscriptionCollection) {
        const current = await subscriptionCollection.findOne({ $or: [{ stripeSubscriptionId: object.id }, { stripeCustomerId: object.customer }, { userId: metadata.userId }] });
        if (current) {
          const nextStatus = event.type === "customer.subscription.deleted" ? "canceled" : object.status;
          await subscriptionCollection.updateOne({ _id: current._id }, { $set: { status: nextStatus, cancelAtPeriodEnd: Boolean(object.cancel_at_period_end), currentPeriodEnd: object.current_period_end ? new Date(object.current_period_end * 1000) : current.currentPeriodEnd, updatedAt: new Date() } });
          if (event.type === "customer.subscription.deleted") await userCollection.updateOne({ _id: current.userId }, { $set: { plan: "FREE", updatedAt: new Date() } });
        }
      }
      if (["invoice.payment_succeeded", "invoice.payment_failed"].includes(event.type) && subscriptionCollection) {
        const current = await subscriptionCollection.findOne({ $or: [{ stripeSubscriptionId: object.subscription }, { stripeCustomerId: object.customer }] });
        if (current) {
          const succeeded = event.type === "invoice.payment_succeeded";
          await paymentCollection.updateOne({ stripePaymentIntentId: object.payment_intent || object.id }, { $setOnInsert: createPaymentDoc({ userId: current.userId, role: current.role, plan: current.plan, amount: Number(object.amount_paid || object.amount_due || 0) / 100, stripePaymentIntentId: object.payment_intent || object.id, transactionId: object.id, status: succeeded ? "succeeded" : "failed" }) });
          await subscriptionCollection.updateOne({ _id: current._id }, { $set: { status: succeeded ? "active" : "past_due", updatedAt: new Date() } });
        }
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

  router.get("/subscription", auth, async (req, res) => {
    const subscription = await subscriptionCollection?.findOne({ userId: req.user.id });
    res.json({ success: true, data: subscription || { plan: req.user.plan || "FREE", status: "inactive" } });
  });

  router.post("/change-plan", auth, async (req, res) => {
    try {
      if (!stripe || !subscriptionCollection) return res.status(503).json({ success: false, message: "Stripe subscriptions are not configured" });
      const planName = String(req.body?.plan || "").toUpperCase();
      const plans = req.user.role === "recruiter" ? RECRUITER_PLANS : SEEKER_PLANS;
      const nextPlan = plans[planName];
      if (!nextPlan || !nextPlan.price) return res.status(400).json({ success: false, message: "A paid plan is required" });
      const current = await subscriptionCollection.findOne({ userId: req.user.id });
      if (!current?.stripeSubscriptionId) return res.status(400).json({ success: false, message: "No active Stripe subscription found" });
      const subscription = await stripe.subscriptions.retrieve(current.stripeSubscriptionId);
      const priceId = nextPlan.priceId;
      if (!priceId) return res.status(400).json({ success: false, message: "Configure a Stripe Price ID before changing plans" });
      const updated = await stripe.subscriptions.update(current.stripeSubscriptionId, { items: [{ id: subscription.items.data[0].id, price: priceId }], proration_behavior: "create_prorations" });
      await subscriptionCollection.updateOne({ userId: req.user.id }, { $set: { plan: planName, status: updated.status, updatedAt: new Date() } });
      await userCollection.updateOne({ _id: req.user.id }, { $set: { plan: planName, updatedAt: new Date() } });
      res.json({ success: true, data: { plan: planName, status: updated.status } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  });

  router.post("/cancel", auth, async (req, res) => {
    try {
      if (!stripe || !subscriptionCollection) return res.status(503).json({ success: false, message: "Stripe subscriptions are not configured" });
      const current = await subscriptionCollection.findOne({ userId: req.user.id });
      if (!current?.stripeSubscriptionId) return res.status(400).json({ success: false, message: "No active subscription found" });
      const updated = await stripe.subscriptions.update(current.stripeSubscriptionId, { cancel_at_period_end: true });
      await subscriptionCollection.updateOne({ userId: req.user.id }, { $set: { cancelAtPeriodEnd: true, currentPeriodEnd: new Date(updated.current_period_end * 1000), updatedAt: new Date() } });
      res.json({ success: true, message: "Subscription will cancel at the end of the billing period" });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
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
