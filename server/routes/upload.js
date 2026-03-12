import express from 'express';
import path from 'path';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { ObjectStorageService } from '../replit_integrations/object_storage/objectStorage.js';

const router = express.Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

router.post('/', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      if (err.message === 'Invalid file type') {
        return res.status(400).json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM.' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname);
    const { signedUrl, objectPath } = await objectStorageService.getObjectEntityUploadURL(ext);

    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      body: req.file.buffer,
      headers: { 'Content-Type': req.file.mimetype },
    });

    if (!uploadRes.ok) {
      throw new Error(`Storage upload failed: ${uploadRes.status}`);
    }

    res.json({
      file_url: objectPath,
      filename: path.basename(objectPath),
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
