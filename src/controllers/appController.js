const db = require("../config/db");
const path = require("path");

function detectFileType(url = "") {
  const ext = path.extname(url).toLowerCase().replace(".", "");
  const typeMap = {
    apk: "apk",
    exe: "exe",
    sh: "sh",
    zip: "zip",
    dmg: "dmg",
    deb: "deb",
    rpm: "rpm",
  };
  return typeMap[ext] || "other";
}

/**
 * File types that represent a platform-native installer and should be
 * tracked as an "installation" in user_apps.
 *
 * zip / other are intentionally excluded because they are generic archives
 * that do not map cleanly to an installed application.
 */
const INSTALLABLE_TYPES = new Set(["apk", "exe", "sh", "deb", "rpm", "dmg"]);

/**
 * Builds the files array and marks older versions of each file type as `is_old: true`.
 * The most recently uploaded file per type (determined by `id` desc, or `created_at`
 * if available) is considered current. All others of the same type are marked old.
 * Files are sorted so the latest per type comes first, followed by old versions.
 */
function buildFilesArray(appRow, appFileRows = []) {
  const files = [];

  for (const f of appFileRows) {
    files.push({
      id: f.id,
      url: f.url,
      type: f.type || detectFileType(f.url),
      label: f.label || f.url,
      // Use created_at if present, otherwise fall back to id for ordering
      _sortKey: f.created_at ? new Date(f.created_at).getTime() : f.id,
    });
  }

  // Backward-compat: fold legacy columns in only when no app_files rows exist
  if (files.length === 0) {
    const legacy = [
      { url: appRow.android_url, label: "Android APK" },
      { url: appRow.apk_url, label: "Android APK (legacy)" },
      { url: appRow.windows_url, label: "Windows Installer" },
      { url: appRow.linux_url, label: "Linux Package" },
    ];
    for (const { url, label } of legacy) {
      if (url) {
        files.push({
          id: null,
          url,
          type: detectFileType(url),
          label,
          _sortKey: 0,
        });
      }
    }
    // Legacy files have no versioning concept — none are marked old
    return files.map(({ _sortKey, ...f }) => ({ ...f, is_old: false }));
  }

  // Find the latest _sortKey per type — that file is "current"
  const latestKeyByType = {};
  for (const f of files) {
    if (
      latestKeyByType[f.type] === undefined ||
      f._sortKey > latestKeyByType[f.type]
    ) {
      latestKeyByType[f.type] = f._sortKey;
    }
  }

  // Annotate each file and sort: latest per type first, then old versions
  const annotated = files.map((f) => ({
    id: f.id,
    url: f.url,
    type: f.type,
    label: f.label,
    is_old: f._sortKey < latestKeyByType[f.type],
    _sortKey: f._sortKey,
  }));

  // Sort: current files (is_old=false) before old, then by sortKey desc within each group
  annotated.sort((a, b) => {
    if (a.is_old !== b.is_old) return a.is_old ? 1 : -1;
    return b._sortKey - a._sortKey;
  });

  return annotated.map(({ _sortKey, ...f }) => f);
}

