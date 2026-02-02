import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, X, File, FileSpreadsheet } from 'lucide-react';

const FILE_ICONS = {
  txt: FileText,
  md: FileText,
  pdf: File,
  docx: File,
  csv: FileSpreadsheet,
  json: FileText,
};

export default function KnowledgePanel({ files, onUpload, onDelete, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (selectedFiles) => {
    if (!selectedFiles?.length) return;
    setUploading(true);
    try {
      for (const file of selectedFiles) {
        await onUpload(file);
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 h-full overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Knowledge Base</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Upload area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition cursor-pointer ${
            dragOver
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-600 hover:border-slate-500'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={24} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-300">
            {uploading ? 'Uploading...' : 'Drop files here or click to browse'}
          </p>
          <p className="text-xs text-slate-500 mt-1">TXT, PDF, DOCX, CSV, JSON (max 10MB)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.docx,.csv,.json"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        {/* File list */}
        <div className="space-y-2">
          {files.map((file) => {
            const IconComp = FILE_ICONS[file.file_type] || FileText;
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 bg-slate-900 rounded-lg p-3 group"
              >
                <IconComp size={18} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{file.original_name}</p>
                  <p className="text-xs text-slate-500">{formatSize(file.file_size)}</p>
                </div>
                <button
                  onClick={() => onDelete(file.id)}
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          {files.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No files uploaded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
