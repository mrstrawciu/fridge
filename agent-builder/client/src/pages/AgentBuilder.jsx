import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Plus,
  Save,
  Play,
  Database,
  Bot,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

import InputNode from '../components/nodes/InputNode';
import SubAgentNode from '../components/nodes/SubAgentNode';
import OutputNode from '../components/nodes/OutputNode';
import NodeConfigPanel from '../components/NodeConfigPanel';
import KnowledgePanel from '../components/KnowledgePanel';

import {
  getAgent,
  updateAgent,
  createSubAgent,
  updateSubAgent,
  deleteSubAgent,
  uploadKnowledgeFile,
  deleteKnowledgeFile,
} from '../api';

const nodeTypes = {
  inputNode: InputNode,
  subAgent: SubAgentNode,
  outputNode: OutputNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
  style: { stroke: '#6366f1', strokeWidth: 2 },
};

export default function AgentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [subAgentsMap, setSubAgentsMap] = useState({});
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentDesc, setAgentDesc] = useState('');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showKnowledge, setShowKnowledge] = useState(false);

  const reactFlowWrapper = useRef(null);

  // Load agent data
  useEffect(() => {
    loadAgent();
  }, [id]);

  const loadAgent = async () => {
    try {
      const data = await getAgent(id);
      setAgent(data);
      setAgentName(data.name);
      setAgentDesc(data.description || '');
      setKnowledgeFiles(data.knowledgeFiles || []);

      // Build sub-agents map by node_id
      const saMap = {};
      for (const sa of data.subAgents || []) {
        saMap[sa.node_id] = sa;
      }
      setSubAgentsMap(saMap);

      // Load canvas
      const canvas = data.canvas_data || {};
      const loadedNodes = (canvas.nodes || []).map((n) => {
        if (n.type === 'subAgent' && saMap[n.id]) {
          return {
            ...n,
            data: {
              ...n.data,
              label: saMap[n.id].name,
              model: saMap[n.id].model,
              temperature: saMap[n.id].temperature,
            },
          };
        }
        return n;
      });
      setNodes(loadedNodes);
      setEdges(canvas.edges || []);
    } catch (err) {
      alert('Failed to load agent: ' + err.message);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // Connect nodes
  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));
    },
    [setEdges]
  );

  // Select node
  const onNodeClick = useCallback((event, node) => {
    if (node.type === 'subAgent') {
      setSelectedNodeId(node.id);
      setShowKnowledge(false);
    } else {
      setSelectedNodeId(null);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Add sub-agent
  const handleAddSubAgent = async () => {
    const subAgentCount = nodes.filter((n) => n.type === 'subAgent').length;
    if (subAgentCount >= 5) {
      alert('Maximum 5 sub-agents allowed');
      return;
    }

    // Calculate position
    const existingSubAgents = nodes.filter((n) => n.type === 'subAgent');
    const xPos = 250 + existingSubAgents.length * 220;
    const yPos = 200;

    try {
      const sa = await createSubAgent(id, {
        name: `Sub-Agent ${subAgentCount + 1}`,
      });

      const newNode = {
        id: sa.node_id,
        type: 'subAgent',
        position: { x: xPos, y: yPos },
        data: {
          label: sa.name,
          model: sa.model,
          temperature: sa.temperature,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setSubAgentsMap((prev) => ({ ...prev, [sa.node_id]: sa }));
      setSelectedNodeId(sa.node_id);
    } catch (err) {
      alert('Failed to add sub-agent: ' + err.message);
    }
  };

  // Save sub-agent config
  const handleSaveSubAgent = async (config) => {
    const sa = subAgentsMap[selectedNodeId];
    if (!sa) return;

    try {
      const updated = await updateSubAgent(sa.id, config);
      setSubAgentsMap((prev) => ({ ...prev, [selectedNodeId]: updated }));

      // Update node display
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: config.name,
                  model: config.model,
                  temperature: config.temperature,
                },
              }
            : n
        )
      );
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  };

  // Delete sub-agent
  const handleDeleteSubAgent = async (subAgentDbId) => {
    try {
      await deleteSubAgent(subAgentDbId);
      const nodeId = selectedNodeId;
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSubAgentsMap((prev) => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
      setSelectedNodeId(null);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  // Save canvas
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAgent(id, {
        name: agentName,
        description: agentDesc,
        canvas_data: { nodes, edges },
      });
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Knowledge handlers
  const handleUploadFile = async (file) => {
    const result = await uploadKnowledgeFile(id, file);
    setKnowledgeFiles((prev) => [result, ...prev]);
  };

  const handleDeleteFile = async (fileId) => {
    await deleteKnowledgeFile(fileId);
    setKnowledgeFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const selectedSubAgent = selectedNodeId ? subAgentsMap[selectedNodeId] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-57px)]">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left toolbar */}
      <div className="w-56 bg-slate-800 border-r border-slate-700 p-4 flex flex-col">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Agent info */}
        <div className="mb-6">
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="w-full bg-transparent text-white font-semibold text-lg border-none focus:outline-none mb-1"
            placeholder="Agent name"
          />
          <input
            type="text"
            value={agentDesc}
            onChange={(e) => setAgentDesc(e.target.value)}
            className="w-full bg-transparent text-slate-400 text-sm border-none focus:outline-none"
            placeholder="Description..."
          />
        </div>

        {/* Add nodes */}
        <div className="space-y-2 mb-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Add Nodes</p>
          <button
            onClick={handleAddSubAgent}
            className="w-full flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg px-3 py-2 text-sm transition"
          >
            <Bot size={16} />
            Sub-Agent
            <span className="ml-auto text-xs text-indigo-400">
              {nodes.filter((n) => n.type === 'subAgent').length}/5
            </span>
          </button>
        </div>

        {/* Knowledge base */}
        <button
          onClick={() => {
            setShowKnowledge(!showKnowledge);
            setSelectedNodeId(null);
          }}
          className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition mb-6 ${
            showKnowledge
              ? 'bg-amber-600/30 text-amber-300'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          <Database size={16} />
          Knowledge Base
          <span className="ml-auto text-xs">{knowledgeFiles.length}</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom actions */}
        <div className="space-y-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => {
              handleSave().then(() => navigate(`/agent/${id}/run`));
            }}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition"
          >
            <Play size={16} />
            Run Agent
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode={['Backspace', 'Delete']}
          snapToGrid
          snapGrid={[20, 20]}
        >
          <Background color="#334155" gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'inputNode') return '#22c55e';
              if (n.type === 'subAgent') return '#6366f1';
              if (n.type === 'outputNode') return '#f59e0b';
              return '#64748b';
            }}
            maskColor="rgba(15, 23, 42, 0.8)"
          />
        </ReactFlow>
      </div>

      {/* Right panel */}
      {selectedSubAgent && (
        <NodeConfigPanel
          subAgent={selectedSubAgent}
          onSave={handleSaveSubAgent}
          onDelete={handleDeleteSubAgent}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {showKnowledge && (
        <KnowledgePanel
          files={knowledgeFiles}
          onUpload={handleUploadFile}
          onDelete={handleDeleteFile}
          onClose={() => setShowKnowledge(false)}
        />
      )}
    </div>
  );
}
