const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/auth");

module.exports = (companyCollection) => {
  const router = express.Router();

  // Create or Register Company Profile
  router.post("/", auth, async (req, res) => {
    try {
      const newCompany = {
        ...req.body,
        recruiterId: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await companyCollection.insertOne(newCompany);

      res.status(201).json({
        success: true,
        message: "Company registered successfully",
        data: { _id: result.insertedId, ...newCompany },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get logged-in user's company profile
  router.get("/my", auth, async (req, res) => {
    try {
      const company = await companyCollection.findOne({
        recruiterId: req.user.id,
      });

      if (!company) {
        return res
          .status(404)
          .json({ success: false, message: "Company profile not found" });
      }

      res.json({
        success: true,
        data: company,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update company profile
  router.patch("/:id", auth, async (req, res) => {
    try {
      const companyId = req.params.id;
      const updateData = { ...req.body, updatedAt: new Date() };
      delete updateData._id;

      const result = await companyCollection.findOneAndUpdate(
        { _id: new ObjectId(companyId), recruiterId: req.user.id },
        { $set: updateData },
        { returnDocument: "after" },
      );

      if (!result.value && !result) {
        return res
          .status(404)
          .json({ success: false, message: "Company not found" });
      }

      res.json({
        success: true,
        message: "Company updated successfully",
        data: result.value || result,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Public: Get single company by ID
  router.get("/:id", async (req, res) => {
    try {
      const companyId = req.params.id;
      const company = await companyCollection.findOne({
        _id: new ObjectId(companyId),
      });

      if (!company) {
        return res
          .status(404)
          .json({ success: false, message: "Company not found" });
      }

      res.json({
        success: true,
        data: company,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
