import fs from 'node:fs';
import path from 'node:path';

// The affected owner graph is explicit: dependencies outside this inventory are
// existing platform boundaries, not silently treated as newly reviewed owners.
export const ownerPaths = [
  'fusion-studio-server/lib/event-bus.js',
  'fusion-studio-server/lib/thread-groups/action-result-repository.js',
  'fusion-studio-server/lib/thread-groups/delete-service.js',
  'fusion-studio-server/lib/thread-groups/delete-transaction.js',
  'fusion-studio-server/lib/thread-groups/link-service.js',
  'fusion-studio-server/lib/thread-groups/member-service.js',
  'fusion-studio-server/lib/thread-groups/mirror-repository.js',
  'fusion-studio-server/lib/thread-groups/move-service.js',
  'fusion-studio-server/lib/thread-groups/placement-delivery.js',
  'fusion-studio-server/lib/thread-groups/projection-outbox-repository.js',
  'fusion-studio-server/lib/thread-groups/repository.js',
  'fusion-studio-server/lib/thread-groups/selection-service.js',
  'fusion-studio-server/lib/thread-groups/service.js',
  'fusion-studio-server/lib/thread-groups/session-transactions.js',
  'fusion-studio-server/lib/thread-groups/startup-reconciliation.js',
  'fusion-studio-server/lib/thread/HistoryFile.js',
  'fusion-studio-server/lib/thread/ThreadIndex.js',
  'fusion-studio-server/lib/wire/terminal-saved-delivery.js',
  'fusion-studio-server/lib/wire/wire-broadcaster.js',
  'fusion-studio-server/lib/thread/thread-crud.js',
  'fusion-studio-server/lib/thread/thread-open-handler.js',
  'fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx',
  'fusion-studio-client/src/lib/ws/thread-handlers.ts',
  'fusion-studio-client/src/lib/ws/thread-history.ts',
  'fusion-studio-client/src/lib/ws/thread-markdown.ts',
  'fusion-studio-client/src/types/websocket.ts',
  'fusion-studio-server/lib/thread/ThreadManager.js',
  'fusion-studio-server/lib/thread/ThreadWebSocketHandler.js',
  'fusion-studio-server/lib/thread/automation-drain.js',
  'fusion-studio-server/lib/thread/automation-runtime-activation.js',
  'fusion-studio-server/lib/thread/automation-turn-context.js',
  'fusion-studio-server/lib/thread/canonical-drain-context.js',
  'fusion-studio-server/lib/thread/chatlog-mirror.js',
  'fusion-studio-server/lib/thread/mirror-journal.js',
  'fusion-studio-server/lib/thread/provider-termination.js',
  'fusion-studio-server/lib/thread/runtime-activation.js',
  'fusion-studio-server/lib/thread/runtime-dispatch.js',
  'fusion-studio-server/lib/thread/runtime-identity.js',
  'fusion-studio-server/lib/thread/runtime-prompt-admission.js',
  'fusion-studio-server/lib/thread/runtime-response.js',
  'fusion-studio-server/lib/thread/runtime-session-activation.js',
  'fusion-studio-server/lib/thread/runtime-session-binding.js',
  'fusion-studio-server/lib/thread/runtime-stop.js',
  'fusion-studio-server/lib/thread/session-lifecycle.js',
  'fusion-studio-server/lib/thread/session-manager.js',
  'fusion-studio-server/lib/thread/session-metadata.js',
  'fusion-studio-server/lib/thread/session-repository.js',
  'fusion-studio-server/lib/thread/thread-runtime-automation.js',
  'fusion-studio-server/lib/thread/thread-runtime-controller.js',
  'fusion-studio-server/lib/thread/thread-runtime-manager.js',
  'fusion-studio-server/lib/thread/turn-application-context.js',
  'fusion-studio-server/lib/ws/thread-action-handler.js',
  'fusion-studio-server/lib/ws/thread-action-protocol.js',
  'fusion-studio-server/lib/ws/thread-provider-binding.js',
  'fusion-studio-server/lib/ws/thread-ws-handlers.js',
];

export function sourceViolations(file, source) {
  const violations = [];
  const lines = source.trimEnd().split(/\r?\n/).length;
  if (lines > 400) violations.push(`line limit: ${lines}`);
  if (/(?:threadManager|manager)\s*:\s*this\b/.test(source)) violations.push('full manager injection');
  if (!file.endsWith('/thread-runtime-manager.js')
    && /(?:runtimeStates?|runtimeByThread|turnStates?|activeTurns?)\s*=\s*new\s+Map\s*\(/.test(source)) {
    violations.push('duplicate runtime state');
  }
  if (file.endsWith('/ThreadManager.js')
    && /\.transaction\(|\bfor\s*\(|\bwhile\s*\(|\.stage\(|Math\.|Date\.now\(/.test(source)) {
    violations.push('facade policy or transaction');
  }
  return violations;
}

export function relativeDependencies(source) {
  return [...source.matchAll(/(?:require\(\s*|from\s+|import\s*)['"](\.[^'"]+)['"]/g)]
    .map(match => match[1]);
}

export function ownerGraph(root, sources) {
  const paths = new Set(Object.keys(sources));
  return Object.fromEntries(Object.entries(sources).map(([file, source]) => {
    const edges = relativeDependencies(source).flatMap((dependency) => {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), dependency));
      return [resolved, ...['js', 'ts', 'tsx', 'mjs'].flatMap(extension =>
        [`${resolved}.${extension}`, `${resolved}/index.${extension}`])].filter((p) => paths.has(p));
    });
    return [file, [...new Set(edges)]];
  }));
}

export function graphCycles(graph) {
  const done = new Set(); const active = []; const cycles = [];
  function visit(node) {
    if (active.includes(node)) { cycles.push([...active.slice(active.indexOf(node)), node]); return; }
    if (done.has(node)) return;
    active.push(node);
    for (const dependency of graph[node] || []) visit(dependency);
    active.pop(); done.add(node);
  }
  Object.keys(graph).forEach(visit);
  return cycles;
}

export function inspectOwners(root) {
  const sources = Object.fromEntries(ownerPaths.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  return { sources, graph: ownerGraph(root, sources), violations: Object.fromEntries(
    Object.entries(sources).map(([file, source]) => [file, sourceViolations(file, source)]).filter(([, v]) => v.length),
  ) };
}
