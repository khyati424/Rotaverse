const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const avatarDir = path.join(__dirname, '../../uploads/avatars');
const businessDir = path.join(__dirname, '../../uploads/businesses');

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}
if (!fs.existsSync(businessDir)) {
  fs.mkdirSync(businessDir, { recursive: true });
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, webp, gif) are allowed!'));
  }
};

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  }
});

const businessStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, businessDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `business-${uniqueSuffix}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter
});

const uploadBusinessImage = multer({
  storage: businessStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter
});

module.exports = {
  uploadAvatar,
  uploadBusinessImage
};
