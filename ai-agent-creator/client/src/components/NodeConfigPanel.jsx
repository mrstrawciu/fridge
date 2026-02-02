import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';

const MODELS = [
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5' },
];

export default function NodeConfigPanel({ subAgent, onSave, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [temperature, setTemperature] = useState(0.7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subAgent) {
      setName(subAgent.name || '');
      setSystemPrompt(subAgent.system_prompt || '');
      setModel(subAgent.model || 'claude-sonnet-4-20250514');
      setTemperature(subAgent.temperature ?? 0.7);
    }
  }, [subAgent]);

  if (!subAgent) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        system_prompt: systemPrompt,
        model,
        temperature: parseFloat(temperature),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 h-full overflow-y-auto">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Configure Node</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* System Prompt */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition resize-y"
            placeholder="You are a helpful assistant that..."
          />
        </div>

        {/* Model */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Temperature: {temperature}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => onDelete(subAgent.id)}
            className="flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
