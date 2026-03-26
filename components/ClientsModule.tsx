
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowLeft, 
  Save,
  Filter,
  ChevronRight,
  Camera,
  User,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Client, ViewState, AppointmentStatus, ClientPermissions } from '../types';
import { MOCK_APPOINTMENTS } from './AppointmentsModule';

// --- Mock Data ---
export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    firstName: 'Sophie',
    lastName: 'Martin',
    email: 'sophie.martin@example.com',
    phone: '06 12 34 56 78',
    city: 'Casablanca',
    status: 'VIP',
    totalVisits: 12,
    totalSpent: 850,
    lastVisitDate: '2023-10-15',
    notes: 'Allergique au latex. Préfère le thé vert.',
    createdAt: '2023-01-10',
    permissions: { socialMedia: true, marketing: true, other: false }
  },
  {
    id: 'c2',
    firstName: 'Julie',
    lastName: 'Dubois',
    email: 'j.dubois@test.com',
    phone: '07 98 76 54 32',
    city: 'Rabat',
    status: 'ACTIF',
    totalVisits: 3,
    totalSpent: 120,
    lastVisitDate: '2023-11-02',
    createdAt: '2023-08-15',
    permissions: { socialMedia: false, marketing: true, other: false }
  },
  {
    id: 'c3',
    firstName: 'Claire',
    lastName: 'Lefebvre',
    email: 'claire.l@domain.com',
    phone: '06 55 44 33 22',
    city: 'Marrakech',
    status: 'ACTIF',
    totalVisits: 25,
    totalSpent: 2100,
    lastVisitDate: '2023-11-10',
    notes: 'Cliente VIP. Toujours proposer les nouveautés.',
    createdAt: '2022-05-20',
    permissions: { socialMedia: true, marketing: false, other: false }
  }
];

// --- Main Container ---
export const ClientsModule: React.FC = () => {
  const [view, setView] = useState<ViewState>('LIST');
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedClientId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedClientId(id);
    setView('EDIT');
  };

  const handleViewDetails = (id: string) => {
    setSelectedClientId(id);
    setView('DETAILS');
  };

  const handleSave = (client: Client) => {
    if (selectedClientId && view === 'EDIT') {
      setClients(clients.map(c => c.id === client.id ? client : c));
      setView('DETAILS'); 
    } else {
      setClients([...clients, { ...client, id: `c${Date.now()}` }]);
      setView('LIST');
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="h-full w-full">
      {view === 'LIST' && (
        <ClientList 
          clients={clients} 
          onAdd={handleAdd} 
          onViewDetails={handleViewDetails}
        />
      )}
      
      {view === 'DETAILS' && selectedClient && (
        <ClientDetails 
          client={selectedClient} 
          onBack={() => setView('LIST')}
          onEdit={() => setView('EDIT')}
        />
      )}

      {(view === 'ADD' || view === 'EDIT') && (
        <ClientForm 
          existingClient={view === 'EDIT' ? selectedClient : undefined}
          onSave={handleSave}
          onCancel={() => view === 'EDIT' ? setView('DETAILS') : setView('LIST')}
        />
      )}
    </div>
  );
};

// --- Sub Components ---

