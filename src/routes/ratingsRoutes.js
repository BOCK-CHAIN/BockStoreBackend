const express = require("express");
const router = express.Router({ mergeParams: true });

const {
  upsertRating,
  getAppRatings,
  deleteRating,
} = require("../controllers/ratingsController");

const { authenticate } = require("../middleware/authMiddleware");

router.post("/rate", authenticate, upsertRating);

router.delete("/rate", authenticate, deleteRating);

router.get("/ratings", getAppRatings);

module.exports = router;
