const { ObjectId } = require("mongodb");
const express = require("express");
const auth = require("../middleware/auth");
const { stripe } = require("../config/stripe");
const { createPaymentDoc } = require("../models/Payment");
const { SEEKER_PLANS, RECRUITER_PLANS } = require("../utils/constants");
const { createNotification } = require("../services/notification.service");

module.exports = (paymentCollection, userCollection, subscriptionCollection, notificationCollection) => {
  const router = express.Router();

  // Stripe calls this endpoint asynchronously after payment/subscription events.
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
      
      if (event.type === "payment_intent.succeeded" && metadata.userId && metadata.plan) {
        await paymentCollection.updateOne({ stripePaymentIntentId: object.id, userId: metadata.userId }, { $set: { status: "succeeded", updatedAt: new Date(), transactionId: object.id } });
        await userCollection.updateOne({ _id: metadata.userId }, { $set: { plan: metadata.plan.toUpperCase(), updatedAt: new Date() } });
        if (subscriptionCollection) await subscriptionCollection.updateOne({ userId: metadata.userId }, { $set: { userId: metadata.userId, role: metadata.role || "seeker", plan: metadata.plan.toUpperCase(), stripeCustomerId: object.customer || null, stripeSubscriptionId: object.subscription || null, status: "active", cancelAtPeriodEnd: false, updatedAt: new Date() } }, { upsert: true });
        await createNotification(notificationCollection, { userId: metadata.userId, type: "billing", title: "Payment successful", body: `Your ${metadata.plan.toUpperCase()} subscription is now active.` });
      }

      if (["customer.subscription.updated", "customer.subscription.deleted"].includes(event.type) && subscriptionCollection) {
        const current = await subscriptionCollection.findOne({ $or: [{ stripeSubscriptionId: object.id }, { stripeCustomerId: object.customer }, { userId: metadata.userId }] });
        if (current) {
          const nextStatus = event.type === "customer.subscription.deleted" ? "canceled" : object.status;
          await subscriptionCollection.updateOne({ _id: current._id }, { $set: { status: nextStatus, cancelAtPeriodEnd: Boolean(object.cancel_at_period_end), currentPeriodEnd: object.current_period_end ? new Date(object.current_period_end * 1000) : current.currentPeriodEnd, updatedAt: new Date() } });
          if (event.type === "customer.subscription.deleted") {
            await userCollection.updateOne({ _id: current.userId }, { $set: { plan: "FREE", updatedAt: new Date() } });
            await createNotification(notificationCollection, { userId: current.userId, type: "billing", title: "Subscription cancelled", body: "Your subscription has been cancelled and your account has returned to the Free plan." });
          } else {
            await createNotification(notificationCollection, { userId: current.userId, type: "billing", title: "Subscription updated", body: `Your subscription status is now ${nextStatus}.` });
          }
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

  // Replaced checkout session with a PaymentIntent to support custom Stripe Elements & assistant panel
  router.get("/my", auth, async (req, res) => {
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
      const { sessionId, plan: bodyPlan } = req.body || {};
      let plan = String(bodyPlan || "").toUpperCase();
      let role = req.user.role || "seeker";
      let amount = 0;
      let found = null;

      if (sessionId) {
        found = await paymentCollection.findOne({ 
          $or: [{ stripeSessionId: sessionId }, { stripePaymentIntentId: sessionId }], 
          userId: req.user.id 
        });
        if (found) {
          if (found.plan) plan = String(found.plan).toUpperCase();
          if (found.role) role = found.role;
          amount = Number(found.amount || 0);
        }
      }

      if (!plan || plan === "FREE" || plan === "NULL" || plan === "UNDEFINED") {
        return res.status(400).json({ success: false, message: "A paid plan is required" });
      }

      const now = new Date();
      const transactionId = found?.transactionId || sessionId || `manual_${Date.now()}`;

      if (found) {
        await paymentCollection.updateOne(
          { _id: found._id },
          { $set: { status: "succeeded", transactionId, updatedAt: now } },
        );
      } else {
        await paymentCollection.insertOne(
          createPaymentDoc({
            userId: req.user.id,
            role,
            plan,
            amount,
            stripePaymentIntentId: sessionId || null,
            transactionId,
            status: "succeeded",
          }),
        );
      }

      let userId = req.user.id;
      try {
        if (ObjectId.isValid(userId)) userId = new ObjectId(userId);
      } catch (e) {}
      if (userCollection) {
        await userCollection.updateOne({ _id: userId }, { $set: { plan, updatedAt: now } });
      }

      if (subscriptionCollection) {
        await subscriptionCollection.updateOne(
          { userId: req.user.id },
          {
            $set: {
              userId: req.user.id,
              role,
              plan,
              status: "active",
              cancelAtPeriodEnd: false,
              updatedAt: now,
            },
          },
          { upsert: true },
        );
      }

      await createNotification(notificationCollection, {
        userId: req.user.id,
        type: "billing",
        title: "Payment successful",
        body: `Your ${plan} subscription is now active.`,
      });

      res.json({ success: true, message: "Payment confirmed", data: { plan, role } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post("/create-payment-intent", auth, async (req, res) => {
    try {
      if (!stripe) return res.status(503).json({ success: false, message: "Stripe is not configured" });
      const { plan: bodyPlan, role: bodyRole } = req.body || {};
      let plan = String(bodyPlan || "").toUpperCase();
      let role = String(bodyRole || (req.user.role || "seeker")).toLowerCase();
      let amount = 0;

      const allPlans = { ...SEEKER_PLANS, ...RECRUITER_PLANS };
      const p = allPlans[plan];
      if (p && typeof p.price === "number") {
        amount = Math.round(p.price * 100); // Stripe amount in cents
      } else if (bodyPlan && !(plan in allPlans)) {
        return res.status(400).json({ success: false, message: `Unknown plan: ${bodyPlan}` });
      }

      const now = new Date();
      const transactionId = `pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId: req.user.id,
          plan,
          role,
          transactionId,
          source: "hireloop_create_payment_intent",
        },
        description: `HireLoop ${plan} subscription (${role})`,
      });

      await paymentCollection.insertOne(
        createPaymentDoc({
          userId: req.user.id,
          role,
          plan: plan || "FREE",
          amount,
          stripePaymentIntentId: paymentIntent.id,
          transactionId,
          status: amount > 0 ? "pending" : "succeeded",
        })
      );

      res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        currency: paymentIntent.currency,
        plan,
        role,
      });
    } catch (error) {
      console.error("create-payment-intent error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};