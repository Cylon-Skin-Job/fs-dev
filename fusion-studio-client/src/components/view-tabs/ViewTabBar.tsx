import { useSyncExternalStore } from 'react';
import { getViewTabAdapter } from './viewTabAdapters';
import { ViewTabStrip } from './ViewTabStrip';
import { resolveViewTabBarModel } from './resolveViewTabBarModel';

const EMPTY_SNAPSHOT = Object.freeze({});
const subscribeToNothing = () => () => undefined;
const getEmptySnapshot = () => EMPTY_SNAPSHOT;

export function ViewTabBar({ panel }: { panel: string }) {
  const adapter = getViewTabAdapter(panel);
  const snapshot = useSyncExternalStore(
    adapter?.subscribe ?? subscribeToNothing,
    adapter?.getSnapshot ?? getEmptySnapshot,
    adapter?.getSnapshot ?? getEmptySnapshot,
  );

  if (!adapter) return null;
  const model = resolveViewTabBarModel(adapter, snapshot);
  if (!model) return null;
  return (
    <div className="rv-view-tab-bar">
      <ViewTabStrip {...model} />
    </div>
  );
}
