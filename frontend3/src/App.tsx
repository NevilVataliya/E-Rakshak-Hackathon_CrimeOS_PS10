import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import CommandHeader from './components/layout/CommandHeader';
import TacticalStepperHeader from './components/layout/TacticalStepperHeader';
import DashboardView from './views/DashboardView';
import IntakeView from './views/IntakeView';
import LinkageView from './views/LinkageView';
import InvestigationView from './views/InvestigationView';
import SubpoenasView from './views/SubpoenasView';
import AnalyticsView from './views/AnalyticsView';
import CaseDiaryView from './views/CaseDiaryView';
import AdminView from './views/AdminView';
import LoginView from './views/LoginView';
import { useAuthStore } from './store/authStore';

function ProtectedLayout() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/login') {
    return <LoginView />;
  }

  return (
    <div className="h-screen w-screen bg-[#050811] text-slate-100 flex flex-col font-sans overflow-hidden select-none">
      <CommandHeader />
      <TacticalStepperHeader />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col bg-[#050811] overflow-hidden">
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/intake" element={<IntakeView />} />
            <Route path="/linkage" element={<LinkageView />} />
            <Route path="/investigation" element={<InvestigationView />} />
            <Route path="/subpoenas" element={<SubpoenasView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/case-diary" element={<CaseDiaryView />} />
            <Route path="/admin" element={<AdminView />} />
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
        <Route path="/login" element={<LoginView />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </Router>
  );
}
