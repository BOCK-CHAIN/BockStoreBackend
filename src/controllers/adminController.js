const db = require("../config/db");

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
    } = req.body;

    console.log(req.body);

    const icon = req.files?.icon?.[0];
    const screenshots = req.files?.screenshots || [];
    const apk = req.files?.apk?.[0];
    const windows = req.files?.windows?.[0];
    const linux = req.files?.linux?.[0];

    if (!name || !icon || !package_name || !version_code) {
      return res.status(400).json({
        error: "Name, icon, package_name and version_code are required",
      });
    }

    const iconUrl = `/uploads/icons/${icon.filename}`;

    let androidUrl = null;
    let windowsUrl = null;
    let linuxUrl = null;

    if (apk) {
      androidUrl = `/uploads/apks/${apk.filename}`;
    }

    if (windows) {
      windowsUrl = `/uploads/windows/${windows.filename}`;
    }

    if (linux) {
      linuxUrl = `/uploads/linux_apps/${linux.filename}`;
    }
    const appResult = await db.query(
      `INSERT INTO apps 
   (name, description, icon_url, version, size, developer, rated_for, android_url, windows_url, linux_url, package_name, version_code, category) 
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) 
   RETURNING *`,
      [
        name,
        description,
        iconUrl,
        version,
        size,
        developer,
        rated_for,
        androidUrl,
        windowsUrl,
        linuxUrl,
        package_name,
        version_code,
        category,
      ],
    );

    const appId = appResult.rows[0].id;

    await db.query(
      `INSERT INTO app_logs (app_id, user_id, action, version)
       VALUES ($1,$2,$3,$4)`,
      [appId, req.user?.id || null, "uploaded", version],
    );

    for (let i = 0; i < screenshots.length; i++) {
      const img = screenshots[i];
      const imageUrl = `/uploads/screenshots/${img.filename}`;

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
    const apk = req.files?.apk?.[0];

    const isApkUploaded = !!apk;

    const existing = await db.query("SELECT * FROM apps WHERE id = $1", [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "App not found" });
    }

    let iconUrl = existing.rows[0].icon_url;
    if (icon) {
      iconUrl = `/uploads/icons/${icon.filename}`;
    }

    let apkUrl = existing.rows[0].apk_url;
    if (apk) {
      apkUrl = `/uploads/apks/${apk.filename}`;
    }

    let newVersionCode = existing.rows[0].version_code;
    if (isApkUploaded) {
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
           apk_url = $8,
           package_name = COALESCE($9, package_name),
           version_code = $10
       WHERE id = $11
       RETURNING *`,
      [
        name,
        description,
        iconUrl,
        version,
        size,
        developer,
        rated_for,
        apkUrl,
        package_name,
        newVersionCode,
        id,
      ],
    );

    const updatedApp = updated.rows[0];

    const actionType = isApkUploaded ? "apk_updated" : "metadata_updated";

    await db.query(
      `INSERT INTO app_logs (app_id, user_id, action, version)
       VALUES ($1,$2,$3,$4)`,
      [id, req.user?.id || null, actionType, updatedApp.version],
    );

    if (screenshots.length > 0) {
      const existingImages = await db.query(
        "SELECT COUNT(*) FROM app_images WHERE app_id = $1",
        [id],
      );

      const currentCount = parseInt(existingImages.rows[0].count);

      for (let i = 0; i < screenshots.length; i++) {
        const img = screenshots[i];
        const imageUrl = `/uploads/screenshots/${img.filename}`;

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

    const getFilePath = (fileArray) => {
      if (!fileArray || fileArray.length === 0) return null;
      return "/" + fileArray[0].path.replace(/\\/g, "/");
    };

    const androidUrl = getFilePath(req.files?.apk);
    const windowsUrl = getFilePath(req.files?.windows);
    const linuxUrl = getFilePath(req.files?.linux);

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
