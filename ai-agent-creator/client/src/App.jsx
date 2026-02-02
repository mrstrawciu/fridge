import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import AgentBuilder from './pages/AgentBuilder';
import AgentRun from './pages/AgentRun';

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agent/:id/build" element={<AgentBuilder />} />
          <Route path="/agent/:id/run" element={<AgentRun />} />
        </Routes>
      </div>
    </div>
  );
}
