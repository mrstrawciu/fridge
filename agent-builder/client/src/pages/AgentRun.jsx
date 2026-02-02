import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Send,
  Paperclip,
  ArrowLeft,
  Settings,
  Loader2,
  MessageSquare,
  Trash2,
  Plus,
  ChevronRight,
  Bot,
  User,
  X,
} from 'lucide-react';
import {
  getAgent,
  executeAgentApi,
  getConversations,
  getMessages,
  deleteConversation,
} from '../api';

export default function AgentRun() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [steps, setSteps] = useState([]);
  const [showSteps, setShowSteps] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadAgent();
    loadConversations();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAgent = async () => {
    try {
      const data = await getAgent(id);
      setAgent(data);
    } catch (err) {
      alert('Agent not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const data = await getConversations(id);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadMessages = async (convId) => {
    try {
      const data = await getMessages(convId);
      setMessages(data);
      setActiveConvId(convId);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setSteps([]);
    setInput('');
    setFile(null);
  };

  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        handleNewConversation();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleExecute = async () => {
    if (!input.trim() && !file) return;

    const userMessage = input.trim();
    setExecuting(true);
    setSteps([]);

    // Optimistically add user message
    setMessages((prev) => [
      ...prev,
      {
        id: 'temp-' + Date.now(),
        role: 'user',
        content: userMessage + (file ? `\n[Attached: ${file.name}]` : ''),
        created_at: new Date().toISOString(),
      },
    ]);

    const currentInput = input;
    const currentFile = file;
    setInput('');
    setFile(null);

    try {
      const result = await executeAgentApi(id, {
        input: currentInput,
        conversationId: activeConvId,
        file: currentFile,
      });

      // Update conversation
      if (result.conversationId && result.conversationId !== activeConvId) {
        setActiveConvId(result.conversationId);
        loadConversations();
      }

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: 'resp-' + Date.now(),
          role: 'assistant',
          content: result.output,
          created_at: new Date().toISOString(),
        },
      ]);

      if (result.steps?.length > 0) {
        setSteps(result.steps);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: `Error: ${err.message}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-57px)]">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Conversations sidebar */}
      {showSidebar && (
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition"
            >
              <Plus size={16} />
              New Conversation
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadMessages(conv.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1 cursor-pointer group transition ${
                  activeConvId === conv.id
                    ? 'bg-indigo-600/20 text-indigo-300'
                    : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                <MessageSquare size={14} className="flex-shrink-0" />
                <span className="text-sm truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">No conversations yet</p>
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-slate-400 hover:text-white transition"
          >
            <MessageSquare size={18} />
          </button>
          <div className="flex-1">
            <h2 className="text-white font-medium">{agent?.name}</h2>
            <p className="text-xs text-slate-400">
              {agent?.subAgents?.length || 0} sub-agents &middot;{' '}
              {agent?.knowledgeFiles?.length || 0} knowledge files
            </p>
          </div>
          <button
            onClick={() => navigate(`/agent/${id}/build`)}
            className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition"
          >
            <Settings size={14} />
            Edit
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !executing && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot size={48} className="text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-1">
                Run {agent?.name}
              </h3>
              <p className="text-sm text-slate-500 max-w-md">
                Type a message or upload a file to start. The agent will process your input
                through its sub-agent pipeline.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-indigo-400" />
                </div>
              )}
              <div
                className={`max-w-[70%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 border border-slate-700 text-slate-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {executing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                <Loader2 size={16} className="text-indigo-400 animate-spin" />
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                <p className="text-sm text-slate-400">Processing through pipeline...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Steps viewer */}
        {steps.length > 0 && (
          <div className="border-t border-slate-700">
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-300 transition"
            >
              <ChevronRight
                size={12}
                className={`transition-transform ${showSteps ? 'rotate-90' : ''}`}
              />
              Pipeline steps ({steps.length})
            </button>
            {showSteps && (
              <div className="px-4 pb-3 space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="bg-slate-800 rounded-lg p-3 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-indigo-400 font-medium">{step.subAgentName}</span>
                      <span className="text-slate-500">&middot;</span>
                      <span className="text-slate-500">{step.model}</span>
                    </div>
                    {step.error ? (
                      <p className="text-red-400">{step.error}</p>
                    ) : (
                      <p className="text-slate-400 line-clamp-3">{step.output}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-slate-700 p-4">
          {file && (
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 mb-2 text-sm">
              <Paperclip size={14} className="text-slate-400" />
              <span className="text-slate-300 truncate flex-1">{file.name}</span>
              <button
                onClick={() => setFile(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx,.csv,.json"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleExecute();
                }
              }}
              placeholder="Type your message..."
              disabled={executing}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition"
            />
            <button
              onClick={handleExecute}
              disabled={executing || (!input.trim() && !file)}
              className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition"
            >
              {executing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