const ClientList: React.FC<{ 
  clients: Client[], 
  onAdd: () => void, 
  onViewDetails: (id: string) => void 
}> = ({ clients, onAdd, onViewDetails }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = clients.filter(c => 
    c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <button 
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau Client
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher par nom, téléphone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <button className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 font-medium text-sm shadow-sm">
            <Filter size={16} />
            Filtres
          </button>
        </div>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ville</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Dépensé</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((client) => {
                const initials = `${client.firstName[0]}${client.lastName[0]}`;
                return (
                  <tr 
                    key={client.id} 
                    onClick={() => onViewDetails(client.id)}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{client.firstName} {client.lastName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Mail size={12} />
                          {client.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Phone size={12} />
                          {client.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {client.city || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {client.status === 'VIP' && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-bold">VIP</span>}
                      {client.status === 'ACTIF' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium">Actif</span>}
                      {client.status === 'INACTIF' && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-xs font-medium">Inactif</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="text-slate-900 font-medium text-sm">{client.totalSpent} €</span>
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
    </div>
  );
};

const ClientDetails: React.FC<{ 
  client: Client, 
  onBack: () => void,
  onEdit: () => void
}> = ({ client, onBack, onEdit }) => {
  const initials = `${client.firstName[0]}${client.lastName[0]}`;

  // Filter mock appointments for this client
  const clientAppointments = MOCK_APPOINTMENTS.filter(apt => apt.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Profil Client</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar: Profile Info */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-600 mb-4 border border-slate-200 relative overflow-hidden">
                {client.photoUrl ? (
                  <img src={client.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{client.firstName} {client.lastName}</h2>
            <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
               <MapPin size={12} />
               {client.city || 'Ville non renseignée'}
            </p>
            
            <div className="mb-6">
               {client.status === 'VIP' && <span className="px-3 py-1 bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-bold">VIP</span>}
               {(!client.status || client.status === 'ACTIF') && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">Client Actif</span>}
            </div>

            <button 
              onClick={onEdit}
              className="w-full py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors mb-6 shadow-sm"
            >
              Modifier le profil
            </button>

            <div className="w-full pt-4 border-t border-slate-100 flex justify-around">
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Visites</div>
                <div className="font-bold text-slate-900 text-lg">{client.totalVisits}</div>
              </div>
              <div className="h-10 w-px bg-slate-200"></div>
              <div className="text-center">
                 <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Total</div>
                 <div className="font-bold text-slate-900 text-lg">{client.totalSpent} €</div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-4">Coordonnées</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                   <Phone size={16} />
                </div>
                <div className="text-sm">
                  <div className="text-slate-900 font-medium">{client.phone}</div>
                  <div className="text-xs text-slate-500">Mobile</div>
                </div>
              </li>
              <li className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                 <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                   <Mail size={16} />
                </div>
                <div className="text-sm">
                   <div className="text-slate-900 font-medium break-all">{client.email}</div>
                   <div className="text-xs text-slate-500">Email</div>
                </div>
              </li>
            </ul>
          </div>

           {/* Notes */}
           <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
             <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">Notes privées</h3>
             <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 italic">
               {client.notes || "Aucune note pour le moment."}
             </p>
           </div>
        </div>

        {/* Main Content: History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Medical / Allergies Alert */}
          {client.allergies && (
             <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 items-start">
                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-red-800">Allergies & Contre-indications</h3>
                  <p className="text-sm text-red-700 mt-1">{client.allergies}</p>
                </div>
             </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Historique des commandes</h3>
              <button className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white px-3 py-1 rounded shadow-sm">Tout voir</button>
            </div>
            
            <div className="divide-y divide-slate-100">
              {clientAppointments.length > 0 ? (
                  clientAppointments.map((appt) => {
                    const isCompleted = appt.status === AppointmentStatus.COMPLETED;
                    return (
                      <div key={appt.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                           <div className="text-center min-w-[3.5rem] bg-slate-100 rounded p-1.5 border border-slate-200">
                              <div className="text-lg font-bold text-slate-900 leading-none">{new Date(appt.date).getDate()}</div>
                              <div className="text-[10px] uppercase text-slate-500 font-bold leading-none mt-1">{new Date(appt.date).toLocaleDateString('fr-FR', { month: 'short' })}</div>
                           </div>
                           <div>
                              <div className="text-sm font-bold text-slate-900">{appt.serviceName}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                 <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                                 {isCompleted ? 'Payé' : 'Planifié'} • {appt.staffName}
                              </div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-sm font-bold text-slate-900">{appt.price.toFixed(2)} €</div>
                        </div>
                      </div>
                    )
                  })
              ) : (
                <div className="p-12 text-center">
                  <p className="text-slate-500 text-sm">Aucune commande récente.</p>
                </div>
              )}
            </div>
          </div>
          
           {/* Detailed Info Grid */}
           <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-4">Informations Complémentaires</h3>
              <div className="grid grid-cols-2 gap-6 text-sm">
                 <div>
                    <span className="block text-slate-500 text-xs mb-1">Profession</span>
                    <span className="font-medium text-slate-800">{client.profession || '-'}</span>
                 </div>
                 <div>
                    <span className="block text-slate-500 text-xs mb-1">Société</span>
                    <span className="font-medium text-slate-800">{client.company || '-'}</span>
                 </div>
                 <div>
                    <span className="block text-slate-500 text-xs mb-1">Anniversaire</span>
                    <span className="font-medium text-slate-800">-</span>
                 </div>
                 <div>
                    <span className="block text-slate-500 text-xs mb-1">Genre</span>
                    <span className="font-medium text-slate-800">{client.gender || '-'}</span>
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

// --- Extended Client Form (CRM Style) ---
const ClientForm: React.FC<{ 
  existingClient?: Client, 
  onSave: (c: Client) => void,
  onCancel: () => void
}> = ({ existingClient, onSave, onCancel }) => {
  
  const [formData, setFormData] = useState<Partial<Client>>(existingClient || {
    firstName: '',
    lastName: '',
    gender: 'Femme',
    ageGroup: '26-35 ans',
    city: 'Casablanca',
    profession: '',
    company: '',
    notes: '',
    
    allergies: '',
    
    status: 'ACTIF',
    preferredStaffId: '',

    phone: '',
    email: '',
    socialNetwork: '',
    socialUsername: '',
    whatsapp: '',
    preferredChannel: 'WhatsApp',
    preferredLanguage: 'Français',
    otherChannelDetail: '',

    contactDate: new Date().toISOString().slice(0, 10),
    contactMethod: 'Walk-in',
    messageChannel: '',
    acquisitionSource: 'Passage',
    acquisitionDetail: '',

    permissions: {
      socialMedia: false,
      marketing: false,
      other: false
    },
    
    totalVisits: 0,
    totalSpent: 0,
    createdAt: new Date().toISOString()
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.firstName && formData.lastName) {
      onSave(formData as Client);
    }
  };

  const handlePermissionChange = (key: keyof ClientPermissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions!,
        [key]: !prev.permissions![key]
      }
    }));
  };

  return (
    <div className="w-full pb-10 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingClient ? 'Modifier le Client' : 'Nouveau Client'}
        </h1>
        <div className="ml-auto flex gap-3">
          <button 
             onClick={onCancel}
             className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
           >
             Annuler
           </button>
           <button 
             onClick={handleSubmit}
             className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
           >
             <Save size={16} />
             Enregistrer
           </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- LEFT COLUMN (2/3) --- */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* SECTION 1: Informations Principales */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3 mb-4">Informations Principales</h2>
             
             <div className="flex flex-col sm:flex-row gap-6 mb-6">
                {/* Photo Upload Mock */}
                <div className="flex flex-col items-center gap-2">
                   <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden group">
                      {formData.photoUrl ? (
                         <img src={formData.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                         <User size={32} className="text-slate-400" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                         <Camera className="text-white" size={24} />
                      </div>
                   </div>
                   <button type="button" className="text-xs text-red-500 hover:underline">Supprimer</button>
                </div>
                
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom <span className="text-red-500">*</span></label>
                     <input 
                       required
                       value={formData.firstName}
                       onChange={e => setFormData({...formData, firstName: e.target.value})}
                       className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm bg-white"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom <span className="text-red-500">*</span></label>
                     <input 
                       required
                       value={formData.lastName}
                       onChange={e => setFormData({...formData, lastName: e.target.value})}
                       className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm bg-white"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1.5">Genre</label>
                     <select 
                        value={formData.gender}
                        onChange={e => setFormData({...formData, gender: e.target.value as any})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                     >
                       <option>Femme</option>
                       <option>Homme</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1.5">Tranche d'âge</label>
                     <select 
                        value={formData.ageGroup}
                        onChange={e => setFormData({...formData, ageGroup: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                     >
                       <option>18-25 ans</option>
                       <option>26-35 ans</option>
                       <option>36-45 ans</option>
                       <option>46-55 ans</option>
                       <option>56+ ans</option>
                     </select>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Ville</label>
                   <select 
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                   >
                     <option>Casablanca</option>
                     <option>Rabat</option>
                     <option>Marrakech</option>
                     <option>Agadir</option>
                     <option>Tanger</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Profession</label>
                   <select 
                      value={formData.profession}
                      onChange={e => setFormData({...formData, profession: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                   >
                     <option value="">Sélectionner...</option>
                     <option>Étudiant(e)</option>
                     <option>Salarié(e)</option>
                     <option>Cadre</option>
                     <option>Commerçant(e)</option>
                     <option>Fonctionnaire</option>
                     <option>Indépendant(e)</option>
                     <option>Retraité(e)</option>
                     <option>Sans Emploi</option>
                   </select>
                </div>
             </div>
             
             <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Titre / Société</label>
                <input 
                   value={formData.company}
                   onChange={e => setFormData({...formData, company: e.target.value})}
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm bg-white"
                   placeholder="Ex: Directrice Marketing chez..."
                />
             </div>

             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes Générales</label>
                <textarea 
                   value={formData.notes}
                   onChange={e => setFormData({...formData, notes: e.target.value})}
                   rows={3}
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm bg-white resize-none"
                   placeholder="Notes sur le client..."
                />
             </div>
          </div>

          {/* SECTION 2: Allergies */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
               <AlertCircle size={18} className="text-red-500" />
               <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Allergies / Contre-indications</h2>
             </div>
             <textarea 
                value={formData.allergies}
                onChange={e => setFormData({...formData, allergies: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-red-200 bg-red-50/30 rounded-lg focus:ring-2 focus:ring-red-500 text-sm resize-none placeholder:text-red-300 text-slate-800"
                placeholder="Lister toutes les allergies connues ou problèmes médicaux..."
             />
          </div>

        </div>

        {/* --- RIGHT COLUMN (1/3) --- */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* SECTION 3: Relation */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
             <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Relation</h2>
             
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Statut <span className="text-red-500">*</span></label>
               <select 
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               >
                 <option value="ACTIF">Actif</option>
                 <option value="VIP">VIP</option>
                 <option value="INACTIF">Inactif</option>
               </select>
             </div>

             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Praticien Préféré</label>
               <select 
                  value={formData.preferredStaffId}
                  onChange={e => setFormData({...formData, preferredStaffId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               >
                 <option value="">Aucun</option>
                 <option value="st1">Marie Dupont</option>
                 <option value="st2">Julie Dubois</option>
               </select>
             </div>
          </div>

          {/* SECTION 4: Contact */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
             <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Contact</h2>
             
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone <span className="text-red-500">*</span></label>
               <input 
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               />
             </div>

             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Email <span className="text-red-500">*</span></label>
               <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               />
             </div>

             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Réseau Social</label>
               <select 
                  value={formData.socialNetwork}
                  onChange={e => setFormData({...formData, socialNetwork: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               >
                 <option value="">Aucun</option>
                 <option>Instagram</option>
                 <option>Facebook</option>
                 <option>LinkedIn</option>
                 <option>TikTok</option>
                 <option>Snapchat</option>
               </select>
             </div>
             
             {formData.socialNetwork && (
               <div className="animate-in slide-in-from-top-2">
                 <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom d'utilisateur (@)</label>
                 <input 
                    value={formData.socialUsername}
                    onChange={e => setFormData({...formData, socialUsername: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                 />
               </div>
             )}

             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp</label>
               <input 
                  value={formData.whatsapp}
                  onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                  placeholder="Si différent du mobile"
               />
             </div>

             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Canal Préféré</label>
               <select 
                  value={formData.preferredChannel}
                  onChange={e => setFormData({...formData, preferredChannel: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               >
                 <option>Téléphone</option>
                 <option>WhatsApp</option>
                 <option>Instagram</option>
                 <option>Email</option>
                 <option>Autre</option>
               </select>
             </div>

             {formData.preferredChannel === 'Autre' && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Précisez Canal</label>
                  <input 
                      value={formData.otherChannelDetail}
                      onChange={e => setFormData({...formData, otherChannelDetail: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                  />
                </div>
             )}

             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Langue Préférée</label>
               <select 
                  value={formData.preferredLanguage}
                  onChange={e => setFormData({...formData, preferredLanguage: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               >
                 <option>Français</option>
                 <option>Arabe</option>
                 <option>Anglais</option>
                 <option>Espagnol</option>
               </select>
             </div>
          </div>

          {/* SECTION 5: Acquisition */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
             <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Prise de contact</h2>
             
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de Contact</label>
               <input 
                  type="date"
                  value={formData.contactDate}
                  onChange={e => setFormData({...formData, contactDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               />
             </div>

             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Méthode de Contact</label>
               <select 
                  value={formData.contactMethod}
                  onChange={e => setFormData({...formData, contactMethod: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               >
                 <option>Walk-in</option>
                 <option>Appel</option>
                 <option>Message</option>
               </select>
             </div>

             {formData.contactMethod === 'Message' && (
               <div className="animate-in slide-in-from-top-2">
                 <label className="block text-sm font-medium text-slate-700 mb-1.5">Canal de Message</label>
                 <select 
                    value={formData.messageChannel}
                    onChange={e => setFormData({...formData, messageChannel: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                 >
                   <option value="">Selectionner...</option>
                   <option>Instagram</option>
                   <option>WhatsApp</option>
                   <option>Facebook</option>
                 </select>
               </div>
             )}

             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Source de Découverte</label>
               <select 
                  value={formData.acquisitionSource}
                  onChange={e => setFormData({...formData, acquisitionSource: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
               >
                 <option>Passage</option>
                 <option>Recommandation</option>
                 <option>Réseaux Sociaux</option>
                 <option>Google Maps</option>
                 <option>Publicité</option>
                 <option>Influenceur</option>
                 <option>Autre</option>
               </select>
             </div>

             {formData.acquisitionSource === 'Influenceur' && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom de l'Influenceur</label>
                  <input 
                      value={formData.acquisitionDetail}
                      onChange={e => setFormData({...formData, acquisitionDetail: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                  />
                </div>
             )}

             {formData.acquisitionSource === 'Autre' && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Précisez Source</label>
                  <input 
                      value={formData.acquisitionDetail}
                      onChange={e => setFormData({...formData, acquisitionDetail: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                  />
                </div>
             )}
          </div>

          {/* SECTION 6: Permissions */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
             <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Autorisations</h2>
             
             <div className="space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Réseaux Sociaux (Photo/Vidéo)</span>
                  <button 
                    type="button"
                    onClick={() => handlePermissionChange('socialMedia')}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.permissions?.socialMedia ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.permissions?.socialMedia ? 'left-5' : 'left-0.5'}`} />
                  </button>
               </div>

               <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Marketing & Publicité</span>
                  <button 
                    type="button"
                    onClick={() => handlePermissionChange('marketing')}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.permissions?.marketing ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.permissions?.marketing ? 'left-5' : 'left-0.5'}`} />
                  </button>
               </div>

               <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Autres</span>
                  <button 
                    type="button"
                    onClick={() => handlePermissionChange('other')}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.permissions?.other ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.permissions?.other ? 'left-5' : 'left-0.5'}`} />
                  </button>
               </div>

               {formData.permissions?.other && (
                  <div className="animate-in slide-in-from-top-2 pt-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Précisez Autres</label>
                    <input 
                        value={formData.permissions.otherDetail}
                        onChange={e => setFormData({
                          ...formData, 
                          permissions: { ...formData.permissions!, otherDetail: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 bg-white text-sm"
                    />
                  </div>
               )}
             </div>
          </div>

        </div>
      </form>
    </div>
  );
};
