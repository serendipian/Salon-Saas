
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  ArrowLeft, 
  Save,
  ChevronRight,
  Printer
} from 'lucide-react';
import { Appointment, AppointmentStatus, ViewState } from '../types';
import { useAppContext } from '../context/AppContext';

// Export Mock Data for Context Initializer
export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt1',
    clientId: 'c1',
    clientName: 'Sophie Martin',
    serviceId: 'srv1',
    serviceName: 'Coupe Brushing - Cheveux Longs',
    date: '2023-11-15T14:00:00',
    durationMinutes: 45,
    staffId: 'st1',
    staffName: 'Marie Dupont',
    status: AppointmentStatus.COMPLETED,
    price: 65,
    notes: 'Cliente en avance.'
  },
  {
    id: 'apt2',
    clientId: 'c3',
    clientName: 'Claire Lefebvre',
    serviceId: 'srv2',
    serviceName: 'Soin Hydratant Intense',
    date: '2023-11-16T10:00:00',
    durationMinutes: 60,
    staffId: 'st2',
    staffName: 'Julie Dubois',
    status: AppointmentStatus.SCHEDULED,
    price: 90
  },
  {
    id: 'apt3',
    clientId: 'c2',
    clientName: 'Julie Dubois',
    serviceId: 'srv1',
    serviceName: 'Coupe Brushing - Court',
    date: '2023-11-10T16:30:00',
    durationMinutes: 30,
    staffId: 'st1',
    staffName: 'Marie Dupont',
    status: AppointmentStatus.CANCELLED,
    price: 45,
    notes: 'Annulé par téléphone.'
  }
];

// --- Component ---

export const AppointmentsModule: React.FC = () => {
  const { appointments, addAppointment, updateAppointment } = useAppContext();
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedApptId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedApptId(id);
    setView('EDIT');
  };

  const handleDetails = (id: string) => {
    setSelectedApptId(id);
    setView('DETAILS');
  };

  const handleSave = (appt: Appointment) => {
    if (selectedApptId && view === 'EDIT') {
      updateAppointment(appt);
      setView('DETAILS');
    } else {
      addAppointment(appt);
      setView('LIST');
    }
  };

  const selectedAppt = appointments.find(a => a.id === selectedApptId);

  return (
    <div className="h-full flex flex-col w-full pb-10">
      {view === 'LIST' && (
        <AppointmentList 
          appointments={appointments} 
          onAdd={handleAdd} 
          onDetails={handleDetails}
        />
      )}

      {view === 'DETAILS' && selectedAppt && (
        <AppointmentDetails 
          appointment={selectedAppt} 
          onBack={() => setView('LIST')}
          onEdit={() => setView('EDIT')}
        />
      )}

      {(view === 'ADD' || view === 'EDIT') && (
        <AppointmentForm 
          existingAppointment={view === 'EDIT' ? selectedAppt : undefined}
          onSave={handleSave}
          onCancel={() => view === 'EDIT' ? setView('DETAILS') : setView('LIST')}
        />
      )}
    </div>
  );
};

// --- Sub Components ---

