const express = require("express");
const auth = require("../middleware/auth");
const { roleGuard } = require("../middleware/role");

module.exports = ({ jobCollection, applicationCollection, userCollection, paymentCollection }) => {
  const router = express.Router();

  router.get("/recruiter", auth, roleGuard(["recruiter", "admin"]), async (req, res) => {
    try {
      const jobs = await jobCollection.find({ recruiterId: req.user.id }).project({ _id: 1, title: 1 }).toArray();
      const ids = jobs.map((job) => job._id.toString());
      const rows = await applicationCollection.aggregate([{ $match: { jobId: { $in: ids } } }, { $group: { _id: "$jobId", applicants: { $sum: 1 } } }]).toArray();
      const counts = Object.fromEntries(rows.map((row) => [row._id, row.applicants]));
      res.json({ success: true, data: jobs.map((job) => ({ jobId: job._id, title: job.title, applicants: counts[job._id.toString()] || 0 })) });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  });

  router.get("/admin", auth, roleGuard("admin"), async (req, res) => {
    try {
      const requestedDays = Number.parseInt(req.query.days, 10);
      const days = [7, 15, 30].includes(requestedDays) ? requestedDays : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const [categories, registrations, revenue] = await Promise.all([
        jobCollection.aggregate([{ $group: { _id: "$category", jobs: { $sum: 1 } } }, { $sort: { jobs: -1 } }]).toArray(),
        userCollection.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } }, users: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
        paymentCollection.aggregate([{ $match: { status: "succeeded", createdAt: { $gte: since } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]).toArray(),
      ]);
      res.json({ success: true, data: { days, categories, registrations, revenue: revenue[0]?.total || 0 } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  });

  return router;
};
