const db = require("../config/db");
const path = require("path");

/**
 * GET /apps/:id/versions
 *
 * Returns all historical (is_old = true) files for an app, grouped by type.
 * The current (latest) file per type is also included at the top of each group
 * so the sheet can display a full version history in one call.
 *
 * Response shape:
 * {
 *   app_id: 5,
 *   groups: [
 *     {
 *       type: "apk",
 *       label: "Android APK",
 *       files: [
 *         { id, url, label, is_old, created_at },   // latest first
 *         { id, url, label, is_old, created_at },   // older …
 *       ]
 *     },
 *     { type: "exe", … }
 *   ]
 * }
 *
 * Only types that have MORE THAN ONE version are returned, because a type with
 * a single file has no history to show.
 */
exports.getAppVersions = async (req, res) => {
  try {
    const { id } = req.params;

    // Confirm app exists
    const appCheck = await db.query("SELECT id FROM apps WHERE id = $1", [id]);
    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: "App not found" });
    }

    // Fetch all files for this app, newest first
    const filesResult = await db.query(
      `SELECT id, app_id, url, type, label, created_at
       FROM app_files
       WHERE app_id = $1
       ORDER BY id DESC`,
      [id],
    );

    if (filesResult.rows.length === 0) {
      return res.json({ app_id: Number(id), groups: [] });
    }

    // Helper: detect type from URL extension when the column is empty
    function detectType(url = "") {
      const ext = path.extname(url).toLowerCase().replace(".", "");
      const map = {
        apk: "apk",
        exe: "exe",
        sh: "sh",
        zip: "zip",
        dmg: "dmg",
        deb: "deb",
        rpm: "rpm",
      };
      return map[ext] || "other";
    }

    // Group by type, preserving DESC order (latest id = index 0 per group)
    const groupMap = {};
    for (const f of filesResult.rows) {
      const type = f.type || detectType(f.url);
      if (!groupMap[type]) groupMap[type] = [];
      groupMap[type].push({
        id: f.id,
        url: f.url,
        label: f.label || f.url,
        created_at: f.created_at,
        // First entry per type (highest id) is current; rest are old
        is_old: false, // will be fixed below
      });
    }

    // Mark: index 0 = current (is_old false), everything else = old (is_old true)
    const groups = [];
    for (const [type, files] of Object.entries(groupMap)) {
      // Only include types that have more than one version (history makes sense)
      if (files.length < 2) continue;

      files[0].is_old = false;
      for (let i = 1; i < files.length; i++) files[i].is_old = true;

      groups.push({ type, files });
    }

    // Sort groups: apk first, then others alphabetically
    groups.sort((a, b) => {
      if (a.type === "apk") return -1;
      if (b.type === "apk") return 1;
      return a.type.localeCompare(b.type);
    });

    return res.json({ app_id: Number(id), groups });
  } catch (err) {
    console.error("GET VERSIONS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};
