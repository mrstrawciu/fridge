import React from 'react';
import { Handle, Position } from 'reactflow';
import { CheckCircle2 } from 'lucide-react';

export default function OutputNode({ data, selected }) {
  return (
    <div className={`custom-node output-node ${selected ? 'selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ left: -5 }}
      />
      <div className="node-header">
        <div className="node-icon">
          <CheckCircle2 size={16} />
        </div>
        <div>
          <div className="node-title">Output</div>
          <div className="node-subtitle">Final result</div>
        </div>
      </div>
    </div>
  );
}
