/** Real rendered material route; only transport responses and source delay are controlled. */
import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useWorkspaceStore } from '../../src/state/workspaceStore';
import { usePanelStore } from '../../src/state/panelStore';
import { useChatComposerDraftStore as drafts } from '../../src/state/chatComposerDraftStore';
import { useChatFileLinkStore as attachments } from '../../src/state/chatFileLinkStore';
import { useChatSubmissionStore as submissions } from '../../src/state/chatSubmissionStore';
import { ViewTabStrip } from '../../src/components/view-tabs/ViewTabStrip';
import { useSideChatRailAdapter } from '../../src/components/chat/useSideChatRailAdapter';
import { ChatSurfaceComponentMount } from '../../src/components/chat/ChatSurfaceComponentMount';
import { ChatSessionHost } from '../../src/components/chat/ChatSessionHost';
import { ViewChatHost } from '../../src/components/chat/ViewChatHost';
import { SendToChatButton } from '../../src/components/SendToChatButton';
import { FloatingPathActions } from '../../src/components/FloatingPathActions';
import { installChatActionConsumer } from '../../src/lib/chat-action-controller';
import { beginChatMaterial, commitChatMaterial } from '../../src/lib/chat-action';
import { registerToastSetter } from '../../src/lib/toast';
import { handleThreadMessage } from '../../src/lib/ws/thread-handlers';
import { handleWorksurfaceMessage } from '../../src/lib/ws/worksurface-handlers';
import { installProductSendCapability } from '../../src/lib/ws/product-send';

const W = 'material-workspace', V = 'wiki-viewer', G = 'material-group', M = 'main-session', S = 'side-session';
const frames: any[] = [], notices: string[] = [];
const entry = (name: string) => ({ name, createdAt: '2026-01-01T00:00:00Z', messageCount: 0, status: 'active' });
const rows = [{ threadId: M, threadGroupId: G, viewId: V, entry: entry('Main material'), currentPrimarySequence: 1 },
  { threadId: 'other-main', threadGroupId: 'other-group', viewId: V, entry: entry('Other material') }];
const empty = () => ({ messages: [], currentTurn: null, pendingTurnEnd: false, segments: [],
  lastReleasedSegmentCount: 0, pendingSavedExchanges: {}, pendingExchangeSaveTurnId: null, activity: null });
const descriptor = { componentTypeId: 'fusion.chat-surface', componentInstanceId: 'material-side-component',
  input: { workspaceId: W, viewId: V, threadGroupId: G, threadId: S, host: 'side-tab' } };
const placementEntry = { managedComponentPlacements: { 'side-placement': { disposition: 'open', descriptor } },
  placementRevision: 'placement-1', contentRevision: 'content-1' };
