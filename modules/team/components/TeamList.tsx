
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Award, 
  LayoutGrid, 
  List,
  ChevronRight
} from 'lucide-react';
import { StaffMember, Appointment } from '../../../types';

interface TeamListProps {
  team: StaffMember[];
  appointments: Appointment[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const TeamList: React.FC<TeamListProps> = ({ team, appointments, searchTerm, onSearchChange, onAdd, onEdit }) => {
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

  const getMemberStats = (memberId: string) => {
    const memberAppointments = appointments.filter(a => a.staffId === memberId);
    const today = new Date().toISOString().slice(0, 10);
    const todaysAppointments = memberAppointments.filter(a => a.date.startsWith(today));
    const totalRevenue = memberAppointments.reduce((sum, a) => sum + a.price, 0);
    return {
      totalAppointments: memberAppointments.length,
      todayCount: todaysAppointments.length,
      totalRevenue,
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Équipe</h1>
        <div className="flex items-center gap-3">
           <div className="flex bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
              <button 
                onClick={() => setViewMode('GRID')}
                className={`p-2 rounded-md transition-all ${viewMode === 'GRID' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vue Grille"
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('LIST')}
                className={`p-2 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vue Liste"
              >
                <List size={18} />
              </button>
           </div>
           <button 
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nouveau Membre</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative flex-1 max-w-md ml-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher un membre..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-900 outline-none text-sm transition-all"
            />
         </div>
      </div>

      {viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {team.map((member) => {
            const stats = getMemberStats(member.id);
            const initials = `${member.firstName[0]}${member.lastName[0]}`;
            
            return (
              <div 
                key={member.id} 
                onClick={() => onEdit(member.id)}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer overflow-hidden group"
              >
                <div className={`h-2 ${member.color}`}></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600 border-2 border-white shadow-sm relative overflow-hidden">
                           {member.photoUrl ? (
                             <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                           ) : (
                             initials
                           )}
                           <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${member.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        </div>
                        <div>
                           <h3 className="font-bold text-slate-900 text-lg">{member.firstName} {member.lastName}</h3>
                           <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                             {member.role}
                           </span>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2 mb-6">
                     <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Mail size={14} /> {member.email}
                     </div>
                     <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Phone size={14} /> {member.phone}
                     </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                     <div className="text-center">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-1">RDV Auj.</div>
                        <div className="font-bold text-slate-900">{stats.todayCount}</div>
                     </div>
                     <div className="text-center border-l border-slate-100">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-1">Total</div>
                        <div className="font-bold text-slate-900">{stats.totalAppointments}</div>
                     </div>
                     <div className="text-center border-l border-slate-100">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-1">Com.</div>
                        <div className="font-bold text-slate-900">{member.commissionRate}%</div>
                     </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Membre</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Activité</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Commission</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {team.map((member) => {
                  const stats = getMemberStats(member.id);
                  const initials = `${member.firstName[0]}${member.lastName[0]}`;
                  
                  return (
                    <tr 
                      key={member.id} 
                      onClick={() => onEdit(member.id)}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-slate-200 relative overflow-hidden shrink-0">
                             {member.photoUrl ? (
                               <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                             ) : (
                               initials
                             )}
                          </div>
                          <div>
                             <div className="font-bold text-slate-900 text-sm">{member.firstName} {member.lastName}</div>
                             <div className="text-xs text-slate-500">{member.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 flex flex-col gap-1">
                           <span className="flex items-center gap-2"><Phone size={14} /> {member.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center justify-center gap-4 text-center">
                            <div>
                               <div className="font-bold text-slate-900 text-sm">{stats.todayCount}</div>
                               <div className="text-[10px] text-slate-400 uppercase">Auj.</div>
                            </div>
                            <div className="w-px h-6 bg-slate-200"></div>
                            <div>
                               <div className="font-bold text-slate-900 text-sm">{stats.totalAppointments}</div>
                               <div className="text-[10px] text-slate-400 uppercase">Total</div>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-sm font-bold text-slate-900">{member.commissionRate}%</span>
                      </td>
                      <td className="px-6 py-4">
                         {member.active ? (
                           <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                             Actif
                           </span>
                         ) : (
                           <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                             Inactif
                           </span>
                         )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
