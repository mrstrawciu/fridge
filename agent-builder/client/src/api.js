const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Agents
export const getAgents = () => request('/agents');
export const getAgent = (id) => request(`/agents/${id}`);
export const createAgent = (data) => request('/agents', { method: 'POST', body: data });
export const updateAgent = (id, data) => request(`/agents/${id}`, { method: 'PUT', body: data });
export const deleteAgent = (id) => request(`/agents/${id}`, { method: 'DELETE' });

// Sub-agents
export const createSubAgent = (agentId, data) =>
  request(`/agents/${agentId}/sub-agents`, { method: 'POST', body: data });
export const updateSubAgent = (id, data) =>
  request(`/agents/sub-agents/${id}`, { method: 'PUT', body: data });
export const deleteSubAgent = (id) =>
  request(`/agents/sub-agents/${id}`, { method: 'DELETE' });

// Models
export const getModels = () => request('/agents/models');

// Knowledge
export const getKnowledgeFiles = (agentId) => request(`/agents/${agentId}/knowledge`);
export const uploadKnowledgeFile = (agentId, file) => {
  const form = new FormData();
  form.append('file', file);
  return request(`/agents/${agentId}/knowledge`, { method: 'POST', body: form });
};
export const deleteKnowledgeFile = (fileId) =>
  request(`/agents/knowledge/${fileId}`, { method: 'DELETE' });

// Execute
export const executeAgentApi = (agentId, { input, conversationId, file }) => {
  const form = new FormData();
  if (input) form.append('input', input);
  if (conversationId) form.append('conversationId', conversationId);
  if (file) form.append('file', file);
  return request(`/agents/${agentId}/execute`, { method: 'POST', body: form });
};

// Conversations
export const getConversations = (agentId) => request(`/agents/${agentId}/conversations`);
export const getMessages = (conversationId) =>
  request(`/agents/conversations/${conversationId}/messages`);
export const deleteConversation = (conversationId) =>
  request(`/agents/conversations/${conversationId}`, { method: 'DELETE' });
