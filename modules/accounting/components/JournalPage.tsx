import React, { useState, useMemo } from 'react';
import { Search, Download, FileText, Database } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { MiniKpiRow } from './MiniKpiRow';
import { AccountingLedger } from './AccountingLedger';
import type { FinancesOutletContext } from '../FinancesLayout';

export const JournalPage: React.FC = () => {
  const { ledgerData, financials } = useOutletContext<FinancesOutletContext>();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Filter ledger data
  const filteredLedger = useMemo(() => {
    let data = ledgerData;
    if (filterType !== 'ALL') {
      data = data.filter(e => e.type === filterType);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(e => e.label.toLowerCase().includes(term));
    }
    return data;
  }, [ledgerData, filterType, searchTerm]);

  const totalCredit = ledgerData.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const totalDebit = ledgerData.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);

  const handleExportCSV = () => {
    const headers = 'Date,Type,Libellé,Catégorie,Débit,Crédit\n';
    const rows = ledgerData.map(e =>
      `${new Date(e.date).toLocaleDateString('fr-FR')},${e.type === 'INCOME' ? 'Recette' : 'Dépense'},"${e.label}","${e.category}",${e.type === 'EXPENSE' ? e.amount : ''},${e.type === 'INCOME' ? e.amount : ''}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <MiniKpiRow items={[
        { title: 'Total Crédit', value: totalCredit },
        { title: 'Total Débit', value: totalDebit },
        { title: 'Solde Net', value: totalCredit - totalDebit },
      ]} />

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { id: 'ALL' as const, label: 'Tous' },
            { id: 'INCOME' as const, label: 'Recettes' },
            { id: 'EXPENSE' as const, label: 'Dépenses' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterType === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Export dropdown */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={16} /> Exporter
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-10">
                <button onClick={handleExportCSV} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  <FileText size={16} className="text-blue-500" /> Télécharger CSV
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed">
                  <Database size={16} className="text-slate-300" /> Générer fichier FEC
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ledger table */}
      <AccountingLedger data={filteredLedger} />
    </div>
  );
};
