import { ArrowLeft, Layers, Settings, Tag } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandsTab } from './components/BrandsTab';
import { ProductCategoriesTab } from './components/ProductCategoriesTab';
import { ProductGeneralTab } from './components/ProductGeneralTab';

type Tab = 'categories' | 'brands' | 'general';

export function ProductSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('categories');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'categories', label: 'Catégories', icon: <Layers size={16} /> },
    { key: 'brands', label: 'Marques', icon: <Tag size={16} /> },
    { key: 'general', label: 'Général', icon: <Settings size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div>
        <button
          onClick={() => navigate('/products')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Produits
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres des produits</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'categories' && <ProductCategoriesTab />}
      {activeTab === 'brands' && <BrandsTab />}
      {activeTab === 'general' && <ProductGeneralTab />}
    </div>
  );
}
