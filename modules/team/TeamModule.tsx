
import React, { useState } from 'react';
import { ViewState, StaffMember } from '../../types';
import { useTeam } from './hooks/useTeam';
import { TeamList } from './components/TeamList';
import { TeamForm } from './components/TeamForm';

export const TeamModule: React.FC = () => {
  const { team, searchTerm, setSearchTerm, addStaffMember, updateStaffMember, getMemberStats } = useTeam();
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedMemberId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedMemberId(id);
    setView('EDIT');
  };

  const handleSave = (member: StaffMember) => {
    if (selectedMemberId) {
      updateStaffMember(member);
    } else {
      addStaffMember(member);
    }
    setView('LIST');
  };

  return (
    <div className="w-full">
      {view === 'LIST' && (
        <TeamList 
          team={team} 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd} 
          onEdit={handleEdit}
          getStats={getMemberStats}
        />
      )}
      {(view === 'ADD' || view === 'EDIT') && (
        <TeamForm 
          existingMember={team.find(m => m.id === selectedMemberId)} 
          onSave={handleSave}
          onCancel={() => setView('LIST')}
        />
      )}
    </div>
  );
};
