const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { executeAgent } = require('../services/executor');
const { parseFile } = require('../services/fileParser');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Execute agent
router.post('/:agentId/execute', upload.single('file'), async (req, res) => {
  try {
    const { input, conversationId } = req.body;

    let uploadedFileContent = null;
    if (req.file) {
      try {
        uploadedFileContent = await parseFile(req.file.path, req.file.originalname);
      } finally {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }
    }

    if (!input && !uploadedFileContent) {
      return res.status(400).json({ error: 'Please provide input text or a file' });
    }

    const result = await executeAgent({
      agentId: req.params.agentId,
      userInput: input || 'Please analyze the uploaded file.',
      conversationId: conversationId || null,
      uploadedFileContent,
    });

    res.json(result);
  } catch (err) {
    console.error('Execution error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
