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
import AdminView from './views/AdminView';
import LoginView from './views/LoginView';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import { useCaseStore } from './store/caseStore';
import AutoTranslateProvider from './components/common/AutoTranslateProvider';

function ProtectedLayout() {
  const { isAuthenticated } = useAuthStore();
  const { fetchCases } = useCaseStore();
  const location = useLocation();

  React.useEffect(() => {
    if (isAuthenticated) {
      fetchCases();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/login') {
    return <LoginView />;
  }

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] dark:bg-[#050811] text-slate-900 dark:text-slate-100 flex flex-col font-sans overflow-hidden">
      <CommandHeader />
      {location.pathname !== '/' && <TacticalStepperHeader />}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col bg-[#F8FAFC] dark:bg-[#050811] overflow-hidden">
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/intake" element={<IntakeView />} />
            <Route path="/linkage" element={<LinkageView />} />
            <Route path="/investigation" element={<InvestigationView />} />
            <Route path="/subpoenas" element={<SubpoenasView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/admin" element={<AdminView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { theme, setTheme } = useUIStore();

  React.useEffect(() => {
    setTheme(theme);
  }, []);

  return (
    <AutoTranslateProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </Router>
    </AutoTranslateProvider>
  );
}
