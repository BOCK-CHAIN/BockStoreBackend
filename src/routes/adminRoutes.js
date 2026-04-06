const express = require("express");
const router = express.Router();
const upload = require("../utils/fileUpload");

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
    { name: "apk", maxCount: 1 },
    { name: "windows", maxCount: 1 },
    { name: "linux", maxCount: 1 },
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
    { name: "apk", maxCount: 1 },
    { name: "windows", maxCount: 1 },
    { name: "linux", maxCount: 1 },
  ]),
  updateApp,
);

router.put(
  "/apps/:id/upload",
  authenticate,
  authorize("admin"),
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "windows", maxCount: 1 },
    { name: "linux", maxCount: 1 },
  ]),
  uploadAppFiles,
);

router.delete("/apps/:id", authenticate, authorize("admin"), deleteApp);

router.get("/app-logs", authenticate, authorize("admin"), getAppLogs);

module.exports = router;
