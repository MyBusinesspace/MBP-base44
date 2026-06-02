import { Router } from 'express';
import multer from 'multer';
import { getUploadsDir, ensureUploadsDir } from '../utils/uploadsPath.js';
import { sendEmail, isEmailConfigured } from '../utils/sendEmail.js';
import { storeUpload } from '../utils/storeUpload.js';

let uploadMiddleware;

function getUploadMiddleware() {
  if (uploadMiddleware) return uploadMiddleware;

  const uploadsDir = ensureUploadsDir(getUploadsDir());

  // Always use memory storage so we can forward to Supabase Storage on Vercel.
  // Local disk filenames are not stable in serverless /tmp anyway.
  uploadMiddleware = multer({ storage: multer.memoryStorage() });

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

    try {
      // diskStorage gives us file.path/filename; memoryStorage gives buffer
      const buffer = file.buffer;
      if (!buffer) {
        return res.status(400).json({ message: 'No file data' });
      }
      const stored = await storeUpload({
        buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        prefix: endpointName === 'UploadPrivateFile' ? 'private' : 'public',
      });
      return res.json({ file_url: stored.file_url, file_uri: stored.file_uri });
    } catch (e) {
      console.error('[UploadFile]', e.message);
      return res.status(503).json({ message: e.message });
    }
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
