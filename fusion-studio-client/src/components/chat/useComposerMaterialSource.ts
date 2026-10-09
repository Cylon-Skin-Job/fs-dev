/** Adapts one committed composer lifetime to the existing material action owner. */
import { useCallback, useLayoutEffect, useRef } from 'react';
import { beginChatMaterial, commitChatMaterial, validateChatMaterial } from '../../lib/chat-action';
import type { BeginChatMaterialSource } from '../../lib/chat-material-source';
import { showToast } from '../../lib/toast';
import { usePanelStore } from '../../state/panelStore';
import { chatComposerDraftOwnerKey, useChatComposerDraftStore } from '../../state/chatComposerDraftStore';
import { chatSubmissionOwnerKey, useChatSubmissionStore } from '../../state/chatSubmissionStore';
import type { MountedChatBinding } from '../../state/slices/mountedChatState';
import type { ChatSurfaceRefs } from './chatSurfaceContract';

export function useComposerMaterialSource(
  lease: { current: MountedChatBinding | null },
  inputRef: ChatSurfaceRefs['inputRef'],
  materialRef: ChatSurfaceRefs['materialRef'],
  isActive: boolean,
): BeginChatMaterialSource {
  const controllers = useRef(new Set<AbortController>());
  useLayoutEffect(() => () => { controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); }, [lease]);
  const warmEligible = useRef(isActive);
  warmEligible.current = isActive;
  const begin = useCallback<BeginChatMaterialSource>((options) => {
    const cancel = new AbortController();
    const started = beginChatMaterial(lease.current, cancel.signal);
    if (started.status !== 'ready') {
      showToast(started.status === 'unavailable' && started.reason === 'busy' ? 'Wait for message acceptance' : 'Chat target unavailable');
      return started;
    }
    controllers.current.add(cancel);
    const operation = started.operation, owner = operation.owner;
    const editor = inputRef.current;
    const current = () => lease.current === owner && !validateChatMaterial(operation);
    const present = (result: Awaited<ReturnType<typeof commitChatMaterial>>) => {
      if (result.status !== 'applied' && result.status !== 'noop') {
        showToast(result.status === 'unavailable' && result.reason === 'busy' ? 'Wait for message acceptance' : 'Unable to add material to chat');
        return;
      }
      // Warm remains best effort and targets only this captured session.
      const phase = useChatSubmissionStore.getState().attemptsByOwner[chatSubmissionOwnerKey(owner.workspaceId, owner.threadId)]?.phase;
      if (options?.warm !== false && current() && warmEligible.current && phase !== 'pending' && phase !== 'unknown') {
        try { usePanelStore.getState().warmThread(owner.threadId); } catch { /* Local insertion remains successful. */ }
      }
    };
    return { status: 'ready', source: {
      signal: cancel.signal,
      cancel: () => { cancel.abort(); controllers.current.delete(cancel); },
      fail: async () => {
        const result = await commitChatMaterial(operation, { sourceFailure: true });
        controllers.current.delete(cancel);
        present(result);
        return result;
      },
      attachment: async (attachment) => {
        const result = await commitChatMaterial(operation, { attachment });
        controllers.current.delete(cancel);
        present(result);
        return result;
      },
      text: async (text) => {
        // Never read the current/rebound editor before validating the captured lifetime.
        const live = current() && !options?.append ? editor?.readSelection?.() : null;
        const store = useChatComposerDraftStore.getState(), key = chatComposerDraftOwnerKey(owner.workspaceId, owner.threadId);
        const selection = live && live.value === (store.draftsByOwner[key] ?? '')
          ? { ...live, surfaceId: owner.surfaceId, generation: owner.generation, revision: store.revisionsByOwner[key] ?? 0 } : undefined;
        const result = await commitChatMaterial(operation, { text, selection });
        controllers.current.delete(cancel);
        present(result);
        if (result.status === 'applied' && current()) {
          if (!options?.append) editor?.recordMaterialText?.(text);
          const value = useChatComposerDraftStore.getState().draftsByOwner[key] ?? '';
          const cursor = selection ? selection.start + text.length : value.length;
          editor?.restoreCaret?.(value, cursor, current);
        }
        return result;
      },
    } };
  }, [lease, inputRef]);
  useLayoutEffect(() => {
    materialRef.current = begin;
    return () => { if (materialRef.current === begin) materialRef.current = null; };
  }, [materialRef, begin]);
  return begin;
}
