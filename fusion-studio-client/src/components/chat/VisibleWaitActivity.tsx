/** Local threshold presentation; elapsed time starts at the actual visible wait. */
import { useEffect, useState } from 'react';
import { WorkingActivity } from './WorkingActivity';

export function VisibleWaitActivity({ since }: { since: number }) {
  const [visible, setVisible] = useState(() => Date.now() - since >= 2000);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), Math.max(0, 2000 - (Date.now() - since)));
    return () => window.clearTimeout(timer);
  }, [since]);
  return visible ? <WorkingActivity startedAt={since} /> : null;
}
