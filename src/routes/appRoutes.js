const express = require("express");
const router = express.Router();

const {
  downloadApp,
  getAllApps,
  getAppById,
  getMyApps,
  getUserActivity,
  uninstallApp,
} = require("../controllers/appController");

const { authenticate, optionalAuth } = require("../middleware/authMiddleware");

const rateLimit = require("express-rate-limit");

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Too many download attempts. Try again later." },
});
router.get("/user/activity", getUserActivity);
const ratingsRoutes = require("./ratingsRoutes");

router.get("/", getAllApps);

router.get("/my-apps", authenticate, getMyApps);

router.get("/:id/download", downloadLimiter, authenticate, downloadApp);

router.get("/:id", optionalAuth, getAppById);

router.use("/:id", ratingsRoutes);
router.delete("/:id/uninstall", authenticate, uninstallApp);

module.exports = router;
