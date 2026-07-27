import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import DashboardPage from './pages/DashboardPage';
import ComplaintIntakePage from './pages/ComplaintIntakePage';
import SerialLinkagePage from './pages/SerialLinkagePage';
import AgentStudioPage from './pages/AgentStudioPage';
import SubpoenaGeneratorPage from './pages/SubpoenaGeneratorPage';
import ResponseAnalyticsPage from './pages/ResponseAnalyticsPage';
import CaseDiaryPage from './pages/CaseDiaryPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { useAuthStore } from './store/authStore';

function ProtectedLayout() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/login') {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/complaints" element={<ComplaintIntakePage />} />
            <Route path="/linkage" element={<SerialLinkagePage />} />
            <Route path="/investigation" element={<AgentStudioPage />} />
            <Route path="/subpoenas" element={<SubpoenaGeneratorPage />} />
            <Route path="/response-analytics" element={<ResponseAnalyticsPage />} />
            <Route path="/case-diary" element={<CaseDiaryPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </Router>
  );
}
