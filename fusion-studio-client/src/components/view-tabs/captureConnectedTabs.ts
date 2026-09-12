/**
 * @module captureConnectedTabs
 * @role VIEW-02 Slice 3 — view-side entry points into the connected Capture
 *       owner's serialized intent lane (SPEC-02 §8/§9, VRT-012).
 *
 * The connected adapter hook registers its runtime here so view modules
 * OUTSIDE the adapter (CaptureTiles preview actions, the document presenter,
 * and the file-identity rewrite handlers) can call TABS-03 placement and
 * owner transitions through the SAME lane without importing stores into the
 * shell. Nothing here reimplements matching/fill/append/reveal — that is
 * entirely the accepted TABS-03 controller's job; owner rewrites go through
 * the runtime's atomic acknowledged `commit` port (fresh-read verified).
 */

import { usePanelStore } from '../../state/panelStore';
import { showToast } from '../../lib/toast';
import type { ViewUIState } from '../../types/view-state';
import type { ConnectedTabOwnerRuntime } from './componentTabConnectedOwner';
import type { ConnectedTabOwnerPorts } from './componentTabConnectedOwner';
import { canonicalCapturePath, normalizeCaptureTabs } from './captureTabDomain';
import {
  CAPTURE_DOCUMENT_PRESENTER_ID,
  CAPTURE_HOME_TARGET_KEY,
  CAPTURE_LANDING_COMPONENT_TYPE,
  CAPTURE_UNAVAILABLE_PRESENTER_ID,
  CAPTURE_UNAVAILABLE_TARGET_KEY,
  CAPTURE_VIEWER_TARGET_KEY_PREFIX,
  captureCollectionLabel,
} from './captureConnectedPresenterTargets';
import {
  CAPTURE_TAB_RECORDS_FIELD,
  findComponentTargetKey,
  parseCaptureTabRecordsDocument,
} from './captureConnectedOwnerPorts';
import {
  classicProjectionFromViewState,
  planCaptureClassicConversion,
} from './captureClassicConversion';
import { getFileIcon } from '../../lib/file-utils';
import type {
  TabPlacementSnapshot,
  TabPlacementSnapshotRecord,
} from './componentTabPlacementTypes';

export const CAPTURE_PANEL_ID = 'capture-viewer';

function presenceOf(viewState: Partial<ViewUIState> | undefined): unknown {
  return viewState?.[CAPTURE_TAB_RECORDS_FIELD as keyof NonNullable<typeof viewState>];
}

/** True when the content is the view's Home blank (the landing presenter). */
function isCaptureHomeBlankContent(content: unknown): boolean {
  if (typeof content !== 'object' || content === null) return false;
  const component = (content as { component?: unknown }).component;
  if (typeof component !== 'object' || component === null) return false;
  const record = component as { componentTypeId?: unknown; targetKey?: unknown };
  return record.componentTypeId === CAPTURE_LANDING_COMPONENT_TYPE
    && record.targetKey === CAPTURE_HOME_TARGET_KEY;
}

/**
 * Post-close guard predicate (SPEC-02 §6): a PRESENT records document (even a
 * valid empty one, or one too malformed to parse) with no surviving legacy
 * tabs means generic ownership was established and the user closed every
 * tab. Neither conversion nor the initial policy may re-arm on a fresh owner
 * runtime; the classic surface beneath is the established owner lifecycle
 * until legacy tabs (created through it) normalize once back into the
 * records. The connected adapter gates its enablement on this predicate.
 */
export function capturePostCloseEstablished(
  viewState: Partial<ViewUIState> | undefined,
): boolean {
  const presence = presenceOf(viewState);
  if (presence == null) return false;
  const legacyTabs = normalizeCaptureTabs(viewState?.docViewerTabs, viewState?.docViewerActiveTabId);
  if (legacyTabs.tabs.length > 0) return false;
  const parsed = parseCaptureTabRecordsDocument(presence);
  return parsed === null || parsed.tabs.length === 0;
}

/**
 * The ONE-TIME classic-state conversion (SPEC-02 §6), run inside the owner
 * intent lane BEFORE the initial policy effect. Hydrated generic records win;
 * an unavailable full-page state seeds the bounded unavailable presenter; the
 * default shape falls through to the configured initial policy.
 *
 * VIEW-02 §9 hydration reconciliation: generic records that predate the
 * persisted state landing can only be the session blank (the initial policy
 * created them while the view-state document was still in flight — the S3
 * advisory A1 async window). When persisted classic tabs exist, those tabs are
 * the user's real state: the blank artifact is discarded and the classic tabs
 * convert (never silently reset). Genuine hydrated records — any document tab,
 * or any blank once no persisted classic tabs exist — still win, and a lone
 * persisted blank sentinel is never eaten.
 *
 * Post-close guard (SPEC-02 §6): a PRESENT, valid, empty records document
 * means generic ownership was established and the user closed every tab —
 * the collection reinitializes ONLY through the established owner lifecycle.
 * The one explicit lifecycle that re-enters the connected projection is the
 * pre-adoption legacy tab surface: legacy `docViewerTabs` created after the
 * close normalize once into the records.
 */
