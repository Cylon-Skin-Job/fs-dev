import { useLayoutEffect, useRef } from 'react';
import './diagnostics.css';
export interface DiagnosticPanelProps {
  text: string;
  status: string;
  notice: string;
  counters: readonly string[];
  truncated: boolean;
}
/** Plain text observation surface. No provider parsing, markdown or HTML injection. */
export function DiagnosticPanel({ text, status, notice, counters, truncated }: DiagnosticPanelProps) {
  const viewport = useRef<HTMLPreElement>(null);
  const follow = useRef(true);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && follow.current) element.scrollTop = element.scrollHeight;
  }, [text]);
  return <section className="rv-diagnostics" aria-label="Stream diagnostics">
    <div className="rv-diagnostics-header">
      <strong>{status}</strong>
      <div>Native JSON event lines · redaction enabled · UTF-16 source units / UTF-8 bytes · not model tokens</div>
      <div>{notice}</div>
      <div>Capture is temporary; every new turn replaces this stream.</div>
      <div className="rv-diagnostics-counters">{counters.map((line, i) => <div key={i}>{line}</div>)}</div>
      <div>Timing is nominal for the current received chunk only; future output, tool completion, pauses and event-loop delay are unknown.</div>
      {truncated && <div role="status">Older text discarded at the 128 Ki UTF-16 scrollback limit; observed counters retained.</div>}
    </div>
    <pre ref={viewport} className="rv-diagnostics-stream" aria-label="Native event stream" onScroll={() => {
      const el = viewport.current;
      if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    }}>{text}</pre>
  </section>;
}
