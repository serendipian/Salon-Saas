
import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { Section, Input, Select, TextArea } from '../../../components/FormElements';
import { useAppContext } from '../../../context/AppContext';
import { useServices } from '../../services/hooks/useServices';

interface AppointmentFormProps {
  existingAppointment?: Appointment;
  onSave: (a: Appointment) => void;
  onCancel: () => void;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({ existingAppointment, onSave, onCancel }) => {
  const { salonSettings, clients, team } = useAppContext();
  const { allServices: services } = useServices();
  const [formData, setFormData] = useState<Partial<Appointment>>(existingAppointment || {
    date: new Date().toISOString().slice(0, 16),
    clientId: '',
    clientName: '',
    serviceId: '',
    serviceName: '',
    staffId: '',
    staffName: '',
    status: AppointmentStatus.SCHEDULED,
    price: 0,
    durationMinutes: 30
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure names are populated if using ID-based selection
    const finalData = { ...formData };
    
    if (finalData.clientId) {
      const c = clients.find(cl => cl.id === finalData.clientId);
      if (c) finalData.clientName = `${c.firstName} ${c.lastName}`;
    }
    
    if (finalData.serviceId) {
      const s = services.find(sv => sv.id === finalData.serviceId);
      if (s) finalData.serviceName = s.name;
    }

    if (finalData.staffId) {
      const t = team.find(tm => tm.id === finalData.staffId);
      if (t) finalData.staffName = `${t.firstName} ${t.lastName}`;
    }

    onSave(finalData as Appointment);
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      // Auto-select first variant defaults
      const variant = service.variants[0];
      setFormData(prev => ({
        ...prev,
        serviceId: service.id,
        serviceName: service.name,
        price: variant.price,
        durationMinutes: variant.durationMinutes
      }));
    } else {
      setFormData(prev => ({ ...prev, serviceId: serviceId }));
    }
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setFormData(prev => ({
      ...prev,
      clientId: clientId,
      clientName: client ? `${client.firstName} ${client.lastName}` : ''
    }));
  };

  const handleStaffChange = (staffId: string) => {
    const staff = team.find(s => s.id === staffId);
    setFormData(prev => ({
      ...prev,
      staffId: staffId,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : ''
    }));
  };

  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
       <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingAppointment ? 'Modifier le Rendez-vous' : 'Nouveau Rendez-vous'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Section title="Détails de la réservation">
          <div className="grid grid-cols-2 gap-6">
             <Input 
               label="Date & Heure"
               type="datetime-local"
               required
               value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ''}
               onChange={e => setFormData({...formData, date: new Date(e.target.value).toISOString()})}
             />
             <Select 
               label="Statut"
               value={formData.status}
               onChange={(val) => setFormData({...formData, status: val as AppointmentStatus})}
               options={[
                 { value: AppointmentStatus.SCHEDULED, label: 'Planifié', initials: 'PL' },
                 { value: AppointmentStatus.COMPLETED, label: 'Terminé', initials: 'OK' },
                 { value: AppointmentStatus.CANCELLED, label: 'Annulé', initials: 'XX' },
                 { value: AppointmentStatus.NO_SHOW, label: 'No Show', initials: 'NS' }
               ]}
             />
          </div>

          <Select 
            label="Client"
            value={formData.clientId}
            onChange={(val) => handleClientChange(val as string)}
            searchable
            placeholder="Rechercher un client..."
            options={[
              ...clients.map(c => ({ 
                value: c.id, 
                label: `${c.firstName} ${c.lastName}`,
                image: c.photoUrl,
                initials: `${c.firstName[0]}${c.lastName[0]}`,
                subtitle: c.phone
              }))
            ]}
          />

          <div className="grid grid-cols-2 gap-6">
             <Select 
                label="Service"
                value={formData.serviceId}
                onChange={(val) => handleServiceChange(val as string)}
                searchable
                placeholder="Choisir un service..."
                options={[
                  ...services.map(s => ({ value: s.id, label: s.name }))
                ]}
             />
             <Input 
               label={`Prix (${currencySymbol})`}
               type="number"
               value={formData.price}
               onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
             />
          </div>

          <Select 
             label="Praticien / Staff"
             value={formData.staffId}
             onChange={(val) => handleStaffChange(val as string)}
             searchable
             placeholder="Assigner à..."
             options={[
               ...team.map(t => ({ 
                 value: t.id, 
                 label: `${t.firstName} ${t.lastName}`,
                 image: t.photoUrl,
                 initials: `${t.firstName[0]}${t.lastName[0]}`,
                 subtitle: t.role
               }))
             ]}
          />

          <TextArea 
            label="Notes"
            rows={3}
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            placeholder="Détails supplémentaires..."
          />
        </Section>

        <div className="pt-4 flex gap-3 mt-2">
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
