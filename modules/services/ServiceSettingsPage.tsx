import { ArrowLeft, Layers, Package, Settings, Star } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CategoriesTab } from './components/CategoriesTab';
import { FavoritesTab } from './components/FavoritesTab';
import { GeneralTab } from './components/GeneralTab';
import { PacksTab } from './components/PacksTab';

type Tab = 'favorites' | 'packs' | 'categories' | 'general';

export function ServiceSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('favorites');

  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div>
        <button
          onClick={() => navigate('/services')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Services
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres des services</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('favorites')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'favorites'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Star size={16} />
            Favoris
          </button>
          <button
            onClick={() => setActiveTab('packs')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'packs'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package size={16} />
            Packs
          </button>
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
      {activeTab === 'favorites' && <FavoritesTab />}
      {activeTab === 'packs' && <PacksTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'general' && <GeneralTab />}
    </div>
  );
}
