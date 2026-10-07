/**
 * @module sideChatBridge
 * @role Code-owned SPEC-04 Side Chat bridge above the existing view/tab adapter
 *       lookup (SPEC-04 §6, slice 04A).
 *
 * The Generic Host stays ignorant of chat semantics. This module reads the
 * SPEC-03 service-managed placement lane for one exact `{workspaceId, viewId,
 * threadGroupId}`, validates each persisted `fusion.chat-surface` descriptor,
 * and composes the open Side Chat tabs into the visible ordered rail produced
 * by the view's own adapter. It never reads primary history, never invents a
 * placement, and never persists any transient identity.
 */

import type { TabContentRecord } from '../view-tabs/componentTabTypes';
import { createFirstPartyComponentResolver } from '../view-tabs/componentTabResolver';
import type { ComponentTabShellProjection } from '../view-tabs/componentTabPresentationDomain';
import type { ViewTabAdapterModel } from '../view-tabs/viewTabAdapters';
import type { ViewTabContentAdapter } from '../view-tabs/viewTabContentAdapter';
import type { ViewTabDescriptor } from '../view-tabs/ViewTabStrip';
import { chatConnectedRegistrations } from './chatComponentRegistration';
import type { ThreadWorksurfaceEntry } from '../../lib/worksurface/types';
import { readOpenSideChatPlacements, SIDE_CHAT_COMPONENT_TYPE, type SideChatPlacement } from '../../lib/chat/side-chat-placements';

export const SIDE_CHAT_TAB_LABEL = 'Side Chat';

export function buildSideChatTabRecord(placement: SideChatPlacement): TabContentRecord {
  return {
    tabId: placement.placementId,
    content: { kind: 'component', revision: 1, component: placement.descriptor },
  };
}

export function buildSideChatTabDescriptor(
  placement: SideChatPlacement,
  viewIcon: string,
): ViewTabDescriptor {
  return {
    id: placement.placementId,
    label: SIDE_CHAT_TAB_LABEL,
    icon: viewIcon || 'forum',
    closeLabel: `Close ${SIDE_CHAT_TAB_LABEL}`,
    // SPEC-04 §7 close disposition (Slice 04C): closing removes only the
    // placement through the owning view's managed-placement lane; it never
    // deletes the member session, transcript, Provenance, or membership.
    closable: true,
  };
}

export function buildSideChatShell(placement: SideChatPlacement): ComponentTabShellProjection {
  return {
    schemaVersion: 2,
    tabId: placement.placementId,
    presenterId: SIDE_CHAT_COMPONENT_TYPE,
    location: {
      schemaVersion: 1,
      segments: [{ label: SIDE_CHAT_TAB_LABEL }],
    },
  };
}

export interface SideChatBridgeContext {
  workspaceId: string;
  viewId: string;
  viewIcon: string;
  entry: ThreadWorksurfaceEntry | null;
  activePlacementId: string | null;
  /** The group whose placement lane backs this rail (for close disposition). */
  threadGroupId: string | null;
  /** Focus a Side Chat tab; the placement itself is durable and untouched. */
  onFocusPlacement: (placementId: string) => void;
  /** Return focus to the view's native surface. */
  onFocusNative: () => void;
  /**
   * SPEC-04 §7: close one Side Chat placement. Records a durable `closed`
   * disposition through the owning view's managed-placement lane; the member
   * session and its transcript/Provenance/membership are never touched.
   */
  onClosePlacement: (placementId: string) => void;
}

function sideContent(
  base: ViewTabContentAdapter | undefined,
  placement: SideChatPlacement,
): ViewTabContentAdapter {
  const resolve = base?.resolve
    ?? createFirstPartyComponentResolver(chatConnectedRegistrations());
  return {
    active: buildSideChatTabRecord(placement),
    shell: buildSideChatShell(placement),
    reservation: null,
    resolve,
    retryLauncher: base?.retryLauncher ?? (() => undefined),
    cancelLauncher: base?.cancelLauncher ?? (() => undefined),
  };
}

/**
 * Compose the open Side Chat placements into the visible rail. With no open
 * placement the base adapter is returned byte-identical, so every non-Move
 * path is unchanged.
 */
