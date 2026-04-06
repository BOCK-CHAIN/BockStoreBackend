const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "icon") {
      cb(null, "uploads/icons");
    } else if (file.fieldname === "screenshots") {
      cb(null, "uploads/screenshots");
    } else if (file.fieldname === "apk") {
      cb(null, "uploads/apks");
    } else if (file.fieldname === "windows") {
      cb(null, "uploads/windows");
    } else if (file.fieldname === "linux") {
      cb(null, "uploads/linux_apps");
    } else if (file.fieldname === "profile_image") {
      cb(null, "uploads/profiles");
    } else {
      cb(new Error("Invalid field name"), null);
    }
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

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

    if (
      ["icon", "screenshots", "profile_image"].includes(file.fieldname) &&
      imageExt.includes(ext)
    ) {
      return cb(null, true);
    }

    if (file.fieldname === "apk" && apkExt.includes(ext)) {
      return cb(null, true);
    }

    if (file.fieldname === "windows" && exeExt.includes(ext)) {
      return cb(null, true);
    }

    if (file.fieldname === "linux" && linuxExt.includes(ext)) {
      return cb(null, true);
    }

    return cb(new Error("Invalid file type"), false);
  },
});

module.exports = upload;