export function applyCaptureClassicConversionOnce(
  ports: Pick<
    ConnectedTabOwnerPorts,
    'readCollection' | 'applyCollection' | 'mintTabId' | 'mintComponentInstanceId'
  >,
): void {
  const records = ports.readCollection();
  const viewState = usePanelStore.getState().viewStates[CAPTURE_PANEL_ID];
  if (records.tabs.length > 0) {
    // Hydrated valid generic state wins — unless the records can only be the
    // pre-hydration session blank AND persisted classic tabs exist (then the
    // classic tabs convert; the wholesale collection replacement discards the
    // artifact, and an in-flight blank fill settles as a bounded no-op).
    const legacyTabs = normalizeCaptureTabs(
      viewState?.docViewerTabs,
      viewState?.docViewerActiveTabId,
    );
    const blankArtifact = records.tabs.every((tab) => (
      tab.content.kind === 'empty' || isCaptureHomeBlankContent(tab.content)
    ));
    if (!(legacyTabs.tabs.length > 0 && blankArtifact)) return;
  }
  if (capturePostCloseEstablished(viewState)) {
    // Established post-close collection: the classic surface beneath is the
    // owner's lifecycle; neither conversion nor the initial policy re-arms.
    return;
  }
  const plan = planCaptureClassicConversion({
    // Presence with surviving legacy tabs: the explicit legacy lifecycle
    // acted after the close — normalize those tabs into the records.
    records: presenceOf(viewState) != null ? null : records,
    classic: classicProjectionFromViewState(viewState),
    mintTabId: ports.mintTabId,
    mintComponentInstanceId: ports.mintComponentInstanceId,
  });
  if (plan.kind === 'convert') {
    ports.applyCollection(plan.collection);
    const state = usePanelStore.getState();
    state.setViewState(CAPTURE_PANEL_ID, plan.classicReset);
    state._persistViewPatch(CAPTURE_PANEL_ID, plan.classicReset);
    return;
  }
  if (plan.kind === 'unavailable') {
    // Bounded unavailable: never silently reset. One tab presents the
    // product-safe message; the view stays usable.
    const tabId = ports.mintTabId();
    ports.applyCollection({
      tabs: [{
        tabId,
        content: {
          kind: 'component',
          revision: 0,
          component: {
            schemaVersion: 1,
            componentTypeId: CAPTURE_UNAVAILABLE_PRESENTER_ID,
            componentInstanceId: ports.mintComponentInstanceId(),
            input: { title: 'Unavailable', locationLabels: ['Capture', 'Unavailable'] },
            targetKey: CAPTURE_UNAVAILABLE_TARGET_KEY,
          },
        },
      }],
      activeTabId: tabId,
      reservations: [],
    });
  }
  // 'hydrated' and 'default' fall through to the configured initial policy.
}

let activeRuntime: ConnectedTabOwnerRuntime | null = null;
let activeWorkspaceId: string | null = null;

/** Called by the connected adapter hook when its runtime mounts/unmounts. */
export function setActiveCaptureConnectedRuntime(
  runtime: ConnectedTabOwnerRuntime | null,
  workspaceId: string | null,
): void {
  activeRuntime = runtime;
  activeWorkspaceId = runtime ? workspaceId : null;
}

/** True when the connected Capture path owns this view's tab surface now. */
export function isCaptureConnectedActive(): boolean {
  if (!activeRuntime || activeWorkspaceId === null) return false;
  if (usePanelStore.getState().activeWorkspaceId !== activeWorkspaceId) return false;
  return activeRuntime.readCollection().tabs.length > 0;
}

let requestSequence = 0;

/**
 * Routes one Capture document open through TABS-03 from the connected owner's
 * serialized lane. Returns false when the connected path is not active, so the
 * caller can fall back to the established classic behavior. Populated tabs are
 * never overwritten; exact matches activate and reveal.
 *
 * VIEW-02 §4.1: the connected entry point's failure is BOUNDED — when it
 * returns false (or the placement is rejected) the open fails with the
 * established toast, never a silent classic fallback.
 */
