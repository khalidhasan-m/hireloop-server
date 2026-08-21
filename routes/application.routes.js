const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/auth");
const { checkSeekerApplicationLimit } = require("../middleware/planLimit");
const { createApplicationDoc } = require("../models/Application");
const { APPLICATION_STATUS } = require("../utils/constants");

module.exports = (applicationCollection) => {
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

  router.get("/my", auth, async (req, res) => {
    try {
      const applications = await applicationCollection
        .find({ candidateId: req.user.id })
        .sort({ createdAt: -1 })
        .toArray();
      res.json({ success: true, data: applications });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/job/:jobId", auth, async (req, res) => {
    try {
      const applications = await applicationCollection
        .find({ jobId: req.params.jobId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json({ success: true, data: applications });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.patch("/:id/status", auth, async (req, res) => {
    try {
      const { status } = req.body;
      const valid = Object.values(APPLICATION_STATUS);
      if (!valid.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${valid.join(", ")}`,
        });
      }

      const result = await applicationCollection.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { status, updatedAt: new Date() } },
        { returnDocument: "after" },
      );

      const updated = result.value || result;
      if (!updated || !updated._id) {
        return res.status(404).json({ success: false, message: "Application not found" });
      }

      res.json({
        success: true,
        message: "Application status updated successfully",
        data: updated,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
