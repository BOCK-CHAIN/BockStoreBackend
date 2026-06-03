const getPresignedUrl = require("../utils/getPresignedUrl");

exports.getUploadUrl = async (req, res) => {
  try {
    const { fileName, fileType, folder } = req.body;

    if (!fileName || !fileType || !folder) {
      return res
        .status(400)
        .json({ error: "fileName, fileType and folder are required" });
    }

    const { uploadUrl, fileUrl } = await getPresignedUrl(
      fileName,
      fileType,
      folder,
    );

    res.json({ uploadUrl, fileUrl });
  } catch (err) {
    console.error("PRESIGNED URL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