const StatusBadge = ({ status }: { status: AppointmentStatus }) => {
  const styles = {
    [AppointmentStatus.SCHEDULED]: 'bg-blue-50 text-blue-700 border-blue-100',
    [AppointmentStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    [AppointmentStatus.CANCELLED]: 'bg-slate-100 text-slate-600 border-slate-200',
    [AppointmentStatus.NO_SHOW]: 'bg-orange-50 text-orange-700 border-orange-100',
  };

  const labels = {
    [AppointmentStatus.SCHEDULED]: 'Planifié',
    [AppointmentStatus.COMPLETED]: 'Terminé',
    [AppointmentStatus.CANCELLED]: 'Annulé',
    [AppointmentStatus.NO_SHOW]: 'No Show',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${styles[status]} flex items-center gap-1.5 w-fit shadow-sm`}>
      {labels[status]}
    </span>
  );
};

const AppointmentList: React.FC<{ 
  appointments: Appointment[], 
  onAdd: () => void,
  onDetails: (id: string) => void
}> = ({ appointments, onAdd, onDetails }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = appointments.filter(a => {
    const matchesSearch = a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort by date descending
  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Rendez-vous</h1>
        <button 
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau RDV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[calc(100vh-12rem)]">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm shadow-sm cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value={AppointmentStatus.SCHEDULED}>Planifié</option>
            <option value={AppointmentStatus.COMPLETED}>Terminé</option>
            <option value={AppointmentStatus.CANCELLED}>Annulé</option>
          </select>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 shadow-sm z-10 border-b border-slate-200">
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-3">Date & Heure</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Service & Staff</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Prix</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((appt) => {
                const date = new Date(appt.date);
                return (
                  <tr key={appt.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onDetails(appt.id)}>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 capitalize text-sm">
                          {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-xs text-slate-500">
                          {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="font-medium text-slate-900 text-sm">{appt.clientName}</div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col gap-1">
                         <div className="text-sm font-medium text-slate-800">{appt.serviceName}</div>
                         <div className="text-xs text-slate-500 flex items-center gap-1">
                           <User size={12} /> {appt.staffName}
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <StatusBadge status={appt.status} />
                    </td>
                    <td className="px-6 py-4 align-top text-sm font-medium text-slate-900">
                      {appt.price} €
                    </td>
                    <td className="px-6 py-4 align-top text-right">
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
    </div>
  );
};

const AppointmentDetails: React.FC<{ 
  appointment: Appointment, 
  onBack: () => void,
  onEdit: () => void
}> = ({ appointment, onBack, onEdit }) => {
  const date = new Date(appointment.date);

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Détails du Rendez-vous</h1>
        <div className="ml-auto flex gap-3">
           <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2">
             <Printer size={16} />
             Imprimer Ticket
           </button>
           <button 
            onClick={onEdit}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 shadow-sm transition-all"
          >
            Modifier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex justify-between items-start">
           <div>
             <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Référence # {appointment.id.toUpperCase()}</div>
             <h2 className="text-xl font-bold text-slate-900 mb-2">{appointment.serviceName}</h2>
             <StatusBadge status={appointment.status} />
           </div>
           <div className="text-right">
             <div className="text-2xl font-bold text-slate-900">{appointment.price} €</div>
             <div className="text-sm text-slate-500">{appointment.durationMinutes} min</div>
           </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
             <div className="flex gap-4 items-start">
               <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                 <Calendar size={20} />
               </div>
               <div>
                 <div className="text-sm font-medium text-slate-500">Date & Heure</div>
                 <div className="font-semibold text-slate-900">
                    {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                 </div>
                 <div className="text-slate-600">
                    {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                 </div>
               </div>
             </div>

             <div className="flex gap-4 items-start">
               <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                 <User size={20} />
               </div>
               <div>
                 <div className="text-sm font-medium text-slate-500">Client</div>
                 <div className="font-semibold text-slate-900">{appointment.clientName}</div>
                 <button className="text-sm text-slate-900 underline hover:text-slate-600 font-medium cursor-pointer">Voir le profil</button>
               </div>
             </div>

             <div className="flex gap-4 items-start">
               <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                 <Scissors size={20} />
               </div>
               <div>
                 <div className="text-sm font-medium text-slate-500">Réalisé par</div>
                 <div className="font-semibold text-slate-900">{appointment.staffName}</div>
               </div>
             </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200/60">
             <h3 className="font-bold text-slate-900 text-sm mb-3 uppercase tracking-wide">Notes internes</h3>
             <p className="text-sm text-slate-600 italic leading-relaxed">
               {appointment.notes || "Aucune note pour ce rendez-vous."}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppointmentForm: React.FC<{ 
  existingAppointment?: Appointment, 
  onSave: (a: Appointment) => void,
  onCancel: () => void
}> = ({ existingAppointment, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Appointment>>(existingAppointment || {
    date: new Date().toISOString().slice(0, 16),
    clientName: '',
    serviceName: '',
    staffName: '',
    status: AppointmentStatus.SCHEDULED,
    price: 0,
    durationMinutes: 30
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Appointment);
  };

  return (
    <div className="max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
       <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingAppointment ? 'Modifier le Rendez-vous' : 'Nouveau Rendez-vous'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
         <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date & Heure</label>
              <input 
                type="datetime-local"
                required
                value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ''}
                onChange={e => setFormData({...formData, date: new Date(e.target.value).toISOString()})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Statut</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as AppointmentStatus})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white text-sm shadow-sm"
              >
                <option value={AppointmentStatus.SCHEDULED}>Planifié</option>
                <option value={AppointmentStatus.COMPLETED}>Terminé</option>
                <option value={AppointmentStatus.CANCELLED}>Annulé</option>
                <option value={AppointmentStatus.NO_SHOW}>No Show</option>
              </select>
            </div>
         </div>

         <div>
           <label className="block text-sm font-medium text-slate-700 mb-1.5">Client (Recherche)</label>
           <input 
              value={formData.clientName}
              onChange={e => setFormData({...formData, clientName: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white placeholder:text-slate-400"
              placeholder="Nom du client..."
           />
         </div>

         <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Service</label>
              <input 
                value={formData.serviceName}
                onChange={e => setFormData({...formData, serviceName: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white placeholder:text-slate-400"
                placeholder="Service..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Prix (€)</label>
              <input 
                type="number"
                value={formData.price}
                onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
              />
            </div>
         </div>
         
         <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Praticien / Staff</label>
            <select 
              value={formData.staffName}
              onChange={e => setFormData({...formData, staffName: e.target.value})}
               className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white text-sm shadow-sm"
            >
              <option value="">Sélectionner...</option>
              <option value="Marie Dupont">Marie Dupont</option>
              <option value="Julie Dubois">Julie Dubois</option>
            </select>
         </div>

         <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea 
            rows={3}
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white placeholder:text-slate-400"
            placeholder="Détails supplémentaires..."
          />
        </div>

        <div className="pt-4 flex gap-3 border-t border-slate-100 mt-2">
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm shadow-sm"
          >
            Annuler
          </button>
          <button 
            type="submit"
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
          >
            <Save size={16} />
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
};
