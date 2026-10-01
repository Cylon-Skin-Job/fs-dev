import { useEffect, useState } from 'react';
import { sampleDiagnostic } from '../../lib/diagnostics/stream';
import { DiagnosticPanel } from './DiagnosticPanel';
export function ConnectedDiagnostics({ tabId }: { tabId: string }) {
  const [sample, setSample] = useState(() => sampleDiagnostic(tabId));
  useEffect(() => {
    const timer = setInterval(() => setSample(sampleDiagnostic(tabId)), 200);
    return () => clearInterval(timer);
  }, [tabId]);
  if (!sample) return <DiagnosticPanel text="" status="Capture unavailable" notice="" counters={[]} truncated={false} />;
  const seconds = Math.max(.2, (sample.now - sample.startedAt) / 1000);
  const surface = sample.surface;
  const counters = [
    `Native observed: ${sample.events} events · ${sample.sourceUnits} UTF-16 units · ${sample.sourceBytes} UTF-8 bytes · ${(sample.sourceUnits / seconds).toFixed(1)} units/s since capture`,
    `Last incoming: ${sample.lastIncomingAt === null ? 'none' : ((sample.now - sample.lastIncomingAt) / 1000).toFixed(1) + 's ago'}`,
    `Canonical accepted since capture: ${Object.entries(sample.canonicalEvents).map(([type, count]) => `${type} ${count} events${sample.canonical[type] === undefined ? ' (source units unknown)' : ` / ${sample.canonical[type]} source UTF-16`}`).join(' · ') || 'none'}`,
    `Renderer: ${sample.mounted ? 'mounted' : surface ? 'unmounted — last known' : 'unavailable'} · phase ${surface?.phase ?? 'unknown'} · visible wait ${!sample.mounted ? 'unavailable' : surface?.waitingSince == null ? 'none' : ((sample.now - surface.waitingSince) / 1000).toFixed(1) + 's'}`,
  ];
  counters.push(`Measured reveal (last sample interval): ${sample.mounted ? sample.rates.join(' · ') || 'no visible units' : 'unavailable'}`);
  counters.push(`Queued later segments (before parsing): ${surface ? surface.queuedSegments : 'unknown'} · source prefix counts are completed boundaries, not an exact current character`);
  for (const segment of surface?.segments ?? []) {
    const remaining = segment.speedMs !== null && segment.batchSize !== null && segment.batchSize > 0
      ? Math.ceil(Math.max(0, segment.chunkTotal - segment.chunkVisible) / segment.batchSize) * segment.speedMs : null;
    counters.push(`${segment.index + 1}. ${segment.type} · ${segment.phase} · received ${segment.receivedSource} source UTF-16 · completed source prefix ${segment.sourceCursor ?? 'unknown'} · uncommitted source ${segment.sourceCursor === null ? 'unknown' : Math.max(0, segment.receivedSource - segment.sourceCursor)} · visible ${segment.visible} ${segment.visibleUnit} · chunk ${segment.chunkVisible}/${segment.chunkTotal} · ready ${segment.readyChunks} · last visible ${!sample.mounted ? 'unavailable' : segment.lastVisibleAt === null ? 'none' : ((sample.now - segment.lastVisibleAt) / 1000).toFixed(1) + 's ago'} · current chunk nominal ${remaining === null ? 'unknown' : remaining + 'ms'}`);
  }
  return <DiagnosticPanel text={sample.text} status={`${sample.availability}${sample.terminal ? ' · turn ended (renderer may still drain)' : ''}`}
    notice={sample.notice} counters={counters} truncated={sample.truncated} />;
}