let sourceReads = 0;
const roots = { get 'file-viewer'() { sourceReads++; return '/source-workspace/files'; }, 'wiki-viewer': '/source-workspace/wiki' };
function sendTransport(value: string) {
  const frame = JSON.parse(value); frames.push(frame);
  if (['state:worksurface_get', 'state:worksurface_put'].includes(frame.type)) queueMicrotask(() => {
    const state = usePanelStore.getState(), stored = state.worksurfaceEntries[`${W}::${V}::${frame.threadGroupId}`];
    const entry = frame.type === 'state:worksurface_put' ? { ...stored, schemaVersion: 1,
      adapterId: V, adapterVersion: 1, contentRevision: 'fixture-content', placementRevision: stored?.placementRevision ?? 'fixture-placement',
      content: frame.content, managedComponentPlacements: stored?.managedComponentPlacements ?? {} } : stored ?? null;
    handleWorksurfaceMessage({ type: 'state:worksurface_result', workspaceId: W, viewId: V,
      threadGroupId: frame.threadGroupId, requestId: frame.requestId, lane: 'content', entry,
      contentRevision: entry?.contentRevision ?? null, placementRevision: entry?.placementRevision ?? null,
      applied: true, acknowledged: true } as never);
  });
}
const socket = { readyState: WebSocket.OPEN, send: sendTransport } as WebSocket;
installProductSendCapability({ socket, generation: 'material-fixture', isAuthenticated: () => true,
  captureBinding: (id) => id === W ? { workspaceId: W, workspaceEpoch: 'material-epoch', bindingRevision: 1, bindingSerial: 1 } : null,
  isBindingCurrent: () => usePanelStore.getState().activeWorkspaceId === W,
  sendProductResult: (value, _policy, current) => {
    if (!current()) return { status: 'not_enqueued', reason: 'stale_binding' };
    const frame = JSON.parse(value); sendTransport(value);
    if (frame.type === 'thread:open-assistant') queueMicrotask(() => {
      const row = { threadId: 'created-main', threadGroupId: 'created-group', viewId: V, entry: entry('Created material') };
      rows.unshift(row);
      handleThreadMessage({ type: 'thread:created', workspaceId: W, viewId: V, threadId: row.threadId, threadGroupId: row.threadGroupId, thread: row.entry } as never);
      handleThreadMessage({ type: 'thread:opened', workspaceId: W, viewId: V, threadId: row.threadId, threadGroupId: row.threadGroupId, thread: row.entry, exchanges: [] } as never);
    });
    if (frame.type === 'thread:open' && !frame.historyOnly) {
      const row = rows.find((item) => item.threadGroupId === frame.threadGroupId);
      if (row) queueMicrotask(() => handleThreadMessage({ type: 'thread:opened', workspaceId: W, viewId: V,
        threadId: row.threadId, threadGroupId: row.threadGroupId, thread: row.entry, exchanges: [] } as never));
    }
    return { status: 'enqueued', destination: 'socket' };
  } });
