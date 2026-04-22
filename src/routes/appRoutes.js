const express = require("express");
const router = express.Router();

const {
  downloadApp,
  getAllApps,
  getAppById,
  getMyApps,
  getUserActivity,
  uninstallApp,
  getDeveloper,
} = require("../controllers/appController");

const { getAppVersions } = require("../controllers/versionsController");

const { authenticate, optionalAuth } = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");
const ratingsRoutes = require("./ratingsRoutes");

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Too many download attempts. Try again later." },
});

// User activity
router.get("/user/activity", getUserActivity);

// Fetch all apps
router.get("/", getAllApps);

// Developer-specific apps
router.get("/my-apps", authenticate, getMyApps);

// Developer details
router.get("/developer", getDeveloper);

// Manage Versions (Google Drive–style feature)
router.get("/:id/versions", authenticate, getAppVersions);

// Download app with rate limiting
router.get("/:id/download", downloadLimiter, downloadApp);

// Get app details
router.get("/:id", optionalAuth, getAppById);

// Ratings routes
router.use("/:id", ratingsRoutes);

// Uninstall app
router.delete("/:id/uninstall", authenticate, uninstallApp);

module.exports = router;
