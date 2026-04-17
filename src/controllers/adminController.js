const db = require("../config/db");
const uploadToS3 = require("../utils/uploadToS3");

exports.createApp = async (req, res) => {
  try {
    const {
      name,
      description,
      version,
      size,
      developer,
      rated_for,
      package_name,
      version_code,
      category,
      bio,
    } = req.body;

    console.log(req.body);

    const icon = req.files?.icon?.[0];
    const screenshots = req.files?.screenshots || [];
    // All binaries come through the "files" field — multer only accepts this fieldname
    const uploadedFiles = req.files?.files || [];

    if (!name || !icon || !package_name || !version_code) {
      return res.status(400).json({
        error: "Name, icon, package_name and version_code are required",
      });
    }

    const iconUrl = await uploadToS3(icon, "icons");

    const appResult = await db.query(
      `INSERT INTO apps 
   (name, description, icon_url, version, size, developer, rated_for, package_name, version_code, category) 
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) 
   RETURNING *`,
      [
        name,
        description,
        iconUrl,
        version,
        size,
        developer,
        rated_for,
        package_name,
        version_code,
        category,
      ],
    );

    const appId = appResult.rows[0].id;

    // ── Developer insert/update (bio support) ──────────────────────────────
    if (developer) {
      if (bio && bio.trim().length > 0) {
        await db.query(
          `INSERT INTO developers (name, bio)
           VALUES ($1, $2)
           ON CONFLICT (name)
           DO UPDATE SET bio = EXCLUDED.bio`,
          [developer, bio.trim()],
        );
      } else {
        await db.query(
          `INSERT INTO developers (name)
           VALUES ($1)
           ON CONFLICT (name) DO NOTHING`,
          [developer],
        );
      }
    }

    // ── Insert each uploaded file into app_files ───────────────────────────
    if (uploadedFiles.length > 0) {
      const detectFileType = (filename) => {
        const ext = filename.split(".").pop().toLowerCase();
        if (ext === "apk") return "apk";
        if (ext === "exe" || ext === "msi") return "exe";
        if (ext === "sh") return "sh";
        if (ext === "deb") return "deb";
        if (ext === "rpm") return "rpm";
        if (ext === "appimage") return "appimage";
        if (ext === "dmg") return "dmg";
        if (ext === "zip") return "zip";
        return "other";
      };

      // file_labels and file_types sent as indexed fields from Flutter
      const fileLabels = req.body.file_labels || {};
      const fileTypes = req.body.file_types || {};

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const fileUrl = await uploadToS3(file, "apps");
        const type = fileTypes[i] || detectFileType(file.originalname);
        const label = fileLabels[i] || file.originalname;

        await db.query(
          `INSERT INTO app_files (app_id, url, type, label)
           VALUES ($1, $2, $3, $4)`,
          [appId, fileUrl, type, label],
        );
      }
    }

    await db.query(
      `INSERT INTO app_logs (app_id, user_id, action, version)
       VALUES ($1,$2,$3,$4)`,
      [appId, req.user?.id || null, "uploaded", version],
    );

    for (let i = 0; i < screenshots.length; i++) {
      const img = screenshots[i];
      const imageUrl = await uploadToS3(img, "screenshots");

      await db.query(
        "INSERT INTO app_images (app_id, image_url, display_order) VALUES ($1,$2,$3)",
        [appId, imageUrl, i],
      );
    }

    res.status(201).json(appResult.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({
        error: "Package name already exists",
      });
    }

    console.error("CREATE APP ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteApp = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM apps WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "App not found" });
    }

    res.json({ message: "App deleted successfully" });
  } catch (err) {
    console.error("DELETE APP ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateApp = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      version,
      size,
      developer,
      rated_for,
      package_name,
      version_code,
    } = req.body;

    const icon = req.files?.icon?.[0];
    const screenshots = req.files?.screenshots || [];
    const uploadedFiles = req.files?.files || [];

    const existing = await db.query("SELECT * FROM apps WHERE id = $1", [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "App not found" });
    }

    let iconUrl = existing.rows[0].icon_url;
    if (icon) {
      iconUrl = await uploadToS3(icon, "icons");
    }

    const hasNewFiles = uploadedFiles.length > 0;

    let newVersionCode = existing.rows[0].version_code;
    if (hasNewFiles) {
      newVersionCode = newVersionCode + 1;
    }

    const updated = await db.query(
      `UPDATE apps
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           icon_url = $3,
           version = COALESCE($4, version),
           size = COALESCE($5, size),
           developer = COALESCE($6, developer),
           rated_for = COALESCE($7, rated_for),
           package_name = COALESCE($8, package_name),
           version_code = $9
       WHERE id = $10
       RETURNING *`,
      [
        name,
        description,
        iconUrl,
        version,
        size,
        developer,
        rated_for,
        package_name,
        newVersionCode,
        id,
      ],
    );

    const updatedApp = updated.rows[0];

    const actionType = hasNewFiles ? "apk_updated" : "metadata_updated";

    await db.query(
      `INSERT INTO app_logs (app_id, user_id, action, version)
       VALUES ($1,$2,$3,$4)`,
      [id, req.user?.id || null, actionType, updatedApp.version],
    );

    // ── Insert new files into app_files ───────────────────────────────────
    if (hasNewFiles) {
      const detectFileType = (filename) => {
        const ext = filename.split(".").pop().toLowerCase();
        if (ext === "apk") return "apk";
        if (ext === "exe" || ext === "msi") return "exe";
        if (ext === "sh") return "sh";
        if (ext === "deb") return "deb";
        if (ext === "rpm") return "rpm";
        if (ext === "appimage") return "appimage";
        if (ext === "dmg") return "dmg";
        if (ext === "zip") return "zip";
        return "other";
      };

      const fileLabels = req.body.file_labels || {};
      const fileTypes = req.body.file_types || {};

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const fileUrl = await uploadToS3(file, "apps");
        const type = fileTypes[i] || detectFileType(file.originalname);
        const label = fileLabels[i] || file.originalname;

        await db.query(
          `INSERT INTO app_files (app_id, url, type, label)
           VALUES ($1, $2, $3, $4)`,
          [id, fileUrl, type, label],
        );
      }
    }

    if (screenshots.length > 0) {
      const existingImages = await db.query(
        "SELECT COUNT(*) FROM app_images WHERE app_id = $1",
        [id],
      );

      const currentCount = parseInt(existingImages.rows[0].count);

      for (let i = 0; i < screenshots.length; i++) {
        const img = screenshots[i];
        const imageUrl = await uploadToS3(img, "screenshots");

        await db.query(
          "INSERT INTO app_images (app_id, image_url, display_order) VALUES ($1,$2,$3)",
          [id, imageUrl, currentCount + i],
        );
      }
    }

    res.json(updatedApp);
  } catch (err) {
    console.error("UPDATE APP ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAppLogs = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        app_logs.id,
        app_logs.action,
        app_logs.version,
        app_logs.created_at,
        apps.name AS app_name
      FROM app_logs
      JOIN apps ON apps.id = app_logs.app_id
      ORDER BY app_logs.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET LOGS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.uploadAppFiles = async (req, res) => {
  try {
    const appId = req.params.id;

    const uploadFile = async (fileArray, folder) => {
      if (!fileArray || fileArray.length === 0) return null;
      return await uploadToS3(fileArray[0], folder);
    };

    const androidUrl = await uploadFile(req.files?.apk, "apps");
    const windowsUrl = await uploadFile(req.files?.windows, "apps");
    const linuxUrl = await uploadFile(req.files?.linux, "apps");

    let fields = [];
    let values = [];
    let index = 1;

    if (androidUrl) {
      fields.push(`android_url = $${index++}`);
      values.push(androidUrl);
    }

    if (windowsUrl) {
      fields.push(`windows_url = $${index++}`);
      values.push(windowsUrl);
    }

    if (linuxUrl) {
      fields.push(`linux_url = $${index++}`);
      values.push(linuxUrl);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    values.push(appId);

    await db.query(
      `UPDATE apps SET ${fields.join(", ")} WHERE id = $${index}`,
      values,
    );

    if (androidUrl) {
      await db.query(
        `UPDATE apps 
         SET version_code = version_code + 1 
         WHERE id = $1`,
        [appId],
      );
    }

    res.json({ message: "Files uploaded successfully" });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Upload failed" });
  }
};