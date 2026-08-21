const express = require("express");
const auth = require("../middleware/auth");

module.exports = (userCollection) => {
  const router = express.Router();

  router.get("/me", auth, async (req, res) => {
    try {
      const user = await userCollection.findOne(
        { _id: req.user._id },
        { projection: { password: 0, passwordHash: 0 } },
      );
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.patch("/me", auth, async (req, res) => {
    try {
      const allowed = ["name", "email", "image", "avatar", "resumeUrl", "skills", "headline", "bio"];
      const updates = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
      }
      if (updates.email && !/^\S+@\S+\.\S+$/.test(updates.email)) {
        return res.status(400).json({ success: false, message: "A valid email is required" });
      }
      updates.updatedAt = new Date();
      const result = await userCollection.findOneAndUpdate(
        { _id: req.user._id },
        { $set: updates },
        { returnDocument: "after", projection: { password: 0, passwordHash: 0 } },
      );
      res.json({ success: true, data: result.value || result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
