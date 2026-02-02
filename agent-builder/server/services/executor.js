const { callClaude } = require('./claude');
const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Execute an agent pipeline based on its canvas graph.
 *
 * Flow:
 * 1. Parse canvas_data to get nodes and edges
 * 2. Build execution order via topological sort from input → output
 * 3. Execute each sub-agent in order, passing output forward
 * 4. Save messages to conversation for memory
 */
async function executeAgent({ agentId, userInput, conversationId, uploadedFileContent }) {
  const db = getDb();

  // Load agent
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');

  // Load sub-agents
  const subAgents = db.prepare('SELECT * FROM sub_agents WHERE agent_id = ?').all(agentId);
  const subAgentMap = {};
  for (const sa of subAgents) {
    subAgentMap[sa.node_id] = sa;
  }

  // Load knowledge base
  const knowledgeFiles = db.prepare('SELECT * FROM knowledge_files WHERE agent_id = ?').all(agentId);
  let knowledgeContext = '';
  if (knowledgeFiles.length > 0) {
    knowledgeContext = '\n\n--- KNOWLEDGE BASE ---\n';
    for (const f of knowledgeFiles) {
      knowledgeContext += `\n[File: ${f.original_name}]\n${f.content}\n`;
    }
    knowledgeContext += '\n--- END KNOWLEDGE BASE ---\n';
  }

  // Parse canvas
  let canvasData;
  try {
    canvasData = JSON.parse(agent.canvas_data || '{}');
  } catch {
    canvasData = { nodes: [], edges: [] };
  }

  const nodes = canvasData.nodes || [];
  const edges = canvasData.edges || [];

  // Build execution order
  const executionOrder = getExecutionOrder(nodes, edges);
  const subAgentNodes = executionOrder.filter((n) => n.type === 'subAgent');

  // If no sub-agents, return a simple message
  if (subAgentNodes.length === 0) {
    return {
      output: 'No sub-agents configured. Please add at least one sub-agent to the canvas.',
      steps: [],
    };
  }

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    convId = uuidv4();
    const title = userInput.substring(0, 50) + (userInput.length > 50 ? '...' : '');
    db.prepare('INSERT INTO conversations (id, agent_id, title) VALUES (?, ?, ?)').run(convId, agentId, title);
  }

  // Load conversation history
  const history = db
    .prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(convId);

  // Save user message
  db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
    uuidv4(),
    convId,
    'user',
    userInput + (uploadedFileContent ? `\n\n[Uploaded file content]:\n${uploadedFileContent}` : '')
  );

  // Execute pipeline
  let currentInput = userInput + (uploadedFileContent ? `\n\n[Uploaded file content]:\n${uploadedFileContent}` : '');
  const steps = [];

  for (let i = 0; i < subAgentNodes.length; i++) {
    const node = subAgentNodes[i];
    const subAgent = subAgentMap[node.id];

    if (!subAgent) continue;

    // Build system prompt with knowledge context
    let systemPrompt = subAgent.system_prompt || 'You are a helpful assistant.';
    if (knowledgeContext) {
      systemPrompt += knowledgeContext;
    }

    // Build messages - first sub-agent gets conversation history
    const messages = [];
    if (i === 0 && history.length > 0) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: currentInput });

    try {
      const output = await callClaude({
        model: subAgent.model,
        systemPrompt,
        messages,
        temperature: subAgent.temperature,
      });

      steps.push({
        subAgentId: subAgent.id,
        subAgentName: subAgent.name,
        model: subAgent.model,
        input: currentInput.substring(0, 200) + (currentInput.length > 200 ? '...' : ''),
        output,
      });

      currentInput = output;
    } catch (err) {
      steps.push({
        subAgentId: subAgent.id,
        subAgentName: subAgent.name,
        error: err.message,
      });
      throw new Error(`Sub-agent "${subAgent.name}" failed: ${err.message}`);
    }
  }

  const finalOutput = currentInput;

  // Save assistant message
  db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
    uuidv4(),
    convId,
    'assistant',
    finalOutput
  );

  return {
    conversationId: convId,
    output: finalOutput,
    steps,
  };
}

/**
 * Topological sort of nodes following edges from input to output.
 */
function getExecutionOrder(nodes, edges) {
  if (!nodes.length) return [];

  // Build adjacency list
  const adj = {};
  const inDegree = {};

  for (const node of nodes) {
    adj[node.id] = [];
    inDegree[node.id] = 0;
  }

  for (const edge of edges) {
    if (adj[edge.source]) {
      adj[edge.source].push(edge.target);
    }
    if (inDegree[edge.target] !== undefined) {
      inDegree[edge.target]++;
    }
  }

  // BFS from nodes with 0 in-degree (should be the input node)
  const queue = [];
  for (const node of nodes) {
    if (inDegree[node.id] === 0) {
      queue.push(node.id);
    }
  }

  const order = [];
  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  while (queue.length > 0) {
    const current = queue.shift();
    order.push(nodeMap[current]);

    for (const neighbor of adj[current] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  return order;
}

module.exports = { executeAgent };
