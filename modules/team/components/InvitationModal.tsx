import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';

interface InvitationModalProps {
  staffRole: string;
  onCreateInvitation: (role: string) => Promise<string>;
  onClose: () => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  staffRole, onCreateInvitation, onClose,
}) => {
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      try {
        const token = await onCreateInvitation(staffRole);
        if (!cancelled) {
          setInvitationLink(`${window.location.origin}/accept-invitation?token=${token}`);
        }
      } catch {
        if (!cancelled) {
          setError('Erreur lors de la génération du lien');
        }
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    };
    generate();
    return () => { cancelled = true; };
  }, []);

  const handleCopy = async () => {
    if (!invitationLink) return;
    await navigator.clipboard.writeText(invitationLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Lien d'invitation</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {isGenerating ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
            <p className="text-sm text-slate-500">Génération du lien...</p>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Partagez ce lien avec le membre pour qu'il puisse créer son compte et rejoindre le salon.</p>
            <div className="flex items-center gap-2">
              <input type="text" value={invitationLink || ''} readOnly className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 truncate" />
              <button onClick={handleCopy} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <p className="text-xs text-slate-400">Ce lien expire dans 7 jours.</p>
          </div>
        )}
      </div>
    </div>
  );
};
