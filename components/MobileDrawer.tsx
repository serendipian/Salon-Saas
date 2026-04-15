import type { LucideIcon } from 'lucide-react';
import { UserCircle, X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

interface DrawerNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: string;
  onNavigate: (module: string) => void;
  mainNavItems: DrawerNavItem[];
  managementNavItems: DrawerNavItem[];
  settingsItem?: DrawerNavItem;
  salonName: string;
  onProfilePress?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeModule,
  onNavigate,
  mainNavItems,
  managementNavItems,
  settingsItem,
  salonName,
  onProfilePress,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap + Escape key + focus restoration
  useEffect(() => {
    if (!isOpen) return;

    // Save the element that had focus before opening
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the close button on open
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Simple focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that triggered the drawer
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  // Set inert on main content
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (isOpen && main) {
      main.setAttribute('inert', '');
      return () => main.removeAttribute('inert');
    }
  }, [isOpen]);

  const handleNavClick = (id: string) => {
    onNavigate(id);
    onClose();
  };

  const renderItem = (item: DrawerNavItem) => {
    const isActive = activeModule === item.id || activeModule.startsWith(item.id + '/');
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
          isActive
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
        {item.label}
      </button>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 'var(--z-drawer-backdrop)' }}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ zIndex: 'var(--z-drawer-panel)' }}
      >
        {/* Drawer header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {salonName.charAt(0) || 'L'}
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              {salonName || 'Salon'}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer la navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-4 mb-3 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
            Menu Principal
          </div>
          {mainNavItems.map((item) => (
            <React.Fragment key={item.id}>
              {renderItem(item)}
              {item.id === 'finances' && (
                <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5">
                  {[
                    { id: 'finances/revenus', label: 'Revenus' },
                    { id: 'finances/depenses', label: 'Dépenses' },
                    { id: 'finances/journal', label: 'Journal' },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => handleNavClick(sub.id)}
                      className={`flex items-center w-full px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all min-h-[44px] ${
                        activeModule === sub.id
                          ? 'text-slate-900 bg-slate-100'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}

          {managementNavItems.length > 0 && (
            <>
              <div className="my-3 border-t border-slate-100 mx-2" />
              <div className="px-4 mb-3 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Gestion
              </div>
              {managementNavItems.map(renderItem)}
            </>
          )}

          {settingsItem && (
            <>
              <div className="my-3 border-t border-slate-100 mx-2" />
              {renderItem(settingsItem)}
            </>
          )}

          {onProfilePress && (
            <>
              <div className="my-3 border-t border-slate-100 mx-2" />
              <button
                onClick={() => {
                  onProfilePress();
                  onClose();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all min-h-[44px]"
              >
                <UserCircle size={20} strokeWidth={1.5} />
                Mon profil
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
