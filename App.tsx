import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

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
          <ProtectedRoute action="view" resource="dashboard"><DashboardModule /></ProtectedRoute>
        } />
        <Route path="/services" element={
          <ProtectedRoute action="view" resource="services"><ServicesModule /></ProtectedRoute>
        } />
        <Route path="/clients" element={
          <ProtectedRoute action="view" resource="clients"><ClientsModule /></ProtectedRoute>
        } />
        <Route path="/team" element={
          <ProtectedRoute action="view" resource="team"><TeamModule /></ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute action="view" resource="appointments"><AppointmentsModule /></ProtectedRoute>
        } />
        <Route path="/products" element={
          <ProtectedRoute action="view" resource="products"><ProductsModule /></ProtectedRoute>
        } />
        <Route path="/suppliers" element={
          <ProtectedRoute action="view" resource="suppliers"><SuppliersModule /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute action="view" resource="settings"><SettingsModule /></ProtectedRoute>
        } />
        <Route path="/pos" element={
          <ProtectedRoute action="view" resource="pos"><POSModule /></ProtectedRoute>
        } />
        <Route path="/accounting" element={
          <ProtectedRoute action="view" resource="accounting"><AccountingModule /></ProtectedRoute>
        } />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
