/** Registers the committed composer lifetime with the existing Chat state owner. */
import { useLayoutEffect } from 'react';
import { useWorkspaceStore } from '../../state/workspaceStore';
import { usePanelStore } from '../../state/panelStore';
import { mountedChatIsHydrated, type MountedChatIdentity } from '../../state/slices/mountedChatState';

export function useMountedChatBinding(identity: MountedChatIdentity | null): void {
  const workspaceReady = useWorkspaceStore(state => state.hasReceivedInit && state.activeWorkspaceId === identity?.workspaceId && Boolean(state.workspaceEpoch));
  const workspaceSerial = useWorkspaceStore(state => state.bindingSerial);
  const hydrated = usePanelStore((state) => Boolean(identity && mountedChatIsHydrated(state, identity)));
  const retirement = usePanelStore((state) => identity ? state.chatMountRetirements[identity.surfaceId] ?? 0 : 0);
  useLayoutEffect(() => {
    if (!identity || !hydrated || !workspaceReady) return;
    const binding = usePanelStore.getState().registerMountedChat(identity);
    return () => { if (binding) usePanelStore.getState().unregisterMountedChat(binding); };
  }, [identity, hydrated, retirement, workspaceReady, workspaceSerial]);
}
