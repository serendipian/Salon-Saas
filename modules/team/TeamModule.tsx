
import React, { useState } from 'react';
import { Users, BarChart2 } from 'lucide-react';
import { ViewState, StaffMember } from '../../types';
import { useTeam } from './hooks/useTeam';
import { useAppointments } from '../appointments/hooks/useAppointments';
import { TeamList } from './components/TeamList';
import { TeamForm } from './components/TeamForm';
import { TeamPerformance } from './components/TeamPerformance';

type Tab = 'members' | 'performance';

export const TeamModule: React.FC = () => {
  const { team, allStaff, searchTerm, setSearchTerm, loadStaffPii, addStaffMember, updateStaffMember } = useTeam();
  const { allAppointments: appointments } = useAppointments();
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('members');

  const handleAdd = () => {
    setSelectedMember(null);
    setView('ADD');
  };

  const handleEdit = async (id: string) => {
    const base = allStaff.find(m => m.id === id);
    if (!base) return;
    try {
      const pii = await loadStaffPii(id);
      setSelectedMember({ ...base, ...pii });
    } catch {
      setSelectedMember(base);
    }
    setView('EDIT');
  };

  const handleSave = (member: StaffMember) => {
    if (selectedMember) {
      updateStaffMember(member);
    } else {
      addStaffMember(member);
    }
    setView('LIST');
  };

  const isFormView = view === 'ADD' || view === 'EDIT';

  return (
    <div className="w-full">
      {/* Tabs — hidden when form is open */}
      {!isFormView && (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'members'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={15} />
            Membres
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'performance'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 size={15} />
            Performance
          </button>
        </div>
      )}

      {/* Members tab */}
      {!isFormView && activeTab === 'members' && (
        <TeamList
          team={team}
          appointments={appointments}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd}
          onEdit={handleEdit}
        />
      )}

      {/* Performance tab */}
      {!isFormView && activeTab === 'performance' && (
        <TeamPerformance staff={allStaff} />
      )}

      {/* Add / Edit form */}
      {isFormView && (
        <TeamForm
          existingMember={selectedMember ?? undefined}
          onSave={handleSave}
          onCancel={() => setView('LIST')}
        />
      )}
    </div>
  );
};
