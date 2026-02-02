import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cpu, Home } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Cpu size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white">AI Agent Creator</span>
        </Link>

        {location.pathname !== '/' && (
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm"
          >
            <Home size={16} />
            All Agents
          </Link>
        )}
      </div>
    </nav>
  );
}
