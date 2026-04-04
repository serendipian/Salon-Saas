import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MediaQueryProvider } from './context/MediaQueryContext';
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
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { useAuth } from './context/AuthContext';
import { AdminRoute } from './components/AdminRoute';
import { AdminLayout } from './components/AdminLayout';
import { AdminDashboard } from './modules/admin/components/AdminDashboard';
import { AdminAccountList } from './modules/admin/components/AdminAccountList';
import { AdminAccountDetail } from './modules/admin/components/AdminAccountDetail';
import { AdminTrialsPipeline } from './modules/admin/components/AdminTrialsPipeline';
import { AdminFailedPayments } from './modules/admin/components/AdminFailedPayments';
import { AdminRecentSignups } from './modules/admin/components/AdminRecentSignups';
import { AdminChurnLog } from './modules/admin/components/AdminChurnLog';

// Lightweight auth guard — requires authentication but not an active salon
const AuthRequired: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Module imports (unchanged)
import { DashboardModule } from './modules/dashboard/DashboardModule';
import { ServicesModule } from './modules/services/ServicesModule';
import { ClientsModule } from './modules/clients/ClientsModule';
import { TeamModule } from './modules/team/TeamModule';
import { ProductsModule } from './modules/products/ProductsModule';
import { AppointmentsModule } from './modules/appointments/AppointmentsModule';
import { SuppliersModule } from './modules/suppliers/SuppliersModule';
import { SettingsModule } from './modules/settings/SettingsModule';
import { POSModule } from './modules/pos/POSModule';
import { FinancesLayout } from './modules/accounting/FinancesLayout';
import { FinancesOverview } from './modules/accounting/components/FinancesOverview';
import { RevenuesPage } from './modules/accounting/components/RevenuesPage';
import { DepensesPage } from './modules/accounting/components/DepensesPage';
import { JournalPage } from './modules/accounting/components/JournalPage';

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
        <Route path="/finances" element={
          <ProtectedRoute action="view" resource="accounting">
            <ErrorBoundary moduleName="Finances">
              <FinancesLayout />
            </ErrorBoundary>
          </ProtectedRoute>
        }>
          <Route index element={<FinancesOverview />} />
          <Route path="revenus" element={<RevenuesPage />} />
          <Route path="depenses" element={<DepensesPage />} />
          <Route path="journal" element={<JournalPage />} />
        </Route>
        <Route path="/profile" element={
          <ErrorBoundary moduleName="Profil"><ProfilePage /></ErrorBoundary>
        } />
        {/* Redirect old route */}
        <Route path="/accounting" element={<Navigate to="/finances" replace />} />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <MediaQueryProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

              {/* Auth-required, no-salon routes */}
              <Route path="/create-salon" element={<AuthRequired><CreateSalonPage /></AuthRequired>} />
              <Route path="/select-salon" element={<AuthRequired><SalonPickerPage /></AuthRequired>} />

              {/* Admin routes — own layout, own guard, outside salon Layout */}
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="accounts" element={<AdminAccountList />} />
                <Route path="accounts/:id" element={<AdminAccountDetail />} />
                <Route path="trials" element={<AdminTrialsPipeline />} />
                <Route path="billing" element={<AdminFailedPayments />} />
                <Route path="signups" element={<AdminRecentSignups />} />
                <Route path="churn" element={<AdminChurnLog />} />
              </Route>

              {/* Protected app routes */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <AppContent />
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </MediaQueryProvider>
  );
}
