import React, { useState } from 'react';
import { X, Copy, Check, Send } from 'lucide-react';

interface InvitationModalProps {
  staffEmail?: string;
  staffRole: string;
  onCreateInvitation: (email: string, role: string) => Promise<string>;
  onClose: () => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  staffEmail, staffRole, onCreateInvitation, onClose,
}) => {
  const [email, setEmail] = useState(staffEmail || '');
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      const token = await onCreateInvitation(email, staffRole);
      setInvitationLink(`${window.location.origin}/accept-invitation?token=${token}`);
    } catch {
      // Error handled by hook toast
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <h3 className="text-lg font-semibold text-slate-900">Inviter par lien</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {!invitationLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">R\u00f4le</label>
              <input type="text" value={staffRole} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500" />
            </div>
            <button type="submit" disabled={isSubmitting || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg font-medium hover:bg-pink-600 disabled:opacity-50">
              <Send className="w-4 h-4" /> {isSubmitting ? 'G\u00e9n\u00e9ration...' : 'G\u00e9n\u00e9rer le lien'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Partagez ce lien avec le membre pour qu'il puisse cr\u00e9er son compte et rejoindre le salon.</p>
            <div className="flex items-center gap-2">
              <input type="text" value={invitationLink} readOnly className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 truncate" />
              <button onClick={handleCopy} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copi\u00e9' : 'Copier'}
              </button>
            </div>
            <p className="text-xs text-slate-400">Ce lien expire dans 7 jours.</p>
          </div>
        )}
      </div>
    </div>
  );
};
