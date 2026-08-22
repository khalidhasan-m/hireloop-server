const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/auth");
const { adminOnly } = require("../middleware/role");
const { COMPANY_STATUS, SEEKER_PLANS, RECRUITER_PLANS } = require("../utils/constants");
const { stripe } = require("../config/stripe");
const { createNotification } = require("../services/notification.service");

module.exports = (
  userCollection,
  companyCollection,
  jobCollection,
  paymentCollection,
  applicationCollection,
  subscriptionCollection,
  notificationCollection,
) => {
  const router = express.Router();
  router.use(auth, adminOnly);
  const userFilter = (id) => {
    const filters = [{ _id: id }];
    if (ObjectId.isValid(id)) filters.push({ _id: new ObjectId(id) });
    return { $or: filters };
  };

  router.get("/stats", async (req, res) => {
    try {
      const [users, recruiters, companies, jobs, payments, applications, pendingCompanies] =
        await Promise.all([
          userCollection.countDocuments({}),
          userCollection.countDocuments({ role: "recruiter" }),
          companyCollection.countDocuments({}),
          jobCollection.countDocuments({}),
          paymentCollection.countDocuments({}),
          applicationCollection.countDocuments({}),
          companyCollection.countDocuments({ status: COMPANY_STATUS.PENDING }),
        ]);

      res.json({
        success: true,
        data: { users, recruiters, companies, jobs, payments, applications, pendingCompanies },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/users", async (req, res) => {
    try {
      const filter = {};
      if (req.query.email) filter.email = { $regex: req.query.email, $options: "i" };
      if (["seeker", "recruiter"].includes(req.query.role)) filter.role = req.query.role;
      const users = await userCollection
        .find(filter)
        .project({ name: 1, email: 1, role: 1, plan: 1, isSuspended: 1, createdAt: 1, image: 1 })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.patch("/users/:id/role", async (req, res) => {
    try {
      const { role } = req.body;
      if (!["seeker", "recruiter"].includes(role)) {
        return res.status(400).json({ success: false, message: "Role must be seeker or recruiter" });
      }
      const result = await userCollection.updateOne(
        userFilter(req.params.id),
        { $set: { role, updatedAt: new Date() } },
      );
      if (!result.matchedCount) return res.status(404).json({ success: false, message: "User not found" });
      await createNotification(notificationCollection, { userId: req.params.id, type: "account", title: "Account role updated", body: `An administrator changed your account role to ${role}.` });
      res.json({ success: true, message: `User changed to ${role}` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.patch("/users/:id/suspend", async (req, res) => {
    try {
      const { suspended } = req.body;
      const target = await userCollection.findOne(userFilter(req.params.id));
      if (!target) return res.status(404).json({ success: false, message: "User not found" });
      if (target.role === "admin") return res.status(403).json({ success: false, message: "Admin accounts cannot be suspended here" });
      await userCollection.updateOne(
        userFilter(req.params.id),
        { $set: { isSuspended: !!suspended, updatedAt: new Date() } },
      );
      await createNotification(notificationCollection, { userId: req.params.id, type: "account", title: suspended ? "Account suspended" : "Account activated", body: suspended ? "Your HireLoop account has been suspended by an administrator." : "Your HireLoop account has been activated by an administrator." });
      res.json({ success: true, message: suspended ? "User suspended" : "User activated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete("/users/:id", async (req, res) => {
    try {
      if (String(req.user.id) === String(req.params.id)) return res.status(400).json({ success: false, message: "You cannot delete your own admin account" });
      const target = await userCollection.findOne(userFilter(req.params.id));
      if (!target) return res.status(404).json({ success: false, message: "User not found" });
      if (target.role === "admin") return res.status(403).json({ success: false, message: "Admin accounts cannot be deleted here" });
      const result = await userCollection.deleteOne(userFilter(req.params.id));
      if (!result.deletedCount) return res.status(404).json({ success: false, message: "User not found" });
      res.json({ success: true, message: "User deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.patch("/users/:id/subscription", async (req, res) => {
    try {
      const target = await userCollection.findOne(userFilter(req.params.id));
      if (!target) return res.status(404).json({ success: false, message: "User not found" });
      if (!["seeker", "recruiter"].includes(target.role)) return res.status(400).json({ success: false, message: "Only Seeker and Recruiter accounts can receive a plan" });
      if (target.isSuspended) return res.status(400).json({ success: false, message: "Activate the user before upgrading their plan" });
      const planName = String(req.body?.plan || "").toUpperCase();
      const plans = target.role === "recruiter" ? RECRUITER_PLANS : SEEKER_PLANS;
      const plan = plans[planName];
      if (!plan || !plan.price) return res.status(400).json({ success: false, message: "A valid paid plan is required" });
      const current = subscriptionCollection ? await subscriptionCollection.findOne({ userId: target._id.toString() }) : null;
      let mode = "admin_granted";
      let stripeSubscriptionId = current?.stripeSubscriptionId || null;
      if (stripe && current?.stripeSubscriptionId) {
        if (!plan.priceId) return res.status(400).json({ success: false, message: "Configure the Stripe Price ID for this plan first" });
        const updated = await stripe.subscriptions.update(current.stripeSubscriptionId, { items: [{ id: (await stripe.subscriptions.retrieve(current.stripeSubscriptionId)).items.data[0].id, price: plan.priceId }], proration_behavior: "create_prorations" });
        stripeSubscriptionId = updated.id;
        mode = "stripe_subscription_updated";
      }
      await userCollection.updateOne(userFilter(req.params.id), { $set: { plan: planName, updatedAt: new Date() } });
      if (subscriptionCollection) await subscriptionCollection.updateOne({ userId: target._id.toString() }, { $set: { userId: target._id.toString(), role: target.role, plan: planName, status: "active", adminGranted: mode === "admin_granted", stripeSubscriptionId, updatedAt: new Date() } }, { upsert: true });
      await createNotification(notificationCollection, { userId: target._id.toString(), type: "billing", title: "Subscription updated", body: `An administrator upgraded your account to the ${plan.name} plan.` });
      res.json({ success: true, message: `${target.role} upgraded to ${plan.name}`, data: { userId: target._id, plan: planName, mode, stripeSubscriptionId } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/companies", async (req, res) => {
    try {
      const companies = await companyCollection.find({}).sort({ createdAt: -1 }).toArray();
      res.json({ success: true, data: companies });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.patch("/companies/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (![COMPANY_STATUS.APPROVED, COMPANY_STATUS.REJECTED, COMPANY_STATUS.PENDING].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid company ID" });
      const result = await companyCollection.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { status, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      const company = result.value || result;
      if (!company || !company._id) return res.status(404).json({ success: false, message: "Company not found" });
      if (company.recruiterId && status !== COMPANY_STATUS.PENDING) await createNotification(notificationCollection, { userId: company.recruiterId, type: "company", title: `Company ${status.toLowerCase()}`, body: `Your company profile has been ${status.toLowerCase()} by an administrator.`, companyId: String(company._id) });
      res.json({ success: true, data: company });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/jobs", async (req, res) => {
    try {
      const jobs = await jobCollection.find({}).sort({ createdAt: -1 }).limit(200).toArray();
      res.json({ success: true, data: jobs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.patch("/jobs/:id/close", async (req, res) => {
    try {
      await jobCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "closed", updatedAt: new Date() } },
      );
      res.json({ success: true, message: "Job closed" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete("/jobs/:id", async (req, res) => {
    try {
      const result = await jobCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      if (!result.deletedCount) return res.status(404).json({ success: false, message: "Job not found" });
      await applicationCollection.deleteMany({ jobId: req.params.id });
      res.json({ success: true, message: "Job removed" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/payments", async (req, res) => {
    try {
      const payments = await paymentCollection.find({}).sort({ createdAt: -1 }).limit(200).toArray();
      const userIds = payments.map((payment) => payment.userId).filter(Boolean);
      const users = await userCollection.find({ _id: { $in: userIds } }).project({ email: 1 }).toArray();
      const emails = Object.fromEntries(users.map((user) => [user._id.toString(), user.email]));
      res.json({ success: true, data: payments.map((payment) => ({ ...payment, userEmail: emails[String(payment.userId)] || payment.userEmail || null })) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