exports.getAllApps = async (req, res) => {
  try {
    const { search } = req.query;
    const userId = req.user?.id || null;

    let query = `
      SELECT
        a.*,
        user_apps.installed_version_code,
        ROUND(AVG(r.rating)::NUMERIC, 2) AS average_rating,
        COUNT(r.id)::INTEGER             AS total_reviews
      FROM apps a
      LEFT JOIN ratings   r        ON r.app_id       = a.id
      LEFT JOIN user_apps          ON user_apps.app_id = a.id
                                   AND user_apps.user_id = $1
    `;
    const values = [userId];

    if (search) {
      query += ` WHERE a.name ILIKE $2 OR a.developer ILIKE $2`;
      values.push(`%${search}%`);
    }

    query += `
      GROUP BY a.id, user_apps.installed_version_code
      ORDER BY a.id DESC
    `;

    const appsResult = await db.query(query, values);

    const appIds = appsResult.rows.map((r) => r.id);
    let filesByAppId = {};
    if (appIds.length > 0) {
      const filesResult = await db.query(
        `SELECT * FROM app_files WHERE app_id = ANY($1::int[]) ORDER BY id`,
        [appIds],
      );
      for (const row of filesResult.rows) {
        (filesByAppId[row.app_id] ??= []).push(row);
      }
    }

    const apps = appsResult.rows.map((app) => ({
      ...app,
      average_rating: app.average_rating
        ? parseFloat(app.average_rating)
        : null,
      total_reviews: app.total_reviews || 0,
      files: buildFilesArray(app, filesByAppId[app.id] || []),
      android_url: undefined,
      apk_url: undefined,
      windows_url: undefined,
      linux_url: undefined,
    }));

    res.json(apps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAppById = async (req, res) => {
  try {
    const { id } = req.params;

    const appResult = await db.query(
      `
      SELECT
        a.*,
        ROUND(AVG(r.rating)::NUMERIC, 2) AS average_rating,
        COUNT(r.id)::INTEGER             AS total_reviews
      FROM apps a
      LEFT JOIN ratings r ON r.app_id = a.id
      WHERE a.id = $1
      GROUP BY a.id
      `,
      [id],
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: "App not found" });
    }

    const [imagesResult, ratingDist, filesResult] = await Promise.all([
      db.query("SELECT image_url FROM app_images WHERE app_id = $1", [id]),
      db.query(
        `SELECT rating, COUNT(*)::INTEGER AS count FROM ratings WHERE app_id = $1 GROUP BY rating`,
        [id],
      ),
      db.query("SELECT * FROM app_files WHERE app_id = $1 ORDER BY id", [id]),
    ]);

    let installed_version_code = null;
    if (req.user) {
      const userAppResult = await db.query(
        `SELECT installed_version_code FROM user_apps WHERE user_id = $1 AND app_id = $2`,
        [req.user.id, id],
      );
      if (userAppResult.rows.length > 0) {
        installed_version_code = userAppResult.rows[0].installed_version_code;
      }
    }

    const appRow = appResult.rows[0];

    res.json({
      ...appRow,
      android_url: undefined,
      apk_url: undefined,
      windows_url: undefined,
      linux_url: undefined,
      installed_version_code,
      average_rating: appRow.average_rating
        ? parseFloat(appRow.average_rating)
        : null,
      total_reviews: appRow.total_reviews || 0,
      screenshots: imagesResult.rows.map((r) => r.image_url),
      rating_distribution: ratingDist.rows,
      files: buildFilesArray(appRow, filesResult.rows),
    });
  } catch (err) {
    console.error("GET APP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.downloadApp = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_id, platform } = req.query;

    const appResult = await db.query(
      "SELECT id, version_code, android_url, apk_url, windows_url, linux_url FROM apps WHERE id = $1",
      [id],
    );
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: "App not found" });
    }

    const appRow = appResult.rows[0];
    const filesResult = await db.query(
      "SELECT * FROM app_files WHERE app_id = $1 ORDER BY id",
      [id],
    );

    const allFiles = buildFilesArray(appRow, filesResult.rows);
    if (allFiles.length === 0) {
      return res.status(404).json({ error: "No downloadable files available" });
    }

    let chosen = null;

    if (file_id) {
      chosen = allFiles.find((f) => String(f.id) === String(file_id));
      if (!chosen) {
        return res.status(404).json({ error: "File not found" });
      }
    } else if (platform) {
      const platformTypeMap = { android: "apk", windows: "exe", linux: "sh" };
      const targetType = platformTypeMap[platform];
      if (!targetType) {
        return res.status(400).json({ error: "Invalid platform" });
      }
      // Prefer the latest (non-old) file of the target type
      chosen =
        allFiles.find((f) => f.type === targetType && !f.is_old) ||
        allFiles.find((f) => f.type === targetType) ||
        allFiles[0];
    } else {
      // Default: pick the first non-old file
      chosen = allFiles.find((f) => !f.is_old) || allFiles[0];
    }

    if (!chosen?.url) {
      return res.status(404).json({ error: "Download URL not available" });
    }

    await db.query(
      "UPDATE apps SET download_count = download_count + 1 WHERE id = $1",
      [id],
    );

    if (req.user && INSTALLABLE_TYPES.has(chosen.type)) {
      await db.query(
        `INSERT INTO user_apps (user_id, app_id, installed_version_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, app_id)
         DO UPDATE SET installed_version_code = $3`,
        [req.user.id, id, appRow.version_code],
      );
    }
    // --- END CHANGED

    return res.json({
      download_url: chosen.url,
      file: {
        id: chosen.id,
        type: chosen.type,
        label: chosen.label,
        is_old: chosen.is_old,
      },
    });
  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json({ error: "Download failed" });
  }
};

async function getMyApps(req, res) {
  const userId = req.user.id;
  try {
    const { rows } = await db.query(
      `
      SELECT apps.*
      FROM user_apps
      JOIN apps ON apps.id = user_apps.app_id
      WHERE user_apps.user_id = $1
      ORDER BY installed_at DESC
      `,
      [userId],
    );
    res.json(rows);
  } catch (err) {
    console.error("GET MY APPS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
}
exports.getMyApps = getMyApps;

exports.getUserActivity = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        apps.name AS app_name,
        app_logs.action,
        app_logs.version,
        app_logs.created_at
      FROM app_logs
      JOIN apps ON apps.id = app_logs.app_id
      WHERE app_logs.action IN ('apk_updated', 'uploaded')
      ORDER BY app_logs.created_at DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("USER ACTIVITY ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.uninstallApp = async (req, res) => {
  try {
    const userId = req.user.id;
    const appId = req.params.id;

    const result = await db.query(
      `DELETE FROM user_apps WHERE user_id = $1 AND app_id = $2`,
      [userId, appId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "App not installed" });
    }

    res.json({ message: "App uninstalled successfully" });
  } catch (err) {
    console.error("UNINSTALL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

async function getDeveloper(req, res) {
  try {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: "Name required" });

    const result = await db.query(
      "SELECT name, bio FROM developers WHERE name = $1",
      [name],
    );

    if (result.rows.length === 0) {
      return res.json({ name, bio: null });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  getAllApps: exports.getAllApps,
  getAppById: exports.getAppById,
  downloadApp: exports.downloadApp,
  getMyApps: exports.getMyApps,
  getUserActivity: exports.getUserActivity,
  uninstallApp: exports.uninstallApp,
  getDeveloper,
};
