import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useUi } from '@/store/ui';

export function TopBar({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  const setNavOpen = useUi((state) => state.setNavOpen);

  return (
    <header className="topbar">
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm mobile-only"
        onClick={() => setNavOpen(true)}
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>
      <div className="topbar-title">
        <h1 className="truncate">{title}</h1>
        {subtitle && <span className="topbar-sub truncate">{subtitle}</span>}
      </div>
      <span className="spacer" />
      {children}
    </header>
  );
}
