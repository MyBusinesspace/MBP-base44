import { Router } from 'express';
import multer from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { getUploadsDir, ensureUploadsDir } from '../utils/uploadsPath.js';
import { sendEmail, isEmailConfigured } from '../utils/sendEmail.js';

let uploadMiddleware;

function getUploadMiddleware() {
  if (uploadMiddleware) return uploadMiddleware;

  const uploadsDir = ensureUploadsDir(getUploadsDir());

  if (uploadsDir) {
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname) || '';
        cb(null, `${randomUUID()}${ext}`);
      },
    });
    uploadMiddleware = multer({ storage });
  } else {
    uploadMiddleware = multer({ storage: multer.memoryStorage() });
  }

  return uploadMiddleware;
}

const router = Router({ mergeParams: true });

router.post('/Core/:endpointName', (req, res, next) => {
  getUploadMiddleware().any()(req, res, next);
}, async (req, res) => {
  const { endpointName } = req.params;
  const file = req.files?.[0] || req.file;

  if (endpointName === 'UploadFile' || endpointName === 'UploadPrivateFile') {
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (file.filename) {
      const fileUrl = `/uploads/${file.filename}`;
      return res.json({ file_url: fileUrl, file_uri: fileUrl });
    }

    if (file.buffer) {
      const dataUrl = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;
      return res.json({
        file_url: dataUrl,
        file_uri: dataUrl,
        _note: 'File stored in memory on serverless; use Supabase Storage for production persistence.',
      });
    }

    return res.status(400).json({ message: 'No file data' });
  }

  if (endpointName === 'CreateFileSignedUrl') {
    const uri = req.body?.file_uri || '/uploads/placeholder';
    const base = `${req.protocol}://${req.get('host')}`;
    return res.json({ signed_url: uri.startsWith('http') ? uri : `${base}${uri}` });
  }

  if (endpointName === 'ExtractDataFromUploadedFile') {
    return res.json({ extracted_data: {}, fields: {} });
  }

  if (endpointName === 'SendEmail') {
    const to = req.body?.to;
    const subject = req.body?.subject || 'MyBusinessPace';
    const body = req.body?.body || '';
    const fromName = req.body?.from_name || 'MyBusinessPace';
    if (!to) {
      return res.status(400).json({ message: 'Missing "to" email address' });
    }
    if (!isEmailConfigured()) {
      return res.status(503).json({
        message:
          'Email not configured. Set RESEND_API_KEY or SMTP_HOST in environment variables.',
      });
    }
    try {
      await sendEmail({ to, subject, body, fromName });
      return res.json({ success: true });
    } catch (e) {
      console.error('[SendEmail]', e.message);
      return res.status(503).json({ message: e.message });
    }
  }

  res.json({ success: true, endpoint: endpointName });
});

export default router;
