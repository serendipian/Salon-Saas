import React, { useMemo } from 'react';
import { Building2, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Section } from '../../components/FormElements';
import type { Role } from '../../lib/auth.types';

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-slate-100 text-slate-700',
  manager: 'bg-blue-50 text-blue-700',
  stylist: 'bg-violet-50 text-violet-700',
  receptionist: 'bg-amber-50 text-amber-700',
};

// Human-readable timezone offset (e.g., "UTC+2") for display.
function formatOffset(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = fmt.formatToParts(new Date());
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value;
    return offset ?? timezone;
  } catch {
    return timezone;
  }
}

export const ProfileSalonRole: React.FC = () => {
  const { activeSalon, role, memberships } = useAuth();

  const currentMembership = memberships.find((m) => m.salon_id === activeSalon?.id);
  const memberSince = currentMembership?.created_at;

  // H-11: Detect timezone mismatch between browser and salon. Appointment
  // times are constructed in the browser's local timezone and serialized
  // to UTC, so if the user is in a different zone than the salon (e.g.,
  // owner traveling abroad) appointments get shifted by the offset delta.
  // Warn the user instead of silently corrupting the schedule.
  const timezoneMismatch = useMemo(() => {
    if (!activeSalon?.timezone) return null;
    let browserTz: string;
    try {
      browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
    if (!browserTz || browserTz === activeSalon.timezone) return null;
    return {
      browser: browserTz,
      salon: activeSalon.timezone,
      browserOffset: formatOffset(browserTz),
      salonOffset: formatOffset(activeSalon.timezone),
    };
  }, [activeSalon?.timezone]);

  return (
    <Section title="Salon & Rôle">
      {activeSalon && role && (
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
            {activeSalon.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{activeSalon.name}</p>
            <span
              className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}
            >
              {ROLE_LABELS[role]}
            </span>
            {memberSince && (
              <p className="text-xs text-slate-500 mt-2">
                Membre depuis{' '}
                {new Date(memberSince).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {timezoneMismatch && (
        <div className="mt-4 flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-medium">Fuseau horaire différent détecté</p>
            <p className="mt-1 text-amber-700/90">
              Votre navigateur est en <strong>{timezoneMismatch.browser}</strong> (
              {timezoneMismatch.browserOffset}), mais le salon est configuré en{' '}
              <strong>{timezoneMismatch.salon}</strong> ({timezoneMismatch.salonOffset}). Les
              horaires des rendez-vous que vous créez ou modifiez seront enregistrés avec l'heure de
              votre navigateur — pour éviter tout décalage, utilisez un appareil dont le fuseau
              horaire correspond à celui du salon.
            </p>
          </div>
        </div>
      )}

      {memberships.length > 1 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Tous mes salons
          </p>
          <div className="space-y-2">
            {memberships.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 size={16} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{m.salon.name}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${ROLE_COLORS[m.role]}`}
                >
                  {ROLE_LABELS[m.role]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
};
