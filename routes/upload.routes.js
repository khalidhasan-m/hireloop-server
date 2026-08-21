const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { auth } = require("../middleware/auth");

const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => { const ext = path.extname(file.originalname).toLowerCase(); cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`); } });
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]; cb(null, allowed.includes(file.mimetype)); } });

module.exports = ({ userCollection, companyCollection }) => {
  const router = express.Router();
  router.post("/resume", auth, upload.single("file"), async (req, res) => { if (!req.file) return res.status(400).json({ success: false, message: "A PDF resume is required" }); if (req.file.mimetype !== "application/pdf") return res.status(400).json({ success: false, message: "Resume must be a PDF" }); const resumeUrl = `${process.env.CLIENT_URL || "http://localhost:5050"}/uploads/${req.file.filename}`; await userCollection.updateOne({ _id: req.user.id }, { $set: { resumeUrl, updatedAt: new Date() } }); res.json({ success: true, data: { url: resumeUrl, name: req.file.originalname, size: req.file.size } }); });
  router.post("/avatar", auth, upload.single("file"), async (req, res) => { if (!req.file || req.file.mimetype === "application/pdf") return res.status(400).json({ success: false, message: "An image is required" }); const image = `${process.env.CLIENT_URL || "http://localhost:5050"}/uploads/${req.file.filename}`; await userCollection.updateOne({ _id: req.user.id }, { $set: { image, updatedAt: new Date() } }); res.json({ success: true, data: { url: image } }); });
  router.post("/company-logo/:companyId", auth, upload.single("file"), async (req, res) => { if (!req.file || req.file.mimetype === "application/pdf") return res.status(400).json({ success: false, message: "An image is required" }); const logoUrl = `${process.env.CLIENT_URL || "http://localhost:5050"}/uploads/${req.file.filename}`; const result = await companyCollection.updateOne({ _id: req.params.companyId, recruiterId: req.user.id }, { $set: { logo: logoUrl, updatedAt: new Date() } }); if (!result.matchedCount) return res.status(404).json({ success: false, message: "Company not found or not owned by you" }); res.json({ success: true, data: { url: logoUrl } }); });
  return router;
};
