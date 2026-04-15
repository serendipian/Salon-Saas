import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, ChevronDown, X } from 'lucide-react';
import type { StaffMember } from '../../../types';

interface StaffSelectorProps {
  staffId?: string;
  staffName?: string;
  staffMembers: StaffMember[];
  onChange: (staffId: string | undefined, staffName: string | undefined) => void;
  /**
   * When set, only staff members whose `skills` include this category ID
   * are shown. Pass `null` (or omit) to show all active staff.
   */
  categoryId?: string | null;
}

export const StaffSelector: React.FC<StaffSelectorProps> = ({
  staffId,
  staffName,
  staffMembers,
  onChange,
  categoryId = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const eligibleStaff = useMemo(() => {
    const active = staffMembers.filter((s) => s.active);
    if (!categoryId) return active;
    return active.filter((s) => s.skills.includes(categoryId));
  }, [staffMembers, categoryId]);

  return (
    <div ref={ref} className="relative mt-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border transition-colors ${
          staffId
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
        }`}
      >
        <User size={10} />
        <span className="truncate max-w-[120px]">{staffName || 'Non attribué'}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        {staffId && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined, undefined);
              setIsOpen(false);
            }}
            className="ml-0.5 hover:text-red-500"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Sélectionner un membre"
          className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 max-h-48 overflow-y-auto"
          style={{ zIndex: 'var(--z-drawer-panel)' }}
        >
          <button
            role="option"
            aria-selected={!staffId}
            onClick={() => {
              onChange(undefined, undefined);
              setIsOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${
              !staffId ? 'text-slate-900 font-medium' : 'text-slate-500'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
              <User size={10} className="text-slate-400" />
            </div>
            Non attribué
          </button>
          {eligibleStaff.map((member) => (
            <button
              key={member.id}
              role="option"
              aria-selected={staffId === member.id}
              onClick={() => {
                onChange(member.id, `${member.firstName} ${member.lastName}`);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${
                staffId === member.id ? 'text-slate-900 font-medium bg-slate-50' : 'text-slate-700'
              }`}
            >
              {member.photoUrl ? (
                <img src={member.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${member.color || 'bg-slate-500 text-white'}`}
                >
                  {member.firstName[0]}
                  {member.lastName[0]}
                </div>
              )}
              {member.firstName} {member.lastName}
            </button>
          ))}
          {eligibleStaff.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">
              {categoryId ? 'Aucun membre qualifié' : 'Aucun membre actif'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