useWorkspaceStore.setState({ activeWorkspaceId: W, workspaceEpoch: 'material-epoch', bindingSerial: 1, bindingRevision: 1, hasReceivedInit: true });
usePanelStore.setState({ activeWorkspaceId: W, currentPanel: V, currentThreadId: 'stale-legacy', chatActive: true,
  ws: socket, threads: rows, panelRoots: roots, panelConfigs: [], viewStates: {},
  threadGroupsByWorkspaceAndView: { [W]: { [V]: rows } }, currentThreadGroupIdByWorkspaceAndView: { [W]: { [V]: G } },
  worksurfaceEntries: { [`${W}::${V}::${G}`]: placementEntry }, sideChatActivePlacementByView: { [`${W}::${V}`]: 'side-placement' },
  projectChats: { [M]: empty(), [S]: empty(), 'other-main': empty(), 'hidden-main': empty() },
  wireReadyByThread: { [M]: true, [S]: true },
} as never);
drafts.getState().setDraft(W, M, 'MAIN DRAFT'); drafts.getState().setDraft(W, S, 'SIDE DRAFT');
registerToastSetter((message) => notices.push(message));
installChatActionConsumer(); installChatActionConsumer();
let held: any, lastResult: any, abortController: AbortController;
let renderControl: any;
const fixture = {
  notices, frames,
  begin: (surface?: string) => {
    held = beginChatMaterial(surface ? usePanelStore.getState().mountedChats[surface] : undefined);
    return held.status;
  },
  beginAbort: () => { abortController = new AbortController(); held = beginChatMaterial(undefined, abortController.signal); return held.status; },
  abort: () => abortController.abort(),
  complete: async (material: any = { text: 'PREPARED' }) => {
    lastResult = held.status === 'ready' ? await commitChatMaterial(held.operation, material) : held;
    return lastResult.status;
  },
  snapshot: () => ({ drafts: drafts.getState().draftsByOwner, attachments: attachments.getState().pendingAttachmentsByOwner,
    selected: usePanelStore.getState().currentThreadGroupIdByWorkspaceAndView,
    generations: attachments.getState().attachmentGenerationsByOwner, revisions: drafts.getState().revisionsByOwner,
    active: usePanelStore.getState().activeMountedChat?.threadId ?? null,
    activeSurface: usePanelStore.getState().activeMountedChat?.surfaceId ?? null,
    mounts: Object.values(usePanelStore.getState().mountedChats).map(({ threadId, generation, surfaceId, binding, componentInstanceId }) => ({ threadId, generation, surfaceId, binding, componentInstanceId })),
    sourceReads, frames, notices, result: lastResult?.status }),
  lose: (what: string) => {
    const state = usePanelStore.getState();
    if (what === 'workspace') { usePanelStore.setState({ activeWorkspaceId: 'foreign' }); usePanelStore.setState({ activeWorkspaceId: W }); }
    if (what === 'hydration') { usePanelStore.setState({ projectChats: {} }); usePanelStore.setState({ projectChats: state.projectChats }); }
    if (what === 'placement') { usePanelStore.setState({ worksurfaceEntries: {} }); usePanelStore.setState({ worksurfaceEntries: state.worksurfaceEntries }); }
    if (what === 'group') { usePanelStore.setState({ threadGroupsByWorkspaceAndView: {} }); }
    if (what === 'binding') { const workspace = useWorkspaceStore.getState(); workspace.beginInit(); workspace.applyWorkspaceBinding(W, 'material-epoch', null, null, null, 1); workspace.markInit(); }
    if (what === 'socket') { usePanelStore.setState({ ws: null }); usePanelStore.setState({ ws: socket }); }
  },
  foreignView: (foreign: boolean) => usePanelStore.setState({ currentPanel: foreign ? 'file-viewer' : V }),
  placementSelect: () => usePanelStore.getState().setActiveSideChatPlacement(W, V, 'side-placement'),
  selectMain: () => usePanelStore.getState().setCurrentThreadGroupId(W, V, G),
  pending: (phase: 'pending' | 'unknown') => submissions.getState().begin({ workspaceId: W, threadId: M,
    requestId: 'material-pending', text: 'submitted', draftRevision: 1, attachmentIds: [], attachmentGenerations: {}, phase }),
  requestMain: () => usePanelStore.getState().requestChatActivation({ workspaceId: W, viewId: V, threadGroupId: G, threadId: M, host: 'main', binding: 'view' }),
  render: (patch: any) => renderControl(patch),
  adapterless: () => usePanelStore.setState({ threadGroupsByWorkspaceAndView: {}, currentThreadGroupIdByWorkspaceAndView: {} }),
  restoreMain: () => usePanelStore.setState({ threadGroupsByWorkspaceAndView: { [W]: { [V]: [...rows] } } }),
  frame: (value: any) => handleThreadMessage(value),
};
(window as any).__material = fixture;
function SideRail() {
  const rail = useSideChatRailAdapter(V, null);
  return rail ? <ViewTabStrip {...rail} /> : null;
}
function Fixture() {
  const [state, setState] = useState({ main: true, side: true, collapsed: false, extra: false, foreign: false, explicit: false });
  renderControl = (patch: any) => setState((old) => ({ ...old, ...patch }));
  return <>
    <div id="resource"><SendToChatButton panel="file-viewer" relativePath="real-source.ts" />
      <SendToChatButton panel="wiki-viewer" relativePath="Topic/PAGE.md" title="Attach wiki" />
      <FloatingPathActions panel="file-viewer" relativePath="folder" /></div>
    {state.main && <div id="main">{state.collapsed
      ? <ChatSessionHost panel={V} workspaceId={W} viewId={V} threadGroupId={G} threadId={M} host="main" collapsed />
      : <ViewChatHost panel={V} workspaceId={W} viewId={V} />}</div>}
    {state.side && <div id="side"><SideRail /><ChatSurfaceComponentMount descriptor={state.foreign
      ? { ...descriptor, input: { ...descriptor.input, workspaceId: 'foreign' } } : descriptor} /></div>}
    {state.extra && <div id="extra" style={{ display: 'none' }}><ChatSessionHost panel="hidden" workspaceId={W}
      viewId={V} threadGroupId={G} threadId={M} host="main" /></div>}
    {state.explicit && <div id="explicit"><ChatSurfaceComponentMount descriptor={{ ...descriptor,
      componentInstanceId: 'material-main-component', input: { ...descriptor.input, threadId: M, host: 'main' } }} /></div>}
  </>;
}
createRoot(document.querySelector('#root')!).render(<StrictMode><Fixture /></StrictMode>);
