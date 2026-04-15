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
import { ServiceSettingsPage } from './modules/services/ServiceSettingsPage';
import { ClientsModule } from './modules/clients/ClientsModule';
import { TeamModule } from './modules/team/TeamModule';
import { TeamListPage } from './modules/team/pages/TeamListPage';
import { NewStaffPage } from './modules/team/pages/NewStaffPage';
import { StaffDetailPage } from './modules/team/pages/StaffDetailPage';
import { ProductsModule } from './modules/products/ProductsModule';
import { ProductSettingsPage } from './modules/products/ProductSettingsPage';
import { AppointmentsModule } from './modules/appointments/AppointmentsModule';
import { AppointmentListPage } from './modules/appointments/pages/AppointmentListPage';
import { AppointmentDetailPage } from './modules/appointments/pages/AppointmentDetailPage';
import { AppointmentEditPage } from './modules/appointments/pages/AppointmentEditPage';
import { AppointmentNewPage } from './modules/appointments/pages/AppointmentNewPage';
import { SuppliersModule } from './modules/suppliers/SuppliersModule';
import { SupplierSettingsPage } from './modules/suppliers/SupplierSettingsPage';
import { SettingsModule } from './modules/settings/SettingsModule';
import { SettingsIndexPage } from './modules/settings/pages/SettingsIndexPage';
import { SettingsPlaceholderPage } from './modules/settings/pages/SettingsPlaceholderPage';
import { GeneralSettings } from './modules/settings/components/GeneralSettings';
import { AccountingSettings } from './modules/settings/components/AccountingSettings';
import { OpeningHoursSettings } from './modules/settings/components/OpeningHoursSettings';
import { TeamPermissionsSettings } from './modules/settings/components/TeamPermissionsSettings';
import { BillingModule } from './modules/billing/BillingModule';
import { POSModule } from './modules/pos/POSModule';
import { TransactionHistoryPage } from './modules/pos/TransactionHistoryPage';
import { FinancesLayout } from './modules/accounting/FinancesLayout';
import { FinancesOverview } from './modules/accounting/components/FinancesOverview';
import { RevenuesPage } from './modules/accounting/components/RevenuesPage';
import { DepensesPage } from './modules/accounting/components/DepensesPage';
import { JournalPage } from './modules/accounting/components/JournalPage';
import { RefundsPage } from './modules/accounting/components/RefundsPage';

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentModule = location.pathname.substring(1) || 'dashboard';

  return (
    <Layout activeModule={currentModule} onNavigate={(path) => navigate(`/${path}`)}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute action="view" resource="dashboard">
              <ErrorBoundary moduleName="Tableau de bord">
                <DashboardModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/services"
          element={
            <ProtectedRoute action="view" resource="services">
              <ErrorBoundary moduleName="Services">
                <ServicesModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/services/settings"
          element={
            <ProtectedRoute action="edit" resource="services">
              <ErrorBoundary moduleName="Paramètres des services">
                <ServiceSettingsPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute action="view" resource="clients">
              <ErrorBoundary moduleName="Clients">
                <ClientsModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/team"
          element={
            <ProtectedRoute action="view" resource="team">
              <ErrorBoundary moduleName="Équipe">
                <TeamModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<TeamListPage />} />
          <Route path="new" element={<NewStaffPage />} />
          <Route path=":slug" element={<StaffDetailPage />} />
        </Route>
        <Route
          path="/calendar"
          element={
            <ProtectedRoute action="view" resource="appointments">
              <ErrorBoundary moduleName="Rendez-vous">
                <AppointmentsModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<AppointmentListPage />} />
          <Route path="new" element={<AppointmentNewPage />} />
          <Route path=":id" element={<AppointmentDetailPage />} />
          <Route path=":id/edit" element={<AppointmentEditPage />} />
        </Route>
        <Route
          path="/products"
          element={
            <ProtectedRoute action="view" resource="products">
              <ErrorBoundary moduleName="Produits">
                <ProductsModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/settings"
          element={
            <ProtectedRoute action="edit" resource="products">
              <ErrorBoundary moduleName="Paramètres des produits">
                <ProductSettingsPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute action="view" resource="suppliers">
              <ErrorBoundary moduleName="Fournisseurs">
                <SuppliersModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/settings"
          element={
            <ProtectedRoute action="edit" resource="suppliers">
              <ErrorBoundary moduleName="Paramètres des fournisseurs">
                <SupplierSettingsPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute action="view" resource="settings">
              <ErrorBoundary moduleName="Paramètres">
                <SettingsModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<SettingsIndexPage />} />
          <Route path="general" element={<GeneralSettings />} />
          <Route path="billing" element={<BillingModule />} />
          <Route path="schedule" element={<OpeningHoursSettings />} />
          <Route path="accounting" element={<AccountingSettings />} />
          <Route path="team" element={<TeamPermissionsSettings />} />
          <Route path=":section" element={<SettingsPlaceholderPage />} />
        </Route>
        <Route
          path="/pos"
          element={
            <ProtectedRoute action="view" resource="pos">
              <ErrorBoundary moduleName="Caisse">
                <POSModule />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos/historique"
          element={
            <ProtectedRoute action="view" resource="pos">
              <ErrorBoundary moduleName="Historique">
                <TransactionHistoryPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/finances"
          element={
            <ProtectedRoute action="view" resource="accounting">
              <ErrorBoundary moduleName="Finances">
                <FinancesLayout />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<FinancesOverview />} />
          <Route path="revenus" element={<RevenuesPage />} />
          <Route path="depenses" element={<DepensesPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="annulations" element={<RefundsPage />} />
        </Route>
        <Route
          path="/profile"
          element={
            <ErrorBoundary moduleName="Profil">
              <ProfilePage />
            </ErrorBoundary>
          }
        />
        {/* Redirect old route */}
        <Route path="/accounting" element={<Navigate to="/finances" replace />} />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary moduleName="Application">
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
                <Route
                  path="/create-salon"
                  element={
                    <AuthRequired>
                      <CreateSalonPage />
                    </AuthRequired>
                  }
                />
                <Route
                  path="/select-salon"
                  element={
                    <AuthRequired>
                      <SalonPickerPage />
                    </AuthRequired>
                  }
                />

                {/* Admin routes — own layout, own guard, outside salon Layout */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <ErrorBoundary moduleName="Admin">
                        <AdminLayout />
                      </ErrorBoundary>
                    </AdminRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="accounts" element={<AdminAccountList />} />
                  <Route path="accounts/:id" element={<AdminAccountDetail />} />
                  <Route path="trials" element={<AdminTrialsPipeline />} />
                  <Route path="billing" element={<AdminFailedPayments />} />
                  <Route path="signups" element={<AdminRecentSignups />} />
                  <Route path="churn" element={<AdminChurnLog />} />
                </Route>

                {/* Protected app routes */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AppContent />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </BrowserRouter>
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </MediaQueryProvider>
    </ErrorBoundary>
  );
}
