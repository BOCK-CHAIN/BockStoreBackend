const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { randomUUID } = require("crypto");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Existing: generates a signed PUT URL for uploading
const getPresignedUrl = async (fileName, fileType, folder = "") => {
  const fileKey = `${folder}/${randomUUID()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileKey,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

  return { uploadUrl, fileUrl };
};

// NEW: generates a signed GET URL from a stored S3 file URL (valid 1 hour)
const getSignedDownloadUrl = async (fileUrl) => {
  const url = new URL(fileUrl);
  const key = url.pathname.slice(1); // strip leading "/"

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 });
};

module.exports = getPresignedUrl;
module.exports.getSignedDownloadUrl = getSignedDownloadUrl;
