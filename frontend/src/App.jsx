import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import KDS from './pages/KDS';
import Mesero from './pages/Mesero';
import AdminUsers from './pages/AdminUsers';
import AdminInventory from './pages/AdminInventory';
import Reports from './pages/Reports';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-pikta-bg">
        <div className="text-pikta-info animate-pulse text-xl">Cargando PIK'TA...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={
          <ProtectedRoute roles={['Administrador', 'Supervisor', 'Cajera']}>
            <POS />
          </ProtectedRoute>
        } />
        <Route path="/kds" element={
          <ProtectedRoute roles={['Administrador', 'Supervisor', 'Cocina']}>
            <KDS />
          </ProtectedRoute>
        } />
        <Route path="/mesero" element={
          <ProtectedRoute roles={['Administrador', 'Supervisor', 'Mesero']}>
            <Mesero />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['Administrador']}>
            <AdminUsers />
          </ProtectedRoute>
        } />
        <Route path="/admin/inventory" element={
          <ProtectedRoute roles={['Administrador', 'Supervisor']}>
            <AdminInventory />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute roles={['Administrador', 'Supervisor']}>
            <Reports />
          </ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
