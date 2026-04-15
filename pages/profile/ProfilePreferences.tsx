import React from 'react';
import { Mail, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Section, Select } from '../../components/FormElements';

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
];

export const ProfilePreferences: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const { addToast } = useToast();

  const handleLanguageChange = async (value: string | number) => {
    const { error } = await updateProfile({ language: String(value) });
    if (error) {
      addToast({ type: 'error', message: 'Impossible de modifier la langue' });
    } else {
      addToast({ type: 'success', message: 'Langue mise à jour' });
    }
  };

  const handleToggle = async (
    field: 'notification_email' | 'notification_sms',
    current: boolean,
  ) => {
    const { error } = await updateProfile({ [field]: !current });
    if (error) {
      addToast({ type: 'error', message: 'Impossible de modifier les préférences' });
    }
  };

  return (
    <Section title="Préférences">
      <div className="space-y-6">
        <div className="max-w-xs">
          <Select
            label="Langue"
            value={profile?.language ?? 'fr'}
            onChange={handleLanguageChange}
            options={LANGUAGE_OPTIONS}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Notifications</p>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-slate-400" />
              <span className="text-sm text-slate-700">Notifications par email</span>
            </div>
            <input
              type="checkbox"
              checked={profile?.notification_email ?? true}
              onChange={() =>
                handleToggle('notification_email', profile?.notification_email ?? true)
              }
              className="w-5 h-5 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-slate-400" />
              <span className="text-sm text-slate-700">Notifications par SMS</span>
            </div>
            <input
              type="checkbox"
              checked={profile?.notification_sms ?? false}
              onChange={() => handleToggle('notification_sms', profile?.notification_sms ?? false)}
              className="w-5 h-5 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
    </Section>
  );
};
