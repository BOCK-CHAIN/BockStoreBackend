const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");

const SALT_ROUNDS = 10;

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET_NAME;

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

    return res.status(201).json({ user, token, hex_id });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already registered." });
    }
    return res.status(500).json({ error: "Internal server error." });
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

// STEP 1 — Client calls this to get a presigned URL, then uploads directly to S3.
// GET /api/auth/profile-image/presigned-url?fileType=image/jpeg
async function getProfileImagePresignedUrl(req, res) {
  const userId = req.user.id;
  const { fileType } = req.query;

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  if (!fileType || !ALLOWED_TYPES.includes(fileType)) {
    return res.status(400).json({
      error: "Invalid or missing fileType. Allowed: jpeg, png, webp.",
    });
  }

  const ext = fileType.split("/")[1];
  const key = `profiles/${userId}/${uuidv4()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: fileType,
  });

  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
    const publicUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.status(200).json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error("Presigned URL error:", err);
    return res.status(500).json({ error: "Could not generate upload URL." });
  }
}

// STEP 2 — After the client uploads to S3, it calls this to save the URL to the DB.
// PUT /api/auth/profile-image  body: { publicUrl, key }
async function updateProfileImage(req, res) {
  const userId = req.user.id;
  const { publicUrl, key } = req.body;

  if (!publicUrl || !key) {
    return res.status(400).json({ error: "publicUrl and key are required." });
  }

  const client = await pool.connect();

  try {
    // Delete old S3 object if one exists
    const { rows } = await client.query(
      "SELECT profile_image_key FROM users WHERE id = $1",
      [userId],
    );

    const oldKey = rows[0]?.profile_image_key;

    if (oldKey) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey }));
      } catch (deleteErr) {
        // Non-fatal — log and continue
        console.warn("Could not delete old profile image from S3:", deleteErr);
      }
    }

    // Save new URL and key
    await client.query(
      "UPDATE users SET profile_image = $1, profile_image_key = $2 WHERE id = $3",
      [publicUrl, key, userId],
    );

    return res.status(200).json({
      message: "Profile image updated successfully.",
      profile_image: publicUrl,
    });
  } catch (err) {
    console.error("Profile image update error:", err);
    return res.status(500).json({ error: "Internal server error." });
  } finally {
    client.release();
  }
}

// DELETE ACCOUNT
async function deleteAccount(req, res) {
  const userId = req.user.id;

  try {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getUserByName(req, res) {
  try {
    const { name } = req.params;

    const result = await pool.query(
      "SELECT name, bio FROM users WHERE name = $1",
      [name],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  register,
  login,
  getProfileImagePresignedUrl,
  updateProfileImage,
  deleteAccount,
  getUserByName,
};
