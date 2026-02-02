import React from 'react';
import { Handle, Position } from 'reactflow';
import { Bot } from 'lucide-react';

export default function SubAgentNode({ data, selected }) {
  const modelLabel = (data.model || '').includes('opus')
    ? 'Opus 4.5'
    : (data.model || '').includes('haiku')
      ? 'Haiku 3.5'
      : 'Sonnet 4';

  return (
    <div className={`custom-node subagent-node ${selected ? 'selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ left: -5 }}
      />
      <div className="node-header">
        <div className="node-icon">
          <Bot size={16} />
        </div>
        <div>
          <div className="node-title">{data.label || 'Sub-Agent'}</div>
          <div className="node-subtitle">{modelLabel} &middot; temp {data.temperature ?? 0.7}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ right: -5 }}
      />
    </div>
  );
}
