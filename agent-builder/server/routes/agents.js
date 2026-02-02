const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { AVAILABLE_MODELS } = require('../services/claude');

const router = express.Router();

// List all agents
router.get('/', (req, res) => {
  const db = getDb();
  const agents = db
    .prepare(
      `SELECT a.*,
        (SELECT COUNT(*) FROM sub_agents WHERE agent_id = a.id) as sub_agent_count,
        (SELECT COUNT(*) FROM knowledge_files WHERE agent_id = a.id) as file_count
      FROM agents a ORDER BY a.updated_at DESC`
    )
    .all();
  res.json(agents);
});

// Get available models
router.get('/models', (req, res) => {
  res.json(AVAILABLE_MODELS);
});

// Get single agent with sub-agents
router.get('/:id', (req, res) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const subAgents = db.prepare('SELECT * FROM sub_agents WHERE agent_id = ?').all(req.params.id);
  const files = db
    .prepare('SELECT id, original_name, file_type, file_size, uploaded_at FROM knowledge_files WHERE agent_id = ?')
    .all(req.params.id);

  res.json({
    ...agent,
    canvas_data: JSON.parse(agent.canvas_data || '{}'),
    subAgents,
    knowledgeFiles: files,
  });
});

// Create agent
router.post('/', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const { name, description } = req.body;

  // Default canvas with input and output nodes
  const defaultCanvas = {
    nodes: [
      {
        id: 'input-1',
        type: 'inputNode',
        position: { x: 50, y: 200 },
        data: { label: 'Input' },
      },
      {
        id: 'output-1',
        type: 'outputNode',
        position: { x: 700, y: 200 },
        data: { label: 'Output' },
      },
    ],
    edges: [],
  };

  db.prepare('INSERT INTO agents (id, name, description, canvas_data) VALUES (?, ?, ?, ?)').run(
    id,
    name || 'New Agent',
    description || '',
    JSON.stringify(defaultCanvas)
  );

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  res.status(201).json({
    ...agent,
    canvas_data: defaultCanvas,
    subAgents: [],
    knowledgeFiles: [],
  });
});

// Update agent
router.put('/:id', (req, res) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const { name, description, canvas_data } = req.body;

  db.prepare(`UPDATE agents SET name = ?, description = ?, canvas_data = ?, updated_at = datetime('now') WHERE id = ?`).run(
    name ?? agent.name,
    description ?? agent.description,
    canvas_data ? JSON.stringify(canvas_data) : agent.canvas_data,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  res.json({
    ...updated,
    canvas_data: JSON.parse(updated.canvas_data || '{}'),
  });
});

// Delete agent
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Sub-agents ---

// Add sub-agent
router.post('/:id/sub-agents', (req, res) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  // Check limit
  const count = db.prepare('SELECT COUNT(*) as cnt FROM sub_agents WHERE agent_id = ?').get(req.params.id).cnt;
  if (count >= 5) {
    return res.status(400).json({ error: 'Maximum 5 sub-agents allowed per agent' });
  }

  const id = uuidv4();
  const nodeId = req.body.node_id || `subagent-${id}`;
  const { name, system_prompt, model, temperature } = req.body;

  db.prepare(
    'INSERT INTO sub_agents (id, agent_id, node_id, name, system_prompt, model, temperature) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    req.params.id,
    nodeId,
    name || `Sub-Agent ${count + 1}`,
    system_prompt || 'You are a helpful assistant.',
    model || 'claude-sonnet-4-20250514',
    temperature ?? 0.7
  );

  const subAgent = db.prepare('SELECT * FROM sub_agents WHERE id = ?').get(id);
  res.status(201).json(subAgent);
});

// Update sub-agent
router.put('/sub-agents/:id', (req, res) => {
  const db = getDb();
  const sa = db.prepare('SELECT * FROM sub_agents WHERE id = ?').get(req.params.id);
  if (!sa) return res.status(404).json({ error: 'Sub-agent not found' });

  const { name, system_prompt, model, temperature } = req.body;

  db.prepare('UPDATE sub_agents SET name = ?, system_prompt = ?, model = ?, temperature = ? WHERE id = ?').run(
    name ?? sa.name,
    system_prompt ?? sa.system_prompt,
    model ?? sa.model,
    temperature ?? sa.temperature,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM sub_agents WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete sub-agent
router.delete('/sub-agents/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM sub_agents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
