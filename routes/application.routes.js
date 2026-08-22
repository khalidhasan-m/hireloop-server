const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/auth");
const { checkSeekerApplicationLimit } = require("../middleware/planLimit");
const { createApplicationDoc } = require("../models/Application");
const { APPLICATION_STATUS } = require("../utils/constants");
const { sendApplicationStatusEmail } = require("../services/email.service");
const { createNotification } = require("../services/notification.service");

module.exports = (applicationCollection, jobCollection, notificationCollection) => {
  const router = express.Router();

  router.post("/", auth, checkSeekerApplicationLimit, async (req, res) => {
    try {
      const newApplication = createApplicationDoc(req.body, {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        resumeUrl: req.user.resumeUrl,
      });
      newApplication.status = APPLICATION_STATUS.APPLIED;

      const job = await jobCollection.findOne({ _id: new ObjectId(newApplication.jobId) });
      if (!job) return res.status(404).json({ success: false, message: "Job not found" });
      const result = await applicationCollection.insertOne(newApplication);
      await jobCollection.updateOne(
        { _id: job._id },
        { $inc: { applicantsCount: 1 }, $set: { updatedAt: new Date() } },
      );
      await createNotification(notificationCollection, { userId: job.recruiterId, type: "application", title: "New job application", body: `${req.user.name || req.user.email} applied for ${job.title || "your job"}.`, applicationId: String(result.insertedId), jobId: String(job._id) });

      res.status(201).json({
        success: true,
        message: "Application submitted successfully",
        data: { _id: result.insertedId, ...newApplication },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
