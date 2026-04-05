import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Settings } from 'lucide-react';
import { ProductCategoriesTab } from './components/ProductCategoriesTab';
import { ProductGeneralTab } from './components/ProductGeneralTab';

type Tab = 'categories' | 'general';

export function ProductSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('categories');

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
      {activeTab === 'categories' ? <ProductCategoriesTab /> : <ProductGeneralTab />}
    </div>
  );
}
