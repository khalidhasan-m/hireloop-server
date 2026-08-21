const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/auth"); // Assuming you have your auth middleware

module.exports = (jobCollection) => {
  const router = express.Router();

  // Create job
  router.post("/", auth, async (req, res) => {
    try {
      const newJob = {
        ...req.body,
        recruiterId: req.user.id,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await jobCollection.insertOne(newJob);

      res.status(201).json({
        success: true,
        message: "Job created successfully",
        data: { _id: result.insertedId, ...newJob },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get my jobs
  router.get("/my", auth, async (req, res) => {
    try {
      const jobs = await jobCollection
        .find({ recruiterId: req.user.id })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: jobs,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update job
  router.patch("/:id", auth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const updateData = { ...req.body, updatedAt: new Date() };
      delete updateData._id; // prevent updating immutable id

      const result = await jobCollection.findOneAndUpdate(
        { _id: new ObjectId(jobId), recruiterId: req.user.id },
        { $set: updateData },
        { returnDocument: "after" },
      );

      if (!result.value && !result) {
        return res
          .status(404)
          .json({ success: false, message: "Job not found" });
      }

      res.json({
        success: true,
        message: "Job updated successfully",
        data: result.value || result,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Delete job
  router.delete("/:id", auth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const result = await jobCollection.findOneAndDelete({
        _id: new ObjectId(jobId),
        recruiterId: req.user.id,
      });

      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Job not found" });
      }

      res.json({
        success: true,
        message: "Job deleted successfully",
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Close job
  router.patch("/:id/close", auth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const result = await jobCollection.findOneAndUpdate(
        { _id: new ObjectId(jobId), recruiterId: req.user.id },
        { $set: { status: "closed", updatedAt: new Date() } },
        { returnDocument: "after" },
      );

      res.json({
        success: true,
        message: "Job closed successfully",
        data: result.value || result,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Reopen job
  router.patch("/:id/reopen", auth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const result = await jobCollection.findOneAndUpdate(
        { _id: new ObjectId(jobId), recruiterId: req.user.id },
        { $set: { status: "active", updatedAt: new Date() } },
        { returnDocument: "after" },
      );

      res.json({
        success: true,
        message: "Job reopened successfully",
        data: result.value || result,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Public: Get all active jobs
  router.get("/", async (req, res) => {
    try {
      const jobs = await jobCollection
        .find({ status: "active" })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: jobs,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Public: Get single job
  router.get("/:id", async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await jobCollection.findOne({ _id: new ObjectId(jobId) });

      if (!job) {
        return res
          .status(404)
          .json({ success: false, message: "Job not found" });
      }

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
