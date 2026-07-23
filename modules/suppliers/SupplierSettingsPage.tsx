import { Layers, Settings } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SupplierCategoriesTab } from './components/SupplierCategoriesTab';
import { SupplierGeneralTab } from './components/SupplierGeneralTab';

type Tab = 'categories' | 'general';

export function SupplierSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categories');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres des fournisseurs"
        backTo="/suppliers"
        backLabel="Retour aux fournisseurs"
      />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('categories')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers size={16} />
            Catégories
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings size={16} />
            Général
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'categories' ? <SupplierCategoriesTab /> : <SupplierGeneralTab />}
    </div>
  );
}
