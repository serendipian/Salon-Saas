import React, { useState } from 'react';
import { Plus, Copy, Check, X, Loader2, Link as LinkIcon } from 'lucide-react';
import { type InvitationRow, INVITATION_EXPIRY_DAYS } from '../hooks/useTeamSettings';
import { useToast } from '../../../context/ToastContext';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-purple-100 text-purple-700',
  stylist: 'bg-emerald-100 text-emerald-700',
  receptionist: 'bg-amber-100 text-amber-700',
};

function getStatus(inv: InvitationRow): { label: string; className: string } {
  if (inv.accepted_at) return { label: 'Acceptée', className: 'bg-emerald-100 text-emerald-700' };
  if (new Date(inv.expires_at) < new Date()) return { label: 'Expirée', className: 'bg-slate-100 text-slate-500' };
  return { label: 'En attente', className: 'bg-orange-100 text-orange-700' };
}

function isPending(inv: InvitationRow): boolean {
  return !inv.accepted_at && new Date(inv.expires_at) > new Date();
}

interface InvitationsTabProps {
  invitations: InvitationRow[];
  onCreate: (role: string) => Promise<string>;
  isCreating: boolean;
  onCancel: (id: string) => Promise<void>;
  isCancelling: boolean;
}

export const InvitationsTab: React.FC<InvitationsTabProps> = ({
  invitations, onCreate, isCreating, onCancel, isCancelling,
}) => {
  const { addToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState('stylist');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    // M-4: mutation's onError already toasts via useMutationToast, but we
    // catch here so an unexpected rejection (network blip, auth lock) can't
    // leave the async call dangling and so the generated-link UI only
    // appears on success.
    try {
      const token = await onCreate(selectedRole);
      setGeneratedLink(`${window.location.origin}/accept-invitation?token=${token}`);
    } catch {
      // Error is already surfaced via the mutation's toastOnError; swallow
      // so the promise chain stays clean.
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    // M-3: clipboard can fail (permission denied, non-HTTPS, browser quirks).
    // Don't flash "Copié" unless the write actually succeeded.
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({
        type: 'error',
        message: 'Impossible de copier le lien. Copiez-le manuellement depuis le champ.',
      });
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setGeneratedLink(null);
    setSelectedRole('stylist');
    setCopied(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Inviter un membre
        </button>
      ) : (
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-4">
          {!generatedLink ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="manager">Manager</option>
                  <option value="stylist">Styliste</option>
                  <option value="receptionist">Réceptionniste</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                  Générer le lien
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Lien d'invitation ({ROLE_LABELS[selectedRole]}) — expire dans {INVITATION_EXPIRY_DAYS} jours.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 truncate"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <button onClick={handleClose} className="text-sm text-slate-500 hover:text-slate-700">
                Fermer
              </button>
            </>
          )}
        </div>
      )}

      <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
        {invitations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Aucune invitation</div>
        ) : (
          invitations.map(inv => {
            const status = getStatus(inv);
            return (
              <div key={inv.id} className="flex items-center gap-4 p-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[inv.role] || 'bg-slate-100 text-slate-600'}`}>
                  {ROLE_LABELS[inv.role] || inv.role}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">
                    Créée le {formatDate(inv.created_at)} · Expire le {formatDate(inv.expires_at)}
                  </p>
                </div>

                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}>
                  {status.label}
                </span>

                {isPending(inv) && (
                  <button
                    onClick={() => onCancel(inv.id)}
                    disabled={isCancelling}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Annuler l'invitation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