export function composeSideChatAdapter(
  base: ViewTabAdapterModel | null,
  context: SideChatBridgeContext,
): ViewTabAdapterModel | null {
  const placements = readOpenSideChatPlacements(context.entry, context.viewId);
  if (placements.length === 0) return base;

  const sideTabs = placements.map((placement) => (
    buildSideChatTabDescriptor(placement, context.viewIcon)
  ));
  const sideIds = new Set(placements.map((placement) => placement.placementId));
  const focused = context.activePlacementId && sideIds.has(context.activePlacementId)
    ? context.activePlacementId
    : null;
  const focusedPlacement = focused
    ? placements.find((placement) => placement.placementId === focused) ?? null
    : null;
  // With no native connected surface (or an unfocused rail) the first open
  // Side Chat is the default visible tab; a native tab otherwise keeps focus.
  const defaultSidePlacement = (!base || !base.content) ? placements[0] : null;
  const activeSidePlacement = focusedPlacement ?? defaultSidePlacement;

  const baseTabs = base?.tabs ?? [];
  const tabs = [...baseTabs, ...sideTabs];
  const activeId = activeSidePlacement
    ? activeSidePlacement.placementId
    : (base?.activeId ?? placements[0].placementId);

  const wrapActivate = (baseOnActivate: ((id: string) => void) | undefined) => (id: string) => {
    if (sideIds.has(id)) {
      context.onFocusPlacement(id);
      return;
    }
    context.onFocusNative();
    baseOnActivate?.(id);
  };
  const wrapClose = (baseOnClose: ((id: string) => void) | undefined) => (id: string) => {
    if (sideIds.has(id)) {
      context.onClosePlacement(id);
      return;
    }
    baseOnClose?.(id);
  };

  if (activeSidePlacement) {
    return {
      panelId: base?.panelId ?? context.viewId,
      label: base?.label ?? 'Open tabs',
      tabs,
      activeId,
      tabPanelTabIndex: base?.tabPanelTabIndex ?? -1,
      onActivate: wrapActivate(base?.onActivate),
      onClose: wrapClose(base?.onClose),
      ...(base?.add ? { add: base.add } : {}),
      // SPEC-04 §3: the Side Chat uses the same composable surface and no
      // nested rail; the surface mounts through the accepted resolver.
      content: sideContent(base?.content, activeSidePlacement),
    };
  }

  return {
    panelId: base?.panelId ?? context.viewId,
    label: base?.label ?? 'Open tabs',
    tabs,
    activeId,
    tabPanelTabIndex: base?.tabPanelTabIndex ?? -1,
    onActivate: wrapActivate(base?.onActivate),
    onClose: wrapClose(base?.onClose),
    ...(base?.add ? { add: base.add } : {}),
    ...(base?.content ? { content: base.content } : {}),
  };
}

/**
 * Stable runtime-only root tab id for one adapterless view. It is a plain
 * `ViewTabDescriptor.id` in the view-chrome model — never a
 * `ComponentDescriptor`, never persisted, registered, or handed to the Generic
 * Host as a tab record.
 */
export function viewRootTabId(viewId: string): string {
  return `view-root:${viewId}`;
}

export interface AdapterlessSideChatContext extends SideChatBridgeContext {
  /** Bounded display label for the view's existing child. */
  viewLabel: string;
}

/**
 * SPEC-04 §6/§11 04B adapterless composition. For a registered chat-capable
 * view with no native tab adapter (Wiki/Office/Email/Issues/Agents/Browser),
 * the bridge activates ONLY while at least one open managed placement exists
 * for the exact `{workspaceId, viewId, threadGroupId}`: it constructs a
 * runtime-only root descriptor representing the view's existing child and
 * appends the managed Side Chats. The child renders only while the root tab is
 * active; with zero placements this returns null so `ViewTabBar` renders
 * `<>{children}</>` byte-identically.
 */
export function composeAdapterlessSideChatRail(
  context: AdapterlessSideChatContext,
): ViewTabAdapterModel | null {
  const placements = readOpenSideChatPlacements(context.entry, context.viewId);
  if (placements.length === 0) return null;

  const rootId = viewRootTabId(context.viewId);
  const rootTab: ViewTabDescriptor = {
    id: rootId,
    label: context.viewLabel,
    icon: context.viewIcon || 'tab',
    closeLabel: `Close ${context.viewLabel}`,
    closable: false,
  };
  const sideTabs = placements.map((placement) => (
    buildSideChatTabDescriptor(placement, context.viewIcon)
  ));
  const sideIds = new Set(placements.map((placement) => placement.placementId));
  const focusedPlacement = context.activePlacementId && sideIds.has(context.activePlacementId)
    ? placements.find((placement) => placement.placementId === context.activePlacementId) ?? null
    : null;
  // The existing child is the default presentation; a Side Chat renders only
  // while its own tab is focused.
  const activeId = focusedPlacement ? focusedPlacement.placementId : rootId;

  const onActivate = (id: string) => {
    if (sideIds.has(id)) {
      context.onFocusPlacement(id);
      return;
    }
    context.onFocusNative();
  };
  const onClose = (id: string) => {
    if (sideIds.has(id)) context.onClosePlacement(id);
  };

  return {
    panelId: context.viewId,
    label: context.viewLabel,
    tabs: [rootTab, ...sideTabs],
    activeId,
    tabPanelTabIndex: -1,
    onActivate,
    // Closing a Side Chat records a durable closed disposition through the
    // owning view's placement lane; the runtime-only root never closes.
    onClose,
    ...(focusedPlacement ? { content: sideContent(undefined, focusedPlacement) } : {}),
  };
}

