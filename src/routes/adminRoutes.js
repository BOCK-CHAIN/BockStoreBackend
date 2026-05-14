const express = require("express");
const router = express.Router();
const upload = require("../utils/fileUpload");
const { getUploadUrl } = require("../controllers/presignedController");

const {
  createApp,
  deleteApp,
  updateApp,
  getAppLogs,
  uploadAppFiles,
} = require("../controllers/adminController");

const {
  authenticate,
  requireOwnership,
} = require("../middleware/authMiddleware");

// Any logged-in user can upload a new app
router.post(
  "/apps",
  authenticate,
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "screenshots", maxCount: 5 },
    { name: "files", maxCount: 10 },
  ]),
  createApp,
);

// Only the app's owner can update it
router.put(
  "/apps/:id",
  authenticate,
  requireOwnership,
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "screenshots", maxCount: 5 },
    { name: "files", maxCount: 10 },
  ]),
  updateApp,
);

// Only the app's owner can upload new files to it
router.put(
  "/apps/:id/upload",
  authenticate,
  requireOwnership,
  upload.fields([{ name: "files", maxCount: 10 }]),
  uploadAppFiles,
);

// Only the app's owner can delete it
router.delete("/apps/:id", authenticate, requireOwnership, deleteApp);

// Each user sees logs only for their own apps
router.get("/app-logs", authenticate, getAppLogs);

// Any logged-in user can get a presigned URL to upload to S3
router.post("/presigned-url", authenticate, getUploadUrl);

module.exports = router;
