/**
 * @module chatSurfaceContract
 * @role Portable contract for the composable chat surface boundary
 *       (SPEC-02 §4/§5.1). Pure types plus React-free identity minting.
 *
 * This module owns no application state and imports no store, WebSocket
 * client, thread controller, service, filesystem API, or tab owner. It may be
 * imported by the portable `ChatSurface` presentation boundary and by the
 * connected host that projects application state into it.
 */

import type { RefObject, MutableRefObject } from 'react';
import type { BeginChatMaterialSource } from '../../lib/chat-material-source';
import type { HarnessStatus } from '../../types';
import type { ChatDiagnosticRouteIds } from '../../lib/ws/chat-diagnostic-handlers';
import type { ValidatedChatTurnDiagnosticReport } from '../../lib/chat/diagnostic-report';

/** Presentation-only host kind. Never changes membership, routing, or authority. */
export type ChatSurfaceHostKind = 'main' | 'side-tab';

/**
 * Canonical chat mount identity (SPEC-02 §4; BRIDGE-02 overlay §2).
 * `surfaceId` is transient mounted UI identity, minted at mount and never
 * persisted, sent, or used as session authority.
 */
export interface ChatMountIdentity {
  workspaceId: string;
  viewId: string | null;
  threadGroupId: string;
  threadId: string;
  surfaceId: string;
  host: ChatSurfaceHostKind;
  componentInstanceId?: string;
}

/**
 * One explicit session model. `modelId`/`variant` carry the last
 * server-acknowledged exact-session selection; `pending` marks an optimistic
 * selection that has not yet been acknowledged and therefore cannot become
 * Send authority (§6.2, CHAT-I-026).
 */
export interface ChatSurfaceModelSelection {
  modelId: string | null;
  variant: string | null;
  pending: boolean;
}

/** Stable shell state projected into one mounted `ChatSurface`. */
export interface ChatSurfaceShellPresentation {
  hasThread: boolean;
  isActive: boolean;
  isSendingForCurrentThread: boolean;
  connectingHarnessName: string | null;
  isThreadsCollapsed: boolean;
  isContentCollapsed: boolean;
}

/** Stable header state. Session activity is resolved by the connected header. */
export interface ChatSurfaceHeaderPresentation {
  threadName: string;
  harnessStatuses: Record<string, HarnessStatus>;
  showCliPicker: boolean;
  cliPickerOpen: boolean;
  /**
   * SPEC-04 §4 eligibility projection for the visible Move action. The server
   * remains authoritative; this only gates what the menu offers.
   */
  canMoveToSideChatBase: boolean;
}

/** Stable non-local composer state; local session stores are read by its leaf. */
export interface ChatSurfaceComposerPresentation {
  modelSelection: ChatSurfaceModelSelection;
}

/** Explicit user intents emitted by one mounted `ChatSurface`. */
export interface ChatSurfaceActions {
  onActivate: () => void;
  onSend: (text: string) => void;
  onCheckSubmissionStatus: () => void;
  onStop: () => void;
  onWarmIntent: () => void;
  onCreateThread: () => void;
  onHarnessSelect: (harnessId: string, modelId?: string) => void;
  onToggleContent: () => void;
  onToggleCliPicker: () => void;
  onCloseCliPicker: () => void;
  onRename: (name: string) => void;
  onCopyLink: () => void;
  onViewMarkdown: () => void;
  onOpenDiagnostics: () => void;
  /** SPEC-04 §4: move the current Main Chat into a Side Chat tab. */
  onMoveToSideChat: () => void;
  onModelSelectionChange: (patch: { modelId?: string | null; variant?: string | null }) => void;
  onRequestDiagnostic: (
    route: ChatDiagnosticRouteIds,
  ) => Promise<ValidatedChatTurnDiagnosticReport | null>;
  onCopyDiagnostic: (text: string) => Promise<void>;
  onAskAIWithDiagnostic: (prepare: () => Promise<string | null>) => Promise<boolean | 'pending-acceptance'>;
}

export interface ChatSurfaceProps extends ChatMountIdentity {
  shell: ChatSurfaceShellPresentation;
  header: ChatSurfaceHeaderPresentation;
  composer: ChatSurfaceComposerPresentation;
  actions: ChatSurfaceActions;
  /** Outer connected host toggles the owning rail (SPEC-02 §5.3). */
  onToggleThreads: () => void;
}

/** Imperative composer handle shared with the mounted surface. */
export interface ChatSurfaceInputHandle {
  insertText: (text: string) => void;
  appendText: (text: string) => void;
  replaceText: (text: string) => void;
  getText: () => string;
  focus: () => void;
  clearText: () => void;
  recordMaterialText?: (text: string) => void;
  readSelection?: () => { value: string; start: number; end: number } | null;
  restoreCaret?: (value: string, cursor: number, isCurrent: () => boolean) => void;
}

/**
 * Mount-local refs the connected host supplies to the portable surface
 * renders. Refs are not application state and are never global identity.
 */
export interface ChatSurfaceRefs {
  headerRef: RefObject<HTMLDivElement | null>;
  lastUserMsgRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<ChatSurfaceInputHandle | null>;
  materialRef: MutableRefObject<BeginChatMaterialSource | null>;
}

/** Stable, collision-safe DOM id suffix for one mounted surface. */
export function chatSurfaceDomId(surfaceId: string): string {
  return surfaceId.replace(/[^A-Za-z0-9_-]/g, '-');
}

// ── Transient surface identity minting ──────────────────────────────────────
// A non-component `main` host mints `surfaceId` at mount from its own runtime
// mount generation via
// `mintChatSurfaceId`, and never invents a component instance. A
// component-backed mount derives its transient `surfaceId` from the descriptor's
// unique `componentInstanceId` plus a runtime mount generation in
// `chatSurfaceRegistrationContract.ts` (`mintChatComponentSurfaceId`) /
// `ChatSurfaceComponentMount.tsx`; neither value is persisted or sent
// (BRIDGE-02 overlay §2 rule 4).

let runtimeMountGeneration = 0;

function randomSuffix(): string {
  const cryptoApi = typeof globalThis !== 'undefined'
    ? (globalThis.crypto as Crypto | undefined)
    : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Advance and return the runtime mount generation for one host mount. */
export function nextChatSurfaceMountGeneration(): number {
  runtimeMountGeneration += 1;
  return runtimeMountGeneration;
}

/**
 * Mint one transient surfaceId. `generation` must come from
 * `nextChatSurfaceMountGeneration()` so two mounts of one session never share
 * a surface identity.
 */
export function mintChatSurfaceId(host: ChatSurfaceHostKind, generation: number): string {
  return `chat-surface:${host}:${generation}:${randomSuffix()}`;
}
