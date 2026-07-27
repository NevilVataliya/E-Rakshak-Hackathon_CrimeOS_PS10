import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import { useAuthStore } from './store/authStore';

import DashboardPage from './pages/DashboardPage';
import ComplaintsPage from './pages/ComplaintsPage';
import InvestigationPage from './pages/InvestigationPage';
import RequestsPage from './pages/RequestsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
      <Navbar user={user} onLogout={logout} />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100vh-4rem)] p-6 overflow-x-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <Routes>
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/complaints" element={<ProtectedRoute><ComplaintsPage /></ProtectedRoute>} />
            <Route path="/investigation" element={<ProtectedRoute><InvestigationPage /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
