const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/auth");
const { checkSeekerSavedJobLimit } = require("../middleware/planLimit");
const { createSavedJobDoc } = require("../models/SavedJob");

module.exports = (savedJobCollection, jobCollection) => {
  const router = express.Router();

  router.post("/", auth, checkSeekerSavedJobLimit, async (req, res) => {
    try {
      const { jobId } = req.body;
      if (!jobId) {
        return res.status(400).json({ success: false, message: "jobId is required" });
      }

      const existing = await savedJobCollection.findOne({
        userId: req.user.id,
        jobId: String(jobId),
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Job already saved" });
      }

      const doc = createSavedJobDoc(req.user.id, String(jobId));
      const result = await savedJobCollection.insertOne(doc);

      res.status(201).json({
        success: true,
        message: "Job saved",
        data: { _id: result.insertedId, ...doc },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/my", auth, async (req, res) => {
    try {
      const saved = await savedJobCollection
        .find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .toArray();

      let enriched = saved;
      if (jobCollection && saved.length > 0) {
        const jobIds = saved
          .map((s) => {
            try {
              return new ObjectId(s.jobId);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        const jobs = await jobCollection.find({ _id: { $in: jobIds } }).toArray();
        const jobMap = {};
        jobs.forEach((j) => {
          jobMap[j._id.toString()] = j;
        });

        enriched = saved.map((s) => {
          const job = jobMap[s.jobId] || {};
          return {
            ...s,
            title: job.title,
            companyName: job.companyName,
            location: job.location,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            salaryRange: job.salaryRange,
            status: job.status,
            deadline: job.deadline,
            category: job.category,
            jobType: job.jobType,
            savedAt: s.createdAt,
          };
        });
      }

      res.json({ success: true, data: enriched });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete("/:id", auth, async (req, res) => {
    try {
      const result = await savedJobCollection.deleteOne({
        _id: new ObjectId(req.params.id),
        userId: req.user.id,
      });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: "Saved job not found" });
      }
      res.json({ success: true, message: "Removed from saved jobs" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
