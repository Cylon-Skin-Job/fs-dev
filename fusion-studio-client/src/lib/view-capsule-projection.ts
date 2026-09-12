export interface ViewCapsuleProjection {
  version: 1;
  workspaceId: string;
  machineIdentity: string;
  entries: ReadonlyArray<Readonly<{ viewId: string; folderName: string }>>;
}

const VIEW_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MACHINE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const MAX_VIEW_CAPSULES = 256;
const encoder = new TextEncoder();
let installationTail: Promise<void> = Promise.resolve();
let installationEpoch = 0;

function enqueueInstallation<T>(operation: () => Promise<T>): Promise<T> {
  const result = installationTail.then(operation, operation);
  installationTail = result.then(() => undefined, () => undefined);
  return result;
}

function exactKeys(value: object, expected: string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function isRuntimeGeneration(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && encoder.encode(value).length <= 256
    && !containsAsciiControl(value);
}

export function retireViewCapsuleProjectionInstallations(): void {
  installationEpoch += 1;
}

export function parseViewCapsuleProjection(value: unknown): ViewCapsuleProjection | null {
  if (!plainRecord(value) || !exactKeys(value, ['entries', 'machineIdentity', 'version', 'workspaceId'])) return null;
  if (
    value.version !== 1
    || typeof value.workspaceId !== 'string'
    || value.workspaceId.length === 0
    || encoder.encode(value.workspaceId).length > 256
    || containsAsciiControl(value.workspaceId)
    || typeof value.machineIdentity !== 'string'
    || value.machineIdentity === '.'
    || value.machineIdentity === '..'
    || encoder.encode(value.machineIdentity).length > 128
    || !MACHINE_ID_PATTERN.test(value.machineIdentity)
    || !Array.isArray(value.entries)
    || value.entries.length > MAX_VIEW_CAPSULES
  ) return null;

  const viewIds = new Set<string>();
  const folderNames = new Set<string>();
  const entries: Array<Readonly<{ viewId: string; folderName: string }>> = [];
  for (const entry of value.entries) {
    if (!plainRecord(entry) || !exactKeys(entry, ['folderName', 'viewId'])) return null;
    if (
      typeof entry.viewId !== 'string'
      || encoder.encode(entry.viewId).length > 128
      || !VIEW_ID_PATTERN.test(entry.viewId)
      || typeof entry.folderName !== 'string'
      || entry.folderName.length === 0
      || entry.folderName === '.'
      || entry.folderName === '..'
      || encoder.encode(entry.folderName).length > 255
      || entry.folderName.includes('/')
      || entry.folderName.includes('\\')
      || entry.folderName.includes('\0')
      || viewIds.has(entry.viewId)
      || folderNames.has(entry.folderName)
    ) return null;
    viewIds.add(entry.viewId);
    folderNames.add(entry.folderName);
    entries.push(Object.freeze({ viewId: entry.viewId, folderName: entry.folderName }));
  }

  return Object.freeze({
    version: 1,
    workspaceId: value.workspaceId,
    machineIdentity: value.machineIdentity,
    entries: Object.freeze(entries),
  });
}

export function forwardWorkspaceBinding(
  workspaceId: string | null,
  bindingRevision: number,
  runtimeGeneration: string | null,
): Promise<boolean> {
  // A workspace change is a priority revocation boundary. Do not place it
  // behind capsule verification for the previous workspace: invalidate every
  // queued renderer installation and dispatch the Electron clear/bind now.
  retireViewCapsuleProjectionInstallations();
  const epoch = installationEpoch;
  return (async () => {
    if (epoch !== installationEpoch || !Number.isSafeInteger(bindingRevision)
      || bindingRevision < 1 || !isRuntimeGeneration(runtimeGeneration)) return false;
    const installer = window.electronAPI?.setWorkspaceBinding;
    if (!installer) return false;
    try {
      const accepted = await installer(workspaceId, bindingRevision, runtimeGeneration);
      return epoch === installationEpoch && accepted;
    } catch {
      return false;
    }
  })();
}

export function forwardViewCapsuleProjection(
  value: unknown,
  runtimeGeneration: string | null,
): Promise<boolean> {
  const parsed = parseViewCapsuleProjection(value);
  if (!parsed) {
    return clearViewCapsuleProjection(runtimeGeneration).then(() => false);
  }
  const epoch = installationEpoch;
  return enqueueInstallation(async () => {
    if (epoch !== installationEpoch || !isRuntimeGeneration(runtimeGeneration)) return false;
    const installer = window.electronAPI?.replaceViewCapsuleProjection;
    if (!installer) return false;
    try {
      const accepted = await installer(parsed, runtimeGeneration);
      return epoch === installationEpoch && accepted;
    } catch {
      return false;
    }
  });
}

export function clearViewCapsuleProjection(runtimeGeneration: string | null): Promise<boolean> {
  // Malformed or unavailable current-registry input is a priority revocation
  // boundary, not another operation behind prior verification.
  retireViewCapsuleProjectionInstallations();
  const epoch = installationEpoch;
  return (async () => {
    if (epoch !== installationEpoch || !isRuntimeGeneration(runtimeGeneration)) return false;
    const installer = window.electronAPI?.replaceViewCapsuleProjection;
    if (!installer) return false;
    try {
      const accepted = await installer(null, runtimeGeneration);
      return epoch === installationEpoch && accepted;
    } catch {
      return false;
    }
  })();
}
