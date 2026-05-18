const express = require("express");
const {
  register,
  login,
  updateProfileImage,
  deleteAccount,
  getUserByName,
  getProfileImagePresignedUrl,
} = require("../controllers/authController");

const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.delete("/delete-account", authenticate, deleteAccount);
router.get("/user/:name", getUserByName);
router.get(
  "/profile-image/presigned-url",
  authenticate,
  getProfileImagePresignedUrl,
);

router.put("/profile-image", authenticate, updateProfileImage);

module.exports = router;
