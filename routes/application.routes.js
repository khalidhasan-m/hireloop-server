const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/auth");

module.exports = (applicationCollection) => {
  const router = express.Router();

  // Submit a job application (Candidate)
  router.post("/", auth, async (req, res) => {
    try {
      const newApplication = {
        ...req.body,
        candidateId: req.user.id,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await applicationCollection.insertOne(newApplication);

      res.status(201).json({
        success: true,
        message: "Application submitted successfully",
        data: { _id: result.insertedId, ...newApplication },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get candidate's applications
  router.get("/my", auth, async (req, res) => {
    try {
      const applications = await applicationCollection
        .find({ candidateId: req.user.id })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get applications for a specific job (Recruiter view)
  router.get("/job/:jobId", auth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const applications = await applicationCollection
        .find({ jobId })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update application status (Recruiter action)
  router.patch("/:id/status", auth, async (req, res) => {
    try {
      const appId = req.params.id;
      const { status } = req.body;

      const result = await applicationCollection.findOneAndUpdate(
        { _id: new ObjectId(appId) },
        { $set: { status, updatedAt: new Date() } },
        { returnDocument: "after" },
      );

      if (!result.value && !result) {
        return res
          .status(404)
          .json({ success: false, message: "Application not found" });
      }

      res.json({
        success: true,
        message: "Application status updated successfully",
        data: result.value || result,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
