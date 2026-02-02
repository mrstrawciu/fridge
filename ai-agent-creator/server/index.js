require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const agentsRouter = require('./routes/agents');
const knowledgeRouter = require('./routes/knowledge');
const executeRouter = require('./routes/execute');
const conversationsRouter = require('./routes/conversations');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api/agents', agentsRouter);
app.use('/api/agents', knowledgeRouter);
app.use('/api/agents', executeRouter);
app.use('/api/agents', conversationsRouter);

// Serve static frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
