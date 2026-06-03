const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool
  .query("SELECT 1")
  .then(() => {
    console.log("DB connection OK");
  })
  .catch((err) => {
    console.error("DB connection FAILED:", err.message);
  });

module.exports = pool;
