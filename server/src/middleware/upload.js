// src/middleware/upload.js
// Multer file upload middleware configured for audio recitations

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const audioUploadDir = path.resolve(__dirname, '../../../uploads/audio');

// Ensure upload directory exists
if (!fs.existsSync(audioUploadDir)) {
  fs.mkdirSync(audioUploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, audioUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')
      .substring(0, 50);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `audio-${uniqueSuffix}-${baseName}${ext}`);
  }
});

// File filter: only accept valid audio files
const audioFileFilter = (req, file, cb) => {
  const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm', '.opus'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (file.mimetype.startsWith('audio/') || allowedExts.includes(ext) || file.mimetype === 'video/webm') {
    cb(null, true);
  } else {
    cb(new Error('الملف المرفوع يجب أن يكون ملفاً صوتياً (MP3, WAV, M4A, OGG, AAC)'));
  }
};

const upload = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max audio file
  }
});

// Middleware wrapper that provides clean Arabic error responses
function handleAudioUpload(req, res, next) {
  upload.single('audioFile')(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'حجم الملف الصوتي كبير جداً. الحد الأقصى المسموح به هو 100 ميغابايت.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'حدث خطأ أثناء رفع الملف الصوتي.'
      });
    }
    next();
  });
}

module.exports = {
  handleAudioUpload,
  audioUploadDir,
};
