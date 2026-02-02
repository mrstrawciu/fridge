const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// List conversations for an agent
router.get('/:agentId/conversations', (req, res) => {
  const db = getDb();
  const conversations = db
    .prepare('SELECT * FROM conversations WHERE agent_id = ? ORDER BY created_at DESC')
    .all(req.params.agentId);
  res.json(conversations);
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', (req, res) => {
  const db = getDb();
  const messages = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(req.params.conversationId);
  res.json(messages);
});

// Delete a conversation
router.delete('/conversations/:conversationId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(req.params.conversationId);
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.conversationId);
  res.json({ success: true });
});

module.exports = router;
