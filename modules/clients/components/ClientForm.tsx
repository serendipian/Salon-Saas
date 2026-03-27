import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Save,
  User,
  AlertCircle,
  Upload,
  Instagram
} from 'lucide-react';
import { Client, ClientPermissions } from '../../../types';
import { useTeam } from '../../team/hooks/useTeam';
import { Section, Input, Select, TextArea } from '../../../components/FormElements';
import { DatePicker } from '../../../components/DatePicker';

interface ClientFormProps {
  existingClient?: Client;
  onSave: (c: Client) => void;
  onCancel: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({ existingClient, onSave, onCancel }) => {
  const { allStaff: team } = useTeam();
  
  const [formData, setFormData] = useState<Partial<Client>>(existingClient || {
    firstName: '',
    lastName: '',
    gender: undefined,
    ageGroup: '',
    city: '',
    profession: '',
    company: '',
    notes: '',
    
    allergies: '',
    
    status: undefined,
    preferredStaffId: undefined,

    phone: '',
    email: '',
    whatsapp: '',
    instagram: '',
    preferredChannel: '',
    preferredLanguage: '',
    otherChannelDetail: '',

    contactDate: '',
    contactMethod: '',
    messageChannel: '',
    acquisitionSource: '',
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
          <Section title="Informations Principales">
             {/* Row 1: Identity Grid (Photo | First Name | Last Name) */}
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
                
                {/* Col 1: Square Photo Uploader */}
                <div className="sm:col-span-1">
                   <div className="aspect-square w-full bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-slate-400 hover:bg-slate-100 transition-all cursor-pointer">
                      {formData.photoUrl ? (
                         <img src={formData.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                         <div className="flex flex-col items-center justify-center text-slate-400">
                           <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-2 shadow-sm">
                              <User size={24} />
                           </div>
                           <span className="text-xs font-medium">Ajouter photo</span>
                         </div>
                      )}
                      
                      {/* Hover Overlay / Button */}
                      <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <button type="button" className="bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg ring-1 ring-slate-100">
                            <Upload size={14} />
                            {formData.photoUrl ? 'Changer' : 'Upload'}
                         </button>
                      </div>
                   </div>
                </div>

                {/* Col 2: First Name */}
                <div className="sm:col-span-1 flex flex-col justify-end">
                   <Input 
                     label="Prénom" 
                     required
                     value={formData.firstName}
                     onChange={e => setFormData({...formData, firstName: e.target.value})}
                     placeholder="Ex: Sophie"
                   />
                </div>

                {/* Col 3: Last Name */}
                <div className="sm:col-span-1 flex flex-col justify-end">
                   <Input 
                     label="Nom" 
                     required
                     value={formData.lastName}
                     onChange={e => setFormData({...formData, lastName: e.target.value})}
                     placeholder="Ex: Martin"
                   />
                </div>
             </div>

             {/* Row 3: Demographics (3 cols) */}
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
                <Select 
                   label="Genre"
                   value={formData.gender}
                   onChange={(val) => setFormData({...formData, gender: val as any})}
                   options={[{value: 'Femme', label: 'Femme'}, {value: 'Homme', label: 'Homme'}]}
                />
                <Select 
                   label="Tranche d'âge"
                   value={formData.ageGroup}
                   onChange={(val) => setFormData({...formData, ageGroup: val as string})}
                   options={[
                     {value: '18-25 ans', label: '18-25 ans'},
                     {value: '26-35 ans', label: '26-35 ans'},
                     {value: '36-45 ans', label: '36-45 ans'},
                     {value: '46-55 ans', label: '46-55 ans'},
                     {value: '56+ ans', label: '56+ ans'}
                   ]}
                />
                <Select 
                   label="Ville"
                   value={formData.city}
                   onChange={(val) => setFormData({...formData, city: val as string})}
                   searchable
                   options={[
                     {value: 'Casablanca', label: 'Casablanca'},
                     {value: 'Rabat', label: 'Rabat'},
                     {value: 'Marrakech', label: 'Marrakech'},
                     {value: 'Agadir', label: 'Agadir'},
                     {value: 'Tanger', label: 'Tanger'}
                   ]}
                />
             </div>

             {/* Row 4: Professional (1/3 - 2/3) */}
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
                <div className="sm:col-span-1">
                  <Select 
                     label="Profession"
                     value={formData.profession}
                     onChange={(val) => setFormData({...formData, profession: val as string})}
                     searchable
                     options={[
                       {value: 'Étudiant(e)', label: 'Étudiant(e)'},
                       {value: 'Salarié(e)', label: 'Salarié(e)'},
                       {value: 'Cadre', label: 'Cadre'},
                       {value: 'Commerçant(e)', label: 'Commerçant(e)'},
                       {value: 'Fonctionnaire', label: 'Fonctionnaire'},
                       {value: 'Indépendant(e)', label: 'Indépendant(e)'},
                       {value: 'Retraité(e)', label: 'Retraité(e)'},
                       {value: 'Sans Emploi', label: 'Sans Emploi'}
                     ]}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input 
                      label="Titre / Société"
                      value={formData.company}
                      onChange={e => setFormData({...formData, company: e.target.value})}
                      placeholder="Ex: Directrice Marketing chez..."
                  />
                </div>
             </div>

             {/* Row 5: Notes */}
             <div>
                <TextArea 
                   label="Notes Générales"
                   value={formData.notes}
                   onChange={e => setFormData({...formData, notes: e.target.value})}
                   rows={3}
                   placeholder="Notes importantes sur le client..."
                />
             </div>
          </Section>

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
                className="w-full px-3 py-2 border border-red-200 bg-red-50/30 rounded-lg focus:ring-2 focus:ring-red-500 text-sm resize-none placeholder:text-red-300 text-slate-800 outline-none"
                placeholder="Lister toutes les allergies connues ou problèmes médicaux..."
             />
          </div>

        </div>

        {/* --- RIGHT COLUMN (1/3) --- */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* SECTION 3: Relation */}
          <Section title="Relation">
             <div className="grid grid-cols-2 gap-3">
                <Select 
                   label="Statut"
                   value={formData.status}
                   onChange={(val) => setFormData({...formData, status: val as any})}
                   options={[
                     {value: 'ACTIF', label: 'Actif', initials: 'AC'},
                     {value: 'VIP', label: 'VIP', initials: 'VP'},
                     {value: 'INACTIF', label: 'Inactif', initials: 'IN'}
                   ]}
                />

                <Select 
                   label="Praticien Préféré"
                   value={formData.preferredStaffId}
                   onChange={(val) => setFormData({...formData, preferredStaffId: val as string})}
                   searchable
                   options={[
                     {value: '', label: 'Aucun'},
                     ...team.map(m => ({
                       value: m.id, 
                       label: `${m.firstName} ${m.lastName}`,
                       image: m.photoUrl,
                       initials: `${m.firstName[0]}${m.lastName[0]}`
                     }))
                   ]}
                />
             </div>
          </Section>

          {/* SECTION 4: Contact */}
          <Section title="Contact">
             <div className="grid grid-cols-2 gap-3">
               <Input 
                  label="Téléphone"
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="06 12 34 56 78"
               />

               <Input 
                  label="Email"
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="exemple@email.com"
               />

               <Input 
                  label="WhatsApp"
                  value={formData.whatsapp}
                  onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                  placeholder="Optionnel"
               />

               <Input 
                  label="Instagram"
                  value={formData.instagram}
                  onChange={e => setFormData({...formData, instagram: e.target.value})}
                  placeholder="@username"
                  icon={Instagram}
               />

               <Select 
                  label="Canal Préféré"
                  value={formData.preferredChannel}
                  onChange={(val) => setFormData({...formData, preferredChannel: val as string})}
                  options={[
                    {value: 'Téléphone', label: 'Téléphone'},
                    {value: 'WhatsApp', label: 'WhatsApp'},
                    {value: 'Instagram', label: 'Instagram'},
                    {value: 'Email', label: 'Email'},
                    {value: 'Autre', label: 'Autre'}
                  ]}
               />

               <Select 
                  label="Langue"
                  value={formData.preferredLanguage}
                  onChange={(val) => setFormData({...formData, preferredLanguage: val as string})}
                  options={[
                    {value: 'Français', label: 'Français'},
                    {value: 'Arabe', label: 'Arabe'},
                    {value: 'Anglais', label: 'Anglais'},
                    {value: 'Espagnol', label: 'Espagnol'}
                  ]}
               />

               {formData.preferredChannel === 'Autre' && (
                  <div className="animate-in slide-in-from-top-2 col-span-2">
                    <Input 
                        label="Précisez Canal"
                        value={formData.otherChannelDetail}
                        onChange={e => setFormData({...formData, otherChannelDetail: e.target.value})}
                    />
                  </div>
               )}
             </div>
          </Section>

          {/* SECTION 5: Acquisition */}
          <Section title="Prise de contact">
             <div className="grid grid-cols-2 gap-3">
                <DatePicker 
                   label="Date de Contact"
                   value={formData.contactDate}
                   onChange={date => setFormData({...formData, contactDate: date})}
                   placeholder="Sélectionner..."
                />

                <Select 
                   label="Méthode de Contact"
                   value={formData.contactMethod}
                   onChange={(val) => setFormData({...formData, contactMethod: val as string})}
                   options={[
                     {value: 'Walk-in', label: 'Walk-in'},
                     {value: 'Appel', label: 'Appel'},
                     {value: 'Message', label: 'Message'}
                   ]}
                />

                {formData.contactMethod === 'Message' && (
                  <div className="animate-in slide-in-from-top-2">
                    <Select 
                       label="Canal de Message"
                       value={formData.messageChannel}
                       onChange={(val) => setFormData({...formData, messageChannel: val as string})}
                       options={[
                         {value: 'Instagram', label: 'Instagram'},
                         {value: 'WhatsApp', label: 'WhatsApp'},
                         {value: 'Facebook', label: 'Facebook'}
                       ]}
                    />
                  </div>
                )}

                <Select 
                   label="Source de Découverte"
                   value={formData.acquisitionSource}
                   onChange={(val) => setFormData({...formData, acquisitionSource: val as string})}
                   options={[
                     {value: 'Passage', label: 'Passage'},
                     {value: 'Recommandation', label: 'Recommandation'},
                     {value: 'Réseaux Sociaux', label: 'Réseaux Sociaux'},
                     {value: 'Google Maps', label: 'Google Maps'},
                     {value: 'Publicité', label: 'Publicité'},
                     {value: 'Influenceur', label: 'Influenceur'},
                     {value: 'Autre', label: 'Autre'}
                   ]}
                />

                {formData.acquisitionSource === 'Influenceur' && (
                   <div className="animate-in slide-in-from-top-2">
                     <Input 
                         label="Nom de l'Influenceur"
                         value={formData.acquisitionDetail}
                         onChange={e => setFormData({...formData, acquisitionDetail: e.target.value})}
                     />
                   </div>
                )}

                {formData.acquisitionSource === 'Autre' && (
                   <div className="animate-in slide-in-from-top-2">
                     <Input 
                         label="Précisez Source"
                         value={formData.acquisitionDetail}
                         onChange={e => setFormData({...formData, acquisitionDetail: e.target.value})}
                     />
                   </div>
                )}
             </div>
          </Section>

          {/* SECTION 6: Permissions */}
          <Section title="Autorisations">
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
                    <Input 
                        label="Précisez Autres"
                        value={formData.permissions.otherDetail}
                        onChange={e => setFormData({
                          ...formData, 
                          permissions: { ...formData.permissions!, otherDetail: e.target.value }
                        })}
                    />
                  </div>
               )}
             </div>
          </Section>

        </div>
      </form>
    </div>
  );
};