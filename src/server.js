const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const appRoutes = require("./routes/appRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/apps", appRoutes);
app.use("/api/admin", adminRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Bock Store API is running and ready to serve requests",
  });
});

module.exports = app;

// Local dev server
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
