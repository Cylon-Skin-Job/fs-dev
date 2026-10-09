/**
 * WorkingActivity — pure presentation for the transient "Working…" state
 * (RCC-0108 SPEC-05 Slice A; parent §4.2/§4.3/§4.10).
 *
 * Visual: reuses `HourglassFlow size="sm"` and its existing 15-second
 * drain/flip cycle, with the same footprint/color vocabulary as the existing
 * tool rows (muted label, CSS variables with fallbacks only — §4.3).
 *
 * Label: the visible `Working… Ns` computes WHOLE elapsed seconds from the
 * server-authoritative `startedAt` as a clock delta — never an incrementing
 * counter (a backgrounded tab resyncs to the truthful value instead of
 * drifting) and never a forced initial `0s` (parent §4.10). The component is
 * remounted per step identity by the renderer (`key={identity}`), so every
 * step's first paint is truthful.
 *
 * Accessibility (§4.10): the HourglassFlow live region carries ONE stable
 * "Model working" announcement mounted once per Working appearance. The
 * changing per-second label is `aria-hidden` and rendered OUTSIDE that live
 * region, so the seconds are never repeatedly announced.
 */

import { useEffect, useState } from 'react';
import type { TurnActivity } from '../../types';
import { wholeElapsedSeconds } from '../../state/slices/chatActivityState';
import { HourglassFlow } from './HourglassFlow';
import './WorkingActivity.css';

/** Stable accessible status label — announced once, never once per second. */
const WORKING_STATUS_LABEL = 'Model working';

/** 1 Hz visual refresh; the value itself is always recomputed from the clock delta. */
const SECONDS_TICK_MS = 1000;

interface WorkingActivityProps {
  activity: TurnActivity;
}

export function WorkingActivity({ activity }: WorkingActivityProps) {
  const startedAt = activity.startedAt;
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    wholeElapsedSeconds(startedAt, Date.now())
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds(wholeElapsedSeconds(startedAt, Date.now()));
    }, SECONDS_TICK_MS);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="rv-working-activity">
      <HourglassFlow size="sm" ariaLabel={WORKING_STATUS_LABEL} />
      {/* Changing per-second text lives OUTSIDE the role="status" live region. */}
      <span className="rv-working-activity-seconds" aria-hidden="true">
        {`Working… ${elapsedSeconds}s`}
      </span>
    </div>
  );
}
