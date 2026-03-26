
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';

// Modular Imports
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
  
  // Extract current module from path for sidebar highlighting
  const currentModule = location.pathname.substring(1) || 'dashboard';

  return (
    <Layout activeModule={currentModule} onNavigate={(path) => navigate(`/${path}`)}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardModule />} />
        <Route path="/services" element={<ServicesModule />} />
        <Route path="/clients" element={<ClientsModule />} />
        <Route path="/team" element={<TeamModule />} />
        <Route path="/calendar" element={<AppointmentsModule />} />
        <Route path="/products" element={<ProductsModule />} />
        <Route path="/suppliers" element={<SuppliersModule />} />
        <Route path="/settings" element={<SettingsModule />} />
        <Route path="/pos" element={<POSModule />} />
        <Route path="/accounting" element={<AccountingModule />} />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppProvider>
  );
}