export function openCaptureDocument(request: {
  path?: string;
  folder?: string;
  name: string;
  disposition: 'current' | 'new';
}): boolean {
  if (!isCaptureConnectedActive() || !activeRuntime) {
    showToast('The document could not be opened. Try again.');
    return false;
  }
  const path = canonicalCapturePath(request.path ?? `${request.folder ?? ''}/${request.name}`);
  if (!path) {
    showToast('The document could not be opened. Try again.');
    return false;
  }
  const runtime = activeRuntime;
  const requestId = `capture-open-${Date.now().toString(36)}-${requestSequence++}`;
  void runtime.place({
    schemaVersion: 1,
    requestId,
    disposition: request.disposition,
    target: {
      presenterId: CAPTURE_DOCUMENT_PRESENTER_ID,
      targetKey: `${CAPTURE_VIEWER_TARGET_KEY_PREFIX}${path}`,
    },
  }).then((result) => {
    if (!result.ok) showToast('The document could not be opened. Try again.');
  }).catch(() => {
    showToast('The document could not be opened. Try again.');
  });
  return true;
}

/**
 * VIEW-02 §4.1/§4.3: the Capture landing presenter's supplied open handler.
 * The open/disposition decision lives here in the connected layer — presenters
 * call this handler; they never select dispositions or fall back themselves.
 * In-app opens (tile open, preview expand/new-tab) keep the accepted `new`
 * disposition (TABS-03: exact targetKey match → activate/reveal; else append;
 * never fills an Empty tab). Failure is the bounded toast inside
 * `openCaptureDocument`.
 */
export function openCaptureDocumentFromPresenter(request: {
  folder: string;
  path: string;
  name: string;
}): void {
  openCaptureDocument({ ...request, disposition: 'new' });
}

/** Closes one connected tab identified by its committed target key. */
export function closeCaptureTabByTargetKey(targetKey: string): void {
  const runtime = activeRuntime;
  if (!runtime) return;
  const record = findComponentTargetKey(runtime.readCollection(), targetKey);
  if (!record) return;
  void runtime.runIntent((turn) => { turn.closeTab(record.tabId); });
}

const scrollTimers = new Map<string, number>();

/** Throttled (established 100ms cadence) document scroll persistence. */
export function persistCaptureDocumentScroll(targetKey: string, scrollTop: number): void {
  const runtime = activeRuntime;
  if (!runtime) return;
  const existing = scrollTimers.get(targetKey);
  if (existing !== undefined) window.clearTimeout(existing);
  scrollTimers.set(targetKey, window.setTimeout(() => {
    scrollTimers.delete(targetKey);
    rewriteCommittedRecords(runtime, (records) => {
      const record = findComponentTargetKeyRecord(records, targetKey);
      const content = componentContentOf(record);
      if (!record || !content) return null;
      const component = {
        ...content.component,
        input: {
          ...(content.component.input as { [key: string]: unknown }),
          docScroll: Math.max(0, scrollTop),
        },
      };
      return records.map((candidate) => (
        candidate.tabId === record.tabId
          ? {
            ...candidate,
            content: { kind: 'component' as const, revision: content.revision, component },
          }
          : candidate
      ));
    });
  }, 100));
}

interface ComponentRecordContent {
  kind: 'component';
  revision: number;
  component: {
    schemaVersion: 1;
    componentTypeId: string;
    componentInstanceId: string;
    input: { [key: string]: unknown };
    targetKey?: string;
  };
}

function componentContentOf(
  record: TabPlacementSnapshotRecord | null,
): ComponentRecordContent | null {
  if (!record) return null;
  const content = record.content as ComponentRecordContent | null;
  if (!content || content.kind !== 'component') return null;
  return content;
}

function findComponentTargetKeyRecord(
  records: readonly TabPlacementSnapshotRecord[],
  targetKey: string,
): TabPlacementSnapshotRecord | null {
  for (const record of records) {
    const content = record.content as { kind?: unknown; component?: { targetKey?: unknown } } | null;
    if (!content || content.kind !== 'component') continue;
    if (content.component?.targetKey !== targetKey) continue;
    return record;
  }
  return null;
}

/**
 * One atomic acknowledged owner transition: the runtime's TABS-03 commit port
 * verifies the fresh prior read, applies the whole next collection, and
 * verifies the fresh post read — rejected as a bounded no-op otherwise.
 */
function rewriteCommittedRecords(
  runtime: ConnectedTabOwnerRuntime,
  mutate: (records: readonly TabPlacementSnapshotRecord[]) => readonly TabPlacementSnapshotRecord[] | null,
): void {
  const prior = runtime.buildSnapshot();
  if (!prior) return;
  const nextRecords = mutate(prior.tabs);
  if (!nextRecords) return;
  const nextSnapshot: TabPlacementSnapshot = {
    schemaVersion: 1,
    tabs: nextRecords,
    activeTabId: prior.activeTabId,
    reservations: prior.reservations,
  };
  runtime.commit({ schemaVersion: 1, priorSnapshot: prior, nextSnapshot });
}

export type CapturePathReferenceMutation = {
  sourcePath: string;
  targetPath: string;
  includeDescendants: boolean;
};

