import { Router } from 'express';
import multer from 'multer';
import { mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', 'uploads');

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({ storage });

const router = Router({ mergeParams: true });

router.post('/Core/:endpointName', upload.any(), async (req, res) => {
  const { endpointName } = req.params;
  const file = req.files?.[0] || req.file;

  if (endpointName === 'UploadFile' || endpointName === 'UploadPrivateFile') {
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${file.filename}`;
    return res.json({ file_url: fileUrl, file_uri: fileUrl });
  }

  if (endpointName === 'CreateFileSignedUrl') {
    const uri = req.body?.file_uri || '/uploads/placeholder';
    const base = `${req.protocol}://${req.get('host')}`;
    return res.json({ signed_url: uri.startsWith('http') ? uri : `${base}${uri}` });
  }

  if (endpointName === 'ExtractDataFromUploadedFile') {
    return res.json({ extracted_data: {}, fields: {} });
  }

  res.json({ success: true, endpoint: endpointName });
});

export default router;
