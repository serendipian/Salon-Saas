import React, { useState } from 'react';
import { ArrowLeft, Save, User, Camera, Check, CreditCard, FileText, HeartPulse } from 'lucide-react';
import { StaffMember, WorkSchedule } from '../../../types';
import { Section, Input, Select, TextArea } from '../../../components/FormElements';
import { DatePicker } from '../../../components/DatePicker';
import { WorkScheduleEditor } from '../../../components/WorkScheduleEditor';
import { BonusSystemEditor } from '../../../components/BonusSystemEditor';
import { useServices } from '../../services/hooks/useServices';
import { useSettings } from '../../settings/hooks/useSettings';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { staffMemberSchema } from '../schemas';

interface TeamFormProps {
  existingMember?: StaffMember;
  onSave: (member: StaffMember) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const COLORS = [
  { label: 'Rose', value: 'bg-rose-100 text-rose-800' },
  { label: 'Bleu', value: 'bg-blue-100 text-blue-800' },
  { label: 'Vert', value: 'bg-emerald-100 text-emerald-800' },
  { label: 'Violet', value: 'bg-purple-100 text-purple-800' },
  { label: 'Orange', value: 'bg-amber-100 text-amber-800' },
  { label: 'Gris', value: 'bg-slate-100 text-slate-800' },
];

const DEFAULT_SCHEDULE: WorkSchedule = {
  monday: { isOpen: true, start: '09:00', end: '19:00' },
  tuesday: { isOpen: true, start: '09:00', end: '19:00' },
  wednesday: { isOpen: true, start: '09:00', end: '19:00' },
  thursday: { isOpen: true, start: '09:00', end: '19:00' },
  friday: { isOpen: true, start: '09:00', end: '19:00' },
  saturday: { isOpen: true, start: '10:00', end: '18:00' },
  sunday: { isOpen: false, start: '09:00', end: '18:00' },
};

export const TeamForm: React.FC<TeamFormProps> = ({ existingMember, onSave, onCancel, isSubmitting }) => {
  const { serviceCategories } = useServices();
  const { salonSettings } = useSettings();
  const { errors, validate, clearFieldError } = useFormValidation(staffMemberSchema);

  const [formData, setFormData] = useState<StaffMember>(existingMember || {
    id: '',
    firstName: '',
    lastName: '',
    role: 'Stylist',
    email: '',
    phone: '',
    color: 'bg-slate-100 text-slate-800',
    skills: [],
    active: true,
    bio: '',
    
    // HR Defaults
    startDate: new Date().toISOString().slice(0, 10),
    contractType: 'CDI',
    weeklyHours: 35,
    baseSalary: 0,
    commissionRate: 0,
    bonusTiers: [],
    
    schedule: DEFAULT_SCHEDULE
  });

  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validate(formData);
    if (!validated) return;
    onSave(formData);
  };

