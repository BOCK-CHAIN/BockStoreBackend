const multer = require("multer");
const path = require("path");

// Use memory storage instead of disk storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB MAX
  },
  fileFilter: (req, file, cb) => {
    console.log("FIELD:", file.fieldname, "FILE:", file.originalname);

    const ext = path.extname(file.originalname).toLowerCase();

    const imageExt = [".png", ".jpg", ".jpeg", ".webp"];
    const apkExt = [".apk"];
    const exeExt = [".exe"];
    const linuxExt = [".appimage", ".deb"];

    // Validate images
    if (
      ["icon", "screenshots", "profile_image"].includes(file.fieldname) &&
      imageExt.includes(ext)
    ) {
      return cb(null, true);
    }

    // Validate app files
    if (
      file.fieldname === "files" &&
      [...apkExt, ...exeExt, ...linuxExt].includes(ext)
    ) {
      return cb(null, true);
    }

    return cb(new Error("Invalid file type"), false);
  },
});

module.exports = upload;
