const jwt = require("jsonwebtoken");
const db = require("../config/db");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed token." });
  }
  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return next();
  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

// Checks that the logged-in user owns the app (use after authenticate)
async function requireOwnership(req, res, next) {
  try {
    const appId = req.params.id;
    const result = await db.query(
      "SELECT uploaded_by FROM apps WHERE id = $1",
      [appId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "App not found." });
    }
    if (result.rows[0].uploaded_by !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only modify your own apps." });
    }
    next();
  } catch (err) {
    console.error("OWNERSHIP CHECK ERROR:", err);
    res.status(500).json({ error: "Server error." });
  }
}

module.exports = { authenticate, optionalAuth, requireOwnership };
