const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const fs = require("fs");
const path = require("path");

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}
// REGISTER FUNCTION
async function register(req, res) {
  const { first_name, last_name, email, password, dob, gender, hex_id } =
    req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({
      error: "First name, last name, email and password are required.",
    });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "Email already registered.",
      });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await pool.query(
      `
      INSERT INTO users (first_name, last_name, email, password, dob, gender, hex_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, first_name, last_name, email, role, created_at
      `,
      [first_name, last_name, email, hashed, dob, gender, hex_id],
    );

    const user = rows[0];

    const token = signToken(user);

    return res.status(201).json({
      user,
      token,
      hex_id,
    });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Email already registered.",
      });
    }

    return res.status(500).json({
      error: "Internal server error.",
    });
  }
}
// LOGIN FUNCTION
async function login(req, res) {
  const { hex_id, password } = req.body;

  if (!hex_id || !password) {
    return res.status(400).json({ error: "hex_id and password are required." });
  }

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE hex_id = $1", [
      hex_id,
    ]);

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = signToken(user);
    const { password: _pw, ...safeUser } = user;

    return res.status(200).json({ user: safeUser, token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
async function updateProfileImage(req, res) {
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      "SELECT profile_image FROM users WHERE id = $1",
      [userId],
    );

    const oldImage = rows[0]?.profile_image;

    if (oldImage) {
      const oldPath = path.join(__dirname, "../../", oldImage);

      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const newPath = `/uploads/profiles/${req.file.filename}`;

    await client.query("UPDATE users SET profile_image = $1 WHERE id = $2", [
      newPath,
      userId,
    ]);

    return res.status(200).json({
      message: "Profile image updated successfully.",
      profile_image: newPath,
    });
  } catch (err) {
    console.error("Profile image update error:", err);
    return res.status(500).json({ error: "Internal server error." });
  } finally {
    client.release();
  }
}
//delete account function
async function deleteAccount(req, res) {
  const userId = req.user.id;

  try {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    return res.status(200).json({
      message: "Account deleted successfully",
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
//get hex id function
async function getHexId(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const { rows } = await pool.query(
      "SELECT hex_id FROM users WHERE email = $1",
      [email],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({
      hex_id: rows[0].hex_id,
    });
  } catch (err) {
    console.error("Fetch hex id error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

module.exports = {
  register,
  login,
  updateProfileImage,
  deleteAccount,
  getHexId,
};
