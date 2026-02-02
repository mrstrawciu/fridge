const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { parseFile, isSupportedFile } = require('../services/fileParser');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (isSupportedFile(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Supported: TXT, PDF, DOCX, CSV, JSON'));
    }
  },
});

// List knowledge files for an agent
router.get('/:agentId/knowledge', (req, res) => {
  const db = getDb();
  const files = db
    .prepare('SELECT id, original_name, file_type, file_size, uploaded_at FROM knowledge_files WHERE agent_id = ? ORDER BY uploaded_at DESC')
    .all(req.params.agentId);
  res.json(files);
});

// Upload knowledge file
router.post('/:agentId/knowledge', upload.single('file'), async (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.agentId);
    if (!agent) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = await parseFile(req.file.path, req.file.originalname);
    const id = uuidv4();
    const ext = path.extname(req.file.originalname).toLowerCase().slice(1);

    db.prepare(
      'INSERT INTO knowledge_files (id, agent_id, filename, original_name, content, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.params.agentId, req.file.filename, req.file.originalname, content, ext, req.file.size);

    // Clean up uploaded file (content is stored in DB)
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      id,
      original_name: req.file.originalname,
      file_type: ext,
      file_size: req.file.size,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete knowledge file
router.delete('/knowledge/:fileId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM knowledge_files WHERE id = ?').run(req.params.fileId);
  res.json({ success: true });
});

module.exports = router;
