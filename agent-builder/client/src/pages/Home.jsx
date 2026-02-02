import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bot, Trash2, Play, Settings, FileText } from 'lucide-react';
import { getAgents, createAgent, deleteAgent } from '../api';

export default function Home() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await getAgents();
      setAgents(data);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const agent = await createAgent({ name: newName, description: newDesc });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      navigate(`/agent/${agent.id}/build`);
    } catch (err) {
      alert('Failed to create agent: ' + err.message);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this agent? This cannot be undone.')) return;
    try {
      await deleteAgent(id);
      setAgents(agents.filter((a) => a.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Your Agents</h1>
          <p className="text-slate-400 mt-1">Create and manage AI agent pipelines</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-2.5 font-medium transition"
        >
          <Plus size={18} />
          New Agent
        </button>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">Create New Agent</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Customer Support Agent"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Description (optional)
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What does this agent do?"
                rows={2}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2 font-medium transition"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName('');
                  setNewDesc('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent list */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-400 mt-4">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <Bot size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">No agents yet</h3>
          <p className="text-slate-500 mb-6">Create your first AI agent to get started</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-2.5 font-medium transition"
          >
            <Plus size={18} />
            Create Agent
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                  <Bot size={20} className="text-indigo-400" />
                </div>
                <button
                  onClick={(e) => handleDelete(agent.id, e)}
                  className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{agent.name}</h3>
              <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                {agent.description || 'No description'}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                <span className="flex items-center gap-1">
                  <Bot size={12} />
                  {agent.sub_agent_count} sub-agents
                </span>
                <span className="flex items-center gap-1">
                  <FileText size={12} />
                  {agent.file_count} files
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/agent/${agent.id}/build`)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-3 py-2 text-sm transition"
                >
                  <Settings size={14} />
                  Edit
                </button>
                <button
                  onClick={() => navigate(`/agent/${agent.id}/run`)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-sm transition"
                >
                  <Play size={14} />
                  Run
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
