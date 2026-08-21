const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/auth");
const { adminOnly } = require("../middleware/role");
const { COMPANY_STATUS } = require("../utils/constants");

module.exports = (
  userCollection,
  companyCollection,
  jobCollection,
  paymentCollection,
  applicationCollection,
) => {
  const router = express.Router();
  router.use(auth, adminOnly);

  router.get("/stats", async (req, res) => {
    try {
      const [users, companies, jobs, payments, applications, pendingCompanies] =
        await Promise.all([
          userCollection.countDocuments({}),
          companyCollection.countDocuments({}),
          jobCollection.countDocuments({}),
          paymentCollection.countDocuments({}),
          applicationCollection.countDocuments({}),
          companyCollection.countDocuments({ status: COMPANY_STATUS.PENDING }),
        ]);

      res.json({
        success: true,
        data: { users, companies, jobs, payments, applications, pendingCompanies },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/users", async (req, res) => {
    try {
      const users = await userCollection
        .find({})
        .project({ name: 1, email: 1, role: 1, plan: 1, isSuspended: 1, createdAt: 1, image: 1 })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.patch("/users/:id/suspend", async (req, res) => {
    try {
      const { suspended } = req.body;
      await userCollection.updateOne(
        { _id: req.params.id },
        { $set: { isSuspended: !!suspended, updatedAt: new Date() } },
      );
      res.json({ success: true, message: suspended ? "User suspended" : "User unsuspended" });
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
      const result = await companyCollection.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { status, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      res.json({ success: true, data: result.value || result });
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

  router.get("/payments", async (req, res) => {
    try {
      const payments = await paymentCollection.find({}).sort({ createdAt: -1 }).limit(200).toArray();
      res.json({ success: true, data: payments });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