function matchingSuffix(path: string, source: string, includeDescendants: boolean): string | null {
  if (path === source) return '';
  if (includeDescendants && path.startsWith(`${source}/`)) return path.slice(source.length);
  return null;
}

function documentPathOf(record: TabPlacementSnapshotRecord): string | null {
  const content = record.content as { kind?: unknown; component?: { componentTypeId?: unknown } } | null;
  if (!content || content.kind !== 'component') return null;
  if (content.component?.componentTypeId !== CAPTURE_DOCUMENT_PRESENTER_ID) return null;
  const targetKey = (content.component as { targetKey?: unknown }).targetKey;
  if (typeof targetKey !== 'string' || !targetKey.startsWith(CAPTURE_VIEWER_TARGET_KEY_PREFIX)) {
    return null;
  }
  return canonicalCapturePath(targetKey.slice(CAPTURE_VIEWER_TARGET_KEY_PREFIX.length));
}

/**
 * Rewrites connected document-tab identities after a public move/rename event
 * (path references only; presenter identity and content fetching semantics
 * are re-derived from the new canonical path).
 */
export function rewriteCaptureConnectedPathReferences(
  mutation: CapturePathReferenceMutation,
): boolean {
  const runtime = activeRuntime;
  if (!runtime || !isCaptureConnectedActive()) return false;
  const source = canonicalCapturePath(mutation.sourcePath);
  const replacement = canonicalCapturePath(mutation.targetPath);
  if (!source || !replacement) return false;
  let changed = false;
  rewriteCommittedRecords(runtime, (records) => {
    const next: TabPlacementSnapshotRecord[] = [];
    for (const record of records) {
      const path = documentPathOf(record);
      if (path === null) {
        next.push(record);
        continue;
      }
      const suffix = matchingSuffix(path, source, mutation.includeDescendants);
      if (suffix === null) {
        next.push(record);
        continue;
      }
      changed = true;
      next.push(renameDocumentRecord(record, `${replacement}${suffix}`));
    }
    return changed ? next : null;
  });
  return changed;
}

function renameDocumentRecord(
  record: TabPlacementSnapshotRecord,
  nextPath: string,
): TabPlacementSnapshotRecord {
  const content = componentContentOf(record)!;
  const name = nextPath.slice(nextPath.lastIndexOf('/') + 1);
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const locationLabels = ['Capture', captureCollectionLabel(nextPath), name];
  const component = {
    ...content.component,
    targetKey: `${CAPTURE_VIEWER_TARGET_KEY_PREFIX}${nextPath}`,
    input: {
      ...(content.component.input as { [key: string]: unknown }),
      title: name,
      locationLabels,
      icon: getFileIcon(extension, name),
      iconClassName: `file-icon-${extension}`,
      path: nextPath,
      name,
      extension,
      lastOpenedPath: nextPath,
    },
  };
  const tab = record.tab as { label?: unknown; icon?: unknown; iconClassName?: unknown; closeLabel?: unknown };
  return {
    ...record,
    tab: {
      ...tab,
      label: name,
      icon: getFileIcon(extension, name),
      iconClassName: `file-icon-${extension}`,
      closeLabel: `Close ${name}`,
    },
    shell: record.shell,
    content: { kind: 'component', revision: content.revision, component },
  };
}

/** Removes connected document-tab identities after a public delete event. */
export function removeCaptureConnectedPathReferences(
  mutation: { sourcePath: string; includeDescendants: boolean },
): boolean {
  const runtime = activeRuntime;
  if (!runtime || !isCaptureConnectedActive()) return false;
  const source = canonicalCapturePath(mutation.sourcePath);
  if (!source) return false;
  const matching = runtime.readCollection().tabs
    .filter((tab) => {
      const path = documentPathOfRecordContent(tab);
      if (path === null) return false;
      return matchingSuffix(path, source, mutation.includeDescendants) !== null;
    })
    .map((tab) => tab.tabId);
  if (matching.length === 0) return false;
  // closeTab remaps the active id with the established survivor order.
  void runtime.runIntent((turn) => {
    for (const tabId of matching) turn.closeTab(tabId);
  });
  return true;
}

function documentPathOfRecordContent(
  tab: { content: unknown },
): string | null {
  const content = tab.content as { kind?: unknown; component?: { componentTypeId?: unknown; targetKey?: unknown } } | null;
  if (!content || content.kind !== 'component') return null;
  if (content.component?.componentTypeId !== CAPTURE_DOCUMENT_PRESENTER_ID) return null;
  const targetKey = content.component.targetKey;
  if (typeof targetKey !== 'string' || !targetKey.startsWith(CAPTURE_VIEWER_TARGET_KEY_PREFIX)) {
    return null;
  }
  return canonicalCapturePath(targetKey.slice(CAPTURE_VIEWER_TARGET_KEY_PREFIX.length));
}
