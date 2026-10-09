/** Registers the committed composer lifetime with the existing Chat state owner. */
import { useLayoutEffect, useMemo } from 'react';
import { useWorkspaceStore } from '../../state/workspaceStore';
import { usePanelStore } from '../../state/panelStore';
import { mountedChatIsHydrated, type MountedChatBinding, type MountedChatIdentity } from '../../state/slices/mountedChatState';

export function useMountedChatBinding(identity: MountedChatIdentity | null) {
  const workspaceReady = useWorkspaceStore(state => state.hasReceivedInit && state.activeWorkspaceId === identity?.workspaceId && Boolean(state.workspaceEpoch));
  const workspaceSerial = useWorkspaceStore(state => state.bindingSerial);
  const hydrated = usePanelStore((state) => Boolean(identity && mountedChatIsHydrated(state, identity)));
  const retirement = usePanelStore((state) => identity ? state.chatMountRetirements[identity.surfaceId] ?? 0 : 0);
  const lease = useMemo<{ current: MountedChatBinding | null }>(() => ({ current: null }),
    [identity, hydrated, retirement, workspaceReady, workspaceSerial]);
  useLayoutEffect(() => {
    if (!identity || !hydrated || !workspaceReady) return;
    const binding = usePanelStore.getState().registerMountedChat(identity);
    lease.current = binding;
    return () => { lease.current = null; if (binding) usePanelStore.getState().unregisterMountedChat(binding); };
  }, [identity, hydrated, retirement, workspaceReady, workspaceSerial, lease]);
  return lease;
}
