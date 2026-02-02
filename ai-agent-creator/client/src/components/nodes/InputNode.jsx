import React from 'react';
import { Handle, Position } from 'reactflow';
import { ArrowRightCircle } from 'lucide-react';

export default function InputNode({ data, selected }) {
  return (
    <div className={`custom-node input-node ${selected ? 'selected' : ''}`}>
      <div className="node-header">
        <div className="node-icon">
          <ArrowRightCircle size={16} />
        </div>
        <div>
          <div className="node-title">Input</div>
          <div className="node-subtitle">User query or file</div>
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
