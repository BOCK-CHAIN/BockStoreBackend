const express = require("express");
const {
  register,
  login,
  updateProfileImage,
  deleteAccount,
  getHexId,
} = require("../controllers/authController");

const { authenticate } = require("../middleware/authMiddleware");
const upload = require("../utils/fileUpload");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.delete("/delete-account", authenticate, deleteAccount);
router.post("/forgot-hexid", getHexId);

router.put(
  "/profile-image",
  authenticate,
  upload.single("profile_image"),
  updateProfileImage,
);

module.exports = router;
