import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/Toast';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// Auth pages
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { CreateSalonPage } from './pages/CreateSalonPage';
import { SalonPickerPage } from './pages/SalonPickerPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';

// Module imports (unchanged)
import { DashboardModule } from './modules/dashboard/DashboardModule';
import { ServicesModule } from './modules/services/ServicesModule';
import { ClientsModule } from './modules/clients/ClientsModule';
import { TeamModule } from './modules/team/TeamModule';
import { ProductsModule } from './modules/products/ProductsModule';
import { AppointmentsModule } from './modules/appointments/AppointmentsModule';
import { SuppliersModule } from './modules/suppliers/SuppliersModule';
import { SettingsModule } from './modules/settings/SettingsModule';
import { AccountingModule } from './modules/accounting/AccountingModule';
import { POSModule } from './modules/pos/POSModule';

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentModule = location.pathname.substring(1) || 'dashboard';

  return (
    <Layout activeModule={currentModule} onNavigate={(path) => navigate(`/${path}`)}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          <ProtectedRoute action="view" resource="dashboard">
            <ErrorBoundary moduleName="Tableau de bord"><DashboardModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/services" element={
          <ProtectedRoute action="view" resource="services">
            <ErrorBoundary moduleName="Services"><ServicesModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/clients" element={
          <ProtectedRoute action="view" resource="clients">
            <ErrorBoundary moduleName="Clients"><ClientsModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/team" element={
          <ProtectedRoute action="view" resource="team">
            <ErrorBoundary moduleName="Équipe"><TeamModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute action="view" resource="appointments">
            <ErrorBoundary moduleName="Rendez-vous"><AppointmentsModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/products" element={
          <ProtectedRoute action="view" resource="products">
            <ErrorBoundary moduleName="Produits"><ProductsModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/suppliers" element={
          <ProtectedRoute action="view" resource="suppliers">
            <ErrorBoundary moduleName="Fournisseurs"><SuppliersModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute action="view" resource="settings">
            <ErrorBoundary moduleName="Paramètres"><SettingsModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/pos" element={
          <ProtectedRoute action="view" resource="pos">
            <ErrorBoundary moduleName="Caisse"><POSModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/accounting" element={
          <ProtectedRoute action="view" resource="accounting">
            <ErrorBoundary moduleName="Comptabilité"><AccountingModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

            {/* Auth-required, no-salon routes */}
            <Route path="/create-salon" element={<CreateSalonPage />} />
            <Route path="/select-salon" element={<SalonPickerPage />} />

            {/* Protected app routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            } />
          </Routes>
        </HashRouter>
        <ToastContainer />
      </ToastProvider>
    </AuthProvider>
  );
}