  const toggleSkill = (categoryId: string) => {
    setFormData(prev => {
      const hasSkill = prev.skills.includes(categoryId);
      return {
        ...prev,
        skills: hasSkill 
          ? prev.skills.filter(id => id !== categoryId)
          : [...prev.skills, categoryId]
      };
    });
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingMember ? 'Modifier le Membre' : 'Nouveau Membre'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
           
           {/* Personal Info */}
           <Section title="Informations Personnelles">
              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                 <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden group">
                       {formData.photoUrl ? (
                         <img src={formData.photoUrl} alt="" className="w-full h-full object-cover" />
                       ) : (
                         <User size={32} className="text-slate-400" />
                       )}
                       <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <Camera className="text-white" size={24} />
                       </div>
                    </div>
                 </div>
                 <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Prénom"
                      required
                      value={formData.firstName}
                      onChange={e => { clearFieldError('firstName'); setFormData({...formData, firstName: e.target.value}); }}
                      error={errors.firstName}
                    />
                    <Input
                      label="Nom"
                      value={formData.lastName}
                      onChange={e => { clearFieldError('lastName'); setFormData({...formData, lastName: e.target.value}); }}
                      error={errors.lastName}
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={e => { clearFieldError('email'); setFormData({...formData, email: e.target.value}); }}
                      error={errors.email}
                    />
                    <Input 
                      label="Téléphone" 
                      type="tel"
                      required
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                    />
                 </div>
              </div>
              <TextArea 
                label="Biographie courte"
                rows={2}
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                placeholder="Expérience, spécialités..."
              />
           </Section>

           {/* Skills Selector */}
           <Section title="Compétences & Spécialités">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                 {serviceCategories.map(category => {
                   const isSelected = formData.skills.includes(category.id);
                   return (
                     <button
                       key={category.id}
                       type="button"
                       onClick={() => toggleSkill(category.id)}
                       className={`
                         flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all
                         ${isSelected 
                           ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                           : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                         }
                       `}
                     >
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : category.color.split(' ')[0]}`} />
                           {category.name}
                        </div>
                        {isSelected && <Check size={14} />}
                     </button>
                   );
                 })}
                 {serviceCategories.length === 0 && (
                   <div className="col-span-full text-center text-slate-400 py-4 text-sm italic">
                     Aucune catégorie de service configurée.
                   </div>
                 )}
              </div>
           </Section>

           {/* Modular Schedule Editor */}
           <Section title="Horaires de travail">
              <WorkScheduleEditor 
                value={formData.schedule} 
                onChange={(newSchedule) => setFormData({...formData, schedule: newSchedule})} 
              />
           </Section>
        </div>

        {/* Right Column (1/3) - HR & Settings */}
        <div className="lg:col-span-1 space-y-6">
           
           {/* Save Actions */}
           <div className="flex flex-col gap-3 sticky top-6 z-10">
             <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {isSubmitting ? (
                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               ) : (
                 <Save size={16} />
               )}
               {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
             </button>
             <button 
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
            >
               Annuler
             </button>
           </div>

           <Section title="Rôle & Statut">
              <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-700 font-medium">Compte Actif</span>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, active: !formData.active})}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.active ? 'left-5' : 'left-0.5'}`} />
                  </button>
              </div>
              <Select
                 label="Rôle"
                 value={formData.role}
                 onChange={(val) => { clearFieldError('role'); setFormData({...formData, role: val as string}); }}
                 error={errors.role}
                 options={[
                   { value: 'Manager', label: 'Manager' },
                   { value: 'Stylist', label: 'Styliste' },
                   { value: 'Assistant', label: 'Assistant(e)' },
                   { value: 'Receptionist', label: 'Réceptionniste' }
                 ]}
              />
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">Couleur Planning</label>
                <div className="grid grid-cols-6 gap-2">
                   {COLORS.map(c => (
                     <button
                       key={c.value}
                       type="button"
                       onClick={() => setFormData({...formData, color: c.value})}
                       className={`h-8 rounded-lg border transition-all ${c.value.split(' ')[0]} ${formData.color === c.value ? 'ring-2 ring-slate-900 ring-offset-1' : 'border-transparent'}`}
                       title={c.label}
                     />
                   ))}
                </div>
              </div>
           </Section>

           <Section title="Contrat & Rémunération">
              <div className="space-y-4">
                 <Select 
                    label="Type de Contrat"
                    value={formData.contractType}
                    onChange={(val) => setFormData({...formData, contractType: val as string})}
                    options={[
                      { value: 'CDI', label: 'CDI' },
                      { value: 'CDD', label: 'CDD' },
                      { value: 'Freelance', label: 'Freelance' },
                      { value: 'Apprentissage', label: 'Apprentissage' },
                      { value: 'Stage', label: 'Stage' },
                    ]}
                 />
                 <div className="grid grid-cols-2 gap-3">
                    <DatePicker 
                      label="Début Contrat"
                      value={formData.startDate}
                      onChange={date => setFormData({...formData, startDate: date})}
                    />
                    <DatePicker 
                      label="Fin (Optionnel)"
                      value={formData.endDate}
                      onChange={date => setFormData({...formData, endDate: date})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <Input 
                      label="Heures / Sem."
                      type="number"
                      value={formData.weeklyHours}
                      onChange={e => setFormData({...formData, weeklyHours: parseFloat(e.target.value)})}
                    />
                    <Input
                      label="Commission (%)"
                      type="number"
                      min={0}
                      max={100}
                      value={formData.commissionRate}
                      onChange={e => setFormData({...formData, commissionRate: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))})}
                      error={errors.commissionRate}
                    />
                 </div>
                 <Input 
                    label={`Salaire de base (${currencySymbol})`}
                    type="number"
                    value={formData.baseSalary}
                    onChange={e => setFormData({...formData, baseSalary: parseFloat(e.target.value)})}
                 />
              </div>
           </Section>

           {/* New Bonus System Section */}
           <Section title="Système de Primes (Paliers)">
              <BonusSystemEditor 
                tiers={formData.bonusTiers || []} 
                onChange={(newTiers) => setFormData({...formData, bonusTiers: newTiers})}
                currencySymbol={currencySymbol}
              />
           </Section>

           <Section title="Infos Administratives">
              <div className="space-y-4">
                 <Input 
                    label="Numéro Sécurité Sociale"
                    icon={FileText}
                    value={formData.socialSecurityNumber}
                    onChange={e => setFormData({...formData, socialSecurityNumber: e.target.value})}
                 />
                 <Input 
                    label="IBAN"
                    icon={CreditCard}
                    value={formData.iban}
                    onChange={e => setFormData({...formData, iban: e.target.value})}
                    placeholder="FR76 ..."
                 />
                 <DatePicker 
                    label="Date de naissance"
                    value={formData.birthDate}
                    onChange={date => setFormData({...formData, birthDate: date})}
                 />
                 <TextArea 
                    label="Adresse Postale"
                    rows={2}
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                 />
              </div>
           </Section>

           <Section title="Contact d'Urgence">
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                    <Input 
                       label="Nom du contact"
                       icon={HeartPulse}
                       value={formData.emergencyContactName}
                       onChange={e => setFormData({...formData, emergencyContactName: e.target.value})}
                    />
                    <Input 
                       label="Relation"
                       placeholder="Ex: Époux"
                       value={formData.emergencyContactRelation}
                       onChange={e => setFormData({...formData, emergencyContactRelation: e.target.value})}
                    />
                 </div>
                 <Input 
                    label="Téléphone d'urgence"
                    value={formData.emergencyContactPhone}
                    onChange={e => setFormData({...formData, emergencyContactPhone: e.target.value})}
                 />
              </div>
           </Section>

        </div>
      </form>
    </div>
  );
};