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

const { authenticate, authorize } = require("../middleware/authMiddleware");

router.post(
  "/apps",
  authenticate,
  authorize("admin"),
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "screenshots", maxCount: 5 },
    { name: "files", maxCount: 10 },
  ]),
  createApp,
);

router.put(
  "/apps/:id",
  authenticate,
  authorize("admin"),
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "screenshots", maxCount: 5 },
    { name: "files", maxCount: 10 },
  ]),
  updateApp,
);

router.put(
  "/apps/:id/upload",
  authenticate,
  authorize("admin"),
  upload.fields([{ name: "files", maxCount: 10 }]),
  uploadAppFiles,
);

router.delete("/apps/:id", authenticate, authorize("admin"), deleteApp);

router.get("/app-logs", authenticate, authorize("admin"), getAppLogs);

router.post("/presigned-url", authenticate, authorize("admin"), getUploadUrl);

module.exports = router;
