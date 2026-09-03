import type { ReactNode } from 'react';
import { useViewTabAdapter } from './viewTabAdapters';
import { ViewTabStrip } from './ViewTabStrip';
import { viewTabDomId, viewTabPanelDomId } from './viewTabDomIds';
import './ViewTabBar.css';

interface ViewTabBarProps {
  panel: string;
  children: ReactNode;
}

/** Shell-owned host: resolves one connected adapter and supplies the tabpanel relationship. */
export function ViewTabBar({ panel, children }: ViewTabBarProps) {
  const adapter = useViewTabAdapter(panel);
  if (!adapter) return <>{children}</>;

  return (
    <>
      <ViewTabStrip
        panelId={adapter.panelId}
        label={adapter.label}
        tabs={adapter.tabs}
        activeId={adapter.activeId}
        onActivate={adapter.onActivate}
        onClose={adapter.onClose}
        add={adapter.add}
      />
      <div
        id={viewTabPanelDomId(adapter.panelId)}
        className="rv-view-tab-panel"
        role="tabpanel"
        aria-labelledby={viewTabDomId(adapter.panelId, adapter.activeId)}
        tabIndex={adapter.tabPanelTabIndex}
      >
        {children}
      </div>
    </>
  );
}
