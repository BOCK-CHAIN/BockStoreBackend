const pool = require("../config/db");

const getRatingStats = async (client, appId) => {
  const statsQuery = `
    SELECT
      ROUND(AVG(rating)::NUMERIC, 2) AS average_rating,
      COUNT(*)::INTEGER               AS total_reviews
    FROM ratings
    WHERE app_id = $1
  `;
  const { rows } = await client.query(statsQuery, [appId]);
  return {
    average_rating: rows[0].average_rating
      ? parseFloat(rows[0].average_rating)
      : null,
    total_reviews: rows[0].total_reviews,
  };
};

const upsertRating = async (req, res) => {
  const appId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const { rating, review_text } = req.body;

  if (!Number.isInteger(appId) || appId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid app ID." });
  }

  const parsedRating = parseInt(rating, 10);
  if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({
      success: false,
      message: "Rating must be an integer between 1 and 5.",
    });
  }

  if (review_text !== undefined && typeof review_text !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "review_text must be a string." });
  }

  const client = await pool.connect();
  try {
    const appCheck = await client.query("SELECT id FROM apps WHERE id = $1", [
      appId,
    ]);
    if (appCheck.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "App not found." });
    }

    const upsertQuery = `
      INSERT INTO ratings (user_id, app_id, rating, review_text)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, app_id)
      DO UPDATE SET
        rating      = EXCLUDED.rating,
        review_text = EXCLUDED.review_text,
        updated_at  = NOW()
      RETURNING id, user_id, app_id, rating, review_text, created_at, updated_at
    `;

    const result = await client.query(upsertQuery, [
      userId,
      appId,
      parsedRating,
      review_text?.trim() || null,
    ]);

    const wasUpdate = result.rows[0].created_at < result.rows[0].updated_at;

    const stats = await getRatingStats(client, appId);

    return res.status(wasUpdate ? 200 : 201).json({
      success: true,
      message: wasUpdate
        ? "Rating updated successfully."
        : "Rating submitted successfully.",
      data: {
        ...result.rows[0],
        ...stats,
      },
    });
  } catch (err) {
    console.error("[upsertRating] Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  } finally {
    client.release();
  }
};

const getAppRatings = async (req, res) => {
  const appId = parseInt(req.params.id, 10);

  if (!Number.isInteger(appId) || appId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid app ID." });
  }

  const client = await pool.connect();
  try {
    const appCheck = await client.query(
      "SELECT id, name FROM apps WHERE id = $1",
      [appId],
    );
    if (appCheck.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "App not found." });
    }

    const stats = await getRatingStats(client, appId);

    const reviewsQuery = `
      SELECT
        r.id,
        u.id         AS user_id,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.profile_image AS user_profile_image,
        r.rating,
        r.review_text,
        r.created_at,
        r.updated_at
      FROM ratings r
      JOIN users u ON u.id = r.user_id
      WHERE r.app_id = $1
      ORDER BY r.created_at DESC
    `;
    const reviewsResult = await client.query(reviewsQuery, [appId]);

    return res.status(200).json({
      success: true,
      data: {
        app_id: appId,
        app_name: appCheck.rows[0].name,
        ...stats,
        reviews: reviewsResult.rows,
      },
    });
  } catch (err) {
    console.error("[getAppRatings] Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  } finally {
    client.release();
  }
};

const deleteRating = async (req, res) => {
  const appId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  if (!Number.isInteger(appId) || appId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid app ID." });
  }

  const client = await pool.connect();
  try {
    const deleteQuery = `
      DELETE FROM ratings
      WHERE user_id = $1 AND app_id = $2
      RETURNING id
    `;
    const result = await client.query(deleteQuery, [userId, appId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Rating not found. You may not have rated this app yet.",
      });
    }

    const stats = await getRatingStats(client, appId);

    return res.status(200).json({
      success: true,
      message: "Rating deleted successfully.",
      data: stats,
    });
  } catch (err) {
    console.error("[deleteRating] Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  } finally {
    client.release();
  }
};

module.exports = { upsertRating, getAppRatings, deleteRating };
